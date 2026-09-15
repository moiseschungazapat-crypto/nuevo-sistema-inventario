import { supabase } from './supabase.js';
import { escapeHtml } from './utils/html.js';

export async function loadProveedores(container) {
    container.innerHTML = `
        <div class="section-header">
            <h2>Directorio de Proveedores</h2>
            <button id="btn-add-prov" class="btn-primary">+ Nuevo Proveedor</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                    </tr>
                </thead>
                <tbody id="tabla-proveedores"><tr><td colspan="4">Cargando...</td></tr></tbody>
            </table>
        </div>
    `;

    fetchProveedores();

    document.getElementById('btn-add-prov').addEventListener('click', async () => {
        const nombre = prompt("Nombre de la empresa/proveedor:");
        const telefono = prompt("Teléfono de contacto:");
        if (!nombre) return;

        const { error } = await supabase.from('proveedores').insert([{ nombre, telefono }]);
        if (error) alert(error.message);
        else fetchProveedores();
    });
}

async function fetchProveedores() {
    const { data } = await supabase.from('proveedores').select('*');
    const tbody = document.getElementById('tabla-proveedores');
    tbody.innerHTML = (data || []).map(p => `
        <tr>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.contacto || '-')}</td>
            <td>${escapeHtml(p.telefono || '-')}</td>
            <td>${escapeHtml(p.email || '-')}</td>
        </tr>
    `).join('');
}
