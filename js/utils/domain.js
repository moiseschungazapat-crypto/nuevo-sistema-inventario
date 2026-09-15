export const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 });
export const quantity = value => numberFormat.format(Number(value) || 0);
export const todayLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function expiryStatus(date, today = todayLima()) {
 if (!date) return { text: 'Sin vencimiento', tone: 'neutral' };
 if (date < today) return { text: 'Vencido', tone: 'danger' };
 const days = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
 return days <= 30 ? { text: days === 0 ? 'Vence hoy' : 'Vence en ' + days + ' días', tone: 'warning' } : { text: 'Vigente', tone: 'success' };
}
export function validateMovement(values) {
 if (!['entrada','salida','traslado','ajuste_positivo','ajuste_negativo'].includes(values.tipo)) throw new Error('Selecciona un tipo de movimiento.');
 const amount = Number(values.cantidad);
 if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999 || !/^\d+(\.\d{1,3})?$/.test(String(values.cantidad))) throw new Error('Ingresa una cantidad positiva con hasta 3 decimales.');
 if (!values.producto_id || !values.lote_id || !values.sede_id) throw new Error('Selecciona producto, lote y sede.');
 if (values.tipo === 'traslado' && (!values.destino_id || values.destino_id === values.sede_id)) throw new Error('El destino debe ser una sede diferente.');
 if (!(values.motivo || '').trim()) throw new Error('Indica el motivo del movimiento.');
 return { ...values, cantidad: amount, motivo: values.motivo.trim(), destino_id: values.tipo === 'traslado' ? values.destino_id : null };
}
export function csvContent(headers, rows) {
 const cell = value => {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
 };
 return '\uFEFF' + [headers, ...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
export function movementDelta(type) {
 return ['salida', 'ajuste_negativo'].includes(type) ? -1 : 1;
}
