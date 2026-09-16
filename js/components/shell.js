const sections = [
 ['dashboard','Dashboard','house'], ['productos','Productos','box'], ['categorias','Categorías','tag'],
 ['proveedores','Proveedores','truck'], ['sedes','Sedes','building'], ['inventario','Inventario','boxes-stacked'],
 ['movimientos','Movimientos','arrow-right-arrow-left'], ['reportes','Reportes','chart-line'], ['auditoria','Auditoría','clipboard-list'], ['usuarios','Usuarios','users'],
];
export function mountShell() {
 const section = document.body.dataset.section;
 document.getElementById('app-root').innerHTML = `
 <div class="app-layout" hidden>
 <aside class="sidebar">
 <div class="sidebar-brand"><img src="img/logo.png" alt="" class="brand-logo"><span class="brand-name">LA LIGURIA S.A.</span><button type="button" id="sidebar-toggle" class="sidebar-toggle" aria-label="Colapsar menú"><i class="fa-solid fa-bars"></i></button></div>
 <nav class="sidebar-menu" aria-label="Menú principal">${sections.map(([key,label,icon])=>`<a href="${key}.html" class="menu-item ${key===section?'active':''}" ${key===section?'aria-current="page"':''}><i class="fa-solid fa-${icon}" aria-hidden="true"></i><span>${label}</span></a>`).join('')}</nav>
 <div class="sidebar-footer"><button id="btn-logout" class="btn-logout"><i class="fa-solid fa-power-off" aria-hidden="true"></i><span>Cerrar sesión</span></button></div>
 </aside>
 <div class="main-wrapper">
 <header class="top-navbar"><div class="navbar-left"><button id="toggle-sidebar" class="btn-toggle" aria-label="Abrir o cerrar menú"><i class="fa-solid fa-bars"></i></button><span class="navbar-title">CONTROL DE INVENTARIO</span></div>
 <div class="account"><span id="sync-state" class="sync-state">Conectando…</span><span id="user-display-name">Usuario</span><span id="user-role" class="badge-blue"></span></div></header>
 <main class="content-body" id="page-content"><div class="loading">Cargando sección…</div></main>
 <footer class="app-footer">LA LIGURIA S.A. · Inventario por sede y lote</footer>
 </div></div>
 <div id="notice" role="status" aria-live="polite" hidden></div>
 <dialog id="editor"><form id="editor-form"><header class="dialog-header"><h2 id="editor-title"></h2><button type="button" class="button icon-only" id="close-editor" aria-label="Cerrar">×</button></header><div id="editor-fields" class="form-grid"></div><p id="editor-error" role="alert" class="form-error"></p><footer class="dialog-footer"><button type="button" class="button" id="cancel-editor">Cancelar</button><button type="submit" class="button primary" id="save-editor">Guardar</button></footer></form></dialog>`;
}
