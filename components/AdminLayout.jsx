import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { DashboardHome } from './DashboardHome';
import { 
  Tablet, 
  ExternalLink, 
  QrCode, 
  Package, 
  Settings, 
  Check, 
  Copy, 
  Printer, 
  Plus
} from 'lucide-react';

export const AdminLayout = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('tablero');
  const [copiedMenuLink, setCopiedMenuLink] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case 'tablero':
        return <DashboardHome />;

      case 'inventario':
        return (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#222222] border border-neutral-800 p-5 rounded-xl">
              <div>
                <h2 className="text-lg font-bold text-white">Inventario Rápido</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Descuento automático de existencias por cada plato o bebida comandeada en el POS.
                </p>
              </div>
              <button
                type="button"
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Insumo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                { name: 'Carne Molida Smash (KG)', stock: '4.5 kg', alert: true },
                { name: 'Barril Cerveza IPA (Litros)', stock: '32 L', alert: false },
                { name: 'Pan de Papa Brioche (Unidades)', stock: '18 u.', alert: true },
                { name: 'Queso Cheddar Fetas', stock: '120 fetas', alert: false },
                { name: 'Papas Congeladas Bastón (KG)', stock: '15.0 kg', alert: false },
                { name: 'Gin Botánico 750ml (Botellas)', stock: '4 botellas', alert: false }
              ].map((item, idx) => (
                <div key={idx} className="bg-[#222222] border border-neutral-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-white text-xs">{item.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.alert ? 'bg-red-950/60 text-red-400 border border-red-900/40' : 'bg-[#151515] text-neutral-400'
                    }`}>
                      {item.alert ? 'Reponer' : 'Óptimo'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-neutral-800">
                    <span className="text-[10px] text-neutral-500 uppercase">Stock actual:</span>
                    <span className="text-sm font-bold text-white font-mono">{item.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'menu-qr':
        return (
          <div className="space-y-5">
            <div className="bg-[#222222] border border-neutral-800 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Menú QR Digital</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Permite a tus clientes escanear la carta desde la mesa con su celular.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  setCopiedMenuLink(true);
                  setTimeout(() => setCopiedMenuLink(false), 3000);
                }}
                className="px-3.5 py-2 bg-[#151515] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold uppercase rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedMenuLink ? <Check className="w-4 h-4 text-orange-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMenuLink ? '¡Enlace Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { table: 'Mesa 01', zone: 'Salón Principal' },
                { table: 'Mesa 04', zone: 'Salón Principal' },
                { table: 'Barra 01', zone: 'Sector Barra' }
              ].map((qr, i) => (
                <div key={i} className="bg-[#222222] border border-neutral-800 p-5 rounded-xl flex flex-col items-center text-center">
                  <div className="w-32 h-32 bg-white p-2.5 rounded-lg flex items-center justify-center mb-3">
                    <QrCode className="w-24 h-24 text-neutral-900" />
                  </div>
                  <h4 className="font-bold text-white text-sm">{qr.table}</h4>
                  <p className="text-xs text-neutral-400 mb-3">{qr.zone}</p>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2 bg-[#151515] hover:bg-neutral-800 text-neutral-300 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-neutral-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir QR</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'configuracion':
        return (
          <div className="space-y-5 max-w-3xl">
            <div className="bg-[#222222] border border-neutral-800 p-5 rounded-xl">
              <h2 className="text-lg font-bold text-white">Parámetros del Restaurante</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Configuración de negocio, moneda, impuestos e impresoras.
              </p>
            </div>

            <div className="bg-[#222222] border border-neutral-800 p-5 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    defaultValue="GastroPOS Restaurant & Bar"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Moneda</label>
                  <input
                    type="text"
                    defaultValue="Guaraníes (Gs. / PYG)"
                    disabled
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Impuesto (IVA)</label>
                  <input
                    type="text"
                    defaultValue="10% Incluido"
                    disabled
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Impresora Térmica</label>
                  <input
                    type="text"
                    defaultValue="ESC/POS 80mm - Red / USB"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex font-sans select-none">
      {/* 1. SIDEBAR IZQUIERDO */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      {/* 2. ÁREA DE CONTENIDO */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 bg-[#1a1a1a] border-b border-neutral-800 px-6 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <h2 className="font-bold text-xs uppercase tracking-wider text-white">
            {activeSection === 'tablero' && 'Tablero Principal de Métricas'}
            {activeSection === 'inventario' && 'Gestión de Stock e Insumos'}
            {activeSection === 'menu-qr' && 'Menú QR y Carta Digital'}
            {activeSection === 'configuracion' && 'Ajustes del Local'}
          </h2>

          <button
            type="button"
            onClick={() => navigate('/pos-terminal')}
            className="py-1.5 px-3.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Terminal Mozos</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </button>
        </header>

        <main className="flex-1 p-5 sm:p-7 max-w-6xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
