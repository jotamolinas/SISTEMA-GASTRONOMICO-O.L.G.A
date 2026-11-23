import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useCartStore } from '../store/useCartStore';
import {
  Tablet,
  Copy,
  Check,
  DollarSign,
  Clock,
  Beer,
  UtensilsCrossed,
  ArrowUpRight,
  Layers,
  ChefHat,
  Coffee,
  AlertCircle,
  Sparkles,
  ShoppingBag
} from 'lucide-react';

const resolveRecordDate = (record) => {
  if (record?.timestamp && typeof record.timestamp.toDate === 'function') {
    return record.timestamp.toDate();
  }
  if (record?.timestamp && typeof record.timestamp.seconds === 'number') {
    return new Date(record.timestamp.seconds * 1000);
  }
  if (record?.fecha) {
    const parsed = new Date(record.fecha);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const isSameLocalDay = (dateA, dateB) => {
  if (!dateA || !dateB) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

const isDrinkItem = (item) => {
  const cat = (item?.category || '').toLowerCase();
  return cat.includes('bebida') || item?.customizationType === 'cafe';
};

const formatGs = (amount) => `${Math.round(Number(amount) || 0).toLocaleString('es-PY')}`;

export const DashboardHome = ({ onOpenProModal }) => {
  const navigate = useNavigate();
  const tableCarts = useCartStore((state) => state.tableCarts);

  const [copiedKey, setCopiedKey] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [comandasActivas, setComandasActivas] = useState([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isLoadingComandas, setIsLoadingComandas] = useState(true);
  const [syncError, setSyncError] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const posTerminalUrl = `${origin}/pos-terminal`;
  const cocinaUrl = `${origin}/cocina`;
  const barraUrl = `${origin}/cocina?estacion=bebidas`;

  useEffect(() => {
    const ventasCol = collection(db, 'ventas');
    const unsubVentas = onSnapshot(
      ventasCol,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));
        setVentas(list);
        setIsLoadingSales(false);
        setSyncError('');
      },
      (err) => {
        console.error('Error al cargar métricas de ventas:', err);
        setIsLoadingSales(false);
        setSyncError('No se pudieron actualizar algunos datos del turno. Reintentando conexión...');
      }
    );

    const comandasCol = collection(db, 'comandas_activas');
    const unsubComandas = onSnapshot(
      comandasCol,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        }));
        setComandasActivas(list);
        setIsLoadingComandas(false);
      },
      (err) => {
        console.error('Error al cargar comandas activas:', err);
        setIsLoadingComandas(false);
      }
    );

    return () => {
      unsubVentas();
      unsubComandas();
    };
  }, []);

  const handleCopyUrl = async (key, url) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 2000);
    } catch (err) {
      console.warn('Error al copiar enlace:', err);
    }
  };

  // Cálculos reales esenciales para el plan gratuito
  const metrics = useMemo(() => {
    const now = new Date();
    const salesToday = [];

    ventas.forEach((venta) => {
      const date = resolveRecordDate(venta);
      if (!date) return;
      if (isSameLocalDay(date, now)) {
        salesToday.push(venta);
      }
    });

    const totalSalesToday = salesToday.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    const closedOrdersToday = salesToday.length;
    const avgTicketToday =
      closedOrdersToday > 0 ? Math.round(totalSalesToday / closedOrdersToday) : 0;

    // Mesas / cuentas activas reales (cuentas con pedidos abiertos + comandas pendientes)
    const configuredTables = Object.keys(tableCarts || {});
    const openPosTables = configuredTables.filter(
      (tableName) => Array.isArray(tableCarts[tableName]) && tableCarts[tableName].length > 0
    );
    const activeComandaTables = Array.from(
      new Set(
        comandasActivas
          .map((c) => (c?.mesa || '').trim())
          .filter(Boolean)
      )
    );
    const activeTablesSet = new Set([...openPosTables, ...activeComandaTables]);
    const allKnownTablesSet = new Set([...configuredTables, ...activeComandaTables]);

    // Conteo real de comandas pendientes por estación para badges en Cocina y Barra
    let cocinaComandasCount = 0;
    let barraComandasCount = 0;
    comandasActivas.forEach((comanda) => {
      const items = Array.isArray(comanda?.items) ? comanda.items : [];
      const hasFood = items.some((item) => !isDrinkItem(item));
      const hasDrink = items.some((item) => isDrinkItem(item));
      if (hasFood) cocinaComandasCount += 1;
      if (hasDrink) barraComandasCount += 1;
    });

    // Lista simple de productos más vendidos hoy
    const productMap = new Map();
    salesToday.forEach((venta) => {
      const items = Array.isArray(venta.items) ? venta.items : [];
      items.forEach((item) => {
        const rawName = (item?.name || 'Producto sin nombre').trim();
        const key = rawName.toLowerCase();
        const qty = Math.max(1, Number(item?.quantity) || 1);
        const lineTotal =
          typeof item?.subtotal === 'number' && !Number.isNaN(item.subtotal)
            ? item.subtotal
            : (Number(item?.price) || 0) * qty;

        const existing = productMap.get(key);
        if (existing) {
          existing.quantity += qty;
          existing.total += lineTotal;
        } else {
          productMap.set(key, {
            name: rawName,
            category: item?.category || 'General',
            isDrink: isDrinkItem(item),
            quantity: qty,
            total: lineTotal
          });
        }
      });
    });

    const topProductsToday = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, 5);

    return {
      totalSalesToday,
      closedOrdersToday,
      avgTicketToday,
      activeTablesCount: activeTablesSet.size,
      totalTablesCount: allKnownTablesSet.size,
      activeComandasCount: comandasActivas.length,
      cocinaComandasCount,
      barraComandasCount,
      topProductsToday
    };
  }, [ventas, comandasActivas, tableCarts]);

  const isLoading = isLoadingSales || isLoadingComandas;

  const stations = [
    {
      key: 'pos',
      title: 'Salón / Mozos (POS)',
      subtitle: 'Toma de pedidos y caja',
      icon: Tablet,
      route: '/pos-terminal',
      url: posTerminalUrl,
      pendingCount: 0
    },
    {
      key: 'cocina',
      title: 'Cocina',
      subtitle: 'Platos y comandas en vivo',
      icon: ChefHat,
      route: '/cocina',
      url: cocinaUrl,
      pendingCount: metrics.cocinaComandasCount
    },
    {
      key: 'barra',
      title: 'Barra',
      subtitle: 'Bebidas y cafetería',
      icon: Coffee,
      route: '/cocina?estacion=bebidas',
      url: barraUrl,
      pendingCount: metrics.barraComandasCount
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. CONTROL COMPACTO DE SALÓN, COCINA Y BARRA */}
      <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Control de Salón, Cocina y Barra
          </h1>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">
            Pantallas Operativas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stations.map((station) => {
            const Icon = station.icon;
            const isCopied = copiedKey === station.key;

            return (
              <div
                key={station.key}
                className="bg-[#151515] border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white truncate">
                        {station.title}
                      </h2>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {station.subtitle}
                      </p>
                    </div>
                  </div>

                  {station.pendingCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 border border-orange-600/40 shrink-0">
                      {station.pendingCount} {station.pendingCount === 1 ? 'orden' : 'órdenes'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(station.route)}
                    className="flex-1 py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Abrir</span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-85" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyUrl(station.key, station.url)}
                    className={`shrink-0 py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
                      isCopied
                        ? 'bg-neutral-800 border-orange-500 text-orange-400'
                        : 'bg-[#222222] hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-orange-500" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aviso de sincronización si existiera error temporal */}
      {syncError && (
        <div className="bg-[#222222] border border-orange-600/40 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-orange-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* 2. MÉTRICAS BÁSICAS DEL TURNO (PLAN GRATUITO - SIN GRÁFICOS) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Resumen del Turno de Hoy
          </h2>
          <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            {isLoading ? 'Actualizando...' : 'En vivo'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Ventas del Día */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ventas del Día</span>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {formatGs(metrics.totalSalesToday)}{' '}
              <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {metrics.closedOrdersToday > 0
                ? `${metrics.closedOrdersToday} ${
                    metrics.closedOrdersToday === 1 ? 'venta cobrada hoy' : 'ventas cobradas hoy'
                  }`
                : 'Sin ventas registradas hoy'}
            </p>
          </div>

          {/* Card 2: Mesas / Cuentas Activas */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Mesas / Cuentas Activas</span>
              <Layers className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics.activeTablesCount}{' '}
              <span className="text-xs text-neutral-400 font-normal">
                / {metrics.totalTablesCount}{' '}
                {metrics.totalTablesCount === 1 ? 'cuenta' : 'cuentas'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {metrics.activeComandasCount > 0
                ? `${metrics.activeComandasCount} ${
                    metrics.activeComandasCount === 1 ? 'comanda en curso' : 'comandas en curso'
                  }`
                : metrics.activeTablesCount > 0
                ? 'Cuentas abiertas en salón'
                : 'Todas las mesas libres'}
            </p>
          </div>

          {/* Card 3: Ticket Promedio */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ticket Promedio</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {formatGs(metrics.avgTicketToday)}{' '}
              <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {metrics.closedOrdersToday > 0
                ? 'Promedio por cuenta cobrada'
                : 'Se calcula al cobrar hoy'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. LISTA COMPACTA DE PRODUCTOS MÁS VENDIDOS + LLAMADO DISCRETO A PRO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Productos más vendidos hoy (lista simple sin gráficos) */}
        <div className="lg:col-span-2 bg-[#222222] border border-neutral-800/80 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-bold text-white">Productos Más Vendidos</h3>
              <p className="text-[11px] text-neutral-400">Turno de hoy</p>
            </div>
            {metrics.topProductsToday.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#151515] text-neutral-400 border border-neutral-800">
                Top {metrics.topProductsToday.length}
              </span>
            )}
          </div>

          {metrics.topProductsToday.length === 0 ? (
            <div className="py-7 px-4 bg-[#151515] rounded-xl border border-neutral-800/70 text-center space-y-1.5">
              <ShoppingBag className="w-5 h-5 text-neutral-600 mx-auto" />
              <p className="text-xs font-medium text-neutral-300">
                Sin productos vendidos hoy
              </p>
              <p className="text-[11px] text-neutral-500">
                Aparecerán aquí automáticamente al registrar cobros en el POS.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/70 bg-[#151515] rounded-xl border border-neutral-800/70">
              {metrics.topProductsToday.map((prod) => (
                <div
                  key={prod.name}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[#222222] flex items-center justify-center text-orange-500 shrink-0">
                      {prod.isDrink ? (
                        <Beer className="w-3.5 h-3.5" />
                      ) : (
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {prod.name}
                      </h4>
                      <p className="text-[10px] text-neutral-400">
                        {prod.quantity} {prod.quantity === 1 ? 'unidad' : 'unidades'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white font-mono shrink-0">
                    {formatGs(prod.total)} Gs.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarjeta discreta para pasar a Versión Pro */}
        <div className="bg-[#222222] border border-neutral-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/40">
                <Sparkles className="w-3 h-3 text-orange-500" />
                <span>PRO</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">Plan actual: Gratuito</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                Lleva tu local al siguiente nivel
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Desbloquea gráficos y métricas avanzadas, Menú Digital QR descargable, Landing Page propia y mejora de fotos y textos de carta con IA.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenProModal && onOpenProModal()}
            className="w-full py-2.5 px-3.5 rounded-lg bg-[#151515] hover:bg-neutral-800 text-orange-400 hover:text-orange-300 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-orange-500/40 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Convertirse a Pro</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
