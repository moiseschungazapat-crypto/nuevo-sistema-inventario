import { rpc } from '../services/data.js';
import { heading,e,table,pager,loadError,badge } from '../components/ui.js';

const tableNames={categorias:'Categorías',proveedores:'Proveedores',sedes:'Sedes',productos:'Productos',lotes:'Lotes',inventario_minimos:'Stock mínimo',auth_perfiles:'Usuarios'};
const operationNames={INSERT:'Creación',UPDATE:'Actualización',DELETE:'Eliminación'};
const fieldNames={nombre:'Nombre',codigo:'Código',descripcion:'Descripción',unidad_medida:'Unidad',rol:'Rol',activo:'Estado',estado:'Estado',vencimiento:'Vencimiento',minimo:'Stock mínimo',direccion:'Dirección',contacto:'Contacto',email:'Correo',telefono:'Teléfono',documento_origen:'Documento',fecha_recepcion:'Recepción',costo_unitario:'Costo unitario',precio:'Precio',es_perecible:'Perecible'};
const fieldOrder=Object.keys(fieldNames);
const hiddenFields=new Set(['id','created_at','updated_at','version','user_id','actor_id']);

function parseSummary(value){
 if(value&&typeof value==='object')return value;
 try{return JSON.parse(value||'{}');}catch{return {};}
}
function displayValue(key,value){
 if(typeof value==='boolean')return ['activo','estado'].includes(key)?(value?'Activo':'Inactivo'):(value?'Sí':'No');
 if(value==null||value==='')return '';
 if((key.includes('fecha')||key==='vencimiento')&&/^\d{4}-\d{2}-\d{2}/.test(String(value))){const [year,month,day]=String(value).slice(0,10).split('-');return `${day}/${month}/${year}`;}
 if(['precio','costo_unitario'].includes(key)&&Number.isFinite(Number(value)))return 'S/ '+Number(value).toFixed(2);
 if(key==='rol')return String(value).charAt(0).toUpperCase()+String(value).slice(1);
 const text=String(value);return text.length>90?text.slice(0,87)+'…':text;
}
export function auditView(row){
 const values=parseSummary(row.resumen);
 const available=Object.keys(values).filter(key=>!hiddenFields.has(key)&&!key.endsWith('_id')&&values[key]!=null&&values[key]!=='');
 const ordered=[...fieldOrder.filter(key=>available.includes(key)),...available.filter(key=>!fieldOrder.includes(key))].slice(0,5);
 const details=ordered.map(key=>({label:fieldNames[key]||key.replaceAll('_',' '),value:displayValue(key,values[key])})).filter(item=>item.value);
 return {table:tableNames[row.tabla]||String(row.tabla||'Registro').replaceAll('_',' '),operation:operationNames[row.operacion]||row.operacion||'Cambio',tone:row.operacion==='INSERT'?'success':row.operacion==='DELETE'?'danger':'warning',details:details.length?details:[{label:'Detalle',value:row.operacion==='INSERT'?'Registro creado':'Registro actualizado'}]};
}

export async function auditPage(root,access){
 if(access.rol!=='administrador'){root.innerHTML=heading('Auditoría','Consulta restringida al administrador.')+'<section class="panel"><p>No tienes permisos para consultar el historial.</p></section>';return {refresh:async()=>{},tables:[]};}
 let rows=[],page=0;
 root.innerHTML=heading('Auditoría','Consulta quién realizó cada cambio y qué información modificó.')+'<section class="panel audit-panel"><div class="toolbar"><label class="search-label">Buscar<input id="audit-search" type="search" placeholder="Usuario, sección, acción o dato"></label><button id="audit-refresh" class="button">Actualizar</button></div><div id="audit-results"></div><div id="audit-pager" class="pagination"></div></section>';
 function render(){
  const q=root.querySelector('#audit-search').value.toLowerCase().trim();
  const prepared=rows.map(row=>({row,view:auditView(row)}));
  const filtered=prepared.filter(({row,view})=>[row.actor_email,row.actor_nombre,view.table,view.operation,...view.details.flatMap(item=>[item.label,item.value])].some(value=>String(value||'').toLowerCase().includes(q)));
  root.querySelector('#audit-results').innerHTML=table(['Fecha','Usuario','Sección','Acción','Resumen'],filtered.slice(page*25,(page+1)*25).map(({row,view})=>[e(new Date(row.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})),e(row.actor_nombre||row.actor_email||'Sistema'),`<strong class="audit-section">${e(view.table)}</strong>`,badge(view.operation,view.tone),`<div class="audit-summary">${view.details.map(item=>`<span><strong>${e(item.label)}:</strong> ${e(item.value)}</span>`).join('')}</div>`]));
  pager(root.querySelector('#audit-pager'),filtered.length,page,25,value=>{page=value;render();});
 }
 async function refresh(){try{rows=await rpc('app_listar_auditoria');loadError(null);render();}catch(error){loadError(error);}}
 root.querySelector('#audit-search').oninput=()=>{page=0;render()};root.querySelector('#audit-refresh').onclick=refresh;await refresh();return {refresh,tables:['auditoria']};
}
