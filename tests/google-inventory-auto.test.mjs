import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHandler} from '../supabase/functions/sincronizar-inventario-sheets/sync.mjs';

test('rechaza conexiones automáticas inválidas antes de contactar Google',async()=>{
 let googleCalls=0;
 const handler=createHandler({env:name=>({SUPABASE_URL:'url',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',GOOGLE_SERVICE_ACCOUNT_JSON:'{}'}[name]),
  createClient:()=>({rpc:async()=>({error:{message:'No autorizado'}})}),request:async()=>{googleCalls++;throw Error('No debe llamarse');}});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{'X-Inventory-Token':'invalid'},body:'{}'}));
 assert.equal(response.status,403);assert.equal(googleCalls,0);
});

test('comprobar conexión válida no procesa movimientos ni cambia la hoja',async()=>{
 const calls=[];
 const handler=createHandler({env:name=>({SUPABASE_URL:'url',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',GOOGLE_SERVICE_ACCOUNT_JSON:'{}'}[name]),
  createClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:{rol:'administrador'}};}}),request:()=>{throw Error('No debe llamarse');}});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{'X-Inventory-Token':'connection'},body:JSON.stringify({checkOnly:true})}));
 assert.equal(response.status,200);assert.equal((await response.json()).connected,true);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'app_google_sheets_automatico');
 assert.equal(calls[0][1].p_accion,'app_mi_acceso');
});

test('la autorización automática restringe hoja, clave, administrador y acciones',async()=>{
 const db=new PGlite();
 const actor='11111111-1111-4111-8111-111111111111';
 const token='a'.repeat(64);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;create table auth.users(id uuid primary key);
   create table public.auth_perfiles(user_id uuid,activo boolean,rol text);
   create function public.app_mi_acceso() returns jsonb language sql as $$ select jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'rol','administrador') $$;
   create function public.app_datos_google_sheets_operativo() returns jsonb language sql as $$ select '{}'::jsonb $$;
   create function public.app_registrar_recepcion_google_sheets(uuid,jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
   create function public.app_registrar_salida_fefo_google_sheets(uuid,text,text,numeric,date,text,text) returns jsonb language sql as $$ select '{}'::jsonb $$;
   insert into auth.users values('${actor}');insert into public.auth_perfiles values('${actor}',true,'administrador');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611240001_google_sheets_automatico.sql',import.meta.url),'utf8'));
  await db.query("insert into public.google_sheets_conexiones values('sheet',encode(sha256(convert_to($1,'UTF8')),'hex'),$2,true,now())",[token,actor]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select public.app_google_sheets_automatico($1,'sheet','app_mi_acceso')",[token]),/permission denied/);
  await db.exec('reset role;set role service_role');
  const result=await db.query("select public.app_google_sheets_automatico($1,'sheet','app_mi_acceso') as data",[token]);
  assert.equal(result.rows[0].data.sub,actor);
  assert.equal((await db.query("select current_setting('request.jwt.claim.sub',true) as sub")).rows[0].sub,'');
  await assert.rejects(db.query("select public.app_google_sheets_automatico($1,'other-sheet','app_mi_acceso')",[token]),/no autorizada/);
  await assert.rejects(db.query("select public.app_google_sheets_automatico($1,'sheet','app_mi_acceso')",['b'.repeat(64)]),/no autorizada/);
  await assert.rejects(db.query("select public.app_google_sheets_automatico($1,'sheet','app_guardar_usuario')",[token]),/no permitida/);
  await db.exec('reset role;update public.auth_perfiles set activo=false;set role service_role');
  await assert.rejects(db.query("select public.app_google_sheets_automatico($1,'sheet','app_mi_acceso')",[token]),/no autorizada/);
 }finally{await db.close();}
});
