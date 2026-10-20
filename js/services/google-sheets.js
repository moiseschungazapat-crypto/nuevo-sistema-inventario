import { supabase } from '../supabase.js';

export const GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE/edit';
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
