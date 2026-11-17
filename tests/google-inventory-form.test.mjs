import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const script=await fs.readFile(new URL('../google-apps-script/inventario-operativo.gs',import.meta.url),'utf8');
const sync=await fs.readFile(new URL('../supabase/functions/sincronizar-inventario-sheets/sync.mjs',import.meta.url),'utf8');

test('el formulario ofrece controles compatibles con computadora y celular',()=>{
 assert.match(script,/function onOpen\(\)/);
 assert.match(script,/function onEdit\(e\)/);
 assert.match(script,/function registrarMovimiento\(\)/);
 assert.match(script,/function limpiarFormulario\(\)/);
 assert.match(script,/requireValueInList\(codigos/);
 assert.match(script,/Utilities\.getUuid\(\)/);
});

test('la sincronización procesa una única tabla de movimientos',()=>{
 assert.match(sync,/MOVEMENT_SHEET/);
 assert.match(sync,/pendingMovementRows/);
 assert.doesNotMatch(sync,/'Recepciones'!A2/);
 assert.doesNotMatch(sync,/'Salidas'!A2/);
 assert.match(sync,/type==='entrada'/);
 assert.match(sync,/app_registrar_salida_fefo_google_sheets/);
});
