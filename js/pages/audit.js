import {rpc} from '../services/data.js';
import {heading,e,pager,loadError,badge} from '../components/ui.js';

const tableNames={categorias:'Categorías',proveedores:'Proveedores',sedes:'Sedes',productos:'Productos',lotes:'Lotes',inventario_minimos:'Stock mínimo',auth_perfiles:'Usuarios',gastos:'Gastos',gastos_presupuestos:'Presupuestos de gastos',entrada_correcciones:'Corrección de entradas'};
const fieldNames={nombre:'Nombre',codigo:'Código',descripcion:'Descripción',unidad_medida:'Unidad',rol:'Rol',activo:'Acceso',estado:'Estado',vencimiento:'Vencimiento',minimo:'Stock mínimo',direccion:'Dirección',contacto:'Contacto',email:'Correo',telefono:'Teléfono',documento_origen:'Referencia del ingreso',fecha_recepcion:'Fecha de recepción',costo_unitario:'Costo unitario',precio:'Precio de referencia',es_perecible:'Perecible',concepto:'Concepto',categoria:'Categoría',monto:'Total gastado',fecha:'Fecha',proveedor:'Proveedor',observaciones:'Observación',periodo:'Mes',cantidad:'Cantidad',total:'Total',motivo:'Motivo',anulado:'Anulada',controla_inventario:'Controla existencias',unidad:'Unidad'};
const money=value=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',maximumFractionDigits:4}).format(Number(value));
const date=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value))?String(value).slice(0,10).split('-').reverse().join('/'):String(value);
const parse=value=>{if(value&&typeof value==='object'&&!Array.isArray(value))return value;try{const parsed=JSON.parse(value||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {};}};
function display(key,value){
 if(value==null||value==='')return 'Sin registrar';
 if(typeof value==='boolean')return key==='activo'?(value?'Habilitado':'Deshabilitado'):key==='estado'?(value?'Activo':'Inactivo'):(value?'Sí':'No');
 if(['monto','total','precio','costo_unitario'].includes(key)&&Number.isFinite(Number(value)))return money(value);
 if(key==='periodo'&&/^\d{4}-\d{2}/.test(value))return new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(String(value).slice(0,7)+'-01T00:00:00Z'));
 if(key==='vencimiento'||key==='fecha'||key.startsWith('fecha_'))return date(value);
 if(typeof value==='number')return new Intl.NumberFormat('es-PE',{maximumFractionDigits:4}).format(value);
 return String(value);
}
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

export function auditView(row){
 const structured=row.nuevo!=null||row.anterior!=null;
 let after=parse(row.nuevo??row.resumen),before=parse(row.anterior),context=row.contexto||{};
 const correction=row.tabla==='entrada_correcciones';
 if(correction&&after.nuevo){context={...context,producto:after.nuevo.producto,codigo:after.nuevo.codigo};before=parse(after.anterior);after={...parse(after.nuevo),motivo:after.motivo};}
 const product=context.producto||after.producto_nombre||after.producto;
 const subject=product||context.nombre||after.nombre||after.concepto||'';
 const verbs={INSERT:'Registro creado',UPDATE:'Registro actualizado',DELETE:'Registro eliminado'};
 let title=verbs[row.operacion]||'Cambio registrado',operation={INSERT:'Creación',UPDATE:'Actualización',DELETE:'Eliminación'}[row.operacion]||'Cambio';
 if(row.tabla==='lotes')title=row.operacion==='INSERT'?'Lote registrado':'Datos del lote actualizados';
 if(row.tabla==='gastos')title=row.operacion==='INSERT'?(after.origen&&after.origen!=='manual'?'Gasto de una entrada registrado':'Gasto registrado'):'Gasto actualizado';
 if(row.tabla==='inventario_minimos')title=row.operacion==='INSERT'?'Stock mínimo establecido':'Stock mínimo actualizado';
 if(row.tabla==='gastos_presupuestos')title='Presupuesto '+(row.operacion==='INSERT'?'registrado':'actualizado');
 if(row.tabla==='productos')title='Producto '+(row.operacion==='INSERT'?'registrado':row.operacion==='DELETE'?'eliminado':'actualizado');
 if(row.tabla==='auth_perfiles')title='Datos de usuario '+(row.operacion==='INSERT'?'registrados':'actualizados');
 if(correction){title=Number(after.cantidad)===0?'Entrada anulada':'Entrada corregida';operation='Corrección';}
 if(row.tabla==='gastos'&&after.anulado===true&&!before.anulado)title='Gasto anulado con su entrada';
 let keys=Object.keys(fieldNames).filter(key=>Object.hasOwn(after,key)||Object.hasOwn(before,key));
 const references=[];
 if(row.tabla==='lotes'){
  for(const key of ['codigo','documento_origen'])if(after[key])references.push({label:fieldNames[key],value:display(key,after[key])});
  keys=keys.filter(key=>!['codigo','documento_origen'].includes(key));
 }
 keys=keys.filter(key=>!(['nombre','concepto'].includes(key)&&after[key]===subject&&row.operacion!=='UPDATE'));
 if(row.operacion==='UPDATE'&&structured)keys=keys.filter(key=>!same(before[key],after[key]));
 if(correction)keys=['cantidad','costo_unitario','total','motivo'].filter(key=>Object.hasOwn(after,key)&&(!same(before[key],after[key])||key==='motivo'));
 if(row.tabla==='gastos'){
  if(product)keys=keys.filter(key=>key!=='concepto');
  keys=[...['cantidad','costo_unitario','monto','proveedor'].filter(key=>keys.includes(key)),...keys.filter(key=>!['cantidad','costo_unitario','monto','proveedor'].includes(key))];
 }
 const details=keys.map(key=>({label:fieldNames[key],value:display(key,after[key]),before:structured&&(row.operacion==='UPDATE'||correction)&&key!=='motivo'?display(key,before[key]):null}));
 const unit=context.unidad||after.unidad||after.unidad_medida;
 if(unit)for(const item of details.filter(item=>item.label==='Cantidad'||item.label==='Stock mínimo')){item.value+=' '+unit;if(item.before!=null&&item.before!=='Sin registrar')item.before+=' '+unit;}
 if(context.proveedor&&!keys.includes('proveedor'))details.push({label:'Proveedor',value:context.proveedor,before:null});
 if(context.sede)details.push({label:'Sede',value:context.sede,before:null});
 if(!details.length)details.push({label:'Detalle',value:row.tabla==='lotes'?'Lote asociado al producto.':structured?'Se actualizaron los datos de este registro.':'El resumen antiguo no tiene información suficiente para mostrar los cambios.',before:null});
 return {table:tableNames[row.tabla]||'Otros registros',operation,tone:correction?'warning':row.operacion==='INSERT'?'success':row.operacion==='DELETE'?'danger':'warning',title,subject,code:context.codigo||after.producto_codigo,details,references};
}

function detailHtml(item){
 return `<div class="audit-fact"><span>${e(item.label)}</span><strong>${item.before!=null?`<span class="audit-before">${e(item.before)}</span><span class="audit-arrow" aria-label="cambió a">→</span>`:''}${e(item.value)}</strong></div>`;
}

export async function auditPage(root,access){
 if(access.rol!=='administrador'){root.innerHTML=heading('Auditoría','Consulta restringida al administrador.')+'<section class="panel"><p>No tienes permisos para consultar el historial.</p></section>';return {refresh:async()=>{},tables:[]};}
 let rows=[],page=0;
 root.innerHTML=heading('Auditoría','Quién hizo cada cambio, qué producto afectó y cómo quedó.')+
  '<section class="panel audit-panel"><div class="toolbar"><label class="search-label">Buscar<input id="audit-search" type="search" placeholder="Producto, usuario o motivo…"></label><label>Sección<select id="audit-section"><option value="">Todas las secciones</option>'+Object.entries(tableNames).map(([value,label])=>`<option value="${e(value)}">${e(label)}</option>`).join('')+'</select></label><label>Acción<select id="audit-action"><option value="">Todas las acciones</option><option value="INSERT">Creación</option><option value="UPDATE">Actualización</option><option value="DELETE">Eliminación</option><option value="correction">Corrección de entradas</option></select></label><button id="audit-refresh" class="button">Actualizar</button></div><p class="muted" id="audit-count" aria-live="polite"></p><div id="audit-results" class="audit-activity"></div><div id="audit-pager" class="pagination"></div></section>';
 function render(){
  const q=root.querySelector('#audit-search').value.toLocaleLowerCase().trim(),section=root.querySelector('#audit-section').value,action=root.querySelector('#audit-action').value;
  const filtered=rows.map(row=>({row,view:auditView(row)})).filter(({row,view})=>
   (!section||row.tabla===section)&&(!action||(action==='correction'?row.tabla==='entrada_correcciones':row.operacion===action))&&
   [row.actor_email,row.actor_nombre,view.table,view.operation,view.title,view.subject,view.code,...view.details.flatMap(item=>[item.label,item.before,item.value]),...view.references.map(item=>item.value)].some(value=>String(value||'').toLocaleLowerCase().includes(q)));
  page=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));
  root.querySelector('#audit-count').textContent=`${filtered.length} ${filtered.length===1?'evento':'eventos'}${rows.length===1000?' · Se muestran los 1.000 registros más recientes.':''}`;
  root.querySelector('#audit-results').innerHTML=filtered.slice(page*20,(page+1)*20).map(({row,view})=>{
   const time=new Date(row.fecha),valid=Number.isFinite(time.getTime());
   return `<article class="audit-event"><div class="audit-event-time"><strong>${valid?e(time.toLocaleDateString('es-PE',{timeZone:'America/Lima'})):'Fecha no disponible'}</strong><time>${valid?e(time.toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit'})):''}</time><span>${e(row.actor_nombre||row.actor_email||'Sistema')}</span></div><div class="audit-event-content"><div class="audit-event-heading">${badge(view.operation,view.tone)}<span class="muted">${e(view.table)}</span></div><h2>${e(view.title)}</h2>${view.subject?`<p class="audit-subject">${e(view.subject)}${view.code?` <small>· ${e(view.code)}</small>`:''}</p>`:''}<div class="audit-summary">${view.details.slice(0,4).map(detailHtml).join('')}</div>${view.details.length>4||view.references.length?`<details class="audit-more"><summary>Ver más detalles</summary>${view.details.slice(4).map(detailHtml).join('')}${view.references.map(item=>detailHtml({...item,before:null})).join('')}</details>`:''}</div></article>`;
  }).join('')||'<p class="empty-message">No hay cambios que coincidan con estos filtros.</p>';
  pager(root.querySelector('#audit-pager'),filtered.length,page,20,value=>{page=value;render();});
 }
 async function refresh(){try{rows=await rpc('app_listar_auditoria');loadError(null);render();}catch(error){loadError(error);}}
 for(const id of ['audit-search','audit-section','audit-action'])root.querySelector('#'+id).addEventListener(id==='audit-search'?'input':'change',()=>{page=0;render();});
 root.querySelector('#audit-refresh').onclick=refresh;await refresh();return {refresh,tables:['auditoria']};
}
