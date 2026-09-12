import { renderLayout } from './layout.js';
import { loadDashboard } from './dashboard.js';
import { loadProductos } from './productos.js';
import { loadCategorias } from './categorias.js';
import { loadProveedores } from './proveedores.js';
import { loadSedes } from './sedes.js';
import { loadInventario } from './inventario.js';
import { loadMovimientos } from './movimientos.js';

const routes = {
    dashboard: loadDashboard,
    productos: loadProductos,
    categorias: loadCategorias,
    proveedores: loadProveedores,
    sedes: loadSedes,
    inventario: loadInventario,
    movimientos: loadMovimientos
};

export function navigateTo(section) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    // Actualizar clases activas en la sidebar
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Limpiar contenido y ejecutar módulo
    contentArea.innerHTML = '';
    if (routes[section]) {
        routes[section](contentArea);
    } else {
        contentArea.innerHTML = `<h2>Sección "${section}" en desarrollo</h2>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderLayout();

    // Eventos de clic en menú
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateTo(section);
        });
    });

    // Cargar dashboard por defecto
    navigateTo('dashboard');
});