import { allRows, rpc } from '../services/data.js';
import { heading, e, badge, table, pager, field, options, openEditor, notice, loadError } from '../components/ui.js';
import { expiryStatus, quantity } from '../utils/domain.js';
export async function stockPage(root, access) {
 let stock=[],lots=[],products=[],sites=[],page=0;
 const canWrite=access.rol!=='consulta';
 root.innerHTML=heading('Inventario','Existencias por producto, sede y lote. Los saldos cambian únicamente con movimientos.',canWrite?'<button class="button" id="minimum">Configurar mínimo</button><button class="button" id="new-lot">+ Nuevo lote</button><a class="button primary" href="movimientos.html">Registrar movimiento</a>':'')+
 '<div id="stock-kpis" class="kpi-grid"></div><section class="panel"><div class="toolbar"><label class="search-label">Buscar<input id="search" type="search" placeholder="Producto, código o lote…"></label><label>Sede<select id="site"></select></label><label>Mostrar<select id="filter"><option value="">Todo el inventario</option><option value="low">Bajo mínimo</option><option value="expiry">Vence en 30 días</option><option value="expired">Vencido</option></select></label><button id="refresh" class="button">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section><section class="panel"><h2>Lotes registrados</h2><p class="muted">Un lote puede distribuirse entre varias sedes. Su código y vencimiento quedan fijos para conservar el historial.</p><div id="lots"></div><p class="muted" id="lots-summary"></p></section>';
 function render(){
  const query=root.querySelector('#search').value.toLowerCase().trim(),site=root.querySelector('#site').value,filter=root.querySelector('#filter').value;
  const filtered=stock.filter(row=>{
   const status=expiryStatus(row.vencimiento);
   return (!site||String(row.sede_id)===site)&&(!query||[row.producto,row.codigo,row.lote].some(v=>String(v||'').toLowerCase().includes(query)))&&
    (!filter || (filter==='low'&&Number(row.total_sede)<Number(row.stock_minimo))||(filter==='expiry'&&status.tone==='warning'&&Number(row.cantidad)>0)||(filter==='expired'&&status.tone==='danger'&&Number(row.cantidad)>0));
  });
  page=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));
  const low=new Set(stock.filter(row=>Number(row.total_sede)<Number(row.stock_minimo)).map(row=>row.producto_id+':'+row.sede_id)).size;
  const exp=stock.filter(row=>Number(row.cantidad)>0&&['danger','warning'].includes(expiryStatus(row.vencimiento).tone)).length;
  root.querySelector('#stock-kpis').innerHTML=[['Productos con saldo',new Set(stock.filter(r=>Number(r.cantidad)>0).map(r=>r.producto_id)).size],['Sedes con inventario',new Set(stock.map(r=>r.sede_id)).size],['Producto / sede bajo mínimo',low],['Lotes / sede por revisar',exp]].map(([label,value])=>`<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong></div></div>`).join('');
  root.querySelector('#results').innerHTML=table(['Producto','Sede','Lote','Vencimiento','Existencias','Total producto / sede','Mínimo producto / sede','Estado'],filtered.slice(page*20,(page+1)*20).map(row=>{
   const status=expiryStatus(row.vencimiento);
   return [e(row.codigo)+'<br><strong>'+e(row.producto)+'</strong>',e(row.sede),e(row.lote),e(row.vencimiento),quantity(row.cantidad)+' '+e(row.unidad_medida),quantity(row.total_sede)+' '+e(row.unidad_medida),quantity(row.stock_minimo),badge(status.text,status.tone)];
  }));
  pager(root.querySelector('#pager'),filtered.length,page,20,value=>{page=value;render();});
  const displayedLots=lots.filter(row=>(!query||[row.codigo,products.find(p=>String(p.id)===String(row.producto_id))?.nombre].some(v=>String(v||'').toLowerCase().includes(query))));
  root.querySelector('#lots').innerHTML=table(['Producto','Código de lote','Vencimiento'],displayedLots.slice(0,50).map(row=>[e(products.find(p=>String(p.id)===String(row.producto_id))?.nombre||'—'),e(row.codigo),e(row.vencimiento)]));
  root.querySelector('#lots-summary').textContent='Mostrando '+Math.min(50,displayedLots.length)+' de '+displayedLots.length+' lotes. Usa el buscador para encontrar un lote.';
 }
 async function refresh(){
  try{
   const result=await Promise.all([allRows('app_stock'),allRows('lotes'),allRows('productos'),allRows('sedes')]);
   [stock,lots,products,sites]=result;
   const select=root.querySelector('#site'),value=select.value;
   select.innerHTML=options(sites,value,'Todas las sedes'); loadError(null);render();
  }catch(error){loadError(error);}
 }
 root.querySelector('#new-lot')?.addEventListener('click',()=>{
  openEditor({title:'Registrar lote',fields:field('producto_id','Producto',{required:true,choices:options(products.filter(p=>p.estado&&p.controla_inventario!==false))})+field('codigo','Código de lote',{required:true,maxLength:100})+field('vencimiento','Fecha de vencimiento',{type:'date',required:true}),save:async values=>{
   await rpc('app_crear_lote',{p_producto:values.producto_id,p_codigo:values.codigo.trim(),p_vencimiento:values.vencimiento}); notice('Lote registrado. Ahora puedes registrar su entrada.');await refresh();
  }});
 });
 root.querySelector('#minimum')?.addEventListener('click',()=>{
  openEditor({title:'Mínimo por producto y sede',fields:field('producto_id','Producto',{required:true,choices:options(products)})+field('sede_id','Sede',{required:true,choices:options(sites)})+field('minimo','Cantidad mínima',{type:'number',min:0,step:'0.001',required:true}),save:async values=>{
   await rpc('app_configurar_minimo',{p_producto:values.producto_id,p_sede:values.sede_id,p_minimo:Number(values.minimo)});notice('Mínimo actualizado.');await refresh();
  }});
 });
 for(const id of ['search','site','filter']) root.querySelector('#'+id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
 root.querySelector('#refresh').onclick=refresh;await refresh();
 return {refresh,tables:['inventario','inventario_minimos','lotes','productos','sedes']};
}
