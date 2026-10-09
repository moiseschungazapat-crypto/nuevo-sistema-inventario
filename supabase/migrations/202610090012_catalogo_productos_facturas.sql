-- Catálogo consolidado de productos identificados en las facturas revisadas.
-- Puede ejecutarse más de una vez: concilia por SKU o nombre y no crea stock.
begin;

do $$
begin
 if to_regclass('public.productos') is null or to_regclass('public.categorias') is null then
  raise exception 'Primero deben existir public.productos y public.categorias.';
 end if;
 if not exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='productos'
    and column_name in ('codigo','nombre','descripcion','categoria_id','unidad_medida','precio','precio_confirmado','marca','presentacion','estado','tipo_item','controla_inventario','es_perecible','requiere_lote')
  group by table_name having count(*)=14
 ) then
  raise exception 'Faltan columnas del catálogo. Ejecuta primero la migración 202609150006_catalogo_recepciones.sql.';
 end if;
end $$;

insert into public.categorias (nombre,descripcion,estado)
select x.nombre,x.descripcion,true
from (values
 ('Carnes','Carnes, aves, embutidos y productos cárnicos.'),
 ('Lácteos y quesos','Leches, quesos y productos lácteos.'),
 ('Verduras y hortalizas','Verduras, hierbas y hortalizas frescas.'),
 ('Frutas','Frutas frescas y envasadas.'),
 ('Abarrotes','Alimentos secos y productos de despensa.'),
 ('Bebidas','Bebidas envasadas.'),
 ('Limpieza','Productos de limpieza e higiene operativa.'),
 ('Insumos de panificación','Harinas, levaduras e insumos de pastelería y panificación.')
) as x(nombre,descripcion)
where not exists (
 select 1 from public.categorias c where lower(btrim(c.nombre))=lower(btrim(x.nombre))
);

do $$
declare
 r record;
 producto_existente public.productos.id%type;
 categoria_encontrada public.categorias.id%type;
begin
 for r in
  select * from (values
   ('PANCETA','Panceta','Producto cárnico vendido por kilogramo.','Carnes','kg',26.27,true,null,'A granel',true,true),
   ('CAR-002','Carne molida','Carne molida vendida por kilogramo.','Carnes','kg',0,false,null,'A granel',true,true),
   ('CAR-003','Hot dog alemana','Hot dog alemana; confirmar empaque comercial.','Carnes','unidad',0,false,null,'Confirmar empaque',true,true),
   ('CAR-004','Jamón pizzero AP BDT','Jamón pizzero vendido por kilogramo.','Carnes','kg',0,false,null,'A granel',true,true),
   ('CAR-005','Jamonada de pollo AP BDT','Jamonada de pollo vendida por kilogramo.','Carnes','kg',0,false,null,'A granel',true,true),
   ('CAR-006','Paté BDT 100 g','Paté en envase de 100 gramos.','Carnes','unidad',0,false,'BDT','Envase de 100 g',true,true),
   ('CAR-007','Hot dog AP BDT 1.6 kg','Hot dog en paquete de 1.6 kilogramos.','Carnes','unidad',0,false,'BDT','Paquete de 1.6 kg',true,true),
   ('CAR-008','Tocino especial ahumado rebanado 500 g','Tocino ahumado rebanado.','Carnes','unidad',0,false,null,'Paquete de 500 g',true,true),
   ('CAR-009','Pastel de jamón P2 3 kg','Pastel de jamón en pieza de 3 kilogramos.','Carnes','unidad',0,false,null,'Pieza de 3 kg',true,true),
   ('CAR-010','Queso de chancho P2 3 kg','Queso de chancho en pieza de 3 kilogramos.','Carnes','unidad',0,false,null,'Pieza de 3 kg',true,true),
   ('1000T5','Pechuga de pavo','Pechuga de pavo identificada en factura.','Carnes','kg',0,false,null,'A granel',true,true),
   ('100400','Asado pejerrey','Corte de carne identificado en factura.','Carnes','kg',0,false,null,'A granel',true,true),

   ('LAC-001','Queso fresco pasteurizado Vaché','Queso fresco pasteurizado vendido por kilogramo.','Lácteos y quesos','kg',0,false,'Vaché','A granel',true,true),
   ('LAC-002','Queso Edam AP Sigma FS 3 kg','Queso Edam en pieza de 3 kilogramos.','Lácteos y quesos','unidad',0,false,'Sigma','Pieza de 3 kg',true,true),
   ('LAC-003','Queso Suizo Cajamarca','Queso suizo vendido por kilogramo.','Lácteos y quesos','kg',0,false,null,'A granel',true,true),
   ('LAC-004','Queso Mantecoso','Queso mantecoso vendido por kilogramo.','Lácteos y quesos','kg',0,false,null,'A granel',true,true),
   ('LAC-005','Gloria Leche Light UHT lata 395 g','Leche Light UHT en lata.','Lácteos y quesos','caja',0,false,'Gloria','Caja x 24 latas de 395 g',true,true),
   ('LAC-006','Gloria Leche Cero Lactosa lata 390 g','Leche cero lactosa en lata.','Lácteos y quesos','caja',0,false,'Gloria','Caja x 24 latas de 390 g',true,true),
   ('LAC-007','Gloria Leche Reconstituida lata Azul 399 g','Leche reconstituida en lata azul.','Lácteos y quesos','unidad',0,false,'Gloria','Lata de 399 g',true,true),

   ('VER-001','Cebolla roja','Cebolla roja fresca.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-002','Rocoto','Rocoto fresco.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-003','Olluco picado','Olluco fresco picado.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-004','Perejil','Perejil fresco.','Verduras y hortalizas','paquete',0,false,null,'Paquete',true,true),
   ('VER-005','Lechuga','Lechuga fresca.','Verduras y hortalizas','unidad',0,false,null,'Unidad',true,true),
   ('VER-006','Papa negra','Papa negra fresca.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-007','Camote','Camote fresco.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-008','Maíz morado','Maíz morado.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-009','Acelga','Acelga fresca.','Verduras y hortalizas','paquete',0,false,null,'Paquete',true,true),
   ('VER-010','Ají amarillo','Ají amarillo fresco.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-011','Ajo pelado','Ajo fresco pelado.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-012','Vainita','Vainita fresca.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-013','Choclo desgranado','Choclo fresco desgranado.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-014','Choclo','Choclo fresco entero.','Verduras y hortalizas','unidad',0,false,null,'Unidad',true,true),
   ('VER-015','Pepino','Pepino fresco; confirmar la unidad con el encargado.','Verduras y hortalizas','unidad',0,false,null,'Unidad',true,true),
   ('VER-016','Papa amarilla especial','Papa amarilla especial.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-017','Apio','Apio fresco.','Verduras y hortalizas','paquete',0,false,null,'Paquete',true,true),
   ('VER-018','Poro','Poro fresco.','Verduras y hortalizas','paquete',0,false,null,'Paquete',true,true),
   ('VER-019','Tomate','Tomate fresco.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),
   ('VER-020','Palta','Palta fresca.','Verduras y hortalizas','unidad',0,false,null,'Unidad',true,true),
   ('VER-021','Espinaca','Espinaca fresca.','Verduras y hortalizas','kg',0,false,null,'A granel',true,true),

   ('FRU-001','Limón','Limón fresco.','Frutas','kg',0,false,null,'A granel',true,true),
   ('FRU-002','Membrillo','Membrillo fresco.','Frutas','kg',0,false,null,'A granel',true,true),
   ('FRU-003','Manzana','Manzana fresca.','Frutas','kg',0,false,null,'A granel',true,true),
   ('FRU-004','Blueberry 150 g','Blueberry en envase de 150 gramos.','Frutas','unidad',0,false,null,'Envase de 150 g',true,true),

   ('ABA-001','Pasta wantán 500 g','Pasta para wantán.','Abarrotes','unidad',0,false,null,'Paquete de 500 g',true,true),
   ('ABA-002','Vela mixta de 24','Vela mixta; confirmar conversión de la docena indicada en factura.','Abarrotes','paquete',0,false,null,'Paquete de 24',false,false),
   ('LIM-001','Servilleta Elite doblada x4','Servilleta doblada, cuatro paquetes de 500 unidades.','Limpieza','paquete',0,false,'Elite','Paquete x4 de 500 unidades',false,false),
   ('LIM-002','Limpiador floral antibacterial 4 L','Limpiador antibacterial con aroma floral.','Limpieza','unidad',0,false,'Dkasa','Bidón de 4 L',false,false),

   ('6804000','Harina Nicolini Premium 50 kg','Harina Premium en saco de 50 kilogramos.','Insumos de panificación','unidad',143.43,true,'Nicolini','Saco de 50 kg',true,true),
   ('PAN-002','Premix de chocolate 5 kg','Premezcla de chocolate; confirmar marca.','Insumos de panificación','unidad',0,false,null,'Bolsa o balde de 5 kg',true,true),
   ('PAN-003','Levadura fresca activa Fleischmann 500 g','Levadura fresca activa.','Insumos de panificación','unidad',0,false,'Fleischmann','Paquete de 500 g',true,true),
   ('PAN-004','Miroir Neutre 5 kg','Cobertura neutra para pastelería; confirmar marca.','Insumos de panificación','unidad',0,false,null,'Balde de 5 kg',true,true),
   ('PAN-005','Glasse fresa 5 kg','Glaseado de fresa; confirmar marca.','Insumos de panificación','unidad',0,false,null,'Balde de 5 kg',true,true),
   ('PAN-006','Mixo 4 kg','Insumo de panificación Mixo; confirmar nombre comercial.','Insumos de panificación','unidad',0,false,null,'Balde de 4 kg',true,true),
   ('PAN-007','Harina especial Sello Azul 50 kg','Harina especial Sello Azul.','Insumos de panificación','unidad',0,false,'Valles del Pacífico','Saco de 50 kg',true,true),

   ('BEB-001','Inca Kola 3 L','Bebida gaseosa Inca Kola.','Bebidas','unidad',0,false,'Inca Kola','Botella de 3 L',true,true),
   ('BEB-002','Coca-Cola 3 L','Bebida gaseosa Coca-Cola.','Bebidas','unidad',0,false,'Coca-Cola','Botella de 3 L',true,true),
   ('BEB-003','Inca Kola 1.5 L','Bebida gaseosa Inca Kola.','Bebidas','unidad',0,false,'Inca Kola','Botella de 1.5 L',true,true),
   ('BEB-004','Coca-Cola 1.5 L','Bebida gaseosa Coca-Cola.','Bebidas','unidad',0,false,'Coca-Cola','Botella de 1.5 L',true,true)
  ) as x(codigo,nombre,descripcion,categoria,unidad,precio,precio_confirmado,marca,presentacion,perecible,requiere_lote)
 loop
  producto_existente := null;
  categoria_encontrada := null;

  select c.id into categoria_encontrada
  from public.categorias c
  where lower(btrim(c.nombre))=lower(btrim(r.categoria))
  limit 1;

  if categoria_encontrada is null then
   raise exception 'No se encontró la categoría %.',r.categoria;
  end if;

  select p.id into producto_existente
  from public.productos p
  where lower(btrim(p.codigo))=lower(btrim(r.codigo))
     or lower(btrim(p.nombre))=lower(btrim(r.nombre))
  order by case when lower(btrim(p.codigo))=lower(btrim(r.codigo)) then 0 else 1 end
  limit 1;

  if producto_existente is null then
   insert into public.productos
    (codigo,nombre,descripcion,categoria_id,unidad_medida,precio,precio_confirmado,
     marca,presentacion,estado,tipo_item,controla_inventario,es_perecible,requiere_lote)
   values
    (r.codigo,r.nombre,r.descripcion,categoria_encontrada,r.unidad,r.precio,r.precio_confirmado,
     r.marca,r.presentacion,true,'producto',true,r.perecible,r.requiere_lote);
  else
   update public.productos p
   set descripcion=coalesce(nullif(btrim(p.descripcion),''),r.descripcion),
       categoria_id=coalesce(p.categoria_id,categoria_encontrada),
       marca=coalesce(nullif(btrim(p.marca),''),r.marca),
       presentacion=coalesce(nullif(btrim(p.presentacion),''),r.presentacion),
       precio=case when coalesce(p.precio_confirmado,false)=false and r.precio_confirmado then r.precio else p.precio end,
       precio_confirmado=coalesce(p.precio_confirmado,false) or r.precio_confirmado,
       estado=true,
       tipo_item='producto',
       controla_inventario=true
   where p.id=producto_existente;
  end if;
 end loop;
end $$;

commit;

-- Resultado de verificación. Debe devolver hasta 59 productos, sin duplicarlos.
select p.codigo,p.nombre,c.nombre as categoria,p.unidad_medida,p.presentacion,
       p.precio,p.precio_confirmado,p.es_perecible,p.requiere_lote,p.estado
from public.productos p
left join public.categorias c on c.id=p.categoria_id
where p.codigo in (
 'PANCETA','CAR-002','CAR-003','CAR-004','CAR-005','CAR-006','CAR-007','CAR-008','CAR-009','CAR-010','1000T5','100400',
 'LAC-001','LAC-002','LAC-003','LAC-004','LAC-005','LAC-006','LAC-007',
 'VER-001','VER-002','VER-003','VER-004','VER-005','VER-006','VER-007','VER-008','VER-009','VER-010','VER-011','VER-012','VER-013','VER-014','VER-015','VER-016','VER-017','VER-018','VER-019','VER-020','VER-021',
 'FRU-001','FRU-002','FRU-003','FRU-004','ABA-001','ABA-002','LIM-001','LIM-002',
 '6804000','PAN-002','PAN-003','PAN-004','PAN-005','PAN-006','PAN-007',
 'BEB-001','BEB-002','BEB-003','BEB-004'
)
order by c.nombre,p.nombre;
