-- Módulos empresariales: ejecutar UNA VEZ, después de 202609150001_auth_access.sql.
-- Todo se aplica en una transacción. Si el contrato existente no es compatible,
-- se detiene sin cambios. No borrar datos para superar las verificaciones.
begin;

do $$
declare t text; occupied boolean; old_check record;
begin
 if to_regclass('public.auth_perfiles') is null then
  raise exception 'Primero aplica la migración 202609150001_auth_access.sql.';
 end if;
 if to_regprocedure('public.app_mi_acceso()') is not null then
  raise exception 'La migración de módulos ya está instalada. No ejecutarla nuevamente.';
 end if;
 foreach t in array array['inventario','movimientos'] loop
  if to_regclass('public.'||t) is not null then
   if exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and not tgisinternal) then
    raise exception 'La tabla % tiene triggers de negocio anteriores. Se deben revisar para no actualizar saldos dos veces.',t;
   end if;
   -- La tabla antigua puede restringir tipo a entrada/salida. La nueva
   -- restricción se instala más abajo, después de agregar los tipos nuevos.
   if t='movimientos' then
    for old_check in
     select conname from pg_constraint
     where conrelid=to_regclass('public.movimientos') and contype='c'
       and pg_get_constraintdef(oid) ilike '%tipo%'
    loop
     execute format('alter table public.movimientos drop constraint %I',old_check.conname);
    end loop;
   end if;
   execute format('select exists(select 1 from public.%I)',t) into occupied;
   if occupied then raise exception 'La tabla % contiene datos anteriores. Se necesita una migración de saldos e historial a lotes; comparte database/inspeccion.sql. No borres esos datos.',t; end if;
  end if;
 end loop;
end $$;

alter table public.auth_perfiles add column rol text not null default 'consulta'
 check (rol in ('administrador','operador','consulta'));

create table if not exists public.categorias (id uuid primary key default gen_random_uuid());
create table if not exists public.proveedores (id uuid primary key default gen_random_uuid());
create table if not exists public.sedes (id uuid primary key default gen_random_uuid());
create table if not exists public.productos (id uuid primary key default gen_random_uuid());
create table if not exists public.inventario (id uuid primary key default gen_random_uuid());
create table if not exists public.movimientos (id uuid primary key default gen_random_uuid());

-- Conservar los IDs existentes (UUID, integer o bigint).
do $$
declare t text; typ text;
begin
 foreach t in array array['categorias','proveedores','sedes','productos','inventario','movimientos'] loop
  select data_type into typ from information_schema.columns
  where table_schema='public' and table_name=t and column_name='id';
  if typ is null or typ not in ('uuid','integer','bigint') then
   raise exception 'Tipo de ID no compatible en %. Comparte el esquema para adaptarlo.',t;
  end if;
 end loop;
 foreach t in array array['categorias','proveedores','sedes','productos'] loop
  execute format('alter table public.%I add column if not exists nombre text',t);
  execute format('alter table public.%I add column if not exists estado boolean not null default true',t);
  execute format('alter table public.%I add column if not exists version integer not null default 1',t);
  execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()',t);
 end loop;
end $$;
alter table public.categorias add column if not exists descripcion text;
alter table public.proveedores add column if not exists documento text;
alter table public.proveedores add column if not exists contacto text;
alter table public.proveedores add column if not exists telefono text;
alter table public.proveedores add column if not exists email text;
alter table public.proveedores add column if not exists direccion text;
alter table public.sedes add column if not exists direccion text;
alter table public.sedes add column if not exists responsable text;
alter table public.productos add column if not exists codigo text;
alter table public.productos add column if not exists descripcion text;
alter table public.productos add column if not exists unidad_medida text not null default 'unidad';
alter table public.productos add column if not exists precio numeric(18,2) not null default 0;

create table public.lotes (
 id uuid primary key default gen_random_uuid(),
 codigo text not null check (length(btrim(codigo)) between 1 and 100),
 vencimiento date not null,
 created_at timestamptz not null default now()
);
create table public.inventario_minimos (
 id uuid primary key default gen_random_uuid(),
 minimo numeric(18,3) not null default 0 check (minimo >= 0),
 updated_at timestamptz not null default now()
);

-- Añadir las relaciones usando el mismo tipo que las claves existentes.
do $$
declare spec text[]; typ text; actual text;
begin
 foreach spec slice 1 in array array[
  ['productos','categoria_id','categorias'],
  ['lotes','producto_id','productos'],
  ['inventario','producto_id','productos'],['inventario','sede_id','sedes'],
  ['inventario_minimos','producto_id','productos'],['inventario_minimos','sede_id','sedes'],
  ['movimientos','producto_id','productos'],['movimientos','sede_id','sedes'],['movimientos','destino_id','sedes']
 ] loop
  select format_type(a.atttypid,a.atttypmod) into typ from pg_attribute a
   where a.attrelid=('public.'||spec[3])::regclass and a.attname='id';
  execute format('alter table public.%I add column if not exists %I %s',spec[1],spec[2],typ);
  select format_type(a.atttypid,a.atttypmod) into actual from pg_attribute a
   where a.attrelid=('public.'||spec[1])::regclass and a.attname=spec[2];
  if actual<>typ then raise exception '%.% debe tener tipo %, no %. Se requiere adaptar el esquema.',spec[1],spec[2],typ,actual; end if;
  execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete restrict',spec[1],'app_fk_'||spec[1]||'_'||spec[2],spec[2],spec[3]);
 end loop;
end $$;

alter table public.lotes alter column producto_id set not null;
alter table public.lotes add constraint app_lote_producto unique(id,producto_id);
create unique index app_lote_codigo on public.lotes(producto_id,lower(btrim(codigo)));

alter table public.inventario add column if not exists lote_id uuid;
alter table public.inventario add column if not exists cantidad numeric(18,3) not null default 0;
alter table public.inventario alter column cantidad type numeric(18,3) using cantidad::numeric;
alter table public.inventario alter column cantidad set default 0;
alter table public.inventario alter column cantidad set not null;
alter table public.inventario alter column producto_id set not null;
alter table public.inventario alter column sede_id set not null;
alter table public.inventario alter column lote_id set not null;
alter table public.inventario add constraint app_stock_no_negativo check(cantidad>=0);
alter table public.inventario add constraint app_stock_lote foreign key(lote_id,producto_id) references public.lotes(id,producto_id);
alter table public.inventario add constraint app_stock_unico unique(producto_id,sede_id,lote_id);

alter table public.inventario_minimos alter column producto_id set not null;
alter table public.inventario_minimos alter column sede_id set not null;
alter table public.inventario_minimos add constraint app_minimo_unico unique(producto_id,sede_id);

alter table public.movimientos add column if not exists tipo text;
alter table public.movimientos add column if not exists cantidad numeric(18,3);
alter table public.movimientos alter column cantidad type numeric(18,3) using cantidad::numeric;
alter table public.movimientos add column if not exists lote_id uuid;
alter table public.movimientos add column if not exists fecha timestamptz not null default now();
alter table public.movimientos add column if not exists actor_id uuid references auth.users(id);
alter table public.movimientos add column if not exists responsable text;
alter table public.movimientos add column if not exists documento text;
alter table public.movimientos add column if not exists motivo text;
alter table public.movimientos add column if not exists operacion_id uuid;
alter table public.movimientos add column if not exists solicitud jsonb;
alter table public.movimientos add column if not exists saldo_origen numeric(18,3);
alter table public.movimientos add column if not exists saldo_destino numeric(18,3);
alter table public.movimientos add constraint app_movimiento_operacion unique(operacion_id);
alter table public.movimientos add constraint app_movimiento_lote foreign key(lote_id,producto_id) references public.lotes(id,producto_id);
alter table public.movimientos add constraint app_movimiento_tipo check(tipo in ('entrada','salida','traslado','ajuste_positivo','ajuste_negativo'));
alter table public.movimientos add constraint app_movimiento_cantidad check(cantidad>0);
alter table public.movimientos add constraint app_movimiento_destino check(
 (tipo='traslado' and destino_id is not null and destino_id<>sede_id) or (tipo<>'traslado' and destino_id is null)
);
do $$
declare c text;
begin
 foreach c in array array['producto_id','sede_id','tipo','cantidad','lote_id','fecha','actor_id','responsable','motivo','operacion_id','solicitud'] loop
  execute format('alter table public.movimientos alter column %I set not null',c);
 end loop;
end $$;

-- Fallar pronto si hay columnas obligatorias antiguas que los formularios no conocen.
do $$
declare r record; allowed text[];
begin
 for r in select table_name,column_name from information_schema.columns
  where table_schema='public' and table_name in ('categorias','proveedores','sedes','productos','inventario','movimientos')
  and is_nullable='NO' and column_default is null and is_identity='NO' and is_generated='NEVER'
 loop
  allowed := case r.table_name
   when 'categorias' then array['nombre','descripcion','estado','version']
   when 'proveedores' then array['nombre','documento','contacto','telefono','email','direccion','estado','version']
   when 'sedes' then array['nombre','direccion','responsable','estado','version']
   when 'productos' then array['codigo','nombre','descripcion','categoria_id','unidad_medida','precio','estado','version']
   when 'inventario' then array['producto_id','sede_id','lote_id','cantidad']
   when 'movimientos' then array['producto_id','sede_id','destino_id','tipo','cantidad','lote_id','fecha','actor_id','responsable','documento','motivo','operacion_id','solicitud','saldo_origen','saldo_destino']
  end;
  if not (r.column_name=any(allowed)) then
   raise exception 'Columna obligatoria sin valor predeterminado: %.%. Se requiere adaptar el esquema; no borres datos.',r.table_name,r.column_name;
  end if;
 end loop;
 -- Tipos esperados por las reglas y los formularios.
 for r in select table_name,column_name,data_type from information_schema.columns
  where table_schema='public' and
   ((table_name in ('categorias','proveedores','sedes','productos') and column_name in ('nombre','estado','version'))
    or (table_name='movimientos' and column_name='tipo'))
 loop
  if (r.column_name in ('nombre','tipo') and r.data_type not in ('text','character varying'))
    or (r.column_name='estado' and r.data_type<>'boolean')
    or (r.column_name='version' and r.data_type not in ('integer','bigint')) then
   raise exception 'Tipo no compatible: %.% (%). Se requiere adaptar el esquema.',r.table_name,r.column_name,r.data_type;
  end if;
 end loop;
end $$;

-- Una antigua unicidad producto/sede impide varios lotes. Solo se retira esa
-- restricción exacta, conservando las demás. Las tablas fueron comprobadas vacías.
do $$
declare r record;
begin
 for r in select conname from pg_constraint
  where conrelid='public.inventario'::regclass and contype='u'
  and (select array_agg(attname::text order by attname)
       from pg_attribute where attrelid=conrelid and attnum=any(conkey))=array['producto_id','sede_id']
 loop execute format('alter table public.inventario drop constraint %I',r.conname); end loop;
 if exists(select 1 from pg_index x where x.indrelid='public.inventario'::regclass and x.indisunique
  and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
   where a.attrelid=x.indrelid and a.attnum=any(x.indkey))=array['producto_id','sede_id']) then
  raise exception 'Inventario tiene un índice único producto/sede anterior. Se debe adaptar para permitir varios lotes.';
 end if;
end $$;

do $$
declare t text;
begin
 foreach t in array array['categorias','proveedores','sedes','productos'] loop
  execute format('alter table public.%I alter column nombre set not null',t);
  execute format('alter table public.%I add constraint %I check(length(btrim(nombre)) between 1 and 200)',t,'app_nombre_'||t);
  execute format('alter table public.%I alter column estado set not null',t);
 end loop;
end $$;
alter table public.productos alter column codigo set not null;
alter table public.productos add constraint app_producto_codigo check(length(btrim(codigo)) between 1 and 200);
alter table public.productos add constraint app_producto_precio check(precio>=0 and precio<=999999999999);
create unique index app_producto_sku on public.productos(lower(btrim(codigo)));
create unique index app_categoria_nombre on public.categorias(lower(btrim(nombre)));
create unique index app_sede_nombre on public.sedes(lower(btrim(nombre)));
create index app_movimiento_fecha on public.movimientos(fecha desc,id);
create index app_movimiento_producto on public.movimientos(producto_id,fecha desc);
create index app_movimiento_sede on public.movimientos(sede_id,fecha desc);
create index app_movimiento_destino on public.movimientos(destino_id,fecha desc);
create index app_lote_vencimiento on public.lotes(vencimiento);

-- Función de autorización sin recursión de políticas.
create function public.app_rol() returns text language sql stable security definer set search_path=''
as $$ select rol from public.auth_perfiles where user_id=(select auth.uid()) and activo $$;

create function public.app_mi_acceso() returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 select jsonb_build_object('user_id',user_id,'nombre',nombre,'rol',rol) into result
 from public.auth_perfiles where user_id=auth.uid() and activo;
 if result is null then raise exception 'Tu cuenta no tiene acceso habilitado.'; end if;
 return result;
end $$;

-- Roles de esta versión: acceso a todas las sedes. No se confía en metadata del JWT.
-- Sustituye las políticas de las tablas gestionadas por un modelo explícito.
do $$
declare t text; pol record; seq text;
begin
 foreach t in array array['categorias','proveedores','sedes','productos','inventario','movimientos','lotes','inventario_minimos','auth_perfiles'] loop
  execute format('alter table public.%I enable row level security',t);
  for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',pol.policyname,t);
  end loop;
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  -- Revocar también concesiones explícitas por columna heredadas.
  for pol in select column_name from information_schema.columns where table_schema='public' and table_name=t loop
   execute format('revoke select(%I),insert(%I),update(%I),references(%I) on public.%I from public,anon,authenticated',pol.column_name,pol.column_name,pol.column_name,pol.column_name,t);
  end loop;
  execute format('grant select on table public.%I to authenticated',t);
  if t='auth_perfiles' then
   execute 'create policy app_perfil_lectura on public.auth_perfiles for select to authenticated using(user_id=(select auth.uid()) or (select public.app_rol())=''administrador'')';
  else
   execute format('create policy app_lectura on public.%I for select to authenticated using((select public.app_rol()) is not null)',t);
  end if;
  if t in ('categorias','proveedores','sedes','productos') then
   execute format('grant insert,update on table public.%I to authenticated',t);
   execute format('create policy app_alta on public.%I for insert to authenticated with check((select public.app_rol()) in (''administrador'',''operador''))',t);
   execute format('create policy app_edicion on public.%I for update to authenticated using((select public.app_rol()) in (''administrador'',''operador'')) with check((select public.app_rol()) in (''administrador'',''operador''))',t);
   seq:=pg_get_serial_sequence('public.'||t,'id');
   if seq is not null then execute format('grant usage on sequence %s to authenticated',seq); end if;
  end if;
 end loop;
end $$;

create table public.auditoria (
 id bigint generated always as identity primary key,
 fecha timestamptz not null default now(),
 actor_id uuid,
 tabla text not null,
 operacion text not null,
 anterior jsonb,
 nuevo jsonb
);
alter table public.auditoria enable row level security;
revoke all on public.auditoria from public,anon,authenticated;
grant select on public.auditoria to authenticated;
create policy app_auditoria_admin on public.auditoria for select to authenticated using((select public.app_rol())='administrador');

create function public.app_auditar() returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.auditoria(actor_id,tabla,operacion,anterior,nuevo)
 values(auth.uid(),tg_table_name,tg_op,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;

create function public.app_version_catalogo() returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='INSERT' then new.version:=1;
 else
  if new.id is distinct from old.id then raise exception 'No se puede modificar el identificador.'; end if;
  new.version:=old.version+1;
 end if;
 return new;
end $$;

create function public.app_proteger_unidad() returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.unidad_medida is distinct from old.unidad_medida and exists(select 1 from public.movimientos where producto_id=old.id) then
  raise exception 'No se puede cambiar la unidad de un producto con movimientos.';
 end if;
 return new;
end $$;
create trigger app_producto_unidad before update on public.productos for each row execute function public.app_proteger_unidad();

do $$
declare t text;
begin
 foreach t in array array['categorias','proveedores','sedes','productos'] loop
  execute format('create trigger app_version before insert or update on public.%I for each row execute function public.app_version_catalogo()',t);
 end loop;
 foreach t in array array['categorias','proveedores','sedes','productos','lotes','inventario_minimos','auth_perfiles'] loop
  execute format('create trigger app_auditoria after insert or update on public.%I for each row execute function public.app_auditar()',t);
 end loop;
end $$;

create function public.app_crear_lote(p_producto text,p_codigo text,p_vencimiento date) returns uuid
language plpgsql security definer set search_path=''
as $$
declare prod public.productos%rowtype; result uuid;
begin
 if coalesce(public.app_rol(),'') not in ('administrador','operador') then raise exception 'No tienes permiso para crear lotes.'; end if;
 if p_vencimiento is null or length(btrim(coalesce(p_codigo,''))) not between 1 and 100 then raise exception 'Indica código de lote y vencimiento.'; end if;
 select * into prod from public.productos where id::text=p_producto and estado for share;
 if not found then raise exception 'Producto inexistente o inactivo.'; end if;
 insert into public.lotes(producto_id,codigo,vencimiento) values(prod.id,btrim(p_codigo),p_vencimiento) returning id into result;
 return result;
end $$;

create function public.app_configurar_minimo(p_producto text,p_sede text,p_minimo numeric) returns void
language plpgsql security definer set search_path=''
as $$
declare prod public.productos%rowtype; site public.sedes%rowtype;
begin
 if coalesce(public.app_rol(),'') not in ('administrador','operador') then raise exception 'No tienes permiso para configurar mínimos.'; end if;
 if p_minimo is null or p_minimo<0 or p_minimo>999999999 or p_minimo<>round(p_minimo,3) then raise exception 'Mínimo no válido: utiliza hasta tres decimales.'; end if;
 select * into prod from public.productos where id::text=p_producto and estado;
 select * into site from public.sedes where id::text=p_sede and estado;
 if prod.id is null or site.id is null then raise exception 'Producto o sede inexistente o inactivo.'; end if;
 insert into public.inventario_minimos(producto_id,sede_id,minimo) values(prod.id,site.id,p_minimo)
 on conflict(producto_id,sede_id) do update set minimo=excluded.minimo,updated_at=now();
end $$;

create function public.app_registrar_movimiento(
 p_operacion uuid,p_tipo text,p_producto text,p_lote uuid,p_sede text,p_destino text,
 p_cantidad numeric,p_documento text,p_motivo text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 role_name text:=public.app_rol();
 prod public.productos%rowtype; origin public.sedes%rowtype; destination public.sedes%rowtype;
 lot public.lotes%rowtype; previous public.movimientos%rowtype;
 request jsonb; origin_balance numeric; destination_balance numeric; movement_id text;
begin
 if coalesce(role_name,'') not in ('administrador','operador') then raise exception 'No tienes permiso para registrar movimientos.'; end if;
 if p_tipo is null or p_tipo not in ('entrada','salida','traslado','ajuste_positivo','ajuste_negativo') then raise exception 'Tipo no válido.'; end if;
 if p_tipo like 'ajuste_%' and role_name<>'administrador' then raise exception 'Solo un administrador puede registrar ajustes.'; end if;
 if p_operacion is null or p_cantidad is null or p_cantidad<=0 or p_cantidad>999999999 or p_cantidad<>round(p_cantidad,3) then raise exception 'Cantidad no válida. Utiliza hasta tres decimales.'; end if;
 if length(btrim(coalesce(p_motivo,''))) not between 1 and 1000 or length(coalesce(p_documento,''))>120 then raise exception 'Indica un motivo válido (hasta 1000 caracteres) y documento de hasta 120 caracteres.'; end if;
 if p_tipo='traslado' and (p_destino is null or p_destino=p_sede) then raise exception 'Selecciona una sede de destino diferente.'; end if;
 if p_tipo<>'traslado' and p_destino is not null then raise exception 'Este movimiento no admite destino.'; end if;
 request:=jsonb_build_object('tipo',p_tipo,'producto',p_producto,'lote',p_lote,'sede',p_sede,'destino',p_destino,'cantidad',p_cantidad,'documento',coalesce(p_documento,''),'motivo',btrim(p_motivo));

 -- Misma operación: mismo resultado incluso ante reintentos simultáneos.
 perform pg_advisory_xact_lock(hashtextextended('operacion:'||p_operacion::text,0));
 select * into previous from public.movimientos where operacion_id=p_operacion;
 if found then
  if previous.actor_id<>auth.uid() or previous.solicitud<>request then raise exception 'El identificador de operación ya fue utilizado con otros datos.'; end if;
  return jsonb_build_object('id',previous.id,'repetido',true);
 end if;

 -- Una exclusión por producto serializa salidas y traslados y evita interbloqueos
 -- de origen/destino. PostgreSQL revierte todo si cualquier paso falla.
 perform pg_advisory_xact_lock(hashtextextended('producto:'||coalesce(p_producto,''),0));
 select * into prod from public.productos where id::text=p_producto and estado for share;
 if not found then raise exception 'Producto inexistente o inactivo.'; end if;
 select * into lot from public.lotes where id=p_lote and producto_id=prod.id;
 if not found then raise exception 'El lote no pertenece al producto.'; end if;
 if lot.vencimiento < (now() at time zone 'America/Lima')::date and p_tipo not in ('ajuste_negativo') then
  raise exception 'El lote está vencido. Solo admite baja mediante ajuste negativo.';
 end if;
 -- Bloquear sedes en orden estable para convivir con ediciones de catálogos.
 perform id from public.sedes where id::text in (p_sede,p_destino) order by id for share;
 select * into origin from public.sedes where id::text=p_sede and estado;
 if not found then raise exception 'Sede de origen inexistente o inactiva.'; end if;
 if p_tipo='traslado' then
  select * into destination from public.sedes where id::text=p_destino and estado;
  if not found then raise exception 'Sede de destino inexistente o inactiva.'; end if;
 end if;

 insert into public.inventario(producto_id,sede_id,lote_id,cantidad) values(prod.id,origin.id,lot.id,0)
 on conflict(producto_id,sede_id,lote_id) do nothing;
 if p_tipo in ('entrada','ajuste_positivo') then
  update public.inventario set cantidad=cantidad+p_cantidad where producto_id=prod.id and sede_id=origin.id and lote_id=lot.id returning cantidad into origin_balance;
 else
  update public.inventario set cantidad=cantidad-p_cantidad
  where producto_id=prod.id and sede_id=origin.id and lote_id=lot.id and cantidad>=p_cantidad returning cantidad into origin_balance;
  if not found then raise exception 'Stock insuficiente en la sede y lote seleccionados.'; end if;
 end if;
 if p_tipo='traslado' then
  insert into public.inventario(producto_id,sede_id,lote_id,cantidad) values(prod.id,destination.id,lot.id,p_cantidad)
  on conflict(producto_id,sede_id,lote_id) do update set cantidad=public.inventario.cantidad+excluded.cantidad
  returning cantidad into destination_balance;
 end if;
 insert into public.movimientos(producto_id,lote_id,sede_id,destino_id,tipo,cantidad,fecha,actor_id,responsable,documento,motivo,operacion_id,solicitud,saldo_origen,saldo_destino)
 values(prod.id,lot.id,origin.id,destination.id,p_tipo,p_cantidad,now(),auth.uid(),
  (select nombre from public.auth_perfiles where user_id=auth.uid()),coalesce(p_documento,''),btrim(p_motivo),p_operacion,request,origin_balance,destination_balance)
 returning id::text into movement_id;
 return jsonb_build_object('id',movement_id,'repetido',false);
end $$;

create function public.app_listar_usuarios() returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede consultar usuarios.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'nombre',p.nombre,'rol',p.rol,'activo',p.activo,'email',u.email) order by p.nombre)
 from public.auth_perfiles p join auth.users u on u.id=p.user_id),'[]'::jsonb);
end $$;

create function public.app_guardar_usuario(p_email text,p_nombre text,p_rol text,p_activo boolean) returns void
language plpgsql security definer set search_path=''
as $$
declare target uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('administradores',0));
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede gestionar accesos.'; end if;
 if p_rol is null or p_rol not in ('administrador','operador','consulta') or p_activo is null or length(btrim(coalesce(p_nombre,''))) not between 1 and 150 then raise exception 'Nombre, rol o estado no válidos.'; end if;
 select id into target from auth.users where lower(email)=lower(btrim(p_email));
 if target is null then raise exception 'Primero crea esta cuenta en Supabase Authentication. No existe ese correo.'; end if;
 if exists(select 1 from public.auth_perfiles where user_id=target and activo and rol='administrador')
 and (not p_activo or p_rol<>'administrador')
 and not exists(select 1 from public.auth_perfiles where user_id<>target and activo and rol='administrador') then
  raise exception 'Debe quedar al menos un administrador habilitado.';
 end if;
 insert into public.auth_perfiles(user_id,nombre,rol,activo) values(target,btrim(p_nombre),p_rol,p_activo)
 on conflict(user_id) do update set nombre=excluded.nombre,rol=excluded.rol,activo=excluded.activo;
end $$;

-- Vistas con privilegios del usuario que consulta (no eluden RLS).
create view public.app_stock with (security_invoker=true) as
 select i.id::text as id,i.producto_id,i.sede_id,i.lote_id,p.codigo,p.nombre as producto,p.unidad_medida,
 s.nombre as sede,l.codigo as lote,l.vencimiento,i.cantidad,
 coalesce(m.minimo,0) as stock_minimo,
 sum(i.cantidad) over(partition by i.producto_id,i.sede_id) as total_sede
 from public.inventario i join public.productos p on p.id=i.producto_id
 join public.sedes s on s.id=i.sede_id join public.lotes l on l.id=i.lote_id
 left join public.inventario_minimos m on m.producto_id=i.producto_id and m.sede_id=i.sede_id
 union all
 select 'min:'||m.id::text,m.producto_id,m.sede_id,null::uuid,p.codigo,p.nombre,p.unidad_medida,
 s.nombre,'Sin existencias',null::date,0::numeric,m.minimo,0::numeric
 from public.inventario_minimos m join public.productos p on p.id=m.producto_id
 join public.sedes s on s.id=m.sede_id
 where not exists(select 1 from public.inventario i where i.producto_id=m.producto_id and i.sede_id=m.sede_id);

create view public.app_movimientos with (security_invoker=true) as
 select m.id,m.fecha,m.tipo,m.producto_id,m.sede_id,m.destino_id,m.lote_id,m.cantidad,m.responsable,m.documento,m.motivo,
 m.saldo_origen,m.saldo_destino,p.nombre as producto,p.unidad_medida,l.codigo as lote,s.nombre as sede,d.nombre as destino
 from public.movimientos m join public.productos p on p.id=m.producto_id join public.lotes l on l.id=m.lote_id
 join public.sedes s on s.id=m.sede_id left join public.sedes d on d.id=m.destino_id;
revoke all on public.app_stock,public.app_movimientos from public,anon,authenticated;
grant select on public.app_stock,public.app_movimientos to authenticated;

create function public.app_resumen() returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare today date:=(now() at time zone 'America/Lima')::date;
begin
 if public.app_rol() is null then raise exception 'Acceso no habilitado.'; end if;
 return jsonb_build_object(
 'productos',(select count(*) from public.productos where estado),
 'bajo_minimo',(select count(*) from public.inventario_minimos mi where mi.minimo>coalesce((select sum(i.cantidad) from public.inventario i where i.producto_id=mi.producto_id and i.sede_id=mi.sede_id),0)),
 'entradas',(select count(*) from public.movimientos where tipo='entrada' and (fecha at time zone 'America/Lima')::date=today),
 'salidas',(select count(*) from public.movimientos where tipo='salida' and (fecha at time zone 'America/Lima')::date=today),
 'vencidos',(select count(distinct lote_id) from public.app_stock where cantidad>0 and vencimiento<today),
 'por_vencer',(select count(distinct lote_id) from public.app_stock where cantidad>0 and vencimiento between today and today+30),
 'actividad',(select jsonb_agg(jsonb_build_object('dia',day::date,'total',(select count(*) from public.movimientos where (fecha at time zone 'America/Lima')::date=day::date)) order by day)
 from generate_series(today-6,today,'1 day'::interval) day),
 'recientes',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.app_movimientos order by fecha desc,id desc limit 8) r),'[]'::jsonb)
 );
end $$;

-- No dejar funciones SECURITY DEFINER públicas por defecto.
create function public.app_exportar_movimientos(p_producto text,p_sede text,p_tipo text,p_desde date,p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare result jsonb;
begin
 if public.app_rol() is null then raise exception 'Acceso no habilitado.'; end if;
 if p_desde is not null and p_hasta is not null and p_desde>p_hasta then raise exception 'Rango de fechas no válido.'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select * from public.app_movimientos
  where (p_producto is null or producto_id::text=p_producto)
   and (p_sede is null or sede_id::text=p_sede or destino_id::text=p_sede)
   and (p_tipo is null or tipo=p_tipo)
   and (p_desde is null or fecha >= (p_desde::timestamp at time zone 'America/Lima'))
   and (p_hasta is null or fecha < ((p_hasta+1)::timestamp at time zone 'America/Lima'))
  order by fecha desc,id desc limit 50001
 ) r;
 if jsonb_array_length(result)>50000 then raise exception 'El reporte supera 50 000 registros. Reduce los filtros.'; end if;
 return result;
end $$;

create function public.app_exportar_stock(p_producto text,p_sede text)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare result jsonb;
begin
 if public.app_rol() is null then raise exception 'Acceso no habilitado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select * from public.app_stock
  where (p_producto is null or producto_id::text=p_producto) and (p_sede is null or sede_id::text=p_sede)
  order by producto,sede,lote limit 50001
 ) r;
 if jsonb_array_length(result)>50000 then raise exception 'El reporte supera 50 000 registros. Filtra por producto o sede.'; end if;
 return result;
end $$;

do $$
declare f record; t text;
begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('app_rol','app_mi_acceso','app_auditar','app_version_catalogo','app_proteger_unidad','app_crear_lote','app_configurar_minimo','app_registrar_movimiento','app_listar_usuarios','app_guardar_usuario','app_resumen','app_exportar_movimientos','app_exportar_stock') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.proname not in ('app_auditar','app_version_catalogo','app_proteger_unidad') then
   execute format('grant execute on function %s to authenticated',f.signature);
  end if;
 end loop;
 -- En Supabase existe esta publicación. En pruebas PostgreSQL locales puede no existir.
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['categorias','proveedores','sedes','productos','lotes','inventario','inventario_minimos','movimientos','auth_perfiles'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
commit;
