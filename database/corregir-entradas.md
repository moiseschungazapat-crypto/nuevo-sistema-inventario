# Corrección de entradas

Aplicar una vez `supabase/migrations/202611240005_correcciones_entradas.sql` después de las migraciones de gastos y costos. Publicar el frontend después. No requiere cambiar Apps Script ni desplegar otra Edge Function.

Solo el administrador puede corregir entradas. En **Recepciones**, pulsar **Corregir entrada** en el ingreso y elegir el producto. En **Gastos**, usar la acción junto al producto; el botón superior también permite encontrar entradas anuladas y recepciones históricas que aún no tengan gasto.

Ingresar la **cantidad total correcta**, el costo unitario correcto y un motivo. La vista muestra el cambio en existencias y el nuevo total. Guardar crea un ajuste de inventario y actualiza el gasto en una sola transacción. El informe y el resumen de Inicio usan el nuevo importe, en el mes del ingreso original.

Cantidad cero anula la entrada y excluye su gasto de los totales; no elimina el documento original. Se puede restituir desde el selector superior de Gastos. El historial conserva valores anteriores, nuevos, administrador, fecha y motivo; también aparece en Auditoría.

Si el producto ya se consumió, solo puede restarse la existencia disponible en el lote de origen. Si no alcanza, no se modifica ni el inventario ni el gasto. Los aumentos en lotes vencidos y los ajustes de productos o sedes inactivos conservan las restricciones del inventario.

Producto, proveedor, lote y fecha no se cambian: para corregir un producto equivocado, anular su entrada cuando haya stock suficiente y registrar el ingreso correcto. Para recepciones históricas sin gasto, el costo anterior aparece como desconocido: solo se registra el gasto cuando el administrador introduce el costo real. Anularlas con cantidad cero no exige inventar un costo. No se ofrecen movimientos manuales históricos sin gasto porque no tienen un vínculo financiero que permita identificar con seguridad su origen.

Las filas originales de Movimientos en Google Sheets permanecen como historial del ingreso original; **Inventario actual** y **Alertas** se refrescan después de la corrección. Si Google no responde, la corrección queda guardada y la aplicación avisa para refrescar con Sincronizar inventario. La actualización de esas vistas usa `refreshOnly`, sin importar filas pendientes. No editar filas ya sincronizadas para intentar corregirlas.

Las correcciones requieren la sesión personal del administrador. El token compartido de automatización de Sheets no habilita estas operaciones. Los reintentos de una corrección conservan su identificador para no duplicar ajustes; se rechazan versiones desactualizadas cuando otro administrador corrigió el mismo ingreso.
