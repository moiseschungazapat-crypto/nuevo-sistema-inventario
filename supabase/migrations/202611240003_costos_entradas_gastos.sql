-- Nuevas entradas con costo y gasto por producto dentro de la misma transacción.
-- No inventa precios ni genera gastos para entradas históricas sin costo.
begin;
alter table public.gastos add column origen text not null default 'manual' check(origen in ('manual','recepcion','entrada'));
alter table public.gastos add column origen_id text;
alter table public.gastos add column producto_codigo text;
alter table public.gastos add column producto_nombre text;
alter table public.gastos add column cantidad numeric(18,3);
alter table public.gastos add column unidad text;
alter table public.gastos add column costo_unitario numeric(18,4);
create unique index gastos_origen_unico on public.gastos(origen,origen_id) where origen_id is not null;

create function public.app_gasto_producto(p_origen text,p_origen_id text,p_fecha date,p_producto text,p_cantidad numeric,p_costo numeric,p_proveedor text,p_nota text)
returns uuid language plpgsql security definer set search_path='' as $$
declare prod public.productos%rowtype; previous public.gastos%rowtype; total numeric; gid uuid;
begin
 if p_costo is null or p_costo<=0 or p_costo>999999999999.99 or p_costo<>round(p_costo,4) then raise exception 'Indica el costo unitario en soles, mayor a cero y con hasta cuatro decimales.'; end if;
 total:=round(p_cantidad*p_costo,2);
 if total is null or total<=0 or total>999999999999.99 then raise exception 'El costo total de la entrada no es válido.'; end if;
 select * into prod from public.productos where id::text=p_producto;
 if not found then raise exception 'Producto inexistente para el gasto.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gasto:'||p_origen||':'||p_origen_id,0));
 select * into previous from public.gastos where origen=p_origen and origen_id=p_origen_id;
 if found then
  if previous.cantidad is distinct from p_cantidad or previous.costo_unitario is distinct from p_costo or previous.producto_codigo is distinct from prod.codigo then
   raise exception 'Esta entrada ya tiene un gasto con otro costo o cantidad.';
  end if;
  return previous.id;
 end if;
 gid:=gen_random_uuid();
 insert into public.gastos(id,fecha,concepto,categoria,monto,estado,fecha_pago,proveedor,observaciones,created_by,solicitud_inicial,origen,origen_id,producto_codigo,producto_nombre,cantidad,unidad,costo_unitario)
 values(gid,p_fecha,left('Ingreso: '||prod.nombre,200),case when prod.controla_inventario=false then 'Servicios' else 'Mercadería' end,total,'pagado',p_fecha,coalesce(p_proveedor,''),left(coalesce(p_nota,''),1000),auth.uid(),'{}',p_origen,p_origen_id,prod.codigo,prod.nombre,p_cantidad,prod.unidad_medida,p_costo);
 return gid;
end $$;
revoke all on function public.app_gasto_producto(text,text,date,text,numeric,numeric,text,text) from public,anon,authenticated;

create function public.app_gasto_recepcion_detalle() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.recepciones%rowtype; provider text;
begin
 if new.cantidad_recibida<=0 or new.precio_unitario is null then return new; end if;
 select * into r from public.recepciones where id=new.recepcion_id;
 if coalesce(r.moneda,'PEN')<>'PEN' then raise exception 'El costo de ingreso debe registrarse en soles (PEN).'; end if;
 select nombre into provider from public.proveedores where id=r.proveedor_id;
 perform public.app_gasto_producto('recepcion',new.id::text,r.fecha_recepcion,new.producto_id::text,new.cantidad_recibida,new.precio_unitario,provider,r.observaciones);
 return new;
end $$;
revoke all on function public.app_gasto_recepcion_detalle() from public,anon,authenticated;
create trigger app_gasto_recepcion after insert on public.recepcion_detalles for each row execute function public.app_gasto_recepcion_detalle();

create function public.app_registrar_recepcion_con_costo(p_recepcion jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare d jsonb; costo numeric; recibida numeric;
begin
 if coalesce(public.app_rol(),'') not in ('administrador','operador') then raise exception 'No tienes permiso para registrar entradas.' using errcode='42501'; end if;
 if jsonb_typeof(p_recepcion->'detalles') is distinct from 'array' then raise exception 'Agrega los productos de la entrada.'; end if;
 if coalesce(p_recepcion->>'moneda','PEN')<>'PEN' then raise exception 'Registra el costo de la entrada en soles.'; end if;
 for d in select value from jsonb_array_elements(p_recepcion->'detalles') loop
  recibida:=nullif(d->>'cantidad_recibida','')::numeric;
  costo:=nullif(d->>'precio_unitario','')::numeric;
  if recibida>0 and (costo is null or costo<=0 or costo>999999999999.99 or costo<>round(costo,4) or round(recibida*costo,2)<=0 or round(recibida*costo,2)>999999999999.99) then
   raise exception 'Cada producto recibido necesita un costo unitario válido en soles.';
  end if;
 end loop;
 return public.app_registrar_recepcion_simple(p_recepcion);
end $$;
revoke all on function public.app_registrar_recepcion_con_costo(jsonb) from public,anon,authenticated;
grant execute on function public.app_registrar_recepcion_con_costo(jsonb) to authenticated;

create or replace function public.app_registrar_recepcion_google_sheets(p_operacion uuid,p_recepcion jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.google_sheets_operaciones%rowtype; request jsonb; rid uuid; result jsonb;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede sincronizar recepciones.' using errcode='42501'; end if;
 if p_operacion is null then raise exception 'Falta el identificador de sincronización.'; end if;
 request:=p_recepcion||jsonb_build_object('operacion_id',p_operacion);
 perform pg_advisory_xact_lock(hashtextextended('sheet:'||p_operacion::text,0));
 select * into previous from public.google_sheets_operaciones where operacion_id=p_operacion;
 if found then
  if previous.tipo<>'recepcion' or previous.solicitud<>request then raise exception 'El identificador de la fila ya fue usado con otros datos.'; end if;
  return previous.resultado||jsonb_build_object('repetido',true);
 end if;
 rid:=public.app_registrar_recepcion_con_costo(request);
 result:=jsonb_build_object('id',rid,'repetido',false);
 insert into public.google_sheets_operaciones(operacion_id,tipo,solicitud,resultado,created_by)
 values(p_operacion,'recepcion',request,result,auth.uid());
 return result;
end $$;

create function public.app_registrar_entrada_con_costo(p_operacion uuid,p_producto text,p_lote uuid,p_sede text,p_cantidad numeric,p_documento text,p_motivo text,p_costo_unitario numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(public.app_rol(),'') not in ('administrador','operador') then raise exception 'No tienes permiso para registrar entradas.' using errcode='42501'; end if;
 if p_costo_unitario is null or p_costo_unitario<=0 or p_costo_unitario<>round(p_costo_unitario,4) then raise exception 'Indica el costo unitario de la entrada.'; end if;
 result:=public.app_registrar_movimiento(p_operacion,'entrada',p_producto,p_lote,p_sede,null,p_cantidad,p_documento,p_motivo);
 perform public.app_gasto_producto('entrada',result->>'id',(now() at time zone 'America/Lima')::date,p_producto,p_cantidad,p_costo_unitario,'',p_motivo);
 return result;
end $$;
revoke all on function public.app_registrar_entrada_con_costo(uuid,text,uuid,text,numeric,text,text,numeric) from public,anon,authenticated;
grant execute on function public.app_registrar_entrada_con_costo(uuid,text,uuid,text,numeric,text,text,numeric) to authenticated;

-- Los registros automáticos se corrigen desde su origen, no como gastos independientes.
alter function public.app_guardar_gasto(uuid,jsonb,uuid,integer) rename to app_guardar_gasto_interno;
revoke all on function public.app_guardar_gasto_interno(uuid,jsonb,uuid,integer) from public,anon,authenticated;
create function public.app_guardar_gasto(p_operacion uuid,p_datos jsonb,p_id uuid default null,p_version integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede registrar gastos.' using errcode='42501'; end if;
 if p_id is not null and exists(select 1 from public.gastos where id=p_id and origen<>'manual') then raise exception 'Este gasto fue generado por una entrada y conserva el costo de origen.'; end if;
 return public.app_guardar_gasto_interno(p_operacion,p_datos||jsonb_build_object('estado','pagado','fecha_pago',p_datos->>'fecha'),p_id,p_version);
end $$;
revoke all on function public.app_guardar_gasto(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.app_guardar_gasto(uuid,jsonb,uuid,integer) to authenticated;
revoke execute on function public.app_pagar_gasto(uuid,integer) from authenticated;

create or replace function public.app_gastos_mes(p_mes date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare inicio date; fin date; result jsonb;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede consultar gastos.' using errcode='42501'; end if;
 if p_mes is null then raise exception 'Selecciona un mes.'; end if;
 inicio:=date_trunc('month',p_mes)::date;fin:=(inicio+interval '1 month')::date;
 select jsonb_build_object(
  'gastos',coalesce(jsonb_agg(to_jsonb(g)-'solicitud_inicial' order by g.fecha desc,g.created_at desc),'[]'),
  'total',coalesce(sum(g.monto),0),'cantidad',count(*),'productos',count(distinct g.producto_codigo),
  'total_productos',coalesce(sum(g.monto) filter(where g.origen<>'manual'),0),
  'total_otros',coalesce(sum(g.monto) filter(where g.origen='manual'),0)
 ) into result from public.gastos g where g.fecha>=inicio and g.fecha<fin;
 -- Mantener el contrato previo hasta que se publique el nuevo frontend.
 -- La pantalla nueva no utiliza estados de pago ni presupuestos.
 return result||jsonb_build_object('pagado',result->'total','pendiente',0,'presupuesto',null);
end $$;
commit;
