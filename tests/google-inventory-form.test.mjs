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

test('la vista previa se calcula sin fórmulas dependientes del idioma de Google Sheets',()=>{
 assert.match(script,/function actualizarVistaPrevia_/);
 assert.match(script,/function stockActual_/);
 assert.match(script,/stockDespues:\s*'H9'/);
 assert.match(script,/celda === INVENTARIO_CONFIG\.celdas\.cantidad/);
});

test('las franjas grandes funcionan como botones al seleccionarlas',()=>{
 assert.match(script,/function onSelectionChange\(e\)/);
 assert.match(script,/columna >= 2 && columna <= 4/);
 assert.match(script,/columna >= 6 && columna <= 8/);
 assert.match(script,/return registrarMovimiento\(\)/);
 assert.match(script,/return limpiarFormulario\(\)/);
});

test('puede instalar botones flotantes con un clic real',()=>{
 assert.match(script,/function instalarBotonesVisuales\(\)/);
 assert.match(script,/\.assignScript\('registrarMovimiento'\)/);
 assert.match(script,/\.assignScript\('limpiarFormulario'\)/);
 assert.match(script,/\.addItem\('Instalar botones visuales'/);
 assert.match(script,/hoja\.setRowHeight\(15, 72\)/);
 assert.match(script,/getRange\('A15:H15'\)\.clearContent\(\)\.clearDataValidations\(\)/);
});

test('los botones muestran una respuesta visual al hacer clic',()=>{
 assert.match(script,/function animarBoton_\(accion\)/);
 assert.match(script,/animarBoton_\('registrar'\)/);
 assert.match(script,/animarBoton_\('limpiar'\)/);
 assert.match(script,/\.setWidth\(408\)/);
 assert.match(script,/Utilities\.sleep\(180\)/);
 assert.match(script,/Validando el movimiento…/);
});

test('la sincronización procesa una única tabla de movimientos',()=>{
 assert.match(sync,/MOVEMENT_SHEET/);
 assert.match(sync,/pendingMovementRows/);
 assert.doesNotMatch(sync,/'Recepciones'!A2/);
 assert.doesNotMatch(sync,/'Salidas'!A2/);
 assert.match(sync,/type==='entrada'/);
 assert.match(sync,/app_registrar_salida_fefo_google_sheets/);
});
