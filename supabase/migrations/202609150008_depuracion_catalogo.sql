-- Depuración segura del catálogo inicial.
-- No elimina filas relacionadas con recepciones, movimientos o existencias:
-- las deja inactivas para conservar trazabilidad y permitir revertir la decisión.
begin;

-- Categorías que pertenecen a gastos/servicios/activos y no al inventario de insumos.
update public.categorias c
set estado=false, version=coalesce(c.version,1)+1
where lower(btrim(c.nombre)) in ('equipos y activos','servicios','combustibles','publicidad y material gráfico','ferretería y mantenimiento')
  and not exists (
    select 1 from public.productos p
    where p.categoria_id=c.id
      and p.estado
      and coalesce(p.controla_inventario,true)
      and p.tipo_item='producto'
  );

-- Proveedores exclusivamente operativos que aparecieron en las facturas, pero no
-- corresponden a existencias: combustible, equipo, fumigación, publicidad y parking.
update public.proveedores p
set estado=false, version=coalesce(p.version,1)+1
where lower(btrim(p.nombre)) in (
  'gasolineras s.a.c.',
  'grupo diseda s.a.c.',
  'im publicidad gráfica s.a.c.',
  'perú desfumi e.i.r.l.',
  'servicios múltiples gedefa s.r.l.',
  'c.r.a. investment s.a.c.',
  'mave fest / matías cottina peter luis',
  'corzel s.r.l.'
)
and not exists (select 1 from public.recepciones r where r.proveedor_id=p.id)
and not exists (select 1 from public.proveedor_productos pp where pp.proveedor_id=p.id);

-- Si alguien llegó a crear artículos no inventariables, se ocultan del catálogo
-- operativo solamente cuando todavía no tienen historial ni existencias.
update public.productos p
set estado=false, version=coalesce(p.version,1)+1
where (p.tipo_item in ('servicio','activo','gasto') or coalesce(p.controla_inventario,true)=false)
  and not exists (select 1 from public.inventario i where i.producto_id=p.id)
  and not exists (select 1 from public.movimientos m where m.producto_id=p.id)
  and not exists (select 1 from public.recepcion_detalles d where d.producto_id=p.id);

commit;
