# Lectura gratuita de facturas

La recepción tiene un botón **Analizar factura gratis (OCR)**. La lectura se
ejecuta en el navegador con Tesseract.js y no consume créditos de OpenAI. Solo
se prellenan datos que puedan reconocerse en el texto; la persona debe revisar
y confirmar proveedor, cantidades, lotes y precios antes de guardar.

Tesseract.js trabaja con imágenes JPG, PNG, WEBP y JFIF. No procesa PDF
directamente: el PDF puede guardarse como comprobante, pero para leerlo hay que
convertirlo a una imagen.

## Qué hace la lectura gratuita

- Detecta el RUC y lo compara con proveedores ya registrados.
- Detecta tipo de comprobante, serie, número y fecha cuando están legibles.
- Busca productos del catálogo dentro del texto reconocido.
- Intenta detectar moneda, subtotal, IGV, descuento y total.
- Muestra el texto leído para que el encargado pueda verificarlo.

Las cantidades facturadas y recibidas, los lotes y los precios quedan para
confirmación manual porque una lectura OCR no garantiza que una tabla se haya
interpretado correctamente.

## Configuración en Supabase

La lectura gratuita no necesita una clave de OpenAI ni una Edge Function. Solo
se necesita que el navegador tenga acceso a internet para descargar el motor y
el idioma español de Tesseract.js.

La función opcional `analizar-factura` se conserva en el proyecto para una
futura modalidad de mayor precisión con OpenAI, pero no es necesaria para el
flujo gratuito.

Si se activa esa modalidad opcional:

1. En **Edge Functions**, crea o despliega una función llamada
   `analizar-factura` usando `supabase/functions/analizar-factura/index.ts`.
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

## Prueba de la lectura gratuita

1. Abre **Recepciones → Nueva recepción**.
2. Adjunta una foto JPG, PNG, WEBP o JFIF legible.
3. Pulsa **Analizar factura gratis (OCR)**.
4. Comprueba proveedor, comprobante, fechas, totales y productos.
5. Abre **Ver texto leído por el OCR** si necesitas contrastar un dato.
6. Selecciona o crea los lotes y escribe la cantidad realmente recibida.
7. Guarda solo después de revisar los avisos mostrados.

Si un proveedor o producto no coincide exactamente con el catálogo, se deja para
selección manual. El sistema no crea registros nuevos ni inventa datos.
