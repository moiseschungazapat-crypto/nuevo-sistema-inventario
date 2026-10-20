import { rpc } from '../services/data.js';
import { heading,e,table,badge,loadError } from '../components/ui.js';
import { quantity } from '../utils/domain.js';
import { confirmAction } from '../components/confirmation.js';
import { updateGoogleSheets, GOOGLE_SHEETS_URL } from '../services/google-sheets.js';
export async function overviewPage(root,access={}){
 root.innerHTML=heading('Inventario de La Liguria','Resumen de operación · Fechas y actividad en hora de Lima.',(access.rol==='administrador'?'<button type="button" class="button" id="update-google-sheets">Actualizar Google Sheets</button>':'')+'<a class="button" href="inventario.html">Ver existencias</a><a class="button primary" href="movimientos.html">Movimientos</a>')+
 (access.rol==='administrador'?'<div class="sheets-status" aria-live="polite"><span id="google-sheets-status">Reporte manual por fecha de Perú. Incluye existencias, movimientos, recepciones, alertas y catálogos.</span> <a class="text-link" href="'+GOOGLE_SHEETS_URL+'" target="_blank" rel="noopener noreferrer">Abrir hoja ↗</a></div>':'')+
 '<div id="overview-kpis" class="kpi-grid"></div><div class="overview-grid"><section class="panel"><h2>Actividad de los últimos 7 días</h2><p class="muted">Número de movimientos; no mezcla kilos, litros y unidades.</p><div id="activity"></div></section><section class="panel"><h2>Atención de inventario</h2><div id="alerts"></div><a href="inventario.html" class="text-link">Revisar lotes y mínimos →</a></section></div><section class="panel"><h2>Últimos movimientos</h2><div id="recent"></div></section>';
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
  finally{sheetsButton.disabled=false;sheetsButton.textContent='Actualizar Google Sheets';}
 };
 async function refresh(){
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
 await refresh();return {refresh,tables:['productos','inventario','inventario_minimos','movimientos','lotes','sedes']};
}
