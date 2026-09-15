# Activar el nuevo inicio de sesión

## Qué está implementado

- Login con Supabase Auth (`signInWithPassword`); nunca consulta contraseñas en `usuarios`.
- Identidad validada con `getUser` y acceso empresarial mediante `auth_perfiles`.
- Solo una cuenta con perfil `activo = true` puede abrir las pantallas implementadas.
- Sesión renovada por el SDK; eliminación de `user_session` heredada; logout del navegador actual y sincronización de cierre entre pestañas.
- Dashboard y productos esperan la validación antes de iniciar sus consultas.
- Recuperación por correo y página para guardar una nueva contraseña.
- Mensajes seguros sin detalles internos ni contraseñas en logs.
- Escape de datos al renderizar productos, dashboard, categorías y proveedores para evitar interpretar contenido almacenado como HTML.

El SDK mantiene sus tokens de sesión en el navegador; ya no se guarda una fila que contenga una contraseña. La protección real de datos se aplica mediante políticas de PostgreSQL, no mediante JavaScript.

## Estado de la entrega

Los archivos están preparados localmente. No se accedió al panel, no se crearon usuarios, no se enviaron correos y no se aplicó la migración remota. Hasta aplicar y verificar los pasos siguientes, el entorno remoto conserva su configuración anterior. Desplegar solo el frontend NO completa la corrección de seguridad.

## 1. Preparar Supabase y el entorno

1. Respaldar la base y conservar un acceso administrativo al panel.
2. Ejecutar `database/inspeccion.sql` y revisar las políticas, privilegios y funciones actuales. Preferir validar primero en una copia de pruebas.
3. En Authentication, habilitar el proveedor de correo/contraseña y deshabilitar el registro público de usuarios para esta aplicación interna. No habilitar acceso anónimo.
4. Configurar longitud mínima de contraseña de 12 caracteres y los requisitos adicionales elegidos por la empresa. La validación HTML es solo una ayuda; el servidor debe exigir la política.
5. Configurar el servicio de correo de Auth (SMTP) para los destinatarios reales y verificar la entrega. Los límites del proveedor y configuración de correo pueden impedir el envío aunque el formulario esté bien.
6. En URL Configuration, definir Site URL con el dominio real de Vercel/dominio propio. Autorizar explícitamente las redirecciones de recuperación `https://TU-DOMINIO/restablecer.html` y `https://TU-DOMINIO/restablecer`, porque Vercel usa cleanUrls. Usar dominios controlados, sin comodines amplios.
7. Para pruebas locales, añadir solo la URL exacta del servidor local que se vaya a utilizar. No abrir los HTML con `file://`.

## 2. Aplicar la migración

En una ventana de mantenimiento ejecutar UNA VEZ `supabase/migrations/202609150001_auth_access.sql` en SQL Editor. Todo está dentro de una transacción: ante error revisar y corregir, no continuar con fragmentos sueltos.

La migración:

- Crea `auth_perfiles`, relacionada con `auth.users`, sin contraseñas.
- Permite a cada usuario autenticado leer solo su perfil; no puede editar su habilitación.
- Bloquea el acceso desde roles de la API a la tabla antigua `usuarios`, aunque conserve datos para la transición.
- Activa RLS y exige cuenta habilitada en las tablas conocidas del inventario.
- Conserva las políticas de negocio existentes; NO otorga acceso general a usuarios autenticados.

**Si no existen políticas permisivas para `authenticated`, los listados pueden quedar vacíos o fallar.** Hay que definirlas según los roles y sedes reales. No arreglarlo desactivando RLS ni agregando acceso universal. Ejecutar la inspección y revisar esas políticas antes de habilitar la operación.

Esta migración cubre las tablas nombradas en el código. Revisar también otras tablas, vistas, Storage y funciones, especialmente `SECURITY DEFINER`, que pueden tener rutas de acceso independientes o eludir RLS. No se puede certificar su seguridad sin conocerlas.

## 3. Crear y habilitar cuentas

1. Crear las cuentas desde Authentication > Users con el correo verificado de cada empleado. No copiar las contraseñas antiguas; usar credenciales temporales únicas y entregar el restablecimiento al titular.
2. Copiar el UUID de la cuenta Auth, no el ID de `usuarios`.
3. Ejecutar este SQL con los valores reales desde el panel administrativo:

```sql
insert into public.auth_perfiles (user_id, nombre, activo)
values ('UUID-DE-AUTH', 'Nombre del empleado', true)
on conflict (user_id) do update
set nombre = excluded.nombre, activo = excluded.activo;
```

No hay alta automática de perfiles habilitados ni formulario de registro público. Una cuenta Auth por sí sola no concede acceso al inventario.

Para deshabilitar el acceso:

```sql
update public.auth_perfiles
set activo = false
where user_id = 'UUID-DE-AUTH';
```

Con las políticas aplicadas, las consultas posteriores a las tablas protegidas quedarán bloqueadas aunque un token no haya expirado. La interfaz vuelve a comprobar acceso al regresar a la pestaña. No es posible retirar del navegador datos ya descargados.

## 4. Desplegar y validar

Desplegar el frontend después de preparar la migración, cuentas, perfiles, URLs y permisos. Mantiene HTML estático; no requiere una compilación ni claves de servicio. La configuración pública está en `js/supabase.js`.

- Cuenta válida y habilitada: entra y muestra su nombre.
- Contraseña incorrecta: mensaje genérico, sin acceso.
- Cuenta sin perfil o inactiva: acceso rechazado.
- Perfil o red no disponibles: nunca autorizar por defecto.
- Crear manualmente `localStorage.user_session`: no concede acceso.
- Abrir `/productos` sin sesión: redirige al login sin iniciar consultas de productos.
- Logout: salir, probar Atrás y una segunda pestaña.
- Recuperación: recibir correo, abrir enlace, cambiar contraseña y entrar con la nueva; probar enlace vencido.
- En API directa: comprobar que anon no acceda a tablas; una cuenta inactiva no acceda a datos; ninguna cuenta cliente pueda consultar `usuarios` ni modificar `auth_perfiles.activo`.
- Con cuenta habilitada: comprobar las restricciones reales de lectura/escritura por rol/sede, no solamente que el login funcione.

`npm test` ejecuta pruebas locales de contratos con un cliente simulado. No reemplaza estas verificaciones contra Supabase. Nunca usar una service key para probar permisos de usuario, porque puede eludir RLS.

Verificación local realizada: 17 pruebas aprobadas con `node --test tests/*.test.mjs` y comprobación de sintaxis de los módulos JavaScript. No se verificó todavía el flujo completo en navegador con cuentas reales ni se ejecutó el SQL contra PostgreSQL.

El cierre usa `scope: 'local'`: cierra el navegador actual, no otros dispositivos. Los JWT emitidos pueden seguir siendo válidos hasta expirar; para una cuenta comprometida deshabilitar su perfil y gestionar sesiones desde Auth. La página de cambio también admite una sesión Auth válida existente; no autoriza inventario por sí misma.

## 5. Retirar las credenciales antiguas

Tras verificar la transición, retirar de manera controlada la columna de contraseña de `usuarios` y sanear respaldos/logs conforme al procedimiento de la empresa. No se elimina automáticamente porque se desconoce el esquema y sus dependencias. Pedir a los usuarios contraseñas nuevas, especialmente si reutilizaron las anteriores.

## Referencias oficiales

- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-signout
- https://supabase.com/docs/guides/database/postgres/row-level-security
