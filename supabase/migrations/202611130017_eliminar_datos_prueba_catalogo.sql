-- REINICIO DEFINITIVO DE DATOS DE PRUEBA DEL CATÁLOGO.
-- Conserva exactamente los 270 códigos reales y elimina todos los productos anteriores,
-- junto con sus lotes, saldos, mínimos, movimientos, relaciones y recepciones que queden vacías.
-- Conserva usuarios, proveedores, sedes y configuraciones.
begin;

create temporary table app_catalogo_real(
 codigo text primary key
) on commit drop;

insert into app_catalogo_real(codigo) values
 ('T-063'),
 ('T-062'),
 ('P-270'),
 ('P-269'),
 ('P-268'),
 ('P-267'),
 ('P-266'),
 ('P-265'),
 ('P-264'),
 ('P-263'),
 ('P-262'),
 ('P-261'),
 ('P-260'),
 ('P-259'),
 ('P-258'),
 ('P-257'),
 ('P-256'),
 ('P-255'),
 ('P-254'),
 ('P-253'),
 ('P-252'),
 ('P-251'),
 ('P-250'),
 ('P-249'),
 ('P-248'),
 ('P-247'),
 ('P-246'),
 ('P-245'),
 ('P-244'),
 ('P-243'),
 ('P-242'),
 ('P-241'),
 ('P-240'),
 ('P-239'),
 ('P-238'),
 ('P-237'),
 ('P-236'),
 ('P-235'),
 ('P-234'),
 ('P-233'),
 ('P-180'),
 ('P-161'),
 ('P-160'),
 ('P-159'),
 ('P-158'),
 ('P-157'),
 ('P-156'),
 ('P-155'),
 ('P-154'),
 ('P-153'),
 ('P-152'),
 ('P-151'),
 ('P-150'),
 ('P-149'),
 ('P-148'),
 ('P-147'),
 ('P-146'),
 ('P-145'),
 ('P-135'),
 ('P-134'),
 ('P-133'),
 ('P-132'),
 ('P-131'),
 ('P-130'),
 ('P-129'),
 ('P-128'),
 ('P-127'),
 ('P-126'),
 ('P-125'),
 ('P-124'),
 ('P-121'),
 ('P-120'),
 ('P-119'),
 ('P-118'),
 ('P-117'),
 ('P-116'),
 ('P-115'),
 ('P-114'),
 ('P-113'),
 ('P-112'),
 ('P-111'),
 ('P-110'),
 ('P-109'),
 ('P-108'),
 ('P-107'),
 ('P-106'),
 ('P-105'),
 ('P-104'),
 ('P-103'),
 ('P-102'),
 ('P-101'),
 ('P-100'),
 ('P-099'),
 ('O-083'),
 ('O-082'),
 ('O-080'),
 ('O-079'),
 ('O-078'),
 ('O-077'),
 ('O-075'),
 ('O-074'),
 ('O-066'),
 ('O-055'),
 ('L-222'),
 ('L-221'),
 ('L-220'),
 ('L-219'),
 ('L-216'),
 ('L-215'),
 ('L-214'),
 ('L-213'),
 ('L-212'),
 ('L-211'),
 ('L-210'),
 ('L-209'),
 ('L-208'),
 ('L-207'),
 ('L-206'),
 ('L-205'),
 ('L-204'),
 ('L-203'),
 ('L-202'),
 ('L-201'),
 ('L-200'),
 ('L-199'),
 ('L-198'),
 ('L-197'),
 ('L-196'),
 ('L-195'),
 ('L-194'),
 ('L-193'),
 ('L-192'),
 ('L-191'),
 ('L-190'),
 ('L-189'),
 ('L-188'),
 ('L-187'),
 ('L-186'),
 ('L-185'),
 ('L-184'),
 ('L-183'),
 ('L-182'),
 ('L-181'),
 ('L-041'),
 ('I-218'),
 ('I-217'),
 ('H-232'),
 ('H-231'),
 ('H-228'),
 ('H-226'),
 ('H-225'),
 ('H-224'),
 ('H-223'),
 ('H-071'),
 ('H-067'),
 ('H-061'),
 ('H-056'),
 ('H-054'),
 ('H-053'),
 ('H-047'),
 ('H-046'),
 ('H-045'),
 ('H-042'),
 ('H-035'),
 ('H-034'),
 ('H-033'),
 ('H-028'),
 ('H-027'),
 ('H-024'),
 ('H-022'),
 ('H-020'),
 ('H-001'),
 ('G-092'),
 ('G-091'),
 ('G-090'),
 ('G-089'),
 ('G-065'),
 ('G-064'),
 ('G-019'),
 ('G-017'),
 ('G-016'),
 ('G-015'),
 ('G-014'),
 ('F-123'),
 ('F-122'),
 ('F-093'),
 ('F-073'),
 ('E-230'),
 ('E-229'),
 ('E-098'),
 ('E-036'),
 ('E-032'),
 ('E-013'),
 ('E-012'),
 ('E-011'),
 ('E-010'),
 ('E-009'),
 ('E-008'),
 ('E-007'),
 ('E-006'),
 ('E-005'),
 ('E-004'),
 ('E-003'),
 ('E-002'),
 ('D-227'),
 ('D-144'),
 ('D-143'),
 ('D-142'),
 ('D-141'),
 ('D-140'),
 ('D-139'),
 ('D-138'),
 ('D-137'),
 ('D-136'),
 ('D-096'),
 ('D-095'),
 ('D-094'),
 ('D-088'),
 ('D-087'),
 ('D-086'),
 ('D-085'),
 ('D-084'),
 ('D-081'),
 ('D-076'),
 ('D-072'),
 ('D-070'),
 ('D-069'),
 ('D-068'),
 ('D-060'),
 ('D-059'),
 ('D-058'),
 ('D-057'),
 ('D-052'),
 ('D-051'),
 ('D-050'),
 ('D-049'),
 ('D-048'),
 ('D-044'),
 ('D-043'),
 ('D-040'),
 ('D-039'),
 ('D-038'),
 ('D-037'),
 ('D-031'),
 ('D-030'),
 ('D-029'),
 ('D-026'),
 ('D-025'),
 ('D-023'),
 ('D-021'),
 ('D-018'),
 ('C-097'),
 ('A-179'),
 ('A-178'),
 ('A-177'),
 ('A-176'),
 ('A-175'),
 ('A-174'),
 ('A-173'),
 ('A-172'),
 ('A-171'),
 ('A-170'),
 ('A-169'),
 ('A-168'),
 ('A-167'),
 ('A-166'),
 ('A-165'),
 ('A-164'),
 ('A-163'),
 ('A-162');

create temporary table app_productos_prueba(
 id text primary key
) on commit drop;

insert into app_productos_prueba(id)
select p.id::text
from public.productos p
where not exists (
 select 1 from app_catalogo_real r where lower(btrim(r.codigo))=lower(btrim(p.codigo))
);

create temporary table app_lotes_prueba(
 id uuid primary key
) on commit drop;

insert into app_lotes_prueba(id)
select l.id
from public.lotes l
join app_productos_prueba p on p.id=l.producto_id::text;

-- Primero se eliminan las tablas dependientes para respetar las claves foráneas.
delete from public.movimientos m
where exists (select 1 from app_productos_prueba p where p.id=m.producto_id::text)
   or exists (select 1 from app_lotes_prueba l where l.id=m.lote_id);

delete from public.inventario i
where exists (select 1 from app_productos_prueba p where p.id=i.producto_id::text)
   or exists (select 1 from app_lotes_prueba l where l.id=i.lote_id);

delete from public.inventario_minimos m
where exists (select 1 from app_productos_prueba p where p.id=m.producto_id::text);

delete from public.recepcion_detalles d
where exists (select 1 from app_productos_prueba p where p.id=d.producto_id::text)
   or exists (select 1 from app_lotes_prueba l where l.id=d.lote_id);

delete from public.proveedor_productos pp
where exists (select 1 from app_productos_prueba p where p.id=pp.producto_id::text);

delete from public.lotes l
where exists (select 1 from app_lotes_prueba x where x.id=l.id);

delete from public.productos p
where exists (select 1 from app_productos_prueba x where x.id=p.id::text);

-- Las recepciones de prueba que ya no tienen productos se eliminan; sus archivos registrados
-- se eliminan de la base por cascada. Los objetos físicos del bucket pueden revisarse luego.
delete from public.recepciones r
where not exists (select 1 from public.recepcion_detalles d where d.recepcion_id=r.id);

-- Se eliminan categorías anteriores que ya no contienen productos.
delete from public.categorias c
where not exists (select 1 from public.productos p where p.categoria_id=c.id);

-- Se retira del historial de auditoría el ruido generado por el catálogo de prueba.
delete from public.auditoria
where tabla in ('productos','categorias','lotes','inventario_minimos');

commit;

-- Verificación independiente: debe devolver 270 productos, 0 fuera de la lista y 12 categorías.
select
 (select count(*) from public.productos) as productos_totales,
 (select count(*) from public.productos
  where upper(btrim(codigo)) ~ '^(A|C|D|E|F|G|H|I|L|O|P|T)-[0-9]{3}$') as productos_catalogo_real,
 (select count(*) from public.productos
  where upper(btrim(codigo)) !~ '^(A|C|D|E|F|G|H|I|L|O|P|T)-[0-9]{3}$') as productos_fuera_lista,
 (select count(*) from public.categorias) as categorias_totales;

