import { allRows, rpc } from '../services/data.js';
import { supabase } from '../supabase.js';
import { heading, e, table, field, options, openEditor, notice, loadError } from '../components/ui.js';
import { operationalSite, operationalSiteError, operationalSiteLabel } from '../utils/single-site.js';
import { analyzeInvoiceLocally } from '../services/local-ocr.js';
import { confirmAction } from '../components/confirmation.js';
import { createLot } from '../components/inventory-settings.js';

const nullableNumber = value => value === '' || value == null ? null : Number(value);
const productLabel = product => `${product.codigo || 'Sin código'} · ${product.nombre}`;
const limaToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const limaDateTime = value => value ? new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)) : '—';
const normalizeText = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const normalizeDigits = value => String(value || '').replace(/\D/g,'');
const cleanFileName = value => String(value || 'factura').replace(/[^a-zA-Z0-9._-]/g,'_');
const fileMime = file => file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : /\.jpe?g$|\.jfif$/i.test(file.name) ? 'image/jpeg' : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : '');

export async function receptionsPage(root, access) {
 let rows = [], providers = [], products = [], sites = [], lots = [], mainSite = null;
 const canWrite = access.rol !== 'consulta';
 root.innerHTML = heading('Recepciones','Registra compras para el Inventario de La Liguria, diferencias entre factura y entrega, datos de pago y sus comprobantes.',canWrite?'<button id="new-reception" class="button primary">+ Nueva recepción</button>':'')+'<section class="panel"><div class="toolbar"><button id="refresh" class="button">Actualizar</button></div><div id="results"></div></section>';

 function render() {
  root.querySelector('#results').innerHTML = table(['Emisión','Recepción','Registrado (Lima)','Proveedor','Comprobante','Sede de recepción','Productos','Facturado','Recibido','Faltante','Total','Estado de pago','Adjuntos'], rows.map(r => [
   e(r.fecha_emision),e(r.fecha_recepcion || r.fecha_emision),e(limaDateTime(r.created_at)),e(r.proveedor),e((r.tipo_comprobante||'Factura')+' '+r.serie+'-'+r.numero),e(r.sede),e(r.productos),e(r.facturado),e(r.recibido),e(r.faltante),r.total == null ? '—' : e(`${r.moneda || 'PEN'} ${Number(r.total).toFixed(2)}`),e(r.estado_pago || 'pendiente'),r.archivos?`<button class="button" data-files="${e(r.id)}">Ver (${e(r.archivos)})</button>`:'—'
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
   dialog.oncancel=event=>{event.preventDefault();close();};
   document.getElementById('close-editor').onclick=close;document.getElementById('cancel-editor').onclick=close;dialog.showModal();
  }catch(error){notice(error.message||'No se pudieron abrir los archivos.',true);}
 }

 async function refresh(){
 try{
   [providers,products,sites,lots]=await Promise.all([allRows('proveedores'),allRows('productos'),allRows('sedes'),allRows('lotes')]);
   mainSite=operationalSite(sites);
   const siteError=operationalSiteError(sites);
   if(siteError) throw new Error(siteError);
   rows=await rpc('app_listar_recepciones');render();loadError(null);
  }catch(error){loadError(error);}
 }

 function line(i,required=false){
  return `<div class="reception-line" data-reception-line data-index="${i}">
   ${field('producto_'+i,'Producto',{required,choices:options(products.filter(p=>p.estado),'', 'Seleccionar…',productLabel),help:'Producto tal como aparece en la factura.'})}
   ${field('recibida_'+i,'Cantidad recibida',{type:'number',required,min:0,step:'0.001',help:'Cantidad que llegó físicamente.'})}
   <div class="reception-expiry">${field('caducidad_'+i,'Vencimiento',{choices:'<option value="fecha">Tiene vencimiento</option><option value="ninguno">Sin vencimiento</option>'})}${field('vencimiento_'+i,'Fecha de vencimiento',{type:'date'})}</div>
   ${field('unidad_'+i,'Unidad',{required,value:'unidad',help:'Se completa desde el catálogo.'})}
   <details class="reception-line-extra reception-optional"><summary>Lote y datos de factura (opcional)</summary><div class="form-grid">
    ${field('codigo_lote_'+i,'Lote del proveedor (opcional)',{maxLength:100,help:'Si lo dejas vacío, el sistema genera un código interno.'})}
    ${field('lote_'+i,'Usar un lote existente (opcional)',{choices:'<option value="">Crear automáticamente al guardar</option>',help:'Solo si esta entrega pertenece a un lote registrado.'})}
    ${field('facturada_'+i,'Cantidad facturada (opcional)',{type:'number',min:0.001,step:'0.001',help:'Si no se indica, se toma igual a la recibida. Completa este dato si hubo faltantes.'})}
    ${field('precio_'+i,'Precio unitario (opcional)',{type:'number',min:0,step:'0.0001'})}
   </div></details>
   <button type="button" class="button line-remove" data-remove-line ${required?'hidden':''}>Quitar</button>
  </div>`;
 }

 function syncLine(lineNode){
  const product=lineNode.querySelector('[name^="producto_"]');
  const lot=lineNode.querySelector('[name^="lote_"]');
  const unit=lineNode.querySelector('[name^="unidad_"]'),expiry=lineNode.querySelector('[name^="vencimiento_"]'),mode=lineNode.querySelector('[name^="caducidad_"]'),code=lineNode.querySelector('[name^="codigo_lote_"]');
  const row=products.find(p=>String(p.id)===product.value);
  const changed=lineNode.dataset.product!==product.value;
  if(changed){lot.value='';code.value='';expiry.value='';mode.value='fecha';lineNode.dataset.product=product.value;}
  const selected=lot.value;
  lot.innerHTML=options(row ? lots.filter(l=>String(l.producto_id)===String(row.id)).sort((a,b)=>String(a.vencimiento||'9999').localeCompare(String(b.vencimiento||'9999'))) : [],selected,'Crear automáticamente al guardar',l=>`${l.codigo} · ${l.vencimiento?'Vence '+l.vencimiento:'Sin vencimiento'}`);
  const existing=lots.find(l=>String(l.id)===lot.value);
  if(existing){expiry.value=existing.vencimiento||'';mode.value=existing.vencimiento?'fecha':'ninguno';}
  const controls=Boolean(row&&row.controla_inventario!==false);
  lot.disabled=!controls;code.disabled=!controls||Boolean(existing);mode.disabled=!controls||Boolean(existing)||Boolean(row?.es_perecible);
  if(row?.es_perecible)mode.value='fecha';
  expiry.disabled=!controls||Boolean(existing)||mode.value==='ninguno';
  expiry.required=controls&&!existing&&mode.value==='fecha'&&Number(lineNode.querySelector('[name^="recibida_"]').value)>0;
  expiry.closest('label').hidden=mode.value==='ninguno'||!controls;
  lineNode.querySelector('.reception-expiry').hidden=!controls;
  unit.readOnly=true;
  if(row){
   unit.value=row.unidad_medida||'unidad';
  }
 }

 function openReception(){
  if(!mainSite){notice(operationalSiteError(sites)||'Configura la sede de operación antes de registrar una recepción.',true);return;}
  const operationId=crypto.randomUUID();const uploaded=new Map();
  function setValue(form,name,value){
   if(value===null||value===undefined||value==='')return;
   const control=form.elements.namedItem(name);
   if(control)control.value=String(value);
  }
  function providerMatch(provider){
   const ruc=normalizeDigits(provider?.ruc);
   const name=normalizeText(provider?.name);
   if(ruc){const exact=providers.find(row=>normalizeDigits(row.documento)===ruc);if(exact)return exact;}
   if(name){const exact=providers.find(row=>normalizeText(row.nombre)===name);if(exact)return exact;const partial=providers.filter(row=>normalizeText(row.nombre).includes(name)||name.includes(normalizeText(row.nombre)));if(partial.length===1)return partial[0];}
   return null;
  }
  function productMatch(item){
   const code=normalizeText(item?.code);
   const name=normalizeText(item?.name||item?.description);
   if(code){const exact=products.find(row=>normalizeText(row.codigo)===code||normalizeText(row.codigo_barras)===code);if(exact)return exact;}
   if(name){const exact=products.find(row=>normalizeText(row.nombre)===name);if(exact)return exact;const partial=products.filter(row=>normalizeText(row.nombre).includes(name)||name.includes(normalizeText(row.nombre)));if(partial.length===1)return partial[0];}
   return null;
  }
  function applyAnalysis(form,extraction){
   const warnings=Array.isArray(extraction?.warnings)?[...extraction.warnings]:[];
   const provider=providerMatch(extraction?.provider);
   if(provider)setValue(form,'proveedor_id',provider.id);else if(extraction?.provider?.name||extraction?.provider?.ruc)warnings.push('No se encontró una coincidencia exacta para el proveedor; selecciónalo manualmente.');
   const document=extraction?.document||{};
   const type=normalizeText(document.type);
   const typeValue=type.includes('boleta')?'Boleta':type.includes('guia')?'Guía':type.includes('credito')?'Nota de crédito':type.includes('factura')?'Factura':'';
   if(typeValue)setValue(form,'tipo_comprobante',typeValue);
   setValue(form,'serie',document.series);setValue(form,'numero',document.number);setValue(form,'fecha_emision',document.issue_date);
   const currency=String(document.currency||'').toUpperCase();
   if(['PEN','USD','EUR'].includes(currency))setValue(form,'moneda',currency);
   setValue(form,'guia_remision',document.guide_number);setValue(form,'orden_compra',document.purchase_order);
   const payment=extraction?.payment||{};
   const paymentText=normalizeText(payment.method);
   const paymentValue=['Efectivo','Transferencia','Tarjeta','Crédito','Yape / Plin'].find(value=>normalizeText(value)===paymentText);
   if(paymentValue)setValue(form,'forma_pago',paymentValue);else if(payment.method)warnings.push('La forma de pago detectada no coincide con una opción; revísala manualmente.');
   setValue(form,'condicion_pago',payment.condition);setValue(form,'fecha_vencimiento_pago',payment.due_date);
   const paymentStatus=normalizeText(payment.status);
   if(paymentStatus.includes('pagado'))setValue(form,'estado_pago','pagado');else if(paymentStatus.includes('parcial'))setValue(form,'estado_pago','parcial');else if(paymentStatus.includes('pendiente'))setValue(form,'estado_pago','pendiente');
   const totals=extraction?.totals||{};
   setValue(form,'subtotal',totals.subtotal);setValue(form,'descuento',totals.discount);setValue(form,'igv',totals.tax);setValue(form,'total',totals.total);setValue(form,'detraccion_porcentaje',totals.withholding_percent);setValue(form,'detraccion_monto',totals.withholding_amount);
   const items=Array.isArray(extraction?.items)?extraction.items.filter(item=>item&&((item.name||item.code)||item.quantity_invoiced!=null)):[];
   while(form.querySelectorAll('[data-reception-line]').length<items.length)form.__addReceptionLine?.();
   const lines=[...form.querySelectorAll('[data-reception-line]')];
   let matched=0;
   items.forEach((item,index)=>{
    const node=lines[index];if(!node)return;
    const product=productMatch(item);const productControl=node.querySelector('[name^="producto_"]');
    if(product){productControl.value=String(product.id);syncLine(node);matched++;}else if(item.name||item.code)warnings.push('No se encontró en el catálogo: '+(item.name||item.code)+'.');
    setValue(form,'facturada_'+node.dataset.index,item.quantity_invoiced);
    if(product&&item.lot_code){
     const lot=lots.find(row=>String(row.producto_id)===String(product.id)&&normalizeText(row.codigo)===normalizeText(item.lot_code));
     if(lot)setValue(form,'lote_'+node.dataset.index,lot.id);else setValue(form,'codigo_lote_'+node.dataset.index,item.lot_code);
    }
    if(item.expiration_date){setValue(form,'caducidad_'+node.dataset.index,'fecha');setValue(form,'vencimiento_'+node.dataset.index,item.expiration_date);}
    syncLine(node);
    if(product)setValue(form,'unidad_'+node.dataset.index,product.unidad_medida);
    else if(item.unit)warnings.push('Confirma la unidad del producto '+(item.name||item.code||'detectado')+'.');
    setValue(form,'precio_'+node.dataset.index,item.unit_price);
   });
   return { matched, totalItems:items.length, warnings };
  }
  async function analyzeInvoice(form){
   const files=[...form.elements.archivos.files];const status=form.querySelector('#reception-ai-status');const button=form.querySelector('#analyze-reception-invoice');
   const preview=form.querySelector('#reception-ocr-preview');const previewText=form.querySelector('#reception-ocr-text');
   if(!files.length){notice('Adjunta una imagen antes de analizar la factura.',true);return;}
   if(files.length>6){notice('Puedes analizar hasta 6 imágenes a la vez.',true);return;}
   try{
    button.disabled=true;status.textContent='Cargando OCR gratuito…';
    for(const file of files){const mime=fileMime(file);const max=mime==='application/pdf'?15:10;if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('El análisis gratuito acepta imágenes JPG, PNG o WEBP.');if(file.size>max*1024*1024)throw new Error('Un archivo supera el límite permitido.');}
    const result=await analyzeInvoiceLocally(files,{providers,products,onProgress:(progress,index,total)=>{status.textContent=total?`Leyendo imagen ${index} de ${total}… ${progress}%`:`Leyendo factura… ${progress}%`;}});
    if(previewText){previewText.textContent=result.text;preview.hidden=false;}
    const summary=applyAnalysis(form,result.extraction);
    const warningText=summary.warnings.length?' Revisa '+summary.warnings.length+' aviso(s).':'';
    status.textContent='Lectura gratuita completada: '+summary.matched+' producto(s) coincidieron con el catálogo.'+warningText;
    notice('Formulario prellenado con OCR local. Revisa todos los datos antes de guardar.');
   }catch(error){
    let rawMessage=error?.message||'';
    try{
     if(error?.context?.json){const body=await error.context.json();if(body?.error)rawMessage=body.error;}
    }catch{}
    const message=/row-level-security|violates row-level security/i.test(rawMessage)
     ? 'Supabase bloqueó la carga del archivo. Revisa la política RLS del bucket documentos-recepcion.'
      : rawMessage||'No se pudo analizar la factura.';
    status.textContent=message;
    notice(message,true);
   }
   finally{button.disabled=false;}
  }
  openEditor({
   title:'Nueva recepción',
   fields:
    field('proveedor_id','Proveedor',{required:true,choices:options(providers.filter(p=>p.estado)),help:'Empresa que emitió la factura.'})+
    field('tipo_comprobante','Comprobante',{choices:'<option>Factura</option><option>Boleta</option><option>Guía</option><option>Nota de crédito</option><option>Otro</option>',help:'Tipo de documento recibido.'})+
    field('serie','Serie',{required:true,maxLength:10,help:'Serie impresa. Ejemplo: F001.'})+field('numero','Número',{required:true,maxLength:30,help:'Número correlativo del documento.'})+
     field('fecha_emision','Fecha de emisión',{type:'date',required:true,value:limaToday(),help:'Fecha impresa en la factura.'})+
     field('fecha_recepcion','Fecha de recepción',{type:'date',required:true,value:limaToday(),help:'Día en que llegó el pedido.'})+
     field('responsable','Responsable de recepción',{required:true,maxLength:150,value:access.nombre||'',help:'Persona que verificó y recibió el pedido.'})+
     '<p class="muted full-width">La hora exacta del servidor se guardará automáticamente al confirmar la recepción.</p>'+
     `<p class="muted full-width">Sede de recepción: ${e(operationalSiteLabel(mainSite))}</p>`+
     '<details class="reception-optional full-width"><summary>Detalles comerciales opcionales</summary><div class="form-grid">'+
      field('moneda','Moneda',{choices:'<option value="PEN">PEN (S/)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>',help:'Moneda indicada en el comprobante.'})+
      field('forma_pago','Forma de pago',{choices:'<option value="">No indicado</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Crédito</option><option>Yape / Plin</option><option>Otro</option>',help:'Cómo se pagó o se pagará.'})+
      field('condicion_pago','Condición de pago',{value:'',maxLength:120,help:'Ejemplo: contado, crédito 45 días.'})+
      field('fecha_vencimiento_pago','Vencimiento de pago',{type:'date',help:'Solo si la compra fue al crédito.'})+
      field('guia_remision','Guía de remisión',{maxLength:60,help:'Número de guía, si existe.'})+field('orden_compra','Orden de compra',{maxLength:60,help:'Orden interna, si existe.'})+
      field('subtotal','Subtotal',{type:'number',min:0,step:'0.01',help:'Importe antes del IGV y descuentos.'})+field('descuento','Descuento',{type:'number',min:0,step:'0.01',help:'Descuento indicado en la factura.'})+
      field('igv','IGV',{type:'number',min:0,step:'0.01',help:'Impuesto indicado en la factura.'})+field('total','Total del comprobante',{type:'number',min:0,step:'0.01',help:'Total final del comprobante.'})+
      field('estado_pago','Estado de pago',{choices:'<option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option>',help:'Situación actual del pago.'})+
      field('detraccion_porcentaje','Detracción %',{type:'number',min:0,step:'0.01',help:'Porcentaje, solo si corresponde.'})+field('detraccion_monto','Detracción monto',{type:'number',min:0,step:'0.01',help:'Importe retenido por detracción.'})+
      field('observaciones','Observaciones',{type:'textarea',maxLength:1000,help:'Diferencias o comentarios de la recepción.'})+'</div></details>'+
     '<p class="muted full-width">Registra qué llegó, cuánto recibiste y cuándo vence. Los lotes y las entradas se crean al guardar. Agrega todos los productos de la misma entrega con el botón +.</p><div id="reception-lines" class="full-width">'+line(0,true)+'</div>'+
     '<button type="button" id="add-reception-line" class="button full-width">+ Agregar producto</button>'+
     '<label class="field full-width">Factura o comprobante (recomendado)<input name="archivos" type="file" accept="image/jpeg,image/png,image/webp,.jfif,application/pdf" multiple><small>Puedes adjuntar imágenes o PDF. El análisis gratuito acepta JPG, PNG y WEBP; el PDF se guarda, pero debes convertirlo a imagen para leerlo.</small></label>'+
     '<div class="full-width reception-ai-actions"><button type="button" id="analyze-reception-invoice" class="button">Analizar factura gratis (OCR)</button><span id="reception-ai-status" class="muted" role="status" aria-live="polite"></span></div>'+
     '<details id="reception-ocr-preview" class="reception-ocr-preview full-width" hidden><summary>Ver texto leído por el OCR</summary><pre id="reception-ocr-text"></pre></details>',
   setup:form=>{
    let next=1;const list=form.querySelector('#reception-lines');
    syncLine(list.querySelector('[data-reception-line]'));
    form.onchange=event=>{const node=event.target.closest('[data-reception-line]');if(node)syncLine(node);};
    form.__addReceptionLine=()=>{if(next>=50){notice('Se alcanzó el máximo de 50 productos por recepción.',true);return null;}list.insertAdjacentHTML('beforeend',line(next));syncLine(list.lastElementChild);next++;return list.lastElementChild;};
    form.querySelector('#add-reception-line').onclick=form.__addReceptionLine;
    form.querySelector('#analyze-reception-invoice').onclick=()=>analyzeInvoice(form);
    list.onclick=async event=>{
     const button=event.target.closest('[data-remove-line]');
     if(button && await confirmAction({title:'Quitar producto',message:'¿Estás seguro de que quieres quitar este producto de la recepción?',danger:true})) button.closest('[data-reception-line]').remove();
    };
   },
   save:async values=>{
    const detalles=[];
    for(let i=0;i<50;i++){
     const p=values['producto_'+i];if(!p)continue;
     const product=products.find(row=>String(row.id)===String(p));
     const r=Number(values['recibida_'+i]),f=values['facturada_'+i]===''?r:Number(values['facturada_'+i]);
     if(!product||!Number.isFinite(f)||!Number.isFinite(r)||f<=0||r<0||r>f)throw new Error('Revisa producto y cantidades en las líneas de la recepción.');
     // Disabled selects are omitted by FormData. Perishables always use the date field.
     const existing=values['lote_'+i]||null,expiration=(product.es_perecible||values['caducidad_'+i]==='fecha')?values['vencimiento_'+i]||null:null;
     if(product.controla_inventario!==false&&r>0&&!existing&&(product.es_perecible||values['caducidad_'+i]==='fecha')&&!expiration)throw new Error('Indica el vencimiento de '+product.nombre+'.');
     detalles.push({producto_id:p,lote_id:product.controla_inventario===false?null:existing,codigo_lote:values['codigo_lote_'+i]?.trim()||null,vencimiento:expiration,cantidad_facturada:f,cantidad_recibida:r,unidad:product.unidad_medida,precio_unitario:nullableNumber(values['precio_'+i])});
    }
    if(!detalles.length)throw new Error('Agrega al menos un producto.');
    const files=values.__form.elements.archivos.files;
    for(const file of files){const mime=fileMime(file),max=mime==='application/pdf'?15:10;if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Solo se aceptan imágenes JPG, PNG o WEBP y archivos PDF.');if(file.size>max*1024*1024)throw new Error('Un archivo supera el límite permitido.');}
    const rid=await rpc('app_registrar_recepcion_simple',{p_recepcion:{operacion_id:operationId,proveedor_id:values.proveedor_id,tipo_comprobante:values.tipo_comprobante,serie:values.serie.trim(),numero:values.numero.trim(),fecha_emision:values.fecha_emision,fecha_recepcion:values.fecha_recepcion,sede_id:String(mainSite.id),responsable:values.responsable.trim(),moneda:values.moneda,forma_pago:values.forma_pago||null,condicion_pago:values.condicion_pago?.trim()||null,fecha_vencimiento_pago:values.fecha_vencimiento_pago||null,guia_remision:values.guia_remision?.trim()||null,orden_compra:values.orden_compra?.trim()||null,subtotal:nullableNumber(values.subtotal),descuento:nullableNumber(values.descuento),igv:nullableNumber(values.igv),total:nullableNumber(values.total),estado_pago:values.estado_pago,detraccion_porcentaje:nullableNumber(values.detraccion_porcentaje),detraccion_monto:nullableNumber(values.detraccion_monto),observaciones:values.observaciones||'',detalles}});
    for(const file of files){
     const key=file.name+':'+file.size+':'+file.lastModified;
     const state=uploaded.get(key)||{path:`${rid}/${crypto.randomUUID()}-${cleanFileName(file.name)}`,uploaded:false,registered:false};uploaded.set(key,state);
     if(!state.uploaded){const result=await supabase.storage.from('documentos-recepcion').upload(state.path,file,{upsert:false,contentType:fileMime(file)});if(result.error&&String(result.error.statusCode)!=='409')throw result.error;state.uploaded=true;}
     if(!state.registered){const result=await supabase.from('recepcion_archivos').insert({recepcion_id:rid,ruta:state.path,nombre:file.name,tipo:fileMime(file),tamano:file.size});if(result.error)throw result.error;state.registered=true;}
    }
    notice('Recepción guardada. Los lotes y las entradas se registraron automáticamente.');await refresh();
   }
  });
 }
 if(canWrite){
  const button=document.createElement('button');button.type='button';button.id='new-lot';button.className='button';button.textContent='+ Nuevo lote';
  const advanced=document.createElement('details');advanced.className='panel reception-optional';advanced.id='manual-lots';
  advanced.innerHTML='<summary>Lotes manuales (opcional)</summary><p class="muted">Las recepciones crean sus lotes automáticamente. Usa esta opción solo si necesitas preparar uno para una entrada manual.</p>';
  advanced.append(button);root.append(advanced);
  button.onclick=()=>createLot(products,refresh);
 }
 root.querySelector('#new-reception')?.addEventListener('click',openReception);root.querySelector('#refresh').onclick=refresh;await refresh();
 return {refresh,tables:['recepciones','recepcion_detalles','recepcion_archivos','proveedor_productos','inventario','movimientos','productos','proveedores','sedes','lotes']};
}
