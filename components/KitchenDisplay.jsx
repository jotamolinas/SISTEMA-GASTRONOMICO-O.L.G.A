import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc
} from 'firebase/firestore';
import {
  ArrowLeft,
  ChefHat,
  Coffee,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  UtensilsCrossed,
  Flame,
  StickyNote,
  Tablet,
  Check,
  X,
  BellRing,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  normalizeSelectedTags,
  isAllergyTag,
  isTimingTag
} from '../utils/customizationOptions';

const getOrderDate = (comanda) => {
  if (comanda?.timestamp && typeof comanda.timestamp.toDate === 'function') {
    return comanda.timestamp.toDate();
  }
  if (comanda?.timestamp && typeof comanda.timestamp.seconds === 'number') {
    return new Date(comanda.timestamp.seconds * 1000);
  }
  if (comanda?.fecha) {
    const parsed = new Date(comanda.fecha);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const formatOrderTime = (date) => {
  return date.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const getElapsedMinutes = (orderDate, nowMs) => {
  const diffMs = Math.max(0, nowMs - orderDate.getTime());
  return Math.floor(diffMs / 60000);
};

const formatElapsedLabel = (minutes) => {
  if (minutes < 1) return 'Recién llegado';
  if (minutes === 1) return 'Hace 1 min';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `Hace ${hours}h ${remMins}m`;
};

const filterItemsByStation = (items, station) => {
  const list = Array.isArray(items) ? items : [];
  if (station === 'todas') return list;

  return list.filter((item) => {
    const cat = (item.category || '').toLowerCase();
    const isDrink = cat.includes('bebida') || item.customizationType === 'cafe';
    if (station === 'comidas') return !isDrink;
    if (station === 'bebidas') return isDrink;
    return true;
  });
};

const resolveInitialStation = (searchParams, initialStationProp) => {
  const param = (searchParams.get('estacion') || '').toLowerCase().trim();
  if (param === 'bebidas' || param === 'barra') return 'bebidas';
  if (param === 'todas' || param === 'todo') return 'todas';
  if (param === 'comidas' || param === 'cocina') return 'comidas';
  if (initialStationProp === 'bebidas' || initialStationProp === 'todas' || initialStationProp === 'comidas') {
    return initialStationProp;
  }
  return 'comidas';
};

export const KitchenDisplay = ({ currentUser, onLogout, initialStation }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [comandas, setComandas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Filtro estricto de estación: "Solo Cocina (Comidas)" por defecto, o "Barra (Bebidas)" si entra por ?estacion=bebidas o /barra
  const [stationFilter, setStationFilter] = useState(() =>
    resolveInitialStation(searchParams, initialStation)
  );

  // Sincroniza estación si cambia el parámetro URL o la ruta (/cocina <-> /barra)
  useEffect(() => {
    setStationFilter(resolveInitialStation(searchParams, initialStation));
  }, [searchParams, initialStation]);

  // Alertas sensoriales: Sonido ON/OFF (Web Audio API) + Triple Piscada Naranja (0.5s x 3 = 1.5s)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [flashingIds, setFlashingIds] = useState([]);

  const audioCtxRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const flashTimeoutRef = useRef(null);
  const stationFilterRef = useRef(stationFilter);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    stationFilterRef.current = stationFilter;
  }, [stationFilter]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Timbre sintetizado vía Web Audio API (sin archivos externos)
  const playKitchenChime = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const tones = [
        { freq: 880, start: 0, duration: 0.32, gain: 0.24 },      // A5
        { freq: 1318.51, start: 0.16, duration: 0.5, gain: 0.28 }, // E6
        { freq: 1760, start: 0.34, duration: 0.45, gain: 0.18 }   // A6
      ];

      tones.forEach(({ freq, start, duration, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.0001, now + start);
        gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.02);
      });
    } catch (err) {
      console.warn('No se pudo reproducir el timbre de cocina:', err);
    }
  }, []);

  // Dispara triple piscada naranja intensa (3 destellos de 0.5s = ~1.5s) + timbre si Sonido ON
  const triggerOrderAlert = useCallback(
    (orderIds = []) => {
      if (soundEnabledRef.current) {
        playKitchenChime();
      }

      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }

      setFlashingIds(orderIds);
      setFlashKey((prev) => prev + 1);
      setIsFlashing(true);

      flashTimeoutRef.current = setTimeout(() => {
        setIsFlashing(false);
        setFlashingIds([]);
        flashTimeoutRef.current = null;
      }, 1550);
    },
    [playKitchenChime]
  );

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Reloj liviano para actualizar los minutos transcurridos cada 15 segundos
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Suscripción en tiempo real a comandas_activas con docChanges() (type === 'added')
  useEffect(() => {
    setIsLoading(true);
    setSyncError('');

    const colRef = collection(db, 'comandas_activas');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));

        // Filtrar solo comandas activas / en cocina
        const activeDocs = docs.filter((c) => {
          const estado = (c.estado || 'en_cocina').toLowerCase();
          return estado !== 'listo' && estado !== 'entregado' && estado !== 'completado';
        });

        // Ordenar por fecha/hora de creación (FIFO: más antiguas primero)
        activeDocs.sort((a, b) => {
          const dateA = getOrderDate(a).getTime();
          const dateB = getOrderDate(b).getTime();
          return dateA - dateB;
        });

        // Ignorar el primer lote de carga inicial al montar la pantalla
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        } else {
          const newlyAdded = snapshot
            .docChanges()
            .filter((change) => change.type === 'added')
            .map((change) => ({
              ...change.doc.data(),
              id: change.doc.id
            }))
            .filter((order) => {
              const estado = (order.estado || 'en_cocina').toLowerCase();
              if (estado === 'listo' || estado === 'entregado' || estado === 'completado') {
                return false;
              }
              return filterItemsByStation(order.items, stationFilterRef.current).length > 0;
            });

          if (newlyAdded.length > 0) {
            triggerOrderAlert(newlyAdded.map((o) => o.id));
          }
        }

        setComandas(activeDocs);
        setIsLoading(false);
        setSyncError('');
      },
      (err) => {
        console.error('Error al escuchar cola de cocina:', err);
        setSyncError('No se pudo sincronizar la cola de cocina. Verifica tu conexión o permisos.');
        setIsLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [triggerOrderAlert]);

  // Filtro estricto por estación: filtra órdenes Y filtra los ítems visibles dentro de cada tarjeta
  const filteredComandas = useMemo(() => {
    return comandas
      .map((comanda) => ({
        ...comanda,
        visibleItems: filterItemsByStation(comanda.items, stationFilter)
      }))
      .filter((comanda) => comanda.visibleItems.length > 0);
  }, [comandas, stationFilter]);

  const stationCounts = useMemo(() => {
    let comidas = 0;
    let bebidas = 0;
    for (const c of comandas) {
      if (filterItemsByStation(c.items, 'comidas').length > 0) comidas += 1;
      if (filterItemsByStation(c.items, 'bebidas').length > 0) bebidas += 1;
    }
    return { comidas, bebidas, todas: comandas.length };
  }, [comandas]);

  const totalItemsPending = useMemo(() => {
    return filteredComandas.reduce((acc, c) => {
      return acc + c.visibleItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    }, 0);
  }, [filteredComandas]);

  const handleMarkReady = async (comanda) => {
    if (!comanda?.id || processingId) return;

    setProcessingId(comanda.id);
    setSyncError('');

    try {
      await deleteDoc(doc(db, 'comandas_activas', comanda.id));
      setConfirmingId(null);
      setToastMessage(`Comanda de ${comanda.mesa || 'Mesa'} marcada como lista`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error al completar comanda:', err);
      setSyncError('Error al marcar la comanda como lista. Intenta nuevamente.');
      setTimeout(() => setSyncError(''), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex flex-col font-sans select-none relative">
      {/* TRIPLE PISCADA NARANJA INTENSA (3 x 0.5s = 1.5s) CON pointer-events-none */}
      {isFlashing && (
        <div
          key={flashKey}
          aria-hidden="true"
          className="kds-triple-flash-overlay pointer-events-none fixed inset-0 z-50 border-[8px] border-[#EA580C] bg-orange-600/40 shadow-[inset_0_0_96px_rgba(234,88,12,0.9)]"
        />
      )}

      {/* 1. BARRA SUPERIOR KDS */}
      <header className="min-h-14 bg-[#1a1a1a] border-b border-neutral-800 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate('/consola')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Regresar a la administración"
          >
            <ArrowLeft className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Volver al Panel</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-black border border-neutral-800 shrink-0 shadow-xs"
            />
            <span className="font-bold text-sm tracking-tight text-white">
              Gastro<span className="text-orange-500">POS</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/40 flex items-center gap-1">
              {stationFilter === 'bebidas' ? (
                <Coffee className="w-3 h-3 text-orange-500" />
              ) : (
                <ChefHat className="w-3 h-3 text-orange-500" />
              )}
              <span>
                {stationFilter === 'bebidas'
                  ? 'Barra'
                  : stationFilter === 'todas'
                  ? 'Cocina & Barra'
                  : 'Cocina'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#151515] text-emerald-400 border border-neutral-800 hidden md:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Tiempo Real
            </span>
          </div>
        </div>

        {/* Controles de Sonido, Probar Alerta, Contadores y Accesos */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-[#222222] border-orange-500/40 text-orange-400 hover:bg-neutral-800'
                : 'bg-[#151515] border-neutral-800 text-neutral-500 hover:text-neutral-300'
            }`}
            title={soundEnabled ? 'Timbre activo (clic para silenciar)' : 'Timbre silenciado (clic para activar)'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>{soundEnabled ? 'Sonido ON' : 'Sonido OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => triggerOrderAlert([])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-orange-500/40 text-orange-400 hover:text-orange-300 text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            title="Probar triple destello naranja y aviso sonoro"
          >
            <BellRing className="w-3.5 h-3.5 text-orange-500" />
            <span>Probar Alerta</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#151515] border border-neutral-800 rounded-lg text-xs">
            <span className="text-neutral-400">En cola:</span>
            <span className="font-mono font-bold text-orange-500">{filteredComandas.length}</span>
            <span className="text-neutral-700">|</span>
            <span className="text-neutral-400">Ítems:</span>
            <span className="font-mono font-bold text-white">{totalItemsPending}</span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/pos-terminal')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Ir a Terminal de Mozos"
          >
            <Tablet className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden md:inline">POS Mozos</span>
          </button>

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

      {/* 2. SUB-BARRA OPERATIVA: FILTRO ESTRICTO DE ESTACIÓN */}
      <div className="bg-[#151515] border-b border-neutral-800/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStationFilter('comidas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              stationFilter === 'comidas'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Solo Cocina (Comidas) ({stationCounts.comidas})</span>
          </button>

          <button
            type="button"
            onClick={() => setStationFilter('bebidas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              stationFilter === 'bebidas'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Barra (Bebidas) ({stationCounts.bebidas})</span>
          </button>

          <button
            type="button"
            onClick={() => setStationFilter('todas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              stationFilter === 'todas'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Todas ({stationCounts.todas})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          <span>{formatOrderTime(new Date(nowMs))}</span>
          <span className="text-neutral-600 hidden sm:inline">•</span>
          <span className="text-neutral-400 font-sans hidden sm:inline">
            Operador: {currentUser?.email?.split('@')[0] || 'Cocina'}
          </span>
        </div>
      </div>

      {/* 3. CONTENIDO PRINCIPAL: COLA DE COMANDAS */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {syncError && (
          <div className="mb-4 p-3.5 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="bg-[#222222] border border-neutral-800 rounded-xl p-4 space-y-4 animate-pulse h-64"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 w-24 bg-neutral-800 rounded" />
                  <div className="h-4 w-16 bg-neutral-800 rounded" />
                </div>
                <div className="space-y-2.5 pt-2">
                  <div className="h-4 w-full bg-neutral-800 rounded" />
                  <div className="h-4 w-3/4 bg-neutral-800 rounded" />
                  <div className="h-4 w-5/6 bg-neutral-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredComandas.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#222222] border border-neutral-800 flex items-center justify-center mb-4">
              {stationFilter === 'bebidas' ? (
                <Coffee className="w-8 h-8 text-orange-500/80" />
              ) : (
                <UtensilsCrossed className="w-8 h-8 text-orange-500/80" />
              )}
            </div>
            <h2 className="text-lg font-bold text-white">Sin comandas pendientes</h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-md mt-1.5">
              {stationFilter === 'comidas'
                ? 'No hay platos de comida en espera. Las órdenes de cocina aparecerán aquí automáticamente en tiempo real.'
                : stationFilter === 'bebidas'
                ? 'No hay bebidas ni pedidos de cafetería pendientes en barra.'
                : 'Los pedidos enviados desde la Terminal de Mozos aparecerán aquí automáticamente en tiempo real.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {filteredComandas.map((comanda, index) => {
              const orderDate = getOrderDate(comanda);
              const elapsedMins = getElapsedMinutes(orderDate, nowMs);
              const isUrgent = elapsedMins >= 15;
              const isConfirming = confirmingId === comanda.id;
              const isProcessing = processingId === comanda.id;
              const isCardFlashing = flashingIds.includes(comanda.id);
              const items = comanda.visibleItems;
              const hasNote = Boolean(comanda.nota && String(comanda.nota).trim());

              // Recolectar restricciones / alergias de los ítems visibles
              const cardAllergies = [];
              items.forEach((it) => {
                normalizeSelectedTags(it.selectedTags || []).forEach((tag) => {
                  if (isAllergyTag(tag) && !cardAllergies.includes(tag.label)) {
                    cardAllergies.push(tag.label);
                  }
                });
              });
              const hasAllergyAlert = cardAllergies.length > 0;

              return (
                <article
                  key={comanda.id}
                  className={`bg-[#222222] rounded-xl border flex flex-col overflow-hidden shadow-lg transition-colors ${
                    isCardFlashing
                      ? 'kds-card-triple-flash border-orange-500'
                      : hasAllergyAlert
                      ? 'border-red-500/80'
                      : isUrgent
                      ? 'border-orange-500/80'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Cabecera de Tarjeta */}
                  <div className="bg-[#151515] px-4 py-3 border-b border-neutral-800 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          #{index + 1}
                        </span>
                        <h3 className="text-base font-bold text-white truncate">
                          {comanda.mesa || 'Mesa'}
                        </h3>
                      </div>
                      {comanda.cajero && (
                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                          Mozo: {String(comanda.cajero).split('@')[0]}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-xs font-mono font-bold text-neutral-200">
                        {formatOrderTime(orderDate)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isUrgent
                            ? 'bg-orange-600 text-white'
                            : 'bg-[#222222] text-orange-400 border border-neutral-800'
                        }`}
                      >
                        {isUrgent && <Flame className="w-3 h-3" />}
                        <span>{formatElapsedLabel(elapsedMins)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Alerta Destacada de Alergias / Restricciones */}
                  {hasAllergyAlert && (
                    <div className="px-4 py-2 bg-red-950/90 border-b border-red-800/80 flex items-center gap-2 text-red-100">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <div className="text-[11px] leading-snug">
                        <span className="font-bold uppercase tracking-wider mr-1.5 text-red-300">
                          Alerta:
                        </span>
                        <span className="font-bold">{cardAllergies.join(' • ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Lista de Ítems Filtrados por Estación (SIN PRECIOS NI MONTOS) */}
                  <div className="p-4 space-y-2.5 flex-1">
                    <div className="divide-y divide-neutral-800/70">
                      {items.map((item, idx) => {
                        const tags = normalizeSelectedTags(item.selectedTags || []);
                        const allergyTags = tags.filter((t) => isAllergyTag(t));
                        const timingTags = tags.filter((t) => !isAllergyTag(t) && isTimingTag(t));
                        const otherTags = tags.filter((t) => !isAllergyTag(t) && !isTimingTag(t));

                        return (
                          <div
                            key={`${comanda.id}-${item.variantId || item.id || idx}-${idx}`}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="min-w-8 h-7 px-2 rounded-lg bg-[#151515] border border-orange-500/40 text-orange-500 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                                {Number(item.quantity) || 1}x
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm sm:text-base font-bold text-white leading-snug">
                                    {item.name || 'Producto'}
                                  </p>
                                  {timingTags.length > 0 && (
                                    <div className="flex flex-wrap justify-end gap-1 shrink-0">
                                      {timingTags.map((tag, tIdx) => (
                                        <span
                                          key={`time-${tIdx}`}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 border border-amber-500/80 text-amber-200"
                                        >
                                          <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                          <span>{tag.label}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {item.flavorDetail && (
                                  <div className="mt-1.5 px-2.5 py-1.5 rounded-r-lg bg-[#151515] border-l-4 border-orange-500">
                                    <p className="text-base font-extrabold text-orange-400 leading-tight break-words">
                                      {item.flavorDetail}
                                    </p>
                                  </div>
                                )}

                                {allergyTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {allergyTags.map((tag, aIdx) => (
                                      <span
                                        key={`allergy-${aIdx}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 border border-red-500 text-red-100 uppercase tracking-wide"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                        <span>{tag.label}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {otherTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {otherTags.map((tag, oIdx) => (
                                      <span
                                        key={`opt-${oIdx}`}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-600/20 border border-orange-500/50 text-orange-200"
                                      >
                                        {tag.label}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.itemNote && (
                                  <p className="mt-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/40 px-2 py-1 rounded">
                                    Nota ítem: {item.itemNote}
                                  </p>
                                )}

                                {item.category && (
                                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium block mt-1">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Nota de Cocina si existe */}
                    {hasNote && (
                      <div className="mt-3 p-3 rounded-lg bg-[#151515] border border-orange-500/50 flex items-start gap-2.5">
                        <StickyNote className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-400">
                            Nota de Cocina
                          </span>
                          <p className="text-xs text-neutral-100 leading-relaxed break-words mt-0.5">
                            {comanda.nota}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pie de Tarjeta: Botón Listo / Entregado con Confirmación Inline (sin window.confirm) */}
                  <div className="p-3 bg-[#151515] border-t border-neutral-800">
                    {isConfirming ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-center text-neutral-300 font-medium">
                          ¿Confirmar pedido listo y retirar de cola?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setConfirmingId(null)}
                            className="py-2.5 px-3 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700/60 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleMarkReady(comanda)}
                            className="py-2.5 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {isProcessing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Quitando...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirmar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setConfirmingId(comanda.id)}
                        className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Listo / Entregado</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* TOAST DE CONFIRMACIÓN */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50">
          <div className="bg-[#222222] border border-orange-500/70 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
            <span className="font-semibold text-sm">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
