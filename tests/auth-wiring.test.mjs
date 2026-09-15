import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('la página de login carga el controlador Auth, no la consulta heredada', async () => {
    const [html, controller] = await Promise.all([read('index.html'), read('js/auth.js')]);
    assert.match(html, /src="js\/auth\.js"/);
    assert.match(controller, /authService\.startPasswordOtp\(email\.value, password\.value\)/);
    assert.match(controller, /authService\.verifyEmailOtp\(pendingEmail, otp\.value\)/);
    assert.match(controller, /authService\.requestPasswordReset/);
    assert.doesNotMatch(controller, /\.from\(['"]usuarios['"]\)/);
    assert.doesNotMatch(controller, /console\.log/);
});

test('guard exporta el contrato requerido por las páginas y no es un formulario de login', async () => {
    const guard = await read('js/guard.js');
    assert.match(guard, /export const sessionReady\s*=\s*authService\.requireAccess\(\)/);
    assert.doesNotMatch(guard, /form-login|btn-recover|signIn\(/);
    for (const path of ['js/dashboard.js', 'js/productos.js', 'js/layout.js']) {
        const source = await read(path);
        assert.match(source, /import \{ sessionReady \} from '\.\/guard\.js'/);
        assert.match(source, /await sessionReady/);
    }
});
