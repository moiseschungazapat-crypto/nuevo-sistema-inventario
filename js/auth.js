document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const btnLogin = document.getElementById('btn-login');
    const statusBadge = document.getElementById('status-badge');

    // 1. Mostrar / Ocultar Contraseña
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            
            // Cambiar el icono del ojo
            togglePassword.classList.toggle('fa-eye', !isPassword);
            togglePassword.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    // 2. Iniciar Sesión (Modo de prueba local sin Supabase)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Cambiar estado visual del botón
            btnLogin.disabled = true;
            btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;

            // Simular validación exitosa tras 1 segundo
            setTimeout(() => {
                statusBadge.className = 'status-badge success';
                statusBadge.style.backgroundColor = '#d1e7dd';
                statusBadge.style.color = '#0f5132';
                statusBadge.style.borderColor = '#badbcc';
                statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Acceso autorizado. Redirigiendo...`;

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);
            }, 1000);
        });
    }
});