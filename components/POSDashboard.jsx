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
  Database
} from 'lucide-react';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PY', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(amount) + ' Gs.';
};

// Íconos sobrios de productos
const ProductIcon = ({ type, category }) => {
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

  // Al hacer clic en +: calcula cuántas mesas existen y sugiere el nombre
  const handleAddNewTable = () => {
    const tableCount = Object.keys(tableCarts || {}).length;
    const suggestedName = `Mesa ${tableCount + 1}`;
    const newTable = window.prompt("Nombre de la nueva cuenta/mesa:", suggestedName);
    if (newTable && newTable.trim()) {
      addTable(newTable.trim());
    }
  };

  // Renombrar la mesa activa actual
  const handleRenameActiveTable = () => {
    const newName = window.prompt("Nuevo nombre para la mesa:", activeTable);
    if (newName && newName.trim() && newName.trim() !== activeTable) {
      renameTable(activeTable, newName.trim());
    }
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
          variantId: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          flavorDetail: i.flavorDetail || '',
          flavorMode: i.flavorMode || null,
          selectedFlavors: Array.isArray(i.selectedFlavors) ? i.selectedFlavors : [],
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

      console.log('--- COMANDA COBRADA EN BATCH FIRESTORE ---', ventaPayload);

      // D) Notificación solicitada: "Comanda registrada con éxito"
      setSuccessToast('Comanda registrada con éxito');
      setTimeout(() => setSuccessToast(null), 3500);

      // E) Limpiar ticket de la mesa activa
      clearCart(activeTable);
      setTicketNote('');
    } catch (err) {
      console.error('Error al procesar venta:', err);
      setPaymentError('Error al registrar la venta. Intenta de nuevo.');
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
          variantId: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          unit: i.unit || 'unidades',
          flavorDetail: i.flavorDetail || '',
          flavorMode: i.flavorMode || null,
          selectedFlavors: Array.isArray(i.selectedFlavors) ? i.selectedFlavors : [],
          itemNote: i.itemNote || ''
        })),
        estado: 'en_cocina',
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        total: Number(total) || 0
      };

      await addDoc(comandasCol, comandaPayload);

      console.log('--- COMANDA ENVIADA A comandas_activas ---', comandaPayload);

      // Alerta exitosa requerida: "Enviado a cocina"
      setSuccessToast('Enviado a cocina');
      setTimeout(() => setSuccessToast(null), 3500);

      // Limpia el ticket localmente con clearCart de la mesa activa
      clearCart(activeTable);
      setTicketNote('');
    } catch (err) {
      console.error('Error al guardar comanda en Firestore:', err);
      setPaymentError('Error al enviar la comanda a cocina. Verifica la conexión.');
      setTimeout(() => setPaymentError(''), 4000);
    } finally {
      setIsSendingComanda(false);
    }
  };

  // MANEJO DE PRODUCTO CON SUBMENÚ DE SABORES O CONFIGURADOR DE HAMBURGUESA
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
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex flex-col font-sans select-none">
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
              onClick={handleAddNewTable}
              className="p-1 px-1.5 rounded-md bg-[#222222] hover:bg-neutral-800 text-orange-500 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors border border-neutral-800 shadow-xs"
              title="Añadir nueva mesa / cuenta"
            >
              <Plus className="w-3.5 h-3.5 text-orange-500" />
            </button>
          </div>
        </div>

        {/* Salir o Usuario */}
        <div className="flex items-center gap-3">
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
                        <ProductIcon type={product.icon} category={product.category} />
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
                            : hasFlavors || hasBurgerConfig
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
              cart.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0 flex flex-col gap-2">
                  {/* Nombre, detalle de sabores grande y visible, nota y precio unitario */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white leading-snug">
                        {item.name}
                      </h4>
                      {item.flavorDetail && (
                        <div className="mt-1 px-2 py-1 rounded bg-[#151515] border-l-3 border-orange-500">
                          <p className="text-sm font-extrabold text-orange-400 leading-tight">
                            {item.flavorDetail}
                          </p>
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
                        onClick={() => addToCart(item)}
                        className="w-6 h-6 rounded bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                        title="Aumentar cantidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
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

            {/* BOTONES DE ACCIÓN: COMANDA Y COBRAR EN BATCH */}
            <div className="grid grid-cols-2 gap-2 pt-1">
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

              {/* BOTÓN PRINCIPAL: COBRAR CON BATCH WRITE A FIRESTORE */}
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
  );
};

export default POSDashboard;
