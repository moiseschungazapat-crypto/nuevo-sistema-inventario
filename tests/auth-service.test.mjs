import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService, authMessage } from '../js/services/auth-service.js';

function fixture(options = {}) {
    const calls = [];
    const profile = Object.hasOwn(options, 'profile') ? options.profile : { user_id: 'user-1', nombre: 'Ana', activo: true };
    const client = {
        auth: {
            async signInWithPassword(payload) { calls.push(['login', payload]); return { error: options.loginError }; },
            async getUser() { calls.push(['identity']); return { data: { user: options.noUser ? null : { id: 'user-1' } }, error: options.identityError }; },
            async signOut(payload) { calls.push(['logout', payload]); return { error: options.logoutError }; },
            async resetPasswordForEmail(email, config) { calls.push(['reset', email, config]); return { error: options.resetError }; },
            async updateUser(payload) { calls.push(['update', payload]); return { error: options.updateError }; },
        },
        from(table) {
            assert.equal(table, 'auth_perfiles'); // Nunca consultar usuarios/password.
            calls.push(['profile']);
            return {
                select(fields) { assert.equal(fields, 'user_id, nombre, activo'); return this; },
                eq(field, value) { assert.equal(field, 'user_id'); assert.equal(value, 'user-1'); return this; },
                async maybeSingle() { return { data: profile, error: options.profileError }; },
            };
        },
    };
    const storage = { removeItem(key) { calls.push(['remove', key]); if (options.storageBlocked) throw new Error('blocked'); } };
    return { service: createAuthService(client, storage), calls };
}

test('login valida identidad y perfil; conserva espacios de contraseña', async () => {
    const { service, calls } = fixture();
    const result = await service.signIn(' ANA@EMPRESA.COM ', ' clave con espacios ');
    assert.equal(result.profile.nombre, 'Ana');
    assert.deepEqual(calls.find(c => c[0] === 'login')[1], { email: 'ana@empresa.com', password: ' clave con espacios ' });
    assert.ok(calls.findIndex(c => c[0] === 'identity') < calls.findIndex(c => c[0] === 'profile'));
    assert.ok(calls.some(c => c[0] === 'remove' && c[1] === 'user_session'));
});
test('credenciales incorrectas no consultan datos', async () => {
    const { service, calls } = fixture({ loginError: { code: 'invalid_credentials' } });
    await assert.rejects(service.signIn('a@b.c', 'bad'), { code: 'invalid_credentials' });
    assert.equal(calls.some(c => c[0] === 'profile'), false);
});
for (const [name, profile] of [['sin perfil', null], ['inactivo', { user_id: 'user-1', activo: false }], ['otra identidad', { user_id: 'other', activo: true }]]) {
    test(`rechaza ${name} y cierra sesión`, async () => {
        const { service, calls } = fixture({ profile });
        await assert.rejects(service.signIn('a@b.c', 'pass'), { code: 'access_denied' });
        assert.ok(calls.some(c => c[0] === 'logout'));
    });
}
test('fallo consultando perfil no autoriza ni expone detalles', async () => {
    const { service } = fixture({ profileError: { message: 'database internals' } });
    await assert.rejects(service.requireAccess(), { code: 'access_check_failed' });
    assert.equal(authMessage({ message: '<script>secret</script>' }).includes('secret'), false);
});
test('sesión local heredada no sustituye identidad validada', async () => {
    const { service, calls } = fixture({ noUser: true });
    await assert.rejects(service.requireAccess(), { code: 'session_missing' });
    assert.equal(calls.some(c => c[0] === 'profile'), false);
});
test('error de Auth no permite consultar perfil', async () => {
    const { service, calls } = fixture({ identityError: { code: 'network' } });
    await assert.rejects(service.requireAccess(), { code: 'network' });
    assert.equal(calls.some(c => c[0] === 'profile'), false);
});
test('logout fallido se comunica al llamador', async () => {
    const { service } = fixture({ logoutError: { code: 'network' } });
    await assert.rejects(service.signOut(), { code: 'network' });
});
test('rechazo de acceso persiste aunque falle logout', async () => {
    const { service } = fixture({ profile: null, logoutError: { code: 'network' } });
    await assert.rejects(service.signIn('a@b.c', 'pass'), { code: 'access_denied' });
});
test('storage bloqueado no evita validación de identidad', async () => {
    const { service } = fixture({ storageBlocked: true });
    assert.equal((await service.requireAccess()).user.id, 'user-1');
});
test('recuperación normaliza correo y transmite URL exacta', async () => {
    const { service, calls } = fixture();
    await service.requestPasswordReset(' ANA@EMPRESA.COM ', 'https://empresa.example/restablecer.html');
    assert.deepEqual(calls.find(c => c[0] === 'reset'), ['reset', 'ana@empresa.com', { redirectTo: 'https://empresa.example/restablecer.html' }]);
});
test('fallo de envío no se anuncia como éxito', async () => {
    const { service } = fixture({ resetError: { code: 'over_email_send_rate_limit' } });
    await assert.rejects(service.requestPasswordReset('a@b.c', 'https://empresa.example'), { code: 'over_email_send_rate_limit' });
});
test('cambiar contraseña requiere identidad', async () => {
    const { service, calls } = fixture({ noUser: true });
    await assert.rejects(service.updatePassword('new password'), { code: 'session_missing' });
    assert.equal(calls.some(c => c[0] === 'update'), false);
});
test('cambio de contraseña conserva su contenido y propaga política del servidor', async () => {
    const { service, calls } = fixture({ updateError: { code: 'weak_password' } });
    await assert.rejects(service.updatePassword(' new password '), { code: 'weak_password' });
    assert.deepEqual(calls.find(c => c[0] === 'update'), ['update', { password: ' new password ' }]);
});
