import { supabase } from '../supabase.js';
export function message(error) {
 const code = error?.code;
 if (code === '23505') return 'Ya existe un registro con ese código o nombre.';
 if (code === '23503') return 'El registro está relacionado con otros datos. Desactívalo en lugar de eliminarlo.';
 if (code === '42501') return 'Tu cuenta no tiene permisos para esta operación.';
 if (['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(code)) return 'Falta actualizar la base de datos. Contacta al administrador para aplicar la migración de módulos.';
 if (code === 'P0001' || !code) return error?.message || 'No se pudo completar la operación. Revisa tu conexión.';
 return 'No se pudo guardar o consultar la información. Revisa los datos y vuelve a intentarlo.';
}
export async function rpc(name, args = {}) {
 const { data, error } = await supabase.rpc(name, args);
 if (error) throw error;
 return data;
}
export async function allRows(table, columns = '*') {
 const result = [];
 for (let start = 0; ; ) {
  const { data, error } = await supabase.from(table).select(columns).order('id').range(start, start + 499);
  if (error) throw error;
  if (!data?.length) return result;
  result.push(...data);
  start += data.length;
 }
}
export async function saveRecord(table, values, original) {
 const query = original
  ? supabase.from(table).update(values).eq('id', original.id).eq('version', original.version)
  : supabase.from(table).insert(values);
 const { data, error } = await query.select('id').maybeSingle();
 if (error) throw error;
 if (!data) throw new Error('Otra persona modificó este registro o ya no tienes acceso. Actualiza y vuelve a abrirlo.');
 return data;
}
export function watchTables(tables, refresh) {
 const badge = document.getElementById('sync-state');
 let timer, running = false, again = false, disposed = false;
 async function run() {
  if (disposed) return;
  if (running) { again = true; return; }
  running = true;
  try { await refresh(); } finally {
   running = false;
   if (again) { again = false; schedule(); }
  }
 }
 function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }
 const channel = supabase.channel('inventory-' + crypto.randomUUID());
 for (const table of tables) channel.on('postgres_changes', { event:'*', schema:'public', table }, schedule);
 channel.subscribe(status => {
  if (disposed) return;
  badge.textContent = status === 'SUBSCRIBED' ? 'En vivo' : 'Sincronización periódica';
  badge.classList.toggle('connected', status === 'SUBSCRIBED');
  if (status === 'SUBSCRIBED') schedule();
 });
 const poll = setInterval(()=> { if (document.visibilityState === 'visible') schedule(); }, 30000);
 const visible = ()=> { if (document.visibilityState === 'visible') schedule(); };
 window.addEventListener('online', schedule);
 document.addEventListener('visibilitychange', visible);
 const dispose = () => {
  disposed = true; clearInterval(poll); clearTimeout(timer); supabase.removeChannel(channel);
  window.removeEventListener('online', schedule); document.removeEventListener('visibilitychange', visible);
 };
 window.addEventListener('pagehide', dispose, { once: true });
 window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
 return dispose;
}
