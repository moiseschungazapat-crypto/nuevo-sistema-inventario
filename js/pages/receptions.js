import { allRows, rpc } from '../services/data.js';
import { supabase } from '../supabase.js';
import { heading, e, table, field, options, openEditor, notice, loadError } from '../components/ui.js';

const nullableNumber = value => value === '' || value == null ? null : Number(value);
const productLabel = product => `${product.codigo || 'Sin código'} · ${product.nombre}`;

export async function receptionsPage(root, access) {
 let rows = [], providers = [], products = [], sites = [], lots = [];
 const canWrite = access.rol !== 'consulta';
 root.innerHTML = heading('Recepciones','Registra compras, diferencias entre factura y entrega, datos de pago y sus comprobantes.',canWrite?'<button id="new-reception" class="button primary">+ Nueva recepción</button>':'')+'<section class="panel"><div class="toolbar"><button id="refresh" class="button">Actualizar</button></div><div id="results"></div></section>';

 function render() {
  root.querySelector('#results').innerHTML = table(['Fecha','Proveedor','Comprobante','Sede','Productos','Facturado','Recibido','Faltante','Total','Estado de pago','Adjuntos'], rows.map(r => [
   e(r.fecha_emision),e(r.proveedor),e((r.tipo_comprobante||'Factura')+' '+r.serie+'-'+r.numero),e(r.sede),e(r.productos),e(r.facturado),e(r.recibido),e(r.faltante),r.total == null ? '—' : e(`${r.moneda || 'PEN'} ${Number(r.total).toFixed(2)}`),e(r.estado_pago || 'pendiente'),r.archivos?`<button class="button" data-files="${e(r.id)}">Ver (${e(r.archivos)})</button>`:'—'
  ]));
  root.querySelectorAll('[data-files]').forEach(button => button.onclick = () => showFiles(button.dataset.files));
 }

 async function showFiles(id) {
  try {
   const {data,error}=await supabase.from('recepcion_archivos').select('ruta,nombre,tipo').eq('recepcion_id',id).order('created_at');
   if(error) throw error;
   if(!data?.length){notice('Esta recepción no tiene archivos adjuntos.',true);return;}
   const links=[];
   for(const file of data){
    const signed=await supabase.storage.from('documentos-recepcion').createSignedUrl(file.ruta,3600);
    if(signed.error) throw signed.error;
    links.push(`<li><a href="${e(signed.data.signedUrl)}" target="_blank" rel="noopener">${e(file.nombre)}</a></li>`);
   }
   const dialog=document.getElementById('editor');
   document.getElementById('editor-title').textContent='Archivos de la recepción';
   document.getElementById('editor-fields').innerHTML=`<ul class="file-list">${links.join('')}</ul>`;
   document.getElementById('editor-error').textContent='';
   document.getElementById('save-editor').hidden=true;
   document.getElementById('cancel-editor').textContent='Cerrar';
   const close=()=>{dialog.close();document.getElementById('save-editor').hidden=false;document.getElementById('cancel-editor').textContent='Cancelar';};
   document.getElementById('close-editor').onclick=close;document.getElementById('cancel-editor').onclick=close;dialog.showModal();
  }catch(error){notice(error.message||'No se pudieron abrir los archivos.',true);}
 }

 async function refresh(){
  try{
   [providers,products,sites,lots]=await Promise.all([allRows('proveedores'),allRows('productos'),allRows('sedes'),allRows('lotes')]);
   rows=await rpc('app_listar_recepciones');render();loadError(null);
  }catch(error){loadError(error);}
 }

 function line(i,required=false){
  return `<div class="reception-line" data-reception-line data-index="${i}">
   ${field('producto_'+i,'Producto',{required,choices:options(products.filter(p=>p.estado),'', 'Seleccionar…',productLabel)})}
   ${field('lote_'+i,'Lote',{choices:'<option value="">No aplica / seleccionar</option>'})}
   ${field('facturada_'+i,'Facturada',{type:'number',required,min:required?0.001:0,step:'0.001'})}
   ${field('recibida_'+i,'Recibida',{type:'number',required,min:0,step:'0.001'})}
   ${field('unidad_'+i,'Unidad',{required,value:'unidad'})}
   ${field('precio_'+i,'Precio unitario',{type:'number',min:0,step:'0.0001'})}
   <button type="button" class="button line-remove" data-remove-line ${required?'hidden':''}>Quitar</button>
  </div>`;
 }

 function syncLine(lineNode){
  const product=lineNode.querySelector('[name^="producto_"]');
  const lot=lineNode.querySelector('[name^="lote_"]');
  const unit=lineNode.querySelector('[name^="unidad_"]');
  const row=products.find(p=>String(p.id)===product.value);
  const selected=lot.value;
  lot.innerHTML=options(row ? lots.filter(l=>String(l.producto_id)===String(row.id)).sort((a,b)=>String(a.vencimiento).localeCompare(String(b.vencimiento))) : [],selected,'No aplica / seleccionar',l=>`${l.codigo} · Vence ${l.vencimiento}`);
  if(row){
   unit.value=row.unidad_medida||'unidad';
   lot.disabled=row.controla_inventario===false;
   if(row.controla_inventario===false) lot.value='';
   lot.closest('label').querySelector('small')?.remove();
   if(row.controla_inventario!==false){const help=document.createElement('small');help.textContent=row.requiere_lote===false?'Lote opcional para este producto.':'Obligatorio si se recibe una cantidad mayor que cero.';lot.closest('label').append(help);}
  }else{lot.disabled=false;}
 }

 function openReception(){
  openEditor({
   title:'Nueva recepción',
   fields:
    field('proveedor_id','Proveedor',{required:true,choices:options(providers.filter(p=>p.estado))})+
    field('tipo_comprobante','Comprobante',{choices:'<option>Factura</option><option>Boleta</option><option>Guía</option><option>Nota de crédito</option><option>Otro</option>'})+
    field('serie','Serie',{required:true,maxLength:10})+field('numero','Número',{required:true,maxLength:30})+
    field('fecha_emision','Fecha de emisión',{type:'date',required:true,value:new Date().toISOString().slice(0,10)})+
    field('fecha_recepcion','Fecha de recepción',{type:'date',required:true,value:new Date().toISOString().slice(0,10)})+
    field('sede_id','Sede de destino',{required:true,choices:options(sites.filter(s=>s.estado))})+
    field('responsable','Responsable de recepción',{required:true,maxLength:150})+
    field('moneda','Moneda',{choices:'<option value="PEN">PEN (S/)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>'})+
    field('forma_pago','Forma de pago',{choices:'<option value="">No indicado</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Crédito</option><option>Yape / Plin</option><option>Otro</option>'})+
    field('condicion_pago','Condición de pago',{value:'',maxLength:120,help:'Ejemplo: contado, crédito 45 días.'})+
    field('fecha_vencimiento_pago','Vencimiento de pago',{type:'date'})+
    field('guia_remision','Guía de remisión',{maxLength:60})+field('orden_compra','Orden de compra',{maxLength:60})+
    field('subtotal','Subtotal',{type:'number',min:0,step:'0.01'})+field('descuento','Descuento',{type:'number',min:0,step:'0.01'})+
    field('igv','IGV',{type:'number',min:0,step:'0.01'})+field('total','Total del comprobante',{type:'number',min:0,step:'0.01'})+
    field('estado_pago','Estado de pago',{choices:'<option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option>'})+
    field('detraccion_porcentaje','Detracción %',{type:'number',min:0,step:'0.01'})+field('detraccion_monto','Detracción monto',{type:'number',min:0,step:'0.01'})+
    '<p class="muted full-width">Agrega los productos de la misma factura con el botón +. Servicios, equipos y gastos se guardan en el historial sin aumentar existencias.</p><div id="reception-lines" class="full-width">'+line(0,true)+'</div>'+
    '<button type="button" id="add-reception-line" class="button full-width">+ Agregar producto</button>'+field('observaciones','Observaciones',{type:'textarea',maxLength:1000})+
    '<label class="field full-width">Fotos o PDF de la factura<input name="archivos" type="file" accept="image/jpeg,image/png,application/pdf" multiple><small>Máximo 10 MB por imagen y 15 MB por PDF.</small></label>',
   setup:form=>{
    let next=1;const list=form.querySelector('#reception-lines');
    syncLine(list.querySelector('[data-reception-line]'));
    form.addEventListener('change',event=>{if(event.target.name?.startsWith('producto_'))syncLine(event.target.closest('[data-reception-line]'));});
    form.querySelector('#add-reception-line').onclick=()=>{if(next>=50){notice('Se alcanzó el máximo de 50 productos por recepción.',true);return;}list.insertAdjacentHTML('beforeend',line(next));syncLine(list.lastElementChild);next++;};
    list.onclick=event=>{const button=event.target.closest('[data-remove-line]');if(button)button.closest('[data-reception-line]').remove();};
   },
   save:async values=>{
    const detalles=[];
    for(let i=0;i<50;i++){
     const p=values['producto_'+i];if(!p)continue;
     const product=products.find(row=>String(row.id)===String(p));
     const f=Number(values['facturada_'+i]),r=Number(values['recibida_'+i]);
     if(!product||!Number.isFinite(f)||!Number.isFinite(r)||f<=0||r<0||r>f)throw new Error('Revisa producto y cantidades en las líneas de la recepción.');
     if(product.controla_inventario!==false&&r>0&&!values['lote_'+i])throw new Error(`Selecciona el lote de ${product.nombre}; lo recibido debe quedar trazable.`);
     detalles.push({producto_id:p,lote_id:product.controla_inventario===false?null:(values['lote_'+i]||null),cantidad_facturada:f,cantidad_recibida:r,unidad:(values['unidad_'+i]||product.unidad_medida||'unidad').trim(),precio_unitario:nullableNumber(values['precio_'+i])});
    }
    if(!detalles.length)throw new Error('Agrega al menos un producto.');
    const rid=await rpc('app_registrar_recepcion',{p_recepcion:{proveedor_id:values.proveedor_id,tipo_comprobante:values.tipo_comprobante,serie:values.serie.trim(),numero:values.numero.trim(),fecha_emision:values.fecha_emision,fecha_recepcion:values.fecha_recepcion,sede_id:values.sede_id,responsable:values.responsable.trim(),moneda:values.moneda,forma_pago:values.forma_pago||null,condicion_pago:values.condicion_pago?.trim()||null,fecha_vencimiento_pago:values.fecha_vencimiento_pago||null,guia_remision:values.guia_remision?.trim()||null,orden_compra:values.orden_compra?.trim()||null,subtotal:nullableNumber(values.subtotal),descuento:nullableNumber(values.descuento),igv:nullableNumber(values.igv),total:nullableNumber(values.total),estado_pago:values.estado_pago,detraccion_porcentaje:nullableNumber(values.detraccion_porcentaje),detraccion_monto:nullableNumber(values.detraccion_monto),observaciones:values.observaciones||'',detalles}});
    const files=values.__form.elements.archivos.files;
    for(const file of files){const max=file.type==='application/pdf'?15:10;if(file.size>max*1024*1024)throw new Error('Un archivo supera el límite permitido.');const path=`${rid}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const upload=await supabase.storage.from('documentos-recepcion').upload(path,file,{upsert:false,contentType:file.type});if(upload.error)throw upload.error;const saved=await supabase.from('recepcion_archivos').insert({recepcion_id:rid,ruta:path,nombre:file.name,tipo:file.type,tamano:file.size});if(saved.error)throw saved.error;}
    notice('Recepción guardada; las existencias solo aumentaron para productos de stock.');await refresh();
   }
  });
 }
 root.querySelector('#new-reception')?.addEventListener('click',openReception);root.querySelector('#refresh').onclick=refresh;await refresh();
 return {refresh,tables:['recepciones','recepcion_detalles','recepcion_archivos','proveedor_productos','inventario','movimientos','productos','proveedores','sedes','lotes']};
}
