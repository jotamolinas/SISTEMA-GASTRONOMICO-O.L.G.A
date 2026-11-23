# SAAS_GASTRONOMICO.md — Fuente de Verdad del Sistema

Este documento define las reglas inviolables de identidad visual, UX comercial, arquitectura de colecciones y roadmap completo del SaaS Gastronómico (**GastroPOS**). Debe leerse obligatoriamente antes de planificar o ejecutar cualquier cambio en el repositorio.

---

## 1. Identidad Visual y UX Comercial (Reglas Inviolables)

- **Paleta estricta:**
  - **Negro Granito:** `#222222` (tarjetas, paneles y modales) y `#151515` (fondo principal y contenedores internos).
  - **Naranja Mate:** `#EA580C` (`orange-600`) como acento principal de acción y estados activos.
  - Excepción controlada para impresión térmica (`@media print`): papel `80mm`, fondo blanco puro (`#FFFFFF`) y tipografía monoespaciada negra (`#000000`) de alto contraste.
- **Interfaz 100% comercial:**
  - Dirigida a dueños, encargados, mozos, cajeros, baristas y cocineros.
  - **PROHIBIDO** mostrar términos técnicos como `Firebase`, `Firestore`, `Storage`, `Zustand`, `JSON` o nombres internos de colecciones en botones, etiquetas, badges, encabezados o notificaciones visibles al usuario final.
- **Cero diálogos nativos bloqueantes:**
  - **PROHIBIDO** usar `window.prompt()` y `window.confirm()` nativos (se bloquean en vistas embebidas/iframes).
  - Toda entrada de texto o confirmación debe resolverse con modales propios en Negro Granito o confirmación inline dentro de la tarjeta.

---

## 2. Colecciones y Reglas de Inventario

El sistema trabaja sobre tres colecciones principales:
- **`productos`**: Catálogo maestro en tiempo real.
- **`comandas_activas`**: Cola operativa en tiempo real entre el POS de salón y `/cocina` (KDS).
- **`ventas`**: Historial cerrado de cobros (con descuento atómico de stock en batch) para métricas y reportes.

### Rubros y Reglas de Inventario (Separación Estricta)
- **`Bebidas`**:
  - Control de stock por unidades, unidades por caja/fardo (`boxSize`), escaneo/auto-completado por código de barras (`barcode`) y precio de venta obligatorio `> 0 Gs.`.
  - Configurador opcional de **Cafetería / Preparación** (`isCafeConfig`, `cafeOptions`: Leche/Base, Temperatura/Estilo, Entrega y chips extra).
- **`Comidas`**:
  - Disponibilidad "Preparación al momento" (`hasDailyLimit: false`) o "Cupo diario limitado" (`hasDailyLimit: true`), con precio de venta obligatorio `> 0 Gs.`.
  - **Pizzas / Empanadas (`hasFlavors`, `flavors`)**: selección táctil de sabores predefinidos o de la casa, modalidad Entera (1 sabor) o Mitad y Mitad (`1/2 + 1/2`).
  - **Hamburguesas / Sándwiches (`isBurgerConfig`, `burgerConfig`)**: tamaños/medallones con recargo opcional, toppings/extras pagos y quitar ingredientes sin cargo.
  - **Cocina Gourmet / Platos Elaborados (`isGourmetConfig`, `gourmetOptions`)**: cocción/terminación, restricciones/alergias, tiempo de salida y chips extra personalizados.

---

## 3. Roadmap Completo del SaaS

### Bloque A — Motor Operativo (Actual)
- [x] Inventario diferenciado (`Bebidas` vs `Comidas`), validación de precio `> 0 Gs.`, eliminación directa sin `window.confirm`.
- [x] Configuradores táctiles completos en `InventoryManager` y `POSDashboard`: Sabores (`Entera` / `1/2 + 1/2`), Hamburguesas (tamaños, extras, quitar ingredientes), Cocina Gourmet (cocción, alergias, tiempos + chip extra) y Cafetería/Bar (leche, temperatura/estilo, entrega + chip extra).
- [x] POS con cuentas independientes por mesa (3 mesas por defecto + modal nativo en Negro Granito para crear/renombrar mesas sin `window.prompt`).
- [x] Monitor `/cocina` (KDS) sin precios, con filtro estricto de estación (`Solo Cocina (Comidas)` por defecto, `Barra (Bebidas)` y `Todas`), triple piscada naranja intensa (`0.5s × 3 ≈ 1.5s`, `pointer-events-none`) al entrar una nueva comanda (`docChanges` `added`, ignorando carga inicial), aviso sonoro Web Audio API (`Sonido ON/OFF`), botón `Probar Alerta` y cierre `Listo / Entregado` con confirmación inline.
- [x] Impresión térmica opcional de `80mm` en `POSDashboard` (`Imprimir Ticket / Pre-cuenta`, casilla opcional `Imprimir ticket (80mm) al cobrar` y reimpresión del último cobro).

### Bloque B — Gestión y Catálogo (En Progreso)
- [x] Tablero de métricas reales en Consola Admin conectado en vivo a `ventas` y `comandas_activas` (ventas del día, órdenes cerradas, mesas activas, ticket promedio, productos más vendidos y franja horaria pico sin datos simulados).
- [ ] Configuración comercial y fiscal del local (nombre del restaurante, dirección, teléfono, pie de ticket, parámetros operativos).
- [ ] Carga de fotos de productos en `InventoryManager` (con asignación automática para bebidas/marcas conocidas y mejora visual estilo carta/campaña con IA para comidas en plan pago).

### Bloque C — Experiencia Cliente
- [ ] Menú QR público móvil descargable/imprimible sincronizado en tiempo real con `productos`.
- [ ] Landing comercial auto-generada del restaurante (plan pago).

### Bloque D — Seguridad y Escala
- [ ] Arquitectura multi-tenant estrictamente aislada por local/comercio.
- [ ] Control de acceso por roles (`Admin`, `Caja/Mozo`, `Cocina/Barra`).

### Bloque E — Facturación Electrónica
- [ ] Integración futura desacoplada reutilizando la base y experiencia de facturación electrónica (**SIFEN**) de O.L.G.A. una vez homologada/aprobada.

---

## 4. Protocolo de Ejecución Obligatorio

1. Leer `SAAS_GASTRONOMICO.md` antes de planificar cualquier cambio.
2. Inspeccionar siempre los archivos reales del repositorio antes de editar para no romper lógica consolidada (mapeo estricto de IDs de Firestore, cuentas separadas en Zustand, sabores/hamburguesas/cupo diario).
3. Mantener lenguaje 100% comercial en la interfaz y cero `window.prompt` / `window.confirm`.
4. Verificar compilación (`npm run build` y `npm run lint` / `tsc --noEmit`) al finalizar cada entrega.
