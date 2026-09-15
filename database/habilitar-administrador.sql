-- Ejecutar en SQL Editor DESPUÉS de la migración 202609150002.
-- Solo habilita el perfil de la cuenta ya creada; no cambia contraseñas.
begin;
do $$
declare affected integer;
begin
 update public.auth_perfiles p
 set rol='administrador',activo=true
 from auth.users u
 where p.user_id=u.id and lower(u.email)='moiseschungazapata@gmail.com';
 get diagnostics affected = row_count;
 if affected<>1 then
  raise exception 'No se encontró el perfil de esa cuenta. Verifica el correo y Authentication antes de continuar.';
 end if;
end $$;
select user_id,nombre,rol,activo from public.auth_perfiles where rol='administrador' and activo;
commit;
