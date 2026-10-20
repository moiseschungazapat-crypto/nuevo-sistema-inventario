import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

test('confirmaciones protegen guardar, editar, cancelar y quitar productos', async () => {
 const root = fileURLToPath(new URL('..', import.meta.url));
 const server = createServer(async (req, res) => {
  try {
   const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
   if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
   res.setHeader('Content-Type', {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png'}[extname(path)] || 'text/plain');
   res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(done => server.listen(0, '127.0.0.1', done));
 let browser;
 try {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined)});
  const context = await browser.newContext();
  const fixture = (await readFile(new URL('./fixtures/supabase-browser.js', import.meta.url), 'utf8'))
   .replace("if(name==='app_mi_acceso')", "if(name==='app_listar_recepciones')return {data:[],error:null}; if(name==='app_mi_acceso')");
  await context.route('**/js/supabase.js', route => route.fulfill({contentType:'text/javascript', body:fixture}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:' + server.address().port;
  const answer = async yes => {
   await page.locator(yes ? '[data-confirm-yes]' : '[data-confirm-no]').click();
   await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  };
  await page.goto(base + '/proveedores.html');
  await page.locator('#new-record').click();
  await page.locator('[name=nombre]').fill('Proveedor de prueba');
  await page.locator('#save-editor').click();
  assert.match(await page.locator('#confirmation-message').textContent(), /guardar/);
  await answer(false);
  assert.equal(await page.locator('[name=nombre]').inputValue(), 'Proveedor de prueba');
  assert.equal(await page.locator('#results').getByText('Proveedor de prueba', {exact:true}).count(), 0);
  await page.locator('#save-editor').click();
  await answer(true);
  await page.locator('#editor').waitFor({state:'hidden'});
  const row = page.locator('tr').filter({hasText:'Proveedor de prueba'});
  await row.getByRole('button', {name:'Editar'}).click();
  await answer(false);
  assert.equal(await page.locator('#editor').isVisible(), false);
  await row.getByRole('button', {name:'Editar'}).click();
  await answer(true);
  await page.locator('[name=nombre]').fill('Cambios sin guardar');
  for (const close of ['#cancel-editor', '#close-editor', 'Escape']) {
   if (close === 'Escape') await page.keyboard.press('Escape');
   else await page.locator(close).click();
   await answer(false);
   assert.equal(await page.locator('[name=nombre]').inputValue(), 'Cambios sin guardar');
  }
  await page.locator('#save-editor').click();
  await page.keyboard.press('Escape');
  await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('#editor').isVisible(), true);
  await page.locator('#cancel-editor').click();
  await answer(true);
  await page.locator('#editor').waitFor({state:'hidden'});
  assert.match(await row.innerText(), /Proveedor de prueba/);

  // Every section using the shared editor must ask before discarding its form.
  for (const [section, button] of [['catalogo','new-category'], ['recepciones','new-lot'], ['movimientos','new-movement'], ['usuarios','new-user'], ['recepciones','new-reception']]) {
   await page.goto(base + '/' + section + '.html');
   await page.locator('#' + button).click();
   await page.locator('#cancel-editor').click();
   await answer(false);
   assert.equal(await page.locator('#editor').isVisible(), true);
   if (button === 'new-reception') {
    await page.locator('#add-reception-line').click();
    assert.equal(await page.locator('[data-reception-line]').count(), 2);
    await page.locator('[data-remove-line]:visible').click();
    await answer(false);
    assert.equal(await page.locator('[data-reception-line]').count(), 2);
    await page.locator('[data-remove-line]:visible').click();
    await answer(true);
    assert.equal(await page.locator('[data-reception-line]').count(), 1);
   }
   await page.locator('#cancel-editor').click();
   await answer(true);
   await page.locator('#editor').waitFor({state:'hidden'});
  }
  assert.deepEqual(errors, []);
 } finally {
  await browser?.close();
  await new Promise(done => server.close(done));
 }
});
