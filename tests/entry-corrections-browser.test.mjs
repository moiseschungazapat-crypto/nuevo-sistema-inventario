import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

test('administrador corrige una entrada, revisa historial y puede recuperar una anulada',async()=>{
 const root=resolve('.');
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/js/supabase.js',route=>route.fulfill({contentType:'text/javascript',path:resolve(root,'tests/fixtures/supabase-browser.js')}));
  const base='http://127.0.0.1:'+server.address().port;
  const submit=async()=>{await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});};
  await page.goto(base+'/recepciones.html');await page.locator('#new-reception').click();
  await page.locator('[name=proveedor_id]').selectOption('pr1');await page.locator('[name=categoria_0]').selectOption('c1');await page.locator('[name=producto_0]').selectOption('p1');await page.locator('[name=recibida_0]').fill('10');await page.locator('[name=costo_0]').fill('2.5');await submit();
  await page.locator('[data-reception-correct]').click();
  await page.locator('[name=entrada]').selectOption({index:1});await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor-title').getByText('Corregir entrada',{exact:true}).waitFor();
  await page.locator('[name=cantidad]').fill('8');await page.locator('[name=costo]').fill('3');await page.locator('[name=motivo]').fill('Se verificaron ocho kilos en la entrega.');
  assert.match(await page.locator('[data-correction-preview]').innerText(),/24[,.]00/);
  await mkdir(resolve(root,'test-results'),{recursive:true});await page.screenshot({path:resolve(root,'test-results/corregir-entrada.png')});
  await submit();await page.waitForFunction(()=>localStorage.getItem('test-inventory-sync-body'));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-inventory-sync-body'))),{refreshOnly:true});
  await page.goto(base+'/gastos.html');await page.locator('[data-entry-correct]').click();
  await page.getByText('Historial de correcciones',{exact:true}).click();assert.match(await page.locator('#editor details').innerText(),/Se verificaron ocho kilos en la entrega\./);
  await page.locator('[name=cantidad]').fill('0');await page.locator('[name=motivo]').fill('Ingreso duplicado comprobado.');await submit();
  await page.locator('#expense-results').getByText('No hay gastos registrados para este período y filtros.',{exact:true}).waitFor();
  await page.locator('#correct-entry').click();assert.match(await page.locator('[name=entrada]').innerText(),/Anulada/);
  await page.locator('[name=entrada]').selectOption({index:1});await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor-title').getByText('Corregir entrada',{exact:true}).waitFor();
  await page.locator('[name=cantidad]').fill('5');await page.locator('[name=costo]').fill('4');await page.locator('[name=motivo]').fill('Restituido tras verificar el ingreso.');await submit();
  assert.match(await page.locator('#expense-kpis').innerText(),/20[,.]00/);
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('browser-test-database')));
  assert.equal(result.recepcion_detalles[0].cantidad_recibida,10);assert.equal(result.gastos[0].cantidad,5);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-entry-correct]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(root,'test-results/corregir-entrada-mobile.png')});
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('browser-test-database'));d.auth_perfiles[0].rol='operador';localStorage.setItem('browser-test-database',JSON.stringify(d));});
  await page.goto(base+'/recepciones.html');await page.locator('#new-reception').waitFor();assert.equal(await page.locator('[data-reception-correct]').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
