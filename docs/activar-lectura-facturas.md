# Activar lectura automática de facturas

La recepción tiene un botón "Analizar factura automáticamente". La función
prellena datos visibles de una foto o PDF, pero no guarda la recepción ni decide
la cantidad recibida: la persona debe revisar y confirmar.

## Configuración en Supabase

1. En **Edge Functions**, crea o despliega una función llamada
   analizar-factura usando
   supabase/functions/analizar-factura/index.ts.
2. En los secretos de la función agrega:

   - OPENAI_API_KEY: clave de la API del proveedor de inteligencia.
   - OPENAI_MODEL: opcional; si se omite usa gpt-4.1-mini.

3. Si la función no tiene disponibles las claves automáticas de Supabase,
   agrega también la clave secreta de servidor compatible con tu proyecto
   (SUPABASE_SERVICE_ROLE_KEY). Nunca la coloques en js/ ni en Vercel como
   variable pública.
4. Verifica que exista el bucket privado documentos-recepcion.
5. Publica la función y vuelve a desplegar el sitio.

Con CLI:

~~~sh
supabase functions deploy analizar-factura
supabase secrets set OPENAI_API_KEY=tu_clave
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
~~~

La clave solo la lee la Edge Function. El navegador llama a la función con la
sesión del usuario y recibe únicamente los datos extraídos.

## Prueba recomendada

1. Abre **Recepciones → Nueva recepción**.
2. Adjunta una factura legible.
3. Pulsa **Analizar factura automáticamente**.
4. Comprueba proveedor, comprobante, fechas, totales y productos.
5. Selecciona o crea los lotes y escribe la cantidad realmente recibida.
6. Guarda solo después de revisar los avisos mostrados.

Si un proveedor o producto no coincide exactamente con el catálogo, se deja para
selección manual. El sistema no crea registros nuevos ni inventa datos.
