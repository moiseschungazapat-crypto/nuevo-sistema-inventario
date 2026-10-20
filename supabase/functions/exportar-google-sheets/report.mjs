export const SPREADSHEET_ID = '1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE';
const id = value => String(value ?? '');
const num = value => Number(value ?? 0);
const round = value => Math.round(value * 1000) / 1000;
const state = value => value === false ? 'Inactivo' : 'Activo';
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
 const categories = new Map(data.categories.map(c => [id(c.id),c.nombre]));
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
 const rows = [], sections = [];
 const add = (...values) => rows.push(values);
 const section = (name,headers,content) => {
  add(); sections.push(rows.length); add(name); const header = rows.length; add(...headers);
  if (content.length) content.forEach(row => add(...row)); else add('Sin registros');
  return header;
 };
 const time = value => new Date(value).toLocaleString('es-PE',{timeZone:'America/Lima',hour12:false});
 add('LA LIGURIA S.A. — REPORTE DIARIO');
 add('Fecha',title,'Actualizado (hora de Perú)',time(data.generated_at));
 add('Fuente','Supabase','Alcance','Datos guardados hasta la hora de actualización');
 add('Saldo inicial','Saldo actual menos movimientos netos del día. Incluye ajustes y traslados.');
 add('Actualización manual','El saldo final es al momento del envío. Vuelve a actualizar al cierre del día.');
 section('EXISTENCIAS POR PRODUCTO Y SEDE',['Código','Producto','Categoría','Sede','Unidad','Stock inicial','Entradas','Salidas','Ajustes (+)','Ajustes (−)','Traslados recibidos','Traslados enviados','Stock al corte','Mínimo','Estado'],
  [...balances.values()].map(b => {
   const p=products.get(b.p)||{}, s=sites.get(b.s)||{};
   const net=b.entrada-b.salida+b.positive-b.negative+b.transferIn-b.transferOut;
   return [p.codigo,p.nombre,categories.get(id(p.categoria_id))||'Sin categoría',s.nombre,p.unidad_medida,round(b.stock-net),round(b.entrada),round(b.salida),round(b.positive),round(b.negative),round(b.transferIn),round(b.transferOut),round(b.stock),b.min,b.stock<b.min?'Bajo mínimo':'Normal'];
  }));
 section('MOVIMIENTOS DEL DÍA',['Fecha y hora (Perú)','Tipo','Producto','Unidad','Lote','Sede origen','Sede destino','Cantidad','Responsable','Documento','Motivo'],
  data.movements.map(m => [time(m.fecha),types[m.tipo],m.producto,m.unidad_medida,m.lote,m.sede,m.destino,num(m.cantidad),m.responsable,m.documento,m.motivo]));
 section('LOTES Y ALERTAS',['Código','Producto','Sede','Lote','Vencimiento','Cantidad','Unidad','Alerta'],data.stock.map(s => [s.codigo,s.producto,s.sede,s.lote,s.vencimiento,num(s.cantidad),s.unidad_medida,
  num(s.cantidad)<=0?'Sin existencias':s.vencimiento<data.date?'Vencido':(new Date(s.vencimiento+'T00:00:00Z')-new Date(data.date+'T00:00:00Z'))/86400000<=30?'Vence en próximos 30 días':'Vigente']));
 section('RECEPCIONES DEL DÍA',['ID','Fecha recepción','Fecha emisión','Proveedor','Documento','Sede','Responsable','Moneda','Subtotal','Descuento','IGV','Total','Estado pago','Forma pago','Condición pago','Vencimiento pago','Guía','Orden compra','Observaciones'],
  data.receptions.map(r => [r.id,r.fecha_recepcion,r.fecha_emision,providers.get(id(r.proveedor_id))?.nombre,`${r.tipo_comprobante} ${r.serie}-${r.numero}`,sites.get(id(r.sede_id))?.nombre,r.responsable,r.moneda,r.subtotal,r.descuento,r.igv,r.total,r.estado_pago,r.forma_pago,r.condicion_pago,r.fecha_vencimiento_pago,r.guia_remision,r.orden_compra,r.observaciones]));
 section('DETALLE DE RECEPCIONES',['Recepción ID','Producto','Cantidad facturada','Cantidad recibida','Faltante','Unidad','Precio unitario','Moneda'],data.reception_lines.map(d => [d.recepcion_id,products.get(id(d.producto_id))?.nombre,num(d.cantidad_facturada),num(d.cantidad_recibida),round(num(d.cantidad_facturada)-num(d.cantidad_recibida)),d.unidad,d.precio_unitario,receptions.get(id(d.recepcion_id))?.moneda]));
 section('CATÁLOGO DE PRODUCTOS',['Código','Producto','Categoría','Unidad','Tipo','Controla stock','Precio referencia','Estado','Marca','Presentación'],data.products.map(p => [p.codigo,p.nombre,categories.get(id(p.categoria_id))||'Sin categoría',p.unidad_medida,p.tipo_item||'producto',p.controla_inventario===false?'No':'Sí',p.precio_confirmado? p.precio:null,state(p.estado),p.marca,p.presentacion]));
 section('PROVEEDORES',['Nombre','Documento','Contacto','Teléfono','Correo','Dirección','Estado'],data.providers.map(p => [p.nombre,p.documento,p.contacto,p.telefono,p.email,p.direccion,state(p.estado)]));
 section('CATEGORÍAS',['Nombre','Descripción','Estado'],data.categories.map(c => [c.nombre,c.descripcion,state(c.estado)]));
 section('SEDES',['Nombre','Dirección','Responsable','Estado'],data.sites.map(s => [s.nombre,s.direccion,s.responsable,state(s.estado)]));
 return {title,rows,sections};
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
 const requests = existing ? [{updateSheetProperties:{properties:{sheetId,gridProperties:{rowCount,columnCount,frozenRowCount:5}},fields:'gridProperties'}}]
  : [{addSheet:{properties:{sheetId,title:report.title,gridProperties:{rowCount,columnCount,frozenRowCount:5}}}}];
 requests.push({updateCells:{range:{sheetId},rows:report.rows.map(values=>({values:values.map(cell)})),fields:'userEnteredValue'}});
 requests.push({repeatCell:{range:{sheetId},cell:{userEnteredFormat:{textFormat:{fontFamily:'Arial',fontSize:10},verticalAlignment:'TOP',wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}});
 for (const startRowIndex of [0,...report.sections]) {
  requests.push({repeatCell:{range:{sheetId,startRowIndex,endRowIndex:startRowIndex+1},cell:{userEnteredFormat:{backgroundColor:{red:0.06,green:0.14,blue:0.22},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
  if (startRowIndex>0) requests.push({repeatCell:{range:{sheetId,startRowIndex:startRowIndex+1,endRowIndex:startRowIndex+2},cell:{userEnteredFormat:{backgroundColor:{red:0.9,green:0.94,blue:0.98},textFormat:{bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
 }
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:columnCount},properties:{pixelSize:160},fields:'pixelSize'}});
 return {sheetId,requests};
}
