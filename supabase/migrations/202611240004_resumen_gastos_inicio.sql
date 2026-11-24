-- Resumen compacto para Inicio, sin exponer gastos a los otros roles.
begin;
create function public.app_resumen_gastos_inicio() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare inicio date:=date_trunc('month',now() at time zone 'America/Lima')::date;
begin
 if public.app_rol() is distinct from 'administrador' then
  raise exception 'Solo el administrador puede consultar gastos.' using errcode='42501';
 end if;
 return (select jsonb_build_object('periodo',inicio,'total',coalesce(sum(g.monto),0),'cantidad',count(*))
  from public.gastos g where g.fecha>=inicio and g.fecha<(inicio+interval '1 month')::date);
end $$;
revoke all on function public.app_resumen_gastos_inicio() from public,anon,authenticated;
grant execute on function public.app_resumen_gastos_inicio() to authenticated;
commit;
