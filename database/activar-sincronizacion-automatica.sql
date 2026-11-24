-- Ejecutar DESPUÉS de 202611240001_google_sheets_automatico.sql.
-- Cambia solamente el correo por el de tu administrador del sistema.
-- El resultado muestra la clave UNA VEZ: copiarla al menú Inventario en Sheets.
-- Volver a ejecutar este bloque reemplaza y revoca la clave anterior.
do $$
declare actor uuid; clave text;
begin
 select u.id into actor from auth.users u
 join public.auth_perfiles a on a.user_id=u.id and a.activo and a.rol='administrador'
 where lower(u.email)=lower('TU_CORREO_DE_ADMINISTRADOR');
 if actor is null then raise exception 'Reemplaza TU_CORREO_DE_ADMINISTRADOR por un administrador activo.'; end if;
 clave:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.google_sheets_conexiones(spreadsheet_id,token_hash,actor_id)
 values('1wqU91ijwb4DXBUSG7jLeUbJmMMkgb9w4L_vtWt4wMp8',encode(sha256(convert_to(clave,'UTF8')),'hex'),actor)
 on conflict(spreadsheet_id) do update set token_hash=excluded.token_hash,actor_id=excluded.actor_id,activo=true;
 perform set_config('liguria.clave_hoja',clave,false);
end $$;
select current_setting('liguria.clave_hoja') as clave_para_apps_script;
