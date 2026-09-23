# Datos faltantes necesarios para iniciar el inventario

Este checklist separa los datos indispensables para operar de los datos que solo enriquecen el directorio. No crea registros ni completa valores que no estén confirmados por la empresa.

## 1. Imprescindible antes de registrar existencias

### Sedes

- Nombre exacto de cada local o almacén.
- Dirección de cada sede.
- Responsable operativo.

Debe existir al menos una sede activa para registrar una recepción o un saldo.

### Productos

Para cada producto que se quiera controlar:

- Código interno/SKU único.
- Nombre comercial.
- Categoría.
- Unidad base (`kg`, `g`, `litro`, `ml`, `unidad`, `caja` o `paquete`).
- Si aumenta existencias.
- Si requiere lote y fecha de vencimiento.
- Presentación y equivalencia cuando la compra y el consumo usan unidades distintas; por ejemplo, saco de 50 kg.

Marca, código de barras y precio de referencia son útiles, pero no impiden registrar stock. El precio real de compra se guarda en cada recepción.

### Inventario inicial

Por cada producto y sede:

- Cantidad física contada.
- Código de lote.
- Fecha de vencimiento si corresponde.
- Stock mínimo.
- Fecha del conteo.

No se deben convertir facturas antiguas en cantidades actuales: el saldo inicial debe salir de un conteo físico.

### Proveedores

Para cada proveedor que realmente abastece productos:

- Razón social o nombre exacto.
- Tipo de documento: RUC, DNI u otro.
- Número de documento confirmado.

Dirección, persona de contacto, teléfono y correo son necesarios para un directorio de compras, pero no bloquean el movimiento de stock.

## 2. Productos que aparecen en las facturas, pero aún requieren código interno

### Carnes

Carne molida; hot dog alemana; jamón pizzero AP BDT; jamonada pollo AP BDT; paté 100 g BDT; hot dog 1.6 kg AP BDT; tocino especial ahumado rebanado 500 g; pastel de jamón P2 3 kg; queso de chancho P2 3 kg.

### Lácteos y quesos

Queso fresco pasteurizado “Vaché”; queso Edam 3 kg AP Sigma FS.

### Verduras y hortalizas

Cebolla roja; rocoto; olluco picado; perejil; lechugas; papa negra; camote; maíz morado; acelgas; ají amarillo; ajos pelados; vainita; choclo desgranado; choclos; pepinos; papa amarilla especial.

### Frutas

Limones; membrillo; manzana; blueberry x150 g.

### Abarrotes y limpieza

Pasta wantán x500 g; vela mixta de 24 la docena; servilleta Elite doblada x4 de 500 unidades; Dkasa floral antibacterial 4 L.

No se deben insertar estos productos hasta que la empresa asigne el SKU y confirme la unidad base.

## 3. Proveedores que requieren conciliación

El catálogo debe conservar solo proveedores que abastecen existencias. Se debe confirmar el documento y la razón social de:

- Negociaciones e Inversiones Aileen S.A.
- Avícola Víctor Pérez S.A.C.
- Distribuidora Naltia E.I.R.L.
- Puratos Perú S.A.
- AVICOMAR S.A.C.
- Chávez Arana Giancarlo.
- Polanco Guevara Walter Gustavo.
- Power Logistics Import E.I.R.L.

En la captura del catálogo, Braedt y Cencosud/Metro aparecen sin documento aunque el análisis de las facturas tiene valores de referencia; deben compararse contra la factura original antes de completar el RUC. No se debe fusionar `Cencosud Retail Perú S.A. / Metro` con `Cencosud Retail Perú S.A.` sin confirmar que es la misma razón social.

Gasolineras, publicidad, imprenta, mantenimiento, fumigación, estacionamiento y equipos no deben quedar como proveedores activos de inventario salvo que la empresa decida controlar esos consumos como existencias.

## 4. Categorías

Las categorías actuales cubren los productos identificados: Carnes, Lácteos y quesos, Verduras y hortalizas, Frutas, Abarrotes, Bebidas, Limpieza e Insumos de panificación. No hace falta crear otra categoría para iniciar.

Solo crear `Material de empaque` si la empresa decide controlar envases o descartables como stock separado. Servicios, combustibles, publicidad, equipos y mantenimiento deben registrarse como historial de compra sin aumentar existencias.

## 5. Datos de operación y acceso

- Cuentas de Supabase Auth del personal.
- Rol de cada cuenta: administrador, operador o consulta.
- Sede o sedes que puede operar cada persona, si se aplicará esa restricción.
- Un administrador activo y un operador de prueba para validar entradas, salidas y traslados.

## 6. Consulta para revisar faltantes reales en Supabase

Ejecutar después de aplicar la migración 006. Es una consulta de solo lectura:

```sql
select id, nombre, documento, direccion, contacto, telefono, email
from public.proveedores
where coalesce(estado, true)
  and nullif(btrim(documento), '') is null
order by nombre;

select id, codigo, nombre, categoria_id, unidad_medida, tipo_item, controla_inventario
from public.productos
where coalesce(estado, true)
  and (nullif(btrim(codigo), '') is null
       or categoria_id is null
       or nullif(btrim(unidad_medida), '') is null)
order by nombre;

select id, nombre
from public.sedes
where coalesce(estado, true)
  and (nullif(btrim(nombre), '') is null
       or nullif(btrim(direccion), '') is null)
order by nombre;
```

La consulta no elimina ni modifica información.
