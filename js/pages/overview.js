import { rpc } from '../services/data.js';
import { heading,e,table,badge,loadError } from '../components/ui.js';
import { quantity } from '../utils/domain.js';
export async function overviewPage(root){
 root.innerHTML=heading('Dashboard de inventario','Resumen de operación · Fechas y actividad en hora de Lima.','<a class="button" href="inventario.html">Ver existencias</a><a class="button primary" href="movimientos.html">Movimientos</a>')+
 '<div id="overview-kpis" class="kpi-grid"></div><div class="overview-grid"><section class="panel"><h2>Actividad de los últimos 7 días</h2><p class="muted">Número de movimientos; no mezcla kilos, litros y unidades.</p><div id="activity"></div></section><section class="panel"><h2>Atención de inventario</h2><div id="alerts"></div><a href="inventario.html" class="text-link">Revisar lotes y mínimos →</a></section></div><section class="panel"><h2>Últimos movimientos</h2><div id="recent"></div></section>';
 async function refresh(){
  try{
   const data=await rpc('app_resumen');
   root.querySelector('#overview-kpis').innerHTML=[['Productos activos',data.productos],['Producto / sede bajo mínimo',data.bajo_minimo],['Entradas hoy',data.entradas],['Salidas hoy',data.salidas]].map(([label,value])=>'<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">'+e(label)+'</span><strong class="kpi-value">'+quantity(value)+'</strong></div></div>').join('');
   const max=Math.max(1,...data.actividad.map(d=>Number(d.total)));
   root.querySelector('#activity').innerHTML='<div class="activity-chart">'+data.actividad.map(d=>'<div class="activity-column"><strong>'+quantity(d.total)+'</strong><div class="activity-track"><div style="height:'+Math.max(2,Number(d.total)/max*100)+'%"></div></div><span>'+e(d.dia.slice(5))+'</span></div>').join('')+'</div>';
   root.querySelector('#alerts').innerHTML='<div class="alert-item">'+badge('Vencidos','danger')+'<strong>'+quantity(data.vencidos)+'</strong><span>Lotes con existencias</span></div><div class="alert-item">'+badge('Próximos 30 días','warning')+'<strong>'+quantity(data.por_vencer)+'</strong><span>Lotes con existencias</span></div>';
   root.querySelector('#recent').innerHTML=table(['Fecha','Tipo','Producto','Lote','Cantidad','Sede'],data.recientes.map(r=>[e(new Date(r.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})),badge(r.tipo),e(r.producto),e(r.lote),quantity(r.cantidad)+' '+e(r.unidad_medida),e(r.sede)]));
   loadError(null);
  }catch(error){loadError(error);}
 }
 await refresh();return {refresh,tables:['productos','inventario','inventario_minimos','movimientos','lotes','sedes']};
}
