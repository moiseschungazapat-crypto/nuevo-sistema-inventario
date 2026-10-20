// A small OOXML writer for the site's static, offline-capable report downloads.
// ZIP entries are stored without compression; no external scripts or data uploads are required.
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').slice(0,32767).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const encoder = new TextEncoder();
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const columnName = index => {
 let result='';
 for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;
 return result;
};
const crcTable=Array.from({length:256},(_,n)=>{
 for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;
 return n>>>0;
});
const crc32=bytes=>{
 let crc=0xffffffff;
 for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
};
function zip(files) {
 const entries=[],directory=[];let offset=0;
 const header=(size,signature)=>{const bytes=new Uint8Array(size);const view=new DataView(bytes.buffer);view.setUint32(0,signature,true);return {bytes,view};};
 for(const [path,content] of Object.entries(files)) {
  const name=encoder.encode(path),data=encoder.encode(content),crc=crc32(data);
  const local=header(30,0x04034b50);
  local.view.setUint16(4,20,true);local.view.setUint16(12,33,true);
  local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,name.length,true);
  entries.push(local.bytes,name,data);
  const central=header(46,0x02014b50);
  central.view.setUint16(4,20,true);central.view.setUint16(6,20,true);central.view.setUint16(14,33,true);
  central.view.setUint32(16,crc,true);central.view.setUint32(20,data.length,true);central.view.setUint32(24,data.length,true);central.view.setUint16(28,name.length,true);central.view.setUint32(42,offset,true);
  directory.push(central.bytes,name);offset+=30+name.length+data.length;
 }
 const length=directory.reduce((sum,a)=>sum+a.length,0),end=header(22,0x06054b50);
 end.view.setUint16(8,directory.length/2,true);end.view.setUint16(10,directory.length/2,true);end.view.setUint32(12,length,true);end.view.setUint32(16,offset,true);
 const output=new Uint8Array(offset+length+22);let pos=0;
 for(const part of [...entries,...directory,end.bytes]){output.set(part,pos);pos+=part.length;}
 return output;
}

function styles() {
 const format=(font,fill,numFmt=0)=>`<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="${numFmt===164?'right':'left'}" vertical="center" indent="1" wrapText="1"/></xf>`;
 return declaration+`<styleSheet xmlns="${ns}">
 <numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00#"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
 <fonts count="4"><font><sz val="11"/><color rgb="FF253449"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
 <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2338"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF315B80"/><bgColor indexed="64"/></patternFill></fill></fills>
 <borders count="2"><border/><border><bottom style="hair"><color rgb="FFDCE5EE"/></bottom></border></borders>
 <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
 <cellXfs count="12"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${format(1,2)}${format(2,0)}${format(3,4)}${format(0,0)}${format(0,3)}${format(0,0,164)}${format(0,3,164)}${format(0,0,165)}${format(0,3,165)}${format(0,0,166)}${format(0,3,166)}</cellXfs>
 <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
 </styleSheet>`;
}

export function createExcelReport({title,sheetName,headers,rows,widths,numericColumns=[],dateColumns={},filters='Todos los registros',note='',now=new Date()}) {
 if(!headers.length || headers.length>100 || rows.length>50000)throw new Error('El tamaño del reporte no es válido.');
 const last=columnName(headers.length-1),lastRow=Math.max(7,rows.length+6);
 const cell=(value,index,row,style)=>{
  const ref=columnName(index)+row;
  if(value==null)return `<c r="${ref}" s="${style}"/>`;
  if(typeof value==='number') {
   if(!Number.isFinite(value))throw new Error('El reporte contiene una cantidad inválida.');
   return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
  }
  // Inline text preserves leading zeros, long document numbers and formula-like input.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
 };
 const fullRow=(row,text,style,height)=>`<row r="${row}" ht="${height}" customHeight="1">${headers.map((_,i)=>cell(i===0?text:null,i,row,style)).join('')}</row>`;
 const timestamp=now.toLocaleString('es-PE',{timeZone:'America/Lima',hour12:false});
 let content=fullRow(1,'LA LIGURIA S.A. · '+title,1,40)+fullRow(2,'Generado: '+timestamp+' (Perú) · Fuente: Supabase',2,24)+fullRow(3,rows.length+(rows.length===1?' registro':' registros')+' · '+filters,2,30)+fullRow(4,note,2,30);
 content+=`<row r="6" ht="32" customHeight="1">${headers.map((h,i)=>cell(h,i,6,3)).join('')}</row>`;
 rows.forEach((values,index)=>{
  const row=index+7,band=index%2;
  const cells=headers.map((_,i)=>{
   let value=values[i],style=4+band;
   if(value!=null && value!=='' && numericColumns.includes(i)){value=Number(value);style=6+band;}
   if(value!=null && value!=='' && dateColumns[i]) {
    // Local clock values are converted to an Excel date without a second timezone conversion.
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))throw new Error('El reporte contiene una fecha inválida.');
    let ms=date.getTime();
    if(dateColumns[i]==='datetime') {
     const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
     const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
     ms=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    }
    value=ms/86400000+25569;style=(dateColumns[i]==='datetime'?8:10)+band;
   }
   return cell(value,i,row,style);
  }).join('');
  // Wrap long descriptions without clipping names or document references.
  const lines=Math.max(1,...values.map((v,i)=>Math.ceil(String(v??'').length/Math.max(8,(widths?.[i]||18)-2))));
  content+=`<row r="${row}" ht="${Math.min(120,Math.max(28,lines*16+8))}" customHeight="1">${cells}</row>`;
 });
 if(!rows.length)content+=fullRow(7,'No hay registros para los filtros seleccionados.',2,30);
 const cols=headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${widths?.[i]||18}" customWidth="1"/>`).join('');
 const sheet=declaration+`<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A7" sqref="A7"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${cols}</cols><sheetData>${content}</sheetData><autoFilter ref="A6:${last}${lastRow}"/><mergeCells count="4">${[1,2,3,4].map(r=>`<mergeCell ref="A${r}:${last}${r}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LLa Liguria S.A.&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`;
 const relationship='http://schemas.openxmlformats.org/package/2006/relationships';
 const officeRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const name=xml((sheetName||'Reporte').replace(/[\\/\[\]*?:]/g,' ').slice(0,31));
 return zip({
  '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':declaration+`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':declaration+`<workbook xmlns="${ns}" xmlns:r="${officeRel}"><bookViews><workbookView/></bookViews><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${name.replace(/&apos;/g,"''")}'!$1:$6</definedName></definedNames></workbook>`,
  'xl/_rels/workbook.xml.rels':declaration+`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${officeRel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeRel}/styles" Target="styles.xml"/></Relationships>`,
  'xl/styles.xml':styles(),
  'xl/worksheets/sheet1.xml':sheet,
 });
}

export function downloadExcelReport(filename,options) {
 const bytes=createExcelReport(options);
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
