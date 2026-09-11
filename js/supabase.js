// Configuración de Supabase
const SUPABASE_URL = 'https://TU_PROYECTO_SUPABASE.supabase.co';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);