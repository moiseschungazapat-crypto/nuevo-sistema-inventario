export const SPREADSHEET_ID = '1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE';
const id = value => String(value ?? '');
const num = value => Number(value ?? 0);
const round = value => Math.round(value * 1000) / 1000;
const types = {entrada:'Entrada',salida:'Salida',traslado:'Traslado',ajuste_positivo:'Ajuste positivo',ajuste_negativo:'Ajuste negativo'};
export function limaDate(value) {
 return new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function buildReport(data) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || limaDate(data.generated_at) !== data.date) throw new Error('Fecha de reporte inválida.');
 for (const key of ['products','categories','providers','sites','stock','minimums','movements','receptions','reception_lines']) {
  if (!Array.isArray(data[key])) throw new Error('Faltan datos del reporte: ' + key);
 }
 const title = data.date.split('-').reverse().join('/');
 const products = new Map(data.products.map(p => [id(p.id),p]));
 const providers = new Map(data.providers.map(p => [id(p.id),p]));
 const sites = new Map(data.sites.map(s => [id(s.id),s]));
 const receptions = new Map(data.receptions.map(r => [id(r.id),r]));
 const balances = new Map();
 const key = (p,s) => JSON.stringify([id(p),id(s)]);
 const balance = (p,s) => {
  const k = key(p,s);
  if (!balances.has(k)) balances.set(k,{p:id(p),s:id(s),stock:0,entrada:0,salida:0,positive:0,negative:0,transferIn:0,transferOut:0,min:0});
  return balances.get(k);
 };
 for (const p of data.products.filter(p => p.estado !== false && p.controla_inventario !== false)) {
  for (const s of data.sites.filter(s => s.estado !== false)) balance(p.id,s.id);
 }
 for (const row of data.stock) balance(row.producto_id,row.sede_id).stock += num(row.cantidad);
 for (const row of data.minimums) balance(row.producto_id,row.sede_id).min = num(row.minimo);
 for (const m of data.movements) {
  if (limaDate(m.fecha) !== data.date || new Date(m.fecha)>new Date(data.generated_at)) throw new Error('Movimiento fuera de la fecha del reporte.');
  const b = balance(m.producto_id,m.sede_id), q = num(m.cantidad);
  if (m.tipo==='entrada') b.entrada+=q;
  else if (m.tipo==='salida') b.salida+=q;
  else if (m.tipo==='ajuste_positivo') b.positive+=q;
  else if (m.tipo==='ajuste_negativo') b.negative+=q;
  else if (m.tipo==='traslado') { b.transferOut+=q; balance(m.producto_id,m.destino_id).transferIn+=q; }
  else throw new Error('Tipo de movimiento desconocido.');
 }
 const rows = [], sections = [], tables = [];
 const add = (...values) => rows.push(values);
 const section = (name,headers,content,{omitWhenEmpty=false}={}) => {
  if (omitWhenEmpty && !content.length) return null;
  add(); sections.push(rows.length); add(name); const header = rows.length; add(...headers);
  if (content.length) content.forEach(row => add(...row)); else add('Sin registros');
  tables.push({header,end:rows.length,columns:headers.length});
  return header;
 };
 const time = value => new Date(value).toLocaleString('es-PE',{timeZone:'America/Lima',hour12:false});
 add('LA LIGURIA S.A. — REPORTE DIARIO');
 add('Fecha',title,'Actualizado (Perú)',time(data.generated_at),'Fuente','Supabase');
 add('Corte manual. Se muestran productos con saldo, mínimo configurado o actividad del día.');
 const balanceRows=[...balances.values()].filter(b=>b.stock!==0||b.min>0||b.entrada+b.salida+b.positive+b.negative+b.transferIn+b.transferOut>0);
 const alertRows=data.stock.map(s => {
  if(num(s.cantidad)<=0||!s.vencimiento)return null;
  const days=(new Date(s.vencimiento+'T00:00:00Z')-new Date(data.date+'T00:00:00Z'))/86400000;
  const alert=s.vencimiento<data.date?'Vencido':days<=30?'Vence en próximos 30 días':null;
  return alert?[s.codigo,s.producto,s.sede,s.lote,s.vencimiento,num(s.cantidad),s.unidad_medida,alert]:null;
 }).filter(Boolean);
 section('RESUMEN DEL DÍA',['Productos con stock','Bajo mínimo','Movimientos','Recepciones','Lotes vencidos','Lotes por vencer'],[[
  new Set([...balances.values()].filter(b=>b.stock>0).map(b=>b.p)).size,
  new Set([...balances.values()].filter(b=>b.min>0&&b.stock<b.min).map(b=>b.p)).size,
  data.movements.length,data.receptions.length,
  alertRows.filter(r=>r[7]==='Vencido').length,alertRows.filter(r=>r[7]==='Vence en próximos 30 días').length,
 ]]);
 section('EXISTENCIAS RELEVANTES',['Código','Producto','Sede','Unidad','Stock inicial','Entradas','Salidas','Ajuste neto','Traslado neto','Stock actual','Mínimo','Estado'],
  balanceRows.map(b => {
   const p=products.get(b.p)||{}, s=sites.get(b.s)||{};
   const net=b.entrada-b.salida+b.positive-b.negative+b.transferIn-b.transferOut;
   return [p.codigo,p.nombre,s.nombre,p.unidad_medida,round(b.stock-net),round(b.entrada),round(b.salida),round(b.positive-b.negative),round(b.transferIn-b.transferOut),round(b.stock),b.min,b.min>0&&b.stock<b.min?'Bajo mínimo':'Normal'];
  }));
 section('MOVIMIENTOS DEL DÍA',['Fecha y hora (Perú)','Tipo','Producto','Unidad','Lote','Sede origen','Sede destino','Cantidad','Responsable','Documento','Motivo'],
  data.movements.map(m => [time(m.fecha),types[m.tipo],m.producto,m.unidad_medida,m.lote,m.sede,m.destino,num(m.cantidad),m.responsable,m.documento,m.motivo]),{omitWhenEmpty:true});
 section('ALERTAS DE LOTES',['Código','Producto','Sede','Lote','Vencimiento','Cantidad','Unidad','Alerta'],alertRows,{omitWhenEmpty:true});
 section('RECEPCIONES DEL DÍA',['Fecha','Proveedor','Documento','Responsable','Moneda','Total','Estado de pago','Forma de pago'],
  data.receptions.map(r => [r.fecha_recepcion,providers.get(id(r.proveedor_id))?.nombre,`${r.tipo_comprobante} ${r.serie}-${r.numero}`,r.responsable,r.moneda,r.total,r.estado_pago,r.forma_pago]),{omitWhenEmpty:true});
 section('PRODUCTOS RECIBIDOS',['Recepción ID','Producto','Facturado','Recibido','Faltante','Unidad','Precio unitario','Moneda'],data.reception_lines.map(d => [d.recepcion_id,products.get(id(d.producto_id))?.nombre,num(d.cantidad_facturada),num(d.cantidad_recibida),round(num(d.cantidad_facturada)-num(d.cantidad_recibida)),d.unidad,d.precio_unitario,receptions.get(id(d.recepcion_id))?.moneda]),{omitWhenEmpty:true});
 return {title,rows,sections,tables};
}

// Explicit stringValue prevents stored text (e.g. '=IMPORTXML(...)') becoming a formula.
export function cell(value) {
 if (value == null) return {};
 if (typeof value==='number') {
  if (!Number.isFinite(value)) throw new Error('Número inválido en el reporte.');
  return {userEnteredValue:{numberValue:value}};
 }
 return {userEnteredValue:{stringValue:String(value)}};
}

export function reportRequests(report, existing) {
 const sheetId = existing?.sheetId ?? Number(report.title.split('/').reverse().join(''));
 const columns = Math.max(...report.rows.map(r=>r.length));
 const rowCount = Math.max(report.rows.length,existing?.gridProperties?.rowCount||0,100);
 const columnCount = Math.max(columns,existing?.gridProperties?.columnCount||0);
 // No se congelan filas: fijar la primera cabecera también inmovilizaría todo el bloque informativo superior.
 const gridProperties={rowCount,columnCount,frozenRowCount:0,frozenColumnCount:0,hideGridlines:true};
 const requests = existing ? [{updateSheetProperties:{properties:{sheetId,gridProperties},fields:'gridProperties'}}]
  : [{addSheet:{properties:{sheetId,title:report.title,gridProperties}}}];
 // Remove the previous export's layout before rebuilding it, including when the report shrinks.
 if(existing) {
  requests.push({clearBasicFilter:{sheetId}});
  requests.push({unmergeCells:{range:{sheetId}}});
  for(const band of existing.bandedRanges||[]) requests.push({deleteBanding:{bandedRangeId:band.bandedRangeId}});
 }
 requests.push({updateCells:{range:{sheetId},rows:report.rows.map(values=>({values:values.map(cell)})),fields:'userEnteredValue'}});
 requests.push({repeatCell:{range:{sheetId},cell:{userEnteredFormat:{textFormat:{fontFamily:'Arial',fontSize:10,foregroundColor:{red:0.15,green:0.2,blue:0.27}},verticalAlignment:'MIDDLE',wrapStrategy:'CLIP',padding:{top:4,bottom:4,left:7,right:7},numberFormat:{type:'NUMBER',pattern:'#,##0.###'}}},fields:'userEnteredFormat'}});
 // Cabecera compacta: título, metadatos en una fila y una sola nota breve.
 for(const row of [0,2])requests.push({mergeCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:0,endColumnIndex:Math.min(8,columnCount)},mergeType:'MERGE_ALL'}});
 requests.push({repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:6},cell:{userEnteredFormat:{backgroundColor:{red:0.96,green:0.97,blue:0.98}}},fields:'userEnteredFormat.backgroundColor'}});
 for(const column of [0,2,4])requests.push({repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:column,endColumnIndex:column+1},cell:{userEnteredFormat:{textFormat:{bold:true,foregroundColor:{red:0.35,green:0.42,blue:0.5}}}},fields:'userEnteredFormat.textFormat'}});
 requests.push({repeatCell:{range:{sheetId,startRowIndex:2,endRowIndex:3,startColumnIndex:0,endColumnIndex:Math.min(8,columnCount)},cell:{userEnteredFormat:{backgroundColor:{red:1,green:0.97,blue:0.92},textFormat:{italic:true,foregroundColor:{red:0.38,green:0.32,blue:0.24}},wrapStrategy:'WRAP'}},fields:'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)'}});
 for(const table of report.tables) {
  requests.push({mergeCells:{range:{sheetId,startRowIndex:table.header-1,endRowIndex:table.header,startColumnIndex:0,endColumnIndex:table.columns},mergeType:'MERGE_ALL'}});
  requests.push({addBanding:{bandedRange:{range:{sheetId,startRowIndex:table.header,endRowIndex:table.end,startColumnIndex:0,endColumnIndex:table.columns},rowProperties:{headerColor:{red:0.89,green:0.93,blue:0.97},firstBandColor:{red:1,green:1,blue:1},secondBandColor:{red:0.96,green:0.97,blue:0.99}}}}});
  requests.push({updateBorders:{range:{sheetId,startRowIndex:table.header,endRowIndex:table.end,startColumnIndex:0,endColumnIndex:table.columns},bottom:{style:'SOLID',color:{red:0.81,green:0.86,blue:0.91}}}});
 }
 for (const startRowIndex of [0,...report.sections]) {
  requests.push({repeatCell:{range:{sheetId,startRowIndex,endRowIndex:startRowIndex+1},cell:{userEnteredFormat:{backgroundColor:{red:0.06,green:0.14,blue:0.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
  if (startRowIndex>0) requests.push({repeatCell:{range:{sheetId,startRowIndex:startRowIndex+1,endRowIndex:startRowIndex+2},cell:{userEnteredFormat:{backgroundColor:{red:0.9,green:0.94,blue:0.98},textFormat:{bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
 }
 requests.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{textFormat:{fontSize:15,bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat.textFormat'}});
 for(const table of report.tables)requests.push({repeatCell:{range:{sheetId,startRowIndex:table.header,endRowIndex:table.header+1,startColumnIndex:0,endColumnIndex:table.columns},cell:{userEnteredFormat:{horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',wrapStrategy:'WRAP'}},fields:'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)'}});
 const widths=[120,280,165,170,110,125,125,125,125,125,145,145,140,120,175,165,155,155,260];
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:columnCount},properties:{pixelSize:125},fields:'pixelSize'}});
 widths.slice(0,columnCount).forEach((pixelSize,index)=>requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{pixelSize},fields:'pixelSize'}}));
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:report.rows.length},properties:{pixelSize:27},fields:'pixelSize'}});
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:38},fields:'pixelSize'}});
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:1,endIndex:2},properties:{pixelSize:30},fields:'pixelSize'}});
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:2,endIndex:3},properties:{pixelSize:34},fields:'pixelSize'}});
 // Las filas en blanco separan secciones sin crear grandes espacios vacíos.
 for(const row of report.sections.map(row=>row-1))requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:row,endIndex:row+1},properties:{pixelSize:9},fields:'pixelSize'}});
 for(const row of report.sections)requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:row,endIndex:row+1},properties:{pixelSize:31},fields:'pixelSize'}});
 for(const table of report.tables)requests.push({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:table.header,endIndex:table.header+1},properties:{pixelSize:38},fields:'pixelSize'}});
 // Apply alerts as cell formats, without formulas or changes to exported values.
 report.rows.forEach((row,index)=>row.forEach((value,column)=>{
  const warning=value==='Bajo mínimo'||value==='Vencido'||value==='Vence en próximos 30 días';
  if(warning)requests.push({repeatCell:{range:{sheetId,startRowIndex:index,endRowIndex:index+1,startColumnIndex:column,endColumnIndex:column+1},cell:{userEnteredFormat:{backgroundColor:value==='Vencido'?{red:1,green:0.88,blue:0.88}:{red:1,green:0.95,blue:0.8},textFormat:{bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
 }));
 return {sheetId,requests};
}
