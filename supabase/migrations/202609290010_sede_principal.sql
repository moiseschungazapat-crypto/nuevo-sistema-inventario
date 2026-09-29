-- Sede operativa actual de La Liguria.
-- No elimina ni desactiva otras sedes: conserva cualquier historial previo.
-- Ejecutar después de las migraciones del catálogo.
begin;

do $$
begin
  if to_regclass('public.sedes') is null then
    raise exception 'No existe public.sedes. Ejecuta primero las migraciones de módulos.';
  end if;
end $$;

insert into public.sedes (nombre,direccion,estado)
select 'La Liguria S.A.','Av. Arica 281',true
where not exists (
  select 1 from public.sedes
  where lower(btrim(coalesce(direccion,'')))=lower('Av. Arica 281')
);

commit;
