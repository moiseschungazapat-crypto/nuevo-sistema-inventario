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

Google Sheets necesita un pequeño Apps Script para que las casillas **Registrar movimiento** y **Limpiar formulario** funcionen tanto en computadora como en celular.

1. Abre la hoja operativa.
2. Entra a **Extensiones → Apps Script**.
3. Reemplaza el contenido de `Código.gs` por el archivo:

   `google-apps-script/inventario-operativo.gs`

4. Guarda el proyecto.
5. Regresa a la hoja y vuelve a cargarla.
6. La primera vez que uses el menú **Inventario**, Google puede solicitar autorización para modificar esa misma hoja.

## Uso

- Completa el formulario superior de la pestaña `Movimientos`.
- Marca la casilla **Registrar movimiento**. El movimiento se agregará al historial con estado `PENDIENTE`.
- Desde el Dashboard pulsa **Sincronizar inventario** para enviarlo a Supabase y actualizar el stock.
- Si una fila queda en `ERROR`, corrige los datos y cambia su estado a `PENDIENTE`.
- No cambies el `ID interno` de una fila procesada.
- No edites `Inventario actual`, `Catálogo`, `Proveedores` ni `Alertas`; la sincronización reemplaza su contenido.
- En salidas, los lotes se consumen automáticamente por FEFO.
