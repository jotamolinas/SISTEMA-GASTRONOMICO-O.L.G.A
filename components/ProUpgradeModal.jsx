import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BarChart3,
  QrCode,
  Globe,
  Wand2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const PRO_BENEFITS = [
  {
    icon: BarChart3,
    title: 'Métricas avanzadas y gráficos',
    description:
      'Evolución de ventas por fecha, horas pico reales, comparativas por turno y análisis por categoría.'
  },
  {
    icon: QrCode,
    title: 'Menú Digital QR descargable',
    description:
      'Carta móvil sincronizada al instante con tus productos y precios, lista para descargar e imprimir por mesa.'
  },
  {
    icon: Globe,
    title: 'Landing Page comercial del restaurante',
    description:
      'Página web profesional auto-generada para tu local con carta online, horarios, ubicación y contacto directo.'
  },
  {
    icon: Wand2,
    title: 'Mejora de fotos y textos de carta con IA',
    description:
      'Optimiza automáticamente las fotos de tus platos y redacta descripciones tentadoras para vender más.'
  }
];

export const ProUpgradeModal = ({ isOpen, onClose, userEmail }) => {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRequested(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-modal-title"
    >
      <div
        className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-5 bg-[#151515] border-b border-neutral-800 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/40">
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span>Versión Pro</span>
            </span>
            <h2
              id="pro-upgrade-modal-title"
              className="text-lg font-bold text-white tracking-tight"
            >
              Convertirse a GastroPOS Pro
            </h2>
            <p className="text-xs text-neutral-400">
              Potencia las ventas, imagen comercial y control de tu restaurante.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-3">
          {requested ? (
            <div className="py-6 px-4 bg-[#151515] border border-orange-600/40 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-600/15 border border-orange-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-orange-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  ¡Solicitud de Versión Pro registrada!
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  Nuestro equipo se pondrá en contacto
                  {userEmail ? ` a ${userEmail}` : ''} para activar tu plan Pro y configurar tu Menú QR, Landing comercial y herramientas de IA.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {PRO_BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="p-3.5 bg-[#151515] border border-neutral-800 rounded-xl flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="text-xs font-bold text-white">
                        {benefit.title}
                      </h3>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie de acciones */}
        <div className="p-4 bg-[#151515] border-t border-neutral-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold uppercase tracking-wider border border-neutral-800 transition-colors cursor-pointer"
          >
            {requested ? 'Cerrar' : 'Ahora no'}
          </button>

          {!requested && (
            <button
              type="button"
              onClick={() => setRequested(true)}
              className="py-2.5 px-5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Solicitar / Activar Pro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProUpgradeModal;
