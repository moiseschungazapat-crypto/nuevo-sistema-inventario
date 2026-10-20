import { buildReport, SPREADSHEET_ID } from './report.mjs';
import { googleToken, writeReport } from './google.mjs';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:cors});
export function createHandler({createClient,env,request=fetch}) {
 return async req => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if (req.method!=='POST') return json({error:'Método no permitido.'},405);
  const authorization=req.headers.get('Authorization')||'';
  if (!authorization.startsWith('Bearer ')) return json({error:'Inicia sesión para actualizar Google Sheets.'},401);
  const url=env('SUPABASE_URL'), key=env('SUPABASE_ANON_KEY');
  if (!url || !key) return json({error:'Falta completar la configuración del servidor de reportes.'},503);
  try {
   // Use the caller's JWT throughout. Never use a service-role key to read inventory.
   const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data:user,error:authError}=await client.auth.getUser();
   if (authError || !user?.user) return json({error:'Tu sesión venció. Inicia sesión nuevamente.'},401);
   const {data:access,error:accessError}=await client.rpc('app_mi_acceso');
   if (accessError || access?.rol!=='administrador') return json({error:'Solo un administrador puede enviar reportes a Google Sheets.'},403);
   const secret=env('GOOGLE_SERVICE_ACCOUNT_JSON');
   if (!secret) return json({error:'Falta conectar la cuenta de Google. Sigue la guía de activación de Google Sheets.'},503);
   let credentials;
   try { credentials=JSON.parse(secret); } catch { return json({error:'La configuración de la cuenta de Google no tiene un formato válido.'},503); }
   const {data,error}=await client.rpc('app_reporte_google_sheets');
   if (error) return json({error:error.code==='42501'?'No tienes permiso para exportar.':'No se pudo preparar el reporte. Verifica que esté aplicada la migración de Google Sheets y vuelve a intentar.'},error.code==='42501'?403:503);
   const report=buildReport(data);
   const token=await googleToken(credentials,request);
   const spreadsheetId=env('GOOGLE_SHEETS_SPREADSHEET_ID')||SPREADSHEET_ID;
   const {sheetId}=await writeReport(spreadsheetId,token,report,request);
   return json({date:data.date,title:report.title,updatedAt:data.generated_at,url:`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit#gid=${sheetId}`});
  } catch (error) {
   // Return only errors deliberately written by the integration, never Google's raw responses or secrets.
   const safe = error instanceof Error && /^(Google |No se pudo |El reporte |La cuenta |Fecha de reporte |Faltan datos |Movimiento fuera |Tipo de movimiento |Número inválido)/.test(error.message);
   return json({error:safe?error.message:'No se pudo actualizar Google Sheets. Revisa la configuración o vuelve a intentar.'},502);
  }
 };
}
