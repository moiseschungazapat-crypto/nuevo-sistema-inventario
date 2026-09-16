begin;
create or replace function public.app_listar_auditoria() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede consultar auditoría.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.fecha desc) from (select a.fecha,a.tabla,a.operacion,a.actor_id,coalesce(p.nombre,u.email,'Sistema') actor_nombre,u.email actor_email, left(coalesce(a.nuevo,a.anterior,'{}')::text,500) resumen from public.auditoria a left join public.auth_perfiles p on p.user_id=a.actor_id left join auth.users u on u.id=a.actor_id order by a.fecha desc limit 1000) r),'[]'::jsonb);
end $$;
revoke all on function public.app_listar_auditoria() from public,anon,authenticated;
grant execute on function public.app_listar_auditoria() to authenticated;
commit;
