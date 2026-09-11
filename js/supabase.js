import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://TU_PROYECTO_ID.supabase.co';
const SUPABASE_ANON_KEY = 'TU_CLAVE_ANON_PUBLIC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);