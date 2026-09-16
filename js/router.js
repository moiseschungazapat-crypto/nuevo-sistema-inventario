const sections = new Set(['dashboard','productos','categorias','proveedores','sedes','inventario','movimientos','reportes','auditoria','usuarios']);
export function navigateTo(section) {
 if (sections.has(section)) window.location.assign(section + '.html');
}
