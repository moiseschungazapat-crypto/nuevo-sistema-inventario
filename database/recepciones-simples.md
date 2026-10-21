# Recepciones con lotes automáticos

Aplica `supabase/migrations/202610200014_recepcion_lotes_automaticos.sql` antes de publicar el formulario actualizado. No elimina ni cambia lotes, saldos o recepciones anteriores. Conserva el procedimiento anterior para clientes que todavía usan el formulario antiguo.

## Flujo de trabajo

1. Registra proveedor, comprobante, fecha y responsable una vez por entrega.
2. Agrega cada producto, cantidad recibida y vencimiento. La unidad se completa desde el catálogo.
3. Para productos no perecibles puede elegirse **Sin vencimiento**. Los productos marcados como perecibles en Catálogo siempre requieren fecha.
4. Guarda y confirma. La recepción, los lotes y las entradas se registran dentro de la misma transacción.

En **Lote y datos de factura (opcional)** se puede indicar un código del proveedor, elegir un lote existente o registrar cantidades facturadas distintas de las recibidas y precios. Si no se ingresa cantidad facturada, se toma la recibida. Para registrar un faltante debe indicarse la cantidad facturada real.

Si no hay código, se genera un identificador interno por recepción y línea. Un código de proveedor existente se reutiliza solo para el mismo producto y vencimiento compatible. Los servicios no generan lotes ni stock. No se debe registrar después una segunda entrada manual por esta misma recepción.

## Validaciones y recuperación

- Productos activos y permisos de administrador u operador.
- Una a cincuenta líneas, cantidades válidas y vencimientos vigentes.
- Si una línea falla, se revierten los lotes y las entradas de toda la recepción.
- Un identificador de operación evita duplicar la recepción y el stock al reintentar el mismo formulario después de perder la respuesta.
- Las imágenes y archivos se cargan después de confirmar la recepción. Si un adjunto falla, reintenta guardar el mismo formulario: la operación de stock no se repite. Un cambio en los datos de una recepción ya confirmada se rechaza y debe revisarse en el historial.
- Crear lotes por separado sigue disponible en **Lotes manuales (opcional)** para quien necesite preparar una entrada manual.

Los lotes sin vencimiento se guardan con fecha nula, no con una fecha inventada. Movimientos, alertas y reportes los muestran como **Sin vencimiento**.
