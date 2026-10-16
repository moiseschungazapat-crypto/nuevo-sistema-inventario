/**
 * Actualiza el mensaje de estado del formulario de acceso.
 *
 * @param {string} message Mensaje que se mostrará al usuario.
 * @param {'neutral'|'success'|'danger'} tone Tipo de mensaje.
 */
export function setStatus(message, tone = 'neutral') {
    const element = document.getElementById('status-badge');

    // Evita errores si el elemento no existe en la página.
    if (!element) {
        console.warn('No se encontró el elemento #status-badge.');
        return;
    }

    const allowedTones = ['neutral', 'success', 'danger'];
    const safeTone = allowedTones.includes(tone) ? tone : 'neutral';

    const icons = {
        neutral: 'fa-circle-info',
        success: 'fa-circle-check',
        danger: 'fa-circle-exclamation'
    };

    // Actualiza el estilo visual del mensaje.
    element.className = `status-badge ${safeTone}`;

    // Construye el icono sin interpretar el mensaje como HTML.
    const icon = document.createElement('i');
    icon.className = `fa-solid ${icons[safeTone]} status-icon`;
    icon.setAttribute('aria-hidden', 'true');

    // El texto se inserta de forma segura.
    const text = document.createElement('span');
    text.textContent = String(message ?? '');

    // Sustituye el contenido anterior.
    element.replaceChildren(icon, text);
}


/**
 * Configura el botón para mostrar u ocultar la contraseña.
 */
export function setupPasswordToggle() {
    const button = document.getElementById('togglePassword');
    const input = document.getElementById('password');

    // No registra eventos si los elementos no existen.
    if (!button || !input) {
        console.warn(
            'No se encontró el botón o el campo de contraseña.'
        );
        return;
    }

    // Evita registrar el mismo evento varias veces.
    if (button.dataset.toggleInitialized === 'true') {
        return;
    }

    button.dataset.toggleInitialized = 'true';

    button.addEventListener('click', () => {
        const isPasswordHidden = input.type === 'password';

        // Cambia el tipo de campo.
        input.type = isPasswordHidden ? 'text' : 'password';

        // Actualiza la información de accesibilidad.
        button.setAttribute(
            'aria-pressed',
            String(isPasswordHidden)
        );

        button.setAttribute(
            'aria-label',
            isPasswordHidden
                ? 'Ocultar contraseña'
                : 'Mostrar contraseña'
        );

        // Actualiza el icono de Font Awesome.
        const icon = button.querySelector('i');

        if (icon) {
            icon.classList.toggle(
                'fa-eye',
                !isPasswordHidden
            );

            icon.classList.toggle(
                'fa-eye-slash',
                isPasswordHidden
            );
        }
    });
}