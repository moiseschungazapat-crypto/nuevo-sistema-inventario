-- Recepción, lotes y entradas se confirman dentro de la misma transacción.
begin;
alter table public.lotes alter column vencimiento drop not null;
alter table public.recepciones add column if not exists operacion_id uuid;
alter table public.recepciones add column if not exists solicitud_original jsonb;
create unique index if not exists app_recepcion_operacion on public.recepciones(operacion_id);

create or replace function public.app_registrar_recepcion_simple(p_recepcion jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 r jsonb:=p_recepcion; d jsonb; detalles jsonb:='[]';
 prod public.productos%rowtype; lot public.lotes%rowtype;
 operation uuid; rid uuid; previous public.recepciones%rowtype;
 lot_id uuid; new_code text; expiration date; received numeric; invoiced numeric; line_number integer:=0;
begin
 if coalesce(public.app_rol(),'') not in ('administrador','operador') then
  raise exception 'No tienes permiso para registrar recepciones.' using errcode='42501';
 end if;
 operation:=nullif(r->>'operacion_id','')::uuid;
 if operation is null then raise exception 'Falta el identificador de la recepción. Vuelve a abrir el formulario.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(operation::text,0));
 select * into previous from public.recepciones where operacion_id=operation;
 if found then
  if previous.created_by is distinct from auth.uid() or previous.solicitud_original is distinct from r then
   raise exception 'Esta recepción ya se guardó con otros datos. Revisa el historial antes de volver a registrar.';
  end if;
  return previous.id;
 end if;
 if jsonb_typeof(r->'detalles') is distinct from 'array' then raise exception 'Agrega al menos un producto.'; end if;
 if jsonb_array_length(r->'detalles') not between 1 and 50 then raise exception 'Registra entre 1 y 50 productos.'; end if;
 for d in select value from jsonb_array_elements(r->'detalles') loop
  line_number:=line_number+1;
  select * into prod from public.productos where id::text=(d->>'producto_id') and estado for share;
  if not found then raise exception 'Producto inexistente o inactivo.'; end if;
  received:=nullif(d->>'cantidad_recibida','')::numeric;
  invoiced:=coalesce(nullif(d->>'cantidad_facturada','')::numeric,received);
  if received is null or received<0 or invoiced is null or invoiced<=0 or received>invoiced
   or received<>round(received,3) or invoiced<>round(invoiced,3) or received>999999999 or invoiced>999999999 then
   raise exception 'Revisa las cantidades de %; usa hasta tres decimales.',prod.nombre;
  end if;
  lot_id:=null;
  if coalesce(prod.controla_inventario,true) and received>0 then
   lot_id:=nullif(d->>'lote_id','')::uuid;
   if lot_id is not null then
    select * into lot from public.lotes where id=lot_id and producto_id=prod.id for share;
    if not found then raise exception 'El lote seleccionado no pertenece a %.',prod.nombre; end if;
    expiration:=lot.vencimiento;
   else
    expiration:=nullif(d->>'vencimiento','')::date;
    new_code:=nullif(btrim(d->>'codigo_lote'),'');
    if new_code is null then new_code:='REC-'||to_char((now() at time zone 'America/Lima')::date,'YYYYMMDD')||'-'||replace(operation::text,'-','')||'-'||line_number; end if;
    if length(new_code)>100 then raise exception 'El código de lote no puede superar 100 caracteres.'; end if;
    if coalesce(prod.es_perecible,false) and expiration is null then raise exception 'Indica el vencimiento de %.',prod.nombre; end if;
    if expiration < (now() at time zone 'America/Lima')::date then raise exception 'El lote de % está vencido.',prod.nombre; end if;
    insert into public.lotes(producto_id,codigo,vencimiento) values(prod.id,new_code,expiration)
     on conflict do nothing returning id into lot_id;
    if lot_id is null then
     select * into lot from public.lotes where producto_id=prod.id and lower(btrim(lotes.codigo))=lower(new_code) for share;
     if not found then raise exception 'No se pudo crear el lote. Vuelve a intentar.'; end if;
     if lot.vencimiento is distinct from expiration then raise exception 'El lote % ya existe con otro vencimiento. Selecciónalo o corrige la fecha.',new_code; end if;
     if lot.proveedor_id is not null and lot.proveedor_id::text is distinct from r->>'proveedor_id' then raise exception 'El lote % pertenece a otro proveedor. Usa un código diferente.',new_code; end if;
     lot_id:=lot.id;
    end if;
   end if;
   if coalesce(prod.es_perecible,false) and expiration is null then raise exception 'Indica el vencimiento de %.',prod.nombre; end if;
   if expiration < (now() at time zone 'America/Lima')::date then raise exception 'El lote de % está vencido.',prod.nombre; end if;
  end if;
  detalles:=detalles||jsonb_build_array(d||jsonb_build_object('lote_id',lot_id,'unidad',prod.unidad_medida,'cantidad_facturada',invoiced));
 end loop;
 rid:=public.app_registrar_recepcion(r||jsonb_build_object('detalles',detalles));
 update public.recepciones set operacion_id=operation,solicitud_original=p_recepcion where id=rid;
 return rid;
end $$;
revoke all on function public.app_registrar_recepcion_simple(jsonb) from public,anon,authenticated;
grant execute on function public.app_registrar_recepcion_simple(jsonb) to authenticated;
commit;
