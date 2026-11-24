-- Acceso acotado para la hoja operativa. No altera saldos existentes.
begin;
create table if not exists public.google_sheets_conexiones (
 spreadsheet_id text primary key,
 token_hash text not null,
 actor_id uuid not null references auth.users(id),
 activo boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.google_sheets_conexiones enable row level security;
revoke all on table public.google_sheets_conexiones from public,anon,authenticated;

create or replace function public.app_google_sheets_automatico(
 p_token text,p_hoja text,p_accion text,p_datos jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; old_claims text; old_sub text;
begin
 select c.actor_id into actor from public.google_sheets_conexiones c
 join public.auth_perfiles a on a.user_id=c.actor_id and a.activo and a.rol='administrador'
 where c.spreadsheet_id=p_hoja and c.activo and length(p_token)>=40
 and c.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if actor is null then raise exception 'Conexión automática no autorizada o desactivada.' using errcode='42501'; end if;
 old_claims:=current_setting('request.jwt.claims',true);
 old_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 case p_accion
 when 'app_mi_acceso' then result:=public.app_mi_acceso();
 when 'app_datos_google_sheets_operativo' then result:=public.app_datos_google_sheets_operativo();
 when 'app_registrar_recepcion_google_sheets' then
  result:=public.app_registrar_recepcion_google_sheets((p_datos->>'p_operacion')::uuid,p_datos->'p_recepcion');
 when 'app_registrar_salida_fefo_google_sheets' then
  result:=public.app_registrar_salida_fefo_google_sheets((p_datos->>'p_operacion')::uuid,p_datos->>'p_producto',p_datos->>'p_sede',(p_datos->>'p_cantidad')::numeric,(p_datos->>'p_fecha')::date,p_datos->>'p_documento',p_datos->>'p_motivo');
 else raise exception 'Acción automática no permitida.' using errcode='42501';
 end case;
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
end $$;
revoke all on function public.app_google_sheets_automatico(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.app_google_sheets_automatico(text,text,text,jsonb) to service_role;
commit;
