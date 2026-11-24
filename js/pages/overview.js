import { rpc } from '../services/data.js';
import { heading,e,table,badge,loadError } from '../components/ui.js';
import { quantity } from '../utils/domain.js';
import { confirmAction } from '../components/confirmation.js';
import { updateGoogleSheets, syncInventorySheets, GOOGLE_SHEETS_URL, GOOGLE_INVENTORY_SHEETS_URL } from '../services/google-sheets.js';
export async function overviewPage(root,access={}){
 root.innerHTML=heading('Inventario de La Liguria','Resumen de operación · Fechas y actividad en hora de Lima.',(access.rol==='administrador'?'<button type="button" class="button primary" id="sync-inventory-sheets">Sincronizar inventario</button><button type="button" class="button" id="update-google-sheets">Actualizar reporte diario</button>':'')+'<a class="button" href="inventario.html">Ver existencias</a><a class="button" href="movimientos.html">Movimientos</a>')+
 (access.rol==='administrador'?'<div class="sheets-status" aria-live="polite"><span id="inventory-sheets-status">Registra entradas y salidas desde el formulario de Movimientos y luego sincroniza.</span> <a class="text-link" href="'+GOOGLE_INVENTORY_SHEETS_URL+'" target="_blank" rel="noopener noreferrer">Abrir control operativo ↗</a></div><div class="sheets-status"><span id="google-sheets-status">El reporte diario se mantiene separado y solo sirve para consulta.</span> <a class="text-link" href="'+GOOGLE_SHEETS_URL+'" target="_blank" rel="noopener noreferrer">Abrir reportes ↗</a></div>':'')+
 '<div id="overview-kpis" class="kpi-grid"></div>'+
 (access.rol==='administrador'?'<section class="panel overview-expense-preview" id="overview-expense-preview" aria-label="Resumen mensual de gastos"><div><span class="kpi-label">Total gastado</span><strong class="overview-expense-value" id="overview-expense-total" aria-live="polite">—</strong><span class="expense-detail" id="overview-expense-period">Gastos del mes actual</span><span class="form-error" id="overview-expense-error" role="alert" hidden></span></div><a class="button" href="gastos.html">Ver gastos <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></section>':'')+
 '<div class="overview-grid"><section class="panel"><h2>Actividad de los últimos 7 días</h2><p class="muted">Número de movimientos; no mezcla kilos, litros y unidades.</p><div id="activity"></div></section><section class="panel"><h2>Atención de inventario</h2><div id="alerts"></div><a href="inventario.html" class="text-link">Revisar lotes y mínimos →</a></section></div><section class="panel"><h2>Últimos movimientos</h2><div id="recent"></div></section>';
 const sheetsButton=root.querySelector('#update-google-sheets');
 if(sheetsButton) sheetsButton.onclick=async()=>{
  if(sheetsButton.disabled)return;
  sheetsButton.disabled=true;
  const status=root.querySelector('#google-sheets-status');
  try{
   if(!await confirmAction({title:'Actualizar Google Sheets',message:'¿Quieres enviar el reporte completo a Google Sheets? Se creará o actualizará la pestaña del día en hora de Perú. Las pestañas anteriores se conservarán.'}))return;
   sheetsButton.textContent='Actualizando…';status.textContent='Preparando y enviando el reporte a Google Sheets…';status.classList.remove('form-error');
   const result=await updateGoogleSheets();
   status.textContent='Pestaña '+result.title+' actualizada. Datos al '+new Date(result.updatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})+' (Perú).';
  }catch(error){status.textContent=error.message;status.classList.add('form-error');}
  finally{sheetsButton.disabled=false;sheetsButton.textContent='Actualizar reporte diario';}
 };
 const inventorySheetsButton=root.querySelector('#sync-inventory-sheets');
 if(inventorySheetsButton)inventorySheetsButton.onclick=async()=>{
  if(inventorySheetsButton.disabled)return;
  inventorySheetsButton.disabled=true;const status=root.querySelector('#inventory-sheets-status');
  try{
   if(!await confirmAction({title:'Sincronizar inventario',message:'¿Quieres procesar los movimientos pendientes de la hoja operativa? Las entradas aumentarán el stock y las salidas lo descontarán por FEFO sin duplicarse al reintentar.'}))return;
   inventorySheetsButton.textContent='Sincronizando…';status.textContent='Validando la hoja y actualizando el inventario…';status.classList.remove('form-error');
   const result=await syncInventorySheets();
   status.textContent=result.processed===0?'La hoja quedó preparada. No había filas pendientes.':`${result.synchronized} fila(s) sincronizada(s) y ${result.errors} con error. Revisa la columna Resultado en la hoja.`;
   await refresh();
  }catch(error){status.textContent=error.message;status.classList.add('form-error');}
  finally{inventorySheetsButton.disabled=false;inventorySheetsButton.textContent='Sincronizar inventario';}
 };
 async function refreshExpenses(){
  if(access.rol!=='administrador')return;
  const total=root.querySelector('#overview-expense-total'),errorNode=root.querySelector('#overview-expense-error');
  try{
   const data=await rpc('app_resumen_gastos_inicio');
   total.textContent=new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(data.total));
   const period=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(data.periodo+'T12:00:00Z'));
   root.querySelector('#overview-expense-period').textContent=period+' · '+data.cantidad+' registro(s) de gasto';
   errorNode.hidden=true;errorNode.textContent='';
  }catch(error){total.textContent='—';errorNode.hidden=false;errorNode.textContent='No se pudo consultar el total de gastos. Vuelve a intentar.';}
 }
 async function refreshInventory(){
  try{
   const data=await rpc('app_resumen');
   root.querySelector('#overview-kpis').innerHTML=[['Productos activos',data.productos],['Productos bajo mínimo',data.bajo_minimo],['Entradas hoy',data.entradas],['Salidas hoy',data.salidas]].map(([label,value])=>'<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">'+e(label)+'</span><strong class="kpi-value">'+quantity(value)+'</strong></div></div>').join('');
   const max=Math.max(1,...data.actividad.map(d=>Number(d.total)));
   root.querySelector('#activity').innerHTML='<div class="activity-chart">'+data.actividad.map(d=>'<div class="activity-column"><strong>'+quantity(d.total)+'</strong><div class="activity-track"><div style="height:'+Math.max(2,Number(d.total)/max*100)+'%"></div></div><span>'+e(d.dia.slice(5))+'</span></div>').join('')+'</div>';
   root.querySelector('#alerts').innerHTML='<div class="alert-item">'+badge('Vencidos','danger')+'<strong>'+quantity(data.vencidos)+'</strong><span>Lotes con existencias</span></div><div class="alert-item">'+badge('Próximos 30 días','warning')+'<strong>'+quantity(data.por_vencer)+'</strong><span>Lotes con existencias</span></div>';
   root.querySelector('#recent').innerHTML=table(['Fecha','Tipo','Producto','Lote','Cantidad','Sede'],data.recientes.map(r=>[e(new Date(r.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})),badge(r.tipo),e(r.producto),e(r.lote),quantity(r.cantidad)+' '+e(r.unidad_medida),e(r.sede)]));
   loadError(null);
  }catch(error){loadError(error);}
 }
 async function refresh(){await Promise.all([refreshInventory(),refreshExpenses()]);}
 await refresh();return {refresh,tables:['productos','inventario','inventario_minimos','movimientos','lotes','sedes',...(access.rol==='administrador'?['gastos']:[])]};
}
