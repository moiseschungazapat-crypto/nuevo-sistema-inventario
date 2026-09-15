import { authService } from './services/session.js';
import { authMessage } from './services/auth-service.js';
import { setStatus, setupPasswordToggle } from './utils/auth-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const submit = document.getElementById('btn-login');
    const recover = document.getElementById('btn-recover');
    let busy = false;
    authService.clearLegacySession();
    setupPasswordToggle();
    function setBusy(value) {
        busy = value;
        submit.disabled = value;
        recover.disabled = value;
        form.setAttribute('aria-busy', String(value));
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        setBusy(true);
        setStatus('Verificando acceso…');
        try {
            await authService.signIn(email.value, password.value);
            password.value = '';
            setStatus('Acceso autorizado. Abriendo el inventario…', 'success');
            window.location.replace('dashboard.html');
        } catch (error) {
            password.value = '';
            setStatus(authMessage(error), 'danger');
            password.focus();
        } finally { setBusy(false); }
    });
    recover.addEventListener('click', async () => {
        if (busy || !email.reportValidity()) return;
        setBusy(true);
        try {
            const redirectTo = new URL('restablecer.html', window.location.href).href;
            await authService.requestPasswordReset(email.value, redirectTo);
            setStatus('Si el correo tiene una cuenta, recibirás un enlace para cambiar la contraseña. Revisa también el correo no deseado.', 'success');
        } catch (error) { setStatus(authMessage(error), 'danger'); }
        finally { setBusy(false); }
    });
});
