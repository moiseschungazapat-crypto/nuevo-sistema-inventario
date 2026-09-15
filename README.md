# Inventario — La Liguria S.A.

Aplicación HTML/CSS/JavaScript con Supabase Auth, PostgreSQL, Realtime y despliegue estático en Vercel.

## Activación

1. [Autenticación](docs/activar-autenticacion.md): aplica únicamente si todavía no está instalada.
2. [Módulos, roles, lotes y vencimientos](docs/activar-modulos.md): migración y asignación del administrador antes de publicar estas pantallas.
3. [Inspección del esquema](database/inspeccion.sql) si la base existente requiere adaptación.

No se aplican migraciones automáticamente al desplegar en Vercel. Nunca incluir claves secretas o de servicio en el frontend.

## Secciones

Dashboard, productos, categorías, proveedores, sedes, inventario por lote/sede, movimientos transaccionales, reportes CSV y administración de perfiles. Roles: administrador, operador y consulta. Ver alcance y límites en la guía de módulos.

## Desarrollo

Node.js 20 o posterior y pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
```

La aplicación se sirve en http://127.0.0.1:4173. También puede iniciarse sin dependencias con `node scripts/dev-server.mjs`. Configuración pública de Supabase en `js/supabase.js`; no requiere build. Las dependencias npm se utilizan para las pruebas, no para ejecutar el sitio en producción.

`pnpm test` ejecuta pruebas de servicios, PostgreSQL local y navegador. Las pruebas no contactan Supabase. Para Chromium sin Edge instalado: `pnpm exec playwright install chromium`.

## Estructura

- `js/components/`: menú lateral, estructura compartida, tablas y formularios.
- `js/pages/`: comportamiento de cada sección.
- `js/services/`: autenticación, datos, RPC y sincronización.
- `js/utils/`: validación, formatos y HTML seguro.
- `supabase/migrations/`: cambios versionados de base de datos.
- `tests/`: servicios, base de datos e interfaz con datos de ensayo.
- `docs/`: activación, decisiones y pruebas de aceptación.

El [diagnóstico inicial](docs/diagnostico-y-plan.md) es un documento histórico, anterior a estas implementaciones.
