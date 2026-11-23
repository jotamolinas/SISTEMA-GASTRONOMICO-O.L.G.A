import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Package, 
  Plus, 
  Minus, 
  Beer, 
  Flame, 
  ShoppingBag, 
  Coffee, 
  Save, 
  CheckCircle2,
  Pencil,
  Trash2,
  Camera,
  X,
  Sparkles,
  Barcode,
  RefreshCw,
  AlertCircle,
  Database,
  ChefHat,
  Check,
  AlertTriangle,
  Clock,
  Upload,
  Image as ImageIcon,
  Search,
  Wand2
} from 'lucide-react';
import { db } from '../services/firebase';
import {
  compressProductImage,
  uploadCompressedProductImage,
  resolveAutoProductImage,
  getProductDisplayImage,
  searchUniqueProductImage
} from '../services/productImageService';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import {
  seedInitialProductsIfEmpty
} from '../services/productsService';
import {
  GOURMET_PRESET_GROUPS,
  CAFE_PRESET_GROUPS,
  createDefaultGourmetOptions,
  createDefaultCafeOptions,
  normalizeGourmetOptions,
  normalizeCafeOptions
} from '../utils/customizationOptions';

/**
 * Diccionario global de prueba para simular base de datos de códigos de barra (Auto-completado Inteligente)
 */
const GLOBAL_BARCODE_DATABASE = {
  '123456789': {
    name: 'Cerveza Patagonia 710ml',
    price: 25000,
    category: 'Bebidas',
    boxSize: 24,
    unit: 'botellas',
    type: 'beer'
  },
  '789123456': {
    name: 'Vino Malbec Reserva 750ml',
    price: 85000,
    category: 'Bebidas',
    boxSize: 6,
    unit: 'botellas',
    type: 'beer'
  },
  '456789123': {
    name: 'Carne Angus Picaña 1kg',
    price: 95000,
    category: 'Comidas',
    boxSize: 10,
    unit: 'kg',
    type: 'meat'
  },
  '987654321': {
    name: 'Papas Rústicas Congeladas 2.5kg',
    price: 32000,
    category: 'Comidas',
    boxSize: 4,
    unit: 'bolsas',
    type: 'bread'
  }
};

const PRESET_FLAVORS = [
  'Muzzarella',
  'Pepperoni',
  '4 Quesos',
  'Napolitana',
  'Calabresa',
  'Pollo con Catupiry',
  'Jamón y Queso',
  'Fugazzeta',
  'Margherita',
  'Palmitos',
  'Vegetariana',
  'Bacon y Cheddar',
  'Carne Picante',
  'Choclo y Queso',
  'Rúcula y Jamón Crudo',
  'Champiñones'
];

const PASTA_PRESET_FLAVORS = [
  'Carbonara',
  'Sea Food',
  'Bolognesa',
  'Pesto',
  '4 Quesos',
  'Alfredo',
  'Mariscos',
  'Pomodoro',
  'Filetto'
];

const isPastaProductName = (name = '') =>
  /(pasta|spaghetti|espagueti|tallarin|fettuccine|fetuccini|linguine|linguini|penne|raviol|noqui|ñoqui|gnocchi|lasagna|lasaña|canelon|sorrentino|fusilli|tagliatelle)/i.test(
    name
  );

const DEFAULT_BURGER_SIZES = [
  { label: 'Simple', extraPrice: '0' },
  { label: 'Doble', extraPrice: '10000' },
  { label: 'Triple', extraPrice: '20000' }
];

const DEFAULT_BURGER_EXTRAS = [
  { label: 'Bacon Crocante', extraPrice: '5000' },
  { label: 'Extra Cheddar', extraPrice: '4000' },
  { label: 'Huevo Frito', extraPrice: '3000' },
  { label: 'Cebolla Caramelizada', extraPrice: '3000' },
  { label: 'Pepinillos', extraPrice: '3000' },
  { label: 'Aros de Cebolla', extraPrice: '5000' }
];

const DEFAULT_BURGER_REMOVALS = [
  'Sin Cebolla',
  'Sin Tomate',
  'Sin Lechuga',
  'Sin Pepinillos',
  'Sin Salsa',
  'Sin Queso'
];

export const InventoryManager = ({ onOpenProModal }) => {
  // ESTADO DINÁMICO DESDE BASE DE DATOS
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState('');

  // Formulario del Modal
  const [formData, setFormData] = useState({
    name: '',
    category: 'Comidas',
    price: '',
    stock: '24',
    boxSize: '24',
    barcode: '',
    unit: 'unidades',
    hasDailyLimit: false,
    hasFlavors: false,
    flavors: [],
    isBurgerConfig: false,
    burgerSizes: DEFAULT_BURGER_SIZES.map((s) => ({ ...s })),
    burgerExtras: DEFAULT_BURGER_EXTRAS.map((e) => ({ ...e })),
    burgerRemovals: [...DEFAULT_BURGER_REMOVALS],
    isGourmetConfig: false,
    gourmetOptions: createDefaultGourmetOptions(),
    isCafeConfig: false,
    cafeOptions: createDefaultCafeOptions()
  });
  const [newFlavorInput, setNewFlavorInput] = useState('');
  const [extraGourmetChip, setExtraGourmetChip] = useState('');
  const [extraCafeChip, setExtraCafeChip] = useState('');

  // Estado de Foto del Producto (subida comprimida, búsqueda automática única o respaldo local)
  const [customImagePreview, setCustomImagePreview] = useState('');
  const [pendingImageBlob, setPendingImageBlob] = useState(null);
  const [imageSourceType, setImageSourceType] = useState('none'); // 'none' | 'uploaded' | 'search'
  const [selectedSourceUrl, setSelectedSourceUrl] = useState('');
  const [skippedSearchUrls, setSkippedSearchUrls] = useState([]);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageStatusMessage, setImageStatusMessage] = useState('');
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Estado del Escáner de Cámara
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [autoCompleteToast, setAutoCompleteToast] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Referencia al lector Html5Qrcode
  const html5QrCodeRef = useRef(null);

  // 1. SINCRONIZACIÓN EN TIEMPO REAL CON FIRESTORE (onSnapshot con mapeo estricto { ...doc.data(), id: doc.id })
  useEffect(() => {
    setIsLoading(true);
    const colRef = collection(db, 'productos');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          seedInitialProductsIfEmpty().then(() => {
            setIsLoading(false);
          });
          return;
        }

        // Mapeo estricto del ID del documento de Firestore
        const docs = snapshot.docs;
        const firestoreProducts = docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id // Asegura que el id real del documento nunca sea sobrescrito por datos fantasma
        }));

        firestoreProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setItems(firestoreProducts);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error al sincronizar inventario desde Firestore:', err);
        setIsLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Controles Táctiles Masivos: Sumar 1 Caja en Firestore
  const handleAddBox = async (item) => {
    const boxSize = item.boxSize || 24;
    const newStock = (item.stock || 0) + boxSize;

    // Actualización optimista local inmediata
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i))
    );

    try {
      await updateDoc(doc(db, 'productos', item.id), {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Error actualizando stock de caja:', e);
    }
  };

  // Controles Táctiles Masivos: Sumar 1 Unidad en Firestore
  const handleAddUnit = async (item) => {
    const newStock = (item.stock || 0) + 1;

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i))
    );

    try {
      await updateDoc(doc(db, 'productos', item.id), {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Error sumando unidad:', e);
    }
  };

  // Controles Táctiles Masivos: Restar 1 Unidad en Firestore
  const handleSubtractUnit = async (item) => {
    const newStock = Math.max(0, (item.stock || 0) - 1);

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i))
    );

    try {
      await updateDoc(doc(db, 'productos', item.id), {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Error restando unidad:', e);
    }
  };

  // Abrir Modal para Crear Producto
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormError('');
    setFormData({
      name: '',
      category: 'Comidas',
      price: '',
      stock: '24',
      boxSize: '24',
      barcode: '',
      unit: 'unidades',
      hasDailyLimit: false,
      hasFlavors: false,
      flavors: [],
      isBurgerConfig: false,
      burgerSizes: DEFAULT_BURGER_SIZES.map((s) => ({ ...s })),
      burgerExtras: DEFAULT_BURGER_EXTRAS.map((e) => ({ ...e })),
      burgerRemovals: [...DEFAULT_BURGER_REMOVALS],
      isGourmetConfig: false,
      gourmetOptions: createDefaultGourmetOptions(),
      isCafeConfig: false,
      cafeOptions: createDefaultCafeOptions()
    });
    setNewFlavorInput('');
    setExtraGourmetChip('');
    setExtraCafeChip('');
    setCustomImagePreview('');
    setPendingImageBlob(null);
    setImageSourceType('none');
    setSelectedSourceUrl('');
    setSkippedSearchUrls([]);
    setIsCompressingImage(false);
    setIsSearchingImage(false);
    setImageError('');
    setImageStatusMessage('');
    setScannerError('');
    setAutoCompleteToast('');
    setModalOpen(true);
  };

  // Abrir Modal para Editar Producto
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormError('');

    const existingSizes = Array.isArray(item?.burgerConfig?.sizes)
      ? item.burgerConfig.sizes.map((s) => ({
          label: s.label,
          extraPrice: String(s.extraPrice ?? 0)
        }))
      : DEFAULT_BURGER_SIZES.map((s) => ({ ...s }));

    const existingExtras = Array.isArray(item?.burgerConfig?.extras)
      ? item.burgerConfig.extras.map((e) => ({
          label: e.label,
          extraPrice: String(e.extraPrice ?? 0)
        }))
      : DEFAULT_BURGER_EXTRAS.map((e) => ({ ...e }));

    const existingRemovals = Array.isArray(item?.burgerConfig?.removals)
      ? item.burgerConfig.removals
      : [...DEFAULT_BURGER_REMOVALS];

    setFormData({
      name: item.name || '',
      category: item.category === 'Bebidas' ? 'Bebidas' : 'Comidas',
      price: item.price !== undefined && item.price !== null ? String(item.price) : '',
      stock: item.stock !== undefined && item.stock !== null ? String(item.stock) : '',
      boxSize: item.boxSize !== undefined && item.boxSize !== null ? String(item.boxSize) : '24',
      barcode: item.barcode || '',
      unit: item.unit || 'unidades',
      hasDailyLimit: Boolean(item.hasDailyLimit),
      hasFlavors: Boolean(item.hasFlavors),
      flavors: Array.isArray(item.flavors) ? item.flavors : [],
      isBurgerConfig: Boolean(item.isBurgerConfig),
      burgerSizes: existingSizes,
      burgerExtras: existingExtras,
      burgerRemovals: existingRemovals,
      isGourmetConfig: Boolean(item.isGourmetConfig),
      gourmetOptions: item.gourmetOptions
        ? normalizeGourmetOptions(item.gourmetOptions)
        : createDefaultGourmetOptions(),
      isCafeConfig: Boolean(item.isCafeConfig),
      cafeOptions: item.cafeOptions
        ? normalizeCafeOptions(item.cafeOptions)
        : createDefaultCafeOptions()
    });
    setNewFlavorInput('');
    setExtraGourmetChip('');
    setExtraCafeChip('');
    const existingUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
    const existingSourceUrl =
      typeof item.sourceImageUrl === 'string' ? item.sourceImageUrl.trim() : '';
    const isRealExternalOrUploaded =
      Boolean(existingUrl) && !item.isIllustrativeImage && !existingUrl.startsWith('/catalog/');

    if (isRealExternalOrUploaded) {
      setCustomImagePreview(existingUrl);
      setImageSourceType(existingSourceUrl ? 'search' : 'uploaded');
      setSelectedSourceUrl(existingSourceUrl);
      setSkippedSearchUrls(existingSourceUrl ? [existingSourceUrl] : []);
    } else {
      setCustomImagePreview('');
      setImageSourceType('none');
      setSelectedSourceUrl('');
      setSkippedSearchUrls([]);
    }
    setPendingImageBlob(null);
    setIsCompressingImage(false);
    setIsSearchingImage(false);
    setImageError('');
    setImageStatusMessage('');
    setScannerError('');
    setAutoCompleteToast('');
    setModalOpen(true);
  };

  // Reúne URLs ya usadas en otros productos para evitar imágenes repetidas
  const getUsedCatalogUrls = (excludeId = null) => {
    const urls = [];
    for (const prod of items) {
      if (excludeId && prod.id === excludeId) continue;
      if (typeof prod.imageUrl === 'string' && prod.imageUrl.trim()) {
        urls.push(prod.imageUrl.trim());
      }
      if (typeof prod.sourceImageUrl === 'string' && prod.sourceImageUrl.trim()) {
        urls.push(prod.sourceImageUrl.trim());
      }
    }
    return urls;
  };

  // VÍA A — Búsqueda explícita de 1 foto única (evita repetidos y convierte a .webp)
  const handleSearchProductPhoto = async () => {
    const cleanName = formData.name.trim();
    if (!cleanName) {
      setImageError('Escribe el nombre del producto primero para buscar su foto.');
      return;
    }

    setImageError('');
    setImageStatusMessage('');
    setIsSearchingImage(true);

    const nextSkipped = [...skippedSearchUrls];
    if (selectedSourceUrl && !nextSkipped.includes(selectedSourceUrl)) {
      nextSkipped.push(selectedSourceUrl);
    }
    if (
      customImagePreview &&
      !customImagePreview.startsWith('data:') &&
      !nextSkipped.includes(customImagePreview)
    ) {
      nextSkipped.push(customImagePreview);
    }

    try {
      const result = await searchUniqueProductImage({
        name: cleanName,
        category: formData.category,
        flavors: formData.hasFlavors ? formData.flavors : [],
        usedUrls: getUsedCatalogUrls(editingItem?.id),
        skippedUrls: nextSkipped
      });

      if (result.fromSearch) {
        setCustomImagePreview(result.previewUrl);
        setPendingImageBlob(result.compressedBlob);
        setSelectedSourceUrl(result.sourceUrl);
        setImageSourceType('search');
        setSkippedSearchUrls(
          result.sourceUrl ? [...nextSkipped, result.sourceUrl] : nextSkipped
        );
        setImageStatusMessage(
          result.compressedBlob
            ? 'Foto real encontrada y optimizada en WebP.'
            : 'Foto real seleccionada sin duplicados.'
        );
      } else {
        setCustomImagePreview('');
        setPendingImageBlob(null);
        setSelectedSourceUrl('');
        setImageSourceType('none');
        setImageStatusMessage(
          result.statusReason === 'missing_config'
            ? 'Imagen sugerida asignada según el catálogo del local.'
            : 'No se encontraron fotos nuevas para este nombre; usando imagen sugerida.'
        );
      }
    } catch {
      setImageError('No se pudo completar la búsqueda de foto. Intenta nuevamente.');
    } finally {
      setIsSearchingImage(false);
    }
  };

  // Selección y compresión automática de foto en el navegador (máx 800px, calidad ~0.8)
  const handleProductImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageError('');
    setImageStatusMessage('');
    setIsCompressingImage(true);
    try {
      const compressed = await compressProductImage(file, 800, 0.8);
      setPendingImageBlob(compressed.blob);
      setCustomImagePreview(compressed.previewUrl);
      setImageSourceType('uploaded');
      setSelectedSourceUrl('');
      setImageStatusMessage('Foto propia optimizada en WebP (máx. 800px).');
    } catch (err) {
      setImageError(err?.message || 'No se pudo procesar la imagen seleccionada.');
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleRemoveCustomImage = () => {
    setCustomImagePreview('');
    setPendingImageBlob(null);
    setImageSourceType('none');
    setSelectedSourceUrl('');
    setImageError('');
    setImageStatusMessage('');
  };

  // Alternar chip en gourmetOptions o cafeOptions con un toque
  const toggleOptionChip = (configField, groupKey, chipLabel) => {
    setFormData((prev) => {
      const currentConfig = prev[configField] || {};
      const currentList = Array.isArray(currentConfig[groupKey]) ? currentConfig[groupKey] : [];
      const exists = currentList.includes(chipLabel);
      const updatedList = exists
        ? currentList.filter((c) => c !== chipLabel)
        : [...currentList, chipLabel];

      return {
        ...prev,
        [configField]: {
          ...currentConfig,
          [groupKey]: updatedList
        }
      };
    });
  };

  // Agregar chip personalizado extra (Gourmet o Cafetería)
  const handleAddExtraChip = (configField) => {
    const rawValue = configField === 'gourmetOptions' ? extraGourmetChip : extraCafeChip;
    const cleanLabel = rawValue.trim();
    if (!cleanLabel) return;

    setFormData((prev) => {
      const currentConfig = prev[configField] || {};
      const currentExtras = Array.isArray(currentConfig.extras) ? currentConfig.extras : [];
      if (currentExtras.some((c) => c.toLowerCase() === cleanLabel.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [configField]: {
          ...currentConfig,
          extras: [...currentExtras, cleanLabel]
        }
      };
    });

    if (configField === 'gourmetOptions') {
      setExtraGourmetChip('');
    } else {
      setExtraCafeChip('');
    }
  };

  const handleRemoveExtraChip = (configField, chipLabel) => {
    setFormData((prev) => {
      const currentConfig = prev[configField] || {};
      const currentExtras = Array.isArray(currentConfig.extras) ? currentConfig.extras : [];
      return {
        ...prev,
        [configField]: {
          ...currentConfig,
          extras: currentExtras.filter((c) => c !== chipLabel)
        }
      };
    });
  };

  // Handlers de Configurador de Hamburguesa / Sándwich
  const handleToggleBurgerSize = (presetSize) => {
    setFormData((prev) => {
      const exists = prev.burgerSizes.some((s) => s.label === presetSize.label);
      return {
        ...prev,
        burgerSizes: exists
          ? prev.burgerSizes.filter((s) => s.label !== presetSize.label)
          : [...prev.burgerSizes, { label: presetSize.label, extraPrice: presetSize.extraPrice }]
      };
    });
  };

  const handleUpdateBurgerSizePrice = (label, value) => {
    setFormData((prev) => ({
      ...prev,
      burgerSizes: prev.burgerSizes.map((s) =>
        s.label === label ? { ...s, extraPrice: value } : s
      )
    }));
  };

  const handleToggleBurgerExtra = (presetExtra) => {
    setFormData((prev) => {
      const exists = prev.burgerExtras.some((e) => e.label === presetExtra.label);
      return {
        ...prev,
        burgerExtras: exists
          ? prev.burgerExtras.filter((e) => e.label !== presetExtra.label)
          : [...prev.burgerExtras, { label: presetExtra.label, extraPrice: presetExtra.extraPrice }]
      };
    });
  };

  const handleUpdateBurgerExtraPrice = (label, value) => {
    setFormData((prev) => ({
      ...prev,
      burgerExtras: prev.burgerExtras.map((e) =>
        e.label === label ? { ...e, extraPrice: value } : e
      )
    }));
  };

  const handleToggleBurgerRemoval = (removalLabel) => {
    setFormData((prev) => {
      const exists = prev.burgerRemovals.includes(removalLabel);
      return {
        ...prev,
        burgerRemovals: exists
          ? prev.burgerRemovals.filter((r) => r !== removalLabel)
          : [...prev.burgerRemovals, removalLabel]
      };
    });
  };

  // Marcar / Desmarcar sabor predefinido con un toque
  const handleToggleFlavor = (flavor) => {
    setFormData((prev) => {
      const exists = prev.flavors.some(
        (f) => f.toLowerCase() === flavor.toLowerCase()
      );
      return {
        ...prev,
        flavors: exists
          ? prev.flavors.filter((f) => f.toLowerCase() !== flavor.toLowerCase())
          : [...prev.flavors, flavor]
      };
    });
  };

  const activePresetFlavors = isPastaProductName(formData.name)
    ? PASTA_PRESET_FLAVORS
    : PRESET_FLAVORS;

  const handleSelectAllPresetFlavors = () => {
    setFormData((prev) => {
      const merged = [...prev.flavors];
      for (const preset of activePresetFlavors) {
        if (!merged.some((f) => f.toLowerCase() === preset.toLowerCase())) {
          merged.push(preset);
        }
      }
      return {
        ...prev,
        flavors: merged
      };
    });
  };

  const handleClearFlavors = () => {
    setFormData((prev) => ({
      ...prev,
      flavors: []
    }));
  };

  // Agregar sabor personalizado de la casa y quitar sabores
  const handleAddFlavor = () => {
    const cleaned = newFlavorInput.trim();
    if (!cleaned) return;
    setFormData((prev) => {
      const exists = prev.flavors.some(
        (f) => f.toLowerCase() === cleaned.toLowerCase()
      );
      if (exists) return prev;
      return {
        ...prev,
        flavors: [...prev.flavors, cleaned]
      };
    });
    setNewFlavorInput('');
  };

  const handleRemoveFlavor = (flavorToRemove) => {
    setFormData((prev) => ({
      ...prev,
      flavors: prev.flavors.filter((f) => f !== flavorToRemove)
    }));
  };

  // Eliminar Producto en Firestore (deleteDoc) directo sin bloqueo de window.confirm
  const handleDeleteProduct = async (id, name) => {
    // 1. Validación estricta del ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      console.error('[InventoryManager] Error: ID inválido o no definido para eliminar:', id);
      showToast('Error: No se encontró un ID válido del producto.');
      return;
    }

    // 2. Ejecutar deleteDoc en Firestore directamente (sin window.confirm para no bloquear iframe)
    try {
      console.log(`[InventoryManager] Eliminando documento de Firestore en productos/${id}...`);
      await deleteDoc(doc(db, 'productos', id));
      console.log(`[InventoryManager] Documento con ID ${id} eliminado exitosamente de Firestore.`);
      // La actualización visual la maneja automáticamente el listener onSnapshot de Firestore
      showToast(`Producto "${name || 'Producto'}" eliminado`);
    } catch (error) {
      console.error('[InventoryManager] Error al eliminar producto:', error);
      const errorMessage = error?.message || 'Error al eliminar el producto.';
      showToast(`Error al eliminar: ${errorMessage}`);
    }
  };

  // Auto-completado Inteligente al leer un código de barras
  const applyBarcodeData = (code) => {
    const cleanCode = code.trim();
    const matched = GLOBAL_BARCODE_DATABASE[cleanCode];

    if (matched) {
      setFormData((prev) => ({
        ...prev,
        barcode: cleanCode,
        name: matched.name,
        price: String(matched.price),
        category: matched.category,
        boxSize: String(matched.boxSize || 24),
        unit: matched.unit
      }));
      setAutoCompleteToast(`✨ ¡Producto identificado!: "${matched.name}" auto-completado.`);
      setTimeout(() => setAutoCompleteToast(''), 4000);
    } else {
      setFormData((prev) => ({
        ...prev,
        barcode: cleanCode
      }));
    }
  };

  // Iniciar Escáner con html5-qrcode
  const startCameraScanner = async () => {
    setScannerError('');
    setIsScannerActive(true);

    setTimeout(async () => {
      try {
        const qrElement = document.getElementById('camera-barcode-reader');
        if (!qrElement) return;

        const html5QrCode = new Html5Qrcode('camera-barcode-reader');
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 160 }
          },
          (decodedText) => {
            applyBarcodeData(decodedText);
            stopCameraScanner();
          },
          () => {}
        );
      } catch (err) {
        console.warn('Error al iniciar cámara:', err);
        setScannerError('No se pudo acceder a la cámara. Revisa los permisos o usa la simulación de prueba.');
      }
    }, 150);
  };

  // Detener Escáner
  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Deteniendo scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScannerActive(false);
  };

  // Limpieza de cámara al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
          html5QrCodeRef.current = null;
        });
      }
    };
  }, []);

  // 2. GUARDAR PRODUCTO (addDoc o updateDoc)
  const handleSubmitModal = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Debes ingresar el nombre del producto.');
      return;
    }

    const numericPrice = Number(formData.price);
    if (!formData.price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setFormError('Debes ingresar un precio de venta mayor a 0 Gs.');
      return;
    }

    setIsSubmitting(true);
    await stopCameraScanner();

    try {
      const isComidas = formData.category === 'Comidas';
      const hasDailyLimit = isComidas && Boolean(formData.hasDailyLimit);
      const stockValue = isComidas
        ? hasDailyLimit
          ? Math.max(0, Number(formData.stock) || 0)
          : 999
        : Math.max(0, Number(formData.stock) || 0);
      const boxSizeValue = isComidas
        ? 1
        : Math.max(1, Number(formData.boxSize) || 24);
      const barcodeValue = isComidas ? '' : (formData.barcode || '').trim();
      const unitValue = isComidas ? 'porciones' : (formData.unit || 'unidades');
      const hasFlavorsEnabled = isComidas && Boolean(formData.hasFlavors);
      const flavorsList = hasFlavorsEnabled
        ? formData.flavors.map((f) => f.trim()).filter(Boolean)
        : [];
      const isBurgerEnabled = isComidas && Boolean(formData.isBurgerConfig);

      const burgerConfigData = isBurgerEnabled
        ? {
            sizes: formData.burgerSizes.map((s) => ({
              label: s.label,
              extraPrice: Math.max(0, Number(s.extraPrice) || 0)
            })),
            extras: formData.burgerExtras.map((ex) => ({
              label: ex.label,
              extraPrice: Math.max(0, Number(ex.extraPrice) || 0)
            })),
            removals: [...formData.burgerRemovals]
          }
        : null;

      const isGourmetEnabled = isComidas && Boolean(formData.isGourmetConfig);
      const isCafeEnabled = !isComidas && Boolean(formData.isCafeConfig);

      let finalImageUrl = '';
      let finalSourceUrl = '';
      let finalIsIllustrative = false;
      const usedCatalogUrls = getUsedCatalogUrls(editingItem?.id);

      if (pendingImageBlob) {
        finalImageUrl = await uploadCompressedProductImage(
          pendingImageBlob,
          formData.name.trim(),
          customImagePreview
        );
        finalSourceUrl = selectedSourceUrl || '';
        finalIsIllustrative = false;
      } else if (customImagePreview) {
        finalImageUrl = customImagePreview;
        finalSourceUrl = selectedSourceUrl || '';
        finalIsIllustrative = false;
      } else {
        // VÍA A automática al guardar sin foto subida: busca 1 imagen real no repetida
        const searchResult = await searchUniqueProductImage({
          name: formData.name.trim(),
          category: formData.category,
          flavors: flavorsList,
          usedUrls: usedCatalogUrls,
          skippedUrls: []
        });

        if (searchResult.fromSearch) {
          if (searchResult.compressedBlob) {
            finalImageUrl = await uploadCompressedProductImage(
              searchResult.compressedBlob,
              formData.name.trim(),
              searchResult.previewUrl
            );
          } else {
            finalImageUrl = searchResult.imageUrl;
          }
          finalSourceUrl = searchResult.sourceUrl;
          finalIsIllustrative = false;
        } else {
          const autoMatch = resolveAutoProductImage(
            formData.name.trim(),
            formData.category,
            '',
            flavorsList,
            usedCatalogUrls
          );
          finalImageUrl = autoMatch.imageUrl;
          finalSourceUrl = '';
          finalIsIllustrative = autoMatch.isIllustrativeImage;
        }
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        price: numericPrice,
        stock: stockValue,
        boxSize: boxSizeValue,
        barcode: barcodeValue,
        unit: unitValue,
        hasDailyLimit,
        isAvailable: isComidas ? (hasDailyLimit ? stockValue > 0 : true) : stockValue > 0,
        hasFlavors: hasFlavorsEnabled,
        flavors: flavorsList,
        isBurgerConfig: isBurgerEnabled,
        burgerConfig: burgerConfigData,
        isGourmetConfig: isGourmetEnabled,
        gourmetOptions: isGourmetEnabled ? formData.gourmetOptions : null,
        isCafeConfig: isCafeEnabled,
        cafeOptions: isCafeEnabled ? formData.cafeOptions : null,
        imageUrl: finalImageUrl,
        sourceImageUrl: finalSourceUrl,
        isIllustrativeImage: finalIsIllustrative,
        updatedAt: serverTimestamp()
      };

      if (editingItem) {
        const prodRef = doc(db, 'productos', editingItem.id);
        await updateDoc(prodRef, payload);
        showToast(`Producto "${formData.name.trim()}" actualizado`);
      } else {
        await addDoc(collection(db, 'productos'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        showToast(`Producto "${formData.name.trim()}" creado`);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Error guardando producto:', err);
      setFormError('No se pudo guardar el producto. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductIcon = (type, category, item) => {
    if (item?.isCafeConfig) return <Coffee className="w-5 h-5 text-orange-500" />;
    if (item?.isGourmetConfig) return <ChefHat className="w-5 h-5 text-orange-500" />;
    if (category === 'Bebidas') return <Beer className="w-5 h-5 text-orange-500" />;
    switch (type) {
      case 'beer': return <Beer className="w-5 h-5 text-orange-500" />;
      case 'bread': return <ShoppingBag className="w-5 h-5 text-orange-500" />;
      case 'meat': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'soda': return <Coffee className="w-5 h-5 text-orange-500" />;
      default: return <Package className="w-5 h-5 text-orange-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABECERA: TÍTULO Y BOTÓN NUEVO PRODUCTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#222222] border border-neutral-800 p-5 sm:p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
              Catálogo e Inventario
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Inventario Rápido y Carta Digital
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm">
            Gestiona platos, sabores, opciones de hamburguesas y stock de bebidas sincronizado con las terminales de salón.
          </p>
        </div>

        {/* BOTONES DE ACCIÓN: NUEVO PRODUCTO */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* ESTADO DE CARGA ELEGANTE EN NEGRO GRANITO */}
      {isLoading ? (
        <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <div className="w-10 h-10 border-3 border-neutral-800 border-t-orange-500 rounded-full animate-spin"></div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Cargando catálogo e inventario...</p>
            <p className="text-xs text-neutral-400">Sincronizando productos en tiempo real</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
          <Database className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Aún no hay productos en tu catálogo</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Comienza agregando tu primer producto o fardo de mercadería usando el botón superior.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primer Producto</span>
          </button>
        </div>
      ) : (
        /* 2. GRILLA DE PRODUCTOS CON CONEXIÓN EN VIVO */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {items.map((item) => {
            const isComida = item.category === 'Comidas';
            const currentCount = item.stock || 0;
            const boxSize = item.boxSize || 24;
            const boxes = Math.floor(currentCount / boxSize);
            const looseUnits = currentCount % boxSize;
            const isLowStock = isComida
              ? Boolean(item.hasDailyLimit) && currentCount <= 5
              : currentCount <= (item.minAlert || 12);
            const activeFlavorsCount =
              item.hasFlavors && Array.isArray(item.flavors) ? item.flavors.length : 0;
            const displayImage = getProductDisplayImage(item);

            return (
              <div
                key={item.id}
                className={`bg-[#222222] border rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-colors shadow-sm ${
                  isLowStock
                    ? 'border-orange-500/40 bg-[#24201e]'
                    : 'border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Encabezado del Producto + Miniatura + Acciones Minimalistas */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl bg-[#151515] border border-neutral-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {displayImage.imageUrl ? (
                        <img
                          src={displayImage.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getProductIcon(item.type, item.category, item)
                      )}
                      {displayImage.isIllustrativeImage && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          title="Imagen ilustrativa — Toca para subir la foto real de tu plato"
                          className="absolute inset-x-0 bottom-0 bg-black/75 hover:bg-orange-600/90 text-neutral-200 hover:text-white text-[9px] font-semibold tracking-wide text-center py-0.5 border-t border-neutral-700/60 transition-colors cursor-pointer"
                        >
                          Ilustrativa
                        </button>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          {item.category}
                        </span>
                        {isComida && activeFlavorsCount > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/30">
                            {activeFlavorsCount} {activeFlavorsCount === 1 ? 'Sabor Activo' : 'Sabores Activos'}
                          </span>
                        )}
                        {isComida && item.isBurgerConfig && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/30">
                            Tamaños y Extras
                          </span>
                        )}
                        {isComida && item.isGourmetConfig && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <ChefHat className="w-3 h-3" />
                            Gourmet
                          </span>
                        )}
                        {!isComida && item.isCafeConfig && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <Coffee className="w-3 h-3" />
                            Cafetería
                          </span>
                        )}
                        {!isComida && item.barcode && (
                          <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-orange-500" />
                            {item.barcode}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-base leading-snug truncate mt-0.5">
                        {item.name}
                      </h3>
                    </div>
                  </div>

                  {/* BOTONES MINIMALISTAS DE EDITAR Y ELIMINAR */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-[#151515] rounded-lg transition-colors cursor-pointer"
                      title="Editar producto"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(item.id, item.name)}
                      className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CUERPO DIFERENCIADO: COMIDAS (CARTA/SABORES/CUPO) VS BEBIDAS (CAJAS/STOCK) */}
                {isComida ? (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div className="py-4 px-4 bg-[#151515] rounded-xl border border-neutral-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                          Estado en Carta
                        </span>
                        {item.hasDailyLimit ? (
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`text-3xl font-black font-mono tracking-tight ${
                                currentCount <= 0 ? 'text-red-400' : 'text-orange-400'
                              }`}
                            >
                              {currentCount}
                            </span>
                            <span className="text-xs text-neutral-300 font-medium">
                              porciones (Cupo diario)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-sm font-bold text-emerald-400">
                              En Carta / Disponible
                            </span>
                          </div>
                        )}
                      </div>

                      {item.price > 0 && (
                        <div className="bg-[#222222] px-3.5 py-2 rounded-lg border border-neutral-800 text-center shrink-0">
                          <span className="text-[10px] text-neutral-400 font-medium block">
                            Precio de Venta
                          </span>
                          <span className="text-sm font-bold text-orange-500 font-mono">
                            Gs. {Number(item.price).toLocaleString('es-PY')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Lista compacta de sabores activos si tiene sabores habilitados */}
                    {item.hasFlavors && activeFlavorsCount > 0 && (
                      <div className="px-3.5 py-2.5 bg-[#151515] rounded-xl border border-neutral-800/80">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1.5">
                          Sabores disponibles ({activeFlavorsCount}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.flavors.slice(0, 6).map((flv) => (
                            <span
                              key={flv}
                              className="px-2 py-0.5 rounded bg-[#222222] border border-neutral-800 text-[11px] text-neutral-200 font-medium"
                            >
                              {flv}
                            </span>
                          ))}
                          {activeFlavorsCount > 6 && (
                            <span className="px-2 py-0.5 rounded bg-orange-600/20 border border-orange-500/30 text-[11px] text-orange-400 font-semibold">
                              +{activeFlavorsCount - 6} más
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ajuste rápido solo si tiene cupo diario limitado */}
                    {item.hasDailyLimit && (
                      <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-400 font-medium">
                          Ajustar cupo de hoy:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSubtractUnit(item)}
                            className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors border border-neutral-700/60 cursor-pointer active:scale-95"
                            title="Restar 1 porción"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddUnit(item)}
                            className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors border border-neutral-700/60 cursor-pointer active:scale-95"
                            title="Sumar 1 porción"
                          >
                            <Plus className="w-4 h-4 text-orange-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* CENTRO BEBIDAS: 'STOCK TOTAL' CON NÚMERO MUY GRANDE EN COLOR CLARO */}
                    <div className="my-3 py-4 px-5 bg-[#151515] rounded-xl border border-neutral-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                      <div>
                        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                          Stock Disponible
                        </span>
                        <div className="flex items-baseline gap-2 justify-center sm:justify-start mt-0.5">
                          <span
                            className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                              currentCount <= 0 ? 'text-red-400' : 'text-white'
                            }`}
                          >
                            {currentCount}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium lowercase">
                            {item.unit || 'unidades'}
                          </span>
                        </div>
                      </div>

                      {/* Desglose en Cajas + Unidades */}
                      <div className="bg-[#222222] px-3.5 py-2 rounded-lg border border-neutral-800 text-center shrink-0">
                        <span className="text-[10px] text-neutral-400 font-medium block">
                          Desglose en Almacén
                        </span>
                        <span className="text-xs font-bold text-orange-400 font-mono">
                          {boxes} {boxes === 1 ? 'Caja' : 'Cajas'} + {looseUnits}u
                        </span>
                        {item.price > 0 && (
                          <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                            Gs. {Number(item.price).toLocaleString('es-PY')} c/u
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CONTROLES TÁCTILES MASIVOS PARA BEBIDAS */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleAddBox(item)}
                        className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-neutral-700/60 cursor-pointer active:scale-97 shadow-xs"
                      >
                        <Package className="w-4 h-4 text-orange-500" />
                        <span>📦 +1 Caja ({boxSize}u)</span>
                      </button>

                      <div className="flex items-center gap-2 justify-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSubtractUnit(item)}
                          className="w-12 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors border border-neutral-700/60 cursor-pointer active:scale-95"
                          title="Restar 1 unidad"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="text-xs text-neutral-400 font-mono font-semibold px-1">
                          1u
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAddUnit(item)}
                          className="w-12 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors border border-neutral-700/60 cursor-pointer active:scale-95"
                          title="Sumar 1 unidad"
                        >
                          <Plus className="w-4 h-4 text-orange-500" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE PRODUCTO (SUPERPUESTO EN NEGRO GRANITO)          */}
      {/* ========================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-white text-base">
                  {editingItem ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  setModalOpen(false);
                }}
                className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notificación de Auto-Completado Inteligente */}
            {autoCompleteToast && (
              <div className="mt-4 p-3 bg-neutral-900 border border-orange-500/60 rounded-xl flex items-center gap-2 text-xs text-orange-400 animate-in fade-in">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="font-semibold">{autoCompleteToast}</span>
              </div>
            )}

            {/* Alerta de Validación dentro del Modal */}
            {formError && (
              <div className="mt-4 p-3 bg-red-950/70 border border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitModal} noValidate className="mt-4 space-y-4">
              {/* Categoría (Comidas / Bebidas) y Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      if (nextCat === 'Comidas') {
                        stopCameraScanner();
                      }
                      setFormData((prev) => ({
                        ...prev,
                        category: nextCat
                      }));
                    }}
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Comidas">Comida</option>
                    <option value="Bebidas">Bebida</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Precio de Venta (Gs.) <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.price}
                    onChange={(e) => {
                      if (formError) setFormError('');
                      setFormData({ ...formData, price: e.target.value });
                    }}
                    placeholder="Ej: 60000"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Nombre del Plato o Producto */}
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  {formData.category === 'Comidas' ? 'Nombre del Plato' : 'Nombre del Producto'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={
                    formData.category === 'Comidas'
                      ? 'Ej: Pizza Grande 8 porciones'
                      : 'Ej: Cerveza Patagonia 710ml'
                  }
                  className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Foto del Producto (Subida comprimida, búsqueda única o respaldo automático) */}
              {(() => {
                const autoMatch = resolveAutoProductImage(
                  formData.name,
                  formData.category,
                  '',
                  formData.hasFlavors ? formData.flavors : [],
                  getUsedCatalogUrls(editingItem?.id)
                );
                const previewSrc = customImagePreview || autoMatch.imageUrl;
                const hasCustomOrSearchPhoto = Boolean(customImagePreview);
                const isUploadedPhoto = hasCustomOrSearchPhoto && imageSourceType === 'uploaded';
                const isSearchPhoto = hasCustomOrSearchPhoto && imageSourceType === 'search';
                const isIllustrativePreview = !hasCustomOrSearchPhoto && autoMatch.isIllustrativeImage;
                const isProcessingPhoto = isCompressingImage || isSearchingImage;

                return (
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-2.5">
                    <div className="flex items-start gap-3.5">
                      <div className="w-20 h-20 rounded-xl bg-[#222222] border border-neutral-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                        {isProcessingPhoto ? (
                          <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                        ) : (
                          <img
                            src={previewSrc}
                            alt={formData.name || 'Vista previa del producto'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span
                          className={`absolute inset-x-0 bottom-0 text-[9px] font-semibold text-center py-0.5 ${
                            hasCustomOrSearchPhoto
                              ? 'bg-orange-600/90 text-white'
                              : isIllustrativePreview
                              ? 'bg-black/75 text-neutral-200 border-t border-neutral-700/60'
                              : 'bg-black/75 text-neutral-300 border-t border-neutral-700/60'
                          }`}
                        >
                          {isUploadedPhoto
                            ? 'Foto propia'
                            : isSearchPhoto
                            ? 'Foto asignada'
                            : isIllustrativePreview
                            ? 'Ilustrativa'
                            : 'Referencia'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span>Foto del Producto</span>
                          </span>
                          <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                            {imageStatusMessage
                              ? imageStatusMessage
                              : isUploadedPhoto
                              ? 'Foto propia optimizada en WebP (máx. 800px).'
                              : isSearchPhoto
                              ? 'Foto real única asignada según el nombre del producto.'
                              : isIllustrativePreview
                              ? 'Al guardar sin foto, buscaremos 1 imagen acorde o puedes subir una propia.'
                              : `${autoMatch.matchLabel} asignada automáticamente.`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleProductImageSelect(e)}
                            className="hidden"
                          />
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleProductImageSelect(e)}
                            className="hidden"
                          />

                          <button
                            type="button"
                            disabled={isProcessingPhoto}
                            onClick={() => galleryInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-700/70 text-[11px] font-semibold text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Upload className="w-3 h-3 text-orange-500" />
                            <span>{isUploadedPhoto ? 'Subir otra' : 'Galería'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessingPhoto}
                            onClick={() => cameraInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-700/70 text-[11px] font-semibold text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-3 h-3 text-orange-500" />
                            <span>Cámara</span>
                          </button>

                          {/* VÍA A: Botón explícito para buscar / rotar 1 foto única */}
                          <button
                            type="button"
                            disabled={isProcessingPhoto}
                            onClick={() => handleSearchProductPhoto()}
                            className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-700/70 text-[11px] font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Search className="w-3 h-3 text-orange-500" />
                            <span>{isSearchPhoto ? 'Cambiar foto' : 'Buscar foto'}</span>
                          </button>

                          {hasCustomOrSearchPhoto && (
                            <button
                              type="button"
                              disabled={isProcessingPhoto}
                              onClick={() => handleRemoveCustomImage()}
                              className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/70 border border-red-900/50 text-[11px] font-semibold text-red-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              <span>Quitar</span>
                            </button>
                          )}
                        </div>

                        {/* VÍA B: Botón visual exclusivo Plan Pro al subir foto propia */}
                        {isUploadedPhoto && (
                          <button
                            type="button"
                            onClick={() => onOpenProModal && onOpenProModal()}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/50 text-[11px] font-semibold text-orange-300 hover:text-orange-200 flex items-center justify-center sm:justify-start gap-2 transition-colors cursor-pointer active:scale-95"
                          >
                            <Wand2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span>Mejorar foto con IA</span>
                            <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-black uppercase tracking-wider leading-none">
                              PRO
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {imageError && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1.5 pt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{imageError}</span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ===================================================== */}
              {/* BLOQUE EXCLUSIVO PARA BEBIDAS (CÓDIGO DE BARRAS/STOCK) */}
              {/* ===================================================== */}
              {formData.category === 'Bebidas' && (
                <>
                  {/* CAMPO DE CÓDIGO DE BARRAS CON BOTÓN '📷 ESCANEAR' */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Barcode className="w-4 h-4 text-orange-500" />
                        <span>Código de Barras</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          if (isScannerActive) {
                            stopCameraScanner();
                          } else {
                            startCameraScanner();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isScannerActive
                            ? 'bg-red-950/80 text-red-300 border border-red-800'
                            : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isScannerActive ? 'Cerrar Cámara' : '📷 Escanear'}</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value) applyBarcodeData(e.target.value);
                        }}
                        placeholder="Escribe o escanea el código (ej. 123456789)..."
                        className="flex-1 px-3 py-2 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                      />

                      <button
                        type="button"
                        onClick={() => applyBarcodeData('123456789')}
                        className="px-2.5 py-1.5 bg-[#222222] hover:bg-neutral-800 text-[10px] font-mono text-orange-400 border border-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Simular lectura de prueba"
                      >
                        Test: 123456789
                      </button>
                    </div>

                    {isScannerActive && (
                      <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                        <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                          <span>Apunta la cámara al código de barras:</span>
                          <button
                            type="button"
                            onClick={stopCameraScanner}
                            className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>

                        <div
                          id="camera-barcode-reader"
                          className="w-full h-56 bg-black rounded-xl overflow-hidden border border-neutral-700"
                        />

                        {scannerError && (
                          <p className="text-[11px] text-red-400 mt-1">{scannerError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stock (Unidades) y Unidades por Caja (Fardo) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        Stock (Unidades)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        placeholder="Ej: 24"
                        className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        Unidades por Caja (Fardo)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.boxSize}
                        onChange={(e) => setFormData({ ...formData, boxSize: e.target.value })}
                        placeholder="24"
                        className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Opciones de Cafetería / Preparación (Leche, Tamaño y Temperatura) */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Coffee className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span>Opciones de Cafetería / Preparación (Leche, Tamaño y Temperatura)</span>
                        </span>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Chips rápidos en el POS para café, jugos, infusiones y tragos de barra.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isCafeConfig)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isCafeConfig: e.target.checked
                          }))
                        }
                        className="w-4 h-4 accent-orange-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    {formData.isCafeConfig && (
                      <div className="pt-3 border-t border-neutral-800 space-y-3">
                        {CAFE_PRESET_GROUPS.map((group) => {
                          const selectedInGroup = formData.cafeOptions?.[group.key] || [];
                          return (
                            <div key={group.key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                  {group.label}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {selectedInGroup.length}/{group.chips.length}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.chips.map((chip) => {
                                  const isActive = selectedInGroup.includes(chip);
                                  const activeStyles =
                                    group.key === 'entrega'
                                      ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                                      : 'bg-orange-600 border-orange-500 text-white';

                                  return (
                                    <button
                                      key={chip}
                                      type="button"
                                      onClick={() => toggleOptionChip('cafeOptions', group.key, chip)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 active:scale-95 ${
                                        isActive
                                          ? activeStyles
                                          : 'bg-[#222222] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                                      }`}
                                    >
                                      {isActive && <Check className="w-3 h-3 shrink-0" />}
                                      <span>{chip}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Chip extra opcional para Cafetería */}
                        <div className="pt-2 border-t border-neutral-800/70 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Chip Extra (Opcional)
                          </span>
                          {Array.isArray(formData.cafeOptions?.extras) &&
                            formData.cafeOptions.extras.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {formData.cafeOptions.extras.map((extra) => (
                                  <span
                                    key={extra}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-600/20 border border-orange-500/50 text-orange-300 flex items-center gap-1.5"
                                  >
                                    <span>{extra}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExtraChip('cafeOptions', extra)}
                                      className="text-orange-300 hover:text-white cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={extraCafeChip}
                              onChange={(e) => setExtraCafeChip(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddExtraChip('cafeOptions');
                                }
                              }}
                              placeholder="Ej: Tamaño Grande, Sin Azúcar, Con Canela..."
                              className="flex-1 px-3 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddExtraChip('cafeOptions')}
                              disabled={!extraCafeChip.trim()}
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-orange-400 text-xs font-semibold border border-neutral-700/60 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ===================================================== */}
              {/* BLOQUE EXCLUSIVO PARA COMIDAS (DISPONIBILIDAD/SABORES) */}
              {/* ===================================================== */}
              {formData.category === 'Comidas' && (
                <>
                  {/* Toggle de Disponibilidad */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-3">
                    <span className="text-xs font-semibold text-neutral-300 block">
                      Disponibilidad del Plato
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, hasDailyLimit: false }))
                        }
                        className={`py-2.5 px-3 rounded-lg text-xs font-semibold text-left border transition-colors cursor-pointer ${
                          !formData.hasDailyLimit
                            ? 'bg-orange-600 border-orange-500 text-white'
                            : 'bg-[#222222] border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        Disponible hoy (Preparación al momento)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            hasDailyLimit: true,
                            stock: prev.stock === '999' || !prev.stock ? '20' : prev.stock
                          }))
                        }
                        className={`py-2.5 px-3 rounded-lg text-xs font-semibold text-left border transition-colors cursor-pointer ${
                          formData.hasDailyLimit
                            ? 'bg-orange-600 border-orange-500 text-white'
                            : 'bg-[#222222] border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        Cupo diario limitado
                      </button>
                    </div>

                    {formData.hasDailyLimit && (
                      <div className="pt-2 border-t border-neutral-800">
                        <label className="text-xs font-semibold text-neutral-300 block mb-1">
                          Porciones disponibles hoy
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                          placeholder="Ej: 20"
                          className="w-full px-3 py-2 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Configuración de Sabores con Chips Predefinidos */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Habilitar selección de sabores (Entero / Mitad y Mitad)
                        </span>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Ideal para Pizzas o Empanadas con múltiples gustos.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.hasFlavors)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            hasFlavors: e.target.checked
                          }))
                        }
                        className="w-4 h-4 accent-orange-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    {formData.hasFlavors && (
                      <div className="pt-3 border-t border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                            Sabores Predefinidos ({formData.flavors.length} marcados)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSelectAllPresetFlavors}
                              className="px-2.5 py-1 rounded-md bg-[#222222] hover:bg-neutral-800 border border-neutral-700/60 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                            >
                              Marcar todos
                            </button>
                            <button
                              type="button"
                              onClick={handleClearFlavors}
                              className="px-2.5 py-1 rounded-md bg-[#222222] hover:bg-neutral-800 border border-neutral-700/60 text-[11px] font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            >
                              Limpiar
                            </button>
                          </div>
                        </div>

                        {/* Grilla táctil de sabores predefinidos */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {activePresetFlavors.map((flavor) => {
                            const isChecked = formData.flavors.some(
                              (f) => f.toLowerCase() === flavor.toLowerCase()
                            );
                            return (
                              <button
                                key={flavor}
                                type="button"
                                onClick={() => handleToggleFlavor(flavor)}
                                className={`px-2.5 py-2 rounded-lg text-xs font-semibold text-left border transition-colors cursor-pointer truncate ${
                                  isChecked
                                    ? 'bg-orange-600 text-white border-orange-500'
                                    : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                                }`}
                              >
                                {flavor}
                              </button>
                            );
                          })}
                        </div>

                        {/* Sabores personalizados adicionales si existen */}
                        {formData.flavors.some(
                          (f) =>
                            !activePresetFlavors.some(
                              (p) => p.toLowerCase() === f.toLowerCase()
                            )
                        ) && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                              Sabores de la casa agregados:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {formData.flavors
                                .filter(
                                  (f) =>
                                    !activePresetFlavors.some(
                                      (p) => p.toLowerCase() === f.toLowerCase()
                                    )
                                )
                                .map((customFlavor) => (
                                  <span
                                    key={customFlavor}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-semibold"
                                  >
                                    <span>{customFlavor}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFlavor(customFlavor)}
                                      className="text-white/80 hover:text-white transition-colors cursor-pointer"
                                      title={`Quitar ${customFlavor}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Input pequeño para sabor especial de la casa */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={newFlavorInput}
                            onChange={(e) => setNewFlavorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddFlavor();
                              }
                            }}
                            placeholder="Otro sabor especial de la casa..."
                            className="flex-1 px-3 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddFlavor}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Agregar sabor especial"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Configurador Rápido para Hamburguesas / Sándwiches */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Personalización de Hamburguesa / Sándwich (Tamaños, Extras y Quitar ingredientes)
                        </span>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Permite elegir medallones, toppings pagos y quitar ingredientes sin cargo.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isBurgerConfig)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isBurgerConfig: e.target.checked
                          }))
                        }
                        className="w-4 h-4 accent-orange-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    {formData.isBurgerConfig && (
                      <div className="pt-3 border-t border-neutral-800 space-y-4">
                        {/* 1. Tamaños / Medallones */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Tamaños / Medallones (con recargo opcional)
                          </span>
                          <div className="space-y-1.5">
                            {DEFAULT_BURGER_SIZES.map((presetSize) => {
                              const activeSize = formData.burgerSizes.find(
                                (s) => s.label === presetSize.label
                              );
                              const isChecked = Boolean(activeSize);
                              return (
                                <div
                                  key={presetSize.label}
                                  className="flex items-center justify-between gap-2 bg-[#222222] p-2 rounded-lg border border-neutral-800"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBurgerSize(presetSize)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                      isChecked
                                        ? 'bg-orange-600 text-white border-orange-500'
                                        : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white'
                                    }`}
                                  >
                                    {presetSize.label}
                                  </button>
                                  {isChecked && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-neutral-400">+</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={activeSize.extraPrice}
                                        onChange={(e) =>
                                          handleUpdateBurgerSizePrice(presetSize.label, e.target.value)
                                        }
                                        className="w-24 px-2 py-1 bg-[#151515] border border-neutral-700 rounded text-xs text-white font-mono text-right focus:outline-none focus:border-orange-500"
                                      />
                                      <span className="text-[11px] text-neutral-400 font-mono">Gs.</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Toppings / Extras Pagos */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Toppings / Extras Pagos (con recargo opcional)
                          </span>
                          <div className="space-y-1.5">
                            {DEFAULT_BURGER_EXTRAS.map((presetExtra) => {
                              const activeExtra = formData.burgerExtras.find(
                                (e) => e.label === presetExtra.label
                              );
                              const isChecked = Boolean(activeExtra);
                              return (
                                <div
                                  key={presetExtra.label}
                                  className="flex items-center justify-between gap-2 bg-[#222222] p-2 rounded-lg border border-neutral-800"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBurgerExtra(presetExtra)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-left ${
                                      isChecked
                                        ? 'bg-orange-600 text-white border-orange-500'
                                        : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white'
                                    }`}
                                  >
                                    {presetExtra.label}
                                  </button>
                                  {isChecked && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-neutral-400">+</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={activeExtra.extraPrice}
                                        onChange={(e) =>
                                          handleUpdateBurgerExtraPrice(presetExtra.label, e.target.value)
                                        }
                                        className="w-24 px-2 py-1 bg-[#151515] border border-neutral-700 rounded text-xs text-white font-mono text-right focus:outline-none focus:border-orange-500"
                                      />
                                      <span className="text-[11px] text-neutral-400 font-mono">Gs.</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Quitar Ingredientes (Sin cargo) */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Quitar Ingredientes (Sin cargo)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {DEFAULT_BURGER_REMOVALS.map((rem) => {
                              const isChecked = formData.burgerRemovals.includes(rem);
                              return (
                                <button
                                  key={rem}
                                  type="button"
                                  onClick={() => handleToggleBurgerRemoval(rem)}
                                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold text-left border transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-orange-600 text-white border-orange-500'
                                      : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                                  }`}
                                >
                                  {rem}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Configurador Rápido para Cocina Gourmet / Platos Elaborados */}
                  <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <ChefHat className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span>Opciones de Cocina Gourmet (Cocción, Alergias y Tiempos)</span>
                        </span>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Punto de cocción, restricciones alimentarias y tiempo de salida para platos elaborados.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isGourmetConfig)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isGourmetConfig: e.target.checked
                          }))
                        }
                        className="w-4 h-4 accent-orange-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    {formData.isGourmetConfig && (
                      <div className="pt-3 border-t border-neutral-800 space-y-3">
                        {GOURMET_PRESET_GROUPS.map((group) => {
                          const selectedInGroup = formData.gourmetOptions?.[group.key] || [];
                          return (
                            <div key={group.key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                                  {group.key === 'alergias' && (
                                    <AlertTriangle className="w-3 h-3 text-red-400" />
                                  )}
                                  {group.key === 'tiempo' && (
                                    <Clock className="w-3 h-3 text-amber-400" />
                                  )}
                                  <span>{group.label}</span>
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {selectedInGroup.length}/{group.chips.length}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.chips.map((chip) => {
                                  const isActive = selectedInGroup.includes(chip);
                                  const activeStyles =
                                    group.key === 'alergias'
                                      ? 'bg-red-950/90 border-red-500/80 text-red-200'
                                      : group.key === 'tiempo'
                                      ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                                      : 'bg-orange-600 border-orange-500 text-white';

                                  return (
                                    <button
                                      key={chip}
                                      type="button"
                                      onClick={() => toggleOptionChip('gourmetOptions', group.key, chip)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 active:scale-95 ${
                                        isActive
                                          ? activeStyles
                                          : 'bg-[#222222] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                                      }`}
                                    >
                                      {isActive && <Check className="w-3 h-3 shrink-0" />}
                                      <span>{chip}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Chip extra opcional para Gourmet */}
                        <div className="pt-2 border-t border-neutral-800/70 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Chip Extra (Opcional)
                          </span>
                          {Array.isArray(formData.gourmetOptions?.extras) &&
                            formData.gourmetOptions.extras.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {formData.gourmetOptions.extras.map((extra) => (
                                  <span
                                    key={extra}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-600/20 border border-orange-500/50 text-orange-300 flex items-center gap-1.5"
                                  >
                                    <span>{extra}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExtraChip('gourmetOptions', extra)}
                                      className="text-orange-300 hover:text-white cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={extraGourmetChip}
                              onChange={(e) => setExtraGourmetChip(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddExtraChip('gourmetOptions');
                                }
                              }}
                              placeholder="Ej: Salsa aparte, Sin sal, Extra guarnición..."
                              className="flex-1 px-3 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddExtraChip('gourmetOptions')}
                              disabled={!extraGourmetChip.trim()}
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-orange-400 text-xs font-semibold border border-neutral-700/60 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Botones del Modal */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraScanner();
                    setModalOpen(false);
                  }}
                  className="py-2.5 px-4 bg-[#151515] hover:bg-neutral-800 text-neutral-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-6 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Actualizar' : 'Guardar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST MINIMALISTA DE CONFIRMACIÓN */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in">
          <div className="bg-[#222222] border border-orange-500/60 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
            <div>
              <p className="font-semibold text-white">{toastMessage}</p>
              <p className="text-[11px] text-neutral-400">Sincronizado en tiempo real</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;
