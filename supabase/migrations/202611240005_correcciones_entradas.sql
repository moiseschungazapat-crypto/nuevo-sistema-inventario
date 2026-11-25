-- Correcciones administrativas: conservar el ingreso original y ajustar stock y gasto juntos.
begin;
alter table public.gastos add column anulado boolean not null default false;
alter table public.gastos drop constraint gastos_monto_check;
alter table public.gastos add constraint gastos_monto_vigente check((anulado and monto=0 and cantidad=0) or (not anulado and monto>0));
create table public.entrada_correcciones (
 id uuid primary key,
 gasto_id uuid not null references public.gastos(id),
 actor_id uuid not null references auth.users(id),
 motivo text not null check(length(btrim(motivo)) between 3 and 900),
 anterior jsonb not null,
 nuevo jsonb not null,
 movimiento_id text,
 solicitud jsonb not null,
 created_at timestamptz not null default now()
);
create index entrada_correcciones_gasto on public.entrada_correcciones(gasto_id,created_at,id);
alter table public.entrada_correcciones enable row level security;
create policy entrada_correcciones_admin on public.entrada_correcciones for select to authenticated using(public.app_rol()='administrador');
revoke all on public.entrada_correcciones from public,anon,authenticated;
grant select on public.entrada_correcciones to authenticated;
create trigger auditar_correccion_entrada after insert on public.entrada_correcciones for each row execute function public.app_auditar();

create function public.app_datos_correccion_entrada(p_gasto uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.gastos%rowtype; source jsonb; history jsonb; legacy boolean:=false;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede corregir entradas.' using errcode='42501'; end if;
 select * into g from public.gastos where id=p_gasto and origen in ('recepcion','entrada');
 if not found then
  -- Un ingreso anterior al módulo de gastos no recibe un precio estimado.
  -- Su detalle sirve de identificador hasta que la corrección registre el costo real.
  select d.id,r.fecha_recepcion,left('Ingreso: '||p.nombre,200),case when p.controla_inventario=false then 'Servicios' else 'Mercadería' end,
   'recepcion',d.id::text,p.codigo,p.nombre,d.cantidad_recibida,p.unidad_medida,d.precio_unitario,coalesce(v.nombre,''),0,false
   into g.id,g.fecha,g.concepto,g.categoria,g.origen,g.origen_id,g.producto_codigo,g.producto_nombre,g.cantidad,g.unidad,g.costo_unitario,g.proveedor,g.version,g.anulado
   from public.recepcion_detalles d join public.recepciones r on r.id=d.recepcion_id join public.productos p on p.id=d.producto_id
   left join public.proveedores v on v.id=r.proveedor_id where d.id=p_gasto and d.cantidad_recibida>0
   and not exists(select 1 from public.gastos existing where existing.origen='recepcion' and existing.origen_id=d.id::text);
  if not found then raise exception 'No se encontró la entrada para corregir.'; end if;
  legacy:=true;
 end if;
 if g.origen='recepcion' then
  select jsonb_build_object('producto_id',d.producto_id::text,'sede_id',r.sede_id::text,'lote_id',d.lote_id,'sede',s.nombre,'lote',l.codigo)
   into source from public.recepcion_detalles d join public.recepciones r on r.id=d.recepcion_id
   join public.sedes s on s.id=r.sede_id left join public.lotes l on l.id=d.lote_id where d.id::text=g.origen_id and coalesce(r.moneda,'PEN')='PEN';
 else
  select jsonb_build_object('producto_id',m.producto_id::text,'sede_id',m.sede_id::text,'lote_id',m.lote_id,'sede',s.nombre,'lote',l.codigo)
   into source from public.movimientos m join public.sedes s on s.id=m.sede_id left join public.lotes l on l.id=m.lote_id
   where m.id::text=g.origen_id and m.tipo='entrada';
 end if;
 if source is null then raise exception 'No se encontró el ingreso original. No se puede corregir de forma segura.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('fecha',c.created_at,'responsable',coalesce(p.nombre,'Administrador'),'motivo',c.motivo,'anterior',c.anterior,'nuevo',c.nuevo) order by c.created_at desc,c.id),'[]') into history
  from public.entrada_correcciones c left join public.auth_perfiles p on p.user_id=c.actor_id where c.gasto_id=g.id;
 return jsonb_build_object('gasto',to_jsonb(g)-'solicitud_inicial','origen',source,'sin_gasto',legacy,'cantidad',case when g.anulado then 0 else g.cantidad end,
  'total',case when g.anulado then 0 else g.monto end,'disponible',coalesce((select sum(i.cantidad) from public.inventario i
   where i.producto_id::text=source->>'producto_id' and i.sede_id::text=source->>'sede_id' and i.lote_id::text=source->>'lote_id'),0),'historial',history);
end $$;
revoke all on function public.app_datos_correccion_entrada(uuid) from public,anon,authenticated;
grant execute on function public.app_datos_correccion_entrada(uuid) to authenticated;

create function public.app_entradas_corregibles(p_recepcion uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede corregir entradas.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha desc,x.id),'[]') from (
  select g.id,g.fecha,g.producto_codigo,g.producto_nombre,g.unidad,g.anulado,
   case when g.anulado then 0 else g.cantidad end as cantidad,g.proveedor
  from public.gastos g where g.origen in ('recepcion','entrada') and
   (p_recepcion is null or (g.origen='recepcion' and exists(select 1 from public.recepcion_detalles d where d.id::text=g.origen_id and d.recepcion_id=p_recepcion)))
  union all
  select d.id,r.fecha_recepcion,p.codigo,p.nombre,p.unidad_medida,false,d.cantidad_recibida,coalesce(v.nombre,'')
  from public.recepcion_detalles d join public.recepciones r on r.id=d.recepcion_id join public.productos p on p.id=d.producto_id
   left join public.proveedores v on v.id=r.proveedor_id
  where d.cantidad_recibida>0 and coalesce(r.moneda,'PEN')='PEN' and (p_recepcion is null or r.id=p_recepcion)
   and not exists(select 1 from public.gastos g where g.origen='recepcion' and g.origen_id=d.id::text)
 ) x);
end $$;
revoke all on function public.app_entradas_corregibles(uuid) from public,anon,authenticated;
grant execute on function public.app_entradas_corregibles(uuid) to authenticated;

create function public.app_corregir_entrada(p_operacion uuid,p_gasto uuid,p_version integer,p_cantidad numeric,p_costo_unitario numeric,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.gastos%rowtype; previous public.entrada_correcciones%rowtype; info jsonb; source jsonb; request jsonb; before_data jsonb; after_data jsonb; result jsonb;
 delta numeric; total numeric; oldqty numeric; oldtotal numeric; legacy boolean;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede corregir entradas.' using errcode='42501'; end if;
 if p_operacion is null or p_gasto is null or p_version is null then raise exception 'Falta identificar la entrada y su versión.'; end if;
 if p_cantidad is null or p_cantidad<0 or p_cantidad>999999999 or p_cantidad<>round(p_cantidad,3) then raise exception 'La cantidad corregida debe ser cero o mayor, con hasta tres decimales.'; end if;
 if (p_cantidad>0 and p_costo_unitario is null) or (p_costo_unitario is not null and (p_costo_unitario<=0 or p_costo_unitario>999999999999.99 or p_costo_unitario<>round(p_costo_unitario,4))) then raise exception 'Indica un costo unitario válido, con hasta cuatro decimales.'; end if;
 if p_motivo is null or length(btrim(p_motivo)) not between 3 and 900 then raise exception 'Explica el motivo de la corrección (entre 3 y 900 caracteres).'; end if;
 total:=case when p_cantidad=0 then 0 else round(p_cantidad*p_costo_unitario,2) end;
 if total>999999999999.99 or (p_cantidad>0 and total<=0) then raise exception 'El costo total corregido no es válido.'; end if;
 request:=jsonb_build_object('gasto',p_gasto,'version',p_version,'cantidad',p_cantidad,'costo_unitario',p_costo_unitario,'motivo',btrim(p_motivo));
 perform pg_advisory_xact_lock(hashtextextended('correccion:'||p_operacion::text,0));
 select * into previous from public.entrada_correcciones where id=p_operacion;
 if found then
  if previous.actor_id<>auth.uid() or previous.solicitud<>request then raise exception 'El identificador de corrección ya fue utilizado con otros datos.'; end if;
  return jsonb_build_object('id',previous.id,'repetido',true);
 end if;
 info:=public.app_datos_correccion_entrada(p_gasto);source:=info->'origen';
 -- Mismo orden de bloqueo que las entradas: producto antes del gasto.
 perform pg_advisory_xact_lock(hashtextextended('producto:'||(source->>'producto_id'),0));
 perform pg_advisory_xact_lock(hashtextextended('gasto:'||(info->'gasto'->>'origen')||':'||(info->'gasto'->>'origen_id'),0));
 select * into g from public.gastos where id=p_gasto for update;
 legacy:=not found;
 if legacy then
  if exists(select 1 from public.gastos where origen='recepcion' and origen_id=p_gasto::text) then raise exception 'Otra persona actualizó esta entrada. Vuelve a abrirla.'; end if;
  if not (info->>'sin_gasto')::boolean then raise exception 'No se encontró la entrada.'; end if;
  g:=jsonb_populate_record(null::public.gastos,info->'gasto');
 end if;
 if g.version<>p_version then raise exception 'Otra persona actualizó esta entrada. Cierra y vuelve a abrir la corrección para revisar los valores actuales.'; end if;
 oldqty:=case when g.anulado then 0 else g.cantidad end;oldtotal:=case when g.anulado then 0 else g.monto end;
 if not legacy and p_cantidad=oldqty and p_costo_unitario is not distinct from g.costo_unitario then raise exception 'No hay cambios en la cantidad ni en el costo.'; end if;
 delta:=p_cantidad-oldqty;
 if delta<>0 and source->>'lote_id' is null and exists(select 1 from public.productos where id::text=source->>'producto_id' and controla_inventario is distinct from false) then
  raise exception 'Esta entrada no tiene un lote de inventario asociado. No es seguro corregir su cantidad.';
 end if;
 if delta<>0 and source->>'lote_id' is not null then
  result:=public.app_registrar_movimiento(p_operacion,case when delta>0 then 'ajuste_positivo' else 'ajuste_negativo' end,
   source->>'producto_id',(source->>'lote_id')::uuid,source->>'sede_id',null,abs(delta),'CORR-'||p_operacion::text,'Corrección de entrada: '||btrim(p_motivo));
 end if;
 before_data:=jsonb_build_object('cantidad',oldqty,'costo_unitario',g.costo_unitario,'total',oldtotal,'version',g.version,'producto',g.producto_nombre,'codigo',g.producto_codigo);
 if legacy then
  insert into public.gastos(id,fecha,concepto,categoria,monto,estado,fecha_pago,proveedor,observaciones,created_by,solicitud_inicial,origen,origen_id,producto_codigo,producto_nombre,cantidad,unidad,costo_unitario,anulado)
  values(g.id,g.fecha,g.concepto,g.categoria,total,'pagado',g.fecha,g.proveedor,'Costo registrado al corregir el ingreso histórico.',auth.uid(),'{}',g.origen,g.origen_id,g.producto_codigo,g.producto_nombre,p_cantidad,g.unidad,p_costo_unitario,p_cantidad=0);
 elsif p_cantidad=0 then
  update public.gastos set anulado=true,cantidad=0,monto=0,costo_unitario=p_costo_unitario where id=g.id;
 else
  update public.gastos set anulado=false,cantidad=p_cantidad,costo_unitario=p_costo_unitario,monto=total where id=g.id;
 end if;
 after_data:=jsonb_build_object('cantidad',p_cantidad,'costo_unitario',p_costo_unitario,'total',total,'version',g.version+1,'producto',g.producto_nombre,'codigo',g.producto_codigo);
 insert into public.entrada_correcciones(id,gasto_id,actor_id,motivo,anterior,nuevo,movimiento_id,solicitud)
 values(p_operacion,g.id,auth.uid(),btrim(p_motivo),before_data,after_data,result->>'id',request);
 return jsonb_build_object('id',p_operacion,'repetido',false);
end $$;
revoke all on function public.app_corregir_entrada(uuid,uuid,integer,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.app_corregir_entrada(uuid,uuid,integer,numeric,numeric,text) to authenticated;

-- El reintento del ingreso original compara contra su costo original, incluso después de corregirlo.
create or replace function public.app_gasto_producto(p_origen text,p_origen_id text,p_fecha date,p_producto text,p_cantidad numeric,p_costo numeric,p_proveedor text,p_nota text)
returns uuid language plpgsql security definer set search_path='' as $$
declare prod public.productos%rowtype; previous public.gastos%rowtype; total numeric; gid uuid; initial jsonb;
begin
 if p_costo is null or p_costo<=0 or p_costo>999999999999.99 or p_costo<>round(p_costo,4) then raise exception 'Indica el costo unitario en soles, mayor a cero y con hasta cuatro decimales.'; end if;
 total:=round(p_cantidad*p_costo,2);
 if total is null or total<=0 or total>999999999999.99 then raise exception 'El costo total de la entrada no es válido.'; end if;
 select * into prod from public.productos where id::text=p_producto;
 if not found then raise exception 'Producto inexistente para el gasto.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gasto:'||p_origen||':'||p_origen_id,0));
 select * into previous from public.gastos where origen=p_origen and origen_id=p_origen_id;
 if found then
  select anterior into initial from public.entrada_correcciones where gasto_id=previous.id order by (anterior->>'version')::integer limit 1;
  if coalesce((initial->>'cantidad')::numeric,previous.cantidad) is distinct from p_cantidad or coalesce((initial->>'costo_unitario')::numeric,previous.costo_unitario) is distinct from p_costo or previous.producto_codigo is distinct from prod.codigo then
   raise exception 'Esta entrada ya tiene un gasto con otro costo o cantidad.';
  end if;
  return previous.id;
 end if;
 gid:=gen_random_uuid();
 insert into public.gastos(id,fecha,concepto,categoria,monto,estado,fecha_pago,proveedor,observaciones,created_by,solicitud_inicial,origen,origen_id,producto_codigo,producto_nombre,cantidad,unidad,costo_unitario)
 values(gid,p_fecha,left('Ingreso: '||prod.nombre,200),case when prod.controla_inventario=false then 'Servicios' else 'Mercadería' end,total,'pagado',p_fecha,coalesce(p_proveedor,''),left(coalesce(p_nota,''),1000),auth.uid(),'{}',p_origen,p_origen_id,prod.codigo,prod.nombre,p_cantidad,prod.unidad_medida,p_costo);
 return gid;
end $$;

create or replace function public.app_gastos_mes(p_mes date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare inicio date; fin date; result jsonb;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede consultar gastos.' using errcode='42501'; end if;
 if p_mes is null then raise exception 'Selecciona un mes.'; end if;
 inicio:=date_trunc('month',p_mes)::date;fin:=(inicio+interval '1 month')::date;
 select jsonb_build_object('gastos',coalesce(jsonb_agg(to_jsonb(g)-'solicitud_inicial' order by g.fecha desc,g.created_at desc),'[]'),
  'total',coalesce(sum(g.monto),0),'cantidad',count(*),'productos',count(distinct g.producto_codigo),
  'total_productos',coalesce(sum(g.monto) filter(where g.origen<>'manual'),0),'total_otros',coalesce(sum(g.monto) filter(where g.origen='manual'),0))
 into result from public.gastos g where g.fecha>=inicio and g.fecha<fin and not g.anulado;
 return result||jsonb_build_object('pagado',result->'total','pendiente',0,'presupuesto',null);
end $$;
create or replace function public.app_listar_auditoria() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede consultar auditoría.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.fecha desc) from (
  select a.fecha,a.tabla,a.operacion,a.actor_id,coalesce(p.nombre,u.email,'Sistema') actor_nombre,u.email actor_email,
   case when a.tabla='entrada_correcciones' then jsonb_build_object(
    'producto',a.nuevo->'nuevo'->>'producto',
    'cantidad',(a.nuevo->'anterior'->>'cantidad')||' → '||(a.nuevo->'nuevo'->>'cantidad'),
    'costo_unitario',(a.nuevo->'anterior'->>'costo_unitario')||' → '||(a.nuevo->'nuevo'->>'costo_unitario'),
    'total',(a.nuevo->'anterior'->>'total')||' → '||(a.nuevo->'nuevo'->>'total'),
    'motivo',left(a.nuevo->>'motivo',180))::text
   else left(coalesce(a.nuevo,a.anterior,'{}')::text,500) end resumen
  from public.auditoria a left join public.auth_perfiles p on p.user_id=a.actor_id left join auth.users u on u.id=a.actor_id
  order by a.fecha desc limit 1000) r),'[]'::jsonb);
end $$;
revoke all on function public.app_listar_auditoria() from public,anon,authenticated;
grant execute on function public.app_listar_auditoria() to authenticated;

create or replace function public.app_resumen_gastos_inicio() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare inicio date:=date_trunc('month',now() at time zone 'America/Lima')::date;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede consultar gastos.' using errcode='42501'; end if;
 return (select jsonb_build_object('periodo',inicio,'total',coalesce(sum(g.monto),0),'cantidad',count(*))
  from public.gastos g where g.fecha>=inicio and g.fecha<(inicio+interval '1 month')::date and not g.anulado);
end $$;
commit;
