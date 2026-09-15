import { supabase } from '../supabase.js';
import { createAuthService } from './auth-service.js';
let storage;
try { storage = window.localStorage; } catch { /* No autorizar con storage. */ }
export const authService = createAuthService(supabase, storage);
