-- Lectura consistente para exportación manual. No modifica existencias ni movimientos.
begin;
create or replace function public.app_reporte_google_sheets() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 corte timestamptz := statement_timestamp();
 dia date := (corte at time zone 'America/Lima')::date;
 resultado jsonb;
 seccion jsonb;
begin
 if coalesce(public.app_rol(),'') <> 'administrador' then
  raise exception 'Solo un administrador puede enviar reportes a Google Sheets.' using errcode='42501';
 end if;
 resultado := jsonb_build_object(
  'generated_at',corte,'date',dia,
  'products',(select coalesce(jsonb_agg(to_jsonb(p) order by p.codigo),'[]') from public.productos p),
  'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.nombre),'[]') from public.categorias c),
  'providers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.nombre),'[]') from public.proveedores p),
  'sites',(select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre),'[]') from public.sedes s),
  'stock',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.app_stock i),
  'minimums',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.inventario_minimos m),
  'movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.fecha,m.id),'[]') from public.app_movimientos m
   where m.fecha >= (dia::timestamp at time zone 'America/Lima') and m.fecha <= corte),
  'receptions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at,r.id),'[]') from public.recepciones r where r.fecha_recepcion=dia and r.created_at<=corte),
  'reception_lines',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.recepcion_detalles d
   join public.recepciones r on r.id=d.recepcion_id where r.fecha_recepcion=dia and r.created_at<=corte)
 );
 for seccion in select value from jsonb_each(resultado) where jsonb_typeof(value)='array' loop
  if jsonb_array_length(seccion)>50000 then raise exception 'El reporte supera 50 000 registros en una sección.'; end if;
 end loop;
 return resultado;
end $$;
revoke all on function public.app_reporte_google_sheets() from public,anon,authenticated;
grant execute on function public.app_reporte_google_sheets() to authenticated;
commit;
