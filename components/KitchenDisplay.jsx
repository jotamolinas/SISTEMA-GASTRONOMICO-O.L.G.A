import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import {
  ArrowLeft,
  ChefHat,
  Coffee,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Tablet,
  UtensilsCrossed,
  RotateCcw,
  Trash2,
  ClipboardList,
  BellRing,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  normalizeSelectedTags,
  isAllergyTag,
  isTimingTag
} from '../utils/customizationOptions';

const formatElapsed = (fechaIso, timestamp, nowMs) => {
  let createdMs = null;
  if (timestamp && typeof timestamp.toMillis === 'function') {
    createdMs = timestamp.toMillis();
  } else if (fechaIso) {
    const parsed = Date.parse(fechaIso);
    if (!Number.isNaN(parsed)) createdMs = parsed;
  }
  if (!createdMs) return 'Recién';

  const diffMin = Math.max(0, Math.floor((nowMs - createdMs) / 60000));
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `${diffMin} min`;
  const hrs = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return `${hrs}h ${rem}m`;
};

const getOrderCreatedMs = (comanda) => {
  if (comanda?.timestamp && typeof comanda.timestamp.toMillis === 'function') {
    return comanda.timestamp.toMillis();
  }
  if (comanda?.fecha) {
    const parsed = Date.parse(comanda.fecha);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const filterItemsByStation = (items, station) => {
  const list = Array.isArray(items) ? items : [];
  if (station === 'todo') return list;

  return list.filter((item) => {
    const cat = (item.category || '').toLowerCase();
    const isDrink = cat.includes('bebida') || item.customizationType === 'cafe';
    if (station === 'cocina') return !isDrink;
    if (station === 'barra') return isDrink;
    return true;
  });
};

export const KitchenDisplay = () => {
  const navigate = useNavigate();
  const [comandas, setComandas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('activas'); // 'activas' | 'listas' | 'todas'
  const [stationFilter, setStationFilter] = useState('cocina'); // 'cocina' (defecto) | 'barra' | 'todo'
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmingCloseId, setConfirmingCloseId] = useState(null);

  // Estado y referencias para timbre sonoro (Web Audio API) + triple piscada naranja (0.5s x 3 = 1.5s)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [flashingOrderIds, setFlashingOrderIds] = useState([]);

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

  // Timbre sonoro de campana de cocina sintetizado con Web Audio API (sin archivos externos)
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
      const notes = [
        { freq: 880, start: 0, duration: 0.35, gain: 0.24 },      // A5
        { freq: 1318.51, start: 0.16, duration: 0.55, gain: 0.28 }, // E6
        { freq: 1760, start: 0.34, duration: 0.5, gain: 0.18 }     // A6 brillo campana
      ];

      notes.forEach(({ freq, start, duration, gain }) => {
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
      console.warn('No se pudo reproducir el timbre sonoro:', err);
    }
  }, []);

  // Dispara triple piscada naranja intensa (0.5s x 3 = 1.5s) + timbre sonoro sincronizado
  const triggerNewOrderAlert = useCallback(
    (orderIds = [], forceSound = false) => {
      if (forceSound || soundEnabledRef.current) {
        playKitchenChime();
      }

      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }

      setFlashingOrderIds(orderIds);
      setFlashKey((k) => k + 1);
      setIsFlashing(true);

      flashTimeoutRef.current = setTimeout(() => {
        setIsFlashing(false);
        setFlashingOrderIds([]);
        flashTimeoutRef.current = null;
      }, 1550);
    },
    [playKitchenChime]
  );

  // Limpieza de temporizadores y AudioContext al desmontar
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Actualizar reloj cada 30s para el tiempo transcurrido
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a 'comandas_activas' con docChanges() (type === 'added')
  useEffect(() => {
    setIsLoading(true);
    const colRef = collection(db, 'comandas_activas');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));

        // Orden FIFO (más antiguas primero) para cocina activa
        docs.sort((a, b) => getOrderCreatedMs(a) - getOrderCreatedMs(b));

        // Ignorar estrictamente el primer lote de carga inicial al montar el componente
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        } else {
          const addedOrders = snapshot
            .docChanges()
            .filter((change) => change.type === 'added')
            .map((change) => ({
              ...change.doc.data(),
              id: change.doc.id
            }))
            .filter((order) => {
              if (order.estado === 'listo' || order.estado === 'entregado') return false;
              return filterItemsByStation(order.items, stationFilterRef.current).length > 0;
            });

          if (addedOrders.length > 0) {
            triggerNewOrderAlert(addedOrders.map((d) => d.id));
          }
        }

        setComandas(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error al sincronizar comandas en /cocina:', err);
        setIsLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [triggerNewOrderAlert]);

  const handleUpdateEstado = async (comandaId, nuevoEstado) => {
    if (!comandaId) return;
    setUpdatingId(comandaId);
    try {
      await updateDoc(doc(db, 'comandas_activas', comandaId), {
        estado: nuevoEstado,
        updatedAt: serverTimestamp()
      });
      setConfirmingCloseId(null);
    } catch (err) {
      console.error('Error actualizando estado de comanda:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleArchiveComanda = async (comandaId) => {
    if (!comandaId) return;
    setUpdatingId(comandaId);
    try {
      await deleteDoc(doc(db, 'comandas_activas', comandaId));
      setConfirmingCloseId(null);
    } catch (err) {
      console.error('Error archivando comanda:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Comandas filtradas primero por estación activa
  const stationComandas = useMemo(() => {
    return comandas
      .filter((c) => c.estado !== 'entregado')
      .map((c) => ({
        ...c,
        visibleItems: filterItemsByStation(c.items, stationFilter)
      }))
      .filter((c) => c.visibleItems.length > 0);
  }, [comandas, stationFilter]);

  const counts = useMemo(() => {
    let activas = 0;
    let listas = 0;
    for (const c of stationComandas) {
      if (c.estado === 'listo') listas += 1;
      else activas += 1;
    }
    return { activas, listas, todas: stationComandas.length };
  }, [stationComandas]);

  // Filtrado final por estado (Pendientes / Listas / Todas)
  const filteredComandas = useMemo(() => {
    return stationComandas.filter((c) => {
      if (statusFilter === 'activas') return c.estado !== 'listo';
      if (statusFilter === 'listas') return c.estado === 'listo';
      return true;
    });
  }, [stationComandas, statusFilter]);

  return (
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex flex-col font-sans select-none relative">
      {/* TRIPLE PISCADA NARANJA INTENSA (0.5s x 3 = 1.5s) AL RECIBIR COMANDA NUEVA */}
      {isFlashing && (
        <div
          key={flashKey}
          aria-hidden="true"
          className="kds-triple-flash-overlay pointer-events-none fixed inset-0 z-50 border-[8px] border-[#EA580C] bg-orange-600/40 shadow-[inset_0_0_96px_rgba(234,88,12,0.9)]"
        />
      )}

      {/* BARRA SUPERIOR */}
      <header className="min-h-14 bg-[#1a1a1a] border-b border-neutral-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/consola')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Panel</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
              <ChefHat className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-tight text-white">
                  Monitor de <span className="text-orange-500">Cocina & Barra</span>
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#151515] text-emerald-400 border border-neutral-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En Vivo
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Comandas sincronizadas en tiempo real con restricciones, alergias y tiempos de salida
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Alerta (Sonido ON/OFF + Probar Alerta) y Botón rápido al POS */}
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
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-orange-500" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Sonido ON' : 'Sonido OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => triggerNewOrderAlert([], soundEnabled)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 text-orange-400 hover:text-orange-300 border border-orange-500/40 text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            title="Probar timbre sonoro y triple destello naranja"
          >
            <BellRing className="w-3.5 h-3.5 text-orange-500" />
            <span>Probar Alerta</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/pos-terminal')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Terminal POS</span>
          </button>
        </div>
      </header>

      {/* BARRA DE FILTROS DE ESTADO Y ESTACIÓN */}
      <div className="bg-[#1a1a1a]/80 border-b border-neutral-800 px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filtros de Estado */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('activas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'activas'
                ? 'bg-orange-600 text-white'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Pendientes ({counts.activas})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('listas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'listas'
                ? 'bg-orange-600 text-white'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Listas ({counts.listas})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('todas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'todas'
                ? 'bg-orange-600 text-white'
                : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Todas ({counts.todas})
          </button>
        </div>

        {/* Filtros de Estación: Solo Cocina (Comidas) por defecto / Barra (Bebidas) / Todas las órdenes */}
        <div className="flex items-center gap-1.5 bg-[#151515] p-1 rounded-lg border border-neutral-800 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setStationFilter('cocina')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              stationFilter === 'cocina'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Solo Cocina (Comidas)</span>
          </button>

          <button
            type="button"
            onClick={() => setStationFilter('barra')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              stationFilter === 'barra'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Barra (Bebidas)</span>
          </button>

          <button
            type="button"
            onClick={() => setStationFilter('todo')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              stationFilter === 'todo'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todas las órdenes
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: TARJETAS DE COMANDAS */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {isLoading ? (
          <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-neutral-800 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-white">Conectando monitor de cocina...</p>
            <p className="text-xs text-neutral-400">Sincronizando pedidos del salón en tiempo real</p>
          </div>
        ) : filteredComandas.length === 0 ? (
          <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
            <ClipboardList className="w-10 h-10 text-neutral-600 mx-auto" />
            <h2 className="text-base font-bold text-white">Sin comandas en esta vista</h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Cuando los mozos envíen pedidos desde la Terminal POS, aparecerán automáticamente aquí con todas sus especificaciones de cocción, alergias, tiempos y cafetería.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
            {filteredComandas.map((comanda) => {
              const isPreparing = comanda.estado === 'en_preparacion';
              const isReady = comanda.estado === 'listo';
              const elapsedLabel = formatElapsed(comanda.fecha, comanda.timestamp, nowMs);
              const isCardFlashing = flashingOrderIds.includes(comanda.id);

              // Recolectar todas las alergias/restricciones de los ítems visibles para alerta en cabecera
              const cardAllergies = [];
              comanda.visibleItems.forEach((item) => {
                normalizeSelectedTags(item.selectedTags || []).forEach((tag) => {
                  if (isAllergyTag(tag) && !cardAllergies.includes(tag.label)) {
                    cardAllergies.push(tag.label);
                  }
                });
              });

              const hasAllergyAlert = cardAllergies.length > 0;

              return (
                <article
                  key={comanda.id}
                  className={`bg-[#222222] rounded-2xl border overflow-hidden flex flex-col shadow-sm transition-colors ${
                    isCardFlashing
                      ? 'kds-card-triple-flash border-orange-500'
                      : hasAllergyAlert
                      ? 'border-red-500/70'
                      : isReady
                      ? 'border-emerald-600/50'
                      : isPreparing
                      ? 'border-orange-500/70'
                      : 'border-neutral-800'
                  }`}
                >
                  {/* Cabecera de Tarjeta */}
                  <div className="p-4 bg-[#151515] border-b border-neutral-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-white truncate">
                          {comanda.mesa || 'Mesa General'}
                        </h2>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            isReady
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : isPreparing
                              ? 'bg-orange-600/20 text-orange-400 border-orange-500/40'
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}
                        >
                          {isReady ? 'Listo' : isPreparing ? 'Preparando' : 'En Cocina'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                        Mozo: {comanda.cajero?.split('@')[0] || 'Salón'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#222222] border border-neutral-800 text-xs font-mono font-semibold text-orange-400 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      <span>{elapsedLabel}</span>
                    </div>
                  </div>

                  {/* Alerta Destacada de Alergias / Restricciones */}
                  {hasAllergyAlert && (
                    <div className="px-4 py-2 bg-red-950/85 border-b border-red-800/80 flex items-center gap-2 text-red-100">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <div className="text-[11px] leading-snug">
                        <span className="font-bold uppercase tracking-wider mr-1.5 text-red-300">
                          Restricción:
                        </span>
                        <span className="font-semibold">{cardAllergies.join(' • ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Lista de Ítems de la Comanda (sin precios ni subtotales) */}
                  <div className="p-4 space-y-3 divide-y divide-neutral-800/80 flex-1">
                    {comanda.visibleItems.map((item, idx) => {
                      const tags = normalizeSelectedTags(item.selectedTags || []);
                      const allergyTags = tags.filter((t) => isAllergyTag(t));
                      const timingTags = tags.filter((t) => !isAllergyTag(t) && isTimingTag(t));
                      const otherTags = tags.filter((t) => !isAllergyTag(t) && !isTimingTag(t));

                      // Soporte para sabores (entera o 1/2 + 1/2) y opciones de hamburguesa / minutas
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
                      const itemNoteText = (item.itemNote || item.nota || item.notes || '').trim();

                      return (
                        <div key={`${item.id || idx}-${idx}`} className="pt-3 first:pt-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white font-mono font-bold text-xs shrink-0">
                                {item.quantity || 1}×
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-sm text-white leading-snug">
                                  {item.name}
                                  {itemSize && (
                                    <span className="ml-1.5 text-[11px] font-semibold text-orange-400">
                                      ({itemSize})
                                    </span>
                                  )}
                                </h3>
                                <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                                  {item.category || 'General'}
                                </span>
                              </div>
                            </div>

                            {/* Badges de Tiempo de Salida / Entrega alineados a la derecha */}
                            {timingTags.length > 0 && (
                              <div className="flex flex-wrap justify-end gap-1 shrink-0">
                                {timingTags.map((tag, tIdx) => (
                                  <span
                                    key={`time-${tIdx}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/90 border border-amber-500/80 text-amber-200"
                                  >
                                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>{tag.label}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Sabores (Entera o 1/2 + 1/2) */}
                          {flavors.length > 0 && (
                            <div className="pl-8 text-xs text-neutral-200 flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-[#151515] border border-orange-500/40 text-orange-300 font-semibold text-[11px]">
                                {flavors.length === 2
                                  ? `1/2 ${flavors[0]} + 1/2 ${flavors[1]}`
                                  : `Sabor: ${flavors.join(', ')}`}
                              </span>
                            </div>
                          )}

                          {/* Restricciones / Alergias del ítem */}
                          {allergyTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-8">
                              {allergyTags.map((tag, aIdx) => (
                                <span
                                  key={`allergy-${aIdx}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-950 border border-red-500 text-red-100 uppercase tracking-wide"
                                >
                                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                  <span>{tag.label}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Quitar ingredientes (Hamburguesas / Minutas) */}
                          {removedIngredients.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-8">
                              {removedIngredients.map((ing, rIdx) => (
                                <span
                                  key={`rem-${rIdx}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-950/80 border border-red-700/70 text-red-200"
                                >
                                  SIN {ing}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Chips de Cocción / Cafetería / Extras */}
                          {(otherTags.length > 0 || itemExtras.length > 0) && (
                            <div className="flex flex-wrap gap-1.5 pl-8">
                              {otherTags.map((tag, oIdx) => (
                                <span
                                  key={`opt-${oIdx}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-600/20 border border-orange-500/50 text-orange-200"
                                >
                                  {tag.label}
                                </span>
                              ))}
                              {itemExtras.map((ext, eIdx) => (
                                <span
                                  key={`ext-${eIdx}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-600/20 border border-orange-500/50 text-orange-200"
                                >
                                  + {ext}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Nota individual del ítem */}
                          {itemNoteText && (
                            <div className="ml-8 px-2.5 py-1.5 rounded-lg bg-[#151515] border-l-2 border-orange-500 text-xs text-neutral-200">
                              <span className="font-bold text-orange-400 mr-1">Nota:</span>
                              <span>{itemNoteText}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Nota general de la comanda */}
                  {comanda.nota && (
                    <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-[#151515] border border-orange-500/40 text-xs text-neutral-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block mb-0.5">
                        Nota General de Mesa
                      </span>
                      <span>{comanda.nota}</span>
                    </div>
                  )}

                  {/* Controles Táctiles de Estado (Confirmación inline, sin window.confirm) */}
                  <div className="p-3 bg-[#151515] border-t border-neutral-800">
                    {confirmingCloseId === comanda.id ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-neutral-300 text-center">
                          ¿Cómo deseas finalizar {comanda.mesa || 'esta comanda'}?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {!isReady && (
                            <button
                              type="button"
                              disabled={updatingId === comanda.id}
                              onClick={() => handleUpdateEstado(comanda.id, 'listo')}
                              className="py-2 px-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-orange-400 font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer border border-neutral-700"
                            >
                              Solo Listo
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={updatingId === comanda.id}
                            onClick={() => handleArchiveComanda(comanda.id)}
                            className={`${isReady ? 'col-span-2' : ''} py-2 px-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Entregado (Cerrar)</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmingCloseId(null)}
                          className="w-full py-1.5 rounded-lg text-[11px] text-neutral-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : !isReady ? (
                      <div className="flex items-center gap-2">
                        {!isPreparing && (
                          <button
                            type="button"
                            disabled={updatingId === comanda.id}
                            onClick={() => handleUpdateEstado(comanda.id, 'en_preparacion')}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-neutral-700/60"
                          >
                            Preparando
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updatingId === comanda.id}
                          onClick={() => setConfirmingCloseId(comanda.id)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Listo / Entregado</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingId === comanda.id}
                          onClick={() => handleUpdateEstado(comanda.id, 'en_cocina')}
                          className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-700/60"
                          title="Volver a cocina"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reabrir</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === comanda.id}
                          onClick={() => handleArchiveComanda(comanda.id)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Listo / Entregado</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default KitchenDisplay;
