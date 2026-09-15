# Diagnóstico y plan de cierre

Fecha: 15 de septiembre de 2026.

**Documento histórico:** describe el estado inicial. La corrección posterior del login, guard, recuperación y renderizado está documentada en `docs/activar-autenticacion.md`. La migración de seguridad aún debe aplicarse y verificarse en Supabase.

## Alcance y conclusión

Revisión estática del repositorio local. No se accedió al panel de Supabase ni a Vercel, no se ejecutaron consultas remotas y no se modificaron datos. La URL del cliente confirma una integración programada con Supabase, pero no demuestra que el despliegue ni sus permisos estén bien configurados.

Existe una base visual de login, dashboard y productos. No está listo para operar un inventario empresarial: faltan los movimientos y las existencias, y el acceso implementado no autentica usuarios con Supabase Auth.

## Estado real

| Módulo | Evidencia local | Estado |
|---|---|---|
| Login | `js/auth.js` consulta email/password en `usuarios` | Implementado con diseño inseguro |
| Productos | Listado, búsqueda, filtros, alta, edición, eliminación | Implementado; falta validar integración y endurecer reglas |
| Dashboard | Consultas parciales, gráficos fijos y datos de relleno | Parcial |
| Categorías y proveedores | Funciones JS de listado/alta; HTML vacío | Sin acceso funcional desde las páginas actuales |
| Inventario, movimientos, sedes, reportes, usuarios | HTML y JS de cero bytes | Pendiente |
| Backend | Tres archivos vacíos | Sin implementación |
| Base de datos | README vacío, sin migraciones SQL | No reproducible desde el repositorio |
| Desarrollo | package.json sin scripts; lockfile declara Vite | Configuración inconsistente |
| Documentación y exclusiones | README, .env.example y .gitignore vacíos | Pendiente |

## Hallazgos prioritarios

### P0: autenticación y autorización

- `js/auth.js:31`: compara directamente la contraseña recibida con una columna, solicita todos los campos, registra el resultado en consola y guarda la fila completa en localStorage. Si el login funciona con este contrato, está utilizando contraseñas directamente comparables. También envía la contraseña como filtro de consulta. Sustituir por `supabase.auth.signInWithPassword` y migrar las cuentas mediante un procedimiento controlado de invitación/restablecimiento.
- `js/guard.js:2`: solo comprueba que exista `user_session`. Cualquier persona puede crear ese valor en su navegador y pasar la barrera visual. Esto no demuestra acceso a la base: depende de permisos y RLS que no están versionados aquí.
- Autenticar con Supabase Auth; almacenar perfiles sin contraseñas, relacionados con `auth.users`; autorizar por rol y sede en la base. No confiar en roles modificables desde el navegador ni permitir que un usuario cambie su propio rol.
- Revisar RLS y privilegios de todas las tablas y funciones expuestas. La consulta `database/inspeccion.sql` ayuda a obtener el estado actual; no es una auditoría completa por sí sola.
- `js/supabase.js` contiene una clave publicable: su presencia en el frontend es normal. Moverla a variables no sustituye RLS. Las claves secretas o de servicio deben existir solo en ejecución del servidor.

### P0: integridad del inventario

- El repositorio todavía no implementa registro de movimientos. Diseñar la operación en PostgreSQL para insertar el movimiento y actualizar el saldo en una misma transacción.
- Evitar el patrón de leer stock, restar en JavaScript y guardar: dos personas podrían consumir las mismas existencias.
- Bloquear la fila correspondiente o usar una actualización condicional; rechazar salidas que superen el disponible. Para transferencias bloquear origen/destino en un orden consistente y aplicar todo o nada.
- Guardar un identificador único de operación para que reintentos o doble clic no dupliquen el movimiento; verificar que un reintento coincida con la solicitud original.
- El responsable se obtiene de la sesión validada en el servidor. Cantidad positiva, tipo válido, sede autorizada y producto habilitado se verifican también en base de datos.
- Corregir mediante un movimiento compensatorio vinculado al original y con motivo. No borrar movimientos confirmados.

### P1: pantallas y resultados incorrectos

- Siete páginas enlazadas están vacías: categorías, proveedores, sedes, inventario, movimientos, reportes y usuarios.
- `js/router.js:2` importa funciones que no existen como exportaciones en dashboard/productos y módulos vacíos. No está incluido en las páginas actuales, por lo que es código desconectado; si se incluye fallará al enlazar módulos. Mantener páginas independientes es la ruta más corta y coherente con lo que funciona hoy.
- `js/dashboard.js:79`: stock bajo usa cantidad < 5 y limita a cuatro registros. El contador tampoco solicita un conteo exacto. Comparar contra el mínimo de cada producto/sede en SQL y separar el total de la muestra visual.
- Los gráficos tienen series fijas en cero; entradas/salidas y categorías principales no se actualizan. Todos los movimientos recientes llevan signo negativo. Cuando no hay resultados se muestran productos ficticios.
- Las consultas del dashboard ignoran el campo `error`; un fallo puede parecer stock cero. Distinguir carga, vacío y error, con reintento.
- `js/productos.js:145` y otros renderizados interpolan texto de la base en `innerHTML`. Esto permite interpretar HTML no confiable. Usar nodos y `textContent`, reservando HTML para plantillas constantes.
- `js/productos.js:271` borra físicamente productos. Preferir desactivación y restricciones que preserven referencias históricas; el alcance actual de claves foráneas es desconocido.
- El listado de productos descarga un conjunto sin paginación y filtra en memoria; puede quedar truncado por el límite configurado en la API. Implementar filtros, conteo y paginación en la consulta.
- `index.html` anuncia conexión exitosa antes de verificarla; mostrar una indicación neutral. Los nombres de usuario de relleno también deben desaparecer.

## Alcance mínimo para entregar

1. Acceso: login, cierre, recuperación de contraseña, cuentas deshabilitadas y perfiles.
2. Roles: administrador, encargado y consulta; permisos por sede y por operación.
3. Catálogos: productos con SKU único, unidad, categoría y estado; categorías, proveedores y sedes con formularios completos.
4. Existencias por sede: producto, cantidad, mínimo, ubicación opcional y filtro por sede.
5. Movimientos: entrada, salida, transferencia, ajuste e inventario inicial, con motivo, documento, responsable y fecha.
6. Kardex: historial por producto y sede con entradas, salidas y saldo ordenados de manera determinista.
7. Dashboard real: alertas, actividad y conteos. No sumar kg, litros y unidades como una misma cantidad.
8. Reportes: existencias y movimientos por fechas/sede/producto; exportación CSV con protección contra fórmulas de hoja de cálculo.
9. Cierre operativo: carga inicial conciliada, pruebas con dos usuarios, manual breve, respaldo y recuperación ensayada.

## Modelo propuesto, pendiente de comparar con Supabase

| Entidad | Reglas principales |
|---|---|
| perfiles | UUID relacionado con auth.users; nombre, estado; sin contraseña |
| usuario_sedes | Usuario, sede, rol; combinación única y administración restringida |
| productos | SKU único, nombre, unidad base, categoría, estado |
| categorias / proveedores / sedes | Catálogos con estado, identificadores estables y relaciones |
| inventario | Una fila por producto/sede; cantidad decimal no negativa, mínimo no negativo |
| movimientos | Tipo, producto, origen/destino según tipo, cantidad, responsable, documento, motivo, fecha del servidor, idempotencia |
| auditoria | Historial de cambios sensibles, con permisos de solo lectura para auditores |

Decidir si un documento tiene varias líneas antes de implementar: si es así, separar cabecera y detalle. Separar costo de compra y precio de venta; no llamar valorización a multiplicar stock por un precio cuyo significado no está definido. Si se usan lotes, el saldo y las reglas de unicidad deben incluir esa dimensión desde el inicio.

## Estructura recomendada

Conservar HTML/CSS/JavaScript evita una reescritura innecesaria. Crear carpetas cuando se implementen sus responsabilidades, no archivos vacíos.

```text
js/
  auth.js, guard.js, layout.js      # Acceso y comportamiento compartido
  productos.js, inventario.js ... # Una inicialización por página
  services/                      # Consultas y llamadas RPC por dominio
  utils/                         # Formatos, validaciones y DOM seguro
assets/css/
  components.css                 # Formularios, modales, tablas compartidas
supabase/
  migrations/                    # Esquema, políticas, funciones e índices versionados
  seed.sql                       # Solo datos de prueba, sin datos de empresa
tests/
  database/                      # RLS, permisos, movimientos y concurrencia
  e2e/                           # Recorridos de acceso y operación
docs/
  diagnostico-y-plan.md
  despliegue.md
  manual-usuario.md
  respaldo-restauracion.md
api/                             # Solo si se eligen Vercel Functions para tareas administrativas
```

Las tareas administrativas de Auth requieren un entorno de servidor con autorización propia; elegir Vercel Functions o Supabase Edge Functions. Una carpeta `backend/` con archivos no constituye un servidor ni se ejecuta automáticamente en Vercel. Para el resto, Supabase con RLS y funciones SQL puede cubrir la lógica sin un servidor adicional.

Actualizar `package.json` y lockfile de forma conjunta, documentar el comando local y elegir despliegue estático o compilado. Fijar versiones de dependencias, retirar la carga duplicada del SDK global/ESM y completar `.gitignore` antes de añadir variables o artefactos. En HTML estático, crear variables en Vercel no las inyecta automáticamente en el JavaScript.

## Secuencia de implementación

### 1. Confirmar la base existente

Obtener metadatos con `database/inspeccion.sql`, revisar políticas y contratos, definir roles/sedes, identificar cuentas existentes y preparar respaldo. No ejecutar una migración genérica sobre producción sin esta comparación.

### 2. Cerrar seguridad

Crear la transición a Auth y perfiles; activar/verificar políticas y privilegios; migrar cuentas con acceso probado; retirar contraseñas y sesiones heredadas después de validar la transición. Rehacer el guard, logout y renderizado seguro.

### 3. Implementar el núcleo

Completar sedes y catálogos, migraciones de inventario/movimientos, operación transaccional y pruebas. Después conectar formularios y listados a esas operaciones.

### 4. Terminar la entrega

Conectar dashboard y reportes a consultas reales, paginar, probar en móvil, crear documentación, separar pruebas de producción y validar el despliegue con usuarios de la empresa.

## Pruebas de aceptación

- Sin sesión, una llamada directa a la API no puede consultar ni modificar información privada.
- Un usuario de consulta no puede registrar movimientos ni editar su rol mediante la API.
- Un encargado de sede A no puede operar en sede B sin asignación.
- Con saldo 10 y dos salidas concurrentes de 7, solo una tiene éxito; saldo final 3.
- Reenviar la misma solicitud no produce un segundo movimiento.
- Si falla una transferencia, no quedan cambios parciales.
- Ajustes y anulaciones conservan responsable, motivo y relación histórica.
- El saldo inicial más movimientos coincide con el saldo actual.
- Un nombre con caracteres HTML se muestra como texto y no se ejecuta.
- Un error de conexión no aparece como inventario vacío o cero.
- Los reportes respetan America/Lima, filtros, unidades y todos los registros, incluyendo varias páginas.
- Se puede restaurar un respaldo en un entorno separado y comprobar saldos y acceso.

## Ideas posteriores

Si la empresa trabaja con perecibles: lotes, vencimientos, alertas y despacho por vencimiento más cercano. Si produce alimentos: recetas, consumo de insumos, rendimiento y mermas. Otras mejoras: lector de código de barras, conteos cíclicos, sugerencias de reposición y aprobación de ajustes. Confirmar las necesidades antes de incluirlas en el alcance inicial.

## Información que falta para preparar código conectado a la base real

- Estructura y políticas actuales de Supabase, sin claves secretas ni filas de usuarios.
- Número de sedes, roles y quién puede transferir/aprobar ajustes.
- Qué se controla: insumos, productos terminados, lotes, vencimientos, producción o ventas.
- Si hay datos reales y usuarios activos, y cuál es el despliegue que usa la empresa.

## Verificación realizada

Los 14 archivos de `js/` pasan `node --check`. Esto comprueba sintaxis, no exportaciones, integración, seguridad, operación en navegador ni acceso a la base. No hay scripts de pruebas definidos. Los cambios de esta revisión son únicamente este documento y la consulta de inspección; no se reemplazó el sistema ni se aplicaron migraciones.

## Referencias oficiales

- Autenticación: https://supabase.com/docs/guides/auth/passwords
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Claves públicas/secretas: https://supabase.com/docs/guides/getting-started/api-keys
- Funciones SQL: https://supabase.com/docs/guides/database/functions
- Funciones Vercel: https://vercel.com/docs/project-configuration/vercel-json
