import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { DashboardHome } from './DashboardHome';
import { InventoryManager } from './InventoryManager';
import { ProUpgradeModal } from './ProUpgradeModal';
import { StoreLocationMapPicker } from './StoreLocationMapPicker';
import { useCartStore } from '../store/useCartStore';
import {
  getCachedBusinessConfig,
  subscribeBusinessConfig,
  saveBusinessConfig,
  buildGoogleMapsUrl
} from '../services/businessConfigService';
import { 
  Tablet, 
  ExternalLink, 
  QrCode, 
  Check, 
  Copy, 
  Printer,
  Sparkles,
  Save,
  AlertCircle
} from 'lucide-react';

export const AdminLayout = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const tableCarts = useCartStore((state) => state.tableCarts);
  const [activeSection, setActiveSection] = useState('tablero');
  const [copiedMenuLink, setCopiedMenuLink] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  const [businessConfig, setBusinessConfig] = useState(() => getCachedBusinessConfig());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    const unsubscribe = subscribeBusinessConfig((config) => {
      setBusinessConfig(config);
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleConfigChange = (field, value) => {
    setBusinessConfig((prev) => ({
      ...prev,
      [field]: value
    }));
    if (configFeedback.text) {
      setConfigFeedback({ type: '', text: '' });
    }
  };

  const handleLocationPinChange = (nextLat, nextLng) => {
    setBusinessConfig((prev) => ({
      ...prev,
      lat: nextLat,
      lng: nextLng,
      mapsUrl: nextLat !== null && nextLng !== null ? buildGoogleMapsUrl(nextLat, nextLng) : ''
    }));
    if (configFeedback.text) {
      setConfigFeedback({ type: '', text: '' });
    }
  };

  const handleSaveBusinessConfig = async (e) => {
    if (e) e.preventDefault();
    if (isSavingConfig) return;

    setIsSavingConfig(true);
    setConfigFeedback({ type: '', text: '' });

    try {
      const saved = await saveBusinessConfig(businessConfig);
      setBusinessConfig(saved);
      setConfigFeedback({
        type: 'success',
        text: 'Datos del local guardados y listos para el ticket térmico.'
      });
    } catch (err) {
      console.error('Error al guardar configuración del local:', err);
      setConfigFeedback({
        type: 'error',
        text: 'Se guardó en este equipo, pero hubo un error al sincronizar.'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

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
        return <InventoryManager onOpenProModal={() => setIsProModalOpen(true)} />;

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
                Datos comerciales del local, encabezado de tickets térmicos (80mm), moneda e impresora.
              </p>
            </div>

            <form
              onSubmit={handleSaveBusinessConfig}
              className="bg-[#222222] border border-neutral-800 p-5 rounded-xl space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    value={businessConfig.nombreComercial}
                    onChange={(e) => handleConfigChange('nombreComercial', e.target.value)}
                    placeholder="Ej: GastroPOS Restaurant & Bar"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    RUC
                  </label>
                  <input
                    type="text"
                    value={businessConfig.ruc}
                    onChange={(e) => handleConfigChange('ruc', e.target.value)}
                    placeholder="Ej: 80012345-6"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={businessConfig.telefono}
                    onChange={(e) => handleConfigChange('telefono', e.target.value)}
                    placeholder="Ej: +595 981 123 456"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    Impresora Térmica
                  </label>
                  <input
                    type="text"
                    value={businessConfig.impresora}
                    onChange={(e) => handleConfigChange('impresora', e.target.value)}
                    placeholder="ESC/POS 80mm - Red / USB"
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={businessConfig.direccion}
                      onChange={(e) => handleConfigChange('direccion', e.target.value)}
                      placeholder="Ej: Av. España 1234 c/ Brasil, Asunción"
                      className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>

                  <StoreLocationMapPicker
                    lat={businessConfig.lat}
                    lng={businessConfig.lng}
                    onChangeLocation={handleLocationPinChange}
                  />
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1.5">Moneda</label>
                  <input
                    type="text"
                    value={businessConfig.moneda}
                    disabled
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-neutral-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1.5">Impuesto (IVA)</label>
                  <input
                    type="text"
                    value={businessConfig.impuesto}
                    disabled
                    className="w-full px-3 py-2 bg-[#151515] border border-neutral-800 rounded-lg text-xs text-neutral-400"
                  />
                </div>
              </div>

              {configFeedback.text && (
                <div
                  className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                    configFeedback.type === 'error'
                      ? 'bg-red-950/60 border-red-800/70 text-red-300'
                      : 'bg-[#151515] border-orange-500/50 text-orange-400'
                  }`}
                >
                  {configFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  ) : (
                    <Check className="w-4 h-4 shrink-0 text-orange-500" />
                  )}
                  <span>{configFeedback.text}</span>
                </div>
              )}

              <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] text-neutral-400">
                  El Nombre Comercial, RUC, Dirección y Teléfono / WhatsApp aparecerán en el encabezado del ticket térmico de 80mm.
                </p>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="py-2.5 px-5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
              </div>
            </form>
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
