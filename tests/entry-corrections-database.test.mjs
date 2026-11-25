import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('corregir entradas ajusta stock y gasto atómicamente y conserva el historial',async()=>{
 const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',operator='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table public.categorias(id bigserial primary key,nombre text);create table public.proveedores(id bigserial primary key,nombre text);create table public.sedes(id bigserial primary key,nombre text);create table public.productos(id bigserial primary key,nombre text,codigo text);create table public.inventario(id bigserial primary key,producto_id bigint,sede_id bigint,cantidad integer default 0,unique(producto_id,sede_id));create table public.movimientos(id bigserial primary key);`);
  for(const name of ['202609150001_auth_access.sql','202609150002_inventory_modules.sql','202609150004_recepciones.sql','202609150006_catalogo_recepciones.sql','202610200014_recepcion_lotes_automaticos.sql','202611130018_google_sheets_operativo.sql','202611240002_gastos_administracion.sql','202611240003_costos_entradas_gastos.sql','202611240004_resumen_gastos_inicio.sql','202611240005_correcciones_entradas.sql','202611240006_auditoria_clara.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${admin}','admin@test.local'),('${operator}','operator@test.local');insert into public.auth_perfiles(user_id,nombre,activo,rol)values('${admin}','Admin',true,'administrador'),('${operator}','Operador',true,'operador');insert into public.productos(id,nombre,codigo,unidad_medida,es_perecible)values(1,'Arroz','P1','kg',false);insert into public.proveedores(id,nombre)values(1,'Proveedor');insert into public.sedes(id,nombre)values(1,'Central');select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated;`);
  const date=(await db.query("select (now() at time zone 'America/Lima')::date::text as d")).rows[0].d;
  const input={operacion_id:crypto.randomUUID(),proveedor_id:'1',sede_id:'1',tipo_comprobante:'Ingreso de inventario',serie:'INT',numero:'CORRECCION',fecha_emision:date,fecha_recepcion:date,responsable:'Admin',detalles:[{producto_id:'1',cantidad_recibida:10,precio_unitario:2.5}]};
  const save=()=>db.query('select public.app_registrar_recepcion_con_costo($1) as id',[JSON.stringify(input)]);
  const rid=(await save()).rows[0].id;
  const list=async reception=>(await db.query('select public.app_entradas_corregibles($1) as data',[reception||null])).rows[0].data;
  const gid=(await list(rid))[0].id;
  const info=async id=>(await db.query('select public.app_datos_correccion_entrada($1) as data',[id||gid])).rows[0].data;
  const stock=async()=>Number((await db.query('select coalesce(sum(cantidad),0) n from public.inventario')).rows[0].n);
  const total=async()=>Number((await db.query('select public.app_gastos_mes($1) as data',[date])).rows[0].data.total);
  const correct=async(qty,cost,version,id=gid,op=crypto.randomUUID(),reason='Cantidad verificada')=>db.query('select public.app_corregir_entrada($1,$2,$3,$4,$5,$6) as data',[op,id,version,qty,cost,reason]);
  let current=await info();assert.equal(current.cantidad,10);assert.equal(current.disponible,10);assert.equal(current.origen.sede,'Central');
  const version=current.gasto.version,op=crypto.randomUUID();
  await correct(8,3,version,gid,op);assert.equal(await stock(),8);assert.equal(await total(),24);
  assert.equal((await correct(8,3,version,gid,op)).rows[0].data.repetido,true);assert.equal(await stock(),8);
  await assert.rejects(correct(7,3,version,gid,op),/otros datos/);
  await assert.rejects(correct(7,3,version),/Otra persona/);assert.equal(await total(),24);
  current=await info();assert.equal(current.historial.length,1);assert.equal(current.historial[0].responsable,'Admin');assert.equal(current.historial[0].anterior.total,25);
  const audit=(await db.query('select public.app_listar_auditoria() as data')).rows[0].data.find(row=>row.tabla==='entrada_correcciones');
  assert.equal(JSON.parse(audit.resumen).producto,'Arroz');assert.match(JSON.parse(audit.resumen).cantidad,/10(?:\.0+)? → 8/);
  assert.equal(audit.nuevo.anterior.cantidad,10);assert.equal(audit.nuevo.nuevo.cantidad,8);assert.equal(audit.contexto.producto,'Arroz');assert.equal(audit.contexto.unidad,'kg');
  const events=(await db.query('select public.app_listar_auditoria() as data')).rows[0].data;
  const purchase=events.find(row=>row.tabla==='gastos'&&row.operacion==='INSERT');assert.equal(purchase.nuevo.producto_nombre,'Arroz');assert.equal(purchase.nuevo.monto,25);assert.equal(purchase.nuevo.solicitud_inicial,undefined);assert.equal(JSON.parse(purchase.resumen).producto_nombre,'Arroz');
  assert.ok(events.some(row=>row.tabla==='lotes'&&row.contexto.producto==='Arroz'));
  // El documento original sigue igual y un reintento no repone cantidades.
  await save();assert.equal(await stock(),8);
  assert.equal(Number((await db.query('select cantidad_recibida from public.recepcion_detalles')).rows[0].cantidad_recibida),10);
  await correct(8,2,current.gasto.version);assert.equal(await stock(),8);assert.equal(await total(),16);
  current=await info();await correct(12,2,current.gasto.version);assert.equal(await stock(),12);assert.equal(await total(),24);
  const lot=current.origen.lote_id;
  await db.query("select public.app_registrar_movimiento($1,'salida','1',$2,'1',null,10,'','Consumo')",[crypto.randomUUID(),lot]);
  current=await info();const count=current.historial.length;
  await assert.rejects(correct(0,2,current.gasto.version),/insuficiente/i);assert.equal(await stock(),2);assert.equal(await total(),24);assert.equal((await info()).historial.length,count);
  // Se puede descontar únicamente el stock disponible.
  await correct(10,2,current.gasto.version);assert.equal(await stock(),0);assert.equal(await total(),20);
  current=await info();await correct(12,2,current.gasto.version);assert.equal(await stock(),2);
  await db.query("select public.app_registrar_movimiento($1,'ajuste_positivo','1',$2,'1',null,10,'','Devolución comprobada')",[crypto.randomUUID(),lot]);
  current=await info();await correct(0,2,current.gasto.version);assert.equal(await stock(),0);assert.equal(await total(),0);
  assert.equal((await list(rid))[0].anulado,true);assert.equal((await list(rid))[0].cantidad,0);
  assert.equal((await db.query('select public.app_resumen_gastos_inicio() as data')).rows[0].data.total,0);
  current=await info();await correct(5,4,current.gasto.version);assert.equal(await stock(),5);assert.equal(await total(),20);
  // Una entrada manual conserva la idempotencia de su operación original tras corregir.
  const args=[crypto.randomUUID(),'1',lot,'1',2,'DOC','Entrada manual',3];
  const manual=()=>db.query('select public.app_registrar_entrada_con_costo($1,$2,$3,$4,$5,$6,$7,$8)',args);
  await manual();let manualId=(await list()).find(row=>row.id!==gid).id;
  current=await info(manualId);await correct(1,5,current.gasto.version,manualId);assert.equal(await stock(),6);assert.equal(await total(),25);
  await manual();assert.equal(await stock(),6);assert.equal(await total(),25);
  // Las recepciones antiguas sin precio se corrigen sin inventar un costo anterior.
  const historical={...input,operacion_id:crypto.randomUUID(),numero:'ANTERIOR',detalles:[{producto_id:'1',cantidad_recibida:3}]};
  const historicalId=(await db.query('select public.app_registrar_recepcion_simple($1) as id',[JSON.stringify(historical)])).rows[0].id;
  const historicalEntry=(await list(historicalId))[0];
  current=await info(historicalEntry.id);assert.equal(current.sin_gasto,true);assert.equal(current.total,null);assert.equal(current.gasto.costo_unitario,null);
  assert.equal(await total(),25);await correct(3,2,0,historicalEntry.id);assert.equal(await total(),31);assert.equal(await stock(),9);
  current=await info(historicalEntry.id);assert.equal(current.sin_gasto,false);assert.equal(current.historial[0].anterior.total,null);assert.equal(current.historial[0].nuevo.total,6);
  const canceled={...historical,operacion_id:crypto.randomUUID(),numero:'ANULAR'};
  const canceledId=(await db.query('select public.app_registrar_recepcion_simple($1) as id',[JSON.stringify(canceled)])).rows[0].id;
  const canceledEntry=(await list(canceledId))[0];await correct(0,null,0,canceledEntry.id);assert.equal(await total(),31);assert.equal(await stock(),9);
  current=await info(canceledEntry.id);assert.equal(current.cantidad,0);assert.equal(current.gasto.costo_unitario,null);assert.equal(current.total,0);
  // Una cantidad de un servicio no altera el inventario.
  await db.exec("reset role;insert into public.productos(id,nombre,codigo,unidad_medida,es_perecible,controla_inventario)values(2,'Servicio','S1','unidad',false,false);set role authenticated;");
  const service={...input,operacion_id:crypto.randomUUID(),numero:'SERVICIO',detalles:[{producto_id:'2',cantidad_recibida:1,precio_unitario:10}]};
  const serviceId=(await db.query('select public.app_registrar_recepcion_con_costo($1) as id',[JSON.stringify(service)])).rows[0].id;
  const serviceEntry=(await list(serviceId))[0];current=await info(serviceEntry.id);assert.equal(current.origen.lote_id,null);
  await correct(2,10,current.gasto.version,serviceEntry.id);assert.equal(await stock(),9);assert.equal(await total(),51);
  await assert.rejects(correct(1,5,(await info(manualId)).gasto.version,manualId,crypto.randomUUID(),''),/motivo/i);
  await assert.rejects(correct(-1,5,(await info(manualId)).gasto.version,manualId),/cantidad/i);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${operator}',false);set role authenticated;`);
  await assert.rejects(info(),/administrador/);await assert.rejects(list(),/administrador/);await assert.rejects(correct(1,1,1),/administrador/);
  await assert.rejects(db.query('select public.app_listar_auditoria()'),/administrador/);
  assert.equal((await db.query('select * from public.entrada_correcciones')).rows.length,0);
  await assert.rejects(db.query('update public.gastos set cantidad=1'),/permission denied/);
  await db.exec('reset role;set role anon;');await assert.rejects(info(),/permission denied/);
 }finally{await db.close();}
});
