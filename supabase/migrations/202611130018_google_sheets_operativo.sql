-- Sincronización operativa desde Google Sheets. No modifica movimientos existentes.
begin;

create table if not exists public.google_sheets_operaciones (
 operacion_id uuid primary key,
 tipo text not null check (tipo in ('recepcion','salida')),
 solicitud jsonb not null,
 resultado jsonb not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id)
);
alter table public.google_sheets_operaciones enable row level security;
revoke all on table public.google_sheets_operaciones from public,anon,authenticated;

create or replace function public.app_datos_google_sheets_operativo()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.app_rol() is distinct from 'administrador' then
  raise exception 'Solo un administrador puede sincronizar Google Sheets.' using errcode='42501';
 end if;
 return jsonb_build_object(
  'generated_at',now(),
  'products',(select coalesce(jsonb_agg(to_jsonb(p) order by p.codigo),'[]') from public.productos p where p.estado),
  'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.nombre),'[]') from public.categorias c where c.estado),
  'providers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.nombre),'[]') from public.proveedores p where p.estado),
  'sites',(select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre),'[]') from public.sedes s where s.estado),
  'stock',(select coalesce(jsonb_agg(to_jsonb(i) order by i.codigo,i.vencimiento nulls last,i.lote),'[]') from public.app_stock i),
  'minimums',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.inventario_minimos m)
 );
end $$;

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
 rid:=public.app_registrar_recepcion_simple(request);
 result:=jsonb_build_object('id',rid,'repetido',false);
 insert into public.google_sheets_operaciones(operacion_id,tipo,solicitud,resultado,created_by)
 values(p_operacion,'recepcion',request,result,auth.uid());
 return result;
end $$;

create or replace function public.app_registrar_salida_fefo_google_sheets(
 p_operacion uuid,p_producto text,p_sede text,p_cantidad numeric,p_fecha date,p_documento text,p_motivo text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 previous public.google_sheets_operaciones%rowtype; request jsonb; prod public.productos%rowtype;
 balance record; remaining numeric:=p_cantidad; take_quantity numeric; movement jsonb; movements jsonb:='[]'; result jsonb;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo un administrador puede sincronizar salidas.' using errcode='42501'; end if;
 if p_operacion is null or p_cantidad is null or p_cantidad<=0 or p_cantidad<>round(p_cantidad,3) then raise exception 'Cantidad de salida inválida.'; end if;
 if p_fecha is null or p_fecha>(now() at time zone 'America/Lima')::date then raise exception 'La fecha de salida no puede estar vacía ni ser futura.'; end if;
 request:=jsonb_build_object('producto',p_producto,'sede',p_sede,'cantidad',p_cantidad,'fecha',p_fecha,'documento',coalesce(p_documento,''),'motivo',btrim(coalesce(p_motivo,'')));
 perform pg_advisory_xact_lock(hashtextextended('sheet:'||p_operacion::text,0));
 select * into previous from public.google_sheets_operaciones where operacion_id=p_operacion;
 if found then
  if previous.tipo<>'salida' or previous.solicitud<>request then raise exception 'El identificador de la fila ya fue usado con otros datos.'; end if;
  return previous.resultado||jsonb_build_object('repetido',true);
 end if;
 select * into prod from public.productos where id::text=p_producto and estado and coalesce(controla_inventario,true);
 if not found then raise exception 'Producto inexistente, inactivo o sin control de stock.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('producto:'||p_producto,0));
 for balance in
  select i.lote_id,i.cantidad,l.vencimiento,l.codigo
  from public.inventario i join public.lotes l on l.id=i.lote_id
  where i.producto_id=prod.id and i.sede_id::text=p_sede and i.cantidad>0
    and (l.vencimiento is null or l.vencimiento>=(now() at time zone 'America/Lima')::date)
  order by l.vencimiento nulls last,l.created_at,l.id for update of i
 loop
  exit when remaining<=0;
  take_quantity:=least(remaining,balance.cantidad);
  movement:=public.app_registrar_movimiento(gen_random_uuid(),'salida',p_producto,balance.lote_id,p_sede,null,take_quantity,coalesce(p_documento,''),p_motivo);
  update public.movimientos set fecha=(p_fecha::timestamp + ((now() at time zone 'America/Lima')::time)) at time zone 'America/Lima'
   where id::text=movement->>'id';
  movements:=movements||jsonb_build_array(jsonb_build_object('id',movement->>'id','lote',balance.codigo,'cantidad',take_quantity));
  remaining:=remaining-take_quantity;
 end loop;
 if remaining>0 then raise exception 'Stock insuficiente o únicamente disponible en lotes vencidos. Faltan % %.',remaining,prod.unidad_medida; end if;
 result:=jsonb_build_object('movimientos',movements,'cantidad',p_cantidad,'repetido',false);
 insert into public.google_sheets_operaciones(operacion_id,tipo,solicitud,resultado,created_by)
 values(p_operacion,'salida',request,result,auth.uid());
 return result;
end $$;

revoke all on function public.app_datos_google_sheets_operativo(),public.app_registrar_recepcion_google_sheets(uuid,jsonb),public.app_registrar_salida_fefo_google_sheets(uuid,text,text,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.app_datos_google_sheets_operativo(),public.app_registrar_recepcion_google_sheets(uuid,jsonb),public.app_registrar_salida_fefo_google_sheets(uuid,text,text,numeric,date,text,text) to authenticated;
commit;
