import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve,extname,sep } from 'node:path';
import { chromium } from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
test('Navegación, formularios, sincronización y reintentos en navegador',async t=>{
 const server=createServer(async(req,res)=>{
  try{
   const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[extname(path)];
   if(!type){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',type);res.end(await readFile(path));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(edge)?edge:undefined)});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const fixture=await readFile(new URL('./fixtures/supabase-browser.js',import.meta.url),'utf8');
  await context.route('**/js/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:fixture}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const base='http://127.0.0.1:'+server.address().port;
  await mkdir(resolve(root,'test-results'),{recursive:true});
  await t.test('las páginas verificadas comparten menú y cargan sin errores',async()=>{
   for(const section of ['dashboard','productos','categorias','proveedores','sedes','inventario','movimientos','reportes','usuarios']){
    await page.goto(base+'/'+section+'.html');
    await page.locator('#sync-state.connected').waitFor();
    assert.equal(await page.locator('.sidebar-menu a').count(),11);
    assert.equal(await page.locator('.menu-item.active').getAttribute('href'),section+'.html');
    assert.equal(await page.locator('#load-error:visible').count(),0);
   }
  });
  await t.test('categorías guarda y actualiza datos',async()=>{
   await page.goto(base+'/categorias.html');await page.locator('#new-record').click();
   await page.locator('[name=nombre]').fill('Empaques');
   await page.locator('[name=descripcion]').fill('Cajas y bolsas');
   await page.locator('#save-editor').click();await page.locator('#editor').waitFor({state:'hidden'});
   assert.match(await page.locator('#results').innerText(),/Empaques/);
   await page.locator('tr').filter({hasText:'Empaques'}).getByRole('button',{name:'Editar'}).click();
   await page.locator('[name=nombre]').fill('Empaques nuevos');await page.locator('#save-editor').click();
   await page.locator('#editor').waitFor({state:'hidden'});
   assert.match(await page.locator('#results').innerText(),/Empaques nuevos/);
  });
  await t.test('cambios en otra pestaña se actualizan sin perder el formulario abierto',async()=>{
   await page.locator('#new-record').click();await page.locator('[name=nombre]').fill('Borrador sin guardar');
   const other=await context.newPage();await other.goto(base+'/categorias.html');await other.locator('#new-record').click();
   await other.locator('[name=nombre]').fill('Desde otra pestaña');await other.locator('#save-editor').click();await other.locator('#editor').waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('Desde otra pestaña'));
   assert.equal(await page.locator('[name=nombre]').inputValue(),'Borrador sin guardar');await page.locator('#cancel-editor').click();await other.close();
  });
  await t.test('inventario crea lotes con vencimiento',async()=>{
   await page.goto(base+'/inventario.html');await page.locator('#new-lot').click();
   await page.locator('[name=producto_id]').selectOption('p1');await page.locator('[name=codigo]').fill('LOTE-NUEVO');
   await page.locator('[name=vencimiento]').fill('2099-12-31');await page.locator('#save-editor').click();
   await page.locator('#editor').waitFor({state:'hidden'});
   assert.match(await page.locator('#lots').innerText(),/LOTE-NUEVO/);
   await page.screenshot({path:resolve(root,'test-results/inventario-desktop.png'),fullPage:true});
  });
  await t.test('respuesta perdida permite reintentar sin duplicar el movimiento',async()=>{
   await page.goto(base+'/movimientos.html');await page.locator('#new-movement').click();
   await page.locator('[name=producto_id]').selectOption('p1');await page.locator('[name=lote_id]').selectOption('l1');
   await page.locator('[name=sede_id]').selectOption('s1');await page.locator('[name=cantidad]').fill('3');
   await page.locator('[name=motivo]').fill('Recepción de compra');
   await page.evaluate(()=>localStorage.setItem('test-network-failure','once'));await page.locator('#save-editor').click();
   await page.waitForFunction(()=>document.querySelector('#editor-error').textContent.includes('reintentar'));
   assert.equal(await page.locator('[name=cantidad]').isDisabled(),true);
   await page.locator('#save-editor').click();await page.locator('#editor').waitFor({state:'hidden'});
   assert.equal(await page.locator('#results tbody tr').count(),1);
   assert.match(await page.locator('#results').innerText(),/Recepción de compra/);
  });
  await t.test('reportes descargan CSV',async()=>{
   await page.goto(base+'/reportes.html');
   const download=page.waitForEvent('download');await page.locator('#export-movements').click();
   assert.equal((await download).suggestedFilename(),'movimientos.csv');
  });
  await t.test('dashboard y móvil mantienen contenido accesible',async()=>{
   await page.goto(base+'/dashboard.html');await page.locator('.activity-column').first().waitFor();
   await page.evaluate(()=>localStorage.removeItem('liguria-theme'));await page.reload();await page.locator('.activity-column').first().waitFor();
   await page.locator('#theme-toggle').click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:resolve(root,'test-results/dashboard-desktop.png'),fullPage:true});
   await page.goto(base+'/inventario.html');await page.locator('#new-lot').waitFor();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.setViewportSize({width:390,height:844});await page.goto(base+'/inventario.html');
   await page.locator('#new-lot').waitFor();await page.locator('#toggle-sidebar').click();
   assert.equal(await page.locator('.sidebar').evaluate(el=>el.classList.contains('show-mobile')),true);
   await page.locator('.sidebar-overlay').click({position:{x:360,y:600}});
   await page.screenshot({path:resolve(root,'test-results/inventario-mobile.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
