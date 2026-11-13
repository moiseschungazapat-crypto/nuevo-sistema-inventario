export const DEFAULT_SPREADSHEET_ID='1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8';
export const HEADERS={
 'Recepciones':['Grupo','Fecha','Proveedor','Código producto','Producto (automático)','Cantidad','Unidad (automática)','Vencimiento','Observaciones','Estado','Resultado','ID interno','Sincronizado'],
 'Salidas':['Grupo','Fecha','Código producto','Producto (automático)','Cantidad','Unidad (automática)','Motivo','Estado','Resultado','ID interno','Sincronizado','Lotes usados'],
 'Inventario actual':['Código','Producto','Sede','Lote','Vencimiento','Cantidad','Unidad','Stock mínimo','Estado'],
 'Catálogo':['Código','Producto','Categoría','Unidad','Perecible'],
 'Proveedores':['Proveedor','Documento'],
 'Alertas':['Tipo','Código','Producto','Lote','Vencimiento','Cantidad','Unidad','Detalle'],
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
 if(first&&!names.has('Recepciones')){requests.push({updateSheetProperties:{properties:{sheetId:first.sheetId,title:'Recepciones',gridProperties:{rowCount:1500,columnCount:HEADERS.Recepciones.length}},fields:'title,gridProperties'}});names.delete(first.title);names.add('Recepciones');}
 for(const [title,columns] of Object.entries(HEADERS))if(!names.has(title))requests.push({addSheet:{properties:{title,gridProperties:{rowCount:1500,columnCount:columns.length}}}});
 if(requests.length)await requestJson(await request(base+':batchUpdate',{method:'POST',headers:auth,body:JSON.stringify({requests}),signal:AbortSignal.timeout(30000)}),'No se pudo crear la estructura de la hoja.');
 metadata=await get();
 const sheetMap=Object.fromEntries(metadata.sheets.map(sheet=>[sheet.properties.title,sheet.properties.sheetId]));
 const values=Object.entries(HEADERS).map(([title,row])=>({range:`'${title}'!A1`,values:[row]}));
 await writeValues(spreadsheetId,token,values,'RAW',request);
 const format=[];
 for(const [title,row] of Object.entries(HEADERS)){
  const sheetId=sheetMap[title];
  format.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:row.length},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},wrapStrategy:'WRAP',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
  format.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:38},fields:'pixelSize'}});
 }
 const recep=sheetMap.Recepciones,salida=sheetMap.Salidas;
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
