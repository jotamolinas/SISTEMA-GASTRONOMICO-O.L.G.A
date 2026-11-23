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
  SlidersHorizontal,
  Printer
} from 'lucide-react';
import {
  GOURMET_PRESET_GROUPS,
  CAFE_PRESET_GROUPS,
  normalizeGourmetOptions,
  normalizeCafeOptions,
  normalizeSelectedTags,
  isAllergyTag,
  isTimingTag
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

  // 1. ESTADO SINCRONIZADO CON FIRESTORE (Lectura de Datos centralizada)
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // 2. CONEXIÓN AL STORE ZUSTAND (LOCAL-FIRST CON CUENTAS SEPARADAS POR MESA)
  const { 
    tableCarts, 
    activeTable, 
    setActiveTable, 
    addTable,
    renameTable,
    addToCart, 
    removeFromCart, 
    clearCart, 
    cartTotal 
  } = useCartStore();

  // Lista dinámica de mesas a partir de las llaves en tableCarts
  const tablesList = useMemo(() => {
    const keys = Object.keys(tableCarts || {});
    return keys.length > 0 ? keys : ['Mesa 1', 'Mesa 2', 'Mesa 3'];
  }, [tableCarts]);

  // Estados para el Modal de Agregar / Renombrar Mesa (Sin window.prompt)
  const [showNameModal, setShowNameModal] = useState(false);
  const [modalType, setModalType] = useState('add'); // 'add' o 'rename'
  const [tableNameInput, setTableNameInput] = useState('');

  // Al tocar "+": calcula sugerencia de mesa y abre modal
  const handleOpenAddModal = () => {
    setModalType('add');
    const tableCount = Object.keys(tableCarts || {}).length;
    setTableNameInput('Mesa ' + (tableCount + 1));
    setShowNameModal(true);
  };

  // Al tocar "✏️": precarga nombre actual y abre modal
  const handleOpenRenameModal = () => {
    setModalType('rename');
    setTableNameInput(activeTable || 'Mesa 1');
    setShowNameModal(true);
  };

  // Submit del modal
  const handleModalSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanName = tableNameInput.trim();
    if (!cleanName) return;

    if (modalType === 'add') {
      addTable(cleanName);
    } else if (modalType === 'rename') {
      renameTable(activeTable, cleanName);
    }

    setShowNameModal(false);
  };

  // Carrito y productos exclusivos de la mesa activa seleccionada
  const cart = tableCarts?.[activeTable] || [];

  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketNote, setTicketNote] = useState('');
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  // Estados para Modal Rápido de Personalización (Gourmet / Cafetería)
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedCustomTags, setSelectedCustomTags] = useState([]);
  const [customItemNote, setCustomItemNote] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);

  const hasQuickCustomization = (product) => {
    return Boolean(product?.isGourmetConfig || product?.isCafeConfig);
  };

  // Al tocar un producto en el catálogo: abre modal táctil si tiene config Gourmet o Cafetería
  const handleProductTap = (product) => {
    if ((product.stock || 0) <= 0) return;

    if (hasQuickCustomization(product)) {
      setCustomizingProduct(product);
      setSelectedCustomTags([]);
      setCustomItemNote('');
      setCustomQuantity(1);
    } else {
      addToCart(product);
    }
  };

  // Grupos de chips disponibles para el producto actualmente en el modal
  const activeCustomizationGroups = useMemo(() => {
    if (!customizingProduct) return [];

    if (customizingProduct.isGourmetConfig) {
      const opts = normalizeGourmetOptions(customizingProduct.gourmetOptions);
      const groups = GOURMET_PRESET_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        chips: Array.isArray(opts[g.key]) ? opts[g.key] : []
      })).filter((g) => g.chips.length > 0);

      if (Array.isArray(opts.extras) && opts.extras.length > 0) {
        groups.push({
          key: 'extras',
          label: 'Opciones Extra',
          chips: opts.extras
        });
      }
      return groups;
    }

    if (customizingProduct.isCafeConfig) {
      const opts = normalizeCafeOptions(customizingProduct.cafeOptions);
      const groups = CAFE_PRESET_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        chips: Array.isArray(opts[g.key]) ? opts[g.key] : []
      })).filter((g) => g.chips.length > 0);

      if (Array.isArray(opts.extras) && opts.extras.length > 0) {
        groups.push({
          key: 'extras',
          label: 'Opciones Extra',
          chips: opts.extras
        });
      }
      return groups;
    }

    return [];
  }, [customizingProduct]);

  const toggleModalTag = (groupKey, chipLabel) => {
    setSelectedCustomTags((prev) => {
      const exists = prev.some((t) => t.group === groupKey && t.label === chipLabel);
      if (exists) {
        return prev.filter((t) => !(t.group === groupKey && t.label === chipLabel));
      }
      return [...prev, { group: groupKey, label: chipLabel }];
    });
  };

  const handleConfirmCustomization = (e) => {
    if (e) e.preventDefault();
    if (!customizingProduct) return;

    const groupedMap = {};
    selectedCustomTags.forEach((tag) => {
      if (!groupedMap[tag.group]) groupedMap[tag.group] = [];
      groupedMap[tag.group].push(tag.label);
    });

    addToCart({
      ...customizingProduct,
      productId: customizingProduct.id,
      customizationType: customizingProduct.isGourmetConfig ? 'gourmet' : 'cafe',
      selectedTags: selectedCustomTags,
      customTags: Object.keys(groupedMap).length > 0 ? groupedMap : null,
      itemNote: customItemNote.trim(),
      quantityToAdd: customQuantity
    });

    setCustomizingProduct(null);
    setSelectedCustomTags([]);
    setCustomItemNote('');
    setCustomQuantity(1);
  };

  // SUSCRIPCIÓN EN TIEMPO REAL A FIRESTORE (onSnapshot con mapeo estricto { id: doc.id, ...doc.data() })
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
          id: docSnap.id,
          ...docSnap.data(),
          id: docSnap.id
        }));

        firestoreProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(firestoreProducts);
        setIsLoadingProducts(false);
      },
      (err) => {
        console.error('Error al sincronizar productos para POS desde Firestore:', err);
        setIsLoadingProducts(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Cantidad total de productos en el ticket
  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [cart]);

  // Cálculo del total reactivo derivado del carrito de la mesa activa
  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  }, [cart]);
  const taxAmount = Math.round(total * 0.10);

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
          productId: i.productId || i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          customizationType: i.customizationType || null,
          selectedTags: normalizeSelectedTags(i.selectedTags || []),
          customTags: i.customTags || null,
          itemNote: (i.itemNote || '').trim()
        })),
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        estado: 'completado',
        tipo: 'venta_directa'
      };

      batch.set(ventaDocRef, ventaPayload);

      // B) Agrupar cantidades por producto y descontar stock en un único update por documento
      const stockDiscounts = {};
      for (const item of cart) {
        const pid = item.productId || item.id;
        if (pid) {
          stockDiscounts[pid] = (stockDiscounts[pid] || 0) + Number(item.quantity || 1);
        }
      }
      for (const [pid, qty] of Object.entries(stockDiscounts)) {
        const prodRef = doc(db, 'productos', pid);
        batch.update(prodRef, {
          stock: increment(-qty),
          updatedAt: serverTimestamp()
        });
      }

      // C) Ejecutar batch.commit()
      await batch.commit();

      const paidReceiptSnapshot = {
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
      setLastPaidReceipt(paidReceiptSnapshot);

      // D) Notificación solicitada: "Comanda registrada con éxito"
      setSuccessToast('Comanda registrada con éxito');
      setTimeout(() => setSuccessToast(null), 3500);

      // E) Limpiar ticket de la mesa activa
      clearCart(activeTable);
      setTicketNote('');

      // F) Si el cajero activó "Imprimir al cobrar", dispara la impresión térmica 80mm con el comprobante recién cobrado
      if (printOnCheckout) {
        triggerThermalPrint(paidReceiptSnapshot);
      }
    } catch (err) {
      console.error('Error al procesar cobro:', err);
      setPaymentError('Error de conexión al procesar el cobro. Intenta de nuevo.');
      setTimeout(() => setPaymentError(''), 4000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ACCIÓN DEL BOTÓN "COMANDA": Guarda en la colección 'comandas_activas'
  const handleSendComanda = async () => {
    if (cart.length === 0 || isSendingComanda || isProcessingPayment) return;

    setIsSendingComanda(true);
    setPaymentError('');

    try {
      const comandasCol = collection(db, 'comandas_activas');
      const comandaPayload = {
        mesa: activeTable || 'Mesa 1',
        items: cart.map((i) => ({
          id: i.productId || i.id,
          productId: i.productId || i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          unit: i.unit || 'unidades',
          customizationType: i.customizationType || null,
          selectedTags: normalizeSelectedTags(i.selectedTags || []),
          customTags: i.customTags || null,
          itemNote: (i.itemNote || '').trim()
        })),
        estado: 'en_cocina',
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        total: Number(total) || 0
      };

      await addDoc(comandasCol, comandaPayload);

      // Alerta exitosa requerida: "Enviado a cocina"
      setSuccessToast('Enviado a cocina');
      setTimeout(() => setSuccessToast(null), 3500);

      // Limpia el ticket localmente con clearCart de la mesa activa
      clearCart(activeTable);
      setTicketNote('');
    } catch (err) {
      console.error('Error al enviar comanda:', err);
      setPaymentError('Error al enviar la comanda a cocina. Verifica la conexión.');
      setTimeout(() => setPaymentError(''), 4000);
    } finally {
      setIsSendingComanda(false);
    }
  };

  // Impresión térmica opcional 80mm mediante CSS @media print (alto contraste B/N)
  const [printOnCheckout, setPrintOnCheckout] = useState(false);
  const [lastPaidReceipt, setLastPaidReceipt] = useState(null);
  const [activePrintReceipt, setActivePrintReceipt] = useState(null);

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

  // Datos efectivos para la plantilla de impresión térmica 80mm
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
              En Vivo
            </span>
          </div>
        </div>

        {/* Selector de Mesas Conectado a Zustand (Una sola línea horizontal deslizable) */}
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
              onClick={handleOpenAddModal}
              className="p-1 px-1.5 rounded-md bg-[#222222] hover:bg-neutral-800 text-orange-500 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors border border-neutral-800 shadow-xs"
              title="Añadir nueva mesa / cuenta"
            >
              <Plus className="w-3.5 h-3.5 text-orange-500" />
            </button>
          </div>
        </div>

        {/* Acceso a Cocina + Salir / Usuario */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/cocina')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Abrir pantalla de cocina (/cocina)"
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
                  const productCartQty = cart
                    .filter((i) => (i.productId || i.id) === product.id)
                    .reduce((sum, i) => sum + (i.quantity || 1), 0);
                  const isOutOfStock = (product.stock || 0) <= 0;
                  const isCustomizable = hasQuickCustomization(product);

                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        if (!isOutOfStock) handleProductTap(product);
                      }}
                      className={`bg-[#222222] rounded-xl p-4 flex items-center justify-between gap-3 transition-colors border ${
                        productCartQty > 0
                          ? 'border-orange-500/50 bg-[#262626]'
                          : isOutOfStock
                          ? 'border-neutral-800/50 opacity-75'
                          : 'border-neutral-800/80 hover:border-neutral-700 cursor-pointer'
                      }`}
                    >
                      {/* Ícono a la izquierda */}
                      <div className="w-12 h-12 rounded-lg bg-[#151515] border border-neutral-800 flex items-center justify-center shrink-0">
                        <ProductIcon
                          type={product.icon}
                          category={product.category}
                          isGourmetConfig={product.isGourmetConfig}
                          isCafeConfig={product.isCafeConfig}
                        />
                      </div>

                      {/* Título, precio y stock sincronizado en Firestore */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-medium text-neutral-400 uppercase">
                            {product.category}
                          </span>
                          {product.isGourmetConfig && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-600/15 text-orange-400 border border-orange-500/30">
                              Gourmet
                            </span>
                          )}
                          {product.isCafeConfig && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-600/15 text-orange-400 border border-orange-500/30">
                              Cafetería
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                              isOutOfStock
                                ? 'bg-red-950/80 text-red-400 border border-red-900/60'
                                : 'bg-[#151515] text-neutral-400 border border-neutral-800'
                            }`}
                          >
                            {isOutOfStock ? 'Agotado' : `Stock: ${product.stock}u`}
                          </span>
                        </div>
                        <h3 className="font-semibold text-white text-sm leading-tight truncate mt-0.5">
                          {product.name}
                        </h3>
                        <div className="text-orange-500 font-mono font-bold text-sm mt-1">
                          {formatCurrency(product.price)}
                        </div>
                      </div>

                      {/* BOTÓN NARANJA DE "AÑADIR" / PERSONALIZAR */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductTap(product);
                        }}
                        disabled={isOutOfStock}
                        className={`h-11 px-3.5 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer active:scale-95 ${
                          isOutOfStock
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-xs'
                        }`}
                        title={
                          isCustomizable
                            ? 'Toca para personalizar con opciones rápidas'
                            : 'Añadir al ticket'
                        }
                      >
                        {isCustomizable ? (
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{productCartQty > 0 ? `(${productCartQty})` : 'Añadir'}</span>
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
                  onClick={handleOpenAddModal}
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
                    onClick={handleOpenRenameModal}
                    className="p-1 rounded bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-orange-400 border border-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
                    title={`Renombrar ${activeTable}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCart(activeTable)}
                  className="text-[11px] text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Vaciar ticket de esta mesa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar</span>
                </button>
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
                    onClick={handleOpenAddModal}
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
                    onClick={handleOpenRenameModal}
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
                  onClick={handleOpenAddModal}
                  className="min-w-max shrink-0 py-2 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-orange-500 hover:text-orange-400 border border-neutral-700/60 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Crear nueva mesa (ej. Mesa 4, Patio 1)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Nueva</span>
                </button>
              </div>
            </div>
          </div>

          {/* RENDERIZADO DE ÍTEMS ACTUALES DEL CART (ZUSTAND) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-neutral-800/60">
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
                const itemKey = item.cartKey || item.id;
                const tags = normalizeSelectedTags(item.selectedTags || []);
                const sortedTags = [...tags].sort((a, b) => {
                  const score = (t) => (isAllergyTag(t) ? 0 : isTimingTag(t) ? 1 : 2);
                  return score(a) - score(b);
                });

                return (
                  <div key={itemKey} className="pt-3 first:pt-0 flex flex-col gap-2">
                    {/* Nombre, precio unitario y subtotal */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate">
                          {item.name}
                        </h4>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {formatCurrency(item.price)}
                        </span>

                        {/* Etiquetas de personalización (Alergias, Tiempos, Cocción / Cafetería) */}
                        {sortedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sortedTags.map((tag, idx) => {
                              const allergy = isAllergyTag(tag);
                              const timing = isTimingTag(tag);

                              return (
                                <span
                                  key={`${tag.group}-${tag.label}-${idx}`}
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

                        {/* Nota corta individual del ítem */}
                        {item.itemNote && (
                          <p className="text-[10px] text-neutral-300 italic mt-1 bg-[#151515] border-l-2 border-orange-500 px-2 py-0.5 rounded-r">
                            Nota: {item.itemNote}
                          </p>
                        )}
                      </div>

                      {/* Subtotal del ítem */}
                      <span className="text-xs font-bold text-white font-mono shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>

                    {/* Cantidad y botones pequeños [+] y [-] */}
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
                          onClick={() => removeFromCart(itemKey)}
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
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Nota opcional para cocina */}
          <div className="px-4 py-2 bg-[#151515] border-t border-neutral-800">
            <input
              type="text"
              placeholder="Nota de cocina (opcional)..."
              value={ticketNote}
              onChange={(e) => setTicketNote(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#222222] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* TOTAL ACTUALIZADO EN TIEMPO REAL Y BOTÓN COBRAR (BATCH WRITE) */}
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

            {/* BOTONES DE ACCIÓN: COMANDA Y COBRAR */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cart.length === 0 || isProcessingPayment || isSendingComanda}
                onClick={handleSendComanda}
                className="py-2.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 font-semibold text-xs uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-700/60"
              >
                {isSendingComanda ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-orange-500" />
                    <span>Comanda</span>
                  </>
                )}
              </button>

              {/* BOTÓN PRINCIPAL: COBRAR */}
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

      {/* MODAL SUPERPUESTO PARA AGREGAR O RENOMBRAR MESA (SIN WINDOW.PROMPT) */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-[#222222] border border-neutral-800 rounded-xl p-5 w-full max-w-sm shadow-2xl relative text-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                {modalType === 'add' ? (
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
                onClick={() => setShowNameModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleModalSubmit} className="space-y-4">
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

              {/* Botones de acción Cancelar y Guardar */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
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

      {/* MODAL TÁCTIL RÁPIDO DE PERSONALIZACIÓN (GOURMET / CAFETERÍA) */}
      {customizingProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setCustomizingProduct(null)}
        >
          <div
            className="bg-[#222222] border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl relative text-neutral-100 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal Táctil */}
            <div className="p-4 sm:p-5 bg-[#151515] border-b border-neutral-800 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                  {customizingProduct.isGourmetConfig ? (
                    <ChefHat className="w-5 h-5 text-orange-500" />
                  ) : (
                    <Coffee className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-600/15 text-orange-400 border border-orange-500/30">
                      {customizingProduct.isGourmetConfig ? 'Cocina Gourmet' : 'Cafetería / Bar'}
                    </span>
                    <span className="text-xs font-mono font-bold text-orange-500">
                      {formatCurrency(customizingProduct.price)}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white truncate mt-0.5">
                    {customizingProduct.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222222] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo scrollable con grupos de chips táctiles */}
            <form onSubmit={handleConfirmCustomization} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {activeCustomizationGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                        {group.key === 'alergias' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {(group.key === 'tiempo' || group.key === 'entrega') && (
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>{group.label}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.chips.map((chip) => {
                        const isSelected = selectedCustomTags.some(
                          (t) => t.group === group.key && t.label === chip
                        );
                        const activeClass =
                          group.key === 'alergias'
                            ? 'bg-red-950/90 border-red-500 text-red-100 shadow-xs'
                            : group.key === 'tiempo' || group.key === 'entrega'
                            ? 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-xs'
                            : 'bg-orange-600 border-orange-500 text-white shadow-xs';

                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleModalTag(group.key, chip)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Nota corta (opcional)
                  </label>
                  <input
                    type="text"
                    value={customItemNote}
                    onChange={(e) => setCustomItemNote(e.target.value)}
                    placeholder={
                      customizingProduct.isGourmetConfig
                        ? 'Ej: Salsa aparte, sin cebolla, plato caliente...'
                        : 'Ej: Poco hielo, bien espumoso, 1 sobre de edulcorante...'
                    }
                    className="w-full px-3.5 py-2.5 bg-[#151515] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Pie fijo con cantidad y botón de confirmar */}
              <div className="p-4 bg-[#151515] border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                {/* Selector táctil de cantidad */}
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#222222] border border-neutral-800 rounded-xl px-2.5 py-1.5">
                  <span className="text-[11px] text-neutral-400 font-semibold mr-1">Cant.:</span>
                  <button
                    type="button"
                    onClick={() => setCustomQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">
                    {customQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-orange-400 flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Botones Cancelar y Agregar */}
                <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                  <button
                    type="button"
                    onClick={() => setCustomizingProduct(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-orange-600 hover:bg-orange-500 transition-colors cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Agregar ({formatCurrency((Number(customizingProduct.price) || 0) * customQuantity)})
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
                  ? `Comanda enviada a cocina para ${activeTable}`
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
      {/* Cabecera Comercial */}
      <div className="text-center pb-2 border-b border-dashed border-black">
        <div className="text-base font-extrabold tracking-wide uppercase">
          GASTROPOS — RESTAURANT & BAR
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider mt-0.5">
          {receiptToPrint.tipo}
        </div>
      </div>

      {/* Datos de Mesa y Emisión */}
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

      {/* Encabezado de Columnas */}
      <div className="py-1.5 border-b border-dashed border-black flex justify-between text-[10px] font-bold uppercase">
        <span>CANT. DESCRIPCIÓN</span>
        <span>IMPORTE</span>
      </div>

      {/* Detalle de Ítems + Personalizaciones */}
      <div className="py-2 border-b border-dashed border-black space-y-2">
        {(receiptToPrint.items || []).map((item, idx) => {
          const itemKey = item.cartKey || item.id || idx;
          const tags = normalizeSelectedTags(item.selectedTags || []);
          const allergyTags = tags.filter((t) => isAllergyTag(t));
          const timingTags = tags.filter((t) => !isAllergyTag(t) && isTimingTag(t));
          const otherTags = tags.filter((t) => !isAllergyTag(t) && !isTimingTag(t));
          const flavors = Array.isArray(item.flavors)
            ? item.flavors
            : Array.isArray(item.sabores)
            ? item.sabores
            : [];
          const itemSize = item.size || item.tamano || '';
          const itemExtras = Array.isArray(item.extras) ? item.extras : [];
          const removedIngredients = Array.isArray(item.removedIngredients)
            ? item.removedIngredients
            : Array.isArray(item.sinIngredientes)
            ? item.sinIngredientes
            : [];
          const noteText = (item.itemNote || item.nota || item.notes || '').trim();

          return (
            <div key={`print-${itemKey}-${idx}`} className="text-[11px] leading-snug">
              <div className="flex justify-between gap-2 font-bold">
                <span>
                  {item.quantity}x {item.name}
                  {itemSize ? ` (${itemSize})` : ''}
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

              {flavors.length > 0 && (
                <div className="text-[10px] font-bold pl-3">
                  {flavors.length === 2
                    ? `1/2 ${flavors[0]} + 1/2 ${flavors[1]}`
                    : `Sabor: ${flavors.join(', ')}`}
                </div>
              )}

              {allergyTags.length > 0 && (
                <div className="text-[10px] font-extrabold uppercase pl-3 mt-0.5 border-l-2 border-black">
                  !! RESTRICCIÓN: {allergyTags.map((t) => t.label).join(', ')} !!
                </div>
              )}

              {removedIngredients.length > 0 && (
                <div className="text-[10px] font-bold uppercase pl-3">
                  SIN: {removedIngredients.join(', ')}
                </div>
              )}

              {timingTags.length > 0 && (
                <div className="text-[10px] font-bold uppercase pl-3">
                  [{timingTags.map((t) => t.label).join(' / ')}]
                </div>
              )}

              {(otherTags.length > 0 || itemExtras.length > 0) && (
                <div className="text-[10px] pl-3">
                  • {[...otherTags.map((t) => t.label), ...itemExtras.map((e) => `+${e}`)].join(', ')}
                </div>
              )}

              {noteText && (
                <div className="text-[10px] pl-3 italic">
                  Nota: {noteText}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota General de Mesa */}
      {receiptToPrint.nota && (
        <div className="py-1.5 border-b border-dashed border-black text-[10px]">
          <span className="font-bold uppercase">NOTA GENERAL: </span>
          <span>{receiptToPrint.nota}</span>
        </div>
      )}

      {/* Totales */}
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

      {/* Pie del Ticket */}
      <div className="pt-2.5 text-center text-[10px] space-y-0.5">
        <div className="font-bold uppercase">Documento no válido como factura legal</div>
        <div>¡Gracias por su preferencia!</div>
      </div>
    </div>
    </>
  );
};

export default POSDashboard;
