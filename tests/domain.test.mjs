import test from 'node:test';
import assert from 'node:assert/strict';
import { expiryStatus,validateMovement,csvContent } from '../js/utils/domain.js';
test('vencimientos usan días y límites de 30 días',()=>{
 assert.equal(expiryStatus('2026-09-14','2026-09-15').tone,'danger');
 assert.equal(expiryStatus('2026-09-15','2026-09-15').text,'Vence hoy');
 assert.equal(expiryStatus('2026-10-15','2026-09-15').tone,'warning');
 assert.equal(expiryStatus('2026-10-16','2026-09-15').tone,'success');
});
test('movimiento no permite cantidades inválidas o traslado a la misma sede',()=>{
 const base={tipo:'entrada',cantidad:'1.250',producto_id:'a',lote_id:'b',sede_id:'c',motivo:' Recepción '};
 assert.equal(validateMovement(base).cantidad,1.25);
 for(const cantidad of ['-1','0','Infinity','1.0001','abc'])assert.throws(()=>validateMovement({...base,cantidad}));
 assert.throws(()=>validateMovement({...base,tipo:'traslado',destino_id:'c'}));
 assert.throws(()=>validateMovement({...base,motivo:'   '}));
});
test('CSV escapa celdas, fórmulas y saltos de línea',()=>{
 const csv=csvContent(['Nombre'],[['=CMD()'],[' @SUM(1)'],['Con "comillas"\ny salto']]);
 assert.ok(csv.includes(`"'=CMD()"`));assert.ok(csv.includes(`"' @SUM(1)"`));
 assert.ok(csv.includes('""comillas""'));
});
