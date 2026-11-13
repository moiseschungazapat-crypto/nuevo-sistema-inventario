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
4. La función creará automáticamente: `Recepciones`, `Salidas`, `Inventario actual`, `Catálogo`, `Proveedores` y `Alertas`.

## Uso

- Registra filas nuevas con estado vacío o `PENDIENTE`.
- Si una fila queda en `ERROR`, corrige los datos y cambia su estado a `PENDIENTE`.
- No cambies el `ID interno` de una fila procesada.
- No edites `Inventario actual`, `Catálogo`, `Proveedores` ni `Alertas`; la sincronización reemplaza su contenido.
- En salidas, los lotes se consumen automáticamente por FEFO.
