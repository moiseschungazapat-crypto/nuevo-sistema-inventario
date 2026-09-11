import { supabase } from './supabase.js';

export function renderLayout() {
    const sidebar = document.getElementById('sidebar-container');
    const navbar = document.getElementById('navbar-container');

    if (sidebar) {
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <img src="img/logo.png" alt="Logo">
                <span>Inventario</span>
            </div>
            <nav class="sidebar-menu">
                <a href="dashboard.html" class="menu-item"><i class="icon-dashboard"></i> Dashboard</a>
                <a href="inventario.html" class="menu-item"><i class="icon-box"></i> Inventario</a>
                <a href="productos.html" class="menu-item"><i class="icon-tag"></i> Productos</a>
                <a href="categorias.html" class="menu-item"><i class="icon-folder"></i> Categorías</a>
                <a href="movimientos.html" class="menu-item"><i class="icon-repeat"></i> Movimientos</a>
                <a href="proveedores.html" class="menu-item"><i class="icon-truck"></i> Proveedores</a>
                <a href="sedes.html" class="menu-item"><i class="icon-map"></i> Sedes</a>
                <a href="usuarios.html" class="menu-item"><i class="icon-users"></i> Usuarios</a>
                <a href="reportes.html" class="menu-item"><i class="icon-bar-chart"></i> Reportes</a>
            </nav>
        `;
    }

    if (navbar) {
        navbar.innerHTML = `
            <div class="navbar-left">
                <button id="toggle-sidebar" class="btn-icon">☰</button>
            </div>
            <div class="navbar-right">
                <span id="user-email" class="user-name">Cargando...</span>
                <button id="btn-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
            </div>
        `;

        // Evento de Logout
        document.getElementById('btn-logout')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // Cargar email del usuario activo
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = user.email;
        }
    });
}

document.addEventListener('DOMContentLoaded', renderLayout);