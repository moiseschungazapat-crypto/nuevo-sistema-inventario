import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADERS,MOVEMENT_HEADERS,MOVEMENT_START_ROW,DEFAULT_SPREADSHEET_ID,dateValue,numberValue,normalize,pendingMovementRows,referenceValues,ensureWorkbook,writeReferences} from '../supabase/functions/sincronizar-inventario-sheets/sheets.mjs';

test('la hoja operativa usa un solo formulario e historial de movimientos',()=>{
 assert.equal(DEFAULT_SPREADSHEET_ID,'1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8');
 assert.deepEqual(Object.keys(HEADERS),['Movimientos','Inventario actual','Catálogo','Proveedores','Alertas']);
 assert.equal(MOVEMENT_START_ROW,21);assert.ok(MOVEMENT_HEADERS.includes('ID interno'));assert.ok(MOVEMENT_HEADERS.includes('Lotes usados'));
 assert.equal(HEADERS.Movimientos,MOVEMENT_HEADERS);
});
test('normaliza fechas, decimales y textos usados en la validación',()=>{
 assert.equal(dateValue('13/11/2026'),'2026-11-13');assert.equal(dateValue('2026-11-13'),'2026-11-13');assert.equal(dateValue('mal'),'');
 assert.equal(numberValue('12,5'),12.5);assert.ok(Number.isNaN(numberValue('x')));assert.equal(normalize('  Ají Amarillo '),'aji amarillo');
});
test('solo procesa movimientos nuevos o corregidos',()=>{
 const pending=pendingMovementRows([
  ['17/11/2026','Salida','Abarrotes','O-055','Arroz',2,'kg','','','Uso en cocina','PENDIENTE'],
  ['17/11/2026','Entrada','Harinas','H-001','Harina',5,'kg','Proveedor','','','SINCRONIZADO'],
  [],
 ]);
 assert.equal(pending.length,1);assert.equal(pending[0].row,21);assert.equal(pending[0].cells[3],'O-055');
});
test('genera catálogos, inventario y alertas sin convertirlos en entradas',()=>{
 const result=referenceValues({categories:[{id:1,nombre:'Harinas'}],products:[{id:1,codigo:'H-001',nombre:'Harina',categoria_id:1,unidad_medida:'kg',es_perecible:false}],providers:[{nombre:'Proveedor',documento:'123'}],stock:[{codigo:'H-001',producto:'Harina',sede:'Central',lote:'L1',vencimiento:'2026-11-20',cantidad:2,unidad_medida:'kg',stock_minimo:5}]});
 assert.deepEqual(result.catalog[0],['H-001','Harina','Harinas','kg','No']);assert.equal(result.providers.length,1);assert.equal(result.inventory[0][8],'Bajo mínimo');assert.ok(result.alerts.some(row=>row[0]==='Stock bajo'));
});
test('prepara el panel y conserva ocultas las pestañas antiguas',async()=>{
 const before={sheets:[
  {properties:{sheetId:1,title:'Recepciones',index:0,hidden:false,gridProperties:{rowCount:1500,columnCount:20}}},
  {properties:{sheetId:2,title:'Salidas',index:1,hidden:false,gridProperties:{rowCount:1500,columnCount:20}}},
  {properties:{sheetId:3,title:'Inventario actual',index:2,gridProperties:{rowCount:1500,columnCount:20}}},
  {properties:{sheetId:4,title:'Catálogo',index:3,gridProperties:{rowCount:1500,columnCount:20}}},
  {properties:{sheetId:5,title:'Proveedores',index:4,gridProperties:{rowCount:1500,columnCount:20}}},
  {properties:{sheetId:6,title:'Alertas',index:5,gridProperties:{rowCount:1500,columnCount:20}}},
 ]};
 const after={sheets:[
  {properties:{sheetId:7,title:'Movimientos',index:0,gridProperties:{rowCount:1500,columnCount:20}}},
  ...before.sheets.map((sheet,index)=>({properties:{...sheet.properties,index:index+1,hidden:['Recepciones','Salidas'].includes(sheet.properties.title)}})),
 ]};
 const calls=[];let metadataReads=0;
 const request=async(url,options={})=>{
  calls.push({url,options});
  if(!options.method&&url.includes('?fields='))return new Response(JSON.stringify(metadataReads++===0?before:after),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const result=await ensureWorkbook('sheet','token',request);
 assert.equal(result.Movimientos,7);
 const firstBatch=JSON.parse(calls.find(call=>call.url.endsWith(':batchUpdate')).options.body).requests;
 assert.ok(firstBatch.some(item=>item.addSheet?.properties?.title==='Movimientos'));
 assert.equal(firstBatch.filter(item=>item.updateSheetProperties?.properties?.hidden===true).length,2);
 const valueBodies=calls.filter(call=>call.url.includes('/values:batchUpdate')).map(call=>JSON.parse(call.options.body));
 assert.ok(valueBodies.some(body=>body.data?.some(item=>item.range==="'Movimientos'!A20")));
 const preview=valueBodies.flatMap(body=>body.data||[]).find(item=>item.range==="'Movimientos'!H7:H10");
 assert.deepEqual(preview?.values,[[''],[''],[''],['']]);
 assert.ok(valueBodies.some(body=>body.data?.some(item=>item.range==="'Movimientos'!A15:H15"&&item.values?.[0]?.every(value=>value===''))));
});

test('inventario actual consolida lotes por producto y sede sin sumar mínimos',()=>{
 const base={codigo:'L-181',producto:'Papel Toalla',sede:'Central',unidad_medida:'unidad',stock_minimo:5};
 const result=referenceValues({categories:[],products:[],providers:[],stock:[
  {...base,lote:'L1',cantidad:4,vencimiento:'2026-12-20'},
  {...base,lote:'L2',cantidad:2,vencimiento:'2026-12-10'},
  {...base,lote:'Agotado',cantidad:0,vencimiento:'2020-01-01'},
  {...base,sede:'Otra sede',lote:'L3',cantidad:1,vencimiento:''},
 ]});
 assert.equal(result.inventory.length,2);
 assert.deepEqual(result.inventory[0],['L-181','Papel Toalla','Central',2,'2026-12-10',6,'unidad',5,'Normal']);
 assert.equal(result.inventory[1][5],1);
 const low=result.alerts.filter(row=>row[0]==='Stock bajo');
 assert.equal(low.length,1);
 assert.equal(low[0][5],1);
 assert.ok(low[0][7].includes('Otra sede'));
});

test('avisa agotados sin mínimo, sin duplicar lotes ni alertar por un lote vacío con saldo total',()=>{
 const base={producto:'Papel',sede:'Central',unidad_medida:'unidad',stock_minimo:0,vencimiento:''};
 const result=referenceValues({categories:[],products:[],providers:[],stock:[
  {...base,codigo:'P1',lote:'L1',cantidad:0},
  {...base,codigo:'P1',lote:'L2',cantidad:0},
  {...base,codigo:'P2',lote:'L3',cantidad:0},
  {...base,codigo:'P2',lote:'L4',cantidad:5},
 ]});
 assert.equal(result.alerts.length,1);
 assert.equal(result.alerts[0][0],'Sin stock');
 assert.equal(result.alerts[0][1],'P1');
});

test('cuando no hay alertas escribe un mensaje explícito',async()=>{
 const writes=[];
 await writeReferences('sheet','token',{categories:[],products:[],providers:[],stock:[]},async(url,options)=>{
  if(url.includes('/values:batchUpdate'))writes.push(...JSON.parse(options.body).data);
  return new Response('{}',{status:200});
 });
 assert.equal(writes.find(row=>row.range==="'Alertas'!A2").values[0][0],'Sin alertas activas');
});
