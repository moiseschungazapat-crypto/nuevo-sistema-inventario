import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const admin='11111111-1111-4111-8111-111111111111',operator='22222222-2222-4222-8222-222222222222',reader='33333333-3333-4333-8333-333333333333';
const first=await readFile(new URL('../supabase/migrations/202609150001_auth_access.sql',import.meta.url),'utf8');
const second=await readFile(new URL('../supabase/migrations/202609150002_inventory_modules.sql',import.meta.url),'utf8');
async function setup(legacy=false){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 insert into auth.users values ('${admin}','admin@test.local'),('${operator}','operator@test.local'),('${reader}','reader@test.local');`);
 if(legacy)await db.exec(`create table public.categorias(id bigserial primary key,nombre text);
 create table public.proveedores(id bigserial primary key,nombre text);
 create table public.sedes(id bigserial primary key,nombre text);
 create table public.productos(id bigserial primary key,nombre text,codigo text);
 create table public.inventario(id bigserial primary key,producto_id bigint,sede_id bigint,cantidad integer default 0,unique(producto_id,sede_id));
 create table public.movimientos(id bigserial primary key);`);
 await db.exec(first);await db.exec(second);
 await db.exec(`insert into public.auth_perfiles(user_id,nombre,activo,rol) values ('${admin}','Admin',true,'administrador'),('${operator}','Operator',true,'operador'),('${reader}','Reader',true,'consulta');`);
 return db;
}
async function asUser(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
for(const legacy of [false,true])test('Reglas PostgreSQL con IDs '+(legacy?'bigint existentes':'UUID nuevos'),async t=>{
 const db=await setup(legacy);
 try{
 await asUser(db,admin);
 const prod=(await db.query("insert into public.productos(nombre,codigo,unidad_medida) values('Harina','HAR-001','kg') returning id")).rows[0].id;
 const sites=(await db.query("insert into public.sedes(nombre) values('Central'),('Norte') returning id")).rows;
 const origin=String(sites[0].id),destination=String(sites[1].id),product=String(prod);
 const lot=(await db.query("select public.app_crear_lote($1,'L-001',(current_date+60)::date) as id",[product])).rows[0].id;
 const past=(await db.query("select public.app_crear_lote($1,'L-VENCIDO',(current_date-1)::date) as id",[product])).rows[0].id;
 const move=async({id=crypto.randomUUID(),type='entrada',amount=10,lotId=lot,from=origin,to=null,reason='Prueba'}={})=>
  (await db.query("select public.app_registrar_movimiento($1,$2,$3,$4,$5,$6,$7,'DOC-1',$8) as result",[id,type,product,lotId,from,to,amount,reason])).rows[0].result;
 await t.test('entrada confirma stock y movimiento; reintento no duplica',async()=>{
  const id=crypto.randomUUID();await move({id});const repeated=await move({id});
  assert.equal(repeated.repetido,true);
  assert.equal(Number((await db.query("select cantidad from public.inventario")).rows[0].cantidad),10);
  await assert.rejects(move({id,amount:11}),/otros datos/);
 });
 await t.test('salida insuficiente se revierte sin movimiento parcial',async()=>{
  await assert.rejects(move({type:'salida',amount:11}),/Stock insuficiente/);
  assert.equal((await db.query('select * from public.movimientos')).rows.length,1);
  assert.equal(Number((await db.query('select cantidad from public.inventario')).rows[0].cantidad),10);
 });
 await t.test('traslado conserva total y registra ambas sedes',async()=>{
  await move({type:'traslado',amount:4,to:destination});
  const balances=(await db.query('select cantidad from public.inventario order by cantidad')).rows.map(r=>Number(r.cantidad));
  assert.deepEqual(balances,[4,6]);
  await assert.rejects(move({type:'traslado',to:origin}),/diferente/);
 });
 await t.test('lote vencido no admite entradas y no genera saldo',async()=>{
  await assert.rejects(move({lotId:past}),/vencido/);
  assert.equal((await db.query('select * from public.inventario where lote_id=$1',[past])).rows.length,0);
 });
 await t.test('cantidades inválidas son rechazadas en servidor',async()=>{
  for(const amount of [0,-1,0.0001])await assert.rejects(move({amount}),/Cantidad no válida/);
 });
 await t.test('RLS impide editar saldos o movimientos directamente',async()=>{
  await assert.rejects(db.query('update public.inventario set cantidad=100'),/permission denied/);
  await assert.rejects(db.query('delete from public.movimientos'),/permission denied/);
  await assert.rejects(db.query("update public.auth_perfiles set rol='administrador'"),/permission denied/);
 });
 await t.test('versionado y unidad de producto con historial',async()=>{
  const before=(await db.query('select version from public.productos where id::text=$1',[product])).rows[0].version;
  await db.query("update public.productos set nombre='Harina especial' where id::text=$1 and version=$2",[product,before]);
  const result=await db.query("update public.productos set nombre='Conflicto' where id::text=$1 and version=$2 returning id",[product,before]);
  assert.equal(result.rows.length,0);
  await assert.rejects(db.query("update public.productos set unidad_medida='unidad' where id::text=$1",[product]),/unidad/);
 });
 await t.test('mínimos, vistas y resumen consultan datos reales',async()=>{
  await db.query('select public.app_configurar_minimo($1,$2,8)',[product,origin]);
  const summary=(await db.query('select public.app_resumen() as data')).rows[0].data;
  assert.equal(summary.productos,1);assert.equal(summary.bajo_minimo,1);
  assert.equal(summary.actividad.length,7);assert.equal(summary.recientes.length,2);
  assert.equal((await db.query('select * from public.app_stock')).rows.length,2);
 });
 await t.test('no se deshabilita el último administrador',async()=>{
  await assert.rejects(db.query("select public.app_guardar_usuario('admin@test.local','Admin','consulta',true)"),/al menos/);
 });
 await t.test('exportación respeta filtros y rango de fechas',async()=>{
  const exported=(await db.query('select public.app_exportar_movimientos($1,null,null,null,null) as data',[product])).rows[0].data;
  assert.equal(exported.length,2);
  assert.equal((await db.query("select public.app_exportar_movimientos(null,null,'salida',null,null) as data")).rows[0].data.length,0);
  await assert.rejects(db.query("select public.app_exportar_movimientos(null,null,null,'2026-10-01','2026-09-01')"),/Rango/);
  assert.equal((await db.query('select public.app_exportar_stock($1,$2) as data',[product,origin])).rows[0].data.length,1);
 });
 await t.test('mínimo sin movimientos también aparece con saldo cero',async()=>{
  const empty=(await db.query("insert into public.sedes(nombre) values('Sede sin saldo') returning id")).rows[0].id;
  await db.query('select public.app_configurar_minimo($1,$2,5)',[product,String(empty)]);
  const zero=(await db.query('select * from public.app_stock where sede_id::text=$1',[String(empty)])).rows[0];
  assert.equal(Number(zero.cantidad),0);assert.equal(zero.lote_id,null);
  // Retirar el mínimo de esta prueba con el propietario, para conservar los conteos siguientes.
  await db.exec('reset role');await db.query('delete from public.inventario_minimos where sede_id::text=$1',[String(empty)]);await asUser(db,admin);
 });
 await t.test('operador registra salidas pero no ajustes ni usuarios',async()=>{
  await asUser(db,operator);await move({type:'salida',amount:1});
  await assert.rejects(move({type:'ajuste_negativo',amount:1}),/administrador/);
  await assert.rejects(db.query('select public.app_listar_usuarios()'),/administrador/);
 });
 await t.test('consulta no puede escribir y anon no puede leer',async()=>{
  await asUser(db,reader);
  assert.equal((await db.query('select * from public.app_stock')).rows.length,2);
  await assert.rejects(move(),/permiso/);
  await assert.rejects(db.query("insert into public.sedes(nombre) values('No autorizado')"),/row-level security/);
  await db.exec("reset role;set role anon");
  await assert.rejects(db.query('select * from public.productos'),/permission denied/);
  await assert.rejects(db.query('select public.app_mi_acceso()'),/permission denied/);
 });
 await t.test('inactivo queda bloqueado en vistas y RPC',async()=>{
  await db.exec('reset role');
  await db.query('update public.auth_perfiles set activo=false where user_id=$1',[reader]);
  await asUser(db,reader);
  assert.equal((await db.query('select * from public.app_stock')).rows.length,0);
  await assert.rejects(db.query('select public.app_mi_acceso()'),/habilitado/);
 });
 }finally{await db.close();}
});
test('la migración rechaza inventario existente sin borrarlo',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create table public.auth_perfiles(id int);create table public.inventario(id int);insert into public.inventario values(1)");
  await assert.rejects(db.exec(second),/contiene datos anteriores/);
  await db.exec('rollback');
  assert.equal((await db.query('select * from public.inventario')).rows.length,1);
 }finally{await db.close();}
});
