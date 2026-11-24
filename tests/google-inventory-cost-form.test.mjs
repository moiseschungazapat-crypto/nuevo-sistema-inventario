import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('Sheets exige costo en entradas, guarda costo y total, y permite salidas sin costo',async()=>{
 const script=await readFile(new URL('../google-apps-script/inventario-operativo.gs',import.meta.url),'utf8');
 const cells={C6:'Entrada',C7:new Date(),C8:'Abarrotes',C9:'Arroz — P1',C10:2,C11:'Proveedor',C12:'',C13:'Uso',H8:10,H12:''};
 const saved=[],messages=[];
 const sheet={getLastRow:()=>20,getMaxRows:()=>1500,getRange(key,column){return {getValue:()=>typeof key==='number'&&column===11?'SINCRONIZADO':cells[key],setValues:values=>{saved.push(values[0]);return this;},setNumberFormat(){return this;}};}};
 const book={getSheetByName:()=>sheet,getSpreadsheetTimeZone:()=>'America/Lima',toast:()=>{}};
 const context=vm.createContext({Date,SpreadsheetApp:{getActive:()=>book,flush:()=>{}},LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{formatDate:()=> '2026-11-24',getUuid:()=>crypto.randomUUID()}});
 vm.runInContext(script,context);
 context.buscarProducto_=()=>({codigo:'P1',nombre:'Arroz',categoria:'Abarrotes',unidad:'kg',perecible:false});
 context.animarBoton_=()=>{};context.mostrarEstado_=message=>messages.push(message);context.limpiarFormulario_=()=>{};context.enviarSincronizacionAutomatica_=()=>{};
 context.registrarMovimiento();assert.equal(saved.length,0);assert.match(messages.at(-1),/costo unitario/);
 cells.H12=2.5;context.registrarMovimiento();assert.equal(saved.length,1);assert.equal(saved[0].length,17);assert.equal(saved[0][15],2.5);assert.equal(saved[0][16],5);
 cells.C6='Salida';cells.H12='';context.registrarMovimiento();assert.equal(saved.length,2);assert.equal(saved[1][15],'');assert.equal(saved[1][16],'');
 assert.equal(context.costoTotalEntrada_(1,1.005),1.01);
});
