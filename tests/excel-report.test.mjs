import test from 'node:test';
import assert from 'node:assert/strict';
import {createExcelReport} from '../js/utils/excel-report.js';

// Read the generated package independently from the writer; the format uses stored ZIP entries.
function files(bytes) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), result={};let pos=0;
 while(view.getUint32(pos,true)===0x04034b50) {
  assert.equal(view.getUint16(pos+8,true),0);
  const size=view.getUint32(pos+18,true),names=view.getUint16(pos+26,true),extra=view.getUint16(pos+28,true);
  const path=new TextDecoder().decode(bytes.slice(pos+30,pos+30+names));
  const start=pos+30+names+extra;result[path]=new TextDecoder().decode(bytes.slice(start,start+size));pos=start+size;
 }
 assert.equal(view.getUint32(pos,true),0x02014b50);
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
 assert.equal(view.getUint16(bytes.length-12,true),Object.keys(result).length);
 return result;
}
const options={title:'MOVIMIENTOS',sheetName:'Movimientos',headers:['Fecha','Documento','Cantidad','Producto'],widths:[23,30,16,34],numericColumns:[2],dateColumns:{0:'datetime'},now:new Date('2026-10-20T18:00:00Z')};
test('Excel mantiene documentos y fórmulas como texto, cantidades numéricas y fechas de Perú',()=>{
 const packageFiles=files(createExcelReport({...options,rows:[['2026-10-21T04:00:00Z','0020543210123','12.5','=HYPERLINK("test")']]}));
 const sheet=packageFiles['xl/worksheets/sheet1.xml'];
 assert.match(sheet,/<c r="B7"[^>]*t="inlineStr"[^>]*>.*0020543210123/);
 assert.match(sheet,/<c r="C7"[^>]*t="n"><v>12.5<\/v>/);
 assert.match(sheet,/=HYPERLINK\(&quot;test&quot;\)/);
 assert.ok(!sheet.includes('<f>'));
 const serial=Number(sheet.match(/<c r="A7"[^>]*><v>([^<]+)/)[1]);
 assert.equal(new Date(Math.round((serial-25569)*86400000)).toISOString(),'2026-10-20T23:00:00.000Z');
 assert.match(sheet,/autoFilter ref="A6:D7"/);
 assert.match(sheet,/topLeftCell="A7"/);
 assert.match(sheet,/mergeCell ref="A1:D1"/);
 assert.match(packageFiles['xl/styles.xml'],/FF0F2338/);
});
test('Excel maneja reportes vacíos y limpia caracteres inválidos sin alterar ceros',()=>{
 let sheet=files(createExcelReport({...options,rows:[]}))['xl/worksheets/sheet1.xml'];
 assert.match(sheet,/No hay registros/);
 sheet=files(createExcelReport({...options,rows:[[null,'DOC\u0000&<>',0,'Producto']]}))['xl/worksheets/sheet1.xml'];
 assert.ok(!sheet.includes('\u0000'));
 assert.match(sheet,/DOC&amp;&lt;&gt;/);
 assert.match(sheet,/<c r="C7"[^>]*t="n"><v>0<\/v>/);
 assert.throws(()=>createExcelReport({...options,rows:[[null,'DOC','invalido','P']]}),/cantidad inválida/);
});
