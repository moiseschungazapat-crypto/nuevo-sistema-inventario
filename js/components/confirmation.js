let pending = false;

export async function confirmAction({ title = 'Confirmar acción', message, danger = false }) {
 if (pending) return false;
 pending = true;
 const previousFocus = document.activeElement;
 const dialog = document.createElement('dialog');
 dialog.className = 'confirmation-dialog';
 dialog.setAttribute('aria-labelledby', 'confirmation-title');
 dialog.setAttribute('aria-describedby', 'confirmation-message');
 dialog.innerHTML = `<h2 id="confirmation-title"></h2><p id="confirmation-message"></p><div class="dialog-footer"><button type="button" class="button" data-confirm-no autofocus>No</button><button type="button" class="button primary" data-confirm-yes>Sí</button></div>`;
 dialog.querySelector('h2').textContent = title;
 dialog.querySelector('p').textContent = message;
 dialog.querySelector('[data-confirm-yes]').classList.toggle('danger-action', danger);
 document.body.append(dialog);
 try {
  return await new Promise(resolve => {
   let accepted = false;
   dialog.querySelector('[data-confirm-no]').onclick = () => dialog.close();
   dialog.querySelector('[data-confirm-yes]').onclick = () => { accepted = true; dialog.close(); };
   dialog.addEventListener('close', () => resolve(accepted), { once: true });
   dialog.showModal();
  });
 } finally {
  dialog.remove();
  pending = false;
  if (previousFocus?.isConnected) previousFocus.focus();
 }
}
