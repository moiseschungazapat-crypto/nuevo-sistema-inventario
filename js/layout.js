import { supabase } from './supabase.js';

export function renderLayout() {
    // Configuración del Sidebar (si aplica dinámicamente)
    const sidebar = document.getElementById('sidebar-container');
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

    // Lógica del nombre de usuario en la barra superior
    const userDisplayName = document.getElementById('user-display-name');
    const sessionData = localStorage.getItem('user_session');

    if (sessionData && userDisplayName) {
        try {
            const user = JSON.parse(sessionData);
            userDisplayName.textContent = user.nombre || 'Moises Chunga';
        } catch (e) {
            userDisplayName.textContent = 'Moises Chunga';
        }
    } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && userDisplayName) {
                userDisplayName.textContent = user.user_metadata?.full_name || user.email || 'Moises Chunga';
            }
        });
    }

    // Toggle para desplegar / ocultar el menú del usuario
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const userMenu = document.getElementById('user-menu');

    if (dropdownToggle && userMenu) {
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target) && !dropdownToggle.contains(e.target)) {
                userMenu.classList.remove('active');
            }
        });
    }

    // Manejador centralizado para Cerrar Sesión
    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        localStorage.removeItem('user_session');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    };

    // Vincular evento a los botones de logout (sidebar y dropdown)
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-dropdown-logout')?.addEventListener('click', handleLogout);
}

document.addEventListener('DOMContentLoaded', renderLayout);