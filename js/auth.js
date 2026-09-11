import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const btnLogin = document.getElementById('btn-login');
    const statusBadge = document.getElementById('status-badge');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePassword.classList.toggle('fa-eye', !isPassword);
            togglePassword.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value.trim();

            btnLogin.disabled = true;
            btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;

            try {
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password)
                    .maybeSingle();

                console.log('Respuesta Supabase:', { data, error });

                if (error) throw new Error('Error de conexión con la base de datos');
                if (!data) throw new Error('Correo o contraseña incorrectos');

                localStorage.setItem('user_session', JSON.stringify(data));

                statusBadge.className = 'status-badge success';
                statusBadge.style.backgroundColor = '#d1e7dd';
                statusBadge.style.color = '#0f5132';
                statusBadge.style.borderColor = '#badbcc';
                statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Credenciales correctas. Redirigiendo...`;

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);

            } catch (err) {
                statusBadge.className = 'status-badge danger';
                statusBadge.style.backgroundColor = '#f8d7da';
                statusBadge.style.color = '#842029';
                statusBadge.style.borderColor = '#f5c2c7';
                statusBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${err.message}`;

                btnLogin.disabled = false;
                btnLogin.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión`;
            }
        });
    }
});