import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/202611130015_catalogo_operativo_actualizado.sql', import.meta.url);
const sql = await fs.readFile(migrationPath, 'utf8');
const cleanupPath = new URL('../supabase/migrations/202611130016_retirar_productos_fuera_catalogo.sql', import.meta.url);
const cleanupSql = await fs.readFile(cleanupPath, 'utf8');
const resetPath = new URL('../supabase/migrations/202611130017_eliminar_datos_prueba_catalogo.sql', import.meta.url);
const resetSql = await fs.readFile(resetPath, 'utf8');
const productBlock = sql.match(/insert into app_catalogo_actualizado\([^)]+\) values\s*([\s\S]+?);\s*\n\s*do \$\$/i)?.[1] || '';
const products = [...productBlock.matchAll(/\('([^']+)','((?:''|[^'])*)','((?:''|[^'])*)','(kg|litro|unidad)',(true|false)\)/g)]
 .map(match => ({code:match[1],name:match[2],category:match[3],unit:match[4]}));

test('la migración contiene los 270 productos transcritos sin códigos repetidos', () => {
 assert.equal(products.length, 270);
 assert.equal(new Set(products.map(product => product.code.toLowerCase())).size, 270);
 for (const code of ['T-063','P-270','L-222','H-001','D-018','A-162']) {
  assert.ok(products.some(product => product.code === code), `Falta ${code}`);
 }
});

test('las unidades usan el criterio confirmado', () => {
 assert.deepEqual(new Set(products.map(product => product.unit)), new Set(['kg','litro','unidad']));
 assert.equal(products.find(product => product.code === 'T-063')?.unit, 'litro');
 assert.equal(products.find(product => product.code === 'H-232')?.unit, 'kg');
 assert.equal(products.find(product => product.code === 'P-270')?.unit, 'unidad');
});

test('la actualización no borra catálogo ni crea saldos o movimientos', () => {
 assert.doesNotMatch(sql, /\b(delete\s+from|truncate\s+table|drop\s+table\s+public\.)/i);
 assert.doesNotMatch(sql, /insert\s+into\s+public\.(inventario|lotes|movimientos)\b/i);
 assert.match(sql, /No elimina ni desactiva productos anteriores/i);
 assert.match(sql, /where lower\(btrim\(p\.codigo\)\)=lower\(btrim\(r\.codigo\)\)/i);
 assert.match(sql, /commit;\s*-- Verificación independiente:/i);
 assert.doesNotMatch(sql, /commit;[\s\S]*select[\s\S]*from app_catalogo_actualizado/i);
});

test('la limpieza conserva historial y deja solo los 270 códigos vigentes activos', () => {
 const allowed = [...cleanupSql.matchAll(/\('([A-Z]-\d{3})'\)/g)].map(match => match[1]);
 assert.equal(allowed.length, 270);
 assert.equal(new Set(allowed).size, 270);
 assert.match(cleanupSql, /delete from public\.productos p/i);
 for (const relation of ['lotes','inventario','inventario_minimos','movimientos','recepcion_detalles','proveedor_productos']) {
  assert.match(cleanupSql,new RegExp(`not exists \\(select 1 from public\\.${relation} `,'i'));
 }
 assert.match(cleanupSql,/set estado=false[\s\S]*not exists/i);
 assert.doesNotMatch(cleanupSql,/delete\s+from\s+public\.(lotes|inventario|inventario_minimos|movimientos|recepcion_detalles|proveedor_productos)/i);
});

test('el reinicio definitivo elimina solo datos operativos ajenos a los 270 códigos reales', () => {
 const allowed = [...resetSql.matchAll(/\('([A-Z]-\d{3})'\)/g)].map(match => match[1]);
 assert.equal(allowed.length, 270);
 assert.equal(new Set(allowed).size, 270);
 for (const table of ['movimientos','inventario','inventario_minimos','recepcion_detalles','proveedor_productos','lotes','productos','recepciones','categorias']) {
  assert.match(resetSql,new RegExp(`delete from public\\.${table}\\b`,'i'),`Falta limpiar ${table}`);
 }
 assert.doesNotMatch(resetSql,/delete\s+from\s+(?:public\.)?(auth_perfiles|proveedores|sedes|auth\.users)/i);
 assert.match(resetSql,/productos_totales[\s\S]*productos_catalogo_real[\s\S]*productos_fuera_lista[\s\S]*categorias_totales/i);
});
