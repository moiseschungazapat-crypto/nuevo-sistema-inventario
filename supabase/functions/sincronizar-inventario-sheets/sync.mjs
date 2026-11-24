import { DEFAULT_SPREADSHEET_ID,MOVEMENT_SHEET,MOVEMENT_START_ROW,ensureWorkbook,readValues,writeValues,writeReferences,pendingMovementRows,normalize,dateValue,numberValue } from './sheets.mjs';
import { googleToken } from '../exportar-google-sheets/google.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-inventory-token','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=value=>String(value??'').trim();
const message=error=>error?.message||'No se pudo procesar el registro.';
const sheetDateTime=()=>new Date().toLocaleString('es-PE',{timeZone:'America/Lima'});

export function createHandler({createClient,env,request=fetch}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método no permitido.'},405);
  const authorization=req.headers.get('Authorization')||'';
  const automationToken=req.headers.get('X-Inventory-Token')||'';
  if(!authorization.startsWith('Bearer ')&&!automationToken)return json({error:'Inicia sesión para sincronizar el inventario.'},401);
  try{
   const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),secret=env('GOOGLE_SERVICE_ACCOUNT_JSON');
   if(!url||!key||!secret)return json({error:'Falta completar la configuración de Google Sheets en Supabase.'},503);
   const spreadsheetId=env('GOOGLE_INVENTORY_SPREADSHEET_ID')||DEFAULT_SPREADSHEET_ID;
   let client;
   if(automationToken){
    const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
    if(!serviceKey)return json({error:'Falta configurar la sincronización automática.'},503);
    const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    client={rpc:(name,args={})=>service.rpc('app_google_sheets_automatico',{p_token:automationToken,p_hoja:spreadsheetId,p_accion:name,p_datos:args})};
   }else{
    client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:user,error:authError}=await client.auth.getUser();
    if(authError||!user?.user)return json({error:'Tu sesión venció. Inicia sesión nuevamente.'},401);
   }
   const {data:access,error:accessError}=await client.rpc('app_mi_acceso');
   if(accessError||access?.rol!=='administrador')return json({error:'Solo un administrador puede sincronizar el inventario.'},403);
   let credentials;try{credentials=JSON.parse(secret);}catch{return json({error:'La cuenta de Google configurada no es válida.'},503);}
   let body={};try{body=await req.json();}catch{/* sincronización manual sin cuerpo */}
   if(automationToken&&body.checkOnly)return json({connected:true});
   const fast=Boolean(automationToken);
   const token=await googleToken(credentials,request);
   if(!fast)await ensureWorkbook(spreadsheetId,token,request);
   const {data:master,error:masterError}=await client.rpc('app_datos_google_sheets_operativo');
   if(masterError)throw new Error(masterError.message||'Falta aplicar la migración de sincronización.');
   if(!fast)await writeReferences(spreadsheetId,token,master,request);

   const range=`'${MOVEMENT_SHEET}'!A${MOVEMENT_START_ROW}:O`;
   const values=await readValues(spreadsheetId,token,[range],request);
   const rows=body.refreshOnly?[]:pendingMovementRows(values[range]||[]).filter(row=>!fast||!body.operationId||row.cells[12]===body.operationId);
   const idWrites=[];
   for(const row of rows){
    const existing=clean(row.cells[12]);
    row.operationId=/^[0-9a-f-]{36}$/i.test(existing)?existing:crypto.randomUUID();
    row.cells[12]=row.operationId;
    idWrites.push({range:`'${MOVEMENT_SHEET}'!M${row.row}`,values:[[row.operationId]]});
   }
   if(idWrites.length)await writeValues(spreadsheetId,token,idWrites,'RAW',request);

   const products=new Map(master.products.map(product=>[normalize(product.codigo),product]));
   const providers=new Map();for(const provider of master.providers){providers.set(normalize(provider.nombre),provider);if(provider.documento)providers.set(normalize(provider.documento),provider);}
   const site=master.sites[0];if(!site)throw new Error('No existe una sede activa para registrar movimientos.');
   let synchronized=0,errors=0;
   const resultWrites=[];

   for(const row of rows){
    try{
     const type=normalize(row.cells[1]);
     const date=dateValue(row.cells[0]);
     const product=products.get(normalize(row.cells[3]));
     const quantity=numberValue(row.cells[5]);
     const provider=providers.get(normalize(row.cells[7]));
     const expiration=dateValue(row.cells[8]);
     const note=clean(row.cells[9]);
     if(!['entrada','salida'].includes(type))throw new Error('Selecciona Entrada o Salida.');
     if(!date)throw new Error('Indica una fecha válida.');
     if(!product)throw new Error('El código del producto no existe o está inactivo.');
     if(!Number.isFinite(quantity)||quantity<=0)throw new Error('La cantidad debe ser mayor que cero.');
     resultWrites.push({range:`'${MOVEMENT_SHEET}'!E${row.row}`,values:[[product.nombre]]});
     resultWrites.push({range:`'${MOVEMENT_SHEET}'!G${row.row}`,values:[[product.unidad_medida]]});

     if(type==='entrada'){
      if(!provider)throw new Error('Selecciona un proveedor activo para la entrada.');
      if(product.es_perecible&&!expiration)throw new Error(`Falta el vencimiento de ${product.nombre}.`);
      const receipt={
       proveedor_id:String(provider.id),tipo_comprobante:'Ingreso de inventario',serie:'GS',numero:row.operationId.replaceAll('-','').slice(0,24).toUpperCase(),
       fecha_emision:date,fecha_recepcion:date,sede_id:String(site.id),responsable:access.nombre||'Sincronización Google Sheets',observaciones:note||null,
       detalles:[{producto_id:String(product.id),lote_id:null,codigo_lote:null,vencimiento:expiration||null,cantidad_facturada:quantity,cantidad_recibida:quantity,unidad:product.unidad_medida,precio_unitario:null}],
      };
      const {error}=await client.rpc('app_registrar_recepcion_google_sheets',{p_operacion:row.operationId,p_recepcion:receipt});if(error)throw error;
      resultWrites.push({range:`'${MOVEMENT_SHEET}'!K${row.row}:O${row.row}`,values:[['SINCRONIZADO','Entrada registrada.',row.operationId,sheetDateTime(),'']]});
     }else{
      if(!note)throw new Error('Indica el motivo de la salida.');
      const {data,error}=await client.rpc('app_registrar_salida_fefo_google_sheets',{p_operacion:row.operationId,p_producto:String(product.id),p_sede:String(site.id),p_cantidad:quantity,p_fecha:date,p_documento:`GS-MOV-${row.row}`,p_motivo:note});if(error)throw error;
      const lots=(data.movimientos||[]).map(item=>`${item.lote}: ${item.cantidad}`).join(' · ');
      resultWrites.push({range:`'${MOVEMENT_SHEET}'!K${row.row}:O${row.row}`,values:[['SINCRONIZADO','Salida registrada por FEFO.',row.operationId,sheetDateTime(),lots]]});
     }
     synchronized++;
    }catch(error){
     errors++;
     const retry=Boolean(automationToken)&&(!error?.code&&!(error instanceof Error)||error?.name==='TypeError'||error?.name==='TimeoutError'||String(error?.code||'').startsWith('08'));
     resultWrites.push({range:`'${MOVEMENT_SHEET}'!K${row.row}:O${row.row}`,values:[[retry?'PENDIENTE':'ERROR',retry?'Conexión interrumpida. Se reintentará automáticamente.':message(error),row.operationId,sheetDateTime(),'']]});
    }
   }
   if(resultWrites.length)await writeValues(spreadsheetId,token,resultWrites,'RAW',request);
   const {data:updated,error:updatedError}=await client.rpc('app_datos_google_sheets_operativo');if(updatedError)throw updatedError;
   const refreshed=await writeReferences(spreadsheetId,token,updated,request);
   const status=body.refreshOnly?'Inventario y alertas actualizados.':rows.length===0?'No había movimientos pendientes.':errors?`${synchronized} movimiento(s) sincronizado(s) y ${errors} con error. Revisa Resultado.`:'Registrado y sincronizado. Inventario actualizado para todos.';
   await writeValues(spreadsheetId,token,[{range:`'${MOVEMENT_SHEET}'!A17`,values:[[status]]}],'RAW',request);
   return json({processed:rows.length,synchronized,errors,alerts:refreshed.alerts,updatedAt:new Date().toISOString(),url:`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`});
  }catch(error){
   console.error('sincronizar-inventario-sheets',error);
   const safe=message(error);return json({error:/^(No se pud|Falta |La cuenta |Solo |Tu sesión|No existe)/.test(safe)?safe:'No se pudo sincronizar la hoja. Revisa la configuración y vuelve a intentar.'},502);
  }
 };
}
