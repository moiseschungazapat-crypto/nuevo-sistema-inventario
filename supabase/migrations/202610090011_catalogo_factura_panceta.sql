-- Datos maestros confirmados en la factura electrónica E001-839.
-- La existencia y el lote se registran después desde Recepciones.
begin;

insert into public.proveedores (nombre,documento,estado)
select 'Chávez Arana Giancarlo','10806011601',true
where not exists (
 select 1 from public.proveedores
 where regexp_replace(coalesce(documento,''),'[^0-9]','','g')='10806011601'
);

insert into public.productos
 (codigo,nombre,descripcion,categoria_id,unidad_medida,precio,precio_confirmado,estado,tipo_item,controla_inventario,es_perecible,requiere_lote)
select 'PANCETA','Panceta','Producto cárnico vendido por kilogramo.',c.id,'kg',26.27,true,true,'producto',true,true,true
from public.categorias c
where lower(btrim(c.nombre))='carnes'
 and not exists (select 1 from public.productos p where lower(btrim(p.nombre))='panceta');

insert into public.proveedor_productos
 (proveedor_id,producto_id,codigo_proveedor,descripcion_proveedor,precio_ultimo,moneda)
select pr.id,p.id,null,'PANCETA',26.27,'PEN'
from public.proveedores pr
join public.productos p on lower(btrim(p.nombre))='panceta'
where regexp_replace(coalesce(pr.documento,''),'[^0-9]','','g')='10806011601'
 and not exists (
  select 1 from public.proveedor_productos pp
  where pp.proveedor_id=pr.id and pp.producto_id=p.id
 );

commit;
