import { escapeHtml as e } from '../utils/html.js';
import { message } from '../services/data.js';
export { e };
export function notice(text, error = false) {
 const node = document.getElementById('notice'); node.textContent = text;
 node.className = error ? 'notice error' : 'notice'; node.hidden = false;
 clearTimeout(notice.timer); notice.timer = setTimeout(()=>node.hidden=true, error ? 12000 : 5000);
}
export function heading(title, subtitle, actions = '') {
 return `<div class="page-heading"><div><p class="eyebrow">GESTIÓN DE INVENTARIO</p><h1>${e(title)}</h1><p class="muted">${e(subtitle)}</p></div><div class="actions">${actions}</div></div><div id="load-error" role="alert" class="load-error" hidden></div>`;
}
export function loadError(error) {
 const node = document.getElementById('load-error');
 if (node) { node.textContent = error ? message(error) + ' Los datos visibles pueden estar desactualizados.' : ''; node.hidden = !error; }
}
export function badge(label, tone = 'neutral') { return `<span class="pill ${tone}">${e(label)}</span>`; }
export function table(headers, rows, empty = 'No hay registros para estos filtros.') {
 return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('') : `<tr><td colspan="${headers.length}" class="empty-message">${e(empty)}</td></tr>`}</tbody></table></div>`;
}
export function options(rows, selected = '', placeholder = 'Seleccionar…', label = row=>row.nombre) {
 return `<option value="">${e(placeholder)}</option>` + rows.map(row=>`<option value="${e(row.id)}" ${String(row.id)===String(selected)?'selected':''}>${e(label(row))}</option>`).join('');
}
export function field(name, label, { value='', type='text', required=false, choices, min, step, maxLength=200, help='' } = {}) {
 let input;
 if (choices !== undefined) input = `<select name="${name}" ${required?'required':''}>${choices}</select>`;
 else if (type === 'textarea') input = `<textarea name="${name}" maxlength="${maxLength}" ${required?'required':''}>${e(value)}</textarea>`;
 else input = `<input name="${name}" type="${type}" value="${e(value)}" ${required?'required':''} ${min!==undefined?'min="'+min+'"':''} ${step?'step="'+step+'"':''} maxlength="${maxLength}">`;
 return `<label class="field">${e(label)}${input}${help?'<small>'+e(help)+'</small>':''}</label>`;
}
export function openEditor({title, fields, save, setup}) {
 const dialog = document.getElementById('editor'), form = document.getElementById('editor-form');
 document.getElementById('editor-title').textContent = title;
 document.getElementById('editor-fields').innerHTML = fields;
 const error = document.getElementById('editor-error'); error.textContent = '';
 const button = document.getElementById('save-editor'); button.disabled = false; button.textContent = 'Guardar';
 let busy = false;
 const close = () => { if (!busy) dialog.close(); };
 document.getElementById('close-editor').onclick = close;
 document.getElementById('cancel-editor').onclick = close;
 dialog.oncancel = event => { if (busy) event.preventDefault(); };
 form.onsubmit = async event => {
  event.preventDefault(); if (busy || !form.reportValidity()) return;
  busy = true; button.disabled = true; button.textContent = 'Guardando…'; error.textContent = '';
  try {
   const values = Object.fromEntries(new FormData(form));
   await save(values); dialog.close();
  } catch (err) { error.textContent = message(err); }
  finally { busy = false; button.disabled = false; button.textContent = 'Guardar'; }
 };
 setup?.(form);
 dialog.showModal();
}
export function pager(node, total, page, pageSize, change) {
 const pages = Math.max(1, Math.ceil(total/pageSize));
 node.innerHTML = `<span>${total} registros · Página ${page+1} de ${pages}</span><div class="actions"><button class="button" data-prev ${page===0?'disabled':''}>Anterior</button><button class="button" data-next ${page+1>=pages?'disabled':''}>Siguiente</button></div>`;
 node.querySelector('[data-prev]').onclick = ()=>change(page-1);
 node.querySelector('[data-next]').onclick = ()=>change(page+1);
}
