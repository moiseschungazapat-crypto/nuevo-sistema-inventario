import { allRows, rpc } from '../services/data.js';
import { field, options, openEditor, notice, e } from './ui.js';
import { operationalSite, operationalSiteError, operationalSiteLabel } from '../utils/single-site.js';
export async function configureMinimum(product) {
 try {
  const [sites,minimums]=await Promise.all([allRows('sedes'),allRows('inventario_minimos')]);
  const site=operationalSite(sites);if(!site)throw new Error(operationalSiteError(sites));
  const minimum=minimums.find(m=>String(m.producto_id)===String(product.id)&&String(m.sede_id)===String(site.id));
  await openEditor({title:'Stock mínimo · '+product.nombre,fields:`<p class="muted full-width">${e(operationalSiteLabel(site))}</p>`+field('minimo','Cantidad mínima ('+product.unidad_medida+')',{type:'number',min:0,step:'0.001',required:true,value:minimum?.minimo??0,help:'Se usa para avisar de stock bajo. No modifica las existencias.'}),save:async values=>{
   await rpc('app_configurar_minimo',{p_producto:String(product.id),p_sede:String(site.id),p_minimo:Number(values.minimo)});notice('Stock mínimo actualizado.');
  }});
 }catch(error){notice(error.message,true);}
}
export function createLot(products,refresh) {
 return openEditor({title:'Registrar lote de recepción',fields:field('producto_id','Producto',{required:true,choices:options(products.filter(p=>p.estado&&p.controla_inventario!==false))})+field('codigo','Código de lote',{required:true,maxLength:100})+field('vencimiento','Fecha de vencimiento',{type:'date',required:true})+'<p class="muted full-width">Crear el lote no añade existencias. Selecciónalo al registrar la recepción o una entrada en Movimientos.</p>',save:async values=>{
  await rpc('app_crear_lote',{p_producto:values.producto_id,p_codigo:values.codigo.trim(),p_vencimiento:values.vencimiento});notice('Lote creado. Ya puedes seleccionarlo en la recepción.');await refresh();
 }});
}
