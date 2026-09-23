# Análisis de Facturas 4

Revisión visual de las imágenes de `C:\Users\User\Documents\Facturas 4`. Los datos que no se leen con seguridad se dejan como **por confirmar**; no deben cargarse como maestros ni como existencias hasta validarlos con la factura original o con la empresa.

## Datos útiles para el inventario

### Proveedores nuevos o que deben conciliarse

| Proveedor visible | Documento visible | Qué falta confirmar |
|---|---|---|
| Avícola A? / proveedor de pollo (el encabezado muestra `RUC 10470064141`) | RUC 10470064141 | Razón social legal exacta y dirección; el logo/nombre está parcialmente cortado. |
| Calsa Perú S.A.C. | RUC 20504963927 | Dirección y contacto si se usarán para compras. |
| Diseylac E.I.R.L. | RUC 20506274037 | Dirección y contacto. |
| Oliveza S.A.C. | RUC 20513203871 | Dirección y contacto. |
| Valles del Pacífico S.A.C. | RUC 20517562239 | Confirmar escritura exacta de la razón social y dirección. |
| Comercializadora Megumi S.A.C. | RUC 20604955204 | Dirección y contacto. |
| Distribuidora Villegas NYP E.I.R.L. | RUC 20451704118 | Dirección y contacto. |
| MRV Foodstuff S.A.C. | RUC 20612005215 | Dirección y contacto. |
| Corporación de Servicios Básicos S.A.C. | El RUC aparece borroso en la imagen | Confirmar RUC, razón social y si realmente abastece productos. |
| Puratos Perú S.A. | RUC no legible en la foto | Confirmar RUC. La factura sí permite identificar Puratos y muestra dirección/contacto del proveedor. |
| Apudex S.A.C. | RUC 20602893350 | Ya existe; faltan relacionar los productos nuevos y sus códigos del proveedor. |
| Mandujano Rojas Anthony Yhovanni | RUC 10778335960 | Ya existe; faltan relacionar las nuevas líneas de verduras. |
| Carnicería Navarro E.I.R.L. | RUC 20544908368 | Ya existe; falta confirmar unidad base y código interno de la carne. |

Los códigos que aparecen junto a los productos (por ejemplo `003`, `001`, `007`, `231`, `4701529`) son códigos del proveedor. No se deben usar automáticamente como SKU interno.

### Productos nuevos o que necesitan completar su ficha

**Verduras, hortalizas y frutas** (facturas de Mandujano):

- Apio — paquete.
- Poro — paquete.
- Tomate — kg.
- Paltas — unidad.
- Espinaca — kg.
- Pepinos — la factura los muestra; confirmar unidad exacta.
- Avena partida — la factura la muestra; confirmar si se controla como kg o paquete.
- Rocoto — kg.

Las mismas facturas también repiten cebolla roja, ajos pelados, acelgas, choclo desgranado, wantán, maíz morado, membrillo, manzana, papa negra, camote, limones y ají amarillo. Son compras diferentes, no deben sumarse al saldo actual sin un conteo físico.

**Carnes y aves:**

- Filete de pechuga — código del proveedor `003`; las facturas usan NIU/KGM y cantidades con decimales, por lo que se debe definir la unidad base.
- Pollo entero — código del proveedor `001`.
- Alas — código del proveedor `007`; aparece en kg en una de las facturas.
- Pierna sin hueso sin piel — código del proveedor `100020`, 89 kg en la factura de Comercializadora Megumi.
- Carne molida — 20 kg en la factura de Carnicería Navarro; ya estaba pendiente, pero aún requiere SKU y unidad base.
- Jamón natural — código del proveedor `7`.
- Jamón ahumado de cerdo — código del proveedor `101`.

Para jamones y pollo hay que confirmar si la “unidad” de la factura representa kg, pieza, bandeja o presentación comercial. No convertirla automáticamente.

**Lácteos y quesos:**

- Queso Suizo Cajamarca.
- Queso Mantecoso.
- Queso Dambo (la última parte del nombre no se lee con seguridad).
- En la factura de Corporación de Servicios Básicos se observan líneas de quesos y leche, pero la foto está demasiado borrosa para transcribirlas con seguridad.

**Aceitunas y abarrotes:**

- Aceituna verde sin pepa fresca a granel — 10 kg en la factura de Oliveza.
- Vainilla en botella y un condimento/salsa de Apudex; las descripciones y códigos están parcialmente borrosos y deben confirmarse.
- Mayonesa, salsas, condimentos y otros insumos de Apudex; la factura muestra códigos de proveedor, pero varias descripciones no son legibles de forma completa.

**Insumos de panificación:**

- Prem. Chocolate x 5 kg — código de proveedor `90143184`.
- Producto Fleischmann de 12 x 1 L — código visible `90141067` (confirmar descripción exacta).
- Levadura fresca activa Fleischmann 50 x 500 g — código `90142650`.
- Miroir Neutre Bal 5 kg — código `4701529`.
- Glasse Frese Balde 5 kg — código `4112940`.
- Mixo de balde 4 kg — código `4112937` (confirmar escritura comercial exacta).
- Harina especial Valle(s) del Pacífico Sello Azul x 50 kg — código de proveedor `231`.
- Harina Nicolini Premium 50 kg — código `6804000`, ya identificada en el catálogo anterior; una factura muestra 40 unidades.

En todos los casos falta el SKU interno, la unidad base, la presentación y si requiere lote/vencimiento.

**Lácteos y bebidas en cajas/presentaciones:**

- Gloria Leche Light UHT lata 395 g, caja x 24.
- Gloria Leche Cero Lactosa lata 390 g, caja x 24.
- Gloria Leche Reconstituida lata Azul x 399 g.
- Inca Kola botella 3 L.
- Coca-Cola botella 3 L.
- Inca Kola botella 1.5 L.
- Coca-Cola botella 1.5 L.

El sistema debe guardar la presentación (por ejemplo, caja x 24) y decidir si el stock se controla por caja o por unidad. Esa decisión debe darla la empresa.

**Productos preparados:**

- Tamales de chancho — 95 unidades en una factura.
- Tamales de pollo — 98 unidades.

Solo deben ser productos de inventario si la empresa realmente controla sus existencias; de lo contrario deben quedar como venta/consumo preparado.

## Imágenes que no deben crear productos ni existencias

- Combustible (Global Fuel/Gasolineras): Gasohol Premium. Es gasto operativo salvo que la empresa solicite controlar combustible como inventario.
- Parqueo/estacionamiento (Parques de Lima y Playa Monterrico): servicio.
- Lavado de camioneta (Inversiones Dibotis): servicio.
- Entrega de Lima Express: servicio.
- Mensualidad y conservación de información de Mykake Distribuciones: servicio.
- Ferretería San Pedro: foco LED y trapeador; solo controlar el trapeador si la empresa decide incluir limpieza. El foco es activo/mantenimiento.

Estas imágenes pueden adjuntarse como respaldo de un gasto, pero no deben aparecer en el catálogo de productos ni afectar existencias.

## Documentos anulados, cancelados o duplicados

- Varias imágenes tienen sello `CANCELADO` (entre ellas compras de verduras, pollo, carne y servicios). Antes de registrar una recepción se debe confirmar si el sello anula el comprobante o solo marca el pago/archivo interno.
- La factura de Playa Monterrico aparece dos veces (`6e2e...` y `aea4...`): es un duplicado visual, no dos compras.
- Los comprobantes de transferencia bancaria son evidencia de pago; no son comprobantes de inventario independientes.
- `5d43...`, `5d893...` y `e109...` están demasiado borrosas o superpuestas para extraer datos confiables. No se deben usar para crear registros.

## Lo que falta para poder cargar estos datos correctamente

1. **SKU interno único** para cada producto, separado del código del proveedor.
2. **Unidad base** definida por la empresa: kg, g, litro, ml, unidad, caja o paquete.
3. **Presentación y conversión**, por ejemplo caja x 24, saco x 50 kg o botella x 1.5 L.
4. **Categoría confirmada**. Las categorías actuales cubren estos productos; no se necesita crear otra salvo que la empresa quiera controlar `Material de empaque`.
5. **Lote y vencimiento** para perecibles. No aparecen de forma utilizable en estas facturas y deben capturarse al recibir.
6. **Sede, cantidad recibida y fecha del conteo físico**. La cantidad facturada no es el stock actual.
7. **Estado del comprobante**: registrado, observado o anulado; y estado de pago.
8. **Razón social/RUC confirmados** para los proveedores con texto borroso.
9. **Regla para cajas y unidades** y, si corresponde, precio por unidad base.

## Conclusión

Facturas 4 aporta proveedores, productos y códigos de proveedor nuevos, especialmente en aves, carnes, lácteos, bebidas e insumos de panificación. No hace falta crear categorías nuevas para iniciar. Lo que falta para una carga segura es la decisión de la empresa sobre SKU, unidades/presentaciones, lotes y qué artículos realmente se controlan como inventario; además hay que excluir servicios, combustibles y comprobantes anulados.
