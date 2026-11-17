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

test('las franjas antiguas ya no ejecutan acciones invisibles',()=>{
 assert.doesNotMatch(script,/function onSelectionChange\(e\)/);
});

test('conserva el instalador anterior solo para poder reemplazarlo',()=>{
 assert.match(script,/function instalarBotonesVisuales\(\)/);
 assert.match(script,/\.assignScript\('registrarMovimiento'\)/);
 assert.match(script,/\.assignScript\('limpiarFormulario'\)/);
 assert.doesNotMatch(script,/\.addItem\('Instalar botones visuales'/);
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

test('incluye un panel lateral HTML con hover y estados de procesamiento',()=>{
 assert.match(script,/\.addItem\('Abrir panel interactivo', 'abrirPanelInventario'\)/);
 assert.match(script,/function abrirPanelInventario\(\)/);
 assert.match(script,/showSidebar\(html\)/);
 assert.match(script,/button:hover,button:focus-visible/);
 assert.match(script,/Procesando…/);
 assert.match(script,/function obtenerResumenFormulario\(\)/);
 assert.match(script,/function registrarDesdePanel\(\)/);
 assert.match(script,/function limpiarDesdePanel\(\)/);
 assert.match(script,/function retirarBotonesVisuales_\(\)/);
});

test('la sincronización procesa una única tabla de movimientos',()=>{
 assert.match(sync,/MOVEMENT_SHEET/);
 assert.match(sync,/pendingMovementRows/);
 assert.doesNotMatch(sync,/'Recepciones'!A2/);
 assert.doesNotMatch(sync,/'Salidas'!A2/);
 assert.match(sync,/type==='entrada'/);
 assert.match(sync,/app_registrar_salida_fefo_google_sheets/);
});
