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
    assert.equal(await page.locator('.sidebar-menu a').count(),10);
    assert.equal(await page.locator('.menu-item.active').getAttribute('href'),(['productos','categorias'].includes(section)?'catalogo':section)+'.html');
    assert.equal(await page.locator('#load-error:visible').count(),0);
   }
  });
  await t.test('categorías guarda y actualiza datos',async()=>{
   await page.goto(base+'/categorias.html');await page.locator('#new-category').click();
   await page.locator('[name=nombre]').fill('Empaques');
   await page.locator('[name=descripcion]').fill('Cajas y bolsas');
   await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});
   assert.match(await page.locator('#catalog-view').innerText(),/Empaques/);
   await page.locator('tr').filter({hasText:'Empaques'}).getByRole('button',{name:'Editar'}).click();await page.locator('[data-confirm-yes]').click();
   await page.locator('[name=nombre]').fill('Empaques nuevos');await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
   await page.locator('#editor').waitFor({state:'hidden'});
   assert.match(await page.locator('#catalog-view').innerText(),/Empaques nuevos/);
  });
  await t.test('cambios en otra pestaña se actualizan sin perder el formulario abierto',async()=>{
   await page.locator('#new-category').click();await page.locator('[name=nombre]').fill('Borrador sin guardar');
   const other=await context.newPage();await other.goto(base+'/categorias.html');await other.locator('#new-category').click();
   await other.locator('[name=nombre]').fill('Desde otra pestaña');await other.locator('#save-editor').click();await other.locator('[data-confirm-yes]').click();await other.locator('#editor').waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelector('#catalog-view').textContent.includes('Desde otra pestaña'));
   assert.equal(await page.locator('[name=nombre]').inputValue(),'Borrador sin guardar');await page.locator('#cancel-editor').click();await page.locator('[data-confirm-yes]').click();await other.close();
  });
  await t.test('Catálogo configura mínimos y los cambios aparecen en Inventario',async()=>{
   await page.goto(base+'/productos.html');await page.locator('[data-minimum="p1"]').click();
   assert.equal(await page.locator('[name=minimo]').inputValue(),'10');
   await page.locator('[name=minimo]').fill('30');await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
   await page.locator('#editor').waitFor({state:'hidden'});
   await page.goto(base+'/inventario.html');await page.locator('[data-stock-detail]').first().waitFor();
   assert.match(await page.locator('#results').innerText(),/Stock bajo/);
   await page.locator('#only-alerts').click();assert.equal(await page.locator('#filter').inputValue(),'alerts');
   await page.goto(base+'/productos.html');await page.locator('[data-minimum="p1"]').click();
   assert.equal(await page.locator('[name=minimo]').inputValue(),'30');
   await page.locator('[name=minimo]').fill('10');await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
   await page.locator('#editor').waitFor({state:'hidden'});
  });
  await t.test('recepciones crea lotes e inventario solo permite consultar',async()=>{
   await page.goto(base+'/recepciones.html');await page.locator('#manual-lots summary').click();await page.locator('#new-lot').click();
   await page.locator('[name=producto_id]').selectOption('p1');await page.locator('[name=codigo]').fill('LOTE-NUEVO');
   await page.locator('[name=vencimiento]').fill('2099-12-31');await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
   await page.locator('#editor').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('browser-test-database')).lotes.some(l=>l.codigo==='LOTE-NUEVO')),true);
   await page.goto(base+'/inventario.html');await page.locator('[data-stock-detail]').first().waitFor();
   assert.equal(await page.locator('#new-lot, #minimum, a[href="movimientos.html"].primary').count(),0);
   await page.locator('[data-stock-detail]').first().click();
   assert.match(await page.locator('#stock-detail-content').innerText(),/HAR-2026-09/);
   await page.locator('#done-stock-detail').click();
   assert.equal(await page.locator('#stock-detail').isVisible(),false);
   await page.screenshot({path:resolve(root,'test-results/inventario-desktop.png'),fullPage:true});
  });
  await t.test('inventario diario descarga todas las páginas y respeta búsqueda y filtros',async()=>{
   await page.goto(base+'/inventario.html');await page.locator('#results tbody tr').first().waitFor();
   const original=await page.evaluate(()=>localStorage.getItem('browser-test-database'));
   try{
    await page.evaluate(()=>{
     const data=JSON.parse(localStorage.getItem('browser-test-database'));
     const first=data.productos[0];
     for(let i=0;i<25;i++)data.productos.push({...first,id:'extra-'+i,codigo:'SIN-'+i,nombre:'Producto sin stock '+i});
     localStorage.setItem('browser-test-database',JSON.stringify(data));
    });
    await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.querySelector('#pager').textContent.includes('26 registros'));
    assert.equal(await page.locator('#results tbody tr').count(),20);
    const download=page.waitForEvent('download');await page.locator('#export-daily-stock').click();
    const file=await download;
    assert.match(file.suggestedFilename(),/^inventario-diario-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const path=resolve(root,'test-results/inventario-diario.xlsx');await file.saveAs(path);
    const text=(await readFile(path)).toString('utf8');
    assert.match(text,/26 registros/);assert.match(text,/row r="32"/);
    await page.locator('#search').fill('No existe este producto');
    const emptyDownload=page.waitForEvent('download');await page.locator('#export-daily-stock').click();
    await (await emptyDownload).saveAs(path);
    assert.match((await readFile(path)).toString('utf8'),/No hay registros para los filtros seleccionados/);
    await page.locator('#search').fill('');await page.locator('#filter').selectOption('expired');
    const filteredDownload=page.waitForEvent('download');await page.locator('#export-daily-stock').click();
    await (await filteredDownload).saveAs(path);
    assert.match((await readFile(path)).toString('utf8'),/Mostrar: Vencido/);
   }finally{await page.evaluate(value=>localStorage.setItem('browser-test-database',value),original);}
  });
  await t.test('recepción registra varios productos con lote automático sin perder datos al reintentar',async()=>{
   await page.goto(base+'/recepciones.html');await page.locator('#new-reception').click();
   const snapshot=await page.evaluate(()=>localStorage.getItem('browser-test-database'));
   try{
    await page.locator('[name=proveedor_id]').selectOption('pr1');await page.locator('[name=serie]').fill('F001');await page.locator('[name=numero]').fill('SIMPLE-1');
    await page.locator('[name=producto_0]').selectOption('p1');await page.locator('[name=recibida_0]').fill('4');
    await page.locator('[name=vencimiento_0]').fill('2099-12-31');
    assert.equal(await page.locator('[name=lote_0]').isVisible(),false);
    await page.locator('#add-reception-line').click();
    await page.locator('[name=producto_1]').selectOption('p1');await page.locator('[name=recibida_1]').fill('2');
    await page.locator('[name=caducidad_1]').selectOption('ninguno');
    await page.screenshot({path:resolve(root,'test-results/recepcion-simple.png'),fullPage:true});
    await page.evaluate(()=>localStorage.setItem('test-reception-network-failure','once'));
    await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
    await page.waitForFunction(()=>document.querySelector('#editor-error').textContent.includes('reintentar'));
    assert.equal(await page.locator('[name=recibida_0]').inputValue(),'4');
    const afterFirst=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('browser-test-database'));return {lots:d.lotes.length,receipts:d.recepciones.length};});
    await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});
    const afterRetry=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('browser-test-database'));return {lots:d.lotes.length,receipts:d.recepciones.length};});
    assert.deepEqual(afterFirst,afterRetry);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('browser-test-database')).recepcion_detalles.slice(-2).every(d=>d.cantidad_facturada===d.cantidad_recibida)),true);
    await page.goto(base+'/movimientos.html');await page.locator('#new-movement').click();
    await page.locator('[name=producto_id]').selectOption('p1');
    assert.match(await page.locator('[name=lote_id]').innerText(),/Sin vencimiento/);
    await page.locator('#cancel-editor').click();await page.locator('[data-confirm-yes]').click();
   }finally{await page.evaluate(value=>localStorage.setItem('browser-test-database',value),snapshot);}
  });
  await t.test('respuesta perdida permite reintentar sin duplicar el movimiento',async()=>{
   await page.goto(base+'/movimientos.html');await page.locator('#new-movement').click();
   await page.locator('[name=producto_id]').selectOption('p1');await page.locator('[name=lote_id]').selectOption('l1');
   await page.locator('[name=cantidad]').fill('3');
   await page.locator('[name=motivo]').fill('Recepción de compra');
   await page.evaluate(()=>localStorage.setItem('test-network-failure','once'));await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();
   await page.waitForFunction(()=>document.querySelector('#editor-error').textContent.includes('reintentar'));
   assert.equal(await page.locator('[name=cantidad]').isDisabled(),true);
   await page.locator('#save-editor').click();await page.locator('[data-confirm-yes]').click();await page.locator('#editor').waitFor({state:'hidden'});
   assert.equal(await page.locator('#results tbody tr').count(),1);
   assert.match(await page.locator('#results').innerText(),/Recepción de compra/);
  });
  await t.test('reportes descargan Excel con formato para movimientos y existencias',async()=>{
   await page.goto(base+'/reportes.html');
   const download=page.waitForEvent('download');await page.locator('#export-movements').click();
   const movements=await download;
   assert.equal(movements.suggestedFilename(),'movimientos.xlsx');
   await movements.saveAs(resolve(root,'test-results/movimientos.xlsx'));
   const stockDownload=page.waitForEvent('download');await page.locator('#export-stock').click();
   const stock=await stockDownload;assert.equal(stock.suggestedFilename(),'existencias.xlsx');
   await stock.saveAs(resolve(root,'test-results/existencias.xlsx'));
  });
  await t.test('Dashboard confirma el envío manual a Google Sheets e informa éxito o configuración pendiente',async()=>{
   await page.goto(base+'/dashboard.html');
   await page.locator('#update-google-sheets').click();
   await page.locator('[data-confirm-no]').click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('test-sheets-calls')),null);
   await page.locator('#update-google-sheets').click();
   await page.locator('[data-confirm-yes]').click();
   await page.waitForFunction(()=>document.querySelector('#google-sheets-status').textContent.includes('actualizada'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('test-sheets-calls')),'1');
   await page.evaluate(()=>localStorage.setItem('test-sheets-error','1'));
   await page.locator('#update-google-sheets').click();await page.locator('[data-confirm-yes]').click();
   await page.waitForFunction(()=>document.querySelector('#google-sheets-status').textContent.includes('Falta conectar'));
   assert.equal(await page.locator('#update-google-sheets').isEnabled(),true);
   await page.evaluate(()=>localStorage.removeItem('test-sheets-error'));
   await page.screenshot({path:resolve(root,'test-results/dashboard-google-sheets.png'),fullPage:true});
  });
  await t.test('dashboard y móvil mantienen contenido accesible',async()=>{
   await page.goto(base+'/dashboard.html');await page.locator('.activity-column').first().waitFor();
   await page.evaluate(()=>localStorage.removeItem('liguria-theme'));await page.reload();await page.locator('.activity-column').first().waitFor();
   await page.locator('#theme-toggle').click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:resolve(root,'test-results/dashboard-desktop.png'),fullPage:true});
   await page.goto(base+'/inventario.html');await page.locator('#export-daily-stock').waitFor();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.setViewportSize({width:390,height:844});await page.goto(base+'/inventario.html');
   await page.locator('#export-daily-stock').waitFor();await page.locator('#toggle-sidebar').click();
   assert.equal(await page.locator('.sidebar').evaluate(el=>el.classList.contains('show-mobile')),true);
   await page.locator('.sidebar-overlay').click({position:{x:360,y:600}});
   await page.screenshot({path:resolve(root,'test-results/inventario-mobile.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  });
  await t.test('la exportación a Google Sheets no aparece para el rol consulta',async()=>{
   await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('browser-test-database'));
    data.auth_perfiles[0].rol='consulta';localStorage.setItem('browser-test-database',JSON.stringify(data));
   });
   await page.goto(base+'/dashboard.html');await page.locator('.activity-column').first().waitFor();
   assert.equal(await page.locator('#update-google-sheets').count(),0);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
