import { supabase } from '../supabase.js';

export const GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE/edit';
export const GOOGLE_INVENTORY_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8/edit';
export async function updateGoogleSheets() {
 const {data,error}=await supabase.functions.invoke('exportar-google-sheets',{body:{}});
 if (error) {
  let detail;
  try { detail=await error.context?.json(); } catch { /* Gateway errors may not have a JSON body. */ }
  throw new Error(detail?.error || 'No se pudo conectar con Google Sheets. Verifica que la función esté desplegada y que la conexión con Google esté configurada.');
 }
 if (data?.error) throw new Error(data.error);
 if (!data?.title || !data?.updatedAt) throw new Error('El servidor no confirmó la actualización. Puedes volver a intentar.');
 return data;
}

export async function syncInventorySheets() {
 const {data,error}=await supabase.functions.invoke('sincronizar-inventario-sheets',{body:{}});
 if(error){let detail;try{detail=await error.context?.json();}catch{/* La puerta de enlace puede no devolver JSON. */}throw new Error(detail?.error||'No se pudo sincronizar el inventario con Google Sheets.');}
 if(data?.error)throw new Error(data.error);
 if(typeof data?.processed!=='number'||typeof data?.synchronized!=='number'||typeof data?.errors!=='number')throw new Error('El servidor no confirmó el resultado de la sincronización.');
 return data;
}
