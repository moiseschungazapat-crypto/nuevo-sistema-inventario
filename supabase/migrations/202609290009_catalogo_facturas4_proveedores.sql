-- Datos verificables de Facturas 4.
-- Esta migración solo incorpora proveedores con razón social y RUC legibles.
-- No crea productos: las facturas no contienen un SKU interno confirmado,
-- una unidad base uniforme ni una conversión de presentación para cada artículo.
-- Ejecutar después de 202609150008_depuracion_catalogo.sql.
begin;

do $$
begin
  if to_regclass('public.proveedores') is null then
    raise exception 'No existe public.proveedores. Ejecuta primero las migraciones del catálogo.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='proveedores' and column_name in ('nombre','documento','estado')
    group by table_name having count(*)=3
  ) then
    raise exception 'public.proveedores no tiene las columnas requeridas (nombre, documento, estado).';
  end if;
end $$;

-- Braedt ya tenía este RUC confirmado en el catálogo anterior. Solo se completa
-- el registro con el nombre exacto; no se fusiona con nombres parecidos.
update public.proveedores
set documento='20100067910', version=coalesce(version,1)+1
where lower(btrim(nombre))='braedt s.a.'
  and nullif(btrim(coalesce(documento,'')),'') is null;

-- Proveedores identificados en Facturas 4. La comparación por documento evita
-- duplicarlos si ya fueron creados manualmente con otra escritura del nombre.
insert into public.proveedores (nombre,documento,estado)
select x.nombre,x.documento,true
from (values
  ('Calsa Perú S.A.C.','20504963927'),
  ('Diseylac E.I.R.L.','20506274037'),
  ('Oliveza S.A.C.','20513203871'),
  ('Valles del Pacífico S.A.C.','20517562239'),
  ('Comercializadora Megumi S.A.C.','20604955204'),
  ('Distribuidora Villegas NYP E.I.R.L.','20451704118'),
  ('MRV Foodstuff S.A.C.','20612005215')
) as x(nombre,documento)
where not exists (
  select 1 from public.proveedores p
  where regexp_replace(coalesce(p.documento,''),'[^0-9]','','g')=x.documento
     or lower(btrim(p.nombre))=lower(btrim(x.nombre))
);

commit;
