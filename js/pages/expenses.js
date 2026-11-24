import {rpc} from '../services/data.js';
import {heading,e,field,openEditor,table,pager,notice,loadError} from '../components/ui.js';
import {downloadExcelReport} from '../utils/excel-report.js';
import {expenseReportRows} from '../utils/expense-report.js';

const categories=['Mercadería','Servicios','Transporte','Mantenimiento','Personal','Alquiler','Otros'];
const money=value=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',maximumFractionDigits:4}).format(Number(value));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const displayDate=value=>value?String(value).split('-').reverse().join('/'):'—';

export async function expensesPage(root,access){
 if(access.rol!=='administrador'){
  root.innerHTML=heading('Control de gastos','Acceso exclusivo del administrador o jefe autorizado.')+'<section class="panel"><p>No tienes permisos para consultar esta sección.</p></section>';
  return {refresh:async()=>{},tables:[]};
 }
 let data=null,page=0,sequence=0;
 root.innerHTML=heading('Control de gastos','Cuánto se gastó en los productos recibidos y otros gastos del mes.','<button type="button" class="button" id="export-expenses">Descargar reporte Excel</button><button type="button" class="button primary" id="new-expense">+ Otro gasto</button>')+
  `<div class="toolbar expense-period"><label>Período<input type="month" id="expense-month" value="${today().slice(0,7)}"></label><span class="expense-private"><i class="fa-solid fa-lock" aria-hidden="true"></i> Solo administrador o jefe</span><button type="button" class="button" id="expense-refresh">Actualizar</button></div>`+
  '<div id="expense-kpis" class="kpi-grid expense-kpis"></div><section class="panel"><h2>Detalle de gastos</h2><p class="muted">Las entradas con costo generan el gasto automáticamente. Las salidas solo descuentan existencias.</p><div class="toolbar"><label class="search-label">Buscar<input type="search" id="expense-search" placeholder="Producto, código, concepto o proveedor…"></label><label>Categoría<select id="expense-category"><option value="">Todas</option>'+categories.map(c=>`<option>${e(c)}</option>`).join('')+'</select></label></div><div id="expense-results"></div><div class="pagination" id="expense-pager"></div></section>';
 const month=()=>root.querySelector('#expense-month').value+'-01';
 function filtered(rows=data?.gastos||[],query=root.querySelector('#expense-search').value,category=root.querySelector('#expense-category').value){
  const q=query.trim().toLocaleLowerCase();
  return rows.filter(row=>(!category||row.categoria===category)&&[row.concepto,row.proveedor,row.producto_nombre,row.producto_codigo].some(value=>String(value||'').toLocaleLowerCase().includes(q)));
 }
 function render(){
  if(!data)return;
  root.querySelector('#expense-kpis').innerHTML=[
   ['Total gastado',money(data.total),'Gastos del mes seleccionado'],
   ['En productos recibidos',money(data.total_productos),'Generado desde las entradas'],
   ['Otros gastos',money(data.total_otros),'Servicios y gastos manuales'],
   ['Productos comprados',String(data.productos),`${data.cantidad} registros de gasto`],
  ].map(([label,value,help])=>`<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">${e(label)}</span><strong class="kpi-value">${e(value)}</strong><small>${e(help)}</small></div></div>`).join('');
  const rows=filtered();page=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  root.querySelector('#expense-results').innerHTML=table(['Fecha','Producto / concepto','Proveedor','Cantidad','Costo unitario','Total gastado','Origen'],rows.slice(page*20,(page+1)*20).map(row=>[
   e(displayDate(row.fecha)),`<strong>${e(row.producto_nombre||row.concepto)}</strong><small class="expense-detail">${e(row.producto_codigo||row.categoria)}</small>`,e(row.proveedor||'—'),row.cantidad==null?'—':e(row.cantidad+' '+row.unidad),row.costo_unitario==null?'—':e(money(row.costo_unitario)),`<span class="expense-amount">${e(money(row.monto))}</span>`,
   row.origen==='manual'?`<button type="button" class="button small" data-expense-edit="${e(row.id)}">Editar gasto</button>`:e(row.origen==='recepcion'?'Ingreso de productos':'Entrada manual'),
  ]),'No hay gastos registrados para este período y filtros.');
  pager(root.querySelector('#expense-pager'),rows.length,page,20,value=>{page=value;render();});
  root.querySelectorAll('[data-expense-edit]').forEach(button=>button.onclick=()=>edit(data.gastos.find(row=>row.id===button.dataset.expenseEdit)));
 }
 async function refresh(){
  const selected=month(),current=++sequence;
  if(!/^\d{4}-\d{2}-01$/.test(selected))return;
  try{const loaded=await rpc('app_gastos_mes',{p_mes:selected});if(current!==sequence)return;data=loaded;loadError(null);render();}
  catch(error){if(current!==sequence)return;data=null;root.querySelector('#expense-results').textContent='No se pudieron consultar los gastos.';root.querySelector('#expense-kpis').innerHTML='';root.querySelector('#expense-pager').innerHTML='';loadError(error);}
 }
 function edit(original){
  const row=original||{},operation=crypto.randomUUID();
  openEditor({title:original?'Editar gasto':'Registrar otro gasto',fields:
   field('fecha','Fecha del gasto',{type:'date',required:true,value:row.fecha||today()})+
   field('concepto','Concepto',{required:true,maxLength:200,value:row.concepto||''})+
   field('categoria','Categoría',{required:true,choices:categories.map(c=>`<option ${c===(row.categoria||'Otros')?'selected':''}>${e(c)}</option>`).join('')})+
   field('monto','Total gastado (S/)',{type:'number',required:true,min:.01,step:'0.01',value:row.monto||''})+
   field('proveedor','Proveedor (opcional)',{value:row.proveedor||'',maxLength:200})+
   field('observaciones','Observación (opcional)',{type:'textarea',maxLength:1000,value:row.observaciones||''}),
   save:async values=>{await rpc('app_guardar_gasto',{p_operacion:operation,p_datos:values,p_id:row.id||null,p_version:row.version||null});notice('Gasto guardado.');await refresh();}});
 }
 root.querySelector('#new-expense').onclick=()=>edit();
 root.querySelector('#export-expenses').onclick=async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{
   const selected=month(),query=root.querySelector('#expense-search').value,category=root.querySelector('#expense-category').value;
   if(!/^\d{4}-\d{2}-01$/.test(selected))throw new Error('Selecciona un mes para descargar el reporte.');
   const fresh=await rpc('app_gastos_mes',{p_mes:selected});
   const rows=expenseReportRows(filtered(fresh.gastos,query,category));
   const total=rows.reduce((sum,row)=>sum+Math.round(Number(row[5])*100),0)/100;
   rows.push(['','TOTAL GASTADO','','','',total]);
   downloadExcelReport(`gastos-${selected.slice(0,7)}.xlsx`,{title:'GASTOS POR PRODUCTO',sheetName:'Gastos',headers:['Código','Producto / concepto','Categoría','Cantidad','Unidad','Total gastado (S/)'],rows,widths:[16,45,23,16,14,24],numericColumns:[3,5],filters:`Mes: ${selected.slice(0,7)} · Categoría: ${category||'Todas'} · Búsqueda: ${query||'Todas'}`,note:'Totales en soles de las entradas registradas con costo y otros gastos. Cantidades separadas por producto y unidad. No incluye estimaciones para entradas históricas sin costo.'});
   notice('Reporte de gastos por producto descargado.');
  }catch(error){loadError(error);}finally{button.disabled=false;}
 };
 root.querySelector('#expense-refresh').onclick=refresh;
 root.querySelector('#expense-month').onchange=()=>{page=0;refresh();};
 root.querySelector('#expense-category').onchange=()=>{page=0;render();};
 root.querySelector('#expense-search').oninput=()=>{page=0;render();};
 await refresh();return {refresh,tables:['gastos']};
}
