# Actualización del catálogo operativo

La migración `202611130015_catalogo_operativo_actualizado.sql` incorpora los 270 códigos transcritos de la lista entregada en noviembre de 2026.

## Criterios aplicados

- Ingredientes sólidos y en polvo: `kg`.
- Líquidos: `litro`.
- Envases, descartables, útiles, herramientas y equipos: `unidad`.
- La conciliación se realiza por código, no por nombre.
- No se crean existencias, lotes, recepciones ni movimientos.
- No se eliminan ni desactivan los productos anteriores.
- Si un código ya tiene actividad histórica, su unidad actual se conserva para no alterar movimientos anteriores.

## Antes de ejecutar

1. Revisa `outputs/catalogo-actualizado/catalogo_actualizado_revision.xlsx`.
2. Confirma los registros marcados como posibles duplicados o correcciones de nombre.
3. Decide posteriormente cuáles productos antiguos deben quedar inactivos. No deben borrarse porque conservan el historial.

## Aplicación en Supabase

1. Abre el proyecto correcto en Supabase.
2. Entra a **SQL Editor**.
3. Copia el contenido completo de `supabase/migrations/202611130015_catalogo_operativo_actualizado.sql`.
4. Ejecuta el script una sola vez. Es repetible: una segunda ejecución actualiza los mismos códigos sin duplicarlos.
5. Comprueba que la consulta final devuelva 270 productos.

La migración usa una transacción. Si ocurre un error antes del `commit`, no se aplican cambios parciales.

## Retirar el catálogo anterior

Después de comprobar que los 270 códigos nuevos están cargados, ejecuta
`supabase/migrations/202611130016_retirar_productos_fuera_catalogo.sql`.

Esta segunda migración deja únicamente la lista nueva como catálogo activo:

- Borra físicamente los productos anteriores que nunca fueron utilizados.
- Los productos relacionados con lotes, existencias, recepciones o movimientos quedan inactivos y dejan de aparecer en el catálogo activo.
- No elimina movimientos, recepciones ni trazabilidad histórica.
- La consulta final debe mostrar `catalogo_nuevo_activo = 270` y `fuera_lista_activos = 0`.

## Reinicio definitivo de los datos de prueba

Cuando se confirma que todo el catálogo y las operaciones anteriores eran pruebas, se puede ejecutar
`supabase/migrations/202611130017_eliminar_datos_prueba_catalogo.sql`.

Esta operación es destructiva y no debe utilizarse después de comenzar la operación real. Elimina los
productos que no pertenecen a la lista nueva y también sus lotes, existencias, mínimos, movimientos,
relaciones con proveedores y líneas de recepción. Elimina las recepciones que queden vacías y las
categorías sin productos. Conserva usuarios, proveedores, sedes y los 270 códigos reales.

La verificación final debe mostrar:

- `productos_totales = 270`
- `productos_catalogo_real = 270`
- `productos_fuera_lista = 0`
- `categorias_totales = 12`
