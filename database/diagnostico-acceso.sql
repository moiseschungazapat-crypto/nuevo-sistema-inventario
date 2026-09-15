-- SOLO LECTURA. Ejecutar en SQL Editor con acceso administrativo.
-- No devuelve contraseñas ni tokens. Una sola consulta: un solo resultado.
-- Sustituye TU_CORREO por el correo con el que intentas ingresar.
select
    to_regclass('public.auth_perfiles') is not null as migracion_perfiles_aplicada,
    exists (
        select 1 from auth.users
        where lower(email) = lower('TU_CORREO')
    ) as cuenta_auth_existe;

-- Si ambos valores son true, comprobar el perfil desde Table Editor:
-- auth_perfiles.user_id debe coincidir con Authentication > Users > UUID,
-- y activo debe ser true. Si el primero es false, aplicar antes la migración.
