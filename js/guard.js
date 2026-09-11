import { supabase } from './supabase.js';

export async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session.user;
}

// Ejecutar automáticamente al cargar cualquier página protegida
checkAuth();