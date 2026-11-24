import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expenseReportRows} from '../js/utils/expense-report.js';
import {entryCostTotal} from '../supabase/functions/sincronizar-inventario-sheets/sheets.mjs';

test('el total de costo redondea céntimos como PostgreSQL',()=>{
 assert.equal(entryCostTotal(1,1.005),1.01);
 assert.equal(entryCostTotal(3,2.675),8.03);
 assert.equal(entryCostTotal(.125,3.14),.39);
});

test('reporte consolida gastos por producto, conserva unidades y suma céntimos',()=>{
 const base={producto_codigo:'P1',producto_nombre:'Arroz',categoria:'Mercadería',unidad:'kg'};
 const rows=expenseReportRows([{...base,cantidad:1,monto:.1},{...base,cantidad:2,monto:.2},{...base,unidad:'unidad',cantidad:1,monto:2},{concepto:'Luz',categoria:'Servicios',monto:5}]);
 assert.equal(rows.length,3);assert.deepEqual(rows.find(row=>row[4]==='kg'),['P1','Arroz','Mercadería',3,'kg',.3]);
 assert.equal(rows.find(row=>row[1]==='Luz')[3],null);
});

test('entradas y gastos se confirman juntos, sin duplicar; salidas no generan gasto',async()=>{
 const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',operator='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table public.categorias(id bigserial primary key,nombre text);create table public.proveedores(id bigserial primary key,nombre text);create table public.sedes(id bigserial primary key,nombre text);create table public.productos(id bigserial primary key,nombre text,codigo text);create table public.inventario(id bigserial primary key,producto_id bigint,sede_id bigint,cantidad integer default 0,unique(producto_id,sede_id));create table public.movimientos(id bigserial primary key);`);
  for(const name of ['202609150001_auth_access.sql','202609150002_inventory_modules.sql','202609150004_recepciones.sql','202609150006_catalogo_recepciones.sql','202610200014_recepcion_lotes_automaticos.sql','202611130018_google_sheets_operativo.sql','202611240002_gastos_administracion.sql','202611240003_costos_entradas_gastos.sql','202611240004_resumen_gastos_inicio.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${admin}','admin@test.local'),('${operator}','operator@test.local');insert into public.auth_perfiles(user_id,nombre,activo,rol)values('${admin}','Admin',true,'administrador'),('${operator}','Operador',true,'operador');insert into public.productos(id,nombre,codigo,unidad_medida,es_perecible)values(1,'Arroz','P1','kg',false);insert into public.proveedores(id,nombre)values(1,'Proveedor');insert into public.sedes(id,nombre)values(1,'Central');select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated;`);
  const date=(await db.query("select (now() at time zone 'America/Lima')::date::text as d")).rows[0].d;
  const input=()=>({operacion_id:crypto.randomUUID(),proveedor_id:'1',sede_id:'1',tipo_comprobante:'Ingreso de inventario',serie:'INT',numero:crypto.randomUUID(),fecha_emision:date,fecha_recepcion:date,responsable:'Admin',detalles:[{producto_id:'1',cantidad_recibida:10,precio_unitario:2.5}]});
  const save=async data=>(await db.query('select public.app_registrar_recepcion_con_costo($1) as id',[JSON.stringify(data)])).rows[0].id;
  const stock=async()=>Number((await db.query('select coalesce(sum(cantidad),0) n from public.inventario')).rows[0].n);
  const summary=async()=>(await db.query('select public.app_gastos_mes($1) as data',[date])).rows[0].data;
  const data=input(),rid=await save(data);assert.equal(await save(data),rid);
  let gastos=await summary();assert.equal(gastos.cantidad,1);assert.equal(Number(gastos.total),25);assert.equal(gastos.gastos[0].cantidad,10);assert.equal(gastos.gastos[0].costo_unitario,2.5);assert.equal(gastos.gastos[0].proveedor,'Proveedor');assert.equal(await stock(),10);
  assert.equal(Number(gastos.total_productos),25);assert.equal(Number(gastos.total_otros),0);
  const gid=gastos.gastos[0].id;
  await assert.rejects(db.query('select public.app_guardar_gasto($1,$2,$3,1)',[crypto.randomUUID(),JSON.stringify({fecha:date,concepto:'Cambio',categoria:'Mercadería',monto:1}),gid]),/generado por una entrada/);
  const bad=input();delete bad.detalles[0].precio_unitario;await assert.rejects(save(bad),/costo unitario/);assert.equal(await stock(),10);
  const invalid=input();invalid.detalles.push({producto_id:'999',cantidad_recibida:1,precio_unitario:1});await assert.rejects(save(invalid),/inexistente/);assert.equal(await stock(),10);assert.equal((await summary()).cantidad,1);
  const google=input(),op=google.operacion_id;delete google.operacion_id;
  const sync=()=>db.query('select public.app_registrar_recepcion_google_sheets($1,$2) as data',[op,JSON.stringify(google)]);
  await sync();await sync();assert.equal(await stock(),20);assert.equal((await summary()).cantidad,2);
  const lot=(await db.query('select id from public.lotes limit 1')).rows[0].id;
  const args=[crypto.randomUUID(),'1',lot,'1',2,'DOC','Entrada inicial',3];
  const manual=()=>db.query('select public.app_registrar_entrada_con_costo($1,$2,$3,$4,$5,$6,$7,$8)',args);
  await manual();await manual();assert.equal(await stock(),22);assert.equal((await summary()).cantidad,3);assert.equal(Number((await summary()).total),56);
  const preview=(await db.query('select public.app_resumen_gastos_inicio() as data')).rows[0].data;
  assert.equal(Number(preview.total),56);assert.equal(preview.cantidad,3);assert.equal(preview.periodo,date.slice(0,7)+'-01');
  await assert.rejects(db.query('select public.app_registrar_entrada_con_costo($1,$2,$3,$4,$5,$6,$7,$8)',[...args.slice(0,7),4]),/otro costo/);
  await db.query("select public.app_registrar_movimiento($1,'salida','1',$2,'1',null,1,'','Consumo')",[crypto.randomUUID(),lot]);
  assert.equal(await stock(),21);assert.equal((await summary()).cantidad,3);
  await db.exec(`reset role;create function public.fallo_movimiento_prueba() returns trigger language plpgsql as $$begin raise exception 'Fallo simulado de movimiento';end$$;create trigger fallo_prueba before insert on public.movimientos for each row execute function public.fallo_movimiento_prueba();set role authenticated;`);
  await assert.rejects(save(input()),/Fallo simulado/);
  assert.equal(await stock(),21);assert.equal((await summary()).cantidad,3);
  await db.exec('reset role;drop trigger fallo_prueba on public.movimientos;drop function public.fallo_movimiento_prueba();set role authenticated;');
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${operator}',false);set role authenticated;`);
  await save(input());assert.equal((await db.query('select * from public.gastos')).rows.length,0);await assert.rejects(summary(),/administrador/);
  await assert.rejects(db.query('select public.app_resumen_gastos_inicio()'),/administrador/);
 }finally{await db.close();}
});
