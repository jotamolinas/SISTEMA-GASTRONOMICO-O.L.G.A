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
  Database
} from 'lucide-react';
import { db } from '../services/firebase';
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

export const InventoryManager = () => {
  // ESTADO DINÁMICO DESDE FIRESTORE
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Formulario del Modal
  const [formData, setFormData] = useState({
    name: '',
    category: 'Comidas',
    price: '',
    stock: '',
    boxSize: 24,
    barcode: '',
    unit: 'unidades'
  });

  // Estado del Escáner de Cámara
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [autoCompleteToast, setAutoCompleteToast] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Referencia al lector Html5Qrcode
  const html5QrCodeRef = useRef(null);

  // 1. SINCRONIZACIÓN EN TIEMPO REAL CON FIRESTORE (onSnapshot con mapeo estricto { id: doc.id, ...doc.data() })
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
        const firestoreProducts = docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          id: doc.id // Asegura que el id real del documento nunca sea sobrescrito por datos fantasma
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
    setFormData({
      name: '',
      category: 'Comidas',
      price: '',
      stock: '24',
      boxSize: 24,
      barcode: '',
      unit: 'unidades'
    });
    setScannerError('');
    setAutoCompleteToast('');
    setModalOpen(true);
  };

  // Abrir Modal para Editar Producto
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price ? String(item.price) : '',
      stock: String(item.stock || 0),
      boxSize: item.boxSize || 24,
      barcode: item.barcode || '',
      unit: item.unit || 'unidades'
    });
    setScannerError('');
    setAutoCompleteToast('');
    setModalOpen(true);
  };

  // Eliminar Producto en Firestore (deleteDoc)
  const handleDeleteProduct = async (id, name) => {
    console.log("Intentando borrar ID:", id);

    if (!id) {
      console.error("ID no definido para eliminar");
      showToast("Error: No se encontró el ID del producto en Firestore");
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar "${name || 'este producto'}" del inventario?`)) {
      return;
    }

    try {
      // 1. Si el ID existe, ejecutar deleteDoc en Firestore
      await deleteDoc(doc(db, 'productos', id));
      // 2. Eliminar del estado local (UI) SOLO si la promesa de Firebase es exitosa
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast(`Producto "${name || 'Producto'}" eliminado exitosamente`);
    } catch (e) {
      console.error('Error al eliminar producto en Firestore:', e);
      showToast('Error al eliminar el producto en base de datos');
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
        boxSize: matched.boxSize,
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

  // 2. GUARDAR EN FIRESTORE (addDoc o updateDoc)
  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    await stopCameraScanner();

    try {
      if (editingItem) {
        // EDICIÓN EN FIRESTORE (updateDoc con db)
        const prodRef = doc(db, 'productos', editingItem.id);
        await updateDoc(prodRef, {
          name: formData.name.trim(),
          category: formData.category,
          price: Number(formData.price) || 0,
          stock: Number(formData.stock) || 0,
          boxSize: Number(formData.boxSize) || 24,
          barcode: formData.barcode.trim(),
          unit: formData.unit || 'unidades',
          updatedAt: serverTimestamp()
        });
        showToast(`Producto "${formData.name.trim()}" actualizado`);
      } else {
        // ALTA EN FIRESTORE (addDoc con db)
        await addDoc(collection(db, 'productos'), {
          name: formData.name.trim(),
          category: formData.category,
          price: Number(formData.price) || 0,
          stock: Number(formData.stock) || 24,
          boxSize: Number(formData.boxSize) || 24,
          barcode: formData.barcode.trim(),
          unit: formData.unit || 'unidades',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast(`Producto "${formData.name.trim()}" creado en Firestore`);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Error guardando en Firestore:', err);
      showToast('Error al conectar con Firestore');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductIcon = (type, category) => {
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
      {/* 1. CABECERA: TÍTULO, BOTÓN NUEVO PRODUCTO Y ESTADO FIRESTORE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#222222] border border-neutral-800 p-5 sm:p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
              Inventario & Firestore Sync
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#151515] text-emerald-400 border border-neutral-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Vivo (Firestore)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Inventario Rápido y Gamificado
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm">
            Toca +1 Caja para sumar fardos masivos. Sincronizado automáticamente con las tablets de mozos.
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
            <p className="text-sm font-semibold text-white">Sincronizando inventario con Firestore...</p>
            <p className="text-xs text-neutral-400">Cargando catálogo en tiempo real sin recargar la página</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
          <Database className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No hay productos en la base de datos</h3>
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
            const currentCount = item.stock || 0;
            const boxSize = item.boxSize || 24;
            const boxes = Math.floor(currentCount / boxSize);
            const looseUnits = currentCount % boxSize;
            const isLowStock = currentCount <= (item.minAlert || 12);

            return (
              <div
                key={item.id}
                className={`bg-[#222222] border rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-colors shadow-sm ${
                  isLowStock
                    ? 'border-orange-500/40 bg-[#24201e]'
                    : 'border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Encabezado del Producto + Acciones Minimalistas de Editar/Eliminar */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#151515] border border-neutral-800 flex items-center justify-center shrink-0">
                      {getProductIcon(item.type, item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          {item.category}
                        </span>
                        {item.barcode && (
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
                      title="Editar producto en Firestore"
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

                {/* CENTRO: 'STOCK TOTAL' CON NÚMERO MUY GRANDE EN COLOR CLARO */}
                <div className="my-3 py-4 px-5 bg-[#151515] rounded-xl border border-neutral-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Stock Total (Firestore)
                    </span>
                    <div className="flex items-baseline gap-2 justify-center sm:justify-start mt-0.5">
                      <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                        currentCount <= 0 ? 'text-red-400' : 'text-white'
                      }`}>
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

                {/* CONTROLES TÁCTILES MASIVOS */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* BOTÓN GRIS OSCURO: [📦 +1 Caja (24u)] */}
                  <button
                    type="button"
                    onClick={() => handleAddBox(item)}
                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-neutral-700/60 cursor-pointer active:scale-97 shadow-xs"
                  >
                    <Package className="w-4 h-4 text-orange-500" />
                    <span>📦 +1 Caja ({boxSize}u)</span>
                  </button>

                  {/* BOTONES CUADRADOS [+] Y [-] PARA UNIDADES SUELTAS */}
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
                  {editingItem ? 'Editar Producto en Firestore' : 'Nuevo Producto en Firestore'}
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

            <form onSubmit={handleSubmitModal} className="mt-4 space-y-4">
              {/* CAMPO DE CÓDIGO DE BARRAS CON BOTÓN '📷 ESCANEAR' */}
              <div className="bg-[#151515] p-3.5 rounded-xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-orange-500" />
                    <span>Código de Barras</span>
                  </label>

                  {/* BOTÓN '📷 ESCANEAR' */}
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

                  {/* Acceso rápido para probar el código '123456789' solicitado */}
                  <button
                    type="button"
                    onClick={() => applyBarcodeData('123456789')}
                    className="px-2.5 py-1.5 bg-[#222222] hover:bg-neutral-800 text-[10px] font-mono text-orange-400 border border-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Simular lectura de prueba"
                  >
                    Test: 123456789
                  </button>
                </div>

                {/* CONTENEDOR DEL ESCÁNER HTML5-QRCODE INTEGRADO */}
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

              {/* Nombre */}
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Cerveza Patagonia 710ml"
                  className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Categoría (Comida / Bebida) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Comidas">Comida</option>
                    <option value="Bebidas">Bebida</option>
                  </select>
                </div>

                {/* Precio */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Precio de Venta (Gs.)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Ej: 25000"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Stock Inicial y Tamaño de Caja */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Stock (Unidades)
                  </label>
                  <input
                    type="number"
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
                    value={formData.boxSize}
                    onChange={(e) => setFormData({ ...formData, boxSize: Number(e.target.value) || 24 })}
                    placeholder="24"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

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
                  <span>{editingItem ? 'Actualizar en Firestore' : 'Guardar en Firestore'}</span>
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
              <p className="text-[11px] text-neutral-400">Sincronización en vivo con Firestore</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;
