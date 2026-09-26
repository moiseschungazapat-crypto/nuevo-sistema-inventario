import { authService } from './services/session.js';
import { sessionReady } from './guard.js';
import { authMessage } from './services/auth-service.js';
import { setupThemeToggle } from './theme.js';

export function renderLayout() {
    setupThemeToggle();

    // 1. Manejo del Sidebar (Abrir / Colapsar / Móvil)
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');

    // Overlay para cerrar el menú en celulares al tocar fuera
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    if (sidebar && (toggleBtn || sidebarToggle)) {
        const toggleSidebar = (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show-mobile');
                overlay.classList.toggle('active');
            } else {
                sidebar.classList.toggle('collapsed');
                if (mainWrapper) mainWrapper.classList.toggle('expanded');
            }
        };
        toggleBtn?.addEventListener('click', toggleSidebar);
        sidebarToggle?.addEventListener('click', toggleSidebar);

        // Cerrar menú móvil al hacer clic en el overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show-mobile');
            overlay.classList.remove('active');
        });
    }

    // 2. Nombre de usuario activo
    const userDisplayName = document.getElementById('user-display-name');
    sessionReady.then(session => {
        if (session && userDisplayName) userDisplayName.textContent = session.profile.nombre || 'Usuario';
    });

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
        const button = e?.currentTarget;
        if (button) button.disabled = true;
        try {
            await authService.signOut();
            window.location.replace('index.html');
        } catch (error) {
            alert('No se pudo cerrar la sesión. ' + authMessage(error));
        } finally {
            if (button) button.disabled = false;
        }
    };

    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-dropdown-logout')?.addEventListener('click', handleLogout);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (await sessionReady) renderLayout();
});
