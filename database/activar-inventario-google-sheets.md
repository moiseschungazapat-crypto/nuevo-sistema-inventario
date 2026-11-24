# Activar el control operativo desde Google Sheets

La hoja operativa es distinta de los reportes diarios. Su identificador es:

`1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8`

La cuenta `reportes-inventario@inventario-la-liguria.iam.gserviceaccount.com` debe conservar permiso de **Editor**. El acceso general debe estar en **Restringido**.

## 1. Actualizar la base de datos

Ejecuta en Supabase SQL Editor el archivo:

`supabase/migrations/202611130018_google_sheets_operativo.sql`

Esta migración añade operaciones idempotentes para recepciones y salidas FEFO. No modifica movimientos anteriores.

## 2. Configurar el identificador

En **Supabase → Edge Functions → Secrets**, agrega:

| Nombre | Valor |
|---|---|
| `GOOGLE_INVENTORY_SPREADSHEET_ID` | `1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8` |

`GOOGLE_SERVICE_ACCOUNT_JSON` ya está configurado para los reportes y se reutiliza.

## 3. Publicar la función

Desde la carpeta del proyecto:

```powershell
npx.cmd supabase functions deploy sincronizar-inventario-sheets --project-ref qdqzgvspqxtgbxubaywm
```

## 4. Primera sincronización

1. Publica los cambios del sitio cuando estés listo.
2. Entra al Dashboard como administrador.
3. Pulsa **Sincronizar inventario** y confirma.
4. La función creará automáticamente: `Movimientos`, `Inventario actual`, `Catálogo`, `Proveedores` y `Alertas`.
5. Las pestañas antiguas `Recepciones` y `Salidas` se conservarán ocultas para no perder información, pero el flujo nuevo ya no las procesará.

## 5. Activar el formulario interactivo

Google Sheets necesita un Apps Script para abrir el panel lateral **Registrar movimiento** y **Limpiar formulario** desde la versión web.

1. Abre la hoja operativa.
2. Entra a **Extensiones → Apps Script**.
3. Reemplaza el contenido de `Código.gs` por el archivo:

   `google-apps-script/inventario-operativo.gs`

4. Guarda el proyecto.
5. Regresa a la hoja y vuelve a cargarla.
6. La primera vez que uses el menú **Inventario**, Google puede solicitar autorización para modificar esa misma hoja.

Para abrir el panel automáticamente al entrar, selecciona una sola vez **Inventario → Abrir panel automáticamente al entrar** y autoriza el activador de apertura. Esto muestra el panel al abrir el archivo con la pestaña `Movimientos` activa y permisos de edición en Google Sheets web. Al cambiar a otra pestaña, el panel se cierra en la siguiente comprobación (aproximadamente cinco segundos). Al regresar a `Movimientos`, puedes recuperarlo con **Inventario → Abrir panel interactivo**. También se cierra si usas la X. La apertura del panel no cambia los movimientos ni los campos del formulario; fuera de `Movimientos` sus acciones quedan bloqueadas.

## Uso

- Completa el formulario superior de la pestaña `Movimientos`.
- Abre **Inventario → Abrir panel interactivo** y pulsa **Registrar movimiento**.
- Con la conexión automática activada, el mismo botón envía el registro a Supabase y actualiza `Inventario actual`. El Dashboard permite sincronizar manualmente como respaldo.
- Si una fila queda en `ERROR`, corrige los datos y cambia su estado a `PENDIENTE`.
- No cambies el `ID interno` de una fila procesada.
- No edites `Inventario actual`, `Catálogo`, `Proveedores` ni `Alertas`; la sincronización reemplaza su contenido.
- En salidas, los lotes se consumen automáticamente por FEFO.

## 6. Conexión automática

Configuración inicial del servidor (una sola vez):

1. Aplica `supabase/migrations/202611240001_google_sheets_automatico.sql`.
2. Ejecuta `database/activar-sincronizacion-automatica.sql` con el correo del administrador que autoriza la conexión. Copia la clave resultante; la base solo conserva su hash. Ejecutar otra vez este archivo revoca la clave anterior.
3. Publica `sincronizar-inventario-sheets`.

En la hoja:

1. Sustituye `Código.gs` con `google-apps-script/inventario-operativo.gs`, guarda y recarga Sheets.
2. Selecciona **Inventario → Activar sincronización automática** y pega la clave exclusiva de la hoja. Nunca pegues una clave `service_role` ni una contraseña.
3. Autoriza la conexión externa y el activador cuando Google lo solicite. La configuración se comparte con quienes usan esta hoja; el activador de respaldo pertenece a la cuenta que lo instala. Solo el administrador responsable debe ejecutar esta activación.
4. Abre el panel interactivo y registra normalmente.

El envío ocurre al registrar. No se considera confirmado hasta que el historial indica `SINCRONIZADO`. Ante un fallo de conexión queda `PENDIENTE`; un activador revisa pendientes cada minuto y evita llamar a Supabase cuando no hay registros nuevos. Los errores de validación requieren corregir la fila y cambiar su estado a `PENDIENTE`. No se debe cambiar el ID de operación: permite reintentar sin duplicar saldos.

Los usuarios con la hoja abierta ven la actualización compartida de Google Sheets. El sitio recibe los eventos del inventario mediante su suscripción existente a Supabase Realtime; si esa conexión cae, mantiene su consulta de respaldo cada 30 segundos. No se garantiza latencia cero.

Para revocar el acceso automático: `update public.google_sheets_conexiones set activo=false where spreadsheet_id='1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8';`. También queda bloqueado si se desactiva al administrador asociado.

## 7. Entradas con costo y gastos automáticos

- Aplica `202611240003_costos_entradas_gastos.sql` después de `202611240002_gastos_administracion.sql` y publica la función de sincronización actualizada.
- Reemplaza `Código.gs` por el archivo actual del proyecto, guarda y recarga. La conexión automática ya guardada se conserva.
- En `Movimientos`, al seleccionar **Entrada**, aparece **Costo unitario (S/)** en `H12`. Indica el costo por kg, litro o unidad base (hasta cuatro decimales). `H13` muestra el total redondeado a céntimos. En **Salida** estos campos se limpian y no se piden.
- El historial conserva las columnas existentes; se añaden **P: Costo unitario** y **Q: Total entrada**. No se insertan columnas intermedias para conservar los identificadores e historial previo.
- Cada entrada con costo genera un gasto privado por producto en la misma transacción que el ingreso. Las salidas y ajustes no generan compras. Reintentar una misma operación no duplica el gasto.
- Una fila pendiente antigua sin costo necesita completar P y volver a marcar su estado `PENDIENTE`. Las entradas históricas ya sincronizadas sin precio no se convierten en gastos estimados.
- En la web, **Recepciones** pide el costo unitario de cada línea y calcula su total. Las entradas manuales excepcionales también usan costo.
- El administrador consulta **Administración → Gastos** y descarga el reporte Excel del mes. Se agrupa por producto y unidad, se suman los importes en soles y se incluye el total general. Se respetan la búsqueda y categoría elegidas, exportando todos los registros filtrados, no solo la página visible.
- No se muestran pagos pendientes ni presupuestos. Los registros y tablas anteriores se conservan; no se eliminan datos al simplificar la interfaz. Los gastos automáticos conservan el precio de origen y no se editan como gastos independientes.
