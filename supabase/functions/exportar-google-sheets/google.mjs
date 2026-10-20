import { reportRequests } from './report.mjs';

const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const encode = value => base64url(new TextEncoder().encode(JSON.stringify(value)));
export async function googleToken(credentials, request = fetch) {
 if (!credentials.client_email || !credentials.private_key) throw new Error('La cuenta de Google no está configurada correctamente.');
 const now = Math.floor(Date.now()/1000);
 const unsigned = encode({alg:'RS256',typ:'JWT'}) + '.' + encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const raw = atob(credentials.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,''));
 const key = await crypto.subtle.importKey('pkcs8',Uint8Array.from(raw,c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
 const response = await request('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+base64url(new Uint8Array(signature))}),
  signal:AbortSignal.timeout(20000),
 });
 if (!response.ok) throw new Error('Google rechazó las credenciales. Revisa la cuenta de servicio configurada.');
 const result = await response.json();
 if (!result.access_token) throw new Error('Google no devolvió un acceso válido.');
 return result.access_token;
}

export async function writeReport(spreadsheetId, token, report, request = fetch) {
 const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
 const headers = {Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const list = async () => {
  const response = await request(url+'?fields=sheets.properties',{headers,signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(response.status===403 || response.status===404
   ? 'No se pudo acceder a la hoja. Habilita Google Sheets API y comparte el archivo como Editor con la cuenta de servicio.'
   : 'No se pudo consultar Google Sheets. Vuelve a intentar.');
  return (await response.json()).sheets || [];
 };
 let sheets = await list();
 for (let attempt=0;attempt<2;attempt++) {
  const existing = sheets.find(s=>s.properties.title===report.title)?.properties;
  const {sheetId,requests} = reportRequests(report,existing);
  const body = JSON.stringify({requests});
  if (new TextEncoder().encode(body).length>1900000) throw new Error('El reporte es demasiado grande para un envío. Contacta al administrador para dividirlo.');
  const response = await request(url+':batchUpdate',{method:'POST',headers,body,signal:AbortSignal.timeout(45000)});
  if (response.ok) return {sheetId};
  // Another administrator may have created today's tab while this request was in flight.
  if (!existing && response.status===400 && attempt===0) {
   sheets = await list();
   if (sheets.some(s=>s.properties.title===report.title)) continue;
  }
  throw new Error(response.status===403
   ? 'Google no permite escribir en la hoja. Revisa el permiso de Editor de la cuenta de servicio.'
   : 'Google no confirmó la actualización. Puedes reintentar: se actualizará la misma pestaña, sin añadir filas duplicadas.');
 }
}
