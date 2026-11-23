# SAAS_GASTRONOMICO.md — Fuente de Verdad del Sistema

Este documento define las reglas inviolables de diseño, arquitectura, lenguaje comercial y hoja de ruta del SaaS Gastronómico (**GastroPOS**). Debe leerse obligatoriamente antes de planificar o ejecutar cualquier cambio en el repositorio.

---

## 1. Identidad Visual y UX Comercial (Reglas Inviolables)

- **Paleta estricta:**
  - **Negro Granito:** `#222222` (tarjetas, paneles y modales) y `#151515` (fondo principal y contenedores internos).
  - **Naranja Mate:** `#EA580C` (`orange-600`) como acento principal de acción y estados activos.
  - Excepción controlada para impresión térmica (`@media print`): blanco puro (`#FFFFFF`) y negro puro (`#000000`) en alto contraste de `80mm`.
- **Lenguaje 100% comercial:**
  - Toda la interfaz está dirigida a dueños, encargados, mozos, cajeros, baristas y cocineros.
  - **PROHIBIDO** mostrar términos técnicos como `Firebase`, `Firestore`, `Storage`, `Zustand`, `JSON` o nombres internos de colecciones (`comandas_activas`) en botones, etiquetas, badges, encabezados o notificaciones visibles al usuario.
- **Cero diálogos nativos bloqueantes:**
  - **PROHIBIDO** usar `window.prompt()` y `window.confirm()` (son bloqueados en vistas embebidas/iframes).
  - Toda entrada de datos o confirmación debe resolverse con modales propios en Negro Granito o confirmación inline.

---

## 2. Arquitectura y Colecciones de Firestore

El sistema opera sobre React, Tailwind CSS, Zustand (persistencia local-first del POS por mesa) y Firebase (Firestore / Storage / Auth):

1. **`productos` (Catálogo Maestro):**
   - Separación estricta entre:
     - **`Bebidas`:** control de stock por unidades, fardos/cajas (`boxSize`), código de barras (`barcode`) y configurador opcional de cafetería/barra (`isCafeConfig`, `cafeOptions`: Leche/Base, Temperatura/Estilo, Entrega y extras).
     - **`Comidas`:** disponibilidad al momento o cupo diario, precio obligatorio `> 0 Gs.` y configuradores táctiles por chips:
       - Pizzas / Empanadas: sabores enteros o `1/2 + 1/2`.
       - Hamburguesas / Minutas: tamaños, extras y quitar ingredientes.
       - Gourmet / Platos Elaborados (`isGourmetConfig`, `gourmetOptions`): Cocción/Terminación, Restricciones/Alergias, Tiempo de Salida y extras.
   - Mapeo estricto del ID real del documento de Firestore (`{ ...doc.data(), id: doc.id }`).

2. **`comandas_activas` (Cola en Tiempo Real POS ↔ Cocina/Barra):**
   - Documentos generados al presionar **Comanda** en el POS con `mesa`, `items` (incluyendo `selectedTags`, `customTags`, `customizationType` e `itemNote`), `nota`, `cajero`, `estado` (`en_cocina` → `en_preparacion` → `listo`), `fecha` y `timestamp`.
   - Consumida en tiempo real por `/cocina` (KDS).

3. **`ventas` (Historial Cerrado de Cobros):**
   - Registro atómico mediante `writeBatch` junto con el descuento de stock en `productos`.
   - Fuente de datos para el tablero de métricas, ticket promedio, productos más vendidos y reportes administrativos.

---

## 3. Estado Actual y Roadmap Completo del SaaS

### Completado
- CRUD de inventario en tiempo real con eliminación directa sin `window.confirm()`.
- Configuradores rápidos por rubro (Gourmet: cocción, alergias y tiempos; Cafetería/Bar: leche, temperatura/estilo y entrega) persistidos en `productos`.
- Terminal POS (`/pos-terminal`) con cuentas independientes por mesa (3 mesas iniciales por defecto + modal propio para crear y renombrar mesas/cuentas dinámicamente) y modal táctil de personalización rápida.
- **Bloque A — Motor Operativo:**
  1. **Monitor de Cocina `/cocina` (KDS):** filtro de estación con **`Solo Cocina (Comidas)`** activo por defecto, **`Barra (Bebidas)`** y **`Todas`**; timbre sonoro sintetizado vía **Web Audio API**; botón **`Probar Alerta`**; y **triple piscada naranja intensa de `0.5s` cada destello (~`1.5s` total)** al entrar una comanda nueva (ignorando la carga inicial).
  2. **Impresión térmica opcional de `80mm` en `POSDashboard`:** botón **`Imprimir Ticket (80mm)`** con plantilla `@media print` (`window.print()`) en alto contraste blanco/negro, incluyendo personalizaciones, alergias, tiempos y notas.

### Pendiente — Bloque B: Gestión y Administración
3. **Tablero de métricas reales en Consola Admin:** conectado en vivo a `ventas` (ventas del día, ticket promedio, productos top y horas pico).
4. **Fotografías de productos en `InventoryManager`:** carga, vista previa y actualización usando Firebase Storage.

### Pendiente — Bloque C: Experiencia Cliente y Lanzamiento
5. **Menú QR público móvil:** carta digital de solo lectura sincronizada en vivo con `productos`.
6. **Landing comercial auto-generada:** página pública personalizada del restaurante.
7. **Seguridad y despliegue:** autenticación estricta de roles (`Admin`, `Caja/Mozo`, `Cocina`) y despliegue en producción.

---

## 4. Protocolo de Ejecución Obligatorio

En cada sesión de desarrollo se debe seguir estrictamente este orden:
1. **Leer `SAAS_GASTRONOMICO.md`** antes de planificar cualquier cambio.
2. **Inspeccionar los archivos reales** del repositorio antes de editar para preservar la lógica existente (mapeo estricto de IDs de Firestore, cuentas separadas por mesa en Zustand, descuentos atómicos de stock).
3. **Respetar 100% el lenguaje comercial** en todos los textos visibles de la interfaz y evitar `window.prompt()` / `window.confirm()`.
4. **Verificar la compilación** (`npm run build` y `npm run lint` / `tsc --noEmit`) al finalizar cada entrega para garantizar cero errores de sintaxis o tipos.
