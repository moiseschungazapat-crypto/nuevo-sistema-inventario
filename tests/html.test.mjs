import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/utils/html.js';

test('contenido almacenado no puede abrir etiquetas o salir de atributos', () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(escapeHtml("' &"), '&#39; &amp;');
});
test('nulos y números se muestran como texto seguro', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(12.5), '12.5');
    assert.equal(escapeHtml('Harina & azúcar'), 'Harina &amp; azúcar');
});
