# Inventario — La Liguria S.A.

Aplicación HTML/CSS/JavaScript con Supabase y despliegue estático en Vercel.

## Inicio de sesión

**Antes de desplegar los cambios**, seguir [Activar autenticación](docs/activar-autenticacion.md): preparar Auth, aplicar la migración SQL, habilitar perfiles y revisar políticas de negocio. Las cuentas antiguas de `usuarios` no son cuentas Supabase Auth.

## Pruebas locales

Con Node.js 20 o posterior:

```sh
node --test tests/*.test.mjs
```

También se pueden ejecutar con `npm test` cuando npm esté instalado. No requieren red ni credenciales y usan un cliente simulado; falta validarlas contra la configuración real de Supabase.

Servir los HTML mediante un servidor HTTP estático; no abrir con `file://`. Vercel sirve las páginas estáticas, sin build. El manifiesto y lockfile no requieren dependencias npm; Supabase y los recursos visuales se cargan por CDN. Las pruebas usan exclusivamente Node.js.

## Documentación

- [Diagnóstico inicial y plan de cierre](docs/diagnostico-y-plan.md) (estado antes de la corrección de autenticación).
- [Activar autenticación](docs/activar-autenticacion.md).
- [Inspeccionar la base existente](database/inspeccion.sql).

Inventario, movimientos, sedes, reportes y usuarios siguen pendientes de implementación; este cambio se centra en el acceso seguro.
