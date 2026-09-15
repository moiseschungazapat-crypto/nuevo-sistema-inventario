# Activar los módulos de inventario, lotes y vencimientos

## Estado y alcance

Implementados en el repositorio: dashboard, productos, categorías, proveedores, sedes, inventario por lote, movimientos, reportes y usuarios. Conservan la misma navegación lateral y el acceso con Supabase Auth.

Esta entrega no aplica cambios a Supabase ni publica en Vercel. La instalación remota y la comprobación con cuentas de la empresa siguen pendientes. No se recibió el resultado completo del esquema existente: la migración incluye verificaciones y se detiene ante incompatibilidades, en lugar de inventar una conversión o borrar datos.

## Orden de activación

1. **Respaldar y preparar una ventana de mantenimiento.** Probar primero en un proyecto de ensayo si está disponible.
2. Ejecutar UNA VEZ el archivo completo `supabase/migrations/202609150002_inventory_modules.sql` en Supabase → SQL Editor. La migración de Auth anterior debe estar instalada.
3. Ejecutar `database/habilitar-administrador.sql`. Está preparado para el correo que ya habilitaste. Esto te asigna administrador sin cambiar tu contraseña.
4. Publicar los archivos completos del proyecto y abrir el despliegue nuevo en Vercel. Mantener el proyecto como sitio estático, sin framework ni comando de compilación. Las dependencias de desarrollo son solo para pruebas.
5. Cerrar y volver a iniciar sesión. El encabezado debe mostrar tu rol.
6. Realizar la prueba operativa siguiente antes de cargar datos de la empresa.

**Si el SQL devuelve un error, no sigas con fragmentos sueltos y no borres tablas.** La transacción revierte los cambios. Comparte el mensaje y los resultados de `database/inspeccion.sql` para adaptar la migración.

### Compatibilidad y datos anteriores

- Conserva los identificadores y los catálogos existentes. Soporta IDs UUID, integer y bigint; las relaciones nuevas usan el mismo tipo.
- Requiere que inventario y movimientos estén vacíos para iniciar trazabilidad por lotes. Si contienen datos, se detiene: hay que asignar lotes a los saldos y migrar su historial de manera explícita. No se realizan ajustes ficticios.
- Si inventario o movimientos tienen triggers de negocio anteriores, se detiene para evitar dobles actualizaciones de stock. La restricción antigua de tipos en `movimientos` sí se reemplaza, porque la tabla existente está vacía y la aplicación necesita traslados y ajustes.
- Detecta columnas obligatorias desconocidas y tipos incompatibles. Otros índices o restricciones antiguos también pueden requerir adaptación según el esquema.
- Sustituye las políticas de las tablas gestionadas por los roles descritos abajo. Esta versión concede alcance sobre **todas las sedes de la empresa**. Si ya existen restricciones por sede, revisarlas y adaptarlas ANTES de aplicar.
- No elimina la tabla `usuarios` antigua ni utiliza sus contraseñas. Sigue bloqueada por la migración de Auth.
- Las funciones anteriores, Storage, tablas ajenas a estos módulos y vistas antiguas deben revisarse por separado; no se puede asegurar su protección sin inspeccionarlas.

## Primera operación completa

1. Categorías → crear una categoría.
2. Proveedores → registrar un proveedor (directorio de abastecimiento).
3. Sedes → crear dos almacenes.
4. Productos → crear un producto con código único y su unidad base.
5. Inventario → Nuevo lote → seleccionar producto, código de lote y fecha de vencimiento.
6. Movimientos → Entrada → seleccionar producto, lote y sede; registrar 10 unidades de su unidad base, documento y motivo.
7. Abrir Inventario en otra pestaña/cuenta autorizada: el saldo debe aparecer.
8. Registrar una Salida de 3: saldo esperado 7.
9. Registrar un Traslado de 2 a la segunda sede: saldo esperado 5 y 2.
10. Intentar una Salida de 6 desde la primera sede: debe rechazarse y conservar ambos saldos.
11. Configurar un mínimo y revisar la alerta; exportar movimientos y existencias desde Reportes.
12. Crear una cuenta de prueba en Authentication; habilitarla en Usuarios como Consulta. Debe poder leer, pero no modificar registros ni ejecutar movimientos mediante API.

## Roles

| Rol | Capacidades |
|---|---|
| Administrador | Catálogos, lotes, mínimos, movimientos, ajustes y gestión de accesos |
| Operador | Catálogos, lotes, mínimos, entradas, salidas y traslados |
| Consulta | Lectura y exportación; no puede guardar cambios |

Nadie puede modificar saldos o borrar movimientos directamente desde el cliente. Los movimientos pasan por funciones PostgreSQL con validación de rol, producto, sede, lote y cantidad. No se puede deshabilitar al último administrador activo.

Usuarios administra los perfiles de cuentas Auth existentes. **Crear o invitar cuentas nuevas sigue siendo una acción administrativa en Supabase Authentication**, no un registro público. No se incluye ninguna clave de servicio en JavaScript.

## Lotes, cantidades y ajustes

- Un lote pertenece a un producto y puede tener saldo en varias sedes.
- Su código y vencimiento no se editan desde la interfaz, para conservar trazabilidad. Registrar un lote correcto si todavía no tiene movimientos; los errores con historial requieren revisión administrativa.
- Las cantidades tienen hasta tres decimales. Cada producto tiene una unidad base; no se suman kg, litros y unidades como si fueran equivalentes.
- La unidad de un producto no se puede cambiar después de registrar movimientos.
- Las existencias vencidas siguen siendo visibles, pero no admiten entradas, salidas normales ni traslados. Un administrador puede darles de baja mediante ajuste negativo con motivo.
- La fecha de vencimiento se considera válida hasta finalizar ese día en America/Lima.
- La selección de lotes se ordena por vencimiento más próximo; el usuario elige el lote. No hay asignación automática FEFO.
- Los mínimos corresponden a producto/sede y comparan existencias físicas, incluyendo lotes vencidos; las alertas de vencimiento se muestran por separado.
- Los ajustes son incrementos o disminuciones justificados. Para corregir un movimiento, registrar el ajuste correspondiente y referenciar el documento original. No existe un botón de anulación automática.
- El precio del catálogo es referencial; los reportes no lo presentan como costo contable.
- Proveedores funciona como directorio; no hay órdenes de compra ni vinculación automática proveedor/lote en esta versión.

## Sincronización y reintentos

La migración incorpora las tablas a la publicación `supabase_realtime` si existe en el proyecto. El cliente se suscribe a cambios autorizados y vuelve a consultar los datos. El indicador muestra “En vivo” al conectar; si falla el canal, mantiene actualización periódica cada 30 segundos y al volver a la pestaña.

- No se reemplazan campos de formularios abiertos al recibir cambios.
- Catálogos usa una versión por registro: si otra persona lo editó, se pide actualizar antes de guardar.
- Los movimientos tienen una clave única de operación persistida por usuario en el navegador. Si se pierde la respuesta, reintentar usa esa misma clave para no duplicar.
- Si hay un movimiento pendiente, volver a “Registrar movimiento” lo recupera. No borrar el almacenamiento del navegador hasta resolverlo.
- La persistencia real está en Supabase; el navegador solo conserva el intento pendiente.
- No se admite trabajo sin conexión. Ante una falla se conserva el formulario y se muestra el error; no se afirma que algo se guardó sin confirmación.
- Realtime no puede quitar datos que ya fueron descargados. Las políticas bloquean consultas posteriores de cuentas deshabilitadas.

## Reportes y auditoría

- Movimientos: filtros por producto, sede (origen o destino), tipo y fechas en Lima; paginación de 25.
- Existencias: producto y sede, con lote, vencimiento y unidad.
- CSV con protección frente a fórmulas. Exportaciones con lectura consistente en PostgreSQL y límite explícito de 50 000 filas; reducir filtros si se supera.
- Los filtros de fechas/tipo no se aplican a existencias actuales.
- El servidor registra actor, fecha y saldos resultantes del movimiento.
- `auditoria` conserva cambios de catálogos, lotes, mínimos y accesos; solo administradores pueden leerla. No contiene contraseñas.
- Catálogos, opciones y existencias cargan todas las páginas de la API, sin truncar al límite predeterminado. Para inventarios muy grandes conviene mover también su búsqueda y paginación al servidor.

## Pruebas y límites de la validación

- Pruebas PostgreSQL con PGlite, utilizando la migración real y una simulación mínima de Auth: stock, idempotencia, traslados, vencimientos, roles/RLS, unidades, versiones, exportaciones y rechazo de datos incompatibles.
- Pruebas de navegador con Edge/Chromium y un cliente Supabase simulado: nueve secciones, edición, lotes, eventos entre pestañas, recuperación de respuesta perdida, CSV y vista móvil.
- Las imágenes en `test-results/` son capturas de pruebas con datos ficticios.
- **No equivalen a una prueba del Supabase remoto**. PGlite usa una conexión; no reproduce contención entre conexiones PostgreSQL independientes. Verificar salidas concurrentes con dos sesiones reales antes de la entrega empresarial.
- En pruebas remotas: con saldo 10, dos salidas simultáneas de 7 deben producir una sola confirmación y saldo final 3. Probar también idempotencia, perfiles inactivos y restauración de respaldo.

## Ejecución local

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
```

Las pruebas de navegador usan Edge instalado en Windows si existe. En otros equipos instalar Chromium con `pnpm exec playwright install chromium` o indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. El servidor local escucha únicamente en `127.0.0.1:4173` y no sirve SQL, archivos de entorno ni pruebas.

## Referencias

- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
