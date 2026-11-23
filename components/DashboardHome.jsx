import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useCartStore } from '../store/useCartStore';
import {
  Tablet,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Receipt,
  DollarSign,
  Clock,
  Beer,
  UtensilsCrossed,
  ArrowUpRight,
  Layers,
  ChefHat,
  Coffee,
  Activity,
  BarChart3,
  AlertCircle
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

export const DashboardHome = () => {
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
      }, 3000);
    } catch (err) {
      console.warn('Error al copiar enlace:', err);
    }
  };

  // Cálculos reales a partir de ventas registradas, comandas activas y cuentas abiertas en salón
  const metrics = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const salesToday = [];
    const salesYesterday = [];

    ventas.forEach((venta) => {
      const date = resolveRecordDate(venta);
      if (!date) return;
      if (isSameLocalDay(date, now)) {
        salesToday.push({ ...venta, _date: date });
      } else if (isSameLocalDay(date, yesterday)) {
        salesYesterday.push({ ...venta, _date: date });
      }
    });

    salesToday.sort((a, b) => b._date.getTime() - a._date.getTime());

    const totalSalesToday = salesToday.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    const totalSalesYesterday = salesYesterday.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    const closedOrdersToday = salesToday.length;
    const avgTicketToday =
      closedOrdersToday > 0 ? Math.round(totalSalesToday / closedOrdersToday) : 0;

    // Variación vs ayer: solo se calcula si existen ventas reales registradas ayer
    const hasYesterdayBaseline = salesYesterday.length > 0 && totalSalesYesterday > 0;
    const vsYesterdayPct = hasYesterdayBaseline
      ? ((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100
      : null;

    // Mesas activas reales (unión de cuentas con ítems en POS + comandas activas en cocina/barra)
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

    // Conteo real de comandas por estación (Cocina vs Barra)
    let cocinaComandasCount = 0;
    let barraComandasCount = 0;
    comandasActivas.forEach((comanda) => {
      const items = Array.isArray(comanda?.items) ? comanda.items : [];
      const hasFood = items.some((item) => !isDrinkItem(item));
      const hasDrink = items.some((item) => isDrinkItem(item));
      if (hasFood) cocinaComandasCount += 1;
      if (hasDrink) barraComandasCount += 1;
    });

    // Ranking real de platos y bebidas más vendidos hoy
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

    // Franja horaria de mayor movimiento hoy (solo si hay al menos 2 ventas reales)
    let peakHourInfo = null;
    if (salesToday.length >= 2) {
      const hourlyMap = new Map();
      salesToday.forEach((venta) => {
        const hour = venta._date.getHours();
        const existing = hourlyMap.get(hour) || { hour, count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(venta.total) || 0;
        hourlyMap.set(hour, existing);
      });
      const sortedHours = Array.from(hourlyMap.values()).sort(
        (a, b) => b.count - a.count || b.total - a.total
      );
      if (sortedHours.length > 0) {
        const top = sortedHours[0];
        const pad = (n) => String(n).padStart(2, '0');
        const nextHour = (top.hour + 1) % 24;
        peakHourInfo = {
          range: `${pad(top.hour)}:00 - ${pad(nextHour)}:00`,
          count: top.count,
          total: top.total
        };
      }
    }

    return {
      totalSalesToday,
      closedOrdersToday,
      avgTicketToday,
      hasYesterdayBaseline,
      vsYesterdayPct,
      activeTables: Array.from(activeTablesSet),
      activeTablesCount: activeTablesSet.size,
      totalTablesCount: allKnownTablesSet.size,
      openPosTablesCount: openPosTables.length,
      activeComandasCount: comandasActivas.length,
      cocinaComandasCount,
      barraComandasCount,
      topProductsToday,
      recentSalesToday: salesToday.slice(0, 4),
      peakHourInfo
    };
  }, [ventas, comandasActivas, tableCarts]);

  const isLoading = isLoadingSales || isLoadingComandas;

  return (
    <div className="space-y-6">
      {/* 1. HERO CALL-TO-ACTION DEL PROPIETARIO: POS, COCINA Y BARRA */}
      <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
        {/* Bloque Principal: Terminal de Mozos (POS) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-xl space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
              Terminales Operativas del Local
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Control de Salón, Cocina y Barra
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Cada sector opera en su propia pantalla limpia sin menús administrativos. Abre cada vista o copia su enlace para las tablets y celulares del equipo.
            </p>
          </div>

          {/* BOTÓN PROMINENTE NARANJA MATE + COPIAR LINK DEL POS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="py-3 px-5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm group active:scale-95"
            >
              <Tablet className="w-4 h-4 text-white" />
              <span>Abrir Terminal de Mozos (POS)</span>
              <ArrowUpRight className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => handleCopyUrl('pos', posTerminalUrl)}
              className={`py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border cursor-pointer active:scale-95 ${
                copiedKey === 'pos'
                  ? 'bg-neutral-800 border-orange-500 text-orange-400'
                  : 'bg-[#151515] hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              {copiedKey === 'pos' ? (
                <>
                  <Check className="w-4 h-4 text-orange-500" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-400" />
                  <span>Copiar Link del POS</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Accesos Rápidos para Pantallas de Cocina y Barra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Tarjeta Cocina */}
          <div className="bg-[#151515] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                  <ChefHat className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pantalla de Cocina</h2>
                  <p className="text-[11px] text-neutral-400">
                    Solo platos de comida, sabores, alergias y alerta sonora.
                  </p>
                </div>
              </div>
              {metrics.cocinaComandasCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 border border-orange-600/40 shrink-0">
                  {metrics.cocinaComandasCount} {metrics.cocinaComandasCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/cocina')}
                className="flex-1 py-2.5 px-3.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Abrir Cocina</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyUrl('cocina', cocinaUrl)}
                className={`py-2.5 px-3.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
                  copiedKey === 'cocina'
                    ? 'bg-neutral-800 border-orange-500 text-orange-400'
                    : 'bg-[#222222] hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                {copiedKey === 'cocina' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-orange-500" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copiar Link Cocina</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tarjeta Barra */}
          <div className="bg-[#151515] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pantalla de Barra y Cafetería</h2>
                  <p className="text-[11px] text-neutral-400">
                    Filtrada automáticamente en bebidas, café y preparación de barra.
                  </p>
                </div>
              </div>
              {metrics.barraComandasCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 border border-orange-600/40 shrink-0">
                  {metrics.barraComandasCount} {metrics.barraComandasCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/cocina?estacion=bebidas')}
                className="flex-1 py-2.5 px-3.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Abrir Barra</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyUrl('barra', barraUrl)}
                className={`py-2.5 px-3.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
                  copiedKey === 'barra'
                    ? 'bg-neutral-800 border-orange-500 text-orange-400'
                    : 'bg-[#222222] hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                {copiedKey === 'barra' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-orange-500" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copiar Link Barra</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Enlaces completos para compartir en tablets y celulares */}
        <div className="pt-4 border-t border-neutral-800/80 space-y-2 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <div className="flex items-center gap-2 bg-[#151515] px-3 py-2 rounded-lg border border-neutral-800 min-w-0">
              <span className="text-neutral-500 font-semibold shrink-0">POS:</span>
              <code className="text-orange-400 font-mono text-[11px] truncate">
                {posTerminalUrl}
              </code>
            </div>
            <div className="flex items-center gap-2 bg-[#151515] px-3 py-2 rounded-lg border border-neutral-800 min-w-0">
              <span className="text-neutral-500 font-semibold shrink-0">Cocina:</span>
              <code className="text-orange-400 font-mono text-[11px] truncate">
                {cocinaUrl}
              </code>
            </div>
            <div className="flex items-center gap-2 bg-[#151515] px-3 py-2 rounded-lg border border-neutral-800 min-w-0">
              <span className="text-neutral-500 font-semibold shrink-0">Barra:</span>
              <code className="text-orange-400 font-mono text-[11px] truncate">
                {barraUrl}
              </code>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500">
            Abre cada enlace en la tablet o celular correspondiente conectado al Wi-Fi del local (salón, cocina y barra).
          </p>
        </div>
      </div>

      {/* Aviso de sincronización si existiera error temporal */}
      {syncError && (
        <div className="bg-[#222222] border border-orange-600/40 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-orange-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* 2. MÉTRICAS REALES EN TIEMPO REAL */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Métricas del Turno de Hoy
          </h2>
          <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            {isLoading ? 'Cargando registros...' : 'En vivo'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Ventas del Día */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ventas del Día</span>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {formatGs(metrics.totalSalesToday)}{' '}
              <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <div className="mt-2 text-xs font-medium flex items-center gap-1">
              {metrics.hasYesterdayBaseline && metrics.vsYesterdayPct !== null ? (
                <span
                  className={`flex items-center gap-1 ${
                    metrics.vsYesterdayPct >= 0 ? 'text-orange-500' : 'text-neutral-400'
                  }`}
                >
                  {metrics.vsYesterdayPct >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {metrics.vsYesterdayPct >= 0 ? '+' : ''}
                    {metrics.vsYesterdayPct.toFixed(1)}% vs ayer
                  </span>
                </span>
              ) : metrics.closedOrdersToday > 0 ? (
                <span className="text-neutral-400">
                  Sin ventas de ayer para comparar
                </span>
              ) : (
                <span className="text-neutral-500">
                  Sin ventas registradas hoy
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Mesas Activas */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Mesas Activas</span>
              <Layers className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics.activeTablesCount}{' '}
              <span className="text-xs text-neutral-400 font-normal">
                / {metrics.totalTablesCount}{' '}
                {metrics.totalTablesCount === 1 ? 'cuenta' : 'cuentas'}
              </span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              {metrics.activeTablesCount === 0
                ? 'Todas las mesas disponibles'
                : `${metrics.openPosTablesCount} en caja/salón • ${metrics.activeComandasCount} en cocina/barra`}
            </div>
          </div>

          {/* Card 3: Ventas / Órdenes Cerradas */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ventas Cerradas Hoy</span>
              <Receipt className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics.closedOrdersToday}{' '}
              <span className="text-xs text-neutral-400 font-normal">
                {metrics.closedOrdersToday === 1 ? 'orden' : 'órdenes'}
              </span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              {metrics.activeComandasCount === 0
                ? 'Sin comandas en preparación'
                : `${metrics.activeComandasCount} ${
                    metrics.activeComandasCount === 1 ? 'comanda activa' : 'comandas activas'
                  } en curso`}
            </div>
          </div>

          {/* Card 4: Ticket Promedio */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ticket Promedio</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {formatGs(metrics.avgTicketToday)}{' '}
              <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              {metrics.closedOrdersToday > 0
                ? `Promedio sobre ${metrics.closedOrdersToday} ${
                    metrics.closedOrdersToday === 1 ? 'cobro' : 'cobros'
                  }`
                : 'Se calcula al registrar cobros hoy'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRODUCTOS MÁS VENDIDOS REALES Y ESTADO OPERATIVO EN VIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Platos y Bebidas más vendidos del día */}
        <div className="lg:col-span-2 bg-[#222222] border border-neutral-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Platos y Bebidas Más Vendidos</h3>
                <p className="text-xs text-neutral-400">Resumen real de ventas cobradas hoy</p>
              </div>
              {metrics.topProductsToday.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#151515] text-neutral-400 border border-neutral-800">
                  Top {metrics.topProductsToday.length}
                </span>
              )}
            </div>

            {metrics.topProductsToday.length === 0 ? (
              <div className="py-10 px-4 bg-[#151515] rounded-xl border border-neutral-800/70 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#222222] border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-neutral-200">
                  Aún no hay productos vendidos en el turno de hoy
                </p>
                <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                  Cuando registres cobros desde la Terminal de Mozos (POS), aquí verás el ranking real por unidades vendidas y monto acumulado.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {metrics.topProductsToday.map((prod) => (
                  <div
                    key={prod.name}
                    className="p-3 bg-[#151515] rounded-lg border border-neutral-800/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#222222] flex items-center justify-center text-orange-500 shrink-0">
                        {prod.isDrink ? (
                          <Beer className="w-4 h-4" />
                        ) : (
                          <UtensilsCrossed className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">{prod.name}</h4>
                        <p className="text-[10px] text-neutral-400">
                          {prod.category} • {prod.quantity}{' '}
                          {prod.quantity === 1 ? 'unidad' : 'unidades'}
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
        </div>

        {/* Estado Operativo en Vivo (Salón, Cocina, Barra y Hora Pico) */}
        <div className="bg-[#222222] border border-neutral-800/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Estado Operativo en Vivo</h3>
                <p className="text-xs text-neutral-400">Actividad actual del local</p>
              </div>
              <Activity className="w-4 h-4 text-orange-500" />
            </div>

            {/* Desglose real de comandas por estación */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-[#151515] rounded-lg border border-neutral-800">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
                  <ChefHat className="w-3.5 h-3.5 text-orange-500" />
                  <span>Cocina</span>
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {metrics.cocinaComandasCount}
                </div>
                <span className="text-[10px] text-neutral-500">
                  {metrics.cocinaComandasCount === 1 ? 'comanda activa' : 'comandas activas'}
                </span>
              </div>

              <div className="p-3 bg-[#151515] rounded-lg border border-neutral-800">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
                  <Coffee className="w-3.5 h-3.5 text-orange-500" />
                  <span>Barra</span>
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {metrics.barraComandasCount}
                </div>
                <span className="text-[10px] text-neutral-500">
                  {metrics.barraComandasCount === 1 ? 'comanda activa' : 'comandas activas'}
                </span>
              </div>
            </div>

            {/* Mesas con movimiento en este momento */}
            <div className="p-3 bg-[#151515] rounded-lg border border-neutral-800 space-y-2">
              <span className="text-[11px] font-semibold text-neutral-300 block">
                Cuentas / Mesas con Actividad
              </span>
              {metrics.activeTables.length === 0 ? (
                <p className="text-[11px] text-neutral-500">
                  No hay mesas con pedidos abiertos ni comandas pendientes.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {metrics.activeTables.map((tableName) => (
                    <span
                      key={tableName}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#222222] text-orange-400 border border-orange-600/40"
                    >
                      {tableName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Franja de mayor movimiento (solo con datos reales suficientes) */}
            <div className="p-3 bg-[#151515] rounded-lg border border-neutral-800 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-300 block">
                Franja Horaria Pico (Hoy)
              </span>
              {metrics.peakHourInfo ? (
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-orange-400 font-mono">
                    {metrics.peakHourInfo.range}
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {metrics.peakHourInfo.count}{' '}
                    {metrics.peakHourInfo.count === 1 ? 'venta' : 'ventas'} •{' '}
                    {formatGs(metrics.peakHourInfo.total)} Gs.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  Aún no hay suficientes ventas hoy para determinar la hora pico.
                </p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#151515] hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border border-neutral-800"
            >
              Abrir POS en este equipo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
