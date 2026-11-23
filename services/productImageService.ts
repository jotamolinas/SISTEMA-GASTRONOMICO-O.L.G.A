import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './auth';

export interface CompressedImageResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export interface AutoImageMatch {
  imageUrl: string;
  isIllustrativeImage: boolean;
  matchLabel: string;
}

export interface UniqueImageSearchResult {
  imageUrl: string;
  sourceUrl: string;
  previewUrl: string;
  compressedBlob: Blob | null;
  isIllustrativeImage: boolean;
  fromSearch: boolean;
  statusReason: 'ok' | 'missing_config' | 'no_results' | 'api_error';
}

const VALID_CATALOG_WEBP_PATHS = new Set<string>([
  '/catalog/bebida-cerveza.webp',
  '/catalog/bebida-cerveza-heineken.webp',
  '/catalog/bebida-cerveza-corona.webp',
  '/catalog/bebida-cerveza-budweiser.webp',
  '/catalog/bebida-cerveza-miller.webp',
  '/catalog/bebida-gaseosa-oscura.webp',
  '/catalog/bebida-gaseosa-citrica.webp',
  '/catalog/bebida-agua.webp',
  '/catalog/bebida-cafe.webp',
  '/catalog/bebida-vino.webp',
  '/catalog/comida-pizza-1.webp',
  '/catalog/comida-pizza-2.webp',
  '/catalog/comida-pizza-3.webp',
  '/catalog/comida-pasta-carbonara.webp',
  '/catalog/comida-pasta-seafood.webp',
  '/catalog/comida-pasta-bolognesa.webp',
  '/catalog/comida-pasta-pesto.webp',
  '/catalog/comida-pasta-4quesos.webp',
  '/catalog/comida-pasta-alfredo.webp',
  '/catalog/comida-pasta-general.webp',
  '/catalog/comida-hamburguesa.webp',
  '/catalog/comida-empanada.webp',
  '/catalog/comida-general.webp'
]);

const normalizeText = (value: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const normalizeUrlKey = (url: string): string => (url || '').trim().toLowerCase();

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/**
 * Indica si las credenciales del buscador real de imágenes están configuradas en el entorno.
 */
export function isImageSearchConfigured(): boolean {
  const apiKey = String(import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || '').trim();
  const cx = String(import.meta.env.VITE_GOOGLE_SEARCH_CX || '').trim();
  return Boolean(apiKey && cx);
}

/**
 * Convierte un Blob compacto en DataURL como respaldo si el repositorio remoto
 * no está disponible en el entorno actual.
 */
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen comprimida.'));
    reader.readAsDataURL(blob);
  });

/**
 * Verifica que una URL externa cargue correctamente como imagen en el navegador.
 */
function canLoadImageUrl(url: string, timeoutMs = 4500): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    let settled = false;

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve((img.naturalWidth || 0) > 40 && (img.naturalHeight || 0) > 40);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(false);
      }
    };

    img.src = url;
  });
}

/**
 * Convierte cualquier fuente de imagen (File, Blob, DataURL o URL) a WebP comprimido
 * (máximo 800px de ancho manteniendo proporción, calidad ~0.8), con respaldo JPEG
 * únicamente si el navegador no soporta codificación WebP.
 */
export function convertImageSourceToWebp(
  source: File | Blob | string,
  maxWidth = 800,
  quality = 0.8
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    let objectUrl = '';
    let shouldRevoke = false;

    if (typeof source === 'string') {
      if (!source.trim()) {
        reject(new Error('Fuente de imagen vacía.'));
        return;
      }
      objectUrl = source;
    } else if (source instanceof Blob) {
      if (source.type && !source.type.startsWith('image/')) {
        reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG o WebP).'));
        return;
      }
      objectUrl = URL.createObjectURL(source);
      shouldRevoke = true;
    } else {
      reject(new Error('Formato de imagen no compatible.'));
      return;
    }

    const cleanup = () => {
      if (shouldRevoke && objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    if (typeof source === 'string' && !source.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        if (!targetWidth || !targetHeight) {
          cleanup();
          reject(new Error('No se pudieron leer las dimensiones de la imagen.'));
          return;
        }

        if (targetWidth > maxWidth) {
          targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
          targetWidth = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('No se pudo procesar la imagen en este navegador.'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        cleanup();

        canvas.toBlob(
          (webpBlob) => {
            if (webpBlob && webpBlob.type === 'image/webp') {
              const candidateUrl = canvas.toDataURL('image/webp', quality);
              if (candidateUrl.startsWith('data:image/webp')) {
                resolve({
                  blob: webpBlob,
                  previewUrl: candidateUrl,
                  width: targetWidth,
                  height: targetHeight,
                  sizeBytes: webpBlob.size,
                  mimeType: 'image/webp'
                });
                return;
              }

              blobToDataUrl(webpBlob)
                .then((dataUrl) => {
                  resolve({
                    blob: webpBlob,
                    previewUrl: dataUrl,
                    width: targetWidth,
                    height: targetHeight,
                    sizeBytes: webpBlob.size,
                    mimeType: 'image/webp'
                  });
                })
                .catch(reject);
              return;
            }

            // Fallback a JPEG únicamente si el navegador no soporta toBlob('image/webp')
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob) {
                  reject(new Error('No se pudo comprimir la imagen.'));
                  return;
                }
                const previewUrl = canvas.toDataURL('image/jpeg', quality);
                resolve({
                  blob: jpegBlob,
                  previewUrl,
                  width: targetWidth,
                  height: targetHeight,
                  sizeBytes: jpegBlob.size,
                  mimeType: 'image/jpeg'
                });
              },
              'image/jpeg',
              quality
            );
          },
          'image/webp',
          quality
        );
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Error al comprimir la imagen (CORS o formato).'));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Comprime una imagen seleccionada desde cámara o galería en el navegador en formato WebP.
 */
export function compressProductImage(
  file: File,
  maxWidth = 800,
  quality = 0.8
): Promise<CompressedImageResult> {
  if (!file || !file.type.startsWith('image/')) {
    return Promise.reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG o WebP).'));
  }
  return convertImageSourceToWebp(file, maxWidth, quality);
}

/**
 * Sube la imagen comprimida en formato .webp (o .jpg en fallback) al repositorio del comercio.
 */
export async function uploadCompressedProductImage(
  blob: Blob,
  productName = 'producto',
  fallbackDataUrl = ''
): Promise<string> {
  const safeSlug =
    normalizeText(productName)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'producto';

  const isJpegFallback = blob.type === 'image/jpeg';
  const ext = isJpegFallback ? 'jpg' : 'webp';
  const contentType = isJpegFallback ? 'image/jpeg' : 'image/webp';
  const filePath = `productos/${safeSlug}_${Date.now()}.${ext}`;

  try {
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, blob, {
      contentType,
      cacheControl: 'public, max-age=31536000'
    });
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.warn('No se pudo subir la imagen al repositorio remoto, usando copia optimizada:', err);
    const dataUrl = fallbackDataUrl || (await blobToDataUrl(blob));
    if (dataUrl && dataUrl.length <= 350000) {
      return dataUrl;
    }
    throw new Error('No se pudo guardar la imagen. Intenta con una foto más liviana.');
  }
}

/**
 * Construye una consulta precisa para Google Custom Search de imágenes usando el nombre exacto
 * del producto (y su sabor principal cuando aplica).
 */
export function buildProductSearchQuery(
  name = '',
  category = 'Comidas',
  flavors: string[] = []
): string {
  const cleanName = (name || '').trim();
  if (!cleanName) return '';

  const normalizedName = normalizeText(cleanName);
  const firstFlavor = Array.isArray(flavors) && flavors.length > 0 ? flavors[0].trim() : '';

  if (firstFlavor && !normalizedName.includes(normalizeText(firstFlavor))) {
    return `${cleanName} ${firstFlavor}`.trim();
  }

  // Si es una palabra muy corta y genérica en bebidas/comidas, dar contexto mínimo sin alterar marcas exactas
  const wordCount = cleanName.split(/\s+/).filter(Boolean).length;
  if (wordCount === 1 && !/\d/.test(cleanName)) {
    return category === 'Bebidas' ? `${cleanName} bebida` : `${cleanName} plato comida`;
  }

  return cleanName;
}

/**
 * VÍA A — Consulta la API real de Google Custom Search (searchType=image) bajo acción explícita,
 * selecciona 1 sola imagen acorde al producto evitando repetir URLs ya usadas en el inventario,
 * e intenta convertirla a .webp liviano (con fallback seguro si una URL externa bloquea CORS).
 */
export async function searchUniqueProductImage(params: {
  name: string;
  category?: string;
  flavors?: string[];
  usedUrls?: string[];
  skippedUrls?: string[];
}): Promise<UniqueImageSearchResult> {
  const {
    name,
    category = 'Comidas',
    flavors = [],
    usedUrls = [],
    skippedUrls = []
  } = params;

  const normalizedUsed = new Set<string>(
    usedUrls.map(normalizeUrlKey).filter(Boolean)
  );
  const normalizedSkipped = new Set<string>(
    skippedUrls.map(normalizeUrlKey).filter(Boolean)
  );

  const fallbackLocal = resolveAutoProductImage(name, category, '', flavors, usedUrls);

  const apiKey = String(import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || '').trim();
  const cx = String(import.meta.env.VITE_GOOGLE_SEARCH_CX || '').trim();
  const query = buildProductSearchQuery(name, category, flavors);

  if (!apiKey || !cx || !query) {
    return {
      imageUrl: fallbackLocal.imageUrl,
      sourceUrl: '',
      previewUrl: fallbackLocal.imageUrl,
      compressedBlob: null,
      isIllustrativeImage: fallbackLocal.isIllustrativeImage,
      fromSearch: false,
      statusReason: 'missing_config'
    };
  }

  try {
    const searchParams = new URLSearchParams({
      key: apiKey,
      cx,
      q: query,
      searchType: 'image',
      imgType: 'photo',
      num: '10',
      safe: 'active'
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${searchParams.toString()}`
    );

    if (!response.ok) {
      return {
        imageUrl: fallbackLocal.imageUrl,
        sourceUrl: '',
        previewUrl: fallbackLocal.imageUrl,
        compressedBlob: null,
        isIllustrativeImage: fallbackLocal.isIllustrativeImage,
        fromSearch: false,
        statusReason: 'api_error'
      };
    }

    const data = await response.json();
    const rawItems: Array<{ link?: string; image?: { thumbnailLink?: string } }> =
      Array.isArray(data?.items) ? data.items : [];

    // Filtrar candidatos válidos y no repetidos (respetando orden de relevancia #1, #2, #3...)
    const validItems = rawItems.filter((item) => {
      const link = typeof item?.link === 'string' ? item.link.trim() : '';
      if (!link || !/^https?:\/\//i.test(link)) return false;
      if (/\.svg(\?|$)/i.test(link)) return false;
      const key = normalizeUrlKey(link);
      const thumbKey = normalizeUrlKey(item?.image?.thumbnailLink || '');
      if (normalizedSkipped.has(key) || (thumbKey && normalizedSkipped.has(thumbKey))) {
        return false;
      }
      return true;
    });

    const nonDuplicateItems = validItems.filter((item) => {
      const key = normalizeUrlKey(item.link || '');
      const thumbKey = normalizeUrlKey(item?.image?.thumbnailLink || '');
      return !normalizedUsed.has(key) && (!thumbKey || !normalizedUsed.has(thumbKey));
    });

    const candidates = nonDuplicateItems.length > 0 ? nonDuplicateItems : validItems;

    for (const candidate of candidates) {
      const directUrl = String(candidate.link || '').trim();
      const thumbUrl = String(candidate.image?.thumbnailLink || '').trim();

      const canLoadDirect = await canLoadImageUrl(directUrl);
      if (canLoadDirect) {
        try {
          const webp = await convertImageSourceToWebp(directUrl, 800, 0.8);
          return {
            imageUrl: webp.previewUrl,
            sourceUrl: directUrl,
            previewUrl: webp.previewUrl,
            compressedBlob: webp.blob,
            isIllustrativeImage: false,
            fromSearch: true,
            statusReason: 'ok'
          };
        } catch {
          // Si el servidor externo restringe CORS para canvas, intentar convertir miniatura o usar URL directa segura
          if (thumbUrl) {
            try {
              const thumbWebp = await convertImageSourceToWebp(thumbUrl, 800, 0.8);
              return {
                imageUrl: thumbWebp.previewUrl,
                sourceUrl: directUrl,
                previewUrl: thumbWebp.previewUrl,
                compressedBlob: thumbWebp.blob,
                isIllustrativeImage: false,
                fromSearch: true,
                statusReason: 'ok'
              };
            } catch {
              // Fallback seguro a URL directa verificada
            }
          }

          return {
            imageUrl: directUrl,
            sourceUrl: directUrl,
            previewUrl: directUrl,
            compressedBlob: null,
            isIllustrativeImage: false,
            fromSearch: true,
            statusReason: 'ok'
          };
        }
      }

      if (thumbUrl && (await canLoadImageUrl(thumbUrl))) {
        try {
          const thumbWebp = await convertImageSourceToWebp(thumbUrl, 800, 0.8);
          return {
            imageUrl: thumbWebp.previewUrl,
            sourceUrl: directUrl || thumbUrl,
            previewUrl: thumbWebp.previewUrl,
            compressedBlob: thumbWebp.blob,
            isIllustrativeImage: false,
            fromSearch: true,
            statusReason: 'ok'
          };
        } catch {
          return {
            imageUrl: thumbUrl,
            sourceUrl: directUrl || thumbUrl,
            previewUrl: thumbUrl,
            compressedBlob: null,
            isIllustrativeImage: false,
            fromSearch: true,
            statusReason: 'ok'
          };
        }
      }
    }

    return {
      imageUrl: fallbackLocal.imageUrl,
      sourceUrl: '',
      previewUrl: fallbackLocal.imageUrl,
      compressedBlob: null,
      isIllustrativeImage: fallbackLocal.isIllustrativeImage,
      fromSearch: false,
      statusReason: 'no_results'
    };
  } catch (err) {
    console.warn('Error consultando búsqueda automática de imagen:', err);
    return {
      imageUrl: fallbackLocal.imageUrl,
      sourceUrl: '',
      previewUrl: fallbackLocal.imageUrl,
      compressedBlob: null,
      isIllustrativeImage: fallbackLocal.isIllustrativeImage,
      fromSearch: false,
      statusReason: 'api_error'
    };
  }
}

/**
 * Resuelve entre 3 variantes fotográficas de pizza en WebP según palabras clave
 * del nombre/sabor o rotando entre variantes no repetidas en el catálogo.
 */
function resolvePizzaVariantImage(
  normalizedName: string,
  normalizedFlavors: string,
  usedUrls: string[] = []
): AutoImageMatch {
  const combined = `${normalizedName} ${normalizedFlavors}`.trim();
  const pizzaVariants = [
    '/catalog/comida-pizza-1.webp',
    '/catalog/comida-pizza-2.webp',
    '/catalog/comida-pizza-3.webp'
  ];

  const variant1Keywords = [
    'pepperoni',
    'americana',
    'carnivora',
    'carne',
    'picante',
    'salame',
    'salami'
  ];
  const variant2Keywords = [
    '4 quesos',
    'cuatro quesos',
    'muzzarella',
    'mozzarella',
    'margherita',
    'margarita',
    'choclo',
    'palmito',
    'jamon y queso'
  ];
  const variant3Keywords = [
    'calabresa',
    'rucula',
    'fugazzeta',
    'vegetariana',
    'napolitana',
    'aceituna',
    'especial',
    'suprema',
    'jamon crudo',
    'prosciutto'
  ];

  let preferredUrl = pizzaVariants[hashString(combined || 'pizza') % 3];
  let matchLabel = 'Pizza ilustrativa';

  if (variant1Keywords.some((kw) => combined.includes(kw))) {
    preferredUrl = '/catalog/comida-pizza-1.webp';
    matchLabel = 'Pizza Pepperoni ilustrativa';
  } else if (variant2Keywords.some((kw) => combined.includes(kw))) {
    preferredUrl = '/catalog/comida-pizza-2.webp';
    matchLabel = 'Pizza Clásica / Quesos ilustrativa';
  } else if (variant3Keywords.some((kw) => combined.includes(kw))) {
    preferredUrl = '/catalog/comida-pizza-3.webp';
    matchLabel = 'Pizza Especial ilustrativa';
  }

  // Si hay otro producto en el catálogo ya usando esa variante, elegir la siguiente disponible
  if (usedUrls.length > 0) {
    const usedSet = new Set(usedUrls.map(normalizeUrlKey));
    if (usedSet.has(normalizeUrlKey(preferredUrl))) {
      const startIndex = Math.max(0, pizzaVariants.indexOf(preferredUrl));
      for (let offset = 1; offset < pizzaVariants.length; offset += 1) {
        const candidate = pizzaVariants[(startIndex + offset) % pizzaVariants.length];
        if (!usedSet.has(normalizeUrlKey(candidate))) {
          preferredUrl = candidate;
          break;
        }
      }
    }
  }

  return {
    imageUrl: preferredUrl,
    isIllustrativeImage: true,
    matchLabel
  };
}

/**
 * Detecta sabores específicos de pastas (Carbonara, Sea Food / Mariscos, Bolognesa,
 * Pesto, Cuatro Quesos, Alfredo) y devuelve su imagen WebP correspondiente o la pasta general.
 */
function resolvePastaImage(combinedText: string): AutoImageMatch | null {
  if (combinedText.includes('carbonara')) {
    return {
      imageUrl: '/catalog/comida-pasta-carbonara.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta Carbonara ilustrativa'
    };
  }

  if (
    combinedText.includes('sea food') ||
    combinedText.includes('seafood') ||
    combinedText.includes('marisco') ||
    combinedText.includes('frutos del mar') ||
    combinedText.includes('frutti di mare') ||
    combinedText.includes('camaron') ||
    combinedText.includes('langostino') ||
    combinedText.includes('pulpo') ||
    combinedText.includes('calamar')
  ) {
    return {
      imageUrl: '/catalog/comida-pasta-seafood.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta Sea Food ilustrativa'
    };
  }

  if (
    combinedText.includes('bolognesa') ||
    combinedText.includes('bolognese') ||
    combinedText.includes('bolonesa') ||
    combinedText.includes('ragu')
  ) {
    return {
      imageUrl: '/catalog/comida-pasta-bolognesa.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta Bolognesa ilustrativa'
    };
  }

  if (
    combinedText.includes('pesto') ||
    combinedText.includes('genovesa') ||
    combinedText.includes('albahaca')
  ) {
    return {
      imageUrl: '/catalog/comida-pasta-pesto.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta al Pesto ilustrativa'
    };
  }

  if (
    combinedText.includes('cuatro quesos') ||
    combinedText.includes('4 quesos') ||
    combinedText.includes('quattro formaggi')
  ) {
    return {
      imageUrl: '/catalog/comida-pasta-4quesos.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta Cuatro Quesos ilustrativa'
    };
  }

  if (
    combinedText.includes('alfredo') ||
    combinedText.includes('salsa blanca') ||
    combinedText.includes('bechamel')
  ) {
    return {
      imageUrl: '/catalog/comida-pasta-alfredo.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta Alfredo ilustrativa'
    };
  }

  const isGenericPasta =
    combinedText.includes('pasta') ||
    combinedText.includes('spaghetti') ||
    combinedText.includes('espagueti') ||
    combinedText.includes('tallarin') ||
    combinedText.includes('fettuccine') ||
    combinedText.includes('fetuccini') ||
    combinedText.includes('linguine') ||
    combinedText.includes('linguini') ||
    combinedText.includes('penne') ||
    combinedText.includes('raviol') ||
    combinedText.includes('noqui') ||
    combinedText.includes('gnocchi') ||
    combinedText.includes('lasagna') ||
    combinedText.includes('lasana') ||
    combinedText.includes('canelon') ||
    combinedText.includes('sorrentino') ||
    combinedText.includes('fusilli') ||
    combinedText.includes('macarron') ||
    combinedText.includes('tagliatelle');

  if (isGenericPasta) {
    return {
      imageUrl: '/catalog/comida-pasta-general.webp',
      isIllustrativeImage: true,
      matchLabel: 'Pasta ilustrativa'
    };
  }

  return null;
}

/**
 * Asigna automáticamente una imagen fotográfica WebP diferenciada por marca/estilo (Bebidas)
 * o una foto gastronómica ilustrativa acorde al plato y sus sabores (Comidas).
 */
export function resolveAutoProductImage(
  name = '',
  category = 'Comidas',
  fallbackType = '',
  flavors: string[] = [],
  usedUrls: string[] = []
): AutoImageMatch {
  const cleanName = normalizeText(name);
  const cleanFlavors = normalizeText(Array.isArray(flavors) ? flavors.join(' ') : '');
  const text = normalizeText(`${name} ${fallbackType}`);
  const combinedWithFlavors = `${text} ${cleanFlavors}`.trim();
  const isBebida = category === 'Bebidas';

  if (isBebida) {
    if (text.includes('heineken')) {
      return {
        imageUrl: '/catalog/bebida-cerveza-heineken.webp',
        isIllustrativeImage: false,
        matchLabel: 'Botella Heineken de referencia'
      };
    }

    if (text.includes('corona')) {
      return {
        imageUrl: '/catalog/bebida-cerveza-corona.webp',
        isIllustrativeImage: false,
        matchLabel: 'Botella Corona de referencia'
      };
    }

    if (text.includes('budweiser') || /\bbud\b/.test(text) || text.includes('brahma')) {
      return {
        imageUrl: '/catalog/bebida-cerveza-budweiser.webp',
        isIllustrativeImage: false,
        matchLabel: 'Botella de cerveza ámbar de referencia'
      };
    }

    if (
      text.includes('miller') ||
      text.includes('stella') ||
      text.includes('pilsen') ||
      /\bsol\b/.test(text)
    ) {
      return {
        imageUrl: '/catalog/bebida-cerveza-miller.webp',
        isIllustrativeImage: false,
        matchLabel: 'Botella dorada de cerveza de referencia'
      };
    }

    if (
      text.includes('ipa') ||
      text.includes('chopp') ||
      text.includes('chop') ||
      text.includes('tirada') ||
      text.includes('artesanal') ||
      text.includes('patagonia') ||
      text.includes('cerveza') ||
      text.includes('lager') ||
      text.includes('amber') ||
      text.includes('stout') ||
      text.includes('beer')
    ) {
      return {
        imageUrl: '/catalog/bebida-cerveza.webp',
        isIllustrativeImage: false,
        matchLabel: 'Vaso de cerveza artesanal/chopp de referencia'
      };
    }

    if (
      text.includes('cafe') ||
      text.includes('espresso') ||
      text.includes('latte') ||
      text.includes('capuccino') ||
      text.includes('cappuccino') ||
      text.includes('americano') ||
      text.includes('cortado') ||
      text.includes('mocca') ||
      text.includes('mocha') ||
      text.includes('chocolate caliente') ||
      text.includes('infusion') ||
      /\bte\b/.test(text)
    ) {
      return {
        imageUrl: '/catalog/bebida-cafe.webp',
        isIllustrativeImage: false,
        matchLabel: 'Café de referencia'
      };
    }

    if (
      text.includes('coca') ||
      text.includes('pepsi') ||
      text.includes('cola') ||
      text.includes('gaseosa oscura')
    ) {
      return {
        imageUrl: '/catalog/bebida-gaseosa-oscura.webp',
        isIllustrativeImage: false,
        matchLabel: 'Gaseosa oscura de referencia'
      };
    }

    if (
      text.includes('fanta') ||
      text.includes('naranja') ||
      text.includes('mirinda') ||
      text.includes('crush') ||
      text.includes('sprite') ||
      text.includes('7up') ||
      text.includes('citric') ||
      text.includes('pomelo') ||
      text.includes('limon') ||
      text.includes('limonada') ||
      text.includes('jugo') ||
      text.includes('tonica') ||
      text.includes('gaseosa')
    ) {
      return {
        imageUrl: '/catalog/bebida-gaseosa-citrica.webp',
        isIllustrativeImage: false,
        matchLabel: 'Gaseosa cítrica de referencia'
      };
    }

    if (
      text.includes('agua') ||
      text.includes('mineral') ||
      text.includes('dasani') ||
      text.includes('seltzer') ||
      text.includes('soda')
    ) {
      return {
        imageUrl: '/catalog/bebida-agua.webp',
        isIllustrativeImage: false,
        matchLabel: 'Agua de referencia'
      };
    }

    if (
      text.includes('vino') ||
      text.includes('malbec') ||
      text.includes('cabernet') ||
      text.includes('tinto') ||
      text.includes('merlot') ||
      text.includes('syrah') ||
      text.includes('gin') ||
      text.includes('cocktail')
    ) {
      return {
        imageUrl: '/catalog/bebida-vino.webp',
        isIllustrativeImage: false,
        matchLabel: 'Copa de bebida de referencia'
      };
    }

    if (fallbackType === 'soda') {
      return {
        imageUrl: '/catalog/bebida-gaseosa-citrica.webp',
        isIllustrativeImage: false,
        matchLabel: 'Bebida refrescante de referencia'
      };
    }

    return {
      imageUrl: '/catalog/bebida-agua.webp',
      isIllustrativeImage: false,
      matchLabel: 'Bebida de referencia'
    };
  }

  // Categoría Comidas: verificar Pizzas primero (3 variantes diferenciadas)
  if (
    cleanName.includes('pizza') ||
    cleanName.includes('muzzarella') ||
    cleanName.includes('mozzarella') ||
    cleanName.includes('calabresa') ||
    cleanName.includes('fugazzeta') ||
    cleanName.includes('margherita') ||
    cleanName.includes('margarita') ||
    cleanName.includes('pepperoni')
  ) {
    return resolvePizzaVariantImage(cleanName, cleanFlavors, usedUrls);
  }

  // Verificar Pastas y sus sabores específicos
  const pastaMatch = resolvePastaImage(combinedWithFlavors);
  if (pastaMatch) {
    return pastaMatch;
  }

  if (
    text.includes('hamburguesa') ||
    text.includes('burger') ||
    text.includes('smash') ||
    text.includes('lomito') ||
    text.includes('sandwich')
  ) {
    return {
      imageUrl: '/catalog/comida-hamburguesa.webp',
      isIllustrativeImage: true,
      matchLabel: 'Hamburguesa ilustrativa'
    };
  }

  if (text.includes('empanada') || text.includes('pastelito')) {
    return {
      imageUrl: '/catalog/comida-empanada.webp',
      isIllustrativeImage: true,
      matchLabel: 'Empanada ilustrativa'
    };
  }

  return {
    imageUrl: '/catalog/comida-general.webp',
    isIllustrativeImage: true,
    matchLabel: 'Plato ilustrativo'
  };
}

/**
 * Obtiene la imagen visible para un producto guardado o su asignación automática en WebP.
 */
export function getProductDisplayImage(product: {
  imageUrl?: string;
  isIllustrativeImage?: boolean;
  name?: string;
  category?: string;
  type?: string;
  flavors?: string[];
}): { imageUrl: string; isIllustrativeImage: boolean } {
  const savedUrl = typeof product?.imageUrl === 'string' ? product.imageUrl.trim() : '';

  if (savedUrl && !savedUrl.startsWith('/catalog/')) {
    return {
      imageUrl: savedUrl,
      isIllustrativeImage: Boolean(product.isIllustrativeImage)
    };
  }

  const auto = resolveAutoProductImage(
    product?.name || '',
    product?.category || 'Comidas',
    product?.type || '',
    Array.isArray(product?.flavors) ? product.flavors : []
  );

  if (
    savedUrl &&
    savedUrl.startsWith('/catalog/') &&
    VALID_CATALOG_WEBP_PATHS.has(savedUrl) &&
    auto.imageUrl === savedUrl
  ) {
    return {
      imageUrl: savedUrl,
      isIllustrativeImage: Boolean(product.isIllustrativeImage)
    };
  }

  return {
    imageUrl: auto.imageUrl,
    isIllustrativeImage: auto.isIllustrativeImage
  };
}
