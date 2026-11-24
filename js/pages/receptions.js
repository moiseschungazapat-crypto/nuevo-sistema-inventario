import { allRows, rpc } from '../services/data.js';
import { heading, e, table, field, options, openEditor, notice, loadError } from '../components/ui.js';
import { operationalSite, operationalSiteError, operationalSiteLabel } from '../utils/single-site.js';
import { confirmAction } from '../components/confirmation.js';
import {entryCostTotal} from '../utils/entry-cost.js';

const productLabel = product => `${product.codigo || 'Sin código'} · ${product.nombre}`;
const limaToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const limaDateTime = value => value ? new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)) : '—';

export async function receptionsPage(root, access) {
 let rows = [], providers = [], categories = [], products = [], sites = [], mainSite = null;
 const canWrite = access.rol !== 'consulta';
 root.innerHTML = heading(
  'Recepciones',
  'Registra únicamente los productos que ingresan físicamente al almacén y el proveedor que los entregó.',
  canWrite ? '<button id="new-reception" class="button primary">+ Registrar ingreso</button>' : ''
 ) + '<section class="panel"><div class="toolbar"><button id="refresh" class="button">Actualizar</button></div><div id="results"></div></section>';

 function render() {
  root.querySelector('#results').innerHTML = table(
   ['Fecha de recepción','Registrado (Lima)','Proveedor','Sede de recepción','Productos recibidos','Responsable'],
   rows.map(row => [
    e(row.fecha_recepcion || row.fecha_emision), e(limaDateTime(row.created_at)), e(row.proveedor),
    e(row.sede), e(row.productos), e(row.responsable || '—')
   ]),
   'Todavía no hay ingresos de proveedores registrados.'
  );
 }

 async function refresh() {
  try {
   [providers,categories,products,sites,rows] = await Promise.all([
    allRows('proveedores'), allRows('categorias'), allRows('productos'), allRows('sedes'), rpc('app_listar_recepciones')
   ]);
   mainSite = operationalSite(sites);
   const siteError = operationalSiteError(sites);
   if (siteError) throw new Error(siteError);
   render(); loadError(null);
  } catch (error) { loadError(error); }
 }

 function line(index, required = false) {
  return `<div class="reception-line" data-reception-line data-index="${index}">
   ${field('categoria_'+index,'Categoría',{required,choices:options(categories.filter(category=>category.estado),'','Seleccionar categoría…'),help:'Primero elige el grupo del producto.'})}
   ${field('producto_'+index,'Producto',{required,choices:'<option value="">Primero elige una categoría…</option>',help:'Solo se mostrarán productos de la categoría elegida.'})}
   ${field('recibida_'+index,'Cantidad recibida',{type:'number',required,min:0.001,step:'0.001',help:'Cantidad física que estás ingresando.'})}
   ${field('costo_'+index,'Costo unitario (S/)',{type:'number',required,min:0.0001,step:'0.0001',help:'Costo por kg, litro o unidad base. Genera el gasto automáticamente.'})}
   <p class="muted reception-cost-total" data-line-total>Total: S/ 0.00</p>
   <div class="reception-expiry">
    ${field('caducidad_'+index,'Vencimiento',{choices:'<option value="ninguno">Sin vencimiento</option><option value="fecha">Tiene vencimiento</option>'})}
    ${field('vencimiento_'+index,'Fecha de vencimiento',{type:'date'})}
   </div>
   ${field('unidad_'+index,'Unidad',{value:'unidad',help:'Se completa automáticamente.'})}
   <button type="button" class="button line-remove" data-remove-line ${required?'hidden':''}>Quitar</button>
  </div>`;
 }

 function syncLine(lineNode) {
  const categoryControl = lineNode.querySelector('[name^="categoria_"]');
  const productControl = lineNode.querySelector('[name^="producto_"]');
  const quantityControl = lineNode.querySelector('[name^="recibida_"]');
  const costControl = lineNode.querySelector('[name^="costo_"]');
  const unitControl = lineNode.querySelector('[name^="unidad_"]');
  const modeControl = lineNode.querySelector('[name^="caducidad_"]');
  const expirationControl = lineNode.querySelector('[name^="vencimiento_"]');
  const selectedProduct = productControl.value;
  const categoryChanged = lineNode.dataset.category !== categoryControl.value;
  const filteredProducts = products.filter(product=>product.estado && String(product.categoria_id)===categoryControl.value);
  productControl.innerHTML = options(filteredProducts,categoryChanged?'':selectedProduct,categoryControl.value?'Seleccionar producto…':'Primero elige una categoría…',productLabel);
  productControl.disabled = !categoryControl.value;
  lineNode.dataset.category = categoryControl.value;
  const product = products.find(row=>String(row.id)===productControl.value);
  costControl.required=Boolean(product);
  const changed = lineNode.dataset.product !== productControl.value;
  if (changed) {
   lineNode.dataset.product = productControl.value;
   costControl.value='';
   expirationControl.value = '';
   modeControl.value = product?.es_perecible ? 'fecha' : 'ninguno';
  }
  lineNode.querySelector('[data-line-total]').textContent='Total: '+new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(entryCostTotal(quantityControl.value,costControl.value));
  unitControl.readOnly = true;
  unitControl.value = product?.unidad_medida || 'unidad';
  modeControl.disabled = Boolean(product?.es_perecible) || product?.controla_inventario === false;
  if (product?.es_perecible) modeControl.value = 'fecha';
  if (product?.controla_inventario === false) modeControl.value = 'ninguno';
  const needsExpiration = product?.controla_inventario !== false && modeControl.value === 'fecha';
  expirationControl.disabled = !needsExpiration;
  expirationControl.required = needsExpiration && Number(quantityControl.value) > 0;
  expirationControl.closest('label').hidden = !needsExpiration;
 }

 function openReception() {
  if (!mainSite) {
   notice(operationalSiteError(sites) || 'Configura la sede de operación antes de registrar un ingreso.',true);
   return;
  }
  const operationId = crypto.randomUUID();
  openEditor({
   title:'Registrar ingreso al inventario',
   fields:
    field('proveedor_id','Proveedor',{required:true,choices:options(providers.filter(provider=>provider.estado)),help:'Empresa o persona que entregó los productos.'})+
    field('fecha_recepcion','Fecha de recepción',{type:'date',required:true,value:limaToday(),help:'Día en que los productos llegaron al almacén.'})+
    field('responsable','Responsable de recepción',{required:true,maxLength:150,value:access.nombre||'',help:'Persona que verificó el ingreso.'})+
    field('observaciones','Observaciones del ingreso (opcional)',{type:'textarea',maxLength:1000,help:'Anota daños, diferencias u otra observación física.'})+
    `<p class="muted full-width">Sede de recepción: ${e(operationalSiteLabel(mainSite))}</p>`+
    '<p class="muted full-width">Agrega cada producto recibido. El sistema creará sus lotes y actualizará las existencias automáticamente.</p>'+
    '<div id="reception-lines" class="full-width">'+line(0,true)+'</div>'+
    '<button type="button" id="add-reception-line" class="button full-width">+ Agregar otro producto</button>',
   setup:form=>{
    let next = 1;
    const list = form.querySelector('#reception-lines');
    syncLine(list.querySelector('[data-reception-line]'));
    const syncEventLine = event => { const node=event.target.closest('[data-reception-line]'); if (node) syncLine(node); };
    form.oninput = syncEventLine; form.onchange = syncEventLine;
    form.__addReceptionLine = () => {
     if (next >= 50) { notice('Se alcanzó el máximo de 50 productos por ingreso.',true); return; }
     list.insertAdjacentHTML('beforeend',line(next)); syncLine(list.lastElementChild); next++;
    };
    form.querySelector('#add-reception-line').onclick = form.__addReceptionLine;
    list.onclick = async event => {
     const button = event.target.closest('[data-remove-line]');
     if (button && await confirmAction({title:'Quitar producto',message:'¿Estás seguro de que quieres quitar este producto del ingreso?',danger:true})) button.closest('[data-reception-line]').remove();
    };
   },
   save:async values=>{
    const detalles = [];
    for (let index=0; index<50; index++) {
     const productId = values['producto_'+index]; if (!productId) continue;
     const product = products.find(row=>String(row.id)===String(productId));
     const received = Number(values['recibida_'+index]);
     const cost=Number(values['costo_'+index]);
     if(!Number.isFinite(cost)||cost<=0)throw new Error('Indica el costo unitario de '+product?.nombre+'.');
     if (!product || !Number.isFinite(received) || received<=0) throw new Error('Revisa el producto y la cantidad recibida.');
     const hasExpiration = product.es_perecible || values['caducidad_'+index] === 'fecha';
     const expiration = hasExpiration ? values['vencimiento_'+index] || null : null;
     if (product.controla_inventario !== false && hasExpiration && !expiration) throw new Error('Indica el vencimiento de '+product.nombre+'.');
     detalles.push({producto_id:productId,lote_id:null,codigo_lote:null,vencimiento:expiration,cantidad_facturada:received,cantidad_recibida:received,unidad:product.unidad_medida,precio_unitario:cost});
    }
    if (!detalles.length) throw new Error('Agrega al menos un producto recibido.');
    const internalNumber = operationId.replaceAll('-','').slice(0,24).toUpperCase();
    await rpc('app_registrar_recepcion_con_costo',{p_recepcion:{
     operacion_id:operationId, proveedor_id:values.proveedor_id, tipo_comprobante:'Ingreso de inventario',
     serie:'INT', numero:internalNumber, fecha_emision:values.fecha_recepcion, fecha_recepcion:values.fecha_recepcion,
     sede_id:String(mainSite.id), responsable:values.responsable.trim(), observaciones:values.observaciones?.trim() || '', detalles
    }});
    notice('Ingreso guardado. Inventario y gasto por producto actualizados.'); await refresh();
   }
  });
 }

 root.querySelector('#new-reception')?.addEventListener('click',openReception);
 root.querySelector('#refresh').onclick = refresh;
 await refresh();
 return {refresh,tables:['recepciones','recepcion_detalles','inventario','movimientos','productos','proveedores','sedes','lotes']};
}
