import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeInventory,inventoryStatus,filterInventory} from '../js/utils/inventory.js';

test('inventario agrupa lotes, incluye productos sin stock y conserva mínimo sin duplicarlo',()=>{
 const products=[{id:1,nombre:'Harina',codigo:'H',categoria_id:3,unidad_medida:'kg'}, {id:2,nombre:'Azúcar',codigo:'A'}, {id:3,nombre:'Servicio',controla_inventario:false}];
 const stock=[{producto_id:1,sede_id:4,cantidad:10,total_sede:30,stock_minimo:40,lote:'L1',vencimiento:'2099-01-01'}, {producto_id:1,sede_id:4,cantidad:20,total_sede:30,stock_minimo:40,lote:'L2',vencimiento:'2026-10-19'}, {producto_id:1,sede_id:5,cantidad:1000}];
 const rows=summarizeInventory(products,stock,[{producto_id:2,sede_id:4,minimo:5}],[{id:3,nombre:'Insumos'}],4);
 assert.equal(rows.length,2);
 const flour=rows.find(r=>r.producto_id==='1'),sugar=rows.find(r=>r.producto_id==='2');
 assert.equal(flour.cantidad,30);assert.equal(flour.stock_minimo,40);assert.equal(flour.categoria,'Insumos');assert.equal(flour.lotes.length,2);
 assert.equal(inventoryStatus(flour).text,'Stock bajo');assert.equal(inventoryStatus(sugar).text,'Sin stock');assert.equal(sugar.stock_minimo,5);
 assert.equal(filterInventory(rows,{filter:'expired'},'2026-10-20').length,1);
 assert.equal(filterInventory(rows,{query:'l2'},'2026-10-20')[0].cantidad,30);
 assert.equal(filterInventory(rows,{filter:'empty'},'2026-10-20')[0].producto_id,'2');
 assert.equal(filterInventory(rows,{filter:'alerts'},'2026-10-20').length,2);
 assert.equal(inventoryStatus({...flour,cantidad:40}).text,'Normal');
});
