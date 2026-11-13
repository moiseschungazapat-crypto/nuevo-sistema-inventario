-- Catálogo operativo transcrito de la lista entregada en noviembre de 2026.
-- No crea stock, lotes ni movimientos. No elimina ni desactiva productos anteriores.
-- Concilia únicamente por código para preservar el historial asociado al producto.
begin;

do $$
begin
 if to_regclass('public.productos') is null or to_regclass('public.categorias') is null then
  raise exception 'Primero deben existir public.productos y public.categorias.';
 end if;
end $$;

insert into public.categorias(nombre,descripcion,estado)
select x.nombre,x.descripcion,true
from (values
 ('Bebidas alcohólicas','Bebidas alcohólicas controladas por volumen.'),
 ('Envases y descartables','Envases, bolsas, utensilios y material descartable.'),
 ('Abarrotes','Alimentos secos y productos de despensa.'),
 ('Limpieza e higiene','Productos y herramientas de limpieza e higiene.'),
 ('Insumos generales','Insumos operativos de uso general.'),
 ('Harinas e insumos de panificación','Harinas, levaduras, mejoradores e insumos de panificación.'),
 ('Grasas, aceites y salsas','Aceites, grasas y salsas de cocina.'),
 ('Frutos secos','Frutos secos y productos relacionados.'),
 ('Especias, condimentos y abarrotes','Especias, condimentos y alimentos secos.'),
 ('Repostería y pastelería','Ingredientes y preparados para repostería y pastelería.'),
 ('Caldos y sazonadores','Caldos concentrados y sazonadores de cocina.'),
 ('Útiles de oficina','Papelería y materiales administrativos.')
) as x(nombre,descripcion)
where not exists (
 select 1 from public.categorias c where lower(btrim(c.nombre))=lower(btrim(x.nombre))
);

create temporary table app_catalogo_actualizado(
 codigo text primary key,
 nombre text not null,
 categoria text not null,
 unidad text not null,
 perecible boolean not null
) on commit drop;

insert into app_catalogo_actualizado(codigo,nombre,categoria,unidad,perecible) values
 ('T-063','Pisco Quebranta - Toro Santo','Bebidas alcohólicas','litro',false),
 ('T-062','Vino Blanco - Gato','Bebidas alcohólicas','litro',false),
 ('P-270','Base Redonda Con Ondas (Varios)','Envases y descartables','unidad',false),
 ('P-269','Caja De Carton Corte Corazon','Envases y descartables','unidad',false),
 ('P-268','Caja de cartón Día de la Madre','Envases y descartables','unidad',false),
 ('P-267','Envase Plastico Small Con Ondas Y Tapa Onda','Envases y descartables','unidad',false),
 ('P-266','Envase plástico small con ondas y tapa recta','Envases y descartables','unidad',false),
 ('P-265','Envase Plastico Grande Con Ondas Y Tapa Recta','Envases y descartables','unidad',false),
 ('P-264','Rollo De Empaque De Papel 7kg 50x60','Envases y descartables','unidad',false),
 ('P-263','Rollo De Empaque De Papel 12kg 50x60','Envases y descartables','unidad',false),
 ('P-262','Rollo De Empaque De Papel 17kg 50x60','Envases y descartables','unidad',false),
 ('P-261','Rollo De Empaque De Papel 12kg 50x45','Envases y descartables','unidad',false),
 ('P-260','Rollo De Empaque De Papel 10kg 50x30','Envases y descartables','unidad',false),
 ('P-259','Envase Azucar Acrilico 8 Oz','Envases y descartables','unidad',false),
 ('P-258','Envase De Plastico Redondo Con Tapa 8 Oz','Envases y descartables','unidad',false),
 ('P-257','Envase De Plastico Con Tapa Rectang 14 Oz','Envases y descartables','unidad',false),
 ('P-256','Tapa De Envase De Aluminio 28oz/1kg','Envases y descartables','unidad',false),
 ('P-255','Envase De Aluminio 28oz/1kg','Envases y descartables','unidad',false),
 ('P-254','Envase De Plastico Con Tapa Rectang 12 Oz','Envases y descartables','unidad',false),
 ('P-253','Envase De Plastico Triangular','Envases y descartables','unidad',false),
 ('P-252','Base Corazon Rojo Con Ondas Y Linea','Envases y descartables','unidad',false),
 ('P-251','Base Redonda De 35 Cm Pla Con Ondas Y Linea','Envases y descartables','unidad',false),
 ('P-250','Base Redonda De 35 Cm Dor Con Ondas Y Linea','Envases y descartables','unidad',false),
 ('P-249','Base Redonda De 30 Cm Bla. Con Ondas','Envases y descartables','unidad',false),
 ('P-248','Base Redonda De 28 Cm Dor. Con Ondas','Envases y descartables','unidad',false),
 ('P-247','Base Redonda De 32 Cm Blanco','Envases y descartables','unidad',false),
 ('P-246','Base Redonda De 30 Cm Blanco','Envases y descartables','unidad',false),
 ('P-245','Base Redonda De 28 Cm Blanco','Envases y descartables','unidad',false),
 ('P-244','Bolsa Con Asa De Papel','Envases y descartables','unidad',false),
 ('P-243','Envase redondo de aluminio con tapa XL','Envases y descartables','unidad',false),
 ('P-242','Envase redondo de aluminio con tapa L','Envases y descartables','unidad',false),
 ('P-241','Envase redondo de aluminio con tapa medium','Envases y descartables','unidad',false),
 ('P-240','Envase redondo de aluminio con tapa small','Envases y descartables','unidad',false),
 ('P-239','Film','Envases y descartables','unidad',false),
 ('P-238','Papel Manteca','Envases y descartables','unidad',false),
 ('P-237','Papel Con Pegatina','Envases y descartables','unidad',false),
 ('P-236','Bolsa De Papel Kraft 23x16 Imp Liguria','Envases y descartables','unidad',false),
 ('P-235','Bolsa De Papel Kraft #26 Imp Liguria','Envases y descartables','unidad',false),
 ('P-234','Bolsa De Papel Kraft #29 Imp Liguria','Envases y descartables','unidad',false),
 ('P-233','Bolsa De Papel Kraft #34 Imp Liguria','Envases y descartables','unidad',false),
 ('P-180','Bolsa Para Hamburguesa Con Diseño','Envases y descartables','unidad',false),
 ('P-161','Faja De Carton Pequeña','Envases y descartables','unidad',false),
 ('P-160','Bolsas Biodegradables Con Asa 21x24','Envases y descartables','unidad',false),
 ('P-159','Bolsas Biodegradables Con Asa 19x20','Envases y descartables','unidad',false),
 ('P-158','Bolsas Biodegradables Con Asa 16x19','Envases y descartables','unidad',false),
 ('P-157','Rollo De Papel Aluminio 75x12','Envases y descartables','unidad',false),
 ('P-156','Bolsas Polipropileno 8x12','Envases y descartables','unidad',false),
 ('P-155','Bolsas Polipropileno 9x14','Envases y descartables','unidad',false),
 ('P-154','Bolsas Polipropileno 10x15','Envases y descartables','unidad',false),
 ('P-153','Bolsas Polipropileno 7x10','Envases y descartables','unidad',false),
 ('P-152','Bolsas Polipropileno 14x20','Envases y descartables','unidad',false),
 ('P-151','Bolsas Polipropileno 8x20','Envases y descartables','unidad',false),
 ('P-150','Bolsas Polipropileno 5x10','Envases y descartables','unidad',false),
 ('P-149','Bolsas Polipropileno 9x20','Envases y descartables','unidad',false),
 ('P-148','Bolsas Polipropileno 11x22','Envases y descartables','unidad',false),
 ('P-147','Bolsas Desglosables 10x15','Envases y descartables','unidad',false),
 ('P-146','Bolsas Desglosables 14x20','Envases y descartables','unidad',false),
 ('P-145','Bolsas Desglosables 8x12','Envases y descartables','unidad',false),
 ('P-135','Pabilo #8','Envases y descartables','unidad',false),
 ('P-134','Pabilo #10','Envases y descartables','unidad',false),
 ('P-133','Botella De Plastico 1lt','Envases y descartables','unidad',false),
 ('P-132','Botella De Plastico 500ml','Envases y descartables','unidad',false),
 ('P-131','Plato Bandeja Con Tapa Ct5','Envases y descartables','unidad',false),
 ('P-130','Plato Bandeja Con Tapa Cr3','Envases y descartables','unidad',false),
 ('P-129','Tapa Envase Blanco 6 8 12.5 Oz','Envases y descartables','unidad',false),
 ('P-128','Envase Blanco 8 Oz','Envases y descartables','unidad',false),
 ('P-127','Poligrasa','Envases y descartables','unidad',false),
 ('P-126','Plato Bandeja Pb2','Envases y descartables','unidad',false),
 ('P-125','Plato Redondo 15','Envases y descartables','unidad',false),
 ('P-124','Plato bandeja PF 17','Envases y descartables','unidad',false),
 ('P-121','Bolsa Para Hamburguesa Con Diseño','Envases y descartables','unidad',false),
 ('P-120','Bolsa Para Hamburguesa','Envases y descartables','unidad',false),
 ('P-119','Tenedores De Postre Blanca 5','Envases y descartables','unidad',false),
 ('P-118','Cuchara De Postre Blanca 5','Envases y descartables','unidad',false),
 ('P-117','Cucharas mini transparentes','Envases y descartables','unidad',false),
 ('P-116','Cucharas Small Transparentes','Envases y descartables','unidad',false),
 ('P-115','Tapa Ajicero 2 Oz','Envases y descartables','unidad',false),
 ('P-114','Tapa Ajicero 1 Oz','Envases y descartables','unidad',false),
 ('P-113','Ajicero Descartable 2 Oz','Envases y descartables','unidad',false),
 ('P-112','Ajicero Descartable 1 Oz','Envases y descartables','unidad',false),
 ('P-111','Brochetas De Bambu 15cm','Envases y descartables','unidad',false),
 ('P-110','Tapa Vaso Carton Cafe 10 Oz','Envases y descartables','unidad',false),
 ('P-109','Tapa Vaso Carton Jugo 12 Oz','Envases y descartables','unidad',false),
 ('P-108','Tapa De Vaso 12 Oz','Envases y descartables','unidad',false),
 ('P-107','Vaso Carton Para Cafe 10 Oz','Envases y descartables','unidad',false),
 ('P-106','Vaso Carton Para Jugo 12 Oz','Envases y descartables','unidad',false),
 ('P-105','Vaso De Plastico 6.5 Oz','Envases y descartables','unidad',false),
 ('P-104','Vaso De Plastico 12 Oz','Envases y descartables','unidad',false),
 ('P-103','Vaso De Plastico 3 Oz','Envases y descartables','unidad',false),
 ('P-102','Vaso Acrilico 5 Oz','Envases y descartables','unidad',false),
 ('P-101','Vaso Acrilico 1 Oz','Envases y descartables','unidad',false),
 ('P-100','Removedor','Envases y descartables','unidad',false),
 ('P-099','Monta Dientes','Envases y descartables','unidad',false),
 ('O-083','Leche - Gloria','Abarrotes','litro',true),
 ('O-082','Leche Cremosita - Ideal','Abarrotes','litro',true),
 ('O-080','Filtrante De Anis - Mccolins','Abarrotes','unidad',true),
 ('O-079','Filtrante De Te Canela Y Clavo - Mccolins','Abarrotes','unidad',true),
 ('O-078','Filtrante De Te Puro - Mccolins','Abarrotes','unidad',true),
 ('O-077','Filtrante De Manzanilla - Mccolins','Abarrotes','unidad',true),
 ('O-075','Pasta Corta - Molitalia','Abarrotes','kg',true),
 ('O-074','Spaguetti - Molitalia','Abarrotes','kg',true),
 ('O-066','Sillao - Kikko','Abarrotes','litro',true),
 ('O-055','Arroz','Abarrotes','kg',true),
 ('L-222','Botador de agua','Limpieza e higiene','unidad',false),
 ('L-221','Palo De Limpieza','Limpieza e higiene','unidad',false),
 ('L-220','Palo de escoba pequeño','Limpieza e higiene','unidad',false),
 ('L-219','Palo De Escoba Grande','Limpieza e higiene','unidad',false),
 ('L-216','Detergente - Sapolio','Limpieza e higiene','litro',false),
 ('L-215','Soga De Plastico','Limpieza e higiene','unidad',false),
 ('L-214','Envase Liquido Limpieza 500ml','Limpieza e higiene','litro',false),
 ('L-213','Envase Liquido Limpieza 1 Lt','Limpieza e higiene','litro',false),
 ('L-212','Hisopo Baño','Limpieza e higiene','unidad',false),
 ('L-211','Papel Higienico','Limpieza e higiene','unidad',false),
 ('L-210','Chisguete Cabeza','Limpieza e higiene','unidad',false),
 ('L-209','Cera Auto Brillante','Limpieza e higiene','litro',false),
 ('L-208','Quita Sarro - Wine','Limpieza e higiene','litro',false),
 ('L-207','Removedor De Sarro - Daryza','Limpieza e higiene','litro',false),
 ('L-206','Desengrasante - Daryza','Limpieza e higiene','litro',false),
 ('L-205','Desinfectante Pino - Daryza','Limpieza e higiene','litro',false),
 ('L-204','Esponja Alambrada','Limpieza e higiene','unidad',false),
 ('L-203','Esponja De Acero','Limpieza e higiene','unidad',false),
 ('L-202','Trapo','Limpieza e higiene','unidad',false),
 ('L-201','Trapeador','Limpieza e higiene','unidad',false),
 ('L-200','Escobillon','Limpieza e higiene','unidad',false),
 ('L-199','Escoba','Limpieza e higiene','unidad',false),
 ('L-198','Guante Transparente M','Limpieza e higiene','unidad',false),
 ('L-197','Guante Azul M','Limpieza e higiene','unidad',false),
 ('L-196','Guante Negro M','Limpieza e higiene','unidad',false),
 ('L-195','Mascarilla','Limpieza e higiene','unidad',false),
 ('L-194','Saca Grasa','Limpieza e higiene','litro',false),
 ('L-193','Lavavajillas','Limpieza e higiene','litro',false),
 ('L-192','Paño Absorbente','Limpieza e higiene','unidad',false),
 ('L-191','Escoba Mini','Limpieza e higiene','unidad',false),
 ('L-190','Alcohol 70','Limpieza e higiene','litro',false),
 ('L-189','Glade','Limpieza e higiene','litro',false),
 ('L-188','Limpia Vidrios - Sapolio','Limpieza e higiene','litro',false),
 ('L-187','Limpia Vidrios - Daryza','Limpieza e higiene','litro',false),
 ('L-186','Limpia Vidrios - Daryza','Limpieza e higiene','litro',false),
 ('L-185','Desinfectante - Daryza','Limpieza e higiene','litro',false),
 ('L-184','Desinfectante - Daryza','Limpieza e higiene','litro',false),
 ('L-183','Jabon Liquido - Daryza','Limpieza e higiene','litro',false),
 ('L-182','Aromatizante Coco - Sapolio','Limpieza e higiene','litro',false),
 ('L-181','Papel Toalla - Nova','Limpieza e higiene','unidad',false),
 ('L-041','Bicarbonato De Sodio - Fratello','Limpieza e higiene','kg',false),
 ('I-218','Fosforo','Insumos generales','unidad',false),
 ('I-217','Foco 100wtt','Insumos generales','unidad',false),
 ('H-232','Semola - Molino Del Triunfo','Harinas e insumos de panificación','kg',true),
 ('H-231','Harina De Trigo Integral - Benoti','Harinas e insumos de panificación','kg',true),
 ('H-228','Salvado de trigo','Harinas e insumos de panificación','kg',true),
 ('H-226','Harina De Trigo Especial - Nicolini','Harinas e insumos de panificación','kg',true),
 ('H-225','Harina De Trigo Especial - Inca','Harinas e insumos de panificación','kg',true),
 ('H-224','Harina De Trigo Especial - Benoti','Harinas e insumos de panificación','kg',true),
 ('H-223','Harina De Trigo Especial - El Molino','Harinas e insumos de panificación','kg',true),
 ('H-071','Mixo - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-067','Sponge','Harinas e insumos de panificación','kg',true),
 ('H-061','Levadura - Instant Success','Harinas e insumos de panificación','kg',true),
 ('H-056','Maicena','Harinas e insumos de panificación','kg',true),
 ('H-054','Salvado De Trigo','Harinas e insumos de panificación','kg',true),
 ('H-053','Leche En Polvo','Harinas e insumos de panificación','kg',true),
 ('H-047','Mejorador Con Masa Madre - Pulso','Harinas e insumos de panificación','kg',true),
 ('H-046','Masa Madre - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-045','Mohopan - Fratello','Harinas e insumos de panificación','kg',true),
 ('H-042','Cremor Tartaro - Fratello','Harinas e insumos de panificación','kg',true),
 ('H-035','Premezcla Bollitos De Queso - Fleischman','Harinas e insumos de panificación','kg',true),
 ('H-034','Premezcla en polvo palitos turrón - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-033','Premezcla En Polvo Ciabatta - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-028','Polvo De Hornear 1kg - Fleischman','Harinas e insumos de panificación','kg',true),
 ('H-027','Polvo De Hornear 5kg - Fleischmann','Harinas e insumos de panificación','kg',true),
 ('H-024','Gluten De Trigo En Polvo - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-022','Puralix - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-020','Mejorador Softdrain Multigranos - Puratos','Harinas e insumos de panificación','kg',true),
 ('H-001','Chuño - Santis','Harinas e insumos de panificación','kg',true),
 ('G-092','Mimetic - Puratos','Grasas, aceites y salsas','kg',true),
 ('G-091','Multiusos - Primavera','Grasas, aceites y salsas','kg',true),
 ('G-090','Hojaldre - Primavera','Grasas, aceites y salsas','kg',true),
 ('G-089','Manteca - Famosa','Grasas, aceites y salsas','kg',true),
 ('G-065','Aceite - Cil','Grasas, aceites y salsas','litro',true),
 ('G-064','Aceite - Tondero','Grasas, aceites y salsas','litro',true),
 ('G-019','Aceite - Cil','Grasas, aceites y salsas','litro',true),
 ('G-017','Mayonesa En Sachets','Grasas, aceites y salsas','unidad',true),
 ('G-016','Mayonesa Base','Grasas, aceites y salsas','litro',true),
 ('G-015','Mostaza','Grasas, aceites y salsas','litro',true),
 ('G-014','Ketchup','Grasas, aceites y salsas','litro',true),
 ('F-123','Pecana Tapa - Almore','Frutos secos','kg',true),
 ('F-122','Nuez Pelada - Almore','Frutos secos','kg',true),
 ('F-093','Pasas - Santis Frut','Frutos secos','kg',true),
 ('F-073','Castaña Partida Pelada - Almore','Frutos secos','kg',true),
 ('E-230','Arroz - Pacasmayo','Especias, condimentos y abarrotes','kg',true),
 ('E-229','Sal - Marina','Especias, condimentos y abarrotes','kg',true),
 ('E-098','Maggi De Carne','Especias, condimentos y abarrotes','kg',true),
 ('E-036','Premezcla para tres leches - Fleischmann','Especias, condimentos y abarrotes','kg',true),
 ('E-032','Ajinomoto','Especias, condimentos y abarrotes','kg',true),
 ('E-013','Pimienta Negra Molida','Especias, condimentos y abarrotes','kg',true),
 ('E-012','Comino Molido','Especias, condimentos y abarrotes','kg',true),
 ('E-011','Comino Entero','Especias, condimentos y abarrotes','kg',true),
 ('E-010','Palillo','Especias, condimentos y abarrotes','kg',true),
 ('E-009','Achiote Molido','Especias, condimentos y abarrotes','kg',true),
 ('E-008','Achiote Entero','Especias, condimentos y abarrotes','kg',true),
 ('E-007','Anis En Grano','Especias, condimentos y abarrotes','kg',true),
 ('E-006','Romero','Especias, condimentos y abarrotes','kg',true),
 ('E-005','Oregano','Especias, condimentos y abarrotes','kg',true),
 ('E-004','Clavo De Olor','Especias, condimentos y abarrotes','kg',true),
 ('E-003','Canela Entera','Especias, condimentos y abarrotes','kg',true),
 ('E-002','Canela Molida','Especias, condimentos y abarrotes','kg',true),
 ('D-227','Azucar Blanca - Cartavio','Repostería y pastelería','kg',true),
 ('D-144','Master Gourmet Gold - Master Martini','Repostería y pastelería','kg',true),
 ('D-143','Crema Sabor A Chantilly - Fleiscream','Repostería y pastelería','kg',true),
 ('D-142','Dulcerio Remojo Tres Leches - Puratos','Repostería y pastelería','kg',true),
 ('D-141','Ambiante - Puratos','Repostería y pastelería','kg',true),
 ('D-140','Passionata - Puratos','Repostería y pastelería','kg',true),
 ('D-139','Esencia De Frambuesa','Repostería y pastelería','kg',true),
 ('D-138','Esencia De Maracuya','Repostería y pastelería','kg',true),
 ('D-137','Cobertura De Frutos Rojos','Repostería y pastelería','kg',true),
 ('D-136','Gotas Sabor Chocolate - Lesafre','Repostería y pastelería','kg',true),
 ('D-096','Premezcla Para Crema Pastelera - Puratos','Repostería y pastelería','kg',true),
 ('D-095','Nucleo De Paneton - Inventis','Repostería y pastelería','kg',true),
 ('D-094','Cobertura De Chocolate - Puratos','Repostería y pastelería','kg',true),
 ('D-088','Ajonjoli','Repostería y pastelería','kg',true),
 ('D-087','Azucar Blanca','Repostería y pastelería','kg',true),
 ('D-086','Azucar Blanca','Repostería y pastelería','kg',true),
 ('D-085','Azucar Rubia - San Jacinto','Repostería y pastelería','kg',true),
 ('D-084','Azucar Rubia - 5 Estrellas','Repostería y pastelería','kg',true),
 ('D-081','Cocoa Alcalina - Negusa','Repostería y pastelería','kg',true),
 ('D-076','Chocolate Instantaneo En Polvo - Sol Del Cuzco','Repostería y pastelería','kg',true),
 ('D-072','Neutro Mirror - Puratos','Repostería y pastelería','kg',true),
 ('D-070','Mermelada De Fresa','Repostería y pastelería','kg',true),
 ('D-069','Mermelada De Sauco','Repostería y pastelería','kg',true),
 ('D-068','Trufa de avellana - Bakels','Repostería y pastelería','kg',true),
 ('D-060','Cerezas - Santis','Repostería y pastelería','kg',true),
 ('D-059','Galleta De Vainilla - San Jorge','Repostería y pastelería','kg',true),
 ('D-058','Chocolate Blanco - Romex','Repostería y pastelería','kg',true),
 ('D-057','Fruta Confitada - Frutilex','Repostería y pastelería','kg',true),
 ('D-052','Azucar Impalpable - Umsha','Repostería y pastelería','kg',true),
 ('D-051','Flan - Universal','Repostería y pastelería','kg',true),
 ('D-050','Gelatina De Piña - Universal','Repostería y pastelería','kg',true),
 ('D-049','Gelatina De Fresa - Universal','Repostería y pastelería','kg',true),
 ('D-048','Esencia De Vainilla - Umsha','Repostería y pastelería','kg',true),
 ('D-044','Colorante amarillo limón - Fratello','Repostería y pastelería','kg',true),
 ('D-043','Colapiz En Polvo - Fratello','Repostería y pastelería','kg',true),
 ('D-040','Esencia para panetón - Fratello','Repostería y pastelería','kg',true),
 ('D-039','Esencia De Naranja - Fratello','Repostería y pastelería','kg',true),
 ('D-038','Caramelina - Almore','Repostería y pastelería','kg',true),
 ('D-037','Mezcla en polvo milhoja de tres leches - Bakels','Repostería y pastelería','kg',true),
 ('D-031','Coco Rayado','Repostería y pastelería','kg',true),
 ('D-030','Premezcla en polvo para chifón - Bakels','Repostería y pastelería','kg',true),
 ('D-029','Mezcla En Polvo Para Brownie - Bakels','Repostería y pastelería','kg',true),
 ('D-026','Mezcla Para Torta Chocolate - Fleischmann','Repostería y pastelería','kg',true),
 ('D-025','Crema Pastelera 4x4 - Puratos','Repostería y pastelería','kg',true),
 ('D-023','Fudge - Leite','Repostería y pastelería','kg',true),
 ('D-021','Manjar Especial - Leite','Repostería y pastelería','kg',true),
 ('D-018','Splenda','Repostería y pastelería','kg',true),
 ('C-097','Maggi De Gallina','Caldos y sazonadores','kg',true),
 ('A-179','Hoja Bond A4','Útiles de oficina','unidad',false),
 ('A-178','Sobre Manila A4','Útiles de oficina','unidad',false),
 ('A-177','Folder Manila A4','Útiles de oficina','unidad',false),
 ('A-176','Sobre Manila 11x18','Útiles de oficina','unidad',false),
 ('A-175','Sticker Precio','Útiles de oficina','unidad',false),
 ('A-174','Corrector','Útiles de oficina','unidad',false),
 ('A-173','Lapicero Azul','Útiles de oficina','unidad',false),
 ('A-172','Saca Grapas','Útiles de oficina','unidad',false),
 ('A-171','Grapas','Útiles de oficina','unidad',false),
 ('A-170','Resaltador Naranja','Útiles de oficina','unidad',false),
 ('A-169','Resaltador Amarillo','Útiles de oficina','unidad',false),
 ('A-168','Plumon Para Pizarra Rojo','Útiles de oficina','unidad',false),
 ('A-167','Plumón jumbo negro','Útiles de oficina','unidad',false),
 ('A-166','Ligas','Útiles de oficina','unidad',false),
 ('A-165','Caratula De Pasta','Útiles de oficina','unidad',false),
 ('A-164','Cinta De Embalaje','Útiles de oficina','unidad',false),
 ('A-163','Cinta Scotch Pequeña','Útiles de oficina','unidad',false),
 ('A-162','Cinta Scotch Delgada','Útiles de oficina','unidad',false);

do $$
declare
 r record;
 producto_existente public.productos.id%type;
 categoria_encontrada public.categorias.id%type;
 puede_cambiar_unidad boolean;
begin
 for r in select * from app_catalogo_actualizado order by codigo loop
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
  limit 1;

  if producto_existente is null then
   insert into public.productos(
    codigo,nombre,descripcion,categoria_id,unidad_medida,precio,precio_confirmado,
    estado,tipo_item,controla_inventario,es_perecible,requiere_lote
   ) values (
    r.codigo,r.nombre,'Catálogo operativo actualizado en noviembre de 2026.',categoria_encontrada,r.unidad,0,false,
    true,'producto',true,r.perecible,true
   );
  else
   select not exists(select 1 from public.movimientos m where m.producto_id=producto_existente)
      and not exists(select 1 from public.recepcion_detalles d where d.producto_id=producto_existente)
      and not exists(select 1 from public.inventario i where i.producto_id=producto_existente)
   into puede_cambiar_unidad;

   update public.productos p
   set nombre=r.nombre,
       categoria_id=categoria_encontrada,
       unidad_medida=case when puede_cambiar_unidad then r.unidad else p.unidad_medida end,
       estado=true,
       tipo_item='producto',
       controla_inventario=true,
       es_perecible=r.perecible,
       requiere_lote=true
   where p.id=producto_existente;
  end if;
 end loop;
end $$;

-- Verificación: debe devolver 270 filas y no modifica las existencias.
select p.codigo,p.nombre,c.nombre categoria,p.unidad_medida,p.es_perecible,p.estado
from public.productos p
join public.categorias c on c.id=p.categoria_id
where lower(btrim(p.codigo)) in (select lower(btrim(codigo)) from app_catalogo_actualizado)
order by p.codigo;

commit;

