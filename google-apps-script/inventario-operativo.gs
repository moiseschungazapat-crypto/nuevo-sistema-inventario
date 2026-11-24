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

const BOTON_REGISTRAR_PNG = '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';
const BOTON_LIMPIAR_PNG = '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';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventario')
    .addItem('Abrir panel interactivo', 'abrirPanelInventario')
    .addItem('Abrir panel automáticamente al entrar', 'activarAperturaAutomaticaPanel')
    .addItem('Activar sincronización automática', 'activarSincronizacionAutomatica')
    .addItem('Reintentar pendientes', 'sincronizarPendientesAutomaticamente')
    .addSeparator()
    .addItem('Registrar movimiento', 'registrarMovimiento')
    .addItem('Limpiar formulario', 'limpiarFormulario')
    .addSeparator()
    .addItem('Ver inventario actual', 'verInventarioActual')
    .addItem('Ir al historial', 'irAlHistorial')
    .addToUi();
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  if (hoja && !hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).getValue()) hoja.getRange(INVENTARIO_CONFIG.celdas.fecha).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
  actualizarProductosPorCategoria(true);
}

function activarAperturaAutomaticaPanel() {
  const libro = SpreadsheetApp.getActive();
  const existe = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === 'mostrarPanelAlAbrir' &&
    trigger.getTriggerSourceId() === libro.getId());
  if (!existe) {
    ScriptApp.newTrigger('mostrarPanelAlAbrir').forSpreadsheet(libro).onOpen().create();
  }
  abrirPanelInventario();
  libro.toast('El panel se abrirá automáticamente al volver a entrar a esta hoja.', 'Inventario', 5);
}

function mostrarPanelAlAbrir() {
  if (panelEnMovimientos_()) abrirPanelInventario(true);
}

function abrirPanelInventario(soloMostrar) {
  if (!panelEnMovimientos_()) {
    if (soloMostrar !== true) SpreadsheetApp.getActive().toast('Selecciona la pestaña Movimientos para abrir el panel.', 'Inventario', 4);
    return;
  }
  if (soloMostrar !== true) retirarBotonesVisuales_();
  const html = HtmlService.createHtmlOutput(`
    <style>
      :root{font-family:Arial,sans-serif;color:#172435;color-scheme:light;background:#fff}
      *{box-sizing:border-box}
      body{margin:0;padding:18px;background:#fff}
      .top{display:flex;align-items:center;gap:10px;margin-bottom:16px}
      .mark{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#103649;color:#fff;font-size:19px}
      h1{margin:0;font-size:16px;color:#172435}p{margin:3px 0 0;color:#66758a;font-size:12px}
      .summary{display:grid;gap:9px;padding:13px;margin-bottom:16px;border-radius:11px;background:#eef3f7;font-size:12px}
      .row{display:flex;justify-content:space-between;gap:12px}.row span{color:#66758a}.row strong{text-align:right}
      button{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;padding:13px 14px;border:0;border-radius:10px;color:#fff;font:600 13px Arial,sans-serif;cursor:pointer;transition:transform .18s ease,background-color .18s ease,box-shadow .18s ease}
      button:hover,button:focus-visible{transform:translateY(-2px) scale(1.01);box-shadow:0 10px 22px rgba(15,52,70,.28)}
      button:active{transform:translateY(1px) scale(.98)}button:disabled{cursor:wait;opacity:.72;transform:none}
      .register{background:#103649;box-shadow:0 6px 14px rgba(15,52,70,.2)}.register:hover{background:#164b63}
      .clear{margin-top:10px;background:#ed762d;box-shadow:0 6px 14px rgba(237,118,45,.2)}.clear:hover{background:#f58b49}
      .hint{display:flex;align-items:center;justify-content:center;gap:5px;margin:10px 0 14px;color:#66758a;font-size:11px}
      .status{min-height:46px;display:grid;place-items:center;margin-top:14px;padding:10px;border-radius:9px;background:#e7f7ec;color:#176b32;text-align:center;font-size:12px}
      .status.error{background:#fdecec;color:#b42318}.spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){button{transition:none}.spinner{animation:none}}
    </style>
    <div class="top"><div class="mark">▦</div><div><h1>Movimiento de inventario</h1><p>Revisa los datos antes de confirmar</p></div></div>
    <div class="summary">
      <div class="row"><span>Tipo</span><strong id="tipo">—</strong></div>
      <div class="row"><span>Producto</span><strong id="producto">—</strong></div>
      <div class="row"><span>Cantidad</span><strong id="cantidad">—</strong></div>
      <div class="row"><span>Stock actual</span><strong id="stock">—</strong></div>
      <div class="row"><span>Stock después</span><strong id="despues">—</strong></div>
    </div>
    <button class="register" id="registrar" type="button"><span>✓</span><span>Registrar movimiento</span></button>
    <div class="hint"><span>↖</span><span>Pasa el mouse para ver la animación</span></div>
    <button class="clear" id="limpiar" type="button"><span>↻</span><span>Limpiar formulario</span></button>
    <div class="status" id="estado" aria-live="polite">Cargando los datos de la hoja…</div>
    <script>
      const registrar=document.getElementById('registrar');
      const limpiar=document.getElementById('limpiar');
      const estado=document.getElementById('estado');
      function texto(id,valor){document.getElementById(id).textContent=valor||'—'}
      function mostrar(datos){
        if(datos.cerrarPanel){google.script.host.close();return;}
        texto('tipo',datos.tipo);texto('producto',datos.producto);texto('cantidad',datos.cantidad);
        texto('stock',datos.stock);texto('despues',datos.despues);
        estado.textContent=datos.estado||'Listo para registrar.';
        estado.classList.toggle('error',Boolean(datos.error));
      }
      let trabajando=false;
      function refrescar(){if(!trabajando)google.script.run.withSuccessHandler(function(datos){if(!trabajando)mostrar(datos)}).obtenerResumenFormulario()}
      function ocupado(boton,texto){boton.disabled=true;boton.innerHTML='<span class="spinner"></span><span>'+texto+'</span>'}
      function restaurar(boton,icono,texto){boton.disabled=false;boton.innerHTML='<span>'+icono+'</span><span>'+texto+'</span>'}
      registrar.addEventListener('click',function(){
        trabajando=true;limpiar.disabled=true;
        ocupado(registrar,'Procesando…');estado.textContent='Validando stock y datos del movimiento…';estado.classList.remove('error');
        google.script.run.withSuccessHandler(function(datos){trabajando=false;limpiar.disabled=false;restaurar(registrar,'✓','Registrar movimiento');mostrar(datos)}).withFailureHandler(function(error){trabajando=false;limpiar.disabled=false;restaurar(registrar,'✓','Registrar movimiento');estado.textContent=error.message||'No se pudo registrar.';estado.classList.add('error')}).registrarDesdePanel();
      });
      limpiar.addEventListener('click',function(){
        ocupado(limpiar,'Limpiando…');
        google.script.run.withSuccessHandler(function(datos){restaurar(limpiar,'↻','Limpiar formulario');mostrar(datos)}).withFailureHandler(function(error){restaurar(limpiar,'↻','Limpiar formulario');estado.textContent=error.message||'No se pudo limpiar.';estado.classList.add('error')}).limpiarDesdePanel();
      });
      refrescar();setInterval(refrescar,5000);
    <\/script>
  `).setTitle('Inventario La Liguria');
  SpreadsheetApp.getUi().showSidebar(html);
}

function retirarBotonesVisuales_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  if (!hoja) return;
  hoja.getImages()
    .filter(imagen => String(imagen.getAltTextTitle() || '').indexOf('Inventario:') === 0)
    .forEach(imagen => imagen.remove());
  hoja.getRange('A15:H15').clearContent().clearDataValidations().setBackground('#F5F7FA');
  hoja.setRowHeight(15, 28);
}

function obtenerResumenFormulario() {
  if (!panelEnMovimientos_()) return {cerrarPanel:true};
  actualizarVistaPrevia_();
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  const valor = celda => hoja.getRange(celda).getDisplayValue();
  const unidad = valor(INVENTARIO_CONFIG.celdas.unidad);
  const cantidad = valor(INVENTARIO_CONFIG.celdas.cantidad);
  const stock = valor(INVENTARIO_CONFIG.celdas.stock);
  const despues = valor(INVENTARIO_CONFIG.celdas.stockDespues);
  const estado = valor(INVENTARIO_CONFIG.celdas.estado);
  return {
    tipo: valor(INVENTARIO_CONFIG.celdas.tipo),
    producto: valor(INVENTARIO_CONFIG.celdas.producto) || valor(INVENTARIO_CONFIG.celdas.codigo),
    cantidad: cantidad ? cantidad + (unidad ? ' ' + unidad : '') : '',
    stock: stock ? stock + (unidad ? ' ' + unidad : '') : '',
    despues: despues ? despues + (unidad ? ' ' + unidad : '') : '',
    estado,
    error: /falta|selecciona|indica|insuficiente|no se pudo|error|pendiente/i.test(estado),
  };
}

function registrarDesdePanel() {
  if (!panelEnMovimientos_()) return {cerrarPanel:true};
  registrarMovimiento();
  return obtenerResumenFormulario();
}

function limpiarDesdePanel() {
  if (!panelEnMovimientos_()) return {cerrarPanel:true};
  limpiarFormulario();
  return obtenerResumenFormulario();
}

function panelEnMovimientos_() {
  const hoja = SpreadsheetApp.getActive().getActiveSheet();
  return Boolean(hoja && hoja.getName() === INVENTARIO_CONFIG.hoja);
}

function instalarBotonesVisuales() {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  if (!hoja) throw new Error('No existe la hoja Movimientos.');
  hoja.getImages()
    .filter(imagen => String(imagen.getAltTextTitle() || '').indexOf('Inventario:') === 0)
    .forEach(imagen => imagen.remove());
  hoja.getRange('A15:H15').clearContent().clearDataValidations().setBackground('#F5F7FA');
  hoja.setRowHeight(15, 72);
  const registrar = Utilities.newBlob(Utilities.base64Decode(BOTON_REGISTRAR_PNG), 'image/png', 'registrar-movimiento.png');
  const limpiar = Utilities.newBlob(Utilities.base64Decode(BOTON_LIMPIAR_PNG), 'image/png', 'limpiar-formulario.png');
  hoja.insertImage(registrar, 1, 15, 4, 3)
    .setAltTextTitle('Inventario: registrar movimiento')
    .setAltTextDescription('Registra el formulario como movimiento pendiente.')
    .assignScript('registrarMovimiento');
  hoja.insertImage(limpiar, 5, 15, 4, 3)
    .setAltTextTitle('Inventario: limpiar formulario')
    .setAltTextDescription('Limpia todos los campos del formulario.')
    .assignScript('limpiarFormulario');
  libro.toast('Botones visuales instalados. Ya puedes usarlos con un solo clic.', 'Inventario', 5);
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
  animarBoton_('registrar');
  libro.toast('Validando el movimiento…', 'Inventario', 3);
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
    const operacionId = Utilities.getUuid();
    if(fila>hoja.getMaxRows())hoja.insertRowsAfter(hoja.getMaxRows(),100);
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
      'Esperando sincronización automática.',
      operacionId,
      '',
      '',
    ]]);
    hoja.getRange(fila, 1).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(fila, 9).setNumberFormat('dd/mm/yyyy');
    mostrarEstado_('Movimiento guardado. Sincronizando inventario…', false);
    limpiarFormulario_(true);
    SpreadsheetApp.flush();
    try {
      enviarSincronizacionAutomatica_(operacionId);
      const estadoFila=texto_(hoja.getRange(fila,11).getValue());
      if(estadoFila==='SINCRONIZADO'){
        mostrarEstado_('Registrado y sincronizado. Inventario actualizado para todos.',false);
        libro.toast('Inventario actualizado.', 'Inventario', 4);
      }else{
        mostrarEstado_(texto_(hoja.getRange(fila,12).getValue())||'Pendiente de sincronizar. Se reintentará automáticamente.',true);
      }
    } catch(error) {
      mostrarEstado_('Movimiento guardado como pendiente. '+error.message,true);
    }
  } catch (error) {
    mostrarEstado_(error.message || 'No se pudo registrar el movimiento.', true);
  } finally {
    lock.releaseLock();
  }
}

function activarSincronizacionAutomatica() {
  const ui=SpreadsheetApp.getUi();
  const respuesta=ui.prompt('Activar sincronización automática','Pega la clave exclusiva de esta hoja generada en Supabase.',ui.ButtonSet.OK_CANCEL);
  if(respuesta.getSelectedButton()!==ui.Button.OK)return;
  const clave=respuesta.getResponseText().trim();
  if(!/^[a-f0-9]{64}$/i.test(clave))throw new Error('La clave debe tener 64 caracteres.');
  PropertiesService.getDocumentProperties().setProperty('INVENTARIO_SYNC_TOKEN',clave);
  try {
    enviarSincronizacionAutomatica_(null,true);
  } catch(error) {
    PropertiesService.getDocumentProperties().deleteProperty('INVENTARIO_SYNC_TOKEN');
    throw error;
  }
  const triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(trigger=>trigger.getHandlerFunction()==='sincronizarPendientesAutomaticamente')){
    ScriptApp.newTrigger('sincronizarPendientesAutomaticamente').timeBased().everyMinutes(1).create();
  }
  mostrarEstado_('Sincronización automática activada. Ya puedes registrar movimientos.',false);
  ui.alert('Conexión activada. Cada registro actualizará Supabase e Inventario actual automáticamente.');
}

function enviarSincronizacionAutomatica_(operacionId,comprobar) {
  const clave=PropertiesService.getDocumentProperties().getProperty('INVENTARIO_SYNC_TOKEN');
  if(!clave)throw new Error('Activa la conexión desde Inventario → Activar sincronización automática.');
  SpreadsheetApp.flush();
  const response=UrlFetchApp.fetch('https://qdqzgvspqxtgbxubaywm.supabase.co/functions/v1/sincronizar-inventario-sheets',{
    method:'post',contentType:'application/json',
    headers:{'X-Inventory-Token':clave},
    payload:JSON.stringify({operationId:operacionId||null,checkOnly:Boolean(comprobar)}),
    muteHttpExceptions:true,
  });
  let result;try{result=JSON.parse(response.getContentText());}catch{throw new Error('No hubo respuesta válida. Se reintentará automáticamente.');}
  if(response.getResponseCode()!==200||result.error)throw new Error(result.error||'La conexión no respondió. Se reintentará automáticamente.');
  return result;
}

function sincronizarPendientesAutomaticamente() {
  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(1000))return;
  try {
    const hoja=SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
    if(!hoja||hoja.getLastRow()<INVENTARIO_CONFIG.filaHistorial)return;
    const estados=hoja.getRange(INVENTARIO_CONFIG.filaHistorial,11,hoja.getLastRow()-INVENTARIO_CONFIG.filaHistorial+1,1).getValues();
    if(!estados.some(fila=>normalizar_(fila[0])==='pendiente'))return;
    enviarSincronizacionAutomatica_();
    actualizarVistaPrevia_();
  } catch(error) {
    mostrarEstado_('Hay registros pendientes. '+error.message,true);
  } finally {lock.releaseLock();}
}

function limpiarFormulario() {
  animarBoton_('limpiar');
  limpiarFormulario_(false);
  mostrarEstado_('Formulario limpio.', false);
  SpreadsheetApp.getActive().toast('Formulario limpio.', 'Inventario', 3);
}

function animarBoton_(accion) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(INVENTARIO_CONFIG.hoja);
  if (!hoja) return;
  const titulo = accion === 'registrar'
    ? 'Inventario: registrar movimiento'
    : 'Inventario: limpiar formulario';
  const imagen = hoja.getImages().find(item => item.getAltTextTitle() === titulo);
  if (!imagen) return;
  imagen
    .setWidth(408)
    .setHeight(59)
    .setAnchorCellXOffset(10)
    .setAnchorCellYOffset(7);
  SpreadsheetApp.flush();
  Utilities.sleep(180);
  imagen
    .setWidth(420)
    .setHeight(64)
    .setAnchorCellXOffset(4)
    .setAnchorCellYOffset(3);
  SpreadsheetApp.flush();
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
  hoja.getRange(INVENTARIO_CONFIG.celdas.codigo).clearDataValidations();
  actualizarVistaPrevia_();
  if (!conservarEstado) hoja.getRange(INVENTARIO_CONFIG.celdas.estado).setValue('Completa el formulario y marca Registrar movimiento.');
}

function actualizarProductosPorCategoria(conservarSeleccion) {
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(INVENTARIO_CONFIG.hoja);
  const categoria = texto_(hoja.getRange(INVENTARIO_CONFIG.celdas.categoria).getValue());
  const productos = productosDeCategoria_(leerCatalogo_(), categoria);
  const codigos = productos.map(etiquetaProducto_);
  const celda = hoja.getRange(INVENTARIO_CONFIG.celdas.codigo);
  const anterior = buscarProducto_(texto_(celda.getValue()));
  celda.clearDataValidations().clearContent();
  hoja.getRange('A9').setValue('Producto (nombre y código)');
  if (codigos.length) celda.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(codigos, true).setAllowInvalid(false).build());
  else celda.clearDataValidations();
  if (conservarSeleccion === true && anterior && productos.some(item => item.codigo === anterior.codigo)) celda.setValue(etiquetaProducto_(anterior));
  actualizarVistaPrevia_();
  mostrarEstado_(!categoria ? 'Selecciona primero una categoría.' : codigos.length ? `${codigos.length} producto(s) disponibles en ${categoria}.` : 'No hay productos activos en esa categoría.', Boolean(categoria) && codigos.length === 0);
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
  return leerCatalogo_().find(item => normalizar_(item.codigo) === buscado || normalizar_(etiquetaProducto_(item)) === buscado) || null;
}

function etiquetaProducto_(producto) {
  return producto.nombre + ' — ' + producto.codigo;
}

function productosDeCategoria_(productos, categoria) {
  const buscada = normalizar_(categoria);
  return buscada ? productos.filter(item => normalizar_(item.categoria) === buscada)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) : [];
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
