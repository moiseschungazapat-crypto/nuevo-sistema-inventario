const sections = new Set(['dashboard','catalogo','productos','categorias','proveedores','sedes','recepciones','inventario','movimientos','reportes','auditoria','usuarios']);
export function navigateTo(section) {
 if (sections.has(section)) window.location.assign(section + '.html');
}
