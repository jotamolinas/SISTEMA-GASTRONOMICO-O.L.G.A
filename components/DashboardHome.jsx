import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Tablet, 
  Copy, 
  Check, 
  TrendingUp, 
  Receipt, 
  DollarSign, 
  Clock, 
  Flame, 
  Beer, 
  Pizza, 
  UtensilsCrossed,
  ArrowUpRight,
  Layers
} from 'lucide-react';

export const DashboardHome = () => {
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);

  const posTerminalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pos-terminal`
    : '/pos-terminal';

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(posTerminalUrl);
      } else {
        const input = document.createElement('input');
        input.value = posTerminalUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => {
        setCopiedLink(false);
      }, 3000);
    } catch (err) {
      console.warn('Error al copiar link:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO CALL-TO-ACTION DEL PROPIETARIO */}
      <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
              Terminal Operativa
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Control de Salón y Mozos
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Los mozos operan en una pantalla táctil limpia sin menús de administración. Abre la terminal o comparte el enlace en sus tablets.
            </p>
          </div>

          {/* BOTÓN PROMINENTE NARANJA MATE + COPIAR LINK */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Botón principal muy destacado */}
            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="py-3 px-6 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-sm group"
            >
              <Tablet className="w-4 h-4 text-white" />
              <span>Abrir Terminal de Mozos (POS)</span>
              <ArrowUpRight className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            {/* Botón Copiar Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border cursor-pointer ${
                copiedLink
                  ? 'bg-neutral-800 border-orange-500 text-orange-400'
                  : 'bg-[#151515] hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-orange-500" />
                  <span>¡Link Copiado!</span>
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

        {/* URL directa */}
        <div className="mt-4 pt-3.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">URL del POS:</span>
            <code className="px-2 py-0.5 bg-[#151515] rounded text-orange-400 font-mono text-[11px] border border-neutral-800">
              {posTerminalUrl}
            </code>
          </div>
          <span className="text-[11px] text-neutral-500">
            Abre este link en cualquier tablet o celular de mozos conectado al Wi-Fi del salón.
          </span>
        </div>
      </div>

      {/* 2. MÉTRICAS CLAVE EN TIEMPO REAL */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Métricas del Turno de Hoy
          </h2>
          <span className="text-[11px] text-neutral-500">
            Actualización automática
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Ventas */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ventas del Día</span>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              4.850.000 <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <div className="mt-2 text-xs text-orange-500 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs ayer</span>
            </div>
          </div>

          {/* Card 2: Mesas */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Mesas Activas</span>
              <Layers className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              6 <span className="text-xs text-neutral-400 font-normal">/ 12 ocupadas</span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              50% ocupación del salón
            </div>
          </div>

          {/* Card 3: Tickets */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Comandas Emitidas</span>
              <Receipt className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              58 <span className="text-xs text-neutral-400 font-normal">órdenes</span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              4 activas en cocina
            </div>
          </div>

          {/* Card 4: Ticket promedio */}
          <div className="bg-[#222222] border border-neutral-800/80 p-4.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Ticket Promedio</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              83.600 <span className="text-xs text-neutral-400 font-normal">Gs.</span>
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              Por mesa atendida
            </div>
          </div>
        </div>
      </div>

      {/* 3. PLATOS MÁS VENDIDOS Y TERMINALES ACTIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Platos más pedidos */}
        <div className="lg:col-span-2 bg-[#222222] border border-neutral-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Platos y Bebidas Más Vendidos</h3>
              <p className="text-xs text-neutral-400">Turno en curso</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#151515] text-neutral-400 border border-neutral-800">
              Top 4
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              { name: 'Hamburguesa Doble Smash', category: 'Comidas', orders: 24, total: '1.080.000 Gs.', icon: Flame },
              { name: 'Cerveza IPA Tirada 500ml', category: 'Bebidas', orders: 38, total: '950.000 Gs.', icon: Beer },
              { name: 'Pizza Artesanal Margherita', category: 'Comidas', orders: 15, total: '900.000 Gs.', icon: Pizza },
              { name: 'Papas Rústicas Trufadas', category: 'Comidas', orders: 19, total: '532.000 Gs.', icon: UtensilsCrossed }
            ].map((prod, i) => {
              const Icon = prod.icon;
              return (
                <div key={i} className="p-3 bg-[#151515] rounded-lg border border-neutral-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#222222] flex items-center justify-center text-orange-500">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">{prod.name}</h4>
                      <p className="text-[10px] text-neutral-400">{prod.category} • {prod.orders} pedidos</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white font-mono">
                    {prod.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminales activas */}
        <div className="bg-[#222222] border border-neutral-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Terminales Activas</h3>
              <div className="w-2 h-2 rounded-full bg-orange-500" />
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Dispositivos sincronizados con la cocina y caja.
            </p>

            <div className="space-y-2">
              <div className="p-2.5 bg-[#151515] rounded-lg border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tablet className="w-4 h-4 text-orange-500" />
                  <div>
                    <span className="text-xs font-semibold text-white block">Tablet Salón 01</span>
                    <span className="text-[10px] text-neutral-400">Carlos M. • Mesa 04</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-orange-500">En uso</span>
              </div>

              <div className="p-2.5 bg-[#151515] rounded-lg border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tablet className="w-4 h-4 text-orange-500" />
                  <div>
                    <span className="text-xs font-semibold text-white block">Tablet Barra 02</span>
                    <span className="text-[10px] text-neutral-400">Lucas • Barra</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-orange-500">En uso</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="w-full py-2 px-3 rounded-lg bg-[#151515] hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border border-neutral-800"
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
