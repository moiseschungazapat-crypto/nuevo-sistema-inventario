export function setStatus(message, tone = 'neutral') {
    const element = document.getElementById('status-badge');
    element.className = `status-badge ${tone}`;
    const icon = tone === 'danger' ? 'fa-circle-exclamation' : tone === 'success' ? 'fa-circle-check' : 'fa-circle-info';
    element.replaceChildren();
    const symbol = document.createElement('i');
    symbol.className = `fa-solid ${icon} status-icon`;
    symbol.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = message;
    element.append(symbol, text);
}
export function setupPasswordToggle() {
    const button = document.getElementById('togglePassword');
    const input = document.getElementById('password');
    button?.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        const icon = button.querySelector('i');
        icon?.classList.toggle('fa-eye', !visible);
        icon?.classList.toggle('fa-eye-slash', visible);
    });
}
