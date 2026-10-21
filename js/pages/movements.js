import { allRows, rpc } from '../services/data.js';
import { movementPage } from '../services/movements.js';
import { heading, e, badge, table, pager, field, options, openEditor, notice, loadError } from '../components/ui.js';
import { quantity, validateMovement } from '../utils/domain.js';
import { downloadExcelReport } from '../utils/excel-report.js';
import { operationalSite, operationalSiteError, operationalSiteLabel } from '../utils/single-site.js';
const labels={entrada:'Entrada',salida:'Salida',traslado:'Traslado',ajuste_positivo:'Ajuste (+)',ajuste_negativo:'Ajuste (−)'};
export const movementHeaders=['Fecha (Lima)','Tipo','Producto','Lote','Sede','Destino','Cantidad','Unidad','Responsable','Documento','Motivo'];
export function movementValues(row){return [new Date(row.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'}),labels[row.tipo]||row.tipo,row.producto,row.lote,row.sede,row.destino||'—',row.cantidad,row.unidad_medida,row.responsable,row.documento||'',row.motivo];}
export async function movementsPage(root,access,report=false){
 let products=[],sites=[],lots=[],stock=[],mainSite=null,page=0,request=0;
 const canWrite=access.rol!=='consulta';
 const pendingKey='liguria-movement-'+access.user_id;
 function readPending(){try{return JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{return null;}}
 root.innerHTML=heading(report?'Reportes':'Movimientos',report?'Consulta y exporta el Inventario de La Liguria y sus movimientos. Fechas expresadas en hora de Lima.':'Historial auditable de entradas, salidas y ajustes del Inventario de La Liguria.',
 report?'<button class="button" id="export-stock">Existencias en Excel</button><button class="button primary" id="export-movements">Movimientos en Excel</button>':(canWrite?'<a class="button" href="recepciones.html">Registrar recepción</a><button class="button primary" id="new-movement">+ Registrar salida</button>':''))+
 '<section class="panel"><div class="toolbar filters"><label>Producto<select id="product"></select></label><label>Sede operativa<select id="site"></select></label><label>Tipo<select id="type"><option value="">Todos</option>'+Object.entries(labels).filter(([key])=>key!=='traslado').map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label><label>Desde<input type="date" id="from"></label><label>Hasta<input type="date" id="to"></label><button id="refresh" class="button">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section>'+
 (!report&&canWrite?'<details id="other-operations" class="panel reception-optional"><summary>Otras operaciones</summary><p class="muted">Las compras y entregas de proveedores se registran en Recepciones y aparecen automáticamente en este historial. No vuelvas a registrar su entrada aquí.</p><div class="actions"><button type="button" class="button" id="manual-entry">Entrada manual excepcional</button>'+(access.rol==='administrador'?'<button type="button" class="button" id="stock-adjustment">Ajustar inventario</button>':'')+'</div><p class="muted">Las entradas manuales sirven para existencias iniciales u otros ingresos que no provienen de una recepción. Los ajustes corrigen diferencias de conteo y requieren un administrador.</p></details><div id="pending-movement"></div>':'');
 function filters(){
  const values={producto:root.querySelector('#product').value,sede:root.querySelector('#site').value,tipo:root.querySelector('#type').value,desde:root.querySelector('#from').value,hasta:root.querySelector('#to').value};
  if(values.desde&&values.hasta&&values.desde>values.hasta) throw new Error('La fecha inicial debe ser anterior o igual a la fecha final.');
  return values;
 }
 function exportFilters(current,stockOnly=false){
  const selected=id=>root.querySelector('#'+id).selectedOptions[0]?.textContent||'Todos';
  const parts=['Producto: '+selected('product'),'Sede: '+selected('site')];
  if(!stockOnly)parts.push('Tipo: '+selected('type'),'Desde: '+(current.desde||'Sin límite'),'Hasta: '+(current.hasta||'Sin límite'));
  return parts.join(' · ');
 }
 async function refresh(){
  const token=++request;
  try{
   const result=await movementPage(filters(),page);
   if(token!==request)return;
   if(page>0&&result.rows.length===0){page=0;return refresh();}
   root.querySelector('#results').innerHTML=table(movementHeaders,result.rows.map(row=>movementValues(row).map((value,index)=>index===1?badge(value,row.tipo==='entrada'?'success':row.tipo==='salida'?'warning':'neutral'):e(index===6?quantity(value):value))));
   pager(root.querySelector('#pager'),result.count,page,25,value=>{page=value;refresh();});
   loadError(null);
  }catch(error){if(token===request)loadError(error);}
 }
 async function loadLookups(){
  [products,sites,lots,stock]=await Promise.all([allRows('productos'),allRows('sedes'),allRows('lotes'),allRows('app_stock')]);
   mainSite=operationalSite(sites);
   const siteError=operationalSiteError(sites);
   if(siteError) throw new Error(siteError);
  sites=[mainSite];
   products=products.filter(product=>product.controla_inventario!==false);
   for(const [id,rows] of [['product',products],['site',sites]]){
   const node=root.querySelector('#'+id),current=id==='site'?String(mainSite.id):node.value;
   node.innerHTML=options(rows,current,id==='site'?operationalSiteLabel(mainSite):'Todos',id==='site'?operationalSiteLabel:undefined);
   if(id==='site'){node.value=String(mainSite.id);node.disabled=true;}
   }
 }
 async function refreshAll(){try{await loadLookups();await refresh();}catch(error){loadError(error);}}
 async function openMovement(mode='salida'){
  if(!canWrite || (mode==='ajuste'&&access.rol!=='administrador'))return;
  try{await loadLookups();}catch(error){notice('No se pudieron cargar productos, sedes y lotes. Actualiza e inténtalo nuevamente.',true);return;}
  let pending=readPending();
  const data=pending?.values||{};
  const movementType=data.tipo==='traslado'?'entrada':data.tipo;
  const flow=pending?(movementType?.startsWith('ajuste')?'ajuste':movementType):mode;
  const allowed=Object.entries(labels).filter(([key])=>flow==='ajuste'?key.startsWith('ajuste')&&access.rol==='administrador':key===flow);
  if(pending&&!allowed.some(([key])=>key===movementType))allowed.push([movementType,labels[movementType]||movementType]);
  const title=flow==='salida'?'Registrar salida':flow==='entrada'?'Entrada manual excepcional':'Ajustar inventario';
  const description=flow==='salida'?'Registra los productos entregados a cocina, consumidos o retirados del almacén.':flow==='entrada'?'Solo para existencias iniciales u otros ingresos excepcionales. Si el proveedor entregó una compra, regístrala en Recepciones para evitar duplicar el stock.':'Corrige una diferencia de inventario. Selecciona si debes aumentar o disminuir el saldo e indica el motivo.';
  openEditor({title:pending?'Reintentar movimiento pendiente':title,fields:
   `<p class="muted full-width">${e(description)}</p>`+
   field('tipo','Tipo',{choices:allowed.map(([key,label])=>`<option value="${key}" ${key===movementType?'selected':''}>${label}</option>`).join('')})+
   field('producto_id','Producto',{required:true,choices:options(products.filter(p=>(p.estado||String(p.id)===data.producto_id)&&p.controla_inventario!==false),data.producto_id)})+
   field('lote_id','Lote',{required:true,choices:'',help:flow==='entrada'?'Si necesitas preparar un lote, usa Recepciones → Lotes manuales (opcional).':'Selecciona el lote del que se retirarán o ajustarán las existencias.'})+
   field('cantidad','Cantidad en la unidad base del producto',{type:'number',required:true,min:0.001,step:'0.001',value:data.cantidad||''})+
   field('documento','Documento / referencia',{value:data.documento||'',maxLength:120})+
   field('motivo','Motivo',{type:'textarea',required:true,value:data.motivo||'',maxLength:1000})+
   `<p class="muted full-width">Sede de operación: ${e(operationalSiteLabel(mainSite))}</p>`+
   '<p id="available" class="muted full-width"></p>',
   setup(form){
    const product=form.elements.producto_id,lot=form.elements.lote_id,type=form.elements.tipo,siteId=String(mainSite.id);
    function fillLots(){
     const selected=lot.value||data.lote_id;
     lot.innerHTML=options(lots.filter(l=>String(l.producto_id)===product.value).sort((a,b)=>String(a.vencimiento||'9999').localeCompare(String(b.vencimiento||'9999'))),selected,'Seleccionar lote',l=>l.codigo+' · '+(l.vencimiento?'Vence '+l.vencimiento:'Sin vencimiento'));info();
    }
    function info(){
     const row=stock.find(r=>String(r.producto_id)===product.value&&String(r.lote_id)===lot.value&&String(r.sede_id)===siteId);
     const unit=products.find(p=>String(p.id)===product.value)?.unidad_medida||'';
     form.querySelector('#available').textContent='Disponible en esta sede y lote: '+quantity(row?.cantidad||0)+' '+unit+'. El saldo se valida nuevamente al guardar.';
    }
    product.onchange=fillLots;lot.onchange=info;type.onchange=info;fillLots();
    if(pending){for(const control of form.querySelectorAll('input,select,textarea')) control.disabled=true;}
   },
   save:async values=>{
    values.sede_id=String(mainSite.id);
    values.destino_id=null;
    if(!pending){
     if(!allowed.some(([key])=>key===values.tipo))throw new Error('El tipo de operación no corresponde a este formulario.');
     const validated=validateMovement(values);
     pending={key:crypto.randomUUID(),values:validated};
     // Conservar la misma operación en reintentos y recargas. Si storage falla, no enviar.
     localStorage.setItem(pendingKey,JSON.stringify(pending));
    }else{
     // Una operación pendiente creada antes del modo de sede única no puede
     // conservar un traslado ni una sede elegida manualmente.
     pending.values.sede_id=String(mainSite.id);
     pending.values.destino_id=null;
     if(pending.values.tipo==='traslado') pending.values.tipo='entrada';
     localStorage.setItem(pendingKey,JSON.stringify(pending));
    }
    showPending();
    const v=pending.values;
    try{
     await rpc('app_registrar_movimiento',{p_operacion:pending.key,p_tipo:v.tipo,p_producto:v.producto_id,p_lote:v.lote_id,p_sede:v.sede_id,p_destino:v.destino_id,p_cantidad:v.cantidad,p_documento:v.documento||'',p_motivo:v.motivo});
    }catch(error){
     if(['P0001','42501','23514','23503','22P02','22003','PGRST202'].includes(error.code)){
      localStorage.removeItem(pendingKey);pending=null;showPending();
      for(const control of document.querySelectorAll('#editor-form input,#editor-form select,#editor-form textarea'))control.disabled=false;
     }else{
      for(const control of document.querySelectorAll('#editor-form input,#editor-form select,#editor-form textarea'))control.disabled=true;
      throw new Error('No se pudo confirmar la operación. Pulsa Guardar para reintentar sin duplicarla. También puedes recuperarla desde Reintentar operación pendiente.');
     }
     throw error;
    }
    localStorage.removeItem(pendingKey);pending=null;showPending();notice('Movimiento confirmado. Existencias actualizadas.');await refreshAll();
   }
  });
 }
 function showPending(){
  const node=root.querySelector('#pending-movement');if(!node)return;
  node.innerHTML=readPending()?'<section class="panel"><p class="muted">Hay una operación pendiente de confirmación. Reinténtala antes de registrar otra.</p><button type="button" class="button" id="retry-movement">Reintentar operación pendiente</button></section>':'';
  node.querySelector('#retry-movement')?.addEventListener('click',()=>openMovement());
 }
 root.querySelector('#new-movement')?.addEventListener('click',()=>openMovement('salida'));
 root.querySelector('#manual-entry')?.addEventListener('click',()=>openMovement('entrada'));
 root.querySelector('#stock-adjustment')?.addEventListener('click',()=>openMovement('ajuste'));
 showPending();
 if(readPending()&&!report)notice('Tienes una operación pendiente. Usa Reintentar operación pendiente para confirmarla sin duplicarla.',true);
 root.querySelector('#export-movements')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{
   const current=filters();
   const rows=await rpc('app_exportar_movimientos',{p_producto:current.producto||null,p_sede:current.sede||null,p_tipo:current.tipo||null,p_desde:current.desde||null,p_hasta:current.hasta||null});
   downloadExcelReport('movimientos.xlsx',{title:'REPORTE DE MOVIMIENTOS',sheetName:'Movimientos',headers:movementHeaders,
    rows:rows.map(row=>{const values=movementValues(row);values[0]=row.fecha;return values;}),
    widths:[23,18,34,24,29,25,14,12,28,30,44],numericColumns:[6],dateColumns:{0:'datetime'},filters:exportFilters(current),
    note:'Fechas en hora de Perú. Las cantidades se muestran por producto y unidad; no se suman kilos, litros y unidades.'});
   notice('Reporte de movimientos descargado en Excel con formato.');
  }catch(error){loadError(error);}finally{button.disabled=false;}
 });
 root.querySelector('#export-stock')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{
   const current=filters();
   const rows=await rpc('app_exportar_stock',{p_producto:current.producto||null,p_sede:current.sede||null});
   downloadExcelReport('existencias.xlsx',{title:'REPORTE DE EXISTENCIAS',sheetName:'Existencias',
    headers:['Producto','Código','Sede','Lote','Vencimiento','Cantidad','Unidad','Mínimo producto/sede'],
    rows:rows.map(r=>[r.producto,r.codigo,r.sede,r.lote,r.vencimiento,r.cantidad,r.unidad_medida,r.stock_minimo]),
    widths:[36,18,30,26,19,16,14,25],numericColumns:[5,7],dateColumns:{4:'date'},filters:exportFilters(current,true),
    note:'Existencias actuales. Fechas y tipo no aplican. El mínimo corresponde al producto por sede y no se suma entre lotes.'});
   notice('Existencias actuales exportadas. Los filtros de fechas y tipo solo aplican a movimientos.');
  }catch(error){loadError(error);}finally{button.disabled=false;}
 });
 for(const id of ['product','site','type','from','to'])root.querySelector('#'+id).onchange=()=>{page=0;refresh();};
 root.querySelector('#refresh').onclick=refreshAll;await refreshAll();
 return {refresh:refreshAll,tables:['movimientos','inventario','lotes','productos','sedes']};
}
