-- Datos maestros legibles en Facturas 3.
-- Solo se incluyen nombres, RUC y códigos que se distinguen en las imágenes.
-- Cantidades, lotes y saldos no se cargan aquí: se registran al recibir cada compra.
begin;

insert into public.categorias (nombre,descripcion)
select x.nombre,x.descripcion
from (values
  ('Carnes','Carnes, cortes y productos cárnicos.'),
  ('Lácteos y quesos','Quesos y productos lácteos.'),
  ('Verduras y hortalizas','Verduras, hierbas y hortalizas frescas.'),
  ('Frutas','Frutas frescas.'),
  ('Abarrotes','Alimentos secos y productos de despensa.'),
  ('Bebidas','Bebidas envasadas y gaseosas.'),
  ('Limpieza','Productos de limpieza e higiene operativa.'),
  ('Insumos de panificación','Harinas e insumos para elaboración.')
) as x(nombre,descripcion)
where not exists (select 1 from public.categorias c where lower(btrim(c.nombre))=lower(btrim(x.nombre)));

insert into public.proveedores (nombre,documento,estado)
select x.nombre,x.documento,true
from (values
  ('Alimentos More S.A.C.','20603637993'),
  ('Apudex S.A.C.','20602893350'),
  ('Mandujano Rojas Anthony Yhovanni','10778335960'),
  ('Carnicería Navarro E.I.R.L.','20544908368'),
  ('Lácteos Verano E.I.R.L.','20468257212'),
  ('Braedt S.A.','20100067910'),
  ('Cencosud Retail Perú S.A.','20109072177'),
  -- El nombre es legible; el RUC no se distingue con seguridad en la imagen.
  ('Negociaciones e Inversiones Aileen S.A.',null),
  ('Avícola Víctor Pérez S.A.C.',null),
  ('Distribuidora Naltia E.I.R.L.',null),
  ('Puratos Perú S.A.',null),
  ('Makro Supermayorista S.A.',null)
) as x(nombre,documento)
where not exists (
  select 1 from public.proveedores p
  where lower(btrim(p.nombre))=lower(btrim(x.nombre)) or (x.documento is not null and regexp_replace(coalesce(p.documento,''),'[^0-9]','','g')=x.documento)
);

-- Productos con código interno visible en la factura. El stock inicial se registra
-- después, desde Recepciones, con lote, sede y cantidad recibida.
insert into public.productos (codigo,nombre,descripcion,categoria_id,unidad_medida,precio,precio_confirmado,estado,tipo_item,controla_inventario,es_perecible,requiere_lote)
select x.codigo,x.nombre,x.descripcion,c.id,x.unidad,x.precio,x.precio_confirmado,true,'producto',true,x.perecible,true
from (values
  ('6804000','Harina Nicolini Premium 50KG','Saco de harina Nicolini Premium de 50 kg.','Insumos de panificación','unidad',143.43,true,true),
  ('1000T5','Pechuga de pavo','Descripción según factura F002-0022369.','Carnes','kg',0,false,true),
  ('100400','Asado pejerrey','Descripción según factura F002-0022394.','Carnes','kg',0,false,true)
) as x(codigo,nombre,descripcion,categoria,unidad,precio,precio_confirmado,perecible)
join public.categorias c on lower(btrim(c.nombre))=lower(btrim(x.categoria))
where not exists (select 1 from public.productos p where lower(btrim(p.codigo))=lower(btrim(x.codigo)));

insert into public.proveedor_productos(proveedor_id,producto_id,codigo_proveedor,descripcion_proveedor,precio_ultimo,moneda)
select pr.id,p.id,p.codigo,p.nombre,nullif(p.precio,0),'PEN'
from public.proveedores pr
join public.productos p on p.codigo in ('6804000','1000T5','100400')
where ((regexp_replace(coalesce(pr.documento,''),'[^0-9]','','g'),p.codigo) in (('20602893350','6804000'))
       or (lower(btrim(pr.nombre))='negociaciones e inversiones aileen s.a.' and p.codigo in ('1000T5','100400')))
  and not exists (select 1 from public.proveedor_productos pp where pp.proveedor_id=pr.id and pp.producto_id=p.id);

commit;
