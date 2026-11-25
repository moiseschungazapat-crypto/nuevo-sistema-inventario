import {rpc} from '../services/data.js';
import {e,field,openEditor,notice,loadError} from './ui.js';
import {syncInventorySheets} from '../services/google-sheets.js';
import {entryCostTotal} from '../utils/entry-cost.js';

const money=value=>value==null?'Sin costo registrado':new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',maximumFractionDigits:4}).format(Number(value));

export async function chooseEntryCorrection({receptionId=null,onSaved}={}){
 try{
  const entries=await rpc('app_entradas_corregibles',{p_recepcion:receptionId});
  if(!entries.length){notice('No hay entradas registradas para corregir.',true);return;}
  // Elegir primero el ingreso exacto permite corregir también entradas anuladas.
  openEditor({title:'Seleccionar entrada para corregir',fields:field('entrada','Producto e ingreso',{required:true,choices:'<option value="">Seleccionar entrada…</option>'+entries.map(row=>`<option value="${e(row.id)}">${e(`${row.fecha} · ${row.producto_nombre} (${row.producto_codigo}) · ${row.cantidad} ${row.unidad}${row.anulado?' · Anulada':''} · ${row.proveedor||''}`)}</option>`).join('')}),
   save:async values=>{document.getElementById('editor').addEventListener('close',()=>openEntryCorrection({gastoId:values.entrada,onSaved}),{once:true});}});
 }catch(error){loadError(error);}
}

export async function openEntryCorrection({gastoId,onSaved}={}){
 try{
  const info=await rpc('app_datos_correccion_entrada',{p_gasto:gastoId}),g=info.gasto;
  let request=null;
  await openEditor({title:'Corregir entrada',fields:
   `<p><strong>${e(g.producto_nombre)} (${e(g.producto_codigo)})</strong><br>${e(g.fecha)} · ${e(g.proveedor||'Sin proveedor')} · ${e(info.origen.sede)}<br>Lote: ${e(info.origen.lote||'No aplica')}</p>`+
   `<p>Registrado: <strong>${e(info.cantidad)} ${e(g.unidad)}</strong> a ${e(money(g.costo_unitario))}. Total: ${e(money(info.total))}.<br>Disponible en este lote: ${e(info.disponible)} ${e(g.unidad)}.</p>`+
   field('cantidad','Cantidad correcta',{type:'number',required:true,min:0,step:'0.001',value:info.cantidad,help:'Ingresa el total que realmente entró. Cero anula esta entrada.'})+
   field('costo','Costo unitario correcto (S/)',{type:'number',required:Number(info.cantidad)>0,min:.0001,step:'0.0001',value:g.costo_unitario??'',help:info.sin_gasto?'Este ingreso aún no tiene gasto. Ingresa el costo real para registrarlo al corregir.':''})+
   '<p class="muted" data-correction-preview aria-live="polite"></p>'+
   field('motivo','Motivo de la corrección',{type:'textarea',required:true,maxLength:900,help:'Quedará registrado junto con tu usuario y la fecha.'})+
   '<p class="muted">Se conservan el ingreso original y sus datos de producto, proveedor y lote. La corrección ajusta las existencias y el gasto del mes de la entrada.</p>'+
   (info.historial.length?'<details><summary>Historial de correcciones</summary>'+info.historial.map(row=>`<p><strong>${e(row.responsable)}</strong> · ${e(new Date(row.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'}))}<br>${e(row.anterior.cantidad)} → ${e(row.nuevo.cantidad)} ${e(g.unidad)} · ${e(money(row.anterior.total))} → ${e(money(row.nuevo.total))}<br>${e(row.motivo)}</p>`).join('')+'</details>':''),
   setup:form=>{
    const preview=form.querySelector('[data-correction-preview]');
    const update=()=>{const qty=Number(form.elements.cantidad.value),delta=qty-Number(info.cantidad);form.elements.costo.required=qty>0;preview.textContent=`Nuevo total: ${money(entryCostTotal(form.elements.cantidad.value,form.elements.costo.value))}. Cambio de existencias: ${delta>0?'+':''}${Number(delta.toFixed(3))} ${g.unidad}.`;
     if(!info.origen.lote_id)preview.textContent=`Nuevo total: ${money(entryCostTotal(form.elements.cantidad.value,form.elements.costo.value))}. Este registro no controla existencias.`;};
    form.elements.cantidad.oninput=update;form.elements.costo.oninput=update;update();
   },
   save:async values=>{
    if(!request)request={p_operacion:crypto.randomUUID(),p_gasto:g.id,p_version:g.version,p_cantidad:Number(values.cantidad),p_costo_unitario:values.costo===''?null:Number(values.costo),p_motivo:values.motivo};
    try{await rpc('app_corregir_entrada',request);}
    catch(error){
     // Una respuesta de negocio confirma que no hubo cambios. Un fallo de red
     // conserva el mismo identificador y datos para un reintento seguro.
     if(error.code){request=null;}else{
      for(const name of ['cantidad','costo','motivo'])values.__form.elements[name].readOnly=true;
      throw new Error('No se pudo confirmar la respuesta. Pulsa Guardar para reintentar los mismos datos sin duplicar la corrección.');
     }
     throw error;
    }
    // La corrección ya está confirmada; refrescar vistas no puede convertirla en un fallo.
    try{await onSaved?.();}catch{/* La página permite actualizar de nuevo. */}
    notice('Entrada corregida. Existencias y gastos actualizados.');
    syncInventorySheets({refreshOnly:true}).catch(()=>notice('Corrección guardada. No se pudo actualizar Google Sheets; usa Sincronizar inventario para refrescarlo.',true));
   }});
 }catch(error){loadError(error);}
}
