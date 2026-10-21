import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const user='11111111-1111-4111-8111-111111111111';
test('recepción simple confirma lotes y stock en una operación, con reintentos seguros',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;
   create table public.categorias(id bigserial primary key,nombre text);
   create table public.proveedores(id bigserial primary key,nombre text);
   create table public.sedes(id bigserial primary key,nombre text);
   create table public.productos(id bigserial primary key,nombre text,codigo text);
   create table public.inventario(id bigserial primary key,producto_id bigint,sede_id bigint,cantidad integer default 0,unique(producto_id,sede_id));
   create table public.movimientos(id bigserial primary key);`);
  for(const file of ['202609150001_auth_access.sql','202609150002_inventory_modules.sql','202609150004_recepciones.sql','202609150006_catalogo_recepciones.sql','202610200014_recepcion_lotes_automaticos.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${user}','test@example.test');insert into public.auth_perfiles(user_id,nombre,activo,rol)values('${user}','Admin',true,'administrador');
   insert into public.productos(id,codigo,nombre,unidad_medida,controla_inventario,es_perecible)values(1,'P1','Carne','kg',true,true),(2,'P2','Latas','unidad',true,false),(3,'S1','Servicio','unidad',false,false);
   insert into public.proveedores(id,nombre)values(1,'Proveedor');insert into public.sedes(id,nombre)values(1,'Central');
   select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);
  const future=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
  let sequence=0;
  const payload=(details)=>({operacion_id:crypto.randomUUID(),proveedor_id:'1',sede_id:'1',tipo_comprobante:'Factura',serie:'F001',numero:String(++sequence),fecha_emision:new Date().toISOString().slice(0,10),fecha_recepcion:new Date().toISOString().slice(0,10),responsable:'Admin',detalles:details});
  const line=(product='1',extra={})=>({producto_id:product,cantidad_recibida:5,vencimiento:future,...extra});
  const save=async data=>(await db.query('select public.app_registrar_recepcion_simple($1::jsonb) as id',[JSON.stringify(data)])).rows[0].id;
  const count=async table=>Number((await db.query('select count(*) as n from public.'+table)).rows[0].n);
  await t.test('crea lote y entrada, usa cantidad recibida como facturada y no duplica al reintentar',async()=>{
   const data=payload([line()]),id=await save(data);
   assert.equal(await save(data),id);assert.equal(await count('recepciones'),1);assert.equal(await count('lotes'),1);assert.equal(await count('movimientos'),1);
   const lot=(await db.query('select * from public.lotes')).rows[0];assert.match(lot.codigo,/^REC-/);assert.equal(lot.proveedor_id,1);
   const detail=(await db.query('select * from public.recepcion_detalles')).rows[0];assert.equal(Number(detail.cantidad_facturada),5);assert.equal(detail.unidad,'kg');
   await assert.rejects(save({...data,detalles:[line('1',{cantidad_recibida:6})]}),/otros datos/);
  });
  await t.test('rechaza perecibles sin fecha y revierte lotes de líneas anteriores si una línea falla',async()=>{
   const before=await count('lotes');
   await assert.rejects(save(payload([line('1',{vencimiento:null})])),/vencimiento/);
   await assert.rejects(save(payload([line('2',{vencimiento:null}),line('999')])),/inexistente/);
   assert.equal(await count('lotes'),before);assert.equal(await count('recepciones'),1);
  });
  await t.test('no perecibles sin fecha conservan trazabilidad; servicios no crean lotes ni stock',async()=>{
   await save(payload([line('2',{vencimiento:null}),line('3',{vencimiento:null})]));
   const lots=(await db.query('select * from public.lotes where producto_id=2')).rows;
   assert.equal(lots.length,1);assert.equal(lots[0].vencimiento,null);
   assert.equal((await db.query('select * from public.inventario where producto_id=3')).rows.length,0);
   assert.equal(await count('movimientos'),2);
  });
  await t.test('reutiliza código del proveedor sin duplicar lote y rechaza vencimientos incompatibles',async()=>{
   await save(payload([line('1',{codigo_lote:'PROV-001'})]));
   await save(payload([line('1',{codigo_lote:'prov-001'})]));
   assert.equal((await db.query("select * from public.lotes where lower(codigo)='prov-001'")).rows.length,1);
   await assert.rejects(save(payload([line('1',{codigo_lote:'PROV-001',vencimiento:'2099-01-01'})])),/otro vencimiento/);
  });
  await t.test('cantidades facturadas distintas mantienen el faltante y el stock solo refleja lo recibido',async()=>{
   const id=await save(payload([line('1',{cantidad_facturada:10,cantidad_recibida:7})]));
   const d=(await db.query('select * from public.recepcion_detalles where recepcion_id=$1',[id])).rows[0];
   assert.equal(Number(d.cantidad_facturada)-Number(d.cantidad_recibida),3);
   assert.equal(Number((await db.query('select cantidad from public.inventario where lote_id=$1',[d.lote_id])).rows[0].cantidad),7);
  });
  await t.test('consulta y anónimo no pueden registrar recepciones',async()=>{
   await db.exec(`reset role;update public.auth_perfiles set rol='consulta';set role authenticated;`);
   await assert.rejects(save(payload([line()])),/permiso/);
   await db.exec('reset role;set role anon;');await assert.rejects(save(payload([line()])),/permission denied/);
  });
 }finally{await db.close();}
});
