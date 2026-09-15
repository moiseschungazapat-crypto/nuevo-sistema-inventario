import { authService } from './services/session.js';
import { authMessage } from './services/auth-service.js';
import { setStatus } from './utils/auth-ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('form-reset');
    const password = document.getElementById('password');
    const confirm = document.getElementById('confirm-password');
    const button = document.getElementById('btn-save-password');
    let busy = false;
    // Un enlace con error nunca debe aprovechar una sesión anterior silenciosamente.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (hash.has('error') || query.has('error')) {
        history.replaceState(null, '', window.location.pathname);
        setStatus('El enlace no es válido o ha vencido. Solicita uno nuevo desde el inicio de sesión.', 'danger');
        return;
    }
    try {
        // getUser espera la inicialización del SDK y verifica la identidad con Auth.
        await authService.requireIdentity();
        history.replaceState(null, '', window.location.pathname);
        form.hidden = false;
        setStatus('Elige una contraseña nueva de al menos 12 caracteres.');
    } catch {
        history.replaceState(null, '', window.location.pathname);
        setStatus('No se pudo validar la sesión. Abre un enlace vigente o solicita uno nuevo desde el inicio de sesión.', 'danger');
        return;
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        if (password.value !== confirm.value) {
            setStatus('Las contraseñas no coinciden.', 'danger');
            return;
        }
        busy = true;
        button.disabled = true;
        try {
            await authService.updatePassword(password.value);
            form.reset();
            form.hidden = true;
            setStatus('Contraseña actualizada. Cerrando esta sesión…', 'success');
            try {
                await authService.signOut();
                setStatus('Contraseña actualizada. Ya puedes volver e iniciar sesión.', 'success');
            } catch {
                setStatus('La contraseña se actualizó, pero no se pudo cerrar esta sesión. Vuelve al sistema y cierra sesión cuando se restablezca la conexión.', 'danger');
            }
        } catch (error) { setStatus(authMessage(error), 'danger'); }
        finally { busy = false; button.disabled = false; }
    });
});
