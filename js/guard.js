document.addEventListener('DOMContentLoaded', () => {
    const session = localStorage.getItem('user_session');

    if (!session) {
        window.location.href = 'index.html';
    } else {
        const user = JSON.parse(session);
        const nameElement = document.getElementById('user-display-name');
        if (nameElement) {
            nameElement.textContent = user.nombre || 'Usuario';
        }
    }
});