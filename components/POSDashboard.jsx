import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { db } from '../services/firebase';
import { 
  writeBatch, 
  doc, 
  collection, 
  addDoc,
  increment, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { seedInitialProductsIfEmpty } from '../services/productsService';
import { 
  ArrowLeft,
  UtensilsCrossed, 
  Beer, 
  Pizza, 
  Coffee, 
  Flame, 
  Wine, 
  Search, 
  Plus, 
  Minus, 
  Pencil,
  Trash2, 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  X, 
  ShoppingBag, 
  Send, 
  LogOut,
  RefreshCw,
  AlertCircle,
  Database,
  ChefHat,
  AlertTriangle,
  Clock,
  Check,
  Printer
} from 'lucide-react';
import {
  GOURMET_PRESET_GROUPS,
  CAFE_PRESET_GROUPS,
  normalizeGourmetOptions,
  normalizeCafeOptions,
  normalizeSelectedTags,
  isAllergyTag,
  isTimingTag,
  buildCartItemKey
} from '../utils/customizationOptions';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PY', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(amount) + ' Gs.';
};

// Íconos sobrios de productos
const ProductIcon = ({ type, category, isGourmetConfig, isCafeConfig }) => {
  if (isCafeConfig) return <Coffee className="w-6 h-6 text-orange-500" />;
  if (isGourmetConfig) return <ChefHat className="w-6 h-6 text-orange-500" />;
  if (category === 'Bebidas') return <Beer className="w-6 h-6 text-orange-500" />;
  switch (type) {
    case 'burger':
    case 'meat':
      return <Flame className="w-6 h-6 text-orange-500" />;
    case 'pizza':
      return <Pizza className="w-6 h-6 text-orange-500" />;
    case 'fries':
    case 'bread':
      return <UtensilsCrossed className="w-6 h-6 text-orange-500" />;
    case 'beer':
      return <Beer className="w-6 h-6 text-orange-500" />;
    case 'lemonade':
    case 'soda':
      return <Coffee className="w-6 h-6 text-orange-500" />;
    case 'cocktail':
      return <Wine className="w-6 h-6 text-orange-500" />;
    default:
      return <UtensilsCrossed className="w-6 h-6 text-orange-500" />;
  }
};

export const POSDashboard = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();

  // 1. ESTADO SINCRONIZADO EN TIEMPO REAL
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // 2. CUENTAS SEPARADAS POR MESA (LOCAL-FIRST)
  const { 
    tableCarts, 
    activeTable, 
    setActiveTable, 
    addTable,
    renameTable,
    addToCart, 
    markItemsAsSent,
    removeFromCart, 
    removeLineItem,
    clearCart, 
    cartTotal 
  } = useCartStore();

  // Lista dinámica de mesas a partir de las llaves en tableCarts
  const tablesList = useMemo(() => {
    const keys = Object.keys(tableCarts || {});
    return keys.length > 0 ? keys : ['Mesa 1', 'Mesa 2', 'Mesa 3'];
  }, [tableCarts]);

  // Modal propio en Negro Granito para crear / renombrar mesas (prohibido window.prompt)
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableModalMode, setTableModalMode] = useState('add'); // 'add' | 'rename'
  const [tableNameInput, setTableNameInput] = useState('');

  const handleAddNewTable = () => {
    const tableCount = Object.keys(tableCarts || {}).length;
    setTableModalMode('add');
    setTableNameInput(`Mesa ${tableCount + 1}`);
    setShowTableModal(true);
  };

  const handleRenameActiveTable = () => {
    setTableModalMode('rename');
    setTableNameInput(activeTable || 'Mesa 1');
    setShowTableModal(true);
  };

  const handleSubmitTableModal = (e) => {
    if (e) e.preventDefault();
    const cleanName = tableNameInput.trim();
    if (!cleanName) return;

    if (tableModalMode === 'add') {
      addTable(cleanName);
    } else if (tableModalMode === 'rename' && cleanName !== activeTable) {
      renameTable(activeTable, cleanName);
    }
    setShowTableModal(false);
  };

  // Carrito y productos exclusivos de la mesa activa seleccionada
  const cart = tableCarts?.[activeTable] || [];

  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketNote, setTicketNote] = useState('');
  const [confirmRemoveSentId, setConfirmRemoveSentId] = useState(null);
  const [confirmClearTable, setConfirmClearTable] = useState(false);
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  // Modal Selector de Sabores (Entera / Mitad y Mitad)
  const [flavorModalProduct, setFlavorModalProduct] = useState(null);
  const [flavorMode, setFlavorMode] = useState('entera');
  const [selectedHalf1, setSelectedHalf1] = useState(null);
  const [selectedHalf2, setSelectedHalf2] = useState(null);
  const [flavorNote, setFlavorNote] = useState('');

  // Modal Configurador de Hamburguesa / Sándwich
  const [burgerModalProduct, setBurgerModalProduct] = useState(null);
  const [selectedBurgerSize, setSelectedBurgerSize] = useState(null);
  const [selectedBurgerExtras, setSelectedBurgerExtras] = useState([]);
  const [selectedBurgerRemovals, setSelectedBurgerRemovals] = useState([]);
  const [burgerNote, setBurgerNote] = useState('');

  // Modal Rápido de Personalización Gourmet / Cafetería
  const [quickModalProduct, setQuickModalProduct] = useState(null);
  const [selectedQuickTags, setSelectedQuickTags] = useState([]);
  const [quickItemNote, setQuickItemNote] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(1);

  // Estado para impresión térmica opcional 80mm
  const [printOnCheckout, setPrintOnCheckout] = useState(false);
  const [lastPaidReceipt, setLastPaidReceipt] = useState(null);
  const [activePrintReceipt, setActivePrintReceipt] = useState(null);

  // Al cambiar de mesa, reinicia confirmaciones inline abiertas
  useEffect(() => {
    setConfirmRemoveSentId(null);
    setConfirmClearTable(false);
  }, [activeTable]);

  // SUSCRIPCIÓN EN TIEMPO REAL AL CATÁLOGO (mapeo estricto { ...docSnap.data(), id: docSnap.id })
  useEffect(() => {
    setIsLoadingProducts(true);
    const colRef = collection(db, 'productos');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          seedInitialProductsIfEmpty().then(() => {
            setIsLoadingProducts(false);
          });
          return;
        }

        const docs = snapshot.docs;
        const firestoreProducts = docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));

        firestoreProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(firestoreProducts);
        setIsLoadingProducts(false);
      },
      (err) => {
        console.error('Error al sincronizar catálogo POS:', err);
        setIsLoadingProducts(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Separación de ítems pendientes de comandar vs ya enviados a cocina/barra
  const pendingItems = useMemo(() => cart.filter((item) => !item.sentToKitchen), [cart]);
  const sentItems = useMemo(() => cart.filter((item) => Boolean(item.sentToKitchen)), [cart]);

  const pendingUnitsCount = useMemo(
    () => pendingItems.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0),
    [pendingItems]
  );

  // Cantidad total de productos acumulados en la cuenta de la mesa
  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [cart]);

  // Cálculo del total reactivo derivado de toda la cuenta acumulada de la mesa activa
  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  }, [cart]);
  const taxAmount = Math.round(total * 0.10);

  const formatPrintDateTime = () =>
    new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());

  const triggerThermalPrint = (receiptSnapshot) => {
    if (!receiptSnapshot || !Array.isArray(receiptSnapshot.items) || receiptSnapshot.items.length === 0) {
      return;
    }

    setActivePrintReceipt(receiptSnapshot);
    document.body.classList.add('printing-thermal-80mm');

    const cleanup = () => {
      document.body.classList.remove('printing-thermal-80mm');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 60);
  };

  const handlePrintThermalTicket = () => {
    if (cart.length > 0) {
      triggerThermalPrint({
        tipo: 'PRE-CUENTA / TICKET DE MESA',
        mesa: activeTable || 'Mesa 1',
        items: cart.map((i) => ({ ...i })),
        total: Number(total) || 0,
        taxAmount: Number(taxAmount) || 0,
        totalItemsCount: Number(totalItemsCount) || 0,
        nota: (ticketNote || '').trim(),
        cajero: currentUser?.email?.split('@')[0] || 'Mozo Salón',
        fecha: formatPrintDateTime()
      });
    } else if (lastPaidReceipt) {
      triggerThermalPrint(lastPaidReceipt);
    }
  };

  const receiptToPrint = useMemo(() => {
    if (activePrintReceipt && activePrintReceipt.items?.length > 0) {
      return activePrintReceipt;
    }
    return {
      tipo: 'PRE-CUENTA / TICKET DE MESA',
      mesa: activeTable || 'Mesa 1',
      items: cart,
      total: Number(total) || 0,
      taxAmount: Number(taxAmount) || 0,
      totalItemsCount: Number(totalItemsCount) || 0,
      nota: (ticketNote || '').trim(),
      cajero: currentUser?.email?.split('@')[0] || 'Mozo Salón',
      fecha: formatPrintDateTime()
    };
  }, [activePrintReceipt, activeTable, cart, total, taxAmount, totalItemsCount, ticketNote, currentUser]);

  // 3. COBRO Y DESCUENTO AUTOMÁTICO (BATCH WRITE - CRÍTICO)
  const handleCobrar = async () => {
    if (cart.length === 0 || isProcessingPayment) return;

    setIsProcessingPayment(true);
    setPaymentError('');

    try {
      const batch = writeBatch(db);

      // A) Crear un nuevo documento en la colección 'ventas' con el array del carrito, el total y la fecha
      const ventasCol = collection(db, 'ventas');
      const ventaDocRef = doc(ventasCol);

      const ventaPayload = {
        id: ventaDocRef.id,
        mesa: activeTable || 'Mesa 1',
        total: Number(total) || 0,
        items: cart.map((i) => ({
          id: i.productId || i.id,
          variantId: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          flavorDetail: i.flavorDetail || '',
          flavorMode: i.flavorMode || null,
          selectedFlavors: Array.isArray(i.selectedFlavors) ? i.selectedFlavors : [],
          customizationType: i.customizationType || null,
          selectedTags: normalizeSelectedTags(i.selectedTags || []),
          customTags: i.customTags || null,
          itemNote: i.itemNote || ''
        })),
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        estado: 'completado',
        tipo: 'venta_directa'
      };

      batch.set(ventaDocRef, ventaPayload);

      // B) Agrupar descuentos por productId real (para Bebidas o Comidas con cupo diario limitado) y descontar en batch
      const stockDeductions = {};
      for (const item of cart) {
        const shouldDeductStock =
          item.category !== 'Comidas' || Boolean(item.hasDailyLimit);
        const realProductId = item.productId || item.id;
        if (realProductId && shouldDeductStock) {
          stockDeductions[realProductId] =
            (stockDeductions[realProductId] || 0) + (Number(item.quantity) || 1);
        }
      }
      for (const [realProductId, qtyToDeduct] of Object.entries(stockDeductions)) {
        const prodRef = doc(db, 'productos', realProductId);
        batch.update(prodRef, {
          stock: increment(-qtyToDeduct),
          updatedAt: serverTimestamp()
        });
      }

      // C) Ejecutar batch.commit()
      await batch.commit();

      const paidSnapshot = {
        tipo: 'COMPROBANTE DE COBRO',
        mesa: activeTable || 'Mesa 1',
        items: cart.map((i) => ({ ...i })),
        total: Number(total) || 0,
        taxAmount: Number(taxAmount) || 0,
        totalItemsCount: Number(totalItemsCount) || 0,
        nota: (ticketNote || '').trim(),
        cajero: currentUser?.email?.split('@')[0] || 'Mozo Salón',
        fecha: formatPrintDateTime()
      };
      setLastPaidReceipt(paidSnapshot);

      // D) Notificación comercial de cobro
      setSuccessToast('Cobro registrado con éxito');
      setTimeout(() => setSuccessToast(null), 3500);

      // E) Limpiar ticket de la mesa activa únicamente al COBRAR
      clearCart(activeTable);
      setTicketNote('');
      setConfirmClearTable(false);
      setConfirmRemoveSentId(null);

      // F) Impresión térmica 80mm opcional al cobrar
      if (printOnCheckout) {
        triggerThermalPrint(paidSnapshot);
      }
    } catch (err) {
      console.error('Error al procesar venta:', err);
      setPaymentError('Error al registrar la venta. Intenta de nuevo.');
      setTimeout(() => setPaymentError(''), 4000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ACCIÓN DEL BOTÓN "COMANDA": Envía ÚNICAMENTE los ítems pendientes (sentToKitchen === false)
  // y mantiene abierta la cuenta acumulada de la mesa hasta el momento de COBRAR.
  const handleSendComanda = async () => {
    if (pendingItems.length === 0 || isSendingComanda || isProcessingPayment) return;

    setIsSendingComanda(true);
    setPaymentError('');

    const itemsToSend = pendingItems.map((i) => ({ ...i }));
    const sentIds = itemsToSend.map((i) => i.id);
    const pendingUnits = itemsToSend.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);
    const pendingTotal = itemsToSend.reduce(
      (acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 1),
      0
    );

    try {
      const comandasCol = collection(db, 'comandas_activas');
      const comandaPayload = {
        mesa: activeTable || 'Mesa 1',
        items: itemsToSend.map((i) => ({
          id: i.productId || i.id,
          variantId: i.variantKey || i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          unit: i.unit || 'unidades',
          flavorDetail: i.flavorDetail || '',
          flavorMode: i.flavorMode || null,
          selectedFlavors: Array.isArray(i.selectedFlavors) ? i.selectedFlavors : [],
          customizationType: i.customizationType || null,
          selectedTags: normalizeSelectedTags(i.selectedTags || []),
          customTags: i.customTags || null,
          itemNote: i.itemNote || ''
        })),
        estado: 'en_cocina',
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        total: Number(pendingTotal) || 0
      };

      await addDoc(comandasCol, comandaPayload);

      // Marca los ítems recién enviados como sentToKitchen: true SIN vaciar el ticket de la mesa
      markItemsAsSent(activeTable, sentIds);
      setTicketNote('');

      setSuccessToast(
        `Comanda enviada (${pendingUnits} ${pendingUnits === 1 ? 'ítem nuevo' : 'ítems nuevos'})`
      );
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Error al enviar comanda:', err);
      setPaymentError('Error al enviar la comanda. Verifica la conexión.');
      setTimeout(() => setPaymentError(''), 4000);
    } finally {
      setIsSendingComanda(false);
    }
  };

  // Grupos táctiles activos para Modal Rápido Gourmet / Cafetería
  const activeQuickGroups = useMemo(() => {
    if (!quickModalProduct) return [];

    if (quickModalProduct.isGourmetConfig) {
      const opts = normalizeGourmetOptions(quickModalProduct.gourmetOptions);
      const groups = GOURMET_PRESET_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        chips: Array.isArray(opts[g.key]) ? opts[g.key] : []
      })).filter((g) => g.chips.length > 0);

      if (Array.isArray(opts.extras) && opts.extras.length > 0) {
        groups.push({ key: 'extras', label: 'Opciones Extra', chips: opts.extras });
      }
      return groups;
    }

    if (quickModalProduct.isCafeConfig) {
      const opts = normalizeCafeOptions(quickModalProduct.cafeOptions);
      const groups = CAFE_PRESET_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        chips: Array.isArray(opts[g.key]) ? opts[g.key] : []
      })).filter((g) => g.chips.length > 0);

      if (Array.isArray(opts.extras) && opts.extras.length > 0) {
        groups.push({ key: 'extras', label: 'Opciones Extra', chips: opts.extras });
      }
      return groups;
    }

    return [];
  }, [quickModalProduct]);

  const toggleQuickTag = (groupKey, chipLabel) => {
    setSelectedQuickTags((prev) => {
      const exists = prev.some((t) => t.group === groupKey && t.label === chipLabel);
      if (exists) {
        return prev.filter((t) => !(t.group === groupKey && t.label === chipLabel));
      }
      return [...prev, { group: groupKey, label: chipLabel }];
    });
  };

  const handleConfirmQuickCustomization = (e) => {
    if (e) e.preventDefault();
    if (!quickModalProduct) return;

    const cleanNote = quickItemNote.trim();
    const groupedMap = {};
    selectedQuickTags.forEach((tag) => {
      if (!groupedMap[tag.group]) groupedMap[tag.group] = [];
      groupedMap[tag.group].push(tag.label);
    });

    const variantId = buildCartItemKey(quickModalProduct.id, selectedQuickTags, cleanNote);

    addToCart({
      ...quickModalProduct,
      id: variantId,
      productId: quickModalProduct.id,
      customizationType: quickModalProduct.isGourmetConfig ? 'gourmet' : 'cafe',
      selectedTags: selectedQuickTags,
      customTags: Object.keys(groupedMap).length > 0 ? groupedMap : null,
      itemNote: cleanNote,
      quantityToAdd: quickQuantity
    });

    setQuickModalProduct(null);
    setSelectedQuickTags([]);
    setQuickItemNote('');
    setQuickQuantity(1);
  };

  // MANEJO DE PRODUCTO: SABORES / HAMBURGUESA / GOURMET / CAFETERÍA / DIRECTO
  const handleProductClick = (product) => {
    if (
      product?.hasFlavors === true &&
      Array.isArray(product.flavors) &&
      product.flavors.length > 0
    ) {
      setFlavorModalProduct(product);
      setFlavorMode('entera');
      setSelectedHalf1(null);
      setSelectedHalf2(null);
      setFlavorNote('');
      return;
    }

    if (product?.isBurgerConfig === true && product?.burgerConfig) {
      const sizes = Array.isArray(product.burgerConfig.sizes)
        ? product.burgerConfig.sizes
        : [];
      setBurgerModalProduct(product);
      setSelectedBurgerSize(sizes.length > 0 ? sizes[0] : null);
      setSelectedBurgerExtras([]);
      setSelectedBurgerRemovals([]);
      setBurgerNote('');
      return;
    }

    if (product?.isGourmetConfig === true || product?.isCafeConfig === true) {
      setQuickModalProduct(product);
      setSelectedQuickTags([]);
      setQuickItemNote('');
      setQuickQuantity(1);
      return;
    }

    addToCart(product);
  };

  const handleTogglePOSBurgerExtra = (extraObj) => {
    setSelectedBurgerExtras((prev) => {
      const exists = prev.some((e) => e.label === extraObj.label);
      return exists
        ? prev.filter((e) => e.label !== extraObj.label)
        : [...prev, extraObj];
    });
  };

  const handleTogglePOSBurgerRemoval = (remLabel) => {
    setSelectedBurgerRemovals((prev) =>
      prev.includes(remLabel)
        ? prev.filter((r) => r !== remLabel)
        : [...prev, remLabel]
    );
  };

  const computedBurgerPrice = useMemo(() => {
    if (!burgerModalProduct) return 0;
    const base = Number(burgerModalProduct.price) || 0;
    const sizeSurcharge = Number(selectedBurgerSize?.extraPrice) || 0;
    const extrasSurcharge = selectedBurgerExtras.reduce(
      (sum, e) => sum + (Number(e.extraPrice) || 0),
      0
    );
    return base + sizeSurcharge + extrasSurcharge;
  }, [burgerModalProduct, selectedBurgerSize, selectedBurgerExtras]);

  const handleConfirmBurgerSelection = () => {
    if (!burgerModalProduct) return;

    const detailParts = [];
    if (selectedBurgerSize?.label) {
      detailParts.push(selectedBurgerSize.label);
    }
    if (selectedBurgerExtras.length > 0) {
      detailParts.push(selectedBurgerExtras.map((e) => `+ ${e.label}`).join(', '));
    }
    if (selectedBurgerRemovals.length > 0) {
      detailParts.push(selectedBurgerRemovals.join(', '));
    }

    const customDetail = detailParts.join(' • ');
    const extrasKey = selectedBurgerExtras
      .map((e) => e.label)
      .sort()
      .join('+');
    const removalsKey = [...selectedBurgerRemovals].sort().join('+');
    const cleanNote = burgerNote.trim();
    const variantId = `${burgerModalProduct.id}__burger__${
      selectedBurgerSize?.label || 'std'
    }__${extrasKey}__${removalsKey}${cleanNote ? `__${cleanNote}` : ''}`;

    addToCart({
      ...burgerModalProduct,
      id: variantId,
      productId: burgerModalProduct.id,
      name: burgerModalProduct.name,
      price: computedBurgerPrice,
      flavorDetail: customDetail,
      itemNote: cleanNote
    });

    setBurgerModalProduct(null);
    setSelectedBurgerSize(null);
    setSelectedBurgerExtras([]);
    setSelectedBurgerRemovals([]);
    setBurgerNote('');
  };

  const handleSelectFlavorMode = (mode) => {
    setFlavorMode(mode);
    if (mode === 'entera') {
      setSelectedHalf2(null);
    }
  };

  const handleTapFlavor = (flavor) => {
    if (flavorMode === 'entera') {
      setSelectedHalf1(flavor);
      setSelectedHalf2(null);
      return;
    }

    // Modalidad Mitad y Mitad (2 Sabores)
    if (selectedHalf1 === flavor) {
      setSelectedHalf1(null);
      return;
    }
    if (selectedHalf2 === flavor) {
      setSelectedHalf2(null);
      return;
    }
    if (!selectedHalf1) {
      setSelectedHalf1(flavor);
    } else if (!selectedHalf2) {
      setSelectedHalf2(flavor);
    } else {
      setSelectedHalf2(flavor);
    }
  };

  const isFlavorSelectionValid =
    flavorMode === 'entera'
      ? Boolean(selectedHalf1)
      : Boolean(selectedHalf1 && selectedHalf2);

  const handleConfirmFlavorSelection = () => {
    if (!flavorModalProduct || !isFlavorSelectionValid) return;

    const flavorDetail =
      flavorMode === 'entera'
        ? `Entera: ${selectedHalf1}`
        : `1/2 ${selectedHalf1} + 1/2 ${selectedHalf2}`;

    const selectedFlavors =
      flavorMode === 'entera'
        ? [selectedHalf1]
        : [selectedHalf1, selectedHalf2];

    const cleanNote = flavorNote.trim();
    const variantKey =
      flavorMode === 'entera'
        ? `entera:${selectedHalf1}`
        : `mitad:${selectedHalf1}+${selectedHalf2}`;
    const variantId = `${flavorModalProduct.id}__${variantKey}${
      cleanNote ? `__${cleanNote}` : ''
    }`;

    addToCart({
      ...flavorModalProduct,
      id: variantId,
      productId: flavorModalProduct.id,
      name: flavorModalProduct.name,
      flavorDetail,
      flavorMode,
      selectedFlavors,
      itemNote: cleanNote
    });

    setFlavorModalProduct(null);
    setSelectedHalf1(null);
    setSelectedHalf2(null);
    setFlavorNote('');
  };

  // Filtrado de productos en vivo por categoría y buscador
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const prodCategory = (prod.category || '').toLowerCase();
      const matchesCategory =
        selectedCategory === 'todos' ||
        (selectedCategory === 'comidas' && prodCategory.includes('comida')) ||
        (selectedCategory === 'bebidas' && prodCategory.includes('bebida'));
      const matchesSearch =
        prod.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  return (
    <>
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex flex-col font-sans select-none print:hidden">
      {/* 1. BARRA SUPERIOR: NAVEGACIÓN Y MESAS */}
      <header className="h-14 bg-[#1a1a1a] border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          {/* BOTÓN MINIMALISTA DE RETORNO AL PANEL */}
          <button
            type="button"
            onClick={() => navigate('/consola')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Regresar a la administración"
          >
            <ArrowLeft className="w-4 h-4 text-orange-500" />
            <span>Volver al Panel</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          {/* Logo e indicador de sincronización en vivo */}
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-8 h-8 rounded-lg object-contain bg-black border border-neutral-800 shrink-0 shadow-xs" 
            />
            <span className="font-bold text-sm tracking-tight text-white">
              Gastro<span className="text-orange-500">POS</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#151515] text-emerald-400 border border-neutral-800 hidden md:flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Línea
            </span>
          </div>
        </div>

        {/* Selector de Mesas (Una sola línea horizontal deslizable) */}
        <div className="flex items-center gap-1.5 max-w-[45vw] sm:max-w-xs md:max-w-md lg:max-w-lg overflow-hidden">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline mr-1 shrink-0">Mesa:</span>
          <div className="flex flex-row overflow-x-auto whitespace-nowrap items-center gap-1.5 p-1 bg-[#151515] rounded-lg border border-neutral-800 hide-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tablesList.map((table) => {
              const tableItemCount = (tableCarts?.[table] || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
              return (
                <button
                  key={table}
                  type="button"
                  onClick={() => setActiveTable(table)}
                  className={`min-w-max shrink-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTable === table
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>{table}</span>
                  {tableItemCount > 0 && (
                    <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                      activeTable === table ? 'bg-orange-800 text-white' : 'bg-neutral-800 text-orange-400'
                    }`}>
                      {tableItemCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Botón + Crear Mesa */}
            <button
              type="button"
              onClick={handleAddNewTable}
              className="p-1 px-1.5 rounded-md bg-[#222222] hover:bg-neutral-800 text-orange-500 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors border border-neutral-800 shadow-xs"
              title="Añadir nueva mesa / cuenta"
            >
              <Plus className="w-3.5 h-3.5 text-orange-500" />
            </button>
          </div>
        </div>

        {/* Acceso a Cocina + Usuario / Salir */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/cocina')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Abrir monitor de cocina"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden sm:inline">Cocina</span>
          </button>

          <span className="text-xs text-neutral-400 hidden lg:inline">
            {currentUser?.email?.split('@')[0] || 'Mozo'}
          </span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. ÁREA DE TRABAJO: GRILLA Y TICKET */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ========================================================= */}
        {/* COLUMNA IZQUIERDA/CENTRO: PRODUCTOS Y FILTROS             */}
        {/* ========================================================= */}
        <section className="flex-1 flex flex-col overflow-y-auto bg-[#151515]">
          {/* PESTAÑAS ANCLADAS Y BUSCADOR */}
          <div className="sticky top-0 z-20 bg-[#151515]/95 backdrop-blur-xs border-b border-neutral-800/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('todos')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'todos'
                    ? 'bg-orange-600 text-white'
                    : 'bg-[#222222] text-neutral-400 hover:text-white'
                }`}
              >
                Todos ({products.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('comidas')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'comidas'
                    ? 'bg-orange-600 text-white'
                    : 'bg-[#222222] text-neutral-400 hover:text-white'
                }`}
              >
                Comidas
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('bebidas')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'bebidas'
                    ? 'bg-orange-600 text-white'
                    : 'bg-[#222222] text-neutral-400 hover:text-white'
                }`}
              >
                Bebidas
              </button>
            </div>

            {/* Buscador minimalista */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar plato o bebida..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ESTADO DE CARGA ELEGANTE EN NEGRO GRANITO */}
          {isLoadingProducts ? (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="bg-[#222222] rounded-xl p-4 flex items-center justify-between gap-3 border border-neutral-800 animate-pulse"
                  >
                    <div className="w-12 h-12 rounded-lg bg-[#151515] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-16 bg-neutral-800 rounded" />
                      <div className="h-4 w-32 bg-neutral-800 rounded" />
                      <div className="h-3 w-20 bg-neutral-800 rounded" />
                    </div>
                    <div className="h-11 w-16 bg-neutral-800 rounded-lg shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Database className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No se encontraron productos</p>
              <p className="text-xs text-neutral-400">
                Los productos que el dueño cargue en "Inventario Rápido" aparecerán automáticamente aquí.
              </p>
            </div>
          ) : (
            /* GRILLA DE PRODUCTOS SINCRONIZADA */
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredProducts.map((product) => {
                  const inCartQty = cart
                    .filter((i) => (i.productId || i.id) === product.id)
                    .reduce((acc, i) => acc + (i.quantity || 1), 0);
                  const inCart = inCartQty > 0;
                  const isMadeToOrder =
                    product.category === 'Comidas' && !product.hasDailyLimit;
                  const isOutOfStock = !isMadeToOrder && (product.stock || 0) <= 0;
                  const hasFlavors =
                    product.hasFlavors === true &&
                    Array.isArray(product.flavors) &&
                    product.flavors.length > 0;
                  const hasBurgerConfig =
                    product.isBurgerConfig === true && Boolean(product.burgerConfig);
                  const hasGourmetConfig = product.isGourmetConfig === true;
                  const hasCafeConfig = product.isCafeConfig === true;
                  const isCustomizable =
                    hasFlavors || hasBurgerConfig || hasGourmetConfig || hasCafeConfig;

                  return (
                    <div
                      key={product.id}
                      className={`bg-[#222222] rounded-xl p-4 flex items-center justify-between gap-3 transition-colors border ${
                        inCart
                          ? 'border-orange-500/50 bg-[#262626]'
                          : isOutOfStock
                          ? 'border-neutral-800/50 opacity-75'
                          : 'border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      {/* Ícono a la izquierda */}
                      <div className="w-12 h-12 rounded-lg bg-[#151515] border border-neutral-800 flex items-center justify-center shrink-0">
                        <ProductIcon
                          type={product.icon}
                          category={product.category}
                          isGourmetConfig={hasGourmetConfig}
                          isCafeConfig={hasCafeConfig}
                        />
                      </div>

                      {/* Título, precio y disponibilidad */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-medium text-neutral-400 uppercase">
                            {product.category}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                              isOutOfStock
                                ? 'bg-red-950/80 text-red-400 border border-red-900/60'
                                : isMadeToOrder
                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                                : 'bg-[#151515] text-neutral-400 border border-neutral-800'
                            }`}
                          >
                            {isOutOfStock
                              ? 'Agotado'
                              : isMadeToOrder
                              ? 'En Carta'
                              : product.category === 'Comidas'
                              ? `Cupo: ${product.stock}`
                              : `Stock: ${product.stock}u`}
                          </span>
                          {hasFlavors && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30">
                              Sabores
                            </span>
                          )}
                          {hasBurgerConfig && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30">
                              Personalizable
                            </span>
                          )}
                          {hasGourmetConfig && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30">
                              Gourmet
                            </span>
                          )}
                          {hasCafeConfig && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30">
                              Cafetería
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-white text-sm leading-tight truncate mt-0.5">
                          {product.name}
                        </h3>
                        <div className="text-orange-500 font-mono font-bold text-sm mt-1">
                          {formatCurrency(product.price)}
                        </div>
                      </div>

                      {/* BOTÓN NARANJA DE "AÑADIR" (abre modal si tiene sabores o personalización) */}
                      <button
                        type="button"
                        onClick={() => handleProductClick(product)}
                        disabled={isOutOfStock}
                        className={`h-11 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer active:scale-95 ${
                          isOutOfStock
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-xs'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {inCart
                            ? `(${inCartQty})`
                            : isCustomizable
                            ? 'Elegir'
                            : 'Añadir'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* COLUMNA DERECHA: TICKET / CARRITO CONECTADO A ZUSTAND      */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-96 xl:w-[390px] bg-[#1a1a1a] border-l border-neutral-800 flex flex-col shrink-0 h-auto lg:h-[calc(100vh-3.5rem)]">
          {/* Header del Ticket con Selector Visual Minimalista de Mesas */}
          <div className="p-3.5 bg-[#151515] border-b border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-500" />
                <h2 className="font-bold text-xs uppercase tracking-wider text-white">
                  Ticket de Venta
                </h2>
                
                {/* Botón Agregar (+) con fondo oscuro e ícono + naranja */}
                <button
                  type="button"
                  onClick={handleAddNewTable}
                  className="p-1 rounded bg-[#222222] hover:bg-neutral-800 text-orange-500 border border-neutral-800 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                  title="Añadir nueva mesa / cuenta"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-500" />
                </button>

                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-neutral-800 text-orange-400 border border-neutral-700/60 text-[10px] font-bold rounded">
                    {activeTable}
                  </span>
                  {/* Botón Renombrar Mesa Activa */}
                  <button
                    type="button"
                    onClick={handleRenameActiveTable}
                    className="p-1 rounded bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-orange-400 border border-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
                    title={`Renombrar ${activeTable}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {cart.length > 0 && (
                confirmClearTable ? (
                  <div className="flex items-center gap-1.5 bg-[#222222] border border-red-800/70 px-2 py-0.5 rounded-lg">
                    <span className="text-[10px] font-semibold text-red-300">¿Vaciar cuenta?</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearCart(activeTable);
                        setConfirmClearTable(false);
                        setConfirmRemoveSentId(null);
                      }}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearTable(false)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (sentItems.length > 0) {
                        setConfirmClearTable(true);
                      } else {
                        clearCart(activeTable);
                      }
                    }}
                    className="text-[11px] text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Vaciar ticket de esta mesa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar</span>
                  </button>
                )
              )}
            </div>

            {/* Selector de Mesas con Creación a Demanda (Una sola línea horizontal deslizable) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="uppercase font-bold tracking-wider text-neutral-400">
                    Mesa / Cuenta ({tablesList.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddNewTable}
                    className="p-0.5 px-1 rounded bg-[#222222] hover:bg-neutral-800 text-orange-500 border border-neutral-800 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                    title="Añadir nueva mesa"
                  >
                    <Plus className="w-2.5 h-2.5 text-orange-500" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-500 font-semibold font-mono">
                    {activeTable}
                  </span>
                  <button
                    type="button"
                    onClick={handleRenameActiveTable}
                    className="p-0.5 text-neutral-400 hover:text-orange-400 transition-colors cursor-pointer"
                    title="Renombrar mesa activa"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-row overflow-x-auto whitespace-nowrap items-center gap-2 pb-2 hide-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tablesList.map((table) => {
                  const isSelected = activeTable === table;
                  const count = (tableCarts?.[table] || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
                  return (
                    <button
                      key={table}
                      type="button"
                      onClick={() => setActiveTable(table)}
                      className={`min-w-max shrink-0 py-2 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-orange-600 text-white font-semibold'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>{table}</span>
                      {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-orange-800 text-white' : 'bg-[#151515] text-orange-400'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Botón + Crear Mesa al final de la lista */}
                <button
                  type="button"
                  onClick={handleAddNewTable}
                  className="min-w-max shrink-0 py-2 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-orange-500 hover:text-orange-400 border border-neutral-700/60 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Crear nueva mesa (ej. Mesa 4, Patio 1)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Nueva</span>
                </button>
              </div>
            </div>
          </div>

          {/* RENDERIZADO DE ÍTEMS ACUMULADOS EN LA MESA (PENDIENTES VS COMANDADOS) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-2">
                <ShoppingBag className="w-8 h-8 text-neutral-600" />
                <p className="text-xs text-neutral-400">El ticket está vacío</p>
                <p className="text-[11px] text-neutral-500 max-w-xs">
                  Toca "Añadir" en los productos del catálogo para comenzar la orden.
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const isSent = Boolean(item.sentToKitchen);
                const isConfirmingRemove = confirmRemoveSentId === item.id;
                const tags = normalizeSelectedTags(item.selectedTags || []);
                const sortedTags = [...tags].sort((a, b) => {
                  const score = (t) => (isAllergyTag(t) ? 0 : isTimingTag(t) ? 1 : 2);
                  return score(a) - score(b);
                });

                return (
                <div
                  key={item.id}
                  className={`rounded-xl p-3 flex flex-col gap-2 border transition-colors ${
                    isSent
                      ? 'bg-[#151515]/85 border-neutral-800/80'
                      : 'bg-[#222222] border-orange-600/40'
                  }`}
                >
                  {/* Nombre, estado (Por enviar / Comandado), detalles y subtotal */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4
                          className={`text-xs font-semibold leading-snug ${
                            isSent ? 'text-neutral-200' : 'text-white'
                          }`}
                        >
                          {item.name}
                        </h4>
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-800/90 text-neutral-300 border border-neutral-700/70 shrink-0">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Comandado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-600/20 text-orange-400 border border-orange-500/50 shrink-0">
                            Por enviar
                          </span>
                        )}
                      </div>

                      {item.flavorDetail && (
                        <div className="mt-1 px-2 py-1 rounded bg-[#151515] border-l-3 border-orange-500">
                          <p className="text-sm font-extrabold text-orange-400 leading-tight">
                            {item.flavorDetail}
                          </p>
                        </div>
                      )}
                      {sortedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {sortedTags.map((tag, tIdx) => {
                            const allergy = isAllergyTag(tag);
                            const timing = isTimingTag(tag);
                            return (
                              <span
                                key={`${tag.group}-${tag.label}-${tIdx}`}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight border ${
                                  allergy
                                    ? 'bg-red-950/90 border-red-600/80 text-red-200 font-bold'
                                    : timing
                                    ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 font-semibold'
                                    : 'bg-orange-600/15 border-orange-500/40 text-orange-300 font-medium'
                                }`}
                              >
                                {allergy && <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                                {!allergy && timing && <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                                <span>{tag.label}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {item.itemNote && (
                        <p className="mt-1 text-xs font-medium text-amber-300 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5 rounded">
                          Nota: {item.itemNote}
                        </p>
                      )}
                      <span className="text-[11px] text-neutral-400 font-mono block mt-0.5">
                        {formatCurrency(item.price)}
                      </span>
                    </div>

                    {/* Subtotal del ítem */}
                    <span className="text-xs font-bold text-white font-mono shrink-0">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>

                  {/* Controles según estado del ítem: Pendiente vs Ya comandado */}
                  {isSent ? (
                    <div className="flex items-center justify-between bg-[#151515] px-2.5 py-1.5 rounded-lg border border-neutral-800/90 gap-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono font-bold text-neutral-200 bg-[#222222] px-1.5 py-0.5 rounded border border-neutral-800">
                          {item.quantity}x
                        </span>
                        <span className="text-neutral-400">En cuenta</span>
                      </div>

                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-red-300 font-semibold">¿Quitar?</span>
                          <button
                            type="button"
                            onClick={() => {
                              removeLineItem(item.id, activeTable);
                              setConfirmRemoveSentId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Sí, quitar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveSentId(null)}
                            className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveSentId(item.id)}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                          title="Quitar ítem comandado por error de carga"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Corregir</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-[#151515] px-2.5 py-1 rounded-lg border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400">Subtotal:</span>
                        <span className="text-[11px] font-mono text-orange-400 font-semibold">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Botón pequeño [-] */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Disminuir cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        {/* Cantidad actual */}
                        <span className="w-6 text-center font-bold text-xs text-white font-mono">
                          {item.quantity}
                        </span>

                        {/* Botón pequeño [+] */}
                        <button
                          type="button"
                          onClick={() => addToCart({ ...item, quantityToAdd: 1 })}
                          className="w-6 h-6 rounded bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Aumentar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Botón eliminar línea pendiente */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id, activeTable)}
                          className="w-6 h-6 rounded bg-neutral-800/70 hover:bg-red-950/80 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                          title="Quitar ítem pendiente"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>

          {/* Nota opcional para cocina */}
          <div className="px-4 py-2 bg-[#151515] border-t border-neutral-800">
            <input
              type="text"
              placeholder="Nota de cocina para nuevos ítems (opcional)..."
              value={ticketNote}
              onChange={(e) => setTicketNote(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* TOTAL ACTUALIZADO EN TIEMPO REAL Y BOTONES DE ACCIÓN */}
          <div className="p-4 bg-[#151515] border-t border-neutral-800 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal ({totalItemsCount} ítems):</span>
                <span className="font-mono text-neutral-300 font-medium">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>IVA (10% inc.):</span>
                <span className="font-mono">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total a Cobrar:</span>
                <span className="text-xl font-bold text-orange-500 font-mono">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Error de cobro si ocurre */}
            {paymentError && (
              <div className="p-2 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* OPCIONES DE IMPRESIÓN TÉRMICA 80MM */}
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#222222] border border-neutral-800 cursor-pointer select-none">
                <span className="text-[11px] font-medium text-neutral-300 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Imprimir ticket (80mm) al cobrar</span>
                </span>
                <input
                  type="checkbox"
                  checked={printOnCheckout}
                  onChange={(e) => setPrintOnCheckout(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-700 bg-[#151515] accent-orange-600 cursor-pointer"
                />
              </label>

              <button
                type="button"
                disabled={(cart.length === 0 && !lastPaidReceipt) || isProcessingPayment || isSendingComanda}
                onClick={handlePrintThermalTicket}
                className="w-full py-2 px-3 rounded-lg bg-[#222222] hover:bg-neutral-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 hover:text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer border border-neutral-800"
                title="Imprimir ticket o pre-cuenta en formato térmico 80mm"
              >
                <Printer className="w-3.5 h-3.5 text-orange-500" />
                <span>
                  {cart.length > 0
                    ? 'Imprimir Ticket / Pre-cuenta'
                    : lastPaidReceipt
                    ? `Reimprimir Último Ticket (${lastPaidReceipt.mesa})`
                    : 'Imprimir Ticket / Pre-cuenta'}
                </span>
              </button>
            </div>

            {/* BOTONES DE ACCIÓN: COMANDAR NUEVOS Y COBRAR */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pendingItems.length === 0 || isProcessingPayment || isSendingComanda}
                onClick={handleSendComanda}
                className={`py-2.5 px-2.5 rounded-lg active:scale-95 disabled:opacity-45 disabled:pointer-events-none font-semibold text-[11px] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                  pendingUnitsCount > 0
                    ? 'bg-[#222222] hover:bg-neutral-800 text-orange-400 hover:text-orange-300 border-orange-500/60'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700/60'
                }`}
              >
                {isSendingComanda ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500 shrink-0" />
                    <span className="truncate">Enviando...</span>
                  </>
                ) : pendingUnitsCount > 0 ? (
                  <>
                    <Send className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="truncate text-[10px] tracking-tight">
                      Comandar nuevos ({pendingUnitsCount})
                    </span>
                  </>
                ) : cart.length > 0 ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Todo comandado</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>Comanda</span>
                  </>
                )}
              </button>

              {/* BOTÓN PRINCIPAL: COBRAR Y CERRAR CUENTA DE MESA */}
              <button
                type="button"
                disabled={cart.length === 0 || isProcessingPayment || isSendingComanda}
                onClick={handleCobrar}
                className="py-2.5 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                {isProcessingPayment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cobrando...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>COBRAR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL TÁCTIL SELECTOR DE SABORES (ENTERA / MITAD Y MITAD) */}
      {flavorModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-[#151515] border-b border-neutral-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 block">
                  Selector de Sabores
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {flavorModalProduct.name}
                </h3>
                <span className="text-xs font-mono font-bold text-neutral-400">
                  {formatCurrency(flavorModalProduct.price)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFlavorModalProduct(null)}
                className="p-2 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* 1. Botones grandes de Modalidad: Entera vs Mitad y Mitad */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectFlavorMode('entera')}
                  className={`py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors cursor-pointer border ${
                    flavorMode === 'entera'
                      ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                      : 'bg-[#151515] border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  Entera (1 Sabor)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFlavorMode('mitad')}
                  className={`py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors cursor-pointer border ${
                    flavorMode === 'mitad'
                      ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                      : 'bg-[#151515] border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  Mitad y Mitad (2 Sabores)
                </button>
              </div>

              {/* Indicador visual de Mitad 1 y Mitad 2 */}
              {flavorMode === 'mitad' ? (
                <div className="grid grid-cols-2 gap-2.5 bg-[#151515] p-3 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setSelectedHalf1(null)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedHalf1
                        ? 'bg-[#222222] border-orange-500/70'
                        : 'bg-[#1a1a1a] border-dashed border-neutral-700'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">
                      Mitad 1
                    </span>
                    <span className="text-sm font-bold text-white block truncate mt-0.5">
                      {selectedHalf1 || 'Toca un sabor...'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedHalf2(null)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedHalf2
                        ? 'bg-[#222222] border-orange-500/70'
                        : 'bg-[#1a1a1a] border-dashed border-neutral-700'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">
                      Mitad 2
                    </span>
                    <span className="text-sm font-bold text-white block truncate mt-0.5">
                      {selectedHalf2 || 'Toca otro sabor...'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="bg-[#151515] p-3 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span className="text-xs text-neutral-400 font-medium">
                    Sabor seleccionado:
                  </span>
                  <span className="text-sm font-bold text-orange-400">
                    {selectedHalf1 || 'Ninguno'}
                  </span>
                </div>
              )}

              {/* 2. Grilla táctil de sabores disponibles */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  {flavorMode === 'entera'
                    ? 'Elige 1 sabor:'
                    : 'Elige exactamente 2 sabores:'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(flavorModalProduct.flavors || []).map((flavor) => {
                    const isHalf1 = selectedHalf1 === flavor;
                    const isHalf2 = flavorMode === 'mitad' && selectedHalf2 === flavor;
                    const isSelected = isHalf1 || isHalf2;

                    return (
                      <button
                        key={flavor}
                        type="button"
                        onClick={() => handleTapFlavor(flavor)}
                        className={`p-3 rounded-xl text-left font-semibold text-xs sm:text-sm transition-colors cursor-pointer border flex flex-col justify-between min-h-14 active:scale-95 ${
                          isSelected
                            ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                            : 'bg-[#151515] border-neutral-800 text-neutral-200 hover:border-neutral-600 hover:bg-[#1c1c1c]'
                        }`}
                      >
                        <span className="leading-tight break-words">{flavor}</span>
                        {isSelected && (
                          <span className="mt-1.5 inline-block self-start px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-bold uppercase tracking-wider text-white">
                            {flavorMode === 'entera'
                              ? 'Entera'
                              : isHalf1
                              ? 'Mitad 1'
                              : 'Mitad 2'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Notas adicionales para este ítem */}
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Notas adicionales para cocina (opcional)
                </label>
                <input
                  type="text"
                  value={flavorNote}
                  onChange={(e) => setFlavorNote(e.target.value)}
                  placeholder="Ej: Sin cebolla, masa bien crocante..."
                  className="w-full px-3.5 py-2.5 bg-[#151515] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Pie del Modal: Confirmar */}
            <div className="p-4 bg-[#151515] border-t border-neutral-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFlavorModalProduct(null)}
                className="py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isFlavorSelectionValid}
                onClick={handleConfirmFlavorSelection}
                className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Agregar al Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TÁCTIL CONFIGURADOR DE HAMBURGUESA / SÁNDWICH */}
      {burgerModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-[#151515] border-b border-neutral-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 block">
                  Personalizar Pedido
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {burgerModalProduct.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-neutral-400">
                    Base: {formatCurrency(burgerModalProduct.price)}
                  </span>
                  <span className="text-neutral-700">•</span>
                  <span className="text-sm font-mono font-bold text-orange-400">
                    Total ítem: {formatCurrency(computedBurgerPrice)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBurgerModalProduct(null)}
                className="p-2 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opciones Táctiles */}
            <div className="p-4 sm:p-5 space-y-5 overflow-y-auto">
              {/* 1. Tamaño / Medallones */}
              {Array.isArray(burgerModalProduct.burgerConfig?.sizes) &&
                burgerModalProduct.burgerConfig.sizes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                      1. Elige el Tamaño / Medallones
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {burgerModalProduct.burgerConfig.sizes.map((sizeObj) => {
                        const isSelected = selectedBurgerSize?.label === sizeObj.label;
                        const extra = Number(sizeObj.extraPrice) || 0;
                        return (
                          <button
                            key={sizeObj.label}
                            type="button"
                            onClick={() => setSelectedBurgerSize(sizeObj)}
                            className={`p-3 rounded-xl border text-center transition-colors cursor-pointer active:scale-95 ${
                              isSelected
                                ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                                : 'bg-[#151515] border-neutral-800 text-neutral-200 hover:border-neutral-600'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-bold block">
                              {sizeObj.label}
                            </span>
                            <span
                              className={`text-[10px] font-mono block mt-0.5 ${
                                isSelected ? 'text-orange-100' : 'text-neutral-400'
                              }`}
                            >
                              {extra > 0 ? `+${formatCurrency(extra)}` : 'Sin cargo'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 2. Toppings / Extras Pagos */}
              {Array.isArray(burgerModalProduct.burgerConfig?.extras) &&
                burgerModalProduct.burgerConfig.extras.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                      2. Agregar Extras / Toppings
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {burgerModalProduct.burgerConfig.extras.map((extraObj) => {
                        const isSelected = selectedBurgerExtras.some(
                          (e) => e.label === extraObj.label
                        );
                        const extraCost = Number(extraObj.extraPrice) || 0;
                        return (
                          <button
                            key={extraObj.label}
                            type="button"
                            onClick={() => handleTogglePOSBurgerExtra(extraObj)}
                            className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer active:scale-95 flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                                : 'bg-[#151515] border-neutral-800 text-neutral-200 hover:border-neutral-600'
                            }`}
                          >
                            <span className="text-xs font-semibold leading-tight">
                              + {extraObj.label}
                            </span>
                            <span
                              className={`text-[10px] font-mono shrink-0 ${
                                isSelected ? 'text-orange-100 font-bold' : 'text-orange-400'
                              }`}
                            >
                              +{formatCurrency(extraCost)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 3. Quitar Ingredientes (Sin cargo) */}
              {Array.isArray(burgerModalProduct.burgerConfig?.removals) &&
                burgerModalProduct.burgerConfig.removals.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                      3. Quitar Ingredientes (Sin cargo)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {burgerModalProduct.burgerConfig.removals.map((remLabel) => {
                        const isSelected = selectedBurgerRemovals.includes(remLabel);
                        return (
                          <button
                            key={remLabel}
                            type="button"
                            onClick={() => handleTogglePOSBurgerRemoval(remLabel)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-colors cursor-pointer active:scale-95 ${
                              isSelected
                                ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                                : 'bg-[#151515] border-neutral-800 text-neutral-300 hover:border-neutral-600'
                            }`}
                          >
                            {remLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 4. Nota adicional */}
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Notas adicionales para cocina (opcional)
                </label>
                <input
                  type="text"
                  value={burgerNote}
                  onChange={(e) => setBurgerNote(e.target.value)}
                  placeholder="Ej: Carne bien cocida, pan tostado..."
                  className="w-full px-3.5 py-2.5 bg-[#151515] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Pie del Modal: Precio Final + Confirmar */}
            <div className="p-4 bg-[#151515] border-t border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                  Precio Unitario
                </span>
                <span className="text-base font-bold font-mono text-orange-500">
                  {formatCurrency(computedBurgerPrice)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBurgerModalProduct(null)}
                  className="py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBurgerSelection}
                  className="py-2.5 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Agregar al Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROPIO PARA CREAR / RENOMBRAR MESA (SIN WINDOW.PROMPT) */}
      {showTableModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowTableModal(false)}
        >
          <div
            className="bg-[#222222] border border-neutral-800 rounded-xl p-5 w-full max-w-sm shadow-2xl relative text-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                {tableModalMode === 'add' ? (
                  <>
                    <Plus className="w-4 h-4 text-orange-500" />
                    <span>Nueva Mesa / Cuenta</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5 text-orange-500" />
                    <span>Renombrar Mesa</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTableModal} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Nombre de la Mesa o Cuenta
                </label>
                <input
                  type="text"
                  autoFocus
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  placeholder="Ej. Mesa 4, Terraza, Barra 2"
                  className="w-full px-3 py-2 bg-[#151515] border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!tableNameInput.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TÁCTIL RÁPIDO: COCINA GOURMET / CAFETERÍA Y BARRA */}
      {quickModalProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setQuickModalProduct(null)}
        >
          <div
            className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-[#151515] border-b border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                  {quickModalProduct.isGourmetConfig ? (
                    <ChefHat className="w-5 h-5 text-orange-500" />
                  ) : (
                    <Coffee className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 block">
                    {quickModalProduct.isGourmetConfig ? 'Cocina Gourmet' : 'Cafetería / Preparación'}
                  </span>
                  <h3 className="text-base font-bold text-white truncate">
                    {quickModalProduct.name}
                  </h3>
                  <span className="text-xs font-mono font-bold text-neutral-400">
                    {formatCurrency(quickModalProduct.price)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickModalProduct(null)}
                className="p-2 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickCustomization} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {activeQuickGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      {group.key === 'alergias' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {(group.key === 'tiempo' || group.key === 'entrega') && (
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>{group.label}</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.chips.map((chip) => {
                        const isSelected = selectedQuickTags.some(
                          (t) => t.group === group.key && t.label === chip
                        );
                        const activeClass =
                          group.key === 'alergias'
                            ? 'bg-red-950/90 border-red-500 text-red-100'
                            : group.key === 'tiempo' || group.key === 'entrega'
                            ? 'bg-amber-950/90 border-amber-500 text-amber-100'
                            : 'bg-orange-600 border-orange-500 text-white';

                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleQuickTag(group.key, chip)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                              isSelected
                                ? activeClass
                                : 'bg-[#151515] border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white'
                            }`}
                          >
                            {isSelected && group.key === 'alergias' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                            {isSelected && (group.key === 'tiempo' || group.key === 'entrega') && (
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            {isSelected &&
                              group.key !== 'alergias' &&
                              group.key !== 'tiempo' &&
                              group.key !== 'entrega' && (
                                <Check className="w-3.5 h-3.5 text-white shrink-0" />
                              )}
                            <span>{chip}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Nota corta opcional */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Nota corta (opcional)
                  </label>
                  <input
                    type="text"
                    value={quickItemNote}
                    onChange={(e) => setQuickItemNote(e.target.value)}
                    placeholder={
                      quickModalProduct.isGourmetConfig
                        ? 'Ej: Salsa aparte, sin sal, plato bien caliente...'
                        : 'Ej: Poco hielo, bien espumoso, sin azúcar...'
                    }
                    className="w-full px-3.5 py-2.5 bg-[#151515] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Pie del Modal: Cantidad + Confirmar */}
              <div className="p-4 bg-[#151515] border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#222222] border border-neutral-800 rounded-xl px-2.5 py-1.5">
                  <span className="text-[11px] text-neutral-400 font-semibold mr-1">Cant.:</span>
                  <button
                    type="button"
                    onClick={() => setQuickQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">
                    {quickQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-orange-400 flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setQuickModalProduct(null)}
                    className="py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Agregar ({formatCurrency((Number(quickModalProduct.price) || 0) * quickQuantity)})
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST DE COMANDA REGISTRADA CON ÉXITO / ENVIADO A COCINA */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in">
          <div className="bg-[#222222] border border-orange-500/70 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">{successToast}</p>
              <p className="text-[11px] text-neutral-400">
                {successToast === 'Enviado a cocina'
                  ? `Pedido enviado a cocina para ${activeTable}`
                  : 'Venta registrada y stock actualizado'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ================================================================= */}
    {/* PLANTILLA DE IMPRESIÓN TÉRMICA 80MM (ALTO CONTRASTE BLANCO/NEGRO) */}
    {/* ================================================================= */}
    <div
      id="thermal-receipt-80mm"
      className="hidden print:block bg-white text-black font-mono"
    >
      <div className="text-center pb-2 border-b border-dashed border-black">
        <div className="text-base font-extrabold tracking-wide uppercase">
          GASTROPOS — RESTAURANT & BAR
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider mt-0.5">
          {receiptToPrint.tipo}
        </div>
      </div>

      <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span className="font-bold">MESA / CUENTA:</span>
          <span className="font-bold uppercase">{receiptToPrint.mesa}</span>
        </div>
        <div className="flex justify-between">
          <span>FECHA Y HORA:</span>
          <span>{receiptToPrint.fecha}</span>
        </div>
        <div className="flex justify-between">
          <span>ATENDIÓ:</span>
          <span>{receiptToPrint.cajero}</span>
        </div>
      </div>

      <div className="py-1.5 border-b border-dashed border-black flex justify-between text-[10px] font-bold uppercase">
        <span>CANT. DESCRIPCIÓN</span>
        <span>IMPORTE</span>
      </div>

      <div className="py-2 border-b border-dashed border-black space-y-2">
        {(receiptToPrint.items || []).map((item, idx) => {
          const tags = normalizeSelectedTags(item.selectedTags || []);
          const allergyTags = tags.filter((t) => isAllergyTag(t));
          const timingTags = tags.filter((t) => !isAllergyTag(t) && isTimingTag(t));
          const otherTags = tags.filter((t) => !isAllergyTag(t) && !isTimingTag(t));

          return (
            <div key={`print-${item.id || idx}-${idx}`} className="text-[11px] leading-snug">
              <div className="flex justify-between gap-2 font-bold">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="shrink-0">
                  {formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                </span>
              </div>

              {(item.quantity || 1) > 1 && (
                <div className="text-[10px] pl-3">
                  ({item.quantity} u. x {formatCurrency(item.price)})
                </div>
              )}

              {item.flavorDetail && (
                <div className="text-[10px] font-bold pl-3">
                  {item.flavorDetail}
                </div>
              )}

              {allergyTags.length > 0 && (
                <div className="text-[10px] font-extrabold uppercase pl-3 mt-0.5 border-l-2 border-black">
                  !! RESTRICCIÓN: {allergyTags.map((t) => t.label).join(', ')} !!
                </div>
              )}

              {timingTags.length > 0 && (
                <div className="text-[10px] font-bold uppercase pl-3">
                  [{timingTags.map((t) => t.label).join(' / ')}]
                </div>
              )}

              {otherTags.length > 0 && (
                <div className="text-[10px] pl-3">
                  • {otherTags.map((t) => t.label).join(', ')}
                </div>
              )}

              {item.itemNote && (
                <div className="text-[10px] pl-3 italic">
                  Nota: {item.itemNote}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {receiptToPrint.nota && (
        <div className="py-1.5 border-b border-dashed border-black text-[10px]">
          <span className="font-bold uppercase">NOTA GENERAL: </span>
          <span>{receiptToPrint.nota}</span>
        </div>
      )}

      <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>SUBTOTAL ({receiptToPrint.totalItemsCount} ÍTEMS):</span>
          <span>{formatCurrency(receiptToPrint.total)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>IVA (10% INCLUIDO):</span>
          <span>{formatCurrency(receiptToPrint.taxAmount)}</span>
        </div>
        <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-black">
          <span>TOTAL A PAGAR:</span>
          <span>{formatCurrency(receiptToPrint.total)}</span>
        </div>
      </div>

      <div className="pt-2.5 text-center text-[10px] space-y-0.5">
        <div className="font-bold uppercase">Documento no válido como factura legal</div>
        <div>¡Gracias por su preferencia!</div>
      </div>
    </div>
    </>
  );
};

export default POSDashboard;
