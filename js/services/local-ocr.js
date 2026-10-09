const normalizeText = value => String(value || '')
 .normalize('NFD')
 .replace(/\p{Diacritic}/gu, '')
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, ' ')
 .trim();

const normalizeDigits = value => String(value || '').replace(/\D/g, '');

function compactNumericSpacing(value) {
 return String(value || '')
  .replace(/(\d)\s+(?=\d)/g, '$1')
  .replace(/\s*([\/.-])\s*/g, '$1');
}

function textScore(value) {
 const text = String(value || '');
 const keywords = (text.match(/ruc|factura|boleta|fecha|total|igv|subtotal|producto|cantidad/gi) || []).length;
 const digits = (text.match(/\d/g) || []).length;
 const letters = (text.match(/[a-záéíóúñ]/gi) || []).length;
 return keywords * 50 + digits * 3 + Math.min(letters, 300) * 0.2;
}

async function enhancedImage(file) {
 if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
 const bitmap = await createImageBitmap(file);
 const scale = Math.min(3, Math.max(1, 2200 / Math.max(bitmap.width, 1)));
 const canvas = document.createElement('canvas');
 canvas.width = Math.max(1, Math.round(bitmap.width * scale));
 canvas.height = Math.max(1, Math.round(bitmap.height * scale));
 const context = canvas.getContext('2d', { willReadFrequently: true });
 context.imageSmoothingEnabled = false;
 context.filter = 'grayscale(1) contrast(1.35) brightness(1.08)';
 context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
 bitmap.close?.();
 return canvas;
}

function parseAmount(value) {
 const raw = String(value || '').replace(/[^0-9.,-]/g, '');
 if (!raw) return null;
 let normalized = raw;
 const comma = raw.lastIndexOf(',');
 const dot = raw.lastIndexOf('.');
 if (comma >= 0 && dot >= 0) {
  normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
 } else if (comma >= 0) {
  const decimals = raw.length - comma - 1;
  normalized = decimals === 1 || decimals === 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
 }
 const result = Number(normalized);
 return Number.isFinite(result) ? result : null;
}

function toIsoDate(value) {
 const match = String(value || '').match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);
 if (!match) return null;
 let [, first, second, third] = match;
 let year, month, day;
 if (first.length === 4) { year = first; month = second; day = third; }
 else { day = first; month = second; year = third; }
 if (year.length === 2) year = `20${year}`;
 if (year.length !== 4) return null;
 const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
 const parsed = new Date(`${iso}T00:00:00Z`);
 return Number.isNaN(parsed.getTime()) ? null : iso;
}

function firstAmount(text, labels) {
 const pattern = new RegExp(`(?:${labels})[^\\d]{0,35}([0-9][0-9.,]*)`, 'i');
 const match = String(text || '').match(pattern);
 return match ? parseAmount(match[1]) : null;
}

function firstDate(text) {
 const labeled = String(text || '').match(/(?:fecha\s*(?:de\s*)?(?:emision|emisión)|emision|emisión)[^\d]{0,35}((?:\d{1,4}[\/.\-]){2}\d{1,4})/i);
 if (labeled) return toIsoDate(labeled[1]);
 const fallback = String(text || '').match(/\b(?:\d{1,4}[\/.\-]){2}\d{1,4}\b/);
 return fallback ? toIsoDate(fallback[0]) : null;
}

function documentData(text) {
 const type = /nota\s*de\s*credito|nota\s*de\s*cr[eé]dito/i.test(text)
  ? 'Nota de crédito'
  : /boleta/i.test(text)
   ? 'Boleta'
   : /gu[ií]a\s*de\s*remisi[oó]n|gu[ií]a/i.test(text)
    ? 'Guía'
    : /factura/i.test(text) ? 'Factura' : null;
 const number = String(text || '').match(/\b([FB]\s*\d{3})\s*[-:#\s]\s*(\d{1,12})\b/i);
 return {
  type,
  series: number ? number[1].replace(/\s/g, '') : null,
  number: number ? number[2] : null,
  issue_date: firstDate(text),
  currency: /\b(?:USD|US\$|D[oó]lares?)\b/i.test(text) ? 'USD' : /\b(?:PEN|S\/\.?|soles?)\b/i.test(text) ? 'PEN' : null,
  guide_number: null,
  purchase_order: null,
 };
}

function providerData(text, providers) {
 const compact = compactNumericSpacing(text);
 const candidates = [...compact.matchAll(/\b\d{11}\b/g)].map(match => match[0]);
 const lineCandidates = String(text || '').split(/\r?\n/).flatMap(line => {
  const digits = normalizeDigits(line);
  return digits.length >= 11 ? Array.from({ length: digits.length - 10 }, (_, index) => digits.slice(index, index + 11)) : [];
 });
 candidates.push(...lineCandidates);
 const knownByRuc = providers.find(row => candidates.includes(normalizeDigits(row.documento)));
 const knownByName = providers.find(row => approximateLineMatch(text, row.nombre));
 const known = knownByRuc || knownByName;
 const ruc = known?.documento || candidates[0] || null;
 return { name: known?.nombre || null, ruc };
}

function editDistance(first, second) {
 const a = String(first || ''), b = String(second || '');
 const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
 for (let i = 1; i <= a.length; i += 1) {
  const current = [i];
  for (let j = 1; j <= b.length; j += 1) {
   current[j] = Math.min(
    current[j - 1] + 1,
    previous[j] + 1,
    previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
   );
  }
  for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
 }
 return previous[b.length];
}

function approximateLineMatch(text, phrase) {
 const target = normalizeText(phrase);
 if (!target || target.length < 5) return false;
 if (normalizeText(text).includes(target)) return true;
 return String(text || '').split(/\r?\n/).some(line => {
  const candidate = normalizeText(line);
  if (!candidate) return false;
  const distance = editDistance(candidate, target);
  return distance / Math.max(candidate.length, target.length) <= (target.length > 14 ? 0.35 : 0.25);
 });
}

function productData(text, products) {
 const seen = new Set();
 return products
  .filter(product => product.estado && (product.nombre || product.codigo))
  .sort((a, b) => normalizeText(b.nombre).length - normalizeText(a.nombre).length)
  .filter(product => {
   const name = normalizeText(product.nombre);
   const code = normalizeText(product.codigo);
   const found = (name.length >= 4 && approximateLineMatch(text, product.nombre)) || (code && normalizeText(text).includes(code));
   if (!found || seen.has(product.id)) return false;
   seen.add(product.id);
   return true;
  })
  .slice(0, 50)
  .map(product => ({
   code: product.codigo || null,
   name: product.nombre || null,
   description: null,
   quantity_invoiced: null,
   unit: product.unidad_medida || null,
   unit_price: null,
   lot_code: null,
   expiration_date: null,
  }));
}

function extractInvoice(text, providers, products) {
 const cleanedText = compactNumericSpacing(text);
 const document = documentData(cleanedText);
 const provider = providerData(cleanedText, providers);
 const items = productData(cleanedText, products);
 const warnings = [
  'Lectura local: revisa todos los campos antes de guardar.',
  'Las cantidades facturadas, recibidas, precios y lotes deben confirmarse manualmente.',
 ];
 if (!provider.name) warnings.push('El RUC no coincidió con un proveedor del catálogo; selecciónalo manualmente.');
 if (!items.length) warnings.push('No se reconocieron productos del catálogo en el texto leído.');
 const totals = {
  subtotal: firstAmount(text, 'subtotal|valor\s+de\s+venta|op\.?\s+gravada'),
  discount: firstAmount(text, 'descuento'),
  tax: firstAmount(text, 'igv|i\.?g\.?v\.?'),
  total: firstAmount(text, 'importe\s+total|total\s+a\s+pagar|total'),
  withholding_percent: null,
  withholding_amount: null,
 };
 if (totals.total == null) warnings.push('No se identificó el total del comprobante.');
 const payment = /cr[eé]dito/i.test(text)
  ? { method: 'Crédito', condition: null, due_date: null, status: null }
  : /contado|efectivo/i.test(text)
   ? { method: 'Efectivo', condition: 'Contado', due_date: null, status: null }
   : { method: null, condition: null, due_date: null, status: null };
 return { provider, document, payment, totals, items, warnings };
}

export async function analyzeInvoiceLocally(files, { providers = [], products = [], onProgress = () => {} } = {}) {
 if (!globalThis.Tesseract?.createWorker) {
  throw new Error('No se pudo cargar el motor OCR gratuito. Revisa tu conexión a internet y vuelve a intentarlo.');
 }
 const unsupported = files.find(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
 if (unsupported) {
  throw new Error('El OCR gratuito acepta imágenes JPG, PNG o WEBP. Convierte el PDF a una imagen para analizarlo; el PDF sí podrá guardarse como comprobante.');
 }
 const worker = await globalThis.Tesseract.createWorker('spa', 1, {
  logger: message => {
   if (message.status === 'recognizing text' && Number.isFinite(message.progress)) {
    onProgress(Math.round(message.progress * 100));
   }
  },
 });
 try {
  await worker.setParameters?.({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  const texts = [];
  for (let index = 0; index < files.length; index += 1) {
   onProgress(0, index + 1, files.length);
   const original = (await worker.recognize(files[index]))?.data?.text || '';
   let best = original;
   if (textScore(original) < 100) {
    const prepared = await enhancedImage(files[index]);
    const enhanced = (await worker.recognize(prepared))?.data?.text || '';
    if (textScore(enhanced) > textScore(best)) best = enhanced;
   }
   texts.push(best);
  }
  const text = texts.filter(Boolean).join('\n');
  if (!text.trim()) throw new Error('El OCR no pudo leer texto. Usa una foto nítida, bien iluminada y sin inclinación.');
  return { text, extraction: extractInvoice(text, providers, products) };
 } finally {
  await worker.terminate();
 }
}
