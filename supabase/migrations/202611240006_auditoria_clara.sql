-- Datos completos y nombres de referencia, sin modificar el historial.
begin;
create or replace function public.app_listar_auditoria() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede consultar auditoría.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.fecha desc,r.id desc) from (
  select a.id,a.fecha,a.tabla,a.operacion,a.actor_id,coalesce(ap.nombre,u.email,'Sistema') actor_nombre,u.email actor_email,
   a.anterior-array['solicitud','solicitud_inicial','solicitud_original','created_at','updated_at','version'] as anterior,
   a.nuevo-array['solicitud','solicitud_inicial','solicitud_original','created_at','updated_at','version'] as nuevo,
   jsonb_strip_nulls(jsonb_build_object(
    'producto',coalesce(v.datos->>'producto_nombre',v.datos->'nuevo'->>'producto',p.nombre,case when a.tabla='productos' then v.datos->>'nombre' end),
    'codigo',coalesce(v.datos->>'producto_codigo',v.datos->'nuevo'->>'codigo',p.codigo,case when a.tabla='productos' then v.datos->>'codigo' end),
    'unidad',coalesce(v.datos->>'unidad',v.datos->>'unidad_medida',p.unidad_medida,g.unidad),
    'sede',s.nombre,'proveedor',coalesce(v.datos->>'proveedor',pr.nombre,g.proveedor),
    'nombre',case when a.tabla in ('categorias','proveedores','sedes','auth_perfiles') then v.datos->>'nombre' end,
    'lote',case when a.tabla='lotes' then v.datos->>'codigo' end)) as contexto,
   case when a.tabla='entrada_correcciones' then jsonb_build_object(
    'producto',a.nuevo->'nuevo'->>'producto',
    'cantidad',(a.nuevo->'anterior'->>'cantidad')||' → '||(a.nuevo->'nuevo'->>'cantidad'),
    'costo_unitario',(a.nuevo->'anterior'->>'costo_unitario')||' → '||(a.nuevo->'nuevo'->>'costo_unitario'),
    'total',(a.nuevo->'anterior'->>'total')||' → '||(a.nuevo->'nuevo'->>'total'),
    'motivo',a.nuevo->>'motivo')::text
   else coalesce(a.nuevo,a.anterior,'{}')::text end resumen
  from (select * from public.auditoria order by fecha desc,id desc limit 1000) a
  cross join lateral (select coalesce(a.nuevo,a.anterior,'{}'::jsonb) as datos) v
  left join public.auth_perfiles ap on ap.user_id=a.actor_id left join auth.users u on u.id=a.actor_id
  left join public.productos p on p.id::text=v.datos->>'producto_id'
  left join public.sedes s on s.id::text=v.datos->>'sede_id'
  left join public.proveedores pr on pr.id::text=v.datos->>'proveedor_id'
  left join public.gastos g on a.tabla='entrada_correcciones' and g.id::text=v.datos->>'gasto_id'
 ) r),'[]'::jsonb);
end $$;
revoke all on function public.app_listar_auditoria() from public,anon,authenticated;
grant execute on function public.app_listar_auditoria() to authenticated;
commit;
