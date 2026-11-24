export {entryCostTotal} from '../../../js/utils/entry-cost.js';
export const DEFAULT_SPREADSHEET_ID='1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8';
export const MOVEMENT_SHEET='Movimientos';
export const MOVEMENT_START_ROW=21;
export const MOVEMENT_HEADERS=['Fecha','Tipo','Categoría','Código producto','Producto','Cantidad','Unidad','Proveedor','Vencimiento','Observación / motivo','Estado','Resultado','ID interno','Sincronizado','Lotes usados','Costo unitario (S/)','Total entrada (S/)'];
export const HEADERS={
 [MOVEMENT_SHEET]:MOVEMENT_HEADERS,
 'Inventario actual':['Código','Producto','Sede','Lotes con stock','Próximo vencimiento','Cantidad','Unidad','Stock mínimo','Estado'],
 'Catálogo':['Código','Producto','Categoría','Unidad','Perecible'],
 'Proveedores':['Proveedor','Documento'],
 'Alertas':['Tipo','Código','Producto','Lote','Vencimiento','Cantidad','Unidad','Detalle'],
};

const GRID_COLUMNS=20;
const GRID_ROWS=1500;
const LEGACY_SHEETS=new Set(['Recepciones','Salidas']);
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
export function pendingMovementRows(values=[]){return values.map((cells,index)=>({row:index+MOVEMENT_START_ROW,cells})).filter(row=>row.cells.some(cell=>String(cell??'').trim())&&['','pendiente'].includes(normalize(row.cells[10])));}

export async function ensureWorkbook(spreadsheetId,token,request=fetch){
 const base=api(spreadsheetId),auth=headers(token);
 const get=async()=>requestJson(await request(base+'?fields=sheets.properties',{headers:auth,signal:AbortSignal.timeout(20000)}),'No se pudo consultar la hoja operativa.');
 let metadata=await get();
 const originalNames=new Set((metadata.sheets||[]).map(sheet=>sheet.properties.title));
 const createdMovement=!originalNames.has(MOVEMENT_SHEET);
 const requests=[];

 if(createdMovement)requests.push({addSheet:{properties:{title:MOVEMENT_SHEET,index:0,gridProperties:{rowCount:GRID_ROWS,columnCount:GRID_COLUMNS}}}});
 for(const [title] of Object.entries(HEADERS))if(!originalNames.has(title)&&title!==MOVEMENT_SHEET)requests.push({addSheet:{properties:{title,gridProperties:{rowCount:GRID_ROWS,columnCount:GRID_COLUMNS}}}});
 for(const sheet of metadata.sheets||[]){
  const properties=sheet.properties,title=properties.title;
  if(HEADERS[title]){
   const grid=properties.gridProperties||{};
   if(Number(grid.columnCount||0)<GRID_COLUMNS||Number(grid.rowCount||0)<GRID_ROWS)requests.push({updateSheetProperties:{properties:{sheetId:properties.sheetId,gridProperties:{columnCount:Math.max(GRID_COLUMNS,Number(grid.columnCount||0)),rowCount:Math.max(GRID_ROWS,Number(grid.rowCount||0))}},fields:'gridProperties.columnCount,gridProperties.rowCount'}});
   if(properties.hidden)requests.push({updateSheetProperties:{properties:{sheetId:properties.sheetId,hidden:false},fields:'hidden'}});
   if(title===MOVEMENT_SHEET&&properties.index!==0)requests.push({updateSheetProperties:{properties:{sheetId:properties.sheetId,index:0},fields:'index'}});
  }
  if(LEGACY_SHEETS.has(title)&&!properties.hidden)requests.push({updateSheetProperties:{properties:{sheetId:properties.sheetId,hidden:true},fields:'hidden'}});
 }
 if(requests.length)await requestJson(await request(base+':batchUpdate',{method:'POST',headers:auth,body:JSON.stringify({requests}),signal:AbortSignal.timeout(30000)}),'No se pudo crear la estructura de la hoja.');

 metadata=await get();
 const sheetMap=Object.fromEntries(metadata.sheets.map(sheet=>[sheet.properties.title,sheet.properties.sheetId]));
 const movementId=sheetMap[MOVEMENT_SHEET];
 const staticValues=[
  {range:`'${MOVEMENT_SHEET}'!A1`,values:[['LA LIGURIA S.A. — CONTROL DE INVENTARIO']]},
  {range:`'${MOVEMENT_SHEET}'!A2`,values:[['Registra una entrada o salida. El Dashboard procesa los movimientos pendientes y actualiza el stock.']]},
  {range:`'${MOVEMENT_SHEET}'!A4`,values:[['REGISTRAR MOVIMIENTO']]},
  {range:`'${MOVEMENT_SHEET}'!A6:A13`,values:[['Tipo de movimiento'],['Fecha'],['Categoría'],['Código del producto'],['Cantidad'],['Proveedor (solo entrada)'],['Vencimiento (si corresponde)'],['Observación / motivo']]},
  {range:`'${MOVEMENT_SHEET}'!F6:F10`,values:[['STOCK DEL PRODUCTO'],['Producto'],['Stock antes'],['Stock después'],['Unidad']]},
  {range:`'${MOVEMENT_SHEET}'!A15:H15`,values:[['','','','','','','','']]},
  {range:`'${MOVEMENT_SHEET}'!A19`,values:[['HISTORIAL DE MOVIMIENTOS']]},
  {range:`'${MOVEMENT_SHEET}'!A20`,values:[MOVEMENT_HEADERS]},
 ];
 for(const [title,row] of Object.entries(HEADERS))if(title!==MOVEMENT_SHEET)staticValues.push({range:`'${title}'!A1`,values:[row]});
 await writeValues(spreadsheetId,token,staticValues,'RAW',request);
 // La vista previa se completa con Apps Script. Evita fórmulas dependientes
 // de la configuración regional (coma/punto y coma) de cada hoja.
 await writeValues(spreadsheetId,token,[
  {range:`'${MOVEMENT_SHEET}'!H7:H10`,values:[[''],[''],[''],['']]},
 ],'RAW',request);
 if(createdMovement)await writeValues(spreadsheetId,token,[{range:`'${MOVEMENT_SHEET}'!C6:C7`,values:[['Salida'],['=TODAY()']]},{range:`'${MOVEMENT_SHEET}'!A17`,values:[['Completa el formulario y pulsa Registrar movimiento.']]}],'USER_ENTERED',request);

 const format=[];
 for(const [title,row] of Object.entries(HEADERS)){
  const sheetId=sheetMap[title];
  format.push({updateSheetProperties:{properties:{sheetId,gridProperties:{columnCount:GRID_COLUMNS,rowCount:GRID_ROWS,hideGridlines:title===MOVEMENT_SHEET}},fields:'gridProperties.columnCount,gridProperties.rowCount,gridProperties.hideGridlines'}});
  if(title!==MOVEMENT_SHEET){
   format.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:row.length},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},wrapStrategy:'WRAP',horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
   format.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:38},fields:'pixelSize'}});
  }
 }

 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,fontSize:16,foregroundColor:{red:1,green:1,blue:1}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.96,blue:.98},textFormat:{italic:true,foregroundColor:{red:.25,green:.32,blue:.42}}}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:3,endRowIndex:4,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,fontSize:13,foregroundColor:{red:1,green:1,blue:1}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:5,endRowIndex:13,startColumnIndex:0,endColumnIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.91,green:.94,blue:.97},textFormat:{bold:true,foregroundColor:{red:.06,green:.14,blue:.22}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:5,endRowIndex:13,startColumnIndex:2,endColumnIndex:4},cell:{userEnteredFormat:{backgroundColor:{red:1,green:.98,blue:.88},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:5,endRowIndex:10,startColumnIndex:5,endColumnIndex:7},cell:{userEnteredFormat:{backgroundColor:{red:.91,green:.94,blue:.97},textFormat:{bold:true,foregroundColor:{red:.06,green:.14,blue:.22}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:6,endRowIndex:10,startColumnIndex:7,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.93,green:.98,blue:.94},textFormat:{bold:true,foregroundColor:{red:.04,green:.35,blue:.16}},horizontalAlignment:'RIGHT',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:14,endRowIndex:15,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.96,green:.97,blue:.98},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:16,endRowIndex:17,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.9,green:.97,blue:.91},textFormat:{bold:true,foregroundColor:{red:.03,green:.38,blue:.15}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:18,endRowIndex:19,startColumnIndex:0,endColumnIndex:17},cell:{userEnteredFormat:{backgroundColor:{red:.06,green:.14,blue:.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:19,endRowIndex:20,startColumnIndex:0,endColumnIndex:17},cell:{userEnteredFormat:{backgroundColor:{red:.22,green:.4,blue:.57},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},wrapStrategy:'WRAP',horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}});
 format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:44},fields:'pixelSize'}});
 format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'ROWS',startIndex:3,endIndex:4},properties:{pixelSize:34},fields:'pixelSize'}});
 format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'ROWS',startIndex:14,endIndex:15},properties:{pixelSize:38},fields:'pixelSize'}});
 format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'ROWS',startIndex:19,endIndex:20},properties:{pixelSize:42},fields:'pixelSize'}});
 const movementWidths=[110,190,175,125,220,95,95,185,125,230,115,260,220,160,240,150,150];
 movementWidths.forEach((pixelSize,index)=>format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{pixelSize},fields:'pixelSize'}}));
 format.push({updateDimensionProperties:{range:{sheetId:movementId,dimension:'COLUMNS',startIndex:12,endIndex:14},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 format.push({setDataValidation:{range:{sheetId:movementId,startRowIndex:5,endRowIndex:6,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Entrada'},{userEnteredValue:'Salida'}]},strict:true,showCustomUi:true}}});
 format.push({setDataValidation:{range:{sheetId:movementId,startRowIndex:7,endRowIndex:8,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:"='Catálogo'!$C$2:$C$1500"}]},strict:false,showCustomUi:true}}});
 // Apps Script administra el desplegable de productos según la categoría.
 // No reemplazar su lista filtrada por el catálogo completo al sincronizar.
 format.push({setDataValidation:{range:{sheetId:movementId,startRowIndex:10,endRowIndex:11,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:"='Proveedores'!$A$2:$A$1500"}]},strict:false,showCustomUi:true}}});
 format.push({setDataValidation:{range:{sheetId:movementId,startRowIndex:14,endRowIndex:15,startColumnIndex:0,endColumnIndex:1}}});
 format.push({setDataValidation:{range:{sheetId:movementId,startRowIndex:14,endRowIndex:15,startColumnIndex:4,endColumnIndex:5}}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:6,endRowIndex:7,startColumnIndex:2,endColumnIndex:3},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/mm/yyyy'}}},fields:'userEnteredFormat.numberFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:11,endRowIndex:12,startColumnIndex:2,endColumnIndex:3},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/mm/yyyy'}}},fields:'userEnteredFormat.numberFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:MOVEMENT_START_ROW-1,endRowIndex:GRID_ROWS,startColumnIndex:0,endColumnIndex:1},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/mm/yyyy'}}},fields:'userEnteredFormat.numberFormat'}});
 format.push({repeatCell:{range:{sheetId:movementId,startRowIndex:MOVEMENT_START_ROW-1,endRowIndex:GRID_ROWS,startColumnIndex:8,endColumnIndex:9},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/mm/yyyy'}}},fields:'userEnteredFormat.numberFormat'}});
 if(createdMovement)format.push({setBasicFilter:{filter:{range:{sheetId:movementId,startRowIndex:19,endRowIndex:GRID_ROWS,startColumnIndex:0,endColumnIndex:17}}}});

 const widths={
  'Inventario actual':[110,220,160,210,115,95,95,110,115],
  'Catálogo':[115,240,180,100,100],
  'Proveedores':[260,150],
  'Alertas':[120,110,220,200,115,95,95,220],
 };
 for(const [title,sizes] of Object.entries(widths)){
  const sheetId=sheetMap[title];
  sizes.forEach((pixelSize,index)=>format.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{pixelSize},fields:'pixelSize'}}));
 }
 await requestJson(await request(base+':batchUpdate',{method:'POST',headers:auth,body:JSON.stringify({requests:format}),signal:AbortSignal.timeout(30000)}),'No se pudo aplicar el formato de la hoja.');
 return sheetMap;
}

export async function readValues(spreadsheetId,token,ranges,request=fetch){
 const query=ranges.map(range=>'ranges='+encodeURIComponent(range)).join('&');
 const data=await requestJson(await request(api(spreadsheetId)+'/values:batchGet?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&'+query,{headers:headers(token),signal:AbortSignal.timeout(30000)}),'No se pudieron leer los registros de la hoja.');
 return Object.fromEntries((data.valueRanges||[]).map((range,index)=>[ranges[index],range.values||[]]));
}
export async function writeValues(spreadsheetId,token,data,valueInputOption='RAW',request=fetch){
 return requestJson(await request(api(spreadsheetId)+'/values:batchUpdate',{method:'POST',headers:headers(token),body:JSON.stringify({valueInputOption,data}),signal:AbortSignal.timeout(45000)}),'No se pudieron escribir los resultados en la hoja.');
}
export function referenceValues(data){
 const categories=new Map(data.categories.map(row=>[String(row.id),row.nombre]));
 const catalog=data.products.map(row=>[row.codigo,row.nombre,categories.get(String(row.categoria_id))||'Sin categoría',row.unidad_medida,row.es_perecible?'Sí':'No']);
 const providers=data.providers.map(row=>[row.nombre,row.documento||'']);
 const totals=new Map();
 for(const row of data.stock){
  // Se conserva F como cantidad para el formulario y el panel lateral.
  const key=JSON.stringify([row.codigo,row.sede,row.unidad_medida]);
  if(!totals.has(key))totals.set(key,{...row,cantidad:0,stock_minimo:0,lotes:new Set(),vencimiento:''});
  const total=totals.get(key),quantity=Number(row.cantidad);
  total.cantidad+=quantity;
  total.stock_minimo=Math.max(total.stock_minimo,Number(row.stock_minimo||0));
  if(quantity>0){
   if(row.lote)total.lotes.add(row.lote);
   if(row.vencimiento&&(!total.vencimiento||row.vencimiento<total.vencimiento))total.vencimiento=row.vencimiento;
  }
 }
 const inventory=Array.from(totals.values(),row=>[row.codigo,row.producto,row.sede,row.lotes.size,row.vencimiento,Number(row.cantidad.toFixed(6)),row.unidad_medida,row.stock_minimo,row.cantidad<=0?'Sin stock':row.stock_minimo>row.cantidad?'Bajo mínimo':'Normal']);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const alerts=[];
 for(const row of totals.values()){
  if(row.cantidad<=0)alerts.push(['Sin stock',row.codigo,row.producto,'','',Number(row.cantidad.toFixed(6)),row.unidad_medida,`Sede: ${row.sede} · Producto agotado.`]);
  else if(row.stock_minimo>row.cantidad)alerts.push(['Stock bajo',row.codigo,row.producto,'','',Number(row.cantidad.toFixed(6)),row.unidad_medida,`Sede: ${row.sede} · Mínimo: ${row.stock_minimo}`]);
 }
 for(const row of data.stock){const quantity=Number(row.cantidad);if(quantity<=0)continue;if(row.vencimiento){const days=(new Date(row.vencimiento+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000;if(days<0)alerts.push(['Vencido',row.codigo,row.producto,row.lote,row.vencimiento,quantity,row.unidad_medida,'No usar']);else if(days<=30)alerts.push(['Por vencer',row.codigo,row.producto,row.lote,row.vencimiento,quantity,row.unidad_medida,`Vence en ${Math.ceil(days)} días`]);}}
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
 updates.push({range:"'Alertas'!A2",values:rows.alerts.length?rows.alerts:[['Sin alertas activas','','','','','','','No se detectaron productos agotados, bajo mínimo ni lotes vencidos o próximos a vencer.']]});
 if(updates.length)await writeValues(spreadsheetId,token,updates,'RAW',request);
 return {alerts:rows.alerts.length,inventory:rows.inventory.length};
}
