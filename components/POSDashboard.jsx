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
    addToCart, 
    removeFromCart, 
    clearCart, 
    cartTotal 
  } = useCartStore();

  // Carrito y productos exclusivos de la mesa activa seleccionada
  const cart = tableCarts?.[activeTable] || [];

  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketNote, setTicketNote] = useState('');
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [paymentError, setPaymentError] = useState('');

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
        mesa: activeTable || 'Mesa 01',
        total: Number(total) || 0,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General'
        })),
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        cajero: currentUser?.email || 'Mozo Salón',
        nota: (ticketNote || '').trim(),
        estado: 'completado',
        tipo: 'venta_directa'
      };

      batch.set(ventaDocRef, ventaPayload);

      // B) Iterar sobre los productos vendidos y, en el MISMO batch, hacer un descuento de la propiedad 'stock' en 'productos'
      for (const item of cart) {
        if (item.id) {
          const prodRef = doc(db, 'productos', item.id);
          batch.update(prodRef, {
            stock: increment(-Number(item.quantity || 1)),
            updatedAt: serverTimestamp()
          });
        }
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
      console.error('Error al procesar batch write en Firestore:', err);
      setPaymentError('Error al conectar con Firestore. Intenta de nuevo.');
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
        mesa: activeTable || 'Mesa 01',
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          category: i.category || 'General',
          unit: i.unit || 'unidades'
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
              Firestore Sync
            </span>
          </div>
        </div>

        {/* Selector de Mesas Conectado a Zustand */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline mr-1">Mesa:</span>
          <div className="flex bg-[#151515] p-1 rounded-lg border border-neutral-800">
            {['Mesa 01', 'Mesa 02', 'Barra 01', 'Delivery'].map((table) => {
              const tableItemCount = (tableCarts?.[table] || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
              return (
                <button
                  key={table}
                  type="button"
                  onClick={() => setActiveTable(table)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
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
                  const inCart = cart.find((i) => i.id === product.id);
                  const isOutOfStock = (product.stock || 0) <= 0;

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

                      {/* Título, precio y stock sincronizado en Firestore */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-neutral-400 uppercase">
                            {product.category}
                          </span>
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

                      {/* BOTÓN NARANJA DE "AÑADIR" CONECTADO A ZUSTAND addToCart */}
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={`h-11 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer active:scale-95 ${
                          isOutOfStock
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-xs'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inCart ? `(${inCart.quantity})` : 'Añadir'}</span>
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
                <span className="px-2 py-0.5 bg-neutral-800 text-orange-400 border border-neutral-700/60 text-[10px] font-bold rounded">
                  {activeTable}
                </span>
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

            {/* Selector Visual Minimalista de Mesa (Mesa 01, Mesa 02, Barra 01, Delivery) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="uppercase font-bold tracking-wider text-neutral-400">
                  Mesa / Ubicación:
                </span>
                <span className="text-orange-400 font-semibold font-mono">
                  {activeTable}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {['Mesa 01', 'Mesa 02', 'Barra 01', 'Delivery'].map((table) => {
                  const isSelected = activeTable === table;
                  const count = (tableCarts?.[table] || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
                  return (
                    <button
                      key={table}
                      type="button"
                      onClick={() => setActiveTable(table)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 cursor-pointer text-center truncate ${
                        isSelected
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20 ring-1 ring-orange-500 font-bold'
                          : 'bg-[#222222] text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                      }`}
                    >
                      <span>{table}</span>
                      {count > 0 && (
                        <span className={`ml-1 text-[10px] font-mono ${isSelected ? 'text-orange-100 font-bold' : 'text-orange-400'}`}>
                          ({count})
                        </span>
                      )}
                    </button>
                  );
                })}
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
                  {/* Nombre, precio unitario y subtotal */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {item.name}
                      </h4>
                      <span className="text-[11px] text-neutral-400 font-mono">
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

      {/* TOAST DE COMANDA REGISTRADA CON ÉXITO / ENVIADO A COCINA */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in">
          <div className="bg-[#222222] border border-orange-500/70 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">{successToast}</p>
              <p className="text-[11px] text-neutral-400">
                {successToast === 'Enviado a cocina'
                  ? `Pedido registrado en comandas_activas para ${activeTable}`
                  : 'Venta guardada y stock descontado en Firestore'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSDashboard;
