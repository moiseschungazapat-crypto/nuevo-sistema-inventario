import { supabase } from './supabase.js';

export async function loadProductos(container) {
    container.innerHTML = `
        <div class="section-header">
            <h2>Gestión de Productos</h2>
            <button id="btn-add-product" class="btn-primary">+ Nuevo Producto</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Unidad</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="tabla-productos">
                    <tr><td colspan="5">Cargando productos...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    fetchProductos();

    document.getElementById('btn-add-product').addEventListener('click', showAddProductModal);
}

async function fetchProductos() {
    const { data, error } = await supabase
        .from('productos')
        .select(`
            id,
            codigo,
            nombre,
            unidad_medida,
            categorias ( nombre )
        `);

    const tbody = document.getElementById('tabla-productos');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No hay productos registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>${p.categorias ? p.categorias.nombre : 'Sin Categoría'}</td>
            <td>${p.unidad_medida}</td>
            <td>
                <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function showAddProductModal() {
    const codigo = prompt("Código del producto:");
    const nombre = prompt("Nombre del producto:");
    if (!codigo || !nombre) return;

    const { error } = await supabase
        .from('productos')
        .insert([{ codigo, nombre, unidad_medida: 'kg' }]);

    if (error) {
        alert("Error al agregar: " + error.message);
    } else {
        fetchProductos();
    }
}