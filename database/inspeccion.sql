-- SOLO LECTURA. Ejecutar en el SQL Editor de Supabase.
-- Devuelve metadatos; no consulta usuarios, contraseñas ni datos comerciales.
-- Conservar TODOS los resultados. El alcance es el esquema public.

-- 1. Columnas, tipos y valores predeterminados.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 2. Restricciones: claves primarias, relaciones, únicos y CHECK.
select c.relname as tabla, con.conname as restriccion,
       pg_get_constraintdef(con.oid) as definicion
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

-- 3. Estado de seguridad por filas (RLS).
select c.relname as tabla, c.relrowsecurity as rls_habilitado,
       c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;

-- 4. Políticas existentes.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5. Permisos de las tablas para roles de la API.
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;

-- 6. Funciones existentes (firma y modo de seguridad, sin ejecutar ninguna).
select p.proname as funcion, pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer, p.proacl as permisos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 7. Triggers de negocio existentes.
select c.relname as tabla, t.tgname as trigger,
       pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by c.relname, t.tgname;

-- 8. Índices existentes.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
