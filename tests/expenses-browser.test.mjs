import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

test('gastos: entradas con costo, reporte sin pendientes y acceso restringido en navegador',async()=>{
 const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
 const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error('path');
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain');res.end(await readFile(path));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 let browser;
 try{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/js/supabase.js',route=>route.fulfill({contentType:'text/javascript',path:resolve(root,'tests/fixtures/supabase-browser.js')}));
  const url='http://127.0.0.1:'+server.address().port+'/gastos.html';
  await page.goto(url);await page.locator('#new-expense').waitFor();
  assert.equal(await page.locator('#expense-state, #expense-budget, [data-expense-pay]').count(),0);
  await page.locator('#new-expense').click();
  await page.locator('[name=concepto]').fill('Servicio de limpieza');await page.locator('[name=monto]').fill('1200');
  await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.match(await page.locator('#expense-results').innerText(),/Servicio de limpieza/);
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/recepciones.html');await page.locator('#new-reception').click();
  await page.locator('[name=proveedor_id]').selectOption('pr1');await page.locator('[name=categoria_0]').selectOption('c1');await page.locator('[name=producto_0]').selectOption('p1');await page.locator('[name=recibida_0]').fill('4');await page.locator('[name=costo_0]').fill('2.5');
  assert.match(await page.locator('[data-line-total]').innerText(),/10[,.]00/);
  await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});
  await page.goto(url);await page.locator('#expense-results').getByText('Harina de trigo',{exact:true}).waitFor();
  assert.match(await page.locator('#expense-kpis').innerText(),/1[,.]210/);
  assert.equal(await page.locator('[data-expense-edit]').count(),1);
  await page.locator('#expense-search').fill('Harina');
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-expenses').click();const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^gastos-\d{4}-\d{2}\.xlsx$/);
  const report=await readFile(await download.path());assert.match(report.toString('utf8'),/TOTAL GASTADO/);assert.match(report.toString('utf8'),/Harina de trigo/);assert.doesNotMatch(report.toString('utf8'),/Servicio de limpieza/);
  await page.locator('#expense-search').fill('');
  await mkdir(resolve(root,'test-results'),{recursive:true});await page.screenshot({path:resolve(root,'test-results/gastos-desktop.png'),fullPage:true});
  await page.locator('#theme-toggle').click();await page.screenshot({path:resolve(root,'test-results/gastos-dark.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.reload();await page.locator('#expense-kpis .kpi-card').first().waitFor();
  await page.screenshot({path:resolve(root,'test-results/gastos-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('main, .panel, .toolbar, .kpi-card, .kpi-grid, .page-heading, .main-wrapper, .table-scroll')).map(el=>({cl:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})))));
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('browser-test-database'));data.auth_perfiles[0].rol='operador';localStorage.setItem('browser-test-database',JSON.stringify(data));});
  await page.goto(url);await page.getByText('No tienes permisos para consultar esta sección.',{exact:true}).waitFor();
  assert.equal(await page.locator('a[href="gastos.html"]:visible').count(),0);assert.equal(await page.locator('#new-expense').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
