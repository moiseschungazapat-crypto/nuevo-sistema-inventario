import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADERS,DEFAULT_SPREADSHEET_ID,dateValue,numberValue,normalize,referenceValues} from '../supabase/functions/sincronizar-inventario-sheets/sheets.mjs';

test('la hoja operativa tiene secciones separadas y columnas de control',()=>{
 assert.equal(DEFAULT_SPREADSHEET_ID,'1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8');
 assert.deepEqual(Object.keys(HEADERS),['Recepciones','Salidas','Inventario actual','Catálogo','Proveedores','Alertas']);
 assert.ok(HEADERS.Recepciones.includes('ID interno'));assert.ok(HEADERS.Salidas.includes('Lotes usados'));
});
test('normaliza fechas, decimales y textos usados en la validación',()=>{
 assert.equal(dateValue('13/11/2026'),'2026-11-13');assert.equal(dateValue('2026-11-13'),'2026-11-13');assert.equal(dateValue('mal'),'');
 assert.equal(numberValue('12,5'),12.5);assert.ok(Number.isNaN(numberValue('x')));assert.equal(normalize('  Ají Amarillo '),'aji amarillo');
});
test('genera catálogos, inventario y alertas sin convertirlos en entradas',()=>{
 const result=referenceValues({categories:[{id:1,nombre:'Harinas'}],products:[{id:1,codigo:'H-001',nombre:'Harina',categoria_id:1,unidad_medida:'kg',es_perecible:false}],providers:[{nombre:'Proveedor',documento:'123'}],stock:[{codigo:'H-001',producto:'Harina',sede:'Central',lote:'L1',vencimiento:'2026-11-20',cantidad:2,unidad_medida:'kg',stock_minimo:5}]});
 assert.deepEqual(result.catalog[0],['H-001','Harina','Harinas','kg','No']);assert.equal(result.providers.length,1);assert.equal(result.inventory[0][8],'Bajo mínimo');assert.ok(result.alerts.some(row=>row[0]==='Stock bajo'));
});
