const INVENTARIO_CONFIG = Object.freeze({
  hoja: 'Movimientos',
  catalogo: 'Catálogo',
  proveedores: 'Proveedores',
  inventario: 'Inventario actual',
  filaHistorial: 21,
  celdas: {
    tipo: 'C6',
    fecha: 'C7',
    categoria: 'C8',
    codigo: 'C9',
    cantidad: 'C10',
    proveedor: 'C11',
    vencimiento: 'C12',
    observacion: 'C13',
    registrar: 'A15',
    limpiar: 'E15',
    estado: 'A17',
    producto: 'H7',
    stock: 'H8',
    stockDespues: 'H9',
    unidad: 'H10',
  },
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventario')
    .addItem('Registrar movimiento', 'registrarMovimiento')
    .addItem('Limpiar formulario', 'limpiarFormulario')
    .addSeparator()
    .addItem('Ver inventario actual', 'verInventarioActual')
    .addItem('Ir al historial', 'irAlHistorial')
    .addToUi();
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  if (hoja && !hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).getValue()) hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
  actualizarVistaPrevia_();
}

function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== INVENTARIO_CONFIG.hoja) return;
  const celda = e.range.getA1Notation();
  if (celda === INVENTARIO_CONFIG.celdas.registrar && e.value === 'TRUE') return registrarMovimiento();
  if (celda === INVENTARIO_CONFIG.celdas.limpiar && e.value === 'TRUE') return limpiarFormulario();
  if (celda === INVENTARIO_CONFIG.celdas.categoria) return actualizarProductosPorCategoria();
  if (celda === INVENTARIO_CONFIG.celdas.codigo) return completarCategoriaSeleccionada();
  if (celda === INVENTARIO_CONFIG.celdas.tipo) { actualizarAyudaTipo(); return actualizarVistaPrevia_(); }
  if (celda === INVENTARIO_CONFIG.celdas.cantidad) return actualizarVistaPrevia_();
}

function registrarMovimiento() {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  if (!hoja) throw new Error('No existe la hoja Movimientos. Ejecuta primero la sincronización desde el Dashboard.');
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return mostrarEstado_('Hay otro registro en proceso. Intenta nuevamente.', true);
  try {
    const tipo = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.tipo).getValue());
    const fecha = hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).getValue();
    const categoria = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.categoria).getValue());
    const codigo = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.codigo).getValue());
    const cantidad = numero_(hoja.getRange(INVENTARIO_CONFIG.celdas.cantidad).getValue());
    const proveedor = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.proveedor).getValue());
    const vencimiento = hoja.getRange(INVENTARIO_CONFIG.celdas.vencimiento).getValue();
    const observacion = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.observacion).getValue());
    const producto = buscarProducto_(codigo);

    if (!['Entrada', 'Salida'].includes(tipo)) return mostrarEstado_('Selecciona Entrada o Salida.', true);
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return mostrarEstado_('Indica una fecha válida.', true);
    if (Utilities.formatDate(fecha, libro.getSpreadsheetTimeZone(), 'yyyy-MM-dd') > Utilities.formatDate(new Date(), libro.getSpreadsheetTimeZone(), 'yyyy-MM-dd')) return mostrarEstado_('La fecha no puede ser futura.', true);
    if (!producto) return mostrarEstado_('Selecciona un producto válido del catálogo.', true);
    if (categoria && normalizar_(categoria) !== normalizar_(producto.categoria)) return mostrarEstado_('El producto no corresponde a la categoría seleccionada.', true);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return mostrarEstado_('La cantidad debe ser mayor que cero.', true);
    if (tipo === 'Entrada' && !proveedor) return mostrarEstado_('Selecciona el proveedor de la entrada.', true);
    if (tipo === 'Entrada' && producto.perecible && (!(vencimiento instanceof Date) || Number.isNaN(vencimiento.getTime()))) return mostrarEstado_(`Indica el vencimiento de ${producto.nombre}.`, true);
    if (tipo === 'Salida' && !observacion) return mostrarEstado_('Indica el motivo de la salida.', true);
    const stock = numero_(hoja.getRange(INVENTARIO_CONFIG.celdas.stock).getValue());
    if (tipo === 'Salida' && Number.isFinite(stock) && cantidad > stock) return mostrarEstado_(`Stock insuficiente. Disponible: ${stock} ${producto.unidad}.`, true);

    const fila = Math.max(INVENTARIO_CONFIG.filaHistorial, hoja.getLastRow() + 1);
    hoja.getRange(fila, 1, 1, 15).setValues([[
      fecha,
      tipo,
      producto.categoria,
      producto.codigo,
      producto.nombre,
      cantidad,
      producto.unidad,
      tipo === 'Entrada' ? proveedor : '',
      tipo === 'Entrada' && vencimiento instanceof Date ? vencimiento : '',
      observacion,
      'PENDIENTE',
      'Pendiente de sincronizar desde el Dashboard.',
      Utilities.getUuid(),
      '',
      '',
    ]]);
    hoja.getRange(fila, 1).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(fila, 9).setNumberFormat('dd/mm/yyyy');
    mostrarEstado_(`${tipo} de ${cantidad} ${producto.unidad} de ${producto.nombre} agregada. Falta sincronizar desde el Dashboard.`, false);
    limpiarFormulario_(true);
    libro.toast('Movimiento agregado al historial.', 'Inventario', 4);
  } catch (error) {
    mostrarEstado_(error.message || 'No se pudo registrar el movimiento.', true);
  } finally {
    hoja.getRange(INVENTARIO_CONFIG.celdas.registrar).setValue(false);
    lock.releaseLock();
  }
}

function limpiarFormulario() {
  limpiarFormulario_(false);
  mostrarEstado_('Formulario limpio.', false);
  SpreadsheetApp.getActive().toast('Formulario limpio.', 'Inventario', 3);
}

function limpiarFormulario_(conservarEstado) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  hoja.getRangeList([
    INVENTARIO_CONFIG.celdas.categoria,
    INVENTARIO_CONFIG.celdas.codigo,
    INVENTARIO_CONFIG.celdas.cantidad,
    INVENTARIO_CONFIG.celdas.proveedor,
    INVENTARIO_CONFIG.celdas.vencimiento,
    INVENTARIO_CONFIG.celdas.observacion,
  ]).clearContent();
  hoja.getRange(INVENTARIO_CONFIG.celdas.tipo).setValue('Salida');
  hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
  hoja.getRange(INVENTARIO_CONFIG.celdas.registrar).setValue(false);
  hoja.getRange(INVENTARIO_CONFIG.celdas.limpiar).setValue(false);
  actualizarVistaPrevia_();
  if (!conservarEstado) hoja.getRange(INVENTARIO_CONFIG.celdas.estado).setValue('Completa el formulario y marca Registrar movimiento.');
}

function actualizarProductosPorCategoria() {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  const categoria = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.categoria).getValue());
  const productos = leerCatalogo_().filter(item => !categoria || normalizar_(item.categoria) === normalizar_(categoria));
  const codigos = productos.map(item => item.codigo);
  const celda = hoja.getRange(INVENTARIO_CONFIG.celdas.codigo).clearContent();
  if (codigos.length) celda.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(codigos, true).setAllowInvalid(false).build());
  else celda.clearDataValidations();
  actualizarVistaPrevia_();
  mostrarEstado_(codigos.length ? `${codigos.length} producto(s) disponibles en ${categoria}.` : 'No hay productos activos en esa categoría.', codigos.length === 0);
}

function completarCategoriaSeleccionada() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  const producto = buscarProducto_(texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.codigo).getValue()));
  if (producto) hoja.getRange(INVENTARIO_CONFIG.celdas.categoria).setValue(producto.categoria);
  actualizarVistaPrevia_();
}

function actualizarVistaPrevia_() {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  if (!hoja) return;
  const codigo = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.codigo).getValue());
  const producto = buscarProducto_(codigo);
  if (!producto) {
    hoja.getRangeList([
      INVENTARIO_CONFIG.celdas.producto,
      INVENTARIO_CONFIG.celdas.stock,
      INVENTARIO_CONFIG.celdas.stockDespues,
      INVENTARIO_CONFIG.celdas.unidad,
    ]).clearContent();
    return;
  }
  const stock = stockActual_(producto.codigo);
  const cantidad = numero_(hoja.getRange(INVENTARIO_CONFIG.celdas.cantidad).getValue());
  const tipo = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.tipo).getValue());
  const despues = Number.isFinite(cantidad) && cantidad > 0
    ? (tipo === 'Entrada' ? stock + cantidad : stock - cantidad)
    : '';
  hoja.getRange(INVENTARIO_CONFIG.celdas.producto).setValue(producto.nombre);
  hoja.getRange(INVENTARIO_CONFIG.celdas.stock).setValue(stock);
  hoja.getRange(INVENTARIO_CONFIG.celdas.stockDespues).setValue(despues);
  hoja.getRange(INVENTARIO_CONFIG.celdas.unidad).setValue(producto.unidad);
}

function stockActual_(codigo) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.inventario);
  if (!hoja || hoja.getLastRow() < 2) return 0;
  const buscado = normalizar_(codigo);
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 6).getValues()
    .filter(fila => normalizar_(fila[0]) === buscado)
    .reduce((total, fila) => total + (numero_(fila[5]) || 0), 0);
}

function actualizarAyudaTipo() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  const tipo = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.tipo).getValue());
  mostrarEstado_(tipo === 'Entrada' ? 'Para una entrada selecciona proveedor y vencimiento cuando el producto sea perecible.' : 'Para una salida indica el motivo. El sistema descontará los lotes por FEFO.', false);
}

function verInventarioActual() {
  const libro = SpreadsheetApp.getActive();
  libro.setActiveSheet(libro.getSheetByName(INVENTARIO_CONFIG.inventario));
}

function irAlHistorial() {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  libro.setActiveSheet(hoja);
  hoja.setActiveRange(hoja.getRange(INVENTARIO_CONFIG.filaHistorial, 1));
}

function leerCatalogo_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.catalogo);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 5).getValues().filter(row => texto_(row[0])).map(row => ({
    codigo: texto_(row[0]),
    nombre: texto_(row[1]),
    categoria: texto_(row[2]),
    unidad: texto_(row[3]),
    perecible: normalizar_(row[4]) === 'si',
  }));
}

function buscarProducto_(codigo) {
  const buscado = normalizar_(codigo);
  return leerCatalogo_().find(item => normalizar_(item.codigo) === buscado) || null;
}

function mostrarEstado_(mensaje, error) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  hoja.getRange(INVENTARIO_CONFIG.celdas.estado)
    .setValue(mensaje)
    .setBackground(error ? '#FDECEC' : '#E5F6E9')
    .setFontColor(error ? '#B42318' : '#176B32');
}

function texto_(valor) { return String(valor == null ? '' : valor).trim(); }
function numero_(valor) { const numero = Number(String(valor == null ? '' : valor).replace(',', '.')); return Number.isFinite(numero) ? numero : NaN; }
function normalizar_(valor) { return texto_(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
