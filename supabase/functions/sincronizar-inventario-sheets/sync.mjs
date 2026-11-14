import { DEFAULT_SPREADSHEET_ID,ensureWorkbook,readValues,writeValues,writeReferences,normalize,dateValue,numberValue } from './sheets.mjs';
import { googleToken } from '../exportar-google-sheets/google.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=value=>String(value??'').trim();
const message=error=>error?.message||'No se pudo procesar el registro.';
const isPending=(cells,statusIndex)=>cells.some(cell=>clean(cell))&&['','pendiente'].includes(normalize(cells[statusIndex]));
const sheetDateTime=()=>new Date().toLocaleString('es-PE',{timeZone:'America/Lima'});

export function createHandler({createClient,env,request=fetch}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método no permitido.'},405);
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return json({error:'Inicia sesión para sincronizar el inventario.'},401);
  try{
   const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),secret=env('GOOGLE_SERVICE_ACCOUNT_JSON');
   if(!url||!key||!secret)return json({error:'Falta completar la configuración de Google Sheets en Supabase.'},503);
   const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data:user,error:authError}=await client.auth.getUser();
   if(authError||!user?.user)return json({error:'Tu sesión venció. Inicia sesión nuevamente.'},401);
   const {data:access,error:accessError}=await client.rpc('app_mi_acceso');
   if(accessError||access?.rol!=='administrador')return json({error:'Solo un administrador puede sincronizar el inventario.'},403);
   let credentials;try{credentials=JSON.parse(secret);}catch{return json({error:'La cuenta de Google configurada no es válida.'},503);}
   const spreadsheetId=env('GOOGLE_INVENTORY_SPREADSHEET_ID')||DEFAULT_SPREADSHEET_ID;
   const token=await googleToken(credentials,request);
   await ensureWorkbook(spreadsheetId,token,request);
   const {data:master,error:masterError}=await client.rpc('app_datos_google_sheets_operativo');
   if(masterError)throw new Error(masterError.message||'Falta aplicar la migración de sincronización.');
   await writeReferences(spreadsheetId,token,master,request);
   const ranges=["'Recepciones'!A2:M1500","'Salidas'!A2:L1500"];
   const values=await readValues(spreadsheetId,token,ranges,request);
   const receiptRows=(values[ranges[0]]||[]).map((cells,index)=>({row:index+2,cells})).filter(row=>isPending(row.cells,9));
   const outputRows=(values[ranges[1]]||[]).map((cells,index)=>({row:index+2,cells})).filter(row=>isPending(row.cells,7));
   const idWrites=[];
   const groups=new Map();
   for(const row of receiptRows){const label=clean(row.cells[0])||`FILA-${row.row}`;if(!groups.has(label))groups.set(label,[]);groups.get(label).push(row);}
   for(const rows of groups.values()){
    const existing=rows.map(row=>clean(row.cells[11])).find(value=>/^[0-9a-f-]{36}$/i.test(value));const id=existing||crypto.randomUUID();
    for(const row of rows){row.operationId=id;row.cells[11]=id;idWrites.push({range:`'Recepciones'!L${row.row}`,values:[[id]]});}
   }
   for(const row of outputRows){const existing=clean(row.cells[9]);row.operationId=/^[0-9a-f-]{36}$/i.test(existing)?existing:crypto.randomUUID();row.cells[9]=row.operationId;idWrites.push({range:`'Salidas'!J${row.row}`,values:[[row.operationId]]});}
   if(idWrites.length)await writeValues(spreadsheetId,token,idWrites,'RAW',request);

   const products=new Map(master.products.map(product=>[normalize(product.codigo),product]));
   const providers=new Map();for(const provider of master.providers){providers.set(normalize(provider.nombre),provider);if(provider.documento)providers.set(normalize(provider.documento),provider);}
   const site=master.sites[0];if(!site)throw new Error('No existe una sede activa para registrar movimientos.');
   let synchronized=0,errors=0;const resultWrites=[];

   for(const [group,rows] of groups){
    try{
     const first=rows[0],date=dateValue(first.cells[1]),provider=providers.get(normalize(first.cells[2]));
     if(!date)throw new Error('Indica una fecha válida.');if(!provider)throw new Error('El proveedor no existe o está inactivo.');
     if(rows.some(row=>dateValue(row.cells[1])!==date||normalize(row.cells[2])!==normalize(first.cells[2])))throw new Error('Todas las filas del mismo grupo deben tener igual fecha y proveedor.');
     const details=[];
     for(const row of rows){const product=products.get(normalize(row.cells[3])),quantity=numberValue(row.cells[5]),expiration=dateValue(row.cells[7]);if(!product)throw new Error(`Código inexistente en la fila ${row.row}.`);if(!Number.isFinite(quantity)||quantity<=0)throw new Error(`Cantidad inválida en la fila ${row.row}.`);if(product.es_perecible&&!expiration)throw new Error(`Falta el vencimiento de ${product.nombre}.`);details.push({producto_id:String(product.id),lote_id:null,codigo_lote:null,vencimiento:expiration||null,cantidad_facturada:quantity,cantidad_recibida:quantity,unidad:product.unidad_medida,precio_unitario:null});resultWrites.push({range:`'Recepciones'!E${row.row}:G${row.row}`,values:[[product.nombre,quantity,product.unidad_medida]]});}
     const receipt={proveedor_id:String(provider.id),tipo_comprobante:'Ingreso de inventario',serie:'GS',numero:first.operationId.replaceAll('-','').slice(0,24).toUpperCase(),fecha_emision:date,fecha_recepcion:date,sede_id:String(site.id),responsable:access.nombre||'Sincronización Google Sheets',observaciones:[...new Set(rows.map(row=>clean(row.cells[8])).filter(Boolean))].join(' | '),detalles};
     const {error}=await client.rpc('app_registrar_recepcion_google_sheets',{p_operacion:first.operationId,p_recepcion:receipt});if(error)throw error;
     for(const row of rows)resultWrites.push({range:`'Recepciones'!J${row.row}:M${row.row}`,values:[['SINCRONIZADO',`Recepción ${group} registrada.`,row.operationId,sheetDateTime()]]});synchronized+=rows.length;
    }catch(error){errors+=rows.length;for(const row of rows)resultWrites.push({range:`'Recepciones'!J${row.row}:M${row.row}`,values:[['ERROR',message(error),row.operationId,sheetDateTime()]]});}
   }

   for(const row of outputRows){
    try{
     const date=dateValue(row.cells[1]),product=products.get(normalize(row.cells[2])),quantity=numberValue(row.cells[4]),reason=clean(row.cells[6]);
     if(!date)throw new Error('Indica una fecha válida.');if(!product)throw new Error('El código del producto no existe o está inactivo.');if(!Number.isFinite(quantity)||quantity<=0)throw new Error('La cantidad debe ser mayor que cero.');if(!reason)throw new Error('Indica el motivo de la salida.');
     const {data,error}=await client.rpc('app_registrar_salida_fefo_google_sheets',{p_operacion:row.operationId,p_producto:String(product.id),p_sede:String(site.id),p_cantidad:quantity,p_fecha:date,p_documento:clean(row.cells[0])||`GS-FILA-${row.row}`,p_motivo:reason});if(error)throw error;
     const lots=(data.movimientos||[]).map(item=>`${item.lote}: ${item.cantidad}`).join(' · ');
     resultWrites.push({range:`'Salidas'!D${row.row}:F${row.row}`,values:[[product.nombre,quantity,product.unidad_medida]]});
     resultWrites.push({range:`'Salidas'!H${row.row}:L${row.row}`,values:[['SINCRONIZADO','Salida registrada por FEFO.',row.operationId,sheetDateTime(),lots]]});synchronized++;
    }catch(error){errors++;resultWrites.push({range:`'Salidas'!H${row.row}:L${row.row}`,values:[['ERROR',message(error),row.operationId,sheetDateTime(),''] ]});}
   }
   if(resultWrites.length)await writeValues(spreadsheetId,token,resultWrites,'RAW',request);
   const {data:updated,error:updatedError}=await client.rpc('app_datos_google_sheets_operativo');if(updatedError)throw updatedError;
   await writeReferences(spreadsheetId,token,updated,request);
   return json({processed:receiptRows.length+outputRows.length,synchronized,errors,updatedAt:new Date().toISOString(),url:`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`});
  }catch(error){
   console.error('sincronizar-inventario-sheets',error);
   const safe=message(error);return json({error:/^(No se pud|Falta |La cuenta |Solo |Tu sesión|No existe)/.test(safe)?safe:'No se pudo sincronizar la hoja. Revisa la configuración y vuelve a intentar.'},502);
  }
 };
}
