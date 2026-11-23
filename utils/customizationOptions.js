/**
 * Opciones predefinidas de personalización rápida para Comidas (Modo Gourmet)
 * y Bebidas (Cafetería / Bar), compartidas entre InventoryManager, POSDashboard y KitchenDisplay.
 */

export const GOURMET_PRESET_GROUPS = [
  {
    key: 'coccion',
    label: 'Cocción / Terminación',
    chips: ['Jugoso', 'A punto', 'Bien cocido', 'Al dente', 'Bien crocante']
  },
  {
    key: 'alergias',
    label: 'Restricciones / Alergias',
    chips: ['Sin Gluten', 'Sin Lactosa', 'Sin Frutos Secos', 'Sin Picante', 'Sin Azúcar']
  },
  {
    key: 'tiempo',
    label: 'Tiempo de Salida',
    chips: ['Entrada', 'Principal', 'Sale con la mesa', 'Para llevar']
  }
];

export const CAFE_PRESET_GROUPS = [
  {
    key: 'leche',
    label: 'Leche / Base',
    chips: ['Leche Entera', 'Deslactosada', 'Avena', 'Almendra', 'Sin Leche']
  },
  {
    key: 'temperatura',
    label: 'Temperatura / Estilo',
    chips: ['Caliente', 'Tibio', 'Con Hielo', 'Doble Shot', 'Suave']
  },
  {
    key: 'entrega',
    label: 'Entrega',
    chips: ['En Mesa', 'Para Llevar']
  }
];

export const createDefaultGourmetOptions = () => ({
  coccion: [...GOURMET_PRESET_GROUPS[0].chips],
  alergias: [...GOURMET_PRESET_GROUPS[1].chips],
  tiempo: [...GOURMET_PRESET_GROUPS[2].chips],
  extras: []
});

export const createEmptyGourmetOptions = () => ({
  coccion: [],
  alergias: [],
  tiempo: [],
  extras: []
});

export const createDefaultCafeOptions = () => ({
  leche: [...CAFE_PRESET_GROUPS[0].chips],
  temperatura: [...CAFE_PRESET_GROUPS[1].chips],
  entrega: [...CAFE_PRESET_GROUPS[2].chips],
  extras: []
});

export const createEmptyCafeOptions = () => ({
  leche: [],
  temperatura: [],
  entrega: [],
  extras: []
});

/**
 * Normaliza gourmetOptions desde un documento de Firestore.
 */
export const normalizeGourmetOptions = (rawOptions) => {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return createDefaultGourmetOptions();
  }
  const hasAny =
    (Array.isArray(rawOptions.coccion) && rawOptions.coccion.length > 0) ||
    (Array.isArray(rawOptions.alergias) && rawOptions.alergias.length > 0) ||
    (Array.isArray(rawOptions.tiempo) && rawOptions.tiempo.length > 0) ||
    (Array.isArray(rawOptions.extras) && rawOptions.extras.length > 0);

  if (!hasAny) {
    return createDefaultGourmetOptions();
  }

  return {
    coccion: Array.isArray(rawOptions.coccion) ? rawOptions.coccion : [],
    alergias: Array.isArray(rawOptions.alergias) ? rawOptions.alergias : [],
    tiempo: Array.isArray(rawOptions.tiempo) ? rawOptions.tiempo : [],
    extras: Array.isArray(rawOptions.extras) ? rawOptions.extras : []
  };
};

/**
 * Normaliza cafeOptions desde un documento de Firestore.
 */
export const normalizeCafeOptions = (rawOptions) => {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return createDefaultCafeOptions();
  }
  const hasAny =
    (Array.isArray(rawOptions.leche) && rawOptions.leche.length > 0) ||
    (Array.isArray(rawOptions.temperatura) && rawOptions.temperatura.length > 0) ||
    (Array.isArray(rawOptions.entrega) && rawOptions.entrega.length > 0) ||
    (Array.isArray(rawOptions.extras) && rawOptions.extras.length > 0);

  if (!hasAny) {
    return createDefaultCafeOptions();
  }

  return {
    leche: Array.isArray(rawOptions.leche) ? rawOptions.leche : [],
    temperatura: Array.isArray(rawOptions.temperatura) ? rawOptions.temperatura : [],
    entrega: Array.isArray(rawOptions.entrega) ? rawOptions.entrega : [],
    extras: Array.isArray(rawOptions.extras) ? rawOptions.extras : []
  };
};

/**
 * Determina el grupo de una etiqueta (soporta objetos { label, group } o strings simples).
 */
const ALLERGY_SET = new Set(GOURMET_PRESET_GROUPS[1].chips.map((c) => c.toLowerCase()));
const TIMING_SET = new Set(
  [...GOURMET_PRESET_GROUPS[2].chips, ...CAFE_PRESET_GROUPS[2].chips].map((c) => c.toLowerCase())
);

export const normalizeSelectedTags = (selectedTags = []) => {
  if (!Array.isArray(selectedTags)) return [];
  return selectedTags
    .map((tag) => {
      if (!tag) return null;
      if (typeof tag === 'string') {
        const lower = tag.toLowerCase();
        const group = ALLERGY_SET.has(lower)
          ? 'alergias'
          : TIMING_SET.has(lower)
          ? 'tiempo'
          : 'general';
        return { label: tag, group };
      }
      if (typeof tag === 'object' && tag.label) {
        return {
          label: String(tag.label),
          group: tag.group || 'general'
        };
      }
      return null;
    })
    .filter(Boolean);
};

export const isAllergyTag = (tag) => {
  if (!tag) return false;
  if (tag.group === 'alergias') return true;
  const label = (typeof tag === 'string' ? tag : tag.label || '').toLowerCase();
  return ALLERGY_SET.has(label) || label.startsWith('sin gluten') || label.startsWith('sin lactosa') || label.includes('alerg');
};

export const isTimingTag = (tag) => {
  if (!tag) return false;
  if (tag.group === 'tiempo' || tag.group === 'entrega') return true;
  const label = (typeof tag === 'string' ? tag : tag.label || '').toLowerCase();
  return TIMING_SET.has(label);
};

/**
 * Construye una clave estable para diferenciar ítems con distintas personalizaciones en el carrito.
 */
export const buildCartItemKey = (productId, selectedTags = [], itemNote = '') => {
  const normalizedTags = normalizeSelectedTags(selectedTags)
    .map((t) => `${t.group}:${t.label}`)
    .sort()
    .join('|');
  const cleanNote = (itemNote || '').trim().toLowerCase();
  if (!normalizedTags && !cleanNote) {
    return String(productId);
  }
  return `${productId}__${normalizedTags}__${cleanNote}`;
};
