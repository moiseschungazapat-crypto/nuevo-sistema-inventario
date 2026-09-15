export class AccessError extends Error {
    constructor(code) { super(code); this.code = code; }
}

export function authMessage(error) {
    switch (error?.code) {
        case 'invalid_credentials': return 'Correo o contraseña incorrectos.';
        case 'email_not_confirmed': return 'Confirma tu correo antes de iniciar sesión.';
        case 'access_denied': return 'Tu cuenta no tiene acceso habilitado. Contacta al administrador.';
        case 'access_check_failed': return 'No se pudo verificar tu acceso. Intenta nuevamente o contacta al administrador.';
        case 'session_missing': return 'La sesión no está disponible. Inicia sesión o solicita un nuevo enlace.';
        case 'over_request_rate_limit':
        case 'over_email_send_rate_limit': return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
        case 'weak_password': return 'La contraseña no cumple los requisitos de seguridad. Usa una contraseña más larga y variada.';
        case 'same_password': return 'Elige una contraseña diferente a la anterior.';
        default: return 'No se pudo completar la operación. Revisa tu conexión e inténtalo nuevamente.';
    }
}

export function createAuthService(client, storage) {
    function clearLegacySession() {
        try { storage?.removeItem('user_session'); } catch { /* Storage bloqueado. */ }
    }
    async function requireIdentity() {
        clearLegacySession();
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (!data?.user) throw new AccessError('session_missing');
        return data.user;
    }
    async function requireAccess() {
        const user = await requireIdentity();
        const { data: profile, error } = await client.from('auth_perfiles')
            .select('user_id, nombre, activo').eq('user_id', user.id).maybeSingle();
        if (error) throw new AccessError('access_check_failed');
        if (!profile || profile.user_id !== user.id || profile.activo !== true) {
            throw new AccessError('access_denied');
        }
        return { user, profile };
    }
    async function signOut() {
        clearLegacySession();
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
    }
    async function signIn(email, password) {
        clearLegacySession();
        const { error } = await client.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password, // No recortar espacios: pueden formar parte de la contraseña.
        });
        if (error) throw error;
        try { return await requireAccess(); }
        catch (error) {
            try { await signOut(); } catch { /* Conservar el error de acceso. */ }
            throw error;
        }
    }
    async function startPasswordOtp(email, password) {
        clearLegacySession();
        const { error } = await client.auth.signInWithPassword({
            email: email.trim().toLowerCase(), password,
        });
        if (error) throw error;
        // No mantener una sesión autenticada durante el segundo paso.
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* OTP será el único acceso final. */ }
        const { error: otpError } = await client.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { shouldCreateUser: false },
        });
        if (otpError) throw otpError;
    }
    async function verifyEmailOtp(email, token) {
        const { error } = await client.auth.verifyOtp({
            email: email.trim().toLowerCase(), token, type: 'email',
        });
        if (error) throw error;
    }
    async function resendEmailOtp(email) {
        const { error } = await client.auth.signInWithOtp({
            email: email.trim().toLowerCase(), options: { shouldCreateUser: false },
        });
        if (error) throw error;
    }
    async function requestPasswordReset(email, redirectTo) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
        if (error) throw error;
    }
    async function updatePassword(password) {
        await requireIdentity();
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
    }
    return { clearLegacySession, requireIdentity, requireAccess, signIn, signOut, startPasswordOtp, verifyEmailOtp, resendEmailOtp, requestPasswordReset, updatePassword };
}
