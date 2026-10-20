# Activar el reporte manual de Google Sheets

El botón **Actualizar Google Sheets** aparece en el Dashboard para administradores. Después de confirmar, crea o reemplaza la pestaña del día (por ejemplo `20/10/2026`), usando la hora de Perú. Las pestañas de días anteriores se conservan.

Archivo configurado: https://docs.google.com/spreadsheets/d/1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE/edit

## Qué incluye

- Existencias por producto y sede: categoría, unidad, saldo inicial, entradas, salidas, ajustes, traslados, saldo al corte y mínimo.
- Movimientos del día con hora de Perú, lote, responsable, documento y motivo.
- Lotes, vencimientos, cantidades y alertas.
- Recepciones cuya fecha de recepción sea la del reporte: proveedor, comprobante, importes, moneda, pago y detalle por producto.
- Catálogo completo de productos, proveedores, categorías y sedes.

Los saldos iniciales se calculan restando al saldo actual el movimiento neto del día, incluidos ajustes y ambos lados de los traslados. No se suman cantidades de productos o unidades diferentes. Los importes desconocidos quedan vacíos. El reporte es una fotografía al momento del envío, no un cierre definitivo: hay que pulsar el botón después de registrar las últimas operaciones.

La actualización es manual. No se crean pestañas de días sin envío ni se completan días anteriores automáticamente. Los catálogos y mínimos corresponden al momento de cada envío. La pestaña actual se reemplaza por completo, así que los comentarios o datos manuales deben guardarse en otra pestaña.

## 1. Preparar el acceso de Google (una sola vez)

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un proyecto.
2. En **APIs y servicios → Biblioteca**, habilita **Google Sheets API**.
3. En **IAM y administración → Cuentas de servicio**, crea una cuenta destinada a los reportes. No necesita permisos generales de administrador del proyecto.
4. Abre esa cuenta y ve a **Claves → Agregar clave → Crear clave nueva → JSON**. Descarga el archivo y consérvalo en un lugar privado, fuera de este repositorio.
5. Copia el correo de esa cuenta (termina en `iam.gserviceaccount.com`). En el archivo de Google Sheets pulsa **Compartir**, agrega ese correo con permiso de **Editor** y desmarca el aviso por correo si aparece. La hoja puede seguir privada.

No envíes el JSON por chat, no lo subas a Git y no lo pegues en los archivos JavaScript del sitio.

## 2. Preparar Supabase (una sola vez)

1. En el proyecto Supabase correspondiente al sitio, abre **SQL Editor** y ejecuta el archivo `supabase/migrations/202610200013_reporte_google_sheets.sql`. Requiere las migraciones de inventario y recepciones ya instaladas. La migración agrega una función de lectura; no altera los saldos ni los movimientos.
2. En **Edge Functions → Secrets**, agrega:

| Nombre | Valor |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenido completo del JSON descargado de Google. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | `1QVy5osOgq0pY998nS1CKJ8NXWtk5fuKKzWcBcgIPmTE` |

`SUPABASE_URL` y `SUPABASE_ANON_KEY` son variables proporcionadas por el entorno de Edge Functions. No se requiere una clave `service_role`. La función verifica la identidad de la sesión y el rol de administrador antes de exportar.

3. Despliega la carpeta completa de la función, incluidos sus archivos `.mjs`. Desde la raíz del proyecto y con [Supabase CLI](https://supabase.com/docs/guides/functions/deploy) instalado:

```powershell
supabase login
supabase functions deploy exportar-google-sheets --project-ref qdqzgvspqxtgbxubaywm
```

El archivo `supabase/config.toml` desactiva la verificación JWT del gateway únicamente para esta función. La función realiza su propia validación con `auth.getUser()` y vuelve a exigir el rol de administrador tanto en el servidor como en la consulta SQL. Esto permite usar las claves publicables actuales. No elimines esas comprobaciones.

## 3. Publicar el sitio y verificar

1. Publica los cambios del sitio en el despliegue habitual de Vercel.
2. Entra como administrador al Dashboard y pulsa **Actualizar Google Sheets → Sí**.
3. Revisa el mensaje de confirmación y abre la hoja. Comprueba fecha, hora, saldos y detalle contra el sistema.
4. Repite el envío. Debe actualizar la misma pestaña, sin añadir otra con la misma fecha ni repetir filas.

Los errores de Google no modifican el inventario ni los formularios del sistema. No hay reintentos automáticos ni cola: si falla o se pierde la respuesta, pulsa otra vez el botón. Las escrituras de cada reporte se envían juntas para evitar un reporte parcialmente actualizado. Se limita el tamaño del envío; si excede el límite, se informa el error en vez de truncar datos.

Si falta configuración, se muestra un mensaje en el Dashboard. Si Google rechaza el acceso, revisa que Sheets API esté habilitada y que el correo de servicio tenga permiso de Editor. Las pruebas locales simulan Google y Supabase: una prueba real requiere completar estos pasos.

Referencias: [cuentas de servicio](https://developers.google.com/identity/protocols/oauth2/service-account), [actualizaciones por lote](https://developers.google.com/workspace/sheets/api/guides/batch).
