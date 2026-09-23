-- Catálogo y recepciones: datos comerciales sin mezclar inventario con servicios.
-- Ejecutar después de 202609150005_storage_recepciones.sql.
begin;

-- Un producto puede ser stock, un servicio, un activo o un gasto. La clasificación
-- evita que una factura de fumigación, combustible o equipamiento cree existencias.
alter table public.productos add column if not exists tipo_item text not null default 'producto';
alter table public.productos add column if not exists controla_inventario boolean not null default true;
alter table public.productos add column if not exists marca text;
alter table public.productos add column if not exists presentacion text;
alter table public.productos add column if not exists codigo_barras text;
alter table public.productos add column if not exists es_perecible boolean not null default false;
alter table public.productos add column if not exists requiere_lote boolean not null default true;
alter table public.productos add column if not exists precio_confirmado boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='app_producto_tipo_item') then
    alter table public.productos add constraint app_producto_tipo_item
      check (tipo_item in ('producto','servicio','activo','gasto'));
  end if;
end $$;

-- La relación es muchos a muchos: un mismo producto puede comprarse a más de un proveedor.
create table if not exists public.proveedor_productos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id bigint not null references public.proveedores(id) on delete restrict,
  producto_id bigint not null references public.productos(id) on delete restrict,
  codigo_proveedor text,
  descripcion_proveedor text,
  precio_ultimo numeric(18,2) check (precio_ultimo is null or (precio_ultimo >= 0 and precio_ultimo <= 999999999999)),
  moneda text not null default 'PEN' check (moneda in ('PEN','USD','EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(proveedor_id, producto_id)
);
alter table public.proveedor_productos enable row level security;
revoke all on public.proveedor_productos from public, anon, authenticated;
grant select on public.proveedor_productos to authenticated;
drop policy if exists proveedor_productos_read on public.proveedor_productos;
create policy proveedor_productos_read on public.proveedor_productos for select to authenticated using (public.app_rol() is not null);

-- El lote también conserva de qué proveedor y comprobante provino. Esto permite
-- rastrear una existencia sin convertir la recepción en una simple nota libre.
alter table public.lotes add column if not exists proveedor_id bigint;
alter table public.lotes add column if not exists fecha_recepcion date;
alter table public.lotes add column if not exists costo_unitario numeric(18,4);
alter table public.lotes add column if not exists documento_origen text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='app_lote_proveedor') then
    alter table public.lotes add constraint app_lote_proveedor foreign key (proveedor_id) references public.proveedores(id) on delete restrict;
  end if;
end $$;

-- Información de la recepción que suele venir en la factura o en la guía.
alter table public.recepciones add column if not exists fecha_recepcion date not null default current_date;
alter table public.recepciones add column if not exists moneda text not null default 'PEN';
alter table public.recepciones add column if not exists forma_pago text;
alter table public.recepciones add column if not exists condicion_pago text;
alter table public.recepciones add column if not exists fecha_vencimiento_pago date;
alter table public.recepciones add column if not exists guia_remision text;
alter table public.recepciones add column if not exists orden_compra text;
alter table public.recepciones add column if not exists subtotal numeric(18,2);
alter table public.recepciones add column if not exists descuento numeric(18,2);
alter table public.recepciones add column if not exists igv numeric(18,2);
alter table public.recepciones add column if not exists total numeric(18,2);
alter table public.recepciones add column if not exists estado_documento text not null default 'registrado';
alter table public.recepciones add column if not exists estado_pago text not null default 'pendiente';
alter table public.recepciones add column if not exists detraccion_porcentaje numeric(5,2);
alter table public.recepciones add column if not exists detraccion_monto numeric(18,2);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='app_recepcion_moneda') then
    alter table public.recepciones add constraint app_recepcion_moneda check (moneda in ('PEN','USD','EUR'));
  end if;
  if not exists (select 1 from pg_constraint where conname='app_recepcion_estado_documento') then
    alter table public.recepciones add constraint app_recepcion_estado_documento check (estado_documento in ('registrado','observado','anulado'));
  end if;
  if not exists (select 1 from pg_constraint where conname='app_recepcion_estado_pago') then
    alter table public.recepciones add constraint app_recepcion_estado_pago check (estado_pago in ('pendiente','parcial','pagado'));
  end if;
end $$;

-- Una línea de servicio o activo puede no tener lote. Para artículos con existencias,
-- el RPC exige lote cuando se recibe una cantidad mayor que cero.
alter table public.recepcion_detalles alter column lote_id drop not null;
alter table public.recepcion_detalles add column if not exists descripcion_factura text;
alter table public.recepcion_detalles add column if not exists codigo_proveedor text;
alter table public.recepcion_detalles add column if not exists precio_unitario numeric(18,4);
alter table public.recepcion_detalles add column if not exists descuento numeric(18,2);
alter table public.recepcion_detalles add column if not exists subtotal numeric(18,2);
alter table public.recepcion_detalles add column if not exists igv numeric(18,2);
alter table public.recepcion_detalles add column if not exists total numeric(18,2);

-- Protección adicional para llamadas RPC antiguas o clientes externos: servicios,
-- activos y gastos no pueden crear lotes, mínimos ni movimientos de inventario.
create or replace function public.app_validar_producto_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare controls boolean;
begin
  execute 'select coalesce(controla_inventario,true) from public.productos where id=$1' into controls using new.producto_id;
  if coalesce(controls,false)=false then
    raise exception 'El producto no controla inventario y no admite lotes ni movimientos.';
  end if;
  return new;
end $$;
drop trigger if exists app_validar_lote_stock on public.lotes;
create trigger app_validar_lote_stock before insert on public.lotes for each row execute function public.app_validar_producto_stock();
drop trigger if exists app_validar_minimo_stock on public.inventario_minimos;
create trigger app_validar_minimo_stock before insert or update on public.inventario_minimos for each row execute function public.app_validar_producto_stock();
drop trigger if exists app_validar_movimiento_stock on public.movimientos;
create trigger app_validar_movimiento_stock before insert on public.movimientos for each row execute function public.app_validar_producto_stock();

-- El RPC vuelve a comprobar el producto en el servidor; el navegador no puede decidir
-- si una línea modifica saldos.
create or replace function public.app_registrar_recepcion(p_recepcion jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  r jsonb := p_recepcion;
  rid uuid;
  d jsonb;
  prod public.productos%rowtype;
  lot public.lotes%rowtype;
  prod_id bigint;
  lot_id uuid;
  provider_id bigint;
  facturada numeric;
  recibida numeric;
  controls_stock boolean;
  op uuid;
begin
  if coalesce(public.app_rol(),'') not in ('administrador','operador') then
    raise exception 'No tienes permiso para registrar recepciones.';
  end if;
  if nullif(btrim(r->>'serie'),'') is null or nullif(btrim(r->>'numero'),'') is null then
    raise exception 'Indica serie y número del comprobante.';
  end if;
  if nullif(btrim(r->>'responsable'),'') is null then
    raise exception 'Indica quién recibió la compra.';
  end if;
  provider_id := (r->>'proveedor_id')::bigint;

  insert into public.recepciones(
    proveedor_id,tipo_comprobante,serie,numero,fecha_emision,fecha_recepcion,sede_id,responsable,
    observaciones,moneda,forma_pago,condicion_pago,fecha_vencimiento_pago,guia_remision,orden_compra,
    subtotal,descuento,igv,total,estado_documento,estado_pago,detraccion_porcentaje,detraccion_monto,created_by
  ) values (
    provider_id, coalesce(nullif(btrim(r->>'tipo_comprobante'),''),'Factura'), btrim(r->>'serie'), btrim(r->>'numero'),
    (r->>'fecha_emision')::date, coalesce(nullif(r->>'fecha_recepcion','')::date,current_date), (r->>'sede_id')::bigint, btrim(r->>'responsable'),
    nullif(btrim(r->>'observaciones'),''), coalesce(nullif(r->>'moneda',''),'PEN'), nullif(btrim(r->>'forma_pago'),''),
    nullif(btrim(r->>'condicion_pago'),''), nullif(r->>'fecha_vencimiento_pago','')::date, nullif(btrim(r->>'guia_remision'),''),
    nullif(btrim(r->>'orden_compra'),''), nullif(r->>'subtotal','')::numeric, nullif(r->>'descuento','')::numeric,
    nullif(r->>'igv','')::numeric, nullif(r->>'total','')::numeric, coalesce(nullif(r->>'estado_documento',''),'registrado'),
    coalesce(nullif(r->>'estado_pago',''),'pendiente'), nullif(r->>'detraccion_porcentaje','')::numeric,
    nullif(r->>'detraccion_monto','')::numeric, auth.uid()
  ) returning id into rid;

  for d in select * from jsonb_array_elements(coalesce(r->'detalles','[]'::jsonb)) loop
    prod_id := nullif(d->>'producto_id','')::bigint;
    select * into prod from public.productos where id=prod_id and estado for share;
    if not found then raise exception 'Producto inexistente o inactivo.'; end if;
    controls_stock := coalesce(prod.controla_inventario,true);
    facturada := (d->>'cantidad_facturada')::numeric;
    recibida := (d->>'cantidad_recibida')::numeric;
    if facturada is null or facturada<=0 or recibida is null or recibida<0 or recibida>facturada then
      raise exception 'Cantidad facturada o recibida no válida.';
    end if;
    if nullif(btrim(d->>'unidad'),'') is null or btrim(d->>'unidad')<>prod.unidad_medida then
      raise exception 'La unidad de % debe coincidir con la unidad base del catálogo (%).',prod.nombre,prod.unidad_medida;
    end if;
    lot_id := nullif(d->>'lote_id','')::uuid;
    if controls_stock and recibida>0 and lot_id is null then
      raise exception 'El producto % requiere un lote para registrar lo recibido.',prod.nombre;
    end if;
    if lot_id is not null then
      select * into lot from public.lotes where id=lot_id and producto_id=prod.id;
      if not found then raise exception 'El lote no pertenece al producto %.',prod.nombre; end if;
      update public.lotes set proveedor_id=coalesce(proveedor_id,provider_id),fecha_recepcion=coalesce(fecha_recepcion,(r->>'fecha_recepcion')::date,current_date),
        costo_unitario=coalesce(nullif(d->>'precio_unitario','')::numeric,costo_unitario),
        documento_origen=coalesce(documento_origen,concat(r->>'tipo_comprobante',' ',r->>'serie','-',r->>'numero'))
      where id=lot_id;
    end if;
    insert into public.recepcion_detalles(
      recepcion_id,producto_id,lote_id,cantidad_facturada,cantidad_recibida,unidad,
      descripcion_factura,codigo_proveedor,precio_unitario,descuento,subtotal,igv,total
    ) values (
      rid,prod.id,lot_id,facturada,recibida,btrim(d->>'unidad'),nullif(btrim(d->>'descripcion_factura'),''),
      nullif(btrim(d->>'codigo_proveedor'),''),nullif(d->>'precio_unitario','')::numeric,nullif(d->>'descuento','')::numeric,
      nullif(d->>'subtotal','')::numeric,nullif(d->>'igv','')::numeric,nullif(d->>'total','')::numeric
    );
    insert into public.proveedor_productos(proveedor_id,producto_id,codigo_proveedor,descripcion_proveedor,precio_ultimo,moneda)
      values(provider_id,prod.id,nullif(btrim(d->>'codigo_proveedor'),''),nullif(btrim(d->>'descripcion_factura'),''),nullif(d->>'precio_unitario','')::numeric,coalesce(nullif(r->>'moneda',''),'PEN'))
      on conflict(proveedor_id,producto_id) do update set codigo_proveedor=coalesce(excluded.codigo_proveedor,public.proveedor_productos.codigo_proveedor),descripcion_proveedor=coalesce(excluded.descripcion_proveedor,public.proveedor_productos.descripcion_proveedor),precio_ultimo=coalesce(excluded.precio_ultimo,public.proveedor_productos.precio_ultimo),moneda=excluded.moneda,updated_at=now();
    if controls_stock and recibida>0 then
      op := gen_random_uuid();
      perform public.app_registrar_movimiento(
        op,'entrada',prod.id::text,lot_id,(r->>'sede_id')::text,null,recibida,
        concat(r->>'tipo_comprobante',' ',r->>'serie','-',r->>'numero'),'Recepción de compra'
      );
    end if;
  end loop;
  return rid;
end $$;

create or replace function public.app_listar_recepciones()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_emision desc,x.created_at desc),'[]'::jsonb)
  from (
    select r.id,r.fecha_emision,r.fecha_recepcion,p.nombre proveedor,r.tipo_comprobante,r.serie,r.numero,
      s.nombre sede,string_agg(distinct pr.nombre, ', ' order by pr.nombre) productos,
      coalesce(sum(d.cantidad_facturada),0) facturado,coalesce(sum(d.cantidad_recibida),0) recibido,
      coalesce(sum(d.cantidad_facturada-d.cantidad_recibida),0) faltante,r.responsable,r.total,r.moneda,
      r.estado_documento,r.estado_pago,r.created_at,
      (select count(*) from public.recepcion_archivos a where a.recepcion_id=r.id) archivos
    from public.recepciones r join public.proveedores p on p.id=r.proveedor_id join public.sedes s on s.id=r.sede_id
      join public.recepcion_detalles d on d.recepcion_id=r.id join public.productos pr on pr.id=d.producto_id
    group by r.id,r.fecha_emision,r.fecha_recepcion,p.nombre,r.tipo_comprobante,r.serie,r.numero,s.nombre,r.responsable,
      r.total,r.moneda,r.estado_documento,r.estado_pago,r.created_at
  ) x
$$;

-- Los servicios y activos no se muestran como artículos con existencias ni cuentan como productos de stock.
create or replace view public.app_stock with (security_invoker=true) as
  select i.id::text as id,i.producto_id,i.sede_id,i.lote_id,p.codigo,p.nombre as producto,p.unidad_medida,
    s.nombre as sede,l.codigo as lote,l.vencimiento,i.cantidad,coalesce(m.minimo,0) as stock_minimo,
    sum(i.cantidad) over(partition by i.producto_id,i.sede_id) as total_sede
  from public.inventario i join public.productos p on p.id=i.producto_id join public.sedes s on s.id=i.sede_id
    join public.lotes l on l.id=i.lote_id left join public.inventario_minimos m on m.producto_id=i.producto_id and m.sede_id=i.sede_id
  where coalesce(p.controla_inventario,true)
  union all
  select 'min:'||m.id::text,m.producto_id,m.sede_id,null::uuid,p.codigo,p.nombre,p.unidad_medida,s.nombre,
    'Sin existencias',null::date,0::numeric,m.minimo,0::numeric
  from public.inventario_minimos m join public.productos p on p.id=m.producto_id join public.sedes s on s.id=m.sede_id
  where coalesce(p.controla_inventario,true)
    and not exists(select 1 from public.inventario i where i.producto_id=m.producto_id and i.sede_id=m.sede_id);

create or replace function public.app_resumen() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare today date:=(now() at time zone 'America/Lima')::date;
begin
 if public.app_rol() is null then raise exception 'Acceso no habilitado.'; end if;
 return jsonb_build_object(
  'productos',(select count(*) from public.productos where estado and coalesce(controla_inventario,true)),
  'bajo_minimo',(select count(*) from public.inventario_minimos mi join public.productos p on p.id=mi.producto_id where p.controla_inventario and mi.minimo>coalesce((select sum(i.cantidad) from public.inventario i where i.producto_id=mi.producto_id and i.sede_id=mi.sede_id),0)),
  'entradas',(select count(*) from public.movimientos where tipo='entrada' and (fecha at time zone 'America/Lima')::date=today),
  'salidas',(select count(*) from public.movimientos where tipo='salida' and (fecha at time zone 'America/Lima')::date=today),
  'vencidos',(select count(distinct lote_id) from public.app_stock where cantidad>0 and vencimiento<today),
  'por_vencer',(select count(distinct lote_id) from public.app_stock where cantidad>0 and vencimiento between today and today+30),
  'actividad',(select jsonb_agg(jsonb_build_object('dia',day::date,'total',(select count(*) from public.movimientos where (fecha at time zone 'America/Lima')::date=day::date)) order by day) from generate_series(today-6,today,'1 day'::interval) day),
  'recientes',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.app_movimientos order by fecha desc,id desc limit 8) r),'[]'::jsonb)
 );
end $$;

do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['recepciones','recepcion_detalles','recepcion_archivos','proveedor_productos'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

revoke all on function public.app_registrar_recepcion(jsonb),public.app_listar_recepciones() from public,anon,authenticated;
grant execute on function public.app_registrar_recepcion(jsonb),public.app_listar_recepciones() to authenticated;
commit;
