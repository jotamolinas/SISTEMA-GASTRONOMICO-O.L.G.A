import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
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
  Clock, 
  CheckCircle2, 
  X, 
  ShoppingBag, 
  Send, 
  LogOut 
} from 'lucide-react';

/**
 * Catálogo estático JSON con productos gastronómicos
 */
export const menuDataMock = [
  {
    id: 'prod-1',
    name: 'Hamburguesa Doble Smash',
    category: 'comidas',
    price: 45000,
    icon: 'burger',
    badge: 'Popular'
  },
  {
    id: 'prod-2',
    name: 'Pizza Artesanal Margherita',
    category: 'comidas',
    price: 60000,
    icon: 'pizza',
    badge: 'Horno'
  },
  {
    id: 'prod-3',
    name: 'Papas Rústicas Trufadas',
    category: 'comidas',
    price: 28000,
    icon: 'fries',
    badge: 'Entrada'
  },
  {
    id: 'prod-4',
    name: 'Cerveza IPA Tirada 500ml',
    category: 'bebidas',
    price: 25000,
    icon: 'beer',
    badge: 'Tirada'
  },
  {
    id: 'prod-5',
    name: 'Limonada con Menta',
    category: 'bebidas',
    price: 18000,
    icon: 'lemonade',
    badge: 'Natural'
  },
  {
    id: 'prod-6',
    name: 'Cocktail Gin Tonic Frutos Rojos',
    category: 'bebidas',
    price: 35000,
    icon: 'cocktail',
    badge: 'Especial'
  }
];

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PY', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(amount) + ' Gs.';
};

// Íconos sobrios de productos
const ProductIcon = ({ type }) => {
  switch (type) {
    case 'burger':
      return <Flame className="w-6 h-6 text-orange-500" />;
    case 'pizza':
      return <Pizza className="w-6 h-6 text-orange-500" />;
    case 'fries':
      return <UtensilsCrossed className="w-6 h-6 text-orange-500" />;
    case 'beer':
      return <Beer className="w-6 h-6 text-orange-500" />;
    case 'lemonade':
      return <Coffee className="w-6 h-6 text-orange-500" />;
    case 'cocktail':
      return <Wine className="w-6 h-6 text-orange-500" />;
    default:
      return <UtensilsCrossed className="w-6 h-6 text-orange-500" />;
  }
};

export const POSDashboard = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();

  // CONEXIÓN AL STORE ZUSTAND (LOCAL-FIRST)
  const { cart, addToCart, removeFromCart, clearCart, cartTotal } = useCartStore();

  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState('Mesa 04');
  const [ticketNote, setTicketNote] = useState('');
  
  const [orderSentToast, setOrderSentToast] = useState(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState(false);

  // Cantidad total de productos en el ticket
  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [cart]);

  // Cálculo del total derivado del store
  const total = typeof cartTotal === 'function' ? cartTotal() : cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const taxAmount = Math.round(total * 0.10);

  // ACCIÓN PRINCIPAL DE COBRAR: IMPRIME EN CONSOLA Y VACÍA EL TICKET
  const handleCobrar = () => {
    if (cart.length === 0) return;

    const orderSummary = {
      idPedido: `TKT-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      fechaFormateada: new Date().toLocaleString('es-PY'),
      mesa: selectedTable,
      observaciones: ticketNote || 'Ninguna',
      productos: cart.map((i) => ({
        id: i.id,
        nombre: i.name,
        cantidad: i.quantity,
        precioUnitario: i.price,
        subtotal: i.price * i.quantity
      })),
      totalCobrado: total,
      cajeroMozo: currentUser?.email || 'Mozo Salón'
    };

    // Imprime el pedido en la consola según lo solicitado
    console.log('--- PEDIDO COBRADO CON ÉXITO ---', orderSummary);

    // Vacía todo el ticket
    clearCart();
    setTicketNote('');

    // Notificación visual de confirmación
    setPaymentSuccessToast(true);
    setTimeout(() => {
      setPaymentSuccessToast(false);
    }, 3500);
  };

  // Enviar a Cocina (imprime comanda)
  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    console.log('--- COMANDA ENVIADA A COCINA ---', {
      mesa: selectedTable,
      nota: ticketNote,
      items: cart
    });
    setOrderSentToast(true);
    setTimeout(() => {
      setOrderSentToast(false);
    }, 3500);
  };

  // Filtrado de productos por categoría y buscador
  const filteredProducts = useMemo(() => {
    return menuDataMock.filter((prod) => {
      const matchesCategory =
        selectedCategory === 'todos' || prod.category === selectedCategory;
      const matchesSearch =
        prod.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

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

          {/* Logo sobrio */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">
              Gastro<span className="text-orange-500">POS</span>
            </span>
            <span className="text-[10px] text-neutral-400 font-medium hidden md:inline">
              • Terminal de Salón (Local-First)
            </span>
          </div>
        </div>

        {/* Selector de Mesas */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline mr-1">Ubicación:</span>
          <div className="flex bg-[#151515] p-1 rounded-lg border border-neutral-800">
            {['Mesa 01', 'Mesa 04', 'Mesa 08', 'Barra'].map((table) => (
              <button
                key={table}
                type="button"
                onClick={() => setSelectedTable(table)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedTable === table
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {table}
              </button>
            ))}
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
                Todos ({menuDataMock.length})
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
                Comidas (3)
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
                Bebidas (3)
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

          {/* GRILLA DE PRODUCTOS LIMPIA */}
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.id === product.id);

                return (
                  <div
                    key={product.id}
                    className={`bg-[#222222] rounded-xl p-4 flex items-center justify-between gap-3 transition-colors border ${
                      inCart
                        ? 'border-orange-500/50 bg-[#262626]'
                        : 'border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    {/* Ícono a la izquierda */}
                    <div className="w-12 h-12 rounded-lg bg-[#151515] border border-neutral-800 flex items-center justify-center shrink-0">
                      <ProductIcon type={product.icon} />
                    </div>

                    {/* Título y precio al centro */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-neutral-400 uppercase">
                          {product.badge}
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
                      className="h-11 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shrink-0 bg-orange-600 hover:bg-orange-500 text-white cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{inCart ? `(${inCart.quantity})` : 'Añadir'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* COLUMNA DERECHA: TICKET / CARRITO CONECTADO A ZUSTAND      */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-96 xl:w-[390px] bg-[#1a1a1a] border-l border-neutral-800 flex flex-col shrink-0 h-auto lg:h-[calc(100vh-3.5rem)]">
          {/* Header del Ticket */}
          <div className="p-3.5 bg-[#151515] border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-500" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-white">
                Ticket de Venta
              </h2>
              <span className="px-2 py-0.5 bg-neutral-800 text-orange-400 text-[10px] font-bold rounded">
                {selectedTable}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                title="Vaciar ticket"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
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

          {/* TOTAL ACTUALIZADO EN TIEMPO REAL Y BOTÓN COBRAR */}
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

            {/* BOTONES DE ACCIÓN: COMANDA Y COBRAR */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleSendToKitchen}
                className="py-2.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 font-semibold text-xs uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-neutral-400" />
                <span>Comanda</span>
              </button>

              {/* BOTÓN PRINCIPAL: COBRAR */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCobrar}
                className="py-2.5 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>COBRAR</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* TOASTS MINIMALISTAS */}
      {orderSentToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in">
          <div className="bg-[#222222] border border-orange-500/50 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs">
            <Send className="w-4 h-4 text-orange-500" />
            <span>Comanda enviada a cocina</span>
          </div>
        </div>
      )}

      {paymentSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in">
          <div className="bg-[#222222] border border-orange-500/50 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-orange-500" />
            <span>¡Pedido cobrado y registrado con éxito!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSDashboard;
