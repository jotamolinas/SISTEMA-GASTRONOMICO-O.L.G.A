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
    description: 'Evolución por fecha, horas pico y comparativas por turno.'
  },
  {
    icon: QrCode,
    title: 'Menú Digital QR descargable',
    description: 'Carta móvil en vivo, lista para descargar e imprimir por mesa.'
  },
  {
    icon: Globe,
    title: 'Landing comercial del local',
    description: 'Web profesional con carta online, horarios y contacto directo.'
  },
  {
    icon: Wand2,
    title: 'Fotos y textos con IA',
    description: 'Optimiza fotos de tus platos y descripciones para vender más.'
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-modal-title"
    >
      <div
        className="bg-[#222222] border border-neutral-800 rounded-2xl max-w-lg sm:max-w-xl w-full overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado compacto */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#151515] border-b border-neutral-800 flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/40">
              <Sparkles className="w-2.5 h-2.5 text-orange-500" />
              <span>Versión Pro</span>
            </span>
            <h2
              id="pro-upgrade-modal-title"
              className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug"
            >
              Convertirse a GastroPOS Pro
            </h2>
            <p className="text-[11px] sm:text-xs text-neutral-400 leading-snug">
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

        {/* Contenido sin scroll */}
        <div className="p-3.5 sm:p-4">
          {requested ? (
            <div className="py-5 px-4 bg-[#151515] border border-orange-600/40 rounded-xl text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-orange-600/15 border border-orange-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5 text-orange-500" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              {PRO_BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="p-2.5 sm:p-3 bg-[#151515] border border-neutral-800 rounded-xl flex items-start gap-2.5"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#222222] border border-neutral-800 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="text-xs font-bold text-white leading-tight">
                        {benefit.title}
                      </h3>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie de acciones compacto en una fila */}
        <div className="px-4 py-3 bg-[#151515] border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 py-2 px-3.5 sm:px-4 rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-300 hover:text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider border border-neutral-800 transition-colors cursor-pointer"
          >
            {requested ? 'Cerrar' : 'Ahora no'}
          </button>

          {!requested && (
            <button
              type="button"
              onClick={() => setRequested(true)}
              className="flex-1 sm:flex-none py-2 px-3.5 sm:px-5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Solicitar / Activar Pro</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProUpgradeModal;
