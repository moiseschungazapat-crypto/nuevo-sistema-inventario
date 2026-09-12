import { supabase } from './supabase.js';

export function renderLayout() {
    // 1. Manejo del Sidebar (Abrir / Colapsar / Móvil)
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');

    // Overlay para cerrar el menú en celulares al tocar fuera
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show-mobile');
                overlay.classList.toggle('active');
            } else {
                sidebar.classList.toggle('collapsed');
                if (mainWrapper) mainWrapper.classList.toggle('expanded');
            }
        });

        // Cerrar menú móvil al hacer clic en el overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show-mobile');
            overlay.classList.remove('active');
        });
    }

    // 2. Nombre de usuario activo
    const userDisplayName = document.getElementById('user-display-name');
    const sessionData = localStorage.getItem('user_session');

    if (sessionData && userDisplayName) {
        try {
            const user = JSON.parse(sessionData);
            userDisplayName.textContent = user.nombre || 'Moises Chunga';
        } catch (e) {
            userDisplayName.textContent = 'Moises Chunga';
        }
    }

    // 3. Menú Desplegable (User Dropdown)
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

    // 4. Cerrar Sesión
    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        localStorage.removeItem('user_session');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    };

    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-dropdown-logout')?.addEventListener('click', handleLogout);
}

document.addEventListener('DOMContentLoaded', renderLayout);