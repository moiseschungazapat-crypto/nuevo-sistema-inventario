import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvoice } from '../js/services/local-ocr.js';

test('extrae importes, crédito y panceta de la factura E001-839', () => {
 const text = `CHAVEZ ARANA GIANCARLO
RUC: 10806011601
FACTURA ELECTRONICA E001-839
Fecha de Emisión : 05/05/2026
Forma de pago: Crédito
Cantidad Unidad Medida Descripción Valor Unitario ICBPER
127.20 KILOGRAMO PANCETA 26.27 0.00
Sub Total Ventas : S/ 3,341.54
Descuentos : S/ 0.00
IGV : S/ 601.48
Importe Total : S/ 3,943.02
N° Cuota Fec. Venc. Monto
1 12/05/2026 3,943.02`;
 const result = extractInvoice(
  text,
  [{ nombre: 'Chávez Arana Giancarlo', documento: '10806011601' }],
  [{ id: 'panceta', codigo: 'PANCETA', nombre: 'Panceta', estado: true, unidad_medida: 'kg' }],
 );

 assert.deepEqual(result.totals, {
  subtotal: 3341.54,
  discount: 0,
  tax: 601.48,
  total: 3943.02,
  withholding_percent: null,
  withholding_amount: null,
 });
 assert.equal(result.payment.condition, 'Crédito 7 días');
 assert.equal(result.payment.due_date, '2026-05-12');
 assert.equal(result.items[0].quantity_invoiced, 127.2);
 assert.equal(result.items[0].unit_price, 26.27);
});

test('conserva la extracción de la factura anterior de carne molida', () => {
 const text = `CARNICERÍA NAVARRO E.I.R.L. RUC 20544908368
FACTURA ELECTRONICA E001-2402
Fecha de emisión 03/05/2026
Moneda SOLES Condición CONTADO
24.00 KILOGRAMO CARNE MOLIDA 24.5763
Sub Total Ventas S/ 589.83
IGV S/ 106.17
Importe Total S/ 696.00`;
 const result = extractInvoice(
  text,
  [{ nombre: 'Carnicería Navarro E.I.R.L.', documento: '20544908368' }],
  [{ id: 'carne', codigo: 'CARNE-MOLIDA', nombre: 'Carne molida', estado: true, unidad_medida: 'kg' }],
 );

 assert.equal(result.totals.subtotal, 589.83);
 assert.equal(result.totals.tax, 106.17);
 assert.equal(result.totals.total, 696);
 assert.equal(result.items[0].quantity_invoiced, 24);
 assert.equal(result.items[0].unit_price, 24.5763);
});
