-- Aplicar UNA VEZ en SQL Editor, después de un respaldo y en una ventana de mantenimiento.
-- No crea cuentas Auth ni migra contraseñas. No elimina datos comerciales.
-- Al activar esta migración, el login anterior deja de funcionar.
begin;

create table public.auth_perfiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null check (length(btrim(nombre)) between 1 and 150),
    activo boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.auth_perfiles enable row level security;
revoke all on table public.auth_perfiles from public, anon, authenticated;
grant select on table public.auth_perfiles to authenticated;

create policy auth_perfiles_lectura_propia
on public.auth_perfiles for select to authenticated
using (user_id = (select auth.uid()));

-- No hay políticas ni privilegios de escritura desde el navegador.
-- El administrador habilita cuentas desde SQL Editor o un servidor autorizado.

do $migration$
declare
    target text;
    kind "char";
begin
    foreach target in array array['usuarios', 'productos', 'categorias', 'proveedores', 'sedes', 'inventario', 'movimientos']
    loop
        select c.relkind into kind
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = target;

        if not found then
            raise notice 'Tabla % ausente; revisar cuando se implemente.', target;
            continue;
        end if;
        if kind not in ('r', 'p') then
            raise exception '% no es una tabla. Revisar su seguridad antes de migrar.', target;
        end if;

        execute format('alter table public.%I enable row level security', target);
        -- Quita acceso público a tablas conocidas. RLS también bloquea permisos por columna heredados.
        execute format('revoke all on table public.%I from public, anon', target);

        if target = 'usuarios' then
            execute 'revoke all on table public.usuarios from authenticated';
            execute 'create policy login_legacy_bloqueado on public.usuarios as restrictive for all to anon, authenticated using (false) with check (false)';
        else
            -- RESTRICTIVE se combina con AND con las políticas de negocio existentes.
            -- No concede permisos nuevos ni sustituye restricciones por sede/rol.
            execute format(
                'create policy acceso_empresa_habilitado on public.%I as restrictive for all to anon, authenticated
                 using (exists (select 1 from public.auth_perfiles p where p.user_id = (select auth.uid()) and p.activo))
                 with check (exists (select 1 from public.auth_perfiles p where p.user_id = (select auth.uid()) and p.activo))', target
            );
        end if;
    end loop;
end;
$migration$;

commit;
