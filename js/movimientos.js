import { sessionReady } from './guard.js';
import { mountShell } from './components/shell.js';
import { startPage } from './app.js';
mountShell();
document.addEventListener('DOMContentLoaded', async () => {
 if (await sessionReady) await startPage('movimientos');
});
