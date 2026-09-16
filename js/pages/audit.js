import { rpc } from '../services/data.js';
import { heading,e,table,pager,loadError } from '../components/ui.js';
export async function auditPage(root,access){
 if(access.rol!=='administrador'){root.innerHTML=heading('Auditoría','Consulta restringida al administrador.')+'<section class="panel"><p>No tienes permisos para consultar el historial.</p></section>';return {refresh:async()=>{},tables:[]};}
 let rows=[],page=0;
 root.innerHTML=heading('Auditoría','Historial de cambios realizados en el sistema.')+'<section class="panel"><div class="toolbar"><label class="search-label">Buscar<input id="audit-search" type="search" placeholder="Tabla, operación o usuario"></label><button id="audit-refresh" class="button">Actualizar</button></div><div id="audit-results"></div><div id="audit-pager" class="pagination"></div></section>';
 function render(){const q=root.querySelector('#audit-search').value.toLowerCase().trim();const filtered=rows.filter(r=>[r.tabla,r.operacion,r.actor_email,r.actor_nombre].some(v=>String(v||'').toLowerCase().includes(q)));root.querySelector('#audit-results').innerHTML=table(['Fecha','Usuario','Tabla','Operación','Detalle'],filtered.slice(page*25,(page+1)*25).map(r=>[e(new Date(r.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})),e(r.actor_nombre||r.actor_email||'Sistema'),e(r.tabla),e(r.operacion),e(r.resumen||'—')]));pager(root.querySelector('#audit-pager'),filtered.length,page,25,v=>{page=v;render();});}
 async function refresh(){try{rows=await rpc('app_listar_auditoria');loadError(null);render();}catch(error){loadError(error);}}
 root.querySelector('#audit-search').oninput=()=>{page=0;render()};root.querySelector('#audit-refresh').onclick=refresh;await refresh();return {refresh,tables:['auditoria']};
}
