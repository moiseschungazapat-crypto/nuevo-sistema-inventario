import { rpc, watchTables, message } from './services/data.js';
import { catalogPage, catalogConfig } from './pages/catalogs.js';
import { stockPage } from './pages/stock.js';
import { movementsPage } from './pages/movements.js';
import { usersPage } from './pages/users.js';
import { overviewPage } from './pages/overview.js';
import { auditPage } from './pages/audit.js';
import { e } from './components/ui.js';
export async function startPage(section) {
 const root=document.getElementById('page-content');
 try{
  const access=await rpc('app_mi_acceso');
  document.getElementById('user-role').textContent=access.rol;
  let page;
  if(catalogConfig[section])page=await catalogPage(root,section,access);
  else if(section==='inventario')page=await stockPage(root,access);
  else if(section==='movimientos'||section==='reportes')page=await movementsPage(root,access,section==='reportes');
  else if(section==='usuarios')page=await usersPage(root,access);
  else if(section==='auditoria')page=await auditPage(root,access);
  else page=await overviewPage(root);
  if(page.tables.length)watchTables(page.tables,page.refresh);
  else document.getElementById('sync-state').textContent='Sesión validada';
 }catch(error){
  root.innerHTML='<section class="panel setup-error"><h1>No se pudo abrir esta sección</h1><p>'+e(message(error))+'</p><p>Si es la primera vez que abres los módulos, el administrador debe aplicar la migración de inventario y asignar los roles.</p><button class="button primary" id="retry-page">Reintentar</button></section>';
  document.getElementById('retry-page').onclick=()=>startPage(section);
  document.getElementById('sync-state').textContent='Pendiente de conexión';
 }
}
