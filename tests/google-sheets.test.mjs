import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildReport, cell, limaDate, reportRequests } from '../supabase/functions/exportar-google-sheets/report.mjs';
import { googleToken, writeReport } from '../supabase/functions/exportar-google-sheets/google.mjs';
import { createHandler } from '../supabase/functions/exportar-google-sheets/handler.mjs';

const sample = () => ({date:'2026-10-20',generated_at:'2026-10-21T04:59:00Z',
 products:[{id:1,codigo:'HAR',nombre:'Harina',unidad_medida:'kg',categoria_id:1,estado:true},{id:2,codigo:'SER',nombre:'Servicio',controla_inventario:false}],
 categories:[{id:1,nombre:'Insumos'}],providers:[],sites:[{id:1,nombre:'Central'},{id:2,nombre:'Norte'}],
 stock:[{producto_id:1,sede_id:1,cantidad:12,codigo:'HAR',producto:'Harina',sede:'Central',lote:'L1',vencimiento:'2026-10-19',unidad_medida:'kg'}],
 minimums:[{producto_id:1,sede_id:1,minimo:15}],receptions:[],reception_lines:[],
 movements:[{producto_id:1,sede_id:1,tipo:'entrada',cantidad:10,fecha:'2026-10-20T05:00:00Z'},
 {producto_id:1,sede_id:1,tipo:'salida',cantidad:2,fecha:'2026-10-20T12:00:00Z'},
 {producto_id:1,sede_id:1,tipo:'ajuste_positivo',cantidad:1,fecha:'2026-10-20T13:00:00Z'},
 {producto_id:1,sede_id:1,tipo:'ajuste_negativo',cantidad:2,fecha:'2026-10-20T14:00:00Z'},
 {producto_id:1,sede_id:1,destino_id:2,tipo:'traslado',cantidad:3,fecha:'2026-10-20T15:00:00Z'}]});

test('reporte usa la fecha de Perú, concilia saldos con ajustes y traslados y conserva mínimos sin stock',()=>{
 const report=buildReport(sample());
 assert.equal(report.title,'20/10/2026');
 assert.equal(limaDate('2026-10-21T04:59:59Z'),'2026-10-20');
 assert.equal(limaDate('2026-10-21T05:00:00Z'),'2026-10-21');
 const stocks=report.rows.filter(r=>r[0]==='HAR' && r.length===15);
 assert.equal(stocks.length,2);
 const central=stocks.find(r=>r[3]==='Central');
 assert.deepEqual(central.slice(5),[8,10,2,1,2,0,3,12,15,'Bajo mínimo']);
 assert.ok(report.rows.some(r=>r.includes('Vencido')));
 const noExpiry=sample();noExpiry.stock[0].vencimiento=null;
 assert.ok(buildReport(noExpiry).rows.some(r=>r.includes('Sin vencimiento')));
 assert.ok(!stocks.some(r=>r[0]==='SER'));
 const noMovement=sample();noMovement.movements=[];
 assert.equal(buildReport(noMovement).rows.find(r=>r[0]==='HAR' && r[3]==='Central')[5],12);
 const invalid=sample();invalid.movements[0].fecha='2026-10-20T04:59:59Z';
 assert.throws(()=>buildReport(invalid),/fuera de la fecha/);
});

test('texto de usuarios no se convierte en fórmulas y precios desconocidos no se inventan',()=>{
 assert.deepEqual(cell('=IMPORTXML("url")'),{userEnteredValue:{stringValue:'=IMPORTXML("url")'}});
 assert.deepEqual(cell(null),{});
 assert.deepEqual(cell(0),{userEnteredValue:{numberValue:0}});
 assert.throws(()=>cell(NaN),/inválido/);
 const data=sample();data.receptions=[{id:'r1',fecha_recepcion:data.date,total:null}];
 data.reception_lines=[{recepcion_id:'r1',producto_id:1,cantidad_facturada:5,cantidad_recibida:3,unidad:'kg',precio_unitario:null}];
 const report=buildReport(data);
 assert.equal(report.rows.find(r=>r[0]==='r1' && r[1]==='Harina')[4],2);
 assert.equal(report.rows.find(r=>r[0]==='r1' && r[1]==='Harina')[6],null);
});

test('envío atómico actualiza solo la pestaña del día y borra filas antiguas al reducir el reporte',async()=>{
 const report=buildReport(sample());
 const first=reportRequests(report);
 assert.equal(first.requests[0].addSheet.properties.title,'20/10/2026');
 const calls=[];
 const request=async(url,options)=>{
  calls.push({url,options});
  if(options.method==='POST')return Response.json({});
  return Response.json({sheets:[{properties:{sheetId:88,title:'19/10/2026'}},{properties:{sheetId:99,title:report.title,gridProperties:{rowCount:1000,columnCount:26}}}]});
 };
 assert.equal((await writeReport('test-sheet','token',report,request)).sheetId,99);
 const requests=JSON.parse(calls[1].options.body).requests;
 assert.ok(!requests.some(r=>r.addSheet || r.deleteSheet || r.appendCells));
 const update=requests.find(r=>r.updateCells).updateCells;
 assert.deepEqual(update.range,{sheetId:99});
 assert.equal(update.fields,'userEnteredValue');
 assert.ok(requests.every(r=>!JSON.stringify(r).includes('"sheetId":88')));
});

test('dos creaciones simultáneas reintentan sobre la misma pestaña sin duplicarla',async()=>{
 const report=buildReport(sample());let lists=0,posts=0;
 const request=async(url,options)=>{
  if(options.method==='POST'){posts++;return posts===1?new Response('',{status:400}):Response.json({});}
  lists++;return Response.json({sheets:lists===1?[]:[{properties:{sheetId:20261020,title:report.title}}]});
 };
 assert.equal((await writeReport('sheet','token',report,request)).sheetId,20261020);
 assert.equal(posts,2);
 await assert.rejects(writeReport('sheet','token',report,async()=>new Response('',{status:403})),/comparte el archivo/);
});

test('formato legible combina títulos, diferencia anchos y reemplaza las bandas de la exportación anterior',()=>{
 const report=buildReport(sample());
 const {requests}=reportRequests(report,{sheetId:99,bandedRanges:[{bandedRangeId:700}]});
 assert.ok(requests.some(r=>r.deleteBanding?.bandedRangeId===700));
 const unmerge=requests.findIndex(r=>r.unmergeCells);
 const write=requests.findIndex(r=>r.updateCells);
 assert.ok(unmerge>0 && unmerge<write);
 assert.equal(requests.filter(r=>r.addBanding).length,report.tables.length);
 assert.equal(requests[0].updateSheetProperties.properties.gridProperties.frozenRowCount,8);
 assert.equal(requests[0].updateSheetProperties.properties.gridProperties.frozenColumnCount,0);
 assert.ok(requests.some(r=>r.mergeCells?.range.startRowIndex===0 && r.mergeCells.range.endColumnIndex===8));
 assert.ok(requests.some(r=>r.updateDimensionProperties?.range.dimension==='COLUMNS' && r.updateDimensionProperties.properties.pixelSize===300));
});

test('cuenta de servicio firma el acceso de Google sin enviar la clave privada',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const privateKey=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
 const credentials={client_email:'reportes@example.test',private_key:`-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`};
 const token=await googleToken(credentials,async(url,options)=>{
  assert.equal(url,'https://oauth2.googleapis.com/token');
  assert.ok(!String(options.body).includes(privateKey));
  const jwt=options.body.get('assertion'),[header,payload,signature]=jwt.split('.');
  const claims=JSON.parse(Buffer.from(payload,'base64url').toString());
  assert.equal(claims.iss,credentials.client_email);
  assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets');
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(header+'.'+payload)));
  return Response.json({access_token:'google-token'});
 });
 assert.equal(token,'google-token');
});

test('servidor exige identidad y administrador antes de leer datos o enviar a Google',async()=>{
 let role='consulta',valid=true,reads=0,googleCalls=0;
 const client={auth:{getUser:async()=>({data:{user:valid?{id:'u1'}:null}})},rpc:async name=>{
  if(name==='app_mi_acceso')return {data:{rol:role}};
  reads++;return {data:sample()};
 }};
 const env=name=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'public-key'}[name]);
 const handler=createHandler({createClient:()=>client,env,request:async()=>{googleCalls++;throw new Error('must not call');}});
 const req=()=>new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer user-jwt'}});
 assert.equal((await handler(new Request('http://localhost',{method:'POST'}))).status,401);
 assert.equal((await handler(req())).status,403);
 valid=false;assert.equal((await handler(req())).status,401);
 valid=true;role='administrador';const response=await handler(req());
 assert.equal(response.status,503);assert.match((await response.json()).error,/Falta conectar/);
 assert.equal(reads,0);assert.equal(googleCalls,0);
});

test('servidor completa un envío autorizado usando la sesión del usuario y devuelve confirmación',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const credentials={client_email:'reports@example.test',private_key:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----'};
 const calls=[];
 const handler=createHandler({
  env:name=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'public-key',GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(credentials),GOOGLE_SHEETS_SPREADSHEET_ID:'sheet-test'}[name]),
  createClient:(url,key,options)=>{
   assert.equal(key,'public-key');assert.equal(options.global.headers.Authorization,'Bearer user-jwt');
   return {auth:{getUser:async()=>({data:{user:{id:'u1'}}})},rpc:async name=>{
    calls.push(name);return {data:name==='app_mi_acceso'?{rol:'administrador'}:sample()};
   }};
  },
  request:async(url,options)=>{
   if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'google-token'});
   assert.equal(options.headers.Authorization,'Bearer google-token');
   if(options.method==='POST')return Response.json({});
   return Response.json({sheets:[]});
  },
 });
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer user-jwt'}}));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.title,'20/10/2026');assert.match(data.url,/sheet-test\/edit#gid=20261020$/);
 assert.deepEqual(calls,['app_mi_acceso','app_reporte_google_sheets']);
 assert.ok(!JSON.stringify(data).includes('PRIVATE KEY'));
});

test('RPC exporta con permisos del usuario y filtra el día de Perú en una sola consulta',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;`);
  for(const file of ['202609150001_auth_access.sql','202609150002_inventory_modules.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`create table public.recepciones(id uuid primary key,fecha_recepcion date,created_at timestamptz);
   create table public.recepcion_detalles(id uuid primary key,recepcion_id uuid);
   grant select on public.recepciones,public.recepcion_detalles to authenticated;
   insert into auth.users values ('11111111-1111-4111-8111-111111111111','admin@test.local');
   insert into public.auth_perfiles(user_id,nombre,activo,rol) values('11111111-1111-4111-8111-111111111111','Admin',true,'administrador');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610200013_reporte_google_sheets.sql',import.meta.url),'utf8'));
  await db.exec(`select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);set role authenticated;`);
  const result=(await db.query('select public.app_reporte_google_sheets() as data')).rows[0].data;
  assert.equal(result.date,limaDate(result.generated_at));
  assert.deepEqual(result.movements,[]);assert.deepEqual(result.receptions,[]);
  const product=(await db.query("insert into public.productos(codigo,nombre,unidad_medida) values('HAR','Harina','kg') returning id")).rows[0].id;
  const site=(await db.query("insert into public.sedes(nombre) values('Central') returning id")).rows[0].id;
  const lot=(await db.query("select public.app_crear_lote($1,'L1',current_date+60) as id",[String(product)])).rows[0].id;
  for(let n=0;n<3;n++)await db.query("select public.app_registrar_movimiento($1,'entrada',$2,$3,$4,null,3,'DOC',$5)",[crypto.randomUUID(),String(product),lot,String(site),'Movimiento '+n]);
  await db.exec(`reset role;
   update public.movimientos set fecha=((now() at time zone 'America/Lima')::date::timestamp at time zone 'America/Lima') - interval '1 second' where motivo='Movimiento 0';
   update public.movimientos set fecha=((now() at time zone 'America/Lima')::date::timestamp at time zone 'America/Lima') where motivo='Movimiento 1';
   update public.movimientos set fecha=((now() at time zone 'America/Lima')::date::timestamp at time zone 'America/Lima') + interval '1 day' where motivo='Movimiento 2';
   set role authenticated;`);
  const populated=(await db.query('select public.app_reporte_google_sheets() as data')).rows[0].data;
  assert.equal(populated.movements.length,1);
  assert.equal(populated.movements[0].motivo,'Movimiento 1');
  assert.equal(Number(populated.stock[0].cantidad),9);
  await db.exec(`reset role;update public.auth_perfiles set rol='consulta';set role authenticated;`);
  await assert.rejects(db.query('select public.app_reporte_google_sheets()'),/administrador/);
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.query('select public.app_reporte_google_sheets()'),/permission denied/);
 }finally{await db.close();}
});
