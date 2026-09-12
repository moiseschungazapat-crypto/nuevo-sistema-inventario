import { supabase } from './supabase.js';

let productosData = [];
let categoriasData = [];

document.addEventListener('DOMContentLoaded', () => {
    initProductosEvents();
    loadCategorias();
    loadProductos();
});

function initProductosEvents() {
    // Abrir Modal
    const btnNuevo = document.getElementById('btn-nuevo-producto');
    if (btnNuevo) {
        btnNuevo.addEventListener('click', () => abrirModal());
    }

    // Cerrar Modal
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancelar = document.getElementById('btn-cancelar');
    if (btnClose) btnClose.addEventListener('click', cerrarModal);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

    // Guardar/Actualizar
    const formProducto = document.getElementById('form-producto');
    if (formProducto) {
        formProducto.addEventListener('submit', guardarProducto);
    }

    // Buscador y Filtro
    const inputSearch = document.getElementById('input-search');
    const selectFilterCat = document.getElementById('select-filter-categoria');
    const btnRefresh = document.getElementById('btn-refresh');

    if (inputSearch) inputSearch.addEventListener('input', renderTablaProductos);
    if (selectFilterCat) selectFilterCat.addEventListener('change', renderTablaProductos);
    if (btnRefresh) btnRefresh.addEventListener('click', () => {
        loadCategorias();
        loadProductos();
    });
}

// Cargar categorías desde Supabase para los selectores
async function loadCategorias() {
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('id, nombre')
            .order('nombre');

        if (error) throw error;
        categoriasData = data || [];

        // Rellenar selector de filtro
        const selectFilter = document.getElementById('select-filter-categoria');
        const selectForm = document.getElementById('categoria_id');

        const optionsHtml = categoriasData.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        if (selectFilter) {
            selectFilter.innerHTML = `<option value="">Todas las Categorías</option>${optionsHtml}`;
        }
        if (selectForm) {
            selectForm.innerHTML = `<option value="">-- Seleccionar Categoría --</option>${optionsHtml}`;
        }

        document.getElementById('stat-categorias').textContent = categoriasData.length;
    } catch (err) {
        console.warn('Advertencia al cargar categorías:', err.message);
    }
}

// Cargar Productos desde Supabase
async function loadProductos() {
    const tbody = document.getElementById('tabla-productos-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="fa-solid fa-spinner fa-spin me-2"></i> Cargando productos...
                </td>
            </tr>`;
    }

    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*, categorias(nombre)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        productosData = data || [];
        actualizarKPIs();
        renderTablaProductos();
    } catch (err) {
        console.error('Error al cargar productos:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        <i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar los datos. Verifique la conexión con Supabase.
                    </td>
                </tr>`;
        }
    }
}

// Actualizar contadores superiores
function actualizarKPIs() {
    const total = productosData.length;
    const activos = productosData.filter(p => p.estado !== false).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-activos').textContent = activos;
}

// Renderizar filas de la tabla según búsqueda y filtros
function renderTablaProductos() {
    const tbody = document.getElementById('tabla-productos-body');
    if (!tbody) return;

    const query = (document.getElementById('input-search')?.value || '').toLowerCase().trim();
    const catFiltro = document.getElementById('select-filter-categoria')?.value;

    const filtrados = productosData.filter(p => {
        const coincideQuery = (p.nombre && p.nombre.toLowerCase().includes(query)) ||
                              (p.codigo && p.codigo.toLowerCase().includes(query)) ||
                              (p.descripcion && p.descripcion.toLowerCase().includes(query));
        const coincideCat = catFiltro ? String(p.categoria_id) === String(catFiltro) : true;
        return coincideQuery && coincideCat;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No se encontraron productos registrados.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(prod => `
        <tr>
            <td><strong>${prod.codigo || 'S/N'}</strong></td>
            <td>
                <div><strong>${prod.nombre}</strong></div>
                ${prod.descripcion ? `<small class="text-muted">${prod.descripcion}</small>` : ''}
            </td>
            <td><span class="badge-blue">${prod.categorias?.nombre || 'Sin Categoría'}</span></td>
            <td>${prod.unidad_medida || 'kg'}</td>
            <td class="text-right">S/. ${parseFloat(prod.precio || 0).toFixed(2)}</td>
            <td class="text-center">
                <span class="${prod.estado !== false ? 'badge-green' : 'badge-red'}">
                    ${prod.estado !== false ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <button class="btn-action edit" data-id="${prod.id}" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-action delete" data-id="${prod.id}" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Eventos para botones de la tabla
    tbody.querySelectorAll('.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', () => editarProducto(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', () => eliminarProducto(btn.dataset.id));
    });
}

// Funciones del Modal
function abrirModal(prod = null) {
    const modal = document.getElementById('modal-producto');
    const form = document.getElementById('form-producto');
    const title = document.getElementById('modal-title');

    form.reset();
    document.getElementById('producto-id').value = '';

    if (prod) {
        title.textContent = 'Editar Producto';
        document.getElementById('producto-id').value = prod.id;
        document.getElementById('codigo').value = prod.codigo || '';
        document.getElementById('nombre').value = prod.nombre || '';
        document.getElementById('categoria_id').value = prod.categoria_id || '';
        document.getElementById('unidad_medida').value = prod.unidad_medida || 'kg';
        document.getElementById('precio').value = prod.precio || '';
        document.getElementById('descripcion').value = prod.descripcion || '';
    } else {
        title.textContent = 'Nuevo Producto';
    }

    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-producto').classList.add('hidden');
}

// Guardar o Actualizar Producto en Supabase
async function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('producto-id').value;
    const codigo = document.getElementById('codigo').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const categoria_id = document.getElementById('categoria_id').value || null;
    const unidad_medida = document.getElementById('unidad_medida').value;
    const precio = parseFloat(document.getElementById('precio').value) || 0;
    const descripcion = document.getElementById('descripcion').value.trim();

    const payload = {
        codigo,
        nombre,
        categoria_id,
        unidad_medida,
        precio,
        descripcion
    };

    const btnSubmit = document.getElementById('btn-guardar');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        let error;

        if (id) {
            // Actualización
            const res = await supabase.from('productos').update(payload).eq('id', id);
            error = res.error;
        } else {
            // Inserción
            const res = await supabase.from('productos').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        cerrarModal();
        await loadProductos();
    } catch (err) {
        alert('Error al guardar el producto: ' + err.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Producto';
    }
}

// Cargar producto para editar
function editarProducto(id) {
    const prod = productosData.find(p => String(p.id) === String(id));
    if (prod) abrirModal(prod);
}

// Eliminar producto en Supabase
async function eliminarProducto(id) {
    if (!confirm('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.')) return;

    try {
        const { error } = await supabase.from('productos').delete().eq('id', id);
        if (error) throw error;
        await loadProductos();
    } catch (err) {
        alert('Error al eliminar producto: ' + err.message);
    }
}