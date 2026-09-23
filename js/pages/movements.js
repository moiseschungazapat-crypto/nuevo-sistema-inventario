import { allRows, rpc } from '../services/data.js';
import { movementPage } from '../services/movements.js';
import { heading, e, badge, table, pager, field, options, openEditor, notice, loadError } from '../components/ui.js';
import { quantity, validateMovement, csvContent } from '../utils/domain.js';
const labels={entrada:'Entrada',salida:'Salida',traslado:'Traslado',ajuste_positivo:'Ajuste (+)',ajuste_negativo:'Ajuste (−)'};
export const movementHeaders=['Fecha (Lima)','Tipo','Producto','Lote','Sede','Destino','Cantidad','Unidad','Responsable','Documento','Motivo'];
export function movementValues(row){return [new Date(row.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'}),labels[row.tipo]||row.tipo,row.producto,row.lote,row.sede,row.destino||'—',row.cantidad,row.unidad_medida,row.responsable,row.documento||'',row.motivo];}
export function downloadCsv(filename,headers,rows){
 const url=URL.createObjectURL(new Blob([csvContent(headers,rows)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function movementsPage(root,access,report=false){
 let products=[],sites=[],lots=[],stock=[],page=0,request=0;
 const canWrite=access.rol!=='consulta';
 const pendingKey='liguria-movement-'+access.user_id;
 function readPending(){try{return JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{return null;}}
 root.innerHTML=heading(report?'Reportes':'Movimientos',report?'Consulta y exporta existencias o movimientos. Fechas expresadas en hora de Lima.':'Historial auditable de entradas, salidas, traslados y ajustes por lote.',
 report?'<button class="button" id="export-stock">Exportar existencias</button><button class="button primary" id="export-movements">Exportar movimientos</button>':(canWrite?'<button class="button primary" id="new-movement">+ Registrar movimiento</button>':''))+
 '<section class="panel"><div class="toolbar filters"><label>Producto<select id="product"></select></label><label>Sede<select id="site"></select></label><label>Tipo<select id="type"><option value="">Todos</option>'+Object.entries(labels).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label><label>Desde<input type="date" id="from"></label><label>Hasta<input type="date" id="to"></label><button id="refresh" class="button">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section>';
 function filters(){
  const values={producto:root.querySelector('#product').value,sede:root.querySelector('#site').value,tipo:root.querySelector('#type').value,desde:root.querySelector('#from').value,hasta:root.querySelector('#to').value};
  if(values.desde&&values.hasta&&values.desde>values.hasta) throw new Error('La fecha inicial debe ser anterior o igual a la fecha final.');
  return values;
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
  products=products.filter(product=>product.controla_inventario!==false);
  for(const [id,rows] of [['product',products],['site',sites]]){
   const node=root.querySelector('#'+id),current=node.value;node.innerHTML=options(rows,current,'Todos');
  }
 }
 async function refreshAll(){try{await loadLookups();await refresh();}catch(error){loadError(error);}}
 async function openMovement(){
  try{await loadLookups();}catch(error){notice('No se pudieron cargar productos, sedes y lotes. Actualiza e inténtalo nuevamente.',true);return;}
  let pending=readPending();
  const data=pending?.values||{};
  const allowed=Object.entries(labels).filter(([key])=>access.rol==='administrador'||!key.startsWith('ajuste'));
  openEditor({title:pending?'Reintentar movimiento pendiente':'Registrar movimiento',fields:
   field('tipo','Tipo',{choices:allowed.map(([key,label])=>`<option value="${key}" ${key===data.tipo?'selected':''}>${label}</option>`).join('')})+
   field('producto_id','Producto',{required:true,choices:options(products.filter(p=>(p.estado||String(p.id)===data.producto_id)&&p.controla_inventario!==false),data.producto_id)})+
   field('lote_id','Lote',{required:true,choices:'',help:'Para crear un lote, utiliza Inventario → Nuevo lote.'})+
   field('sede_id','Sede (origen en traslados)',{required:true,choices:options(sites.filter(s=>s.estado||String(s.id)===data.sede_id),data.sede_id)})+
   field('destino_id','Sede de destino',{choices:options(sites.filter(s=>s.estado),data.destino_id)})+
   field('cantidad','Cantidad en la unidad base del producto',{type:'number',required:true,min:0.001,step:'0.001',value:data.cantidad||''})+
   field('documento','Documento / referencia',{value:data.documento||'',maxLength:120})+
   field('motivo','Motivo',{type:'textarea',required:true,value:data.motivo||'',maxLength:1000})+
   '<p id="available" class="muted full-width"></p>',
   setup(form){
    const product=form.elements.producto_id,lot=form.elements.lote_id,type=form.elements.tipo,site=form.elements.sede_id,destination=form.elements.destino_id;
    function fillLots(){
     const selected=lot.value||data.lote_id;
     lot.innerHTML=options(lots.filter(l=>String(l.producto_id)===product.value).sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento)),selected,'Seleccionar lote',l=>l.codigo+' · Vence '+l.vencimiento);info();
    }
    function info(){
     const row=stock.find(r=>String(r.producto_id)===product.value&&String(r.lote_id)===lot.value&&String(r.sede_id)===site.value);
     const unit=products.find(p=>String(p.id)===product.value)?.unidad_medida||'';
     form.querySelector('#available').textContent='Disponible en esta sede y lote: '+quantity(row?.cantidad||0)+' '+unit+'. El saldo se valida nuevamente al guardar.';
     destination.closest('label').hidden=type.value!=='traslado';destination.required=type.value==='traslado';
    }
    product.onchange=fillLots;lot.onchange=info;site.onchange=info;type.onchange=info;fillLots();
    if(pending){for(const control of form.querySelectorAll('input,select,textarea')) control.disabled=true;}
   },
   save:async values=>{
    if(!pending){
     const validated=validateMovement(values);
     pending={key:crypto.randomUUID(),values:validated};
     // Conservar la misma operación en reintentos y recargas. Si storage falla, no enviar.
     localStorage.setItem(pendingKey,JSON.stringify(pending));
    }
    const v=pending.values;
    try{
     await rpc('app_registrar_movimiento',{p_operacion:pending.key,p_tipo:v.tipo,p_producto:v.producto_id,p_lote:v.lote_id,p_sede:v.sede_id,p_destino:v.destino_id,p_cantidad:v.cantidad,p_documento:v.documento||'',p_motivo:v.motivo});
    }catch(error){
     if(['P0001','42501','23514','23503','22P02','22003','PGRST202'].includes(error.code)){
      localStorage.removeItem(pendingKey);pending=null;
      for(const control of document.querySelectorAll('#editor-form input,#editor-form select,#editor-form textarea'))control.disabled=false;
     }else{
      for(const control of document.querySelectorAll('#editor-form input,#editor-form select,#editor-form textarea'))control.disabled=true;
      throw new Error('No se pudo confirmar la operación. Pulsa Guardar para reintentar sin duplicarla. Si cierras, vuelve a Registrar movimiento para recuperarla.');
     }
     throw error;
    }
    localStorage.removeItem(pendingKey);pending=null;notice('Movimiento confirmado. Existencias actualizadas.');await refreshAll();
   }
  });
 }
 root.querySelector('#new-movement')?.addEventListener('click',openMovement);
 if(readPending()&&!report)notice('Tienes un movimiento pendiente de confirmación. Abre Registrar movimiento para reintentarlo.',true);
 root.querySelector('#export-movements')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{
   const current=filters();
   const rows=await rpc('app_exportar_movimientos',{p_producto:current.producto||null,p_sede:current.sede||null,p_tipo:current.tipo||null,p_desde:current.desde||null,p_hasta:current.hasta||null});
   downloadCsv('movimientos.csv',movementHeaders,rows.map(movementValues));
   notice('Reporte exportado con una lectura consistente de la base de datos.');
  }catch(error){loadError(error);}finally{button.disabled=false;}
 });
 root.querySelector('#export-stock')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{
   const current=filters();
   const rows=await rpc('app_exportar_stock',{p_producto:current.producto||null,p_sede:current.sede||null});
   downloadCsv('existencias.csv',['Producto','Código','Sede','Lote','Vencimiento','Cantidad','Unidad','Mínimo producto/sede'],rows.map(r=>[r.producto,r.codigo,r.sede,r.lote,r.vencimiento,r.cantidad,r.unidad_medida,r.stock_minimo]));
   notice('Existencias actuales exportadas. Los filtros de fechas y tipo solo aplican a movimientos.');
  }catch(error){loadError(error);}finally{button.disabled=false;}
 });
 for(const id of ['product','site','type','from','to'])root.querySelector('#'+id).onchange=()=>{page=0;refresh();};
 root.querySelector('#refresh').onclick=refreshAll;await refreshAll();
 return {refresh:refreshAll,tables:['movimientos','inventario','lotes','productos','sedes']};
}
