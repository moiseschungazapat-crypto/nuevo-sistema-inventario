# Guía para registrar los productos encontrados en las facturas

Esta guía reúne los productos legibles de las facturas revisadas. Los SKU son
propuestas internas para La Liguria: antes de usarlos, comprobar que no existan
en el catálogo. La cantidad que aparece en una factura se registra después en
**Recepciones**; no se coloca en la ficha del producto.

## Valores generales del formulario

- **Tipo de registro:** Producto.
- **Controla existencias:** Sí.
- **Estado:** Activo.
- **Precio confirmado:** Sí solo cuando la tabla muestra un precio; en los demás casos, No.
- **Marca y código de barras:** dejar vacíos si no aparecen claramente.
- **Descripción sugerida:** usar el nombre más la presentación.
- **Lote:** en alimentos perecibles, Sí. En limpieza, servilletas y artículos no perecibles, No.

## Productos que pueden registrarse con los datos disponibles

Antes de crear una ficha, buscarla por nombre y SKU. Las migraciones del proyecto
ya preparan `PANCETA`, `6804000` (Harina Nicolini Premium), `1000T5` (Pechuga de
pavo) y `100400` (Asado pejerrey); no deben duplicarse si ya aparecen en Catálogo.

### Carnes y embutidos

| SKU sugerido | Nombre | Categoría | Unidad base | Presentación | Precio S/ | Perecible | Lote |
|---|---|---|---|---|---:|---|---|
| PANCETA | Panceta | Carnes | kg | A granel | 26.27 | Sí | Sí |
| CAR-002 | Carne molida | Carnes | kg | A granel | Dejar vacío | Sí | Sí |
| CAR-003 | Hot dog alemana | Carnes | unidad | Confirmar empaque | Dejar vacío | Sí | Sí |
| CAR-004 | Jamón pizzero AP BDT | Carnes | kg | A granel | Dejar vacío | Sí | Sí |
| CAR-005 | Jamonada de pollo AP BDT | Carnes | kg | A granel | Dejar vacío | Sí | Sí |
| CAR-006 | Paté BDT 100 g | Carnes | unidad | Envase de 100 g | Dejar vacío | Sí | Sí |
| CAR-007 | Hot dog AP BDT 1.6 kg | Carnes | unidad | Paquete de 1.6 kg | Dejar vacío | Sí | Sí |
| CAR-008 | Tocino especial ahumado rebanado 500 g | Carnes | unidad | Paquete de 500 g | Dejar vacío | Sí | Sí |
| CAR-009 | Pastel de jamón P2 3 kg | Carnes | unidad | Pieza de 3 kg | Dejar vacío | Sí | Sí |
| CAR-010 | Queso de chancho P2 3 kg | Carnes | unidad | Pieza de 3 kg | Dejar vacío | Sí | Sí |

### Lácteos y quesos

| SKU sugerido | Nombre | Marca | Categoría | Unidad base | Presentación | Perecible | Lote |
|---|---|---|---|---|---|---|---|
| LAC-001 | Queso fresco pasteurizado Vaché | Vaché | Lácteos y quesos | kg | A granel | Sí | Sí |
| LAC-002 | Queso Edam AP Sigma FS 3 kg | Sigma | Lácteos y quesos | unidad | Pieza de 3 kg | Sí | Sí |
| LAC-003 | Queso Suizo Cajamarca | Dejar vacío | Lácteos y quesos | kg | A granel | Sí | Sí |
| LAC-004 | Queso Mantecoso | Dejar vacío | Lácteos y quesos | kg | A granel | Sí | Sí |
| LAC-005 | Gloria Leche Light UHT lata 395 g | Gloria | Lácteos y quesos | caja | Caja x 24 latas de 395 g | Sí | Sí |
| LAC-006 | Gloria Leche Cero Lactosa lata 390 g | Gloria | Lácteos y quesos | caja | Caja x 24 latas de 390 g | Sí | Sí |
| LAC-007 | Gloria Leche Reconstituida lata Azul 399 g | Gloria | Lácteos y quesos | unidad | Lata de 399 g | Sí | Sí |

### Verduras y hortalizas

| SKU sugerido | Nombre | Unidad base | Presentación | Perecible | Lote |
|---|---|---|---|---|---|
| VER-001 | Cebolla roja | kg | A granel | Sí | Sí |
| VER-002 | Rocoto | kg | A granel | Sí | Sí |
| VER-003 | Olluco picado | kg | A granel | Sí | Sí |
| VER-004 | Perejil | paquete | Paquete | Sí | Sí |
| VER-005 | Lechuga | unidad | Unidad | Sí | Sí |
| VER-006 | Papa negra | kg | A granel | Sí | Sí |
| VER-007 | Camote | kg | A granel | Sí | Sí |
| VER-008 | Maíz morado | kg | A granel | Sí | Sí |
| VER-009 | Acelga | paquete | Paquete | Sí | Sí |
| VER-010 | Ají amarillo | kg | A granel | Sí | Sí |
| VER-011 | Ajo pelado | kg | A granel | Sí | Sí |
| VER-012 | Vainita | kg | A granel | Sí | Sí |
| VER-013 | Choclo desgranado | kg | A granel | Sí | Sí |
| VER-014 | Choclo | unidad | Unidad | Sí | Sí |
| VER-015 | Pepino | unidad | Unidad; confirmar con el encargado | Sí | Sí |
| VER-016 | Papa amarilla especial | kg | A granel | Sí | Sí |
| VER-017 | Apio | paquete | Paquete | Sí | Sí |
| VER-018 | Poro | paquete | Paquete | Sí | Sí |
| VER-019 | Tomate | kg | A granel | Sí | Sí |
| VER-020 | Palta | unidad | Unidad | Sí | Sí |
| VER-021 | Espinaca | kg | A granel | Sí | Sí |

Para todos los registros `VER-*`, usar la categoría **Verduras y hortalizas** y
dejar el precio de referencia vacío hasta revisar una factura concreta.

### Frutas

| SKU sugerido | Nombre | Unidad base | Presentación | Perecible | Lote |
|---|---|---|---|---|---|
| FRU-001 | Limón | kg | A granel | Sí | Sí |
| FRU-002 | Membrillo | kg | A granel | Sí | Sí |
| FRU-003 | Manzana | kg | A granel | Sí | Sí |
| FRU-004 | Blueberry 150 g | unidad | Envase de 150 g | Sí | Sí |

### Abarrotes, limpieza y panificación

| SKU sugerido | Nombre | Marca | Categoría | Unidad base | Presentación | Precio S/ | Perecible | Lote |
|---|---|---|---|---|---|---:|---|---|
| ABA-001 | Pasta wantán 500 g | Dejar vacío | Abarrotes | unidad | Paquete de 500 g | Dejar vacío | Sí | Sí |
| ABA-002 | Vela mixta de 24 | Dejar vacío | Abarrotes | paquete | Paquete de 24; la factura menciona docena, confirmar conversión | Dejar vacío | No | No |
| LIM-001 | Servilleta Elite doblada x4 | Elite | Limpieza | paquete | Paquete x4 de 500 unidades | Dejar vacío | No | No |
| LIM-002 | Limpiador floral antibacterial 4 L | Dkasa | Limpieza | unidad | Bidón de 4 L | Dejar vacío | No | No |
| 6804000 | Harina Nicolini Premium 50 kg | Nicolini | Insumos de panificación | unidad | Saco de 50 kg | 143.43 | Sí | Sí |
| PAN-002 | Premix de chocolate 5 kg | Confirmar | Insumos de panificación | unidad | Bolsa o balde de 5 kg | Dejar vacío | Sí | Sí |
| PAN-003 | Levadura fresca activa Fleischmann 500 g | Fleischmann | Insumos de panificación | unidad | Paquete de 500 g | Dejar vacío | Sí | Sí |
| PAN-004 | Miroir Neutre 5 kg | Confirmar | Insumos de panificación | unidad | Balde de 5 kg | Dejar vacío | Sí | Sí |
| PAN-005 | Glasse fresa 5 kg | Confirmar | Insumos de panificación | unidad | Balde de 5 kg | Dejar vacío | Sí | Sí |
| PAN-006 | Mixo 4 kg | Confirmar | Insumos de panificación | unidad | Balde de 4 kg | Dejar vacío | Sí | Sí |
| PAN-007 | Harina especial Sello Azul 50 kg | Valles del Pacífico | Insumos de panificación | unidad | Saco de 50 kg | Dejar vacío | Sí | Sí |

### Bebidas

| SKU sugerido | Nombre | Marca | Unidad base | Presentación | Perecible | Lote |
|---|---|---|---|---|---|---|
| BEB-001 | Inca Kola 3 L | Inca Kola | unidad | Botella de 3 L | Sí | Sí |
| BEB-002 | Coca-Cola 3 L | Coca-Cola | unidad | Botella de 3 L | Sí | Sí |
| BEB-003 | Inca Kola 1.5 L | Inca Kola | unidad | Botella de 1.5 L | Sí | Sí |
| BEB-004 | Coca-Cola 1.5 L | Coca-Cola | unidad | Botella de 1.5 L | Sí | Sí |

Usar la categoría **Bebidas** y dejar el precio vacío hasta revisar el comprobante
correspondiente.

## Productos que deben confirmarse antes de registrarlos

| Producto leído | Dato pendiente |
|---|---|
| Filete de pechuga, código de proveedor 003 | Definir si la unidad base será kg o unidad. |
| Pollo entero, código de proveedor 001 | Confirmar si se compra/controla por kg o por pieza. |
| Alas, código de proveedor 007 | Confirmar que todas las compras se controlarán en kg. |
| Pierna sin hueso sin piel, código de proveedor 100020 | Confirmar SKU interno; la factura muestra kg. |
| Jamón natural, código de proveedor 7 | Confirmar kg, pieza o paquete. |
| Jamón ahumado de cerdo, código de proveedor 101 | Confirmar kg, pieza o paquete. |
| Queso Dambo | Confirmar nombre comercial completo y presentación. |
| Avena partida | Confirmar kg o paquete. |
| Producto Fleischmann 12 x 1 L, código 90141067 | Confirmar descripción comercial exacta. |
| Vainilla, mayonesa, salsas y condimentos de Apudex | Las descripciones están borrosas; revisar la factura original. |
| Tamal de chancho y tamal de pollo | Confirmar si La Liguria controla stock de productos preparados. |

Los códigos numéricos indicados en esta sección son códigos del proveedor; no se
deben colocar como SKU interno sin aprobación de La Liguria.

## Conceptos que no deben registrarse como productos de inventario

- Combustible, estacionamiento, lavado de vehículos y entregas.
- Publicidad, imprenta, fumigación, mantenimiento y mensualidades.
- Comprobantes bancarios o transferencias.
- Focos y equipos de mantenimiento, salvo que se decida controlar activos.
- Documentos anulados o imágenes duplicadas.

Estos conceptos pueden conservarse como respaldo de gasto, pero no deben aumentar
las existencias del inventario.
