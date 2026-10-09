const normalizeText = value => String(value || '')
 .normalize('NFD')
 .replace(/\p{Diacritic}/gu, '')
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, ' ')
 .trim();

const normalizeDigits = value => String(value || '').replace(/\D/g, '');

function compactNumericSpacing(value) {
 return String(value || '')
  .replace(/(\d)[ \t]+(?=\d)/g, '$1')
  .replace(/[ \t]*([\/.-])[ \t]*/g, '$1');
}

function invoiceKeywordCount(value) {
 return (String(value || '').match(/ruc|factura|boleta|fecha|total|igv|subtotal|cliente|cantidad/gi) || []).length;
}

function textScore(value) {
 const text = String(value || '');
 const keywords = invoiceKeywordCount(text);
 const digits = (text.match(/\d/g) || []).length;
 const letters = (text.match(/[a-záéíóúñ]/gi) || []).length;
 return keywords * 500 + digits * 2 + Math.min(letters, 300) * 0.1;
}

async function enhancedImage(file, rotation = 0, crop = false) {
 if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
 const bitmap = await createImageBitmap(file);
 const source = crop
  ? { x: bitmap.width * 0.03, y: bitmap.height * 0.16, width: bitmap.width * 0.94, height: bitmap.height * 0.68 }
  : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
 const scale = Math.min(3, Math.max(1, 2400 / Math.max(source.width, 1)));
 const canvas = document.createElement('canvas');
 const normalizedRotation = ((rotation % 360) + 360) % 360;
 const rotated = normalizedRotation === 90 || normalizedRotation === 270;
 const width = Math.max(1, Math.round(source.width * scale));
 const height = Math.max(1, Math.round(source.height * scale));
 canvas.width = rotated ? height : width;
 canvas.height = rotated ? width : height;
 const context = canvas.getContext('2d', { willReadFrequently: true });
 context.imageSmoothingEnabled = false;
 context.filter = 'grayscale(1) contrast(1.55) brightness(1.12)';
 context.translate(canvas.width / 2, canvas.height / 2);
 context.rotate(normalizedRotation * Math.PI / 180);
 context.drawImage(bitmap, source.x, source.y, source.width, source.height, -width / 2, -height / 2, width, height);
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
 } else if ((raw.match(/\./g) || []).length > 1) {
  const last = raw.lastIndexOf('.');
  normalized = `${raw.slice(0, last).replace(/\./g, '')}${raw.slice(last)}`;
 } else if (comma >= 0) {
  const decimals = raw.length - comma - 1;
  normalized = decimals === 1 || decimals === 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
 }
 const result = Number(normalized);
 return Number.isFinite(result) ? result : null;
}

function amountCandidates(value) {
 return [...String(value || '').matchAll(/(?:S\s*\/\s*|US\$\s*)?\d[\d.,]*(?:[.,]\d{2})/gi)]
  .map(match => ({ raw: match[0], value: parseAmount(match[0]) }))
  .filter(candidate => candidate.value != null);
}

function amountBesideLabel(text, labels) {
 const lines = String(text || '').split(/\r?\n/);
 for (const label of labels) {
  const expression = new RegExp(label, 'i');
  for (let index = 0; index < lines.length; index += 1) {
   const match = lines[index].match(expression);
   if (!match) continue;
   const afterLabel = lines[index].slice((match.index || 0) + match[0].length);
   const sameLine = amountCandidates(afterLabel);
   if (sameLine.length) return sameLine.at(-1).value;
   const nextLine = amountCandidates(lines[index + 1] || '');
   if (nextLine.length === 1) return nextLine[0].value;
  }
 }
 return null;
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

function prioritizedAmount(text, labels) {
 for (const label of labels) {
  const amount = amountBesideLabel(text, [label]) ?? firstAmount(text, label);
  if (amount != null) return amount;
 }
 return null;
}

function firstDate(text) {
 const labeled = String(text || '').match(/(?:fecha\s*(?:de\s*)?(?:emision|emisión)|emision|emisión)[^\d]{0,35}((?:\d{1,4}[\/.\-]){2}\d{1,4})/i);
 if (labeled) return toIsoDate(labeled[1]);
 const fallback = String(text || '').match(/\b(?:\d{1,4}[\/.\-]){2}\d{1,4}\b/);
 return fallback ? toIsoDate(fallback[0]) : null;
}

function dateAfterLabel(text, label) {
 const source = String(text || '');
 const match = source.match(label);
 if (!match) return null;
 const following = source.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 160);
 const date = following.match(/\b(?:\d{1,4}[\/.\-]){2}\d{1,4}\b/);
 return date ? toIsoDate(date[0]) : null;
}

function documentData(text) {
 const type = /nota\s*de\s*credito|nota\s*de\s*cr[eé]dito/i.test(text)
  ? 'Nota de crédito'
  : /boleta/i.test(text)
   ? 'Boleta'
   : /gu[ií]a\s*de\s*remisi[oó]n|gu[ií]a/i.test(text)
    ? 'Guía'
    : /factura/i.test(text) ? 'Factura' : null;
 const number = String(text || '').match(/\b([A-Z]\s*\d{3})\s*[-:#\s]\s*(\d{1,12})\b/i);
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

function productData(text, products, totals = {}) {
 const seen = new Set();
 const lines = String(text || '').split(/\r?\n/);
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
  .map(product => {
   const productName = normalizeText(product.nombre);
   let matchingIndex = lines.findIndex(line => normalizeText(line).includes(productName));
   if (matchingIndex < 0) matchingIndex = lines.findIndex(line => approximateLineMatch(line, product.nombre));
   const nearbyText = matchingIndex >= 0
    ? lines
     .slice(Math.max(0, matchingIndex - 3), matchingIndex + 4)
     .filter(line => !/ruc|fecha|factura|boleta|serie|sub\s*total|importe\s+total|\bigv\b/i.test(line))
     .join(' ')
    : '';
   const amounts = [...nearbyText.matchAll(/\b\d+(?:[.,]\d+)?\b/g)]
    .map(match => parseAmount(match[0]))
    .filter(value => value != null && value > 0);
   const quantity = amounts[0] ?? null;
   const calculatedPrice = quantity && totals.subtotal
    ? Number((totals.subtotal / quantity).toFixed(4))
    : null;
   const printedPrices = amounts.slice(1).filter(value => value < (totals.subtotal || Number.POSITIVE_INFINITY));
   return {
    code: product.codigo || null,
    name: product.nombre || null,
    description: null,
    quantity_invoiced: quantity,
    unit: product.unidad_medida || null,
    unit_price: printedPrices[0] ?? calculatedPrice,
    lot_code: null,
    expiration_date: null,
   };
  });
}

export function extractInvoice(text, providers, products) {
 const cleanedText = compactNumericSpacing(text);
 const document = documentData(cleanedText);
 const provider = providerData(cleanedText, providers);
 const totals = {
  subtotal: prioritizedAmount(text, ['sub\\s*total\\s*(?:ventas?)?', 'valor\\s+de\\s+venta', 'op\\.?\\s+gravada']),
  discount: prioritizedAmount(text, ['descuento']),
  tax: prioritizedAmount(text, ['\\bigv\\b', 'i\\.?g\\.?v\\.?']),
  total: prioritizedAmount(text, ['importe\\s+total', 'total\\s+a\\s+pagar', '(?:^|\\n)\\s*total']),
  withholding_percent: null,
  withholding_amount: null,
 };
 if (totals.total != null && totals.subtotal != null && totals.total < totals.subtotal) totals.total = null;
 if (totals.tax != null && totals.total != null && totals.tax > totals.total) totals.tax = null;
 const discount = totals.discount || 0;
 if (totals.total == null && totals.subtotal != null && totals.tax != null) {
  totals.total = Number((totals.subtotal - discount + totals.tax).toFixed(2));
 } else if (totals.tax == null && totals.subtotal != null && totals.total != null) {
  const calculatedTax = totals.total - totals.subtotal + discount;
  if (calculatedTax >= 0) totals.tax = Number(calculatedTax.toFixed(2));
 } else if (totals.subtotal == null && totals.tax != null && totals.total != null) {
  const calculatedSubtotal = totals.total - totals.tax + discount;
  if (calculatedSubtotal >= 0) totals.subtotal = Number(calculatedSubtotal.toFixed(2));
 }
 const items = productData(cleanedText, products, totals);
 const warnings = [
  'Lectura local: revisa todos los campos antes de guardar.',
  'Confirma la cantidad recibida y el lote antes de guardar.',
 ];
 if (!provider.name) warnings.push('El RUC no coincidió con un proveedor del catálogo; selecciónalo manualmente.');
 if (!items.length) warnings.push('No se reconocieron productos del catálogo. Si el nombre sí aparece en la factura, primero registra ese producto en Catálogo.');
 if (totals.total == null) warnings.push('No se identificó el total del comprobante.');
 const creditDays = String(text || '').match(/cr[eé]dito\D{0,20}(\d{1,3})\s*d[ií]as?/i);
 const dueDate = dateAfterLabel(text, /(?:fec(?:ha)?\.?\s*venc(?:imiento)?\.?|vence)/i);
 const issueTime = document.issue_date ? new Date(`${document.issue_date}T00:00:00Z`).getTime() : null;
 const dueTime = dueDate ? new Date(`${dueDate}T00:00:00Z`).getTime() : null;
 const calculatedDays = issueTime != null && dueTime != null ? Math.round((dueTime - issueTime) / 86400000) : null;
 const condition = creditDays
  ? `Crédito ${creditDays[1]} días`
  : calculatedDays > 0 && calculatedDays <= 365 ? `Crédito ${calculatedDays} días` : 'Crédito';
 const payment = /cr[eé]dito/i.test(text)
  ? { method: 'Crédito', condition, due_date: dueDate, status: 'Pendiente' }
  : /contado|efectivo/i.test(text)
   ? { method: 'Efectivo', condition: 'Contado', due_date: null, status: null }
   : { method: null, condition: null, due_date: null, status: null };
 return { provider, document, payment, totals, items, warnings };
}

function extractionScore(extraction) {
 const document = extraction.document || {};
 const totals = extraction.totals || {};
 const items = extraction.items || [];
 let score = 0;
 if (extraction.provider?.name) score += 500;
 if (document.series) score += 250;
 if (document.number) score += 250;
 if (document.issue_date) score += 250;
 if (totals.subtotal != null) score += 600;
 if (totals.tax != null) score += 600;
 if (totals.total != null) score += 800;
 if (totals.subtotal != null && totals.tax != null && totals.total != null) {
  const expected = totals.subtotal - (totals.discount || 0) + totals.tax;
  if (Math.abs(expected - totals.total) <= Math.max(0.1, totals.total * 0.005)) score += 1800;
 }
 for (const item of items) {
  score += 700;
  if (item.quantity_invoiced != null) score += 350;
  if (item.unit_price != null) score += 350;
 }
 return score;
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
  await worker.setParameters?.({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
  const texts = [];
  for (let index = 0; index < files.length; index += 1) {
   onProgress(0, index + 1, files.length);
   const original = (await worker.recognize(files[index]))?.data?.text || '';
   const candidates = [original];
   const enhanced = await enhancedImage(files[index]);
   candidates.push((await worker.recognize(enhanced))?.data?.text || '');
   await worker.setParameters?.({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
   const cropped = await enhancedImage(files[index], 0, true);
   candidates.push((await worker.recognize(cropped))?.data?.text || '');
   await worker.setParameters?.({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
   if (Math.max(...candidates.map(invoiceKeywordCount)) < 3) {
    for (const rotation of [90, 270]) {
     const prepared = await enhancedImage(files[index], rotation);
     candidates.push((await worker.recognize(prepared))?.data?.text || '');
    }
   }
   const ranked = candidates
    .map(text => ({ text, extraction: extractInvoice(text, providers, products) }))
    .sort((a, b) => extractionScore(b.extraction) - extractionScore(a.extraction) || textScore(b.text) - textScore(a.text));
   texts.push(ranked[0].text);
  }
  const text = texts.filter(Boolean).join('\n');
  if (!text.trim()) throw new Error('El OCR no pudo leer texto. Usa una foto nítida, bien iluminada y sin inclinación.');
  return { text, extraction: extractInvoice(text, providers, products) };
 } finally {
  await worker.terminate();
 }
}
