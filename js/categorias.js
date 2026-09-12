import { supabase } from './supabase.js';

export async function loadCategorias(container) {
    container.innerHTML = `
        <div class="section-header">
            <h2>Categorías de Productos</h2>
            <button id="btn-add-cat" class="btn-primary">+ Nueva Categoría</button>
        </div>
        <ul id="lista-categorias" class="data-list">Cargando...</ul>
    `;

    fetchCategorias();

    document.getElementById('btn-add-cat').addEventListener('click', async () => {
        const nombre = prompt("Nombre de la categoría:");
        if (!nombre) return;

        const { error } = await supabase.from('categorias').insert([{ nombre }]);
        if (error) alert(error.message);
        else fetchCategorias();
    });
}

async function fetchCategorias() {
    const { data, error } = await supabase.from('categorias').select('*');
    const ul = document.getElementById('lista-categorias');

    if (error || !data) {
        ul.innerHTML = '<li>Error al cargar categorías</li>';
        return;
    }

    ul.innerHTML = data.map(c => `
        <li class="list-item">
            <span><strong>${c.nombre}</strong> - ${c.descripcion || 'Sin descripción'}</span>
        </li>
    `).join('');
}