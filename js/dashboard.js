import { supabase } from './supabase.js';

let chartEntradasSalidasInstance = null;
let chartEvolucionConsumoInstance = null;

// Inicialización de Gráficos (Chart.js)
function initCharts() {
    const elCtx1 = document.getElementById('chartEntradasSalidas');
    if (elCtx1) {
        if (chartEntradasSalidasInstance) chartEntradasSalidasInstance.destroy();
        const ctx1 = elCtx1.getContext('2d');
        chartEntradasSalidasInstance = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [
                    {
                        label: 'Entradas',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: '#1d4ed8'
                    },
                    {
                        label: 'Salidas',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: '#d97706'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, max: 10 } }
            }
        });
    }

    const elCtx2 = document.getElementById('chartEvolucionConsumo');
    if (elCtx2) {
        if (chartEvolucionConsumoInstance) chartEvolucionConsumoInstance.destroy();
        const ctx2 = elCtx2.getContext('2d');
        chartEvolucionConsumoInstance = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Consumo',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: '#1d4ed8',
                    backgroundColor: 'rgba(29, 78, 216, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#1d4ed8',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, max: 10 } }
            }
        });
    }
}

// Carga de datos desde Supabase
async function loadDashboardData() {
    try {
        // Total Productos
        const { count: totalProds } = await supabase
            .from('productos')
            .select('*', { count: 'exact', head: true });

        const elTotal = document.getElementById('stat-total-productos');
        if (elTotal) elTotal.textContent = totalProds || 0;

        // Stock Bajo (Alertas)
        const { data: stockBajoData, count: countBajo } = await supabase
            .from('inventario')
            .select('cantidad, stock_minimo, productos(nombre)')
            .lt('cantidad', 5)
            .limit(4);

        const elStockBajo = document.getElementById('stat-stock-bajo');
        if (elStockBajo) {
            elStockBajo.textContent = countBajo || stockBajoData?.length || 0;
        }

        // Render Tabla Stock Bajo
        const tbody = document.getElementById('table-stock-bajo');
        if (tbody) {
            if (stockBajoData && stockBajoData.length > 0) {
                tbody.innerHTML = stockBajoData.map(item => `
                    <tr>
                        <td>${item.productos?.nombre || 'Producto'}</td>
                        <td class="text-center"><span class="badge-red">${item.cantidad}</span></td>
                        <td class="text-center">${item.stock_minimo || 0}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = `
                    <tr><td>Producto</td><td class="text-center"><span class="badge-red">0</span></td><td class="text-center">0</td></tr>
                    <tr><td>Producto</td><td class="text-center"><span class="badge-red">0</span></td><td class="text-center">0</td></tr>
                    <tr><td>Producto</td><td class="text-center"><span class="badge-red">0</span></td><td class="text-center">0</td></tr>
                    <tr><td>Producto</td><td class="text-center"><span class="badge-red">0</span></td><td class="text-center">0</td></tr>
                `;
            }
        }

        // Movimientos Recientes
        const { data: movimientos } = await supabase
            .from('movimientos')
            .select('cantidad, fecha, productos(nombre)')
            .order('fecha', { ascending: false })
            .limit(4);

        const listMovs = document.getElementById('list-movimientos-recientes');
        if (listMovs) {
            if (movimientos && movimientos.length > 0) {
                listMovs.innerHTML = movimientos.map(m => `
                    <div class="recent-item">
                        <div class="item-info">
                            <p>${m.productos?.nombre || 'Producto'}</p>
                            <span>${new Date(m.fecha).toLocaleString()}</span>
                        </div>
                        <span class="item-amount">-${m.cantidad}</span>
                    </div>
                `).join('');
            } else {
                const fechaActual = new Date().toLocaleDateString('es-ES') + ' 15:33';
                listMovs.innerHTML = Array(4).fill(0).map(() => `
                    <div class="recent-item">
                        <div class="item-info">
                            <p>Producto</p>
                            <span>${fechaActual}</span>
                        </div>
                        <span class="item-amount">-0</span>
                    </div>
                `).join('');
            }
        }

    } catch (err) {
        console.error('Error al cargar datos del Dashboard:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadDashboardData();
});