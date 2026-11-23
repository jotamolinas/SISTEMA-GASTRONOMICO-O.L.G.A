import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { DashboardHome } from './DashboardHome';
import { InventoryManager } from './InventoryManager';
import { ProUpgradeModal } from './ProUpgradeModal';
import { useCartStore } from '../store/useCartStore';
import { 
  Tablet, 
  ExternalLink, 
  QrCode, 
  Check, 
  Copy, 
  Printer,
  Sparkles
} from 'lucide-react';

export const AdminLayout = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const tableCarts = useCartStore((state) => state.tableCarts);
  const [activeSection, setActiveSection] = useState('tablero');
  const [copiedMenuLink, setCopiedMenuLink] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  const realTableNames = Object.keys(tableCarts || {});

  const handleCopyMenuLink = async () => {
    const url = window.location.origin;
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
      setCopiedMenuLink(true);
      setTimeout(() => setCopiedMenuLink(false), 2000);
    } catch (err) {
      console.warn('Error al copiar enlace:', err);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'tablero':
        return <DashboardHome onOpenProModal={() => setIsProModalOpen(true)} />;

      case 'inventario':
        return <InventoryManager />;

      case 'menu-qr':
        return (
          <div className="space-y-5">
            <div className="bg-[#222222] border border-neutral-800 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Menú QR Digital</h2>
                  <button
                    type="button"
                    onClick={() => setIsProModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/40 hover:bg-orange-600/30 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-orange-500" />
                    <span>PRO</span>
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Permite a tus clientes escanear la carta desde la mesa con su celular.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProModalOpen(true)}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Activar Pro</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyMenuLink}
                  className="px-3.5 py-2 bg-[#151515] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold uppercase rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMenuLink ? <Check className="w-4 h-4 text-orange-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedMenuLink ? '¡Enlace Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>

            {realTableNames.length === 0 ? (
              <div className="bg-[#222222] border border-neutral-800 p-8 rounded-xl text-center">
                <p className="text-xs text-neutral-400">
                  Aún no hay mesas configuradas. Crea cuentas desde la Terminal de Mozos (POS) para generar sus códigos QR.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {realTableNames.map((tableName) => (
                  <div key={tableName} className="bg-[#222222] border border-neutral-800 p-5 rounded-xl flex flex-col items-center text-center">
                    <div className="w-32 h-32 bg-white p-2.5 rounded-lg flex items-center justify-center mb-3">
                      <QrCode className="w-24 h-24 text-neutral-900" />
                    </div>
                    <h4 className="font-bold text-white text-sm">{tableName}</h4>
                    <p className="text-xs text-neutral-400 mb-3">Cuenta activa del salón</p>
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
            )}
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
        return <DashboardHome onOpenProModal={() => setIsProModalOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#151515] text-neutral-100 flex font-sans select-none">
      {/* 1. SIDEBAR IZQUIERDO */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenProModal={() => setIsProModalOpen(true)}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      {/* 2. ÁREA DE CONTENIDO */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 bg-[#1a1a1a] border-b border-neutral-800 px-6 sm:px-8 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
          <h2 className="font-bold text-xs uppercase tracking-wider text-white truncate">
            {activeSection === 'tablero' && 'Tablero Principal'}
            {activeSection === 'inventario' && 'Gestión de Stock e Insumos'}
            {activeSection === 'menu-qr' && 'Menú QR y Carta Digital'}
            {activeSection === 'configuracion' && 'Ajustes del Local'}
          </h2>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsProModalOpen(true)}
              className="py-1.5 px-3 rounded-lg bg-[#222222] hover:bg-neutral-800 text-orange-400 hover:text-orange-300 border border-orange-500/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Ver beneficios de GastroPOS Pro"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>PRO</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="py-1.5 px-3.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Terminal Mozos</span>
              <span className="sm:hidden">POS</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-7 max-w-6xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>

      {/* Modal propio "Convertirse a Pro" */}
      <ProUpgradeModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
        userEmail={currentUser?.email}
      />
    </div>
  );
};

export default AdminLayout;
