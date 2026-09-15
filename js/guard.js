import { supabase } from './supabase.js';
import { authService } from './services/session.js';

function hideApp() { document.querySelector('.app-layout')?.setAttribute('hidden', ''); }
function rejectAccess() {
    hideApp();
    window.location.replace('index.html');
    return null;
}
// Cada página espera la identidad validada y el acceso antes de consultar datos.
export const sessionReady = authService.requireAccess().catch(rejectAccess);
document.addEventListener('DOMContentLoaded', async () => {
    const session = await sessionReady;
    if (!session) return;
    const name = document.getElementById('user-display-name');
    if (name) name.textContent = session.profile.nombre || 'Usuario';
    document.getElementById('auth-loading')?.remove();
    document.querySelector('.app-layout')?.removeAttribute('hidden');
});
// Callback síncrono: evitar llamadas Auth dentro del bloqueo del SDK.
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') rejectAccess();
});
let checking = false;
async function recheckAccess() {
    if (checking) return;
    checking = true;
    hideApp();
    try {
        await authService.requireAccess();
        document.querySelector('.app-layout')?.removeAttribute('hidden');
    } catch { rejectAccess(); }
    finally { checking = false; }
}
window.addEventListener('pageshow', event => { if (event.persisted) recheckAccess(); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recheckAccess();
});
