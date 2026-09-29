# Configuración de una sola sede

La versión actual opera únicamente con la sede de **La Liguria S.A. — Av. Arica 281**.
La estructura de Supabase conserva `sede_id` para permitir sucursales en el futuro,
pero las nuevas recepciones y movimientos no muestran destino ni permiten traslados.

## Supabase

Ejecutar `supabase/migrations/202609290010_sede_principal.sql` después de las
migraciones de módulos y catálogo. La migración crea la sede por dirección si aún
no existe y no elimina otras filas.

Verificar el resultado:

```sql
select id, nombre, direccion, responsable, estado
from public.sedes
order by id;
```

La empresa todavía debe completar el responsable en la ficha de la sede.

## Aplicación

- Movimientos nuevos: el origen se fija automáticamente en Av. Arica 281.
- Recepciones nuevas: la sede se fija automáticamente en Av. Arica 281.
- Traslado y sede de destino: no aparecen en los formularios.
- Si no existe una sede activa con esa dirección, el sistema pide configurarla y no
  guarda operaciones en una sede desconocida.
