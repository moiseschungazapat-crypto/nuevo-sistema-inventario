export const DEFAULT_SPREADSHEET_ID='1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8';
export const HEADERS={
 'Recepciones':['Grupo','Fecha','Proveedor','Código producto','Producto (automático)','Cantidad','Unidad (automática)','Vencimiento','Observaciones','Estado','Resultado','ID interno','Sincronizado'],
 'Salidas':['Grupo','Fecha','Código producto','Producto (automático)','Cantidad','Unidad (automática)','Motivo','Estado','Resultado','ID interno','Sincronizado','Lotes usados'],
 'Inventario actual':['Código','Producto','Sede','Lote','Vencimiento','Cantidad','Unidad','Stock mínimo','Estado'],
 'Catálogo':['Código','Producto','Categoría','Unidad','Perecible'],
 'Proveedores':['Proveedor','Documento'],
 'Alertas':['Tipo','Código','Producto','Lote','Vencimiento','Cantidad','Unidad','Detalle'],
};
const GRID_COLUMNS=20;
const GUIDES={
 'Recepciones':[
  ['GUÍA RÁPIDA'],
  ['1. Escribe un grupo para unir productos de la misma entrega.'],
  ['2. Selecciona proveedor y código desde las listas.'],
  ['3. Indica cantidad y vencimiento cuando corresponda.'],
  ['4. Deja Estado vacío o escribe PENDIENTE.'],
  ['5. Pulsa Sincronizar inventario desde el Dashboard.'],
 ],
 'Salidas':[
  ['GUÍA RÁPIDA'],
  ['1. Registra fecha, código, cantidad y motivo.'],
  ['2. El sistema elegirá automáticamente el lote por FEFO.'],
  ['3. Deja Estado vacío o escribe PENDIENTE.'],
  ['4. Revisa Resultado y Lotes usados después de sincronizar.'],
 ],
};
const api=id=>'https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id);
const headers=token=>({Authorization:'Bearer '+token,'Content-Type':'application/json'});
const requestJson=async(response,message)=>{if(!response.ok)throw new Error(response.status===403||response.status===404?'No se pudo acceder a la hoja operativa. Confirma el permiso de Editor de la cuenta de servicio.':message);return response.status===204?{}:response.json();};
export const normalize=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
export function dateValue(value){
 const text=String(value||'').trim();if(!text)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
 const match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
 if(!match)return '';
 return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
}
export function numberValue(value){const parsed=Number(String(value??'').replace(',','.'));return Number.isFinite(parsed)?parsed:NaN;}
export function pendingRows(values=[]){return values.map((cells,index)=>({row:index+2,cells})).filter(row=>row.cells.some(cell=>String(cell??'').trim())&&['','pendiente'].includes(normalize(row.cells[row.cells.length>12?9:7])));}

export async function ensureWorkbook(spreadsheetId,token,request=fetch){
 const base=api(spreadsheetId),auth=headers(token);
 const get=async()=>requestJson(await request(base+'?fields=sheets.properties',{headers:auth,signal:AbortSignal.timeout(20000)}),'No se pudo consultar la hoja operativa.');
 let metadata=await get(),names=new Set((metadata.sheets||[]).map(sheet=>sheet.properties.title));
 const requests=[];
 const first=metadata.sheets?.[0]?.properties;
 if(first&&!names.has('Recepciones')){requests.push({updateSheetProperties:{properties:{sheetId:first.sheetId,title:'Recepciones',gridProperties:{rowCount:1500,columnCount:GRID_COLUMNS}},fields:'title,gridProperties'}});names.delete(first.title);names.add('Recepciones');}
 for(const sheet of metadata.sheets||[]){
  if(HEADERS[sheet.properties.title]&&Number(sheet.properties.gridProperties?.columnCount||0)<GRID_COLUMNS){
   requests.push({updateSheetProperties:{properties:{sheetId:sheet.properties.sheetId,gridProperties:{columnCount:GRID_COLUMNS}},fields:'gridProperties.columnCount'}});
  }
 }
 for(const [title] of Object.entries(HEADERS))if(!names.has(title))requests.push({addSheet:{properties:{title,gridProperties:{rowCount:1500,columnCount:GRID_COLUMNS}}}});
 if(requests.length)await requestJson(await request(base+':batchUpdate',{method:'POST',headers:auth,body:JSON.stringify({requests}),signal:AbortSignal.timeout(30000)}),'No se pudo crear la estructura de la hoja.');
 metadata=await get();
 const sheetMap=Object.fromEntries(metadata.sheets.map(sheet=>[sheet.properties.title,sheet.properties.sheetId]));
 const values=Object.entries(HEADERS).map(([title,row])=>({range:`'${title}'!A1`,values:[row]}));
 for(const [title,rows] of Object.entries(GUIDES))values.push({range:`'${title}'!O1`,values:rows});
 await writeValues(spreadsheetId,token,values,'RAW',request);
 const format=[];
 for(const [title,row] of Object.entries(HEADERS)){
  const sheetId=sheetMap[title];
  format.push({updateSheetProperties:{properties:{sheetId,gridProperties:{columnCount:GRID_COLUMNS}},fields:'gridProperties.columnCount'}});
  format.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:row.length},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},wrapStrategy:'WRAP',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
  format.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:38},fields:'pixelSize'}});
 }
 const recep=sheetMap.Recepciones,salida=sheetMap.Salidas;
 const widths={
  'Recepciones':[105,105,190,125,210,90,105,115,230,110,250,225,155],
  'Salidas':[105,105,125,210,90,105,230,110,250,225,155,240],
  'Inventario actual':[110,220,160,210,115,95,95,110,115],
  'Catálogo':[115,240,180,100,100],
  'Proveedores':[260,150],
  'Alertas':[120,110,220,200,115,95,95,220],
 };
 for(const [title,sizes] of Object.entries(widths)){
  const sheetId=sheetMap[title];
  sizes.forEach((pixelSize,index)=>format.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{pixelSize},fields:'pixelSize'}}));
  format.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:13,endIndex:14},properties:{pixelSize:28},fields:'pixelSize'}});
 }
 for(const sheetId of [recep,salida]){
  format.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:14,endColumnIndex:20},cell:{userEnteredFormat:{backgroundColor:{red:.92,green:.95,blue:.98},textFormat:{bold:true,foregroundColor:{red:.06,green:.14,blue:.22}},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}});
  format.push({repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:6,startColumnIndex:14,endColumnIndex:20},cell:{userEnteredFormat:{backgroundColor:{red:.97,green:.98,blue:1},textFormat:{foregroundColor:{red:.25,green:.32,blue:.42}},wrapStrategy:'WRAP',verticalAlignment:'TOP'}},fields:'userEnteredFormat'}});
  format.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:14,endIndex:15},properties:{pixelSize:520},fields:'pixelSize'}});
  format.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:15,endIndex:20},properties:{pixelSize:85},fields:'pixelSize'}});
 }
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:0,endColumnIndex:4},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:5,endColumnIndex:6},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:7,endColumnIndex:9},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:4,endColumnIndex:5},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:6,endColumnIndex:7},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:9,endColumnIndex:13},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:0,endColumnIndex:3},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:4,endColumnIndex:5},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:6,endColumnIndex:7},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.99,blue:.94}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:3,endColumnIndex:4},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:5,endColumnIndex:6},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({repeatCell:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:7,endColumnIndex:12},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.97,blue:1}}},fields:'userEnteredFormat.backgroundColor'}});
 format.push({setDataValidation:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:"='Proveedores'!$A$2:$A"}]},strict:true,showCustomUi:true}}});
 format.push({setDataValidation:{range:{sheetId:recep,startRowIndex:1,endRowIndex:1500,startColumnIndex:3,endColumnIndex:4},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:"='Catálogo'!$A$2:$A"}]},strict:true,showCustomUi:true}}});
 format.push({setDataValidation:{range:{sheetId:salida,startRowIndex:1,endRowIndex:1500,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:"='Catálogo'!$A$2:$A"}]},strict:true,showCustomUi:true}}});
 await requestJson(await request(base+':batchUpdate',{method:'POST',headers:auth,body:JSON.stringify({requests:format}),signal:AbortSignal.timeout(30000)}),'No se pudo aplicar el formato de la hoja.');
 return sheetMap;
}
export async function readValues(spreadsheetId,token,ranges,request=fetch){
 const query=ranges.map(range=>'ranges='+encodeURIComponent(range)).join('&');
 const data=await requestJson(await request(api(spreadsheetId)+'/values:batchGet?majorDimension=ROWS&'+query,{headers:headers(token),signal:AbortSignal.timeout(30000)}),'No se pudieron leer los registros de la hoja.');
 return Object.fromEntries((data.valueRanges||[]).map((range,index)=>[ranges[index],range.values||[]]));
}
export async function writeValues(spreadsheetId,token,data,valueInputOption='RAW',request=fetch){
 return requestJson(await request(api(spreadsheetId)+'/values:batchUpdate',{method:'POST',headers:headers(token),body:JSON.stringify({valueInputOption,data}),signal:AbortSignal.timeout(45000)}),'No se pudieron escribir los resultados en la hoja.');
}
export function referenceValues(data){
 const categories=new Map(data.categories.map(row=>[String(row.id),row.nombre]));
 const catalog=data.products.map(row=>[row.codigo,row.nombre,categories.get(String(row.categoria_id))||'Sin categoría',row.unidad_medida,row.es_perecible?'Sí':'No']);
 const providers=data.providers.map(row=>[row.nombre,row.documento||'']);
 const inventory=data.stock.map(row=>[row.codigo,row.producto,row.sede,row.lote,row.vencimiento||'',Number(row.cantidad),row.unidad_medida,Number(row.stock_minimo||0),Number(row.cantidad)<=0?'Sin stock':Number(row.stock_minimo||0)>Number(row.cantidad)?'Bajo mínimo':'Normal']);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const alerts=[];
 for(const row of data.stock){const quantity=Number(row.cantidad);if(quantity<=0)continue;if(Number(row.stock_minimo||0)>quantity)alerts.push(['Stock bajo',row.codigo,row.producto,row.lote,row.vencimiento||'',quantity,row.unidad_medida,`Mínimo: ${row.stock_minimo}`]);if(row.vencimiento){const days=(new Date(row.vencimiento+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000;if(days<0)alerts.push(['Vencido',row.codigo,row.producto,row.lote,row.vencimiento,quantity,row.unidad_medida,'No usar']);else if(days<=30)alerts.push(['Por vencer',row.codigo,row.producto,row.lote,row.vencimiento,quantity,row.unidad_medida,`Vence en ${Math.ceil(days)} días`]);}}
 return {catalog,providers,inventory,alerts};
}
export async function writeReferences(spreadsheetId,token,data,request=fetch){
 const rows=referenceValues(data);
 const clears=['Catálogo!A2:E1500','Proveedores!A2:B1500','Inventario actual!A2:I5000','Alertas!A2:H5000'];
 await requestJson(await request(api(spreadsheetId)+'/values:batchClear',{method:'POST',headers:headers(token),body:JSON.stringify({ranges:clears}),signal:AbortSignal.timeout(30000)}),'No se pudieron limpiar las secciones de consulta.');
 const updates=[];
 if(rows.catalog.length)updates.push({range:"'Catálogo'!A2",values:rows.catalog});
 if(rows.providers.length)updates.push({range:"'Proveedores'!A2",values:rows.providers});
 if(rows.inventory.length)updates.push({range:"'Inventario actual'!A2",values:rows.inventory});
 if(rows.alerts.length)updates.push({range:"'Alertas'!A2",values:rows.alerts});
 if(updates.length)await writeValues(spreadsheetId,token,updates,'RAW',request);
}
