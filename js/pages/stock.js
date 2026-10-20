import { allRows, rpc } from '../services/data.js';
import { heading, e, badge, table, pager, options, notice, loadError } from '../components/ui.js';
import { expiryStatus, quantity, todayLima } from '../utils/domain.js';
import { summarizeInventory, inventoryStatus, filterInventory } from '../utils/inventory.js';
import { downloadExcelReport } from '../utils/excel-report.js';
import { operationalSite, operationalSiteError, operationalSiteLabel } from '../utils/single-site.js';

export async function stockPage(root) {
 let stock=[],products=[],minimums=[],categories=[],mainSite=null,page=0,detailId=null;
 root.innerHTML=heading('Inventario de La Liguria','Stock actual por producto. Consulta los lotes desde Ver.','<button class="button primary" id="export-daily-stock">Descargar inventario diario</button>')+
 '<div id="stock-kpis" class="kpi-grid"></div><section class="panel"><div class="toolbar"><label class="search-label">Buscar<input id="search" type="search" placeholder="Producto, código, categoría o lote…"></label><label>Sede operativa<select id="site" disabled></select></label><label>Mostrar<select id="filter"><option value="">Todo el inventario</option><option value="alerts">Solo alertas</option><option value="empty">Sin stock</option><option value="low">Stock bajo</option><option value="expiry">Vence en 30 días</option><option value="expired">Vencido</option></select></label><button id="only-alerts" class="button" aria-pressed="false">Solo alertas</button><button id="refresh" class="button">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section>'+
 '<dialog id="stock-detail" aria-labelledby="stock-detail-title"><header class="dialog-header"><h2 id="stock-detail-title"></h2><button type="button" class="button icon-only" id="close-stock-detail" aria-label="Cerrar detalle">×</button></header><div id="stock-detail-content"></div><footer class="dialog-footer"><button class="button" id="done-stock-detail">Cerrar</button></footer></dialog>';
 const dialog=root.querySelector('#stock-detail');
 const close=()=>{detailId=null;dialog.close();};
 root.querySelector('#close-stock-detail').onclick=close;root.querySelector('#done-stock-detail').onclick=close;
 dialog.oncancel=()=>{detailId=null;};
 const currentFilters=()=>({query:root.querySelector('#search').value.toLocaleLowerCase().trim(),filter:root.querySelector('#filter').value});
 const summary=(rows=stock,ps=products,ms=minimums,cs=categories)=>summarizeInventory(ps,rows,ms,cs,mainSite.id);
 function detail() {
  const row=summary().find(r=>r.producto_id===detailId);if(!row){close();return;}
  root.querySelector('#stock-detail-title').textContent=row.codigo+' · '+row.producto;
  const status=inventoryStatus(row),lots=[...row.lotes].sort((a,b)=>String(a.vencimiento||'').localeCompare(String(b.vencimiento||'')));
  root.querySelector('#stock-detail-content').innerHTML=`<p class="muted">${e(operationalSiteLabel(mainSite))} · Stock actual: <strong>${quantity(row.cantidad)} ${e(row.unidad_medida)}</strong> · Mínimo: ${quantity(row.stock_minimo)} ${e(row.unidad_medida)} ${badge(status.text,status.tone)}</p>`+
   table(['Lote','Vencimiento','Existencias','Unidad','Estado'],lots.map(l=>{const state=expiryStatus(l.vencimiento);return [e(l.lote),e(l.vencimiento),quantity(l.cantidad),e(row.unidad_medida),badge(state.text,state.tone)];}),'Este producto todavía no tiene existencias registradas por lote.');
 }
 function render(){
  const rows=summary(),filtered=filterInventory(rows,currentFilters());
  const expired=stock.filter(r=>Number(r.cantidad)>0&&['danger','warning'].includes(expiryStatus(r.vencimiento).tone)).length;
  root.querySelector('#stock-kpis').innerHTML=[['Productos con saldo',rows.filter(r=>r.cantidad>0).length],['Sin stock',rows.filter(r=>r.cantidad<=0).length],['Stock bajo',rows.filter(r=>r.cantidad>0&&r.cantidad<r.stock_minimo).length],['Lotes por revisar',expired]].map(([label,value])=>`<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong></div></div>`).join('');
  page=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));
  root.querySelector('#results').innerHTML=table(['Código','Producto','Unidad','Categoría','Stock mínimo','Stock actual','Estado','Acciones'],filtered.slice(page*20,(page+1)*20).map(row=>{
   const state=inventoryStatus(row);
   return [e(row.codigo),e(row.producto),e(row.unidad_medida),e(row.categoria),quantity(row.stock_minimo),quantity(row.cantidad),badge(state.text,state.tone),`<button type="button" class="button small" data-stock-detail="${e(row.producto_id)}">Ver</button>`];
  }));
  root.querySelectorAll('[data-stock-detail]').forEach(button=>button.onclick=()=>{detailId=button.dataset.stockDetail;detail();dialog.showModal();});
  root.querySelectorAll('#results tbody tr').forEach((tr,index)=>{
   const row=filtered[page*20+index];if(row)tr.classList.add(row.cantidad<=0?'inventory-empty':row.cantidad<row.stock_minimo?'inventory-low':'inventory-normal');
  });
  root.querySelector('#only-alerts').setAttribute('aria-pressed',String(root.querySelector('#filter').value==='alerts'));
  pager(root.querySelector('#pager'),filtered.length,page,20,value=>{page=value;render();});
  if(dialog.open)detail();
 }
 async function refresh(){
  try{
   const loaded=await Promise.all([allRows('app_stock'),allRows('productos'),allRows('inventario_minimos'),allRows('categorias'),allRows('sedes')]);
   const site=operationalSite(loaded[4]);if(!site)throw new Error(operationalSiteError(loaded[4]));
   [stock,products,minimums,categories]=loaded;mainSite=site;stock=stock.filter(r=>String(r.sede_id)===String(site.id));
   root.querySelector('#site').innerHTML=options([site],String(site.id),operationalSiteLabel(site),operationalSiteLabel);
   root.querySelector('#site').value=String(site.id);loadError(null);render();
  }catch(error){loadError(error);}
 }
 root.querySelector('#export-daily-stock').onclick=async event=>{
  const button=event.currentTarget;if(button.disabled)return;button.disabled=true;button.textContent='Preparando Excel…';
  try{
   if(!mainSite)throw new Error('Actualiza el inventario antes de descargar el reporte.');
   const selected=currentFilters(),displayFilter=root.querySelector('#filter').selectedOptions[0].textContent;
   const [rows,ps,ms,cs]=await Promise.all([rpc('app_exportar_stock',{p_producto:null,p_sede:String(mainSite.id)}),allRows('productos'),allRows('inventario_minimos'),allRows('categorias')]);
   const now=new Date(),day=todayLima(),filtered=filterInventory(summary(rows,ps,ms,cs),selected,day);
   downloadExcelReport('inventario-diario-'+day+'.xlsx',{
    title:'INVENTARIO DIARIO · '+day.split('-').reverse().join('/'),sheetName:'Inventario diario',now,
    headers:['Código','Producto','Unidad','Categoría','Stock mínimo','Stock actual','Estado'],
    rows:filtered.map(r=>[r.codigo,r.producto,r.unidad_medida,r.categoria,r.stock_minimo,r.cantidad,inventoryStatus(r).text]),
    widths:[18,36,16,28,20,20,22],numericColumns:[4,5],
    filters:'Sede: '+operationalSiteLabel(mainSite)+' · Mostrar: '+displayFilter+(selected.query?' · Búsqueda: '+selected.query:''),
    note:'Existencias al momento de la descarga. Una fila por producto, incluidos los productos sin stock. Incluye todas las páginas filtradas.',
   });notice('Inventario diario descargado en Excel: '+filtered.length+' productos.');
  }catch(error){notice(error.message||'No se pudo descargar el inventario diario.',true);}
  finally{button.disabled=false;button.textContent='Descargar inventario diario';}
 };
 for(const id of ['search','filter'])root.querySelector('#'+id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
 root.querySelector('#only-alerts').onclick=()=>{root.querySelector('#filter').value=root.querySelector('#filter').value==='alerts'?'':'alerts';page=0;render();};
 root.querySelector('#refresh').onclick=refresh;await refresh();
 return {refresh,tables:['inventario','inventario_minimos','lotes','productos','categorias','sedes']};
}
