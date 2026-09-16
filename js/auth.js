import { authService } from './services/session.js';
import { authMessage } from './services/auth-service.js';
import { setStatus, setupPasswordToggle } from './utils/auth-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const otp = document.getElementById('otp');
    const submit = document.getElementById('btn-login');
    const recover = document.getElementById('btn-recover');
    const back = document.getElementById('btn-back');
    const resend = document.getElementById('btn-resend');
    const credentialsStep = document.getElementById('credentials-step');
    const otpStep = document.getElementById('otp-step');
    let busy = false;
    let pendingEmail = '';
    let resendTimer;
    authService.clearLegacySession();
    setupPasswordToggle();

    function setBusy(value) {
        busy = value;
        submit.disabled = value;
        recover.disabled = value;
        if (resend) resend.disabled = value;
        form.setAttribute('aria-busy', String(value));
    }
    function showOtpStep() {
        pendingEmail = email.value.trim().toLowerCase();
        credentialsStep.hidden = true;
        otpStep.hidden = false;
        document.getElementById('step-credentials')?.classList.remove('active');
        document.getElementById('step-otp')?.classList.add('active');
        otp.value = '';
        submit.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Verificar código';
        setStatus('Te enviamos un código de 6 dígitos. Caduca pronto.', 'success');
        otp.focus();
        startResendCooldown();
    }
    function showCredentialsStep() {
        credentialsStep.hidden = false;
        otpStep.hidden = true;
        document.getElementById('step-credentials')?.classList.add('active');
        document.getElementById('step-otp')?.classList.remove('active');
        submit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión';
        setStatus('Ingresa con tu cuenta de la empresa.');
        otp.value = '';
        clearInterval(resendTimer);
    }
    function startResendCooldown(seconds = 60) {
        let remaining = seconds;
        resend.disabled = true;
        clearInterval(resendTimer);
        resend.textContent = `Reenviar código (${remaining}s)`;
        resendTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(resendTimer);
                resend.disabled = false;
                resend.textContent = 'Reenviar código';
            } else resend.textContent = `Reenviar código (${remaining}s)`;
        }, 1000);
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        setBusy(true);
        try {
            if (!otpStep.hidden) {
                if (!/^\d{6}$/.test(otp.value)) throw new Error('Ingresa el código de 6 dígitos recibido por correo.');
                setStatus('Validando código…');
                await authService.verifyEmailOtp(pendingEmail, otp.value);
                await authService.requireAccess();
                password.value = '';
                otp.value = '';
                setStatus('Acceso autorizado. Abriendo el inventario…', 'success');
                window.location.replace('dashboard.html');
                return;
            }
            setStatus('Verificando contraseña…');
            await authService.startPasswordOtp(email.value, password.value);
            showOtpStep();
        } catch (error) {
            otp.value = '';
            setStatus(authMessage(error), 'danger');
            if (!otpStep.hidden) otp.focus(); else password.focus();
        } finally { setBusy(false); }
    });
    resend.addEventListener('click', async () => {
        if (busy || !pendingEmail) return;
        setBusy(true);
        try { await authService.resendEmailOtp(pendingEmail); setStatus('Código reenviado. Revisa tu correo.', 'success'); startResendCooldown(); }
        catch (error) { setStatus(authMessage(error), 'danger'); }
        finally { setBusy(false); }
    });
    back.addEventListener('click', () => { authService.clearLegacySession(); showCredentialsStep(); });
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
