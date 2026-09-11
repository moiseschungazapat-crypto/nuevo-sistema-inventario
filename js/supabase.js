import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qdqzgvspqxtgbxubaywm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_S69FImzSdeYARUyllQSGRg_tBx-uZ1R';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);