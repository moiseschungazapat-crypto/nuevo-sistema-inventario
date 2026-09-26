const STORAGE_KEY = 'liguria-theme';
const DARK = 'dark';
const LIGHT = 'light';

function storedTheme() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === DARK || value === LIGHT ? value : null;
    } catch {
        return null;
    }
}

function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
}

function updateToggle(theme) {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = theme === DARK;
    const action = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    button.setAttribute('aria-label', action);
    button.setAttribute('title', action);
    button.setAttribute('aria-pressed', String(dark));
    button.querySelector('[data-theme-icon]')?.classList.replace(
        dark ? 'fa-moon' : 'fa-sun',
        dark ? 'fa-sun' : 'fa-moon',
    );
    const label = button.querySelector('[data-theme-label]');
    if (label) label.textContent = dark ? 'Modo claro' : 'Modo oscuro';
}

export function applyTheme(theme, { persist = false } = {}) {
    const next = theme === DARK ? DARK : LIGHT;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    updateToggle(next);
    if (persist) {
        try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Preferencia no persistente. */ }
    }
    return next;
}

export function initializeTheme() {
    return applyTheme(storedTheme() || systemTheme());
}

export function setupThemeToggle() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    updateToggle(document.documentElement.dataset.theme || LIGHT);
    button.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme;
        applyTheme(current === DARK ? LIGHT : DARK, { persist: true });
    });
}

initializeTheme();
