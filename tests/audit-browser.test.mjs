import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

test('auditoría explica compras y correcciones, filtra y funciona en móvil y modo oscuro',async()=>{
 const root=resolve('.'),server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/js/supabase.js',route=>route.fulfill({contentType:'text/javascript',path:resolve(root,'tests/fixtures/supabase-browser.js')}));
  const url='http://127.0.0.1:'+server.address().port+'/auditoria.html';await page.goto(url);await page.locator('.audit-event').waitFor();
  await page.evaluate(async()=>{
   const {supabase}=await import('/js/supabase.js');await supabase.from('categorias').update({nombre:'Insumos'}).eq('id','c1');
   const data=JSON.parse(localStorage.getItem('browser-test-database'));
   const common={fecha:'2026-11-24T23:03:59Z',actor_nombre:'Moises 2',actor_email:'admin@example.test',anterior:null};
   data.auditoria=[
    {...common,tabla:'entrada_correcciones',operacion:'INSERT',contexto:{producto:'Arroz',codigo:'E-230',unidad:'kg'},nuevo:{anterior:{cantidad:10,costo_unitario:10,total:100},nuevo:{cantidad:8,costo_unitario:9,total:72,producto:'Arroz',codigo:'E-230'},motivo:'Se verificó la entrega y el costo real.'}},
    {...common,tabla:'gastos',operacion:'INSERT',contexto:{producto:'Arroz',codigo:'E-230',unidad:'kg'},nuevo:{producto_nombre:'Arroz',cantidad:10,costo_unitario:10,monto:100,proveedor:'Proveedor del Norte',origen:'recepcion',observaciones:'Nota de la entrega. '.repeat(50)+'<img src=x onerror=alert(1)>'}},
    {...common,tabla:'lotes',operacion:'UPDATE',contexto:{producto:'Arroz',codigo:'E-230',unidad:'kg'},anterior:{codigo:'REC-20261124-2518b6c07bbb4948865efa67c5f079e9-1',vencimiento:'2026-11-26',costo_unitario:null},nuevo:{codigo:'REC-20261124-2518b6c07bbb4948865efa67c5f079e9-1',vencimiento:'2026-11-28',costo_unitario:10,documento_origen:'Ingreso GS-2518B6C07BBB4948865EFA67'}},
    {...common,tabla:'auth_perfiles',operacion:'UPDATE',contexto:{nombre:'Juan'},anterior:{nombre:'Juan',rol:'operador',activo:true},nuevo:{nombre:'Juan',rol:'consulta',activo:true}},
   ];localStorage.setItem('browser-test-database',JSON.stringify(data));
  });
  await page.reload();await page.getByRole('heading',{name:'Entrada corregida',exact:true}).waitFor();
  const correction=page.locator('.audit-event').first();const text=await correction.innerText();
  assert.match(text,/10 kg\s*→\s*8 kg/);assert.match(text,/S\/\s*100[,.]00\s*→\s*S\/\s*72[,.]00/);assert.match(text,/Se verificó la entrega/);
  const purchase=page.locator('.audit-event').nth(1);assert.match(await purchase.innerText(),/Arroz/);assert.match(await purchase.innerText(),/Total gastado\s*S\/\s*100[,.]00/);
  const lot=page.locator('.audit-event').nth(2);assert.doesNotMatch(await lot.innerText(),/2518b6c07/);assert.match(await lot.innerText(),/26\/11\/2026\s*→\s*28\/11\/2026/);
  await lot.locator('summary').click();assert.match(await lot.innerText(),/REC-20261124-2518b6c07/);await lot.locator('summary').click();
  assert.doesNotMatch(await page.locator('#audit-results').innerText(),/Registro creado|producto_id|solicitud_inicial/);assert.equal(await page.locator('#audit-results img').count(),0);
  await page.locator('#audit-action').selectOption('correction');assert.equal(await page.locator('.audit-event').count(),1);
  await page.locator('#audit-search').fill('inexistente');assert.equal(await page.locator('.audit-event').count(),0);
  await page.locator('#audit-search').fill('');await page.locator('#audit-action').selectOption('');await page.locator('#audit-section').selectOption('gastos');assert.equal(await page.locator('.audit-event').count(),1);
  await page.locator('#audit-section').selectOption('');await mkdir(resolve(root,'test-results'),{recursive:true});await page.screenshot({path:resolve(root,'test-results/auditoria-clara.png'),fullPage:true});
  await page.locator('#theme-toggle').click();await page.screenshot({path:resolve(root,'test-results/auditoria-clara-oscuro.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('.audit-event').first().waitFor();await page.screenshot({path:resolve(root,'test-results/auditoria-clara-movil.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('.audit-panel,.audit-activity,.audit-event,.audit-event-content,.toolbar,.main-wrapper')).map(el=>({cl:el.className,w:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left,scroll:el.scrollLeft,sw:el.scrollWidth})))));
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('browser-test-database'));data.auth_perfiles[0].rol='operador';localStorage.setItem('browser-test-database',JSON.stringify(data));});
  await page.reload();await page.getByText('No tienes permisos para consultar el historial.',{exact:true}).waitFor();assert.equal(await page.locator('.audit-event').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
