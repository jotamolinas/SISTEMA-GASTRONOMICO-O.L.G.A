import React, { useState, useEffect, useCallback } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  LocateFixed,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { buildGoogleMapsUrl } from '../services/businessConfigService';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const DEFAULT_VIEWPORT_CENTER = { lat: -25.2637, lng: -57.5759 };

const formatCoordinate = (val) => {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  return Number(val.toFixed(6));
};

const MapViewportController = ({ focusRequest }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusRequest) return;
    map.panTo({ lat: focusRequest.lat, lng: focusRequest.lng });
    const currentZoom = map.getZoom();
    if (typeof currentZoom === 'number' && currentZoom < 16) {
      map.setZoom(16);
    }
  }, [map, focusRequest]);

  return null;
};

const MapStatusOverlay = () => {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.LOADED) {
    return null;
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 bg-[#151515]/95 flex flex-col items-center justify-center p-5 text-center z-10">
        <AlertCircle className="w-6 h-6 text-orange-500 mb-2" />
        <p className="text-xs font-semibold text-neutral-200">
          No se pudo mostrar el mapa interactivo en este momento.
        </p>
        <p className="text-[11px] text-neutral-400 mt-1 max-w-sm">
          Puedes usar el botón &quot;Usar ubicación actual&quot; para capturar tus coordenadas o intentar nuevamente más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#151515]/85 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none">
      <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      <span className="text-[11px] text-neutral-400 font-medium">Cargando mapa...</span>
    </div>
  );
};

export const StoreLocationMapPicker = ({ lat, lng, onChangeLocation }) => {
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);

  const normalizedLat = formatCoordinate(lat);
  const normalizedLng = formatCoordinate(lng);
  const hasCoordinates = normalizedLat !== null && normalizedLng !== null;
  const mapsUrl = hasCoordinates ? buildGoogleMapsUrl(normalizedLat, normalizedLng) : '';

  const applyCoordinates = useCallback(
    (nextLat, nextLng, shouldPan = false) => {
      const cleanLat = formatCoordinate(nextLat);
      const cleanLng = formatCoordinate(nextLng);
      if (cleanLat === null || cleanLng === null) return;

      setGeoError('');
      onChangeLocation(cleanLat, cleanLng);

      if (shouldPan) {
        setFocusRequest({
          lat: cleanLat,
          lng: cleanLng,
          seq: Date.now()
        });
      }
    },
    [onChangeLocation]
  );

  const handleMapClick = useCallback(
    (ev) => {
      const clickedLatLng = ev?.detail?.latLng;
      if (!clickedLatLng) return;
      applyCoordinates(clickedLatLng.lat, clickedLatLng.lng, false);
    },
    [applyCoordinates]
  );

  const handleMarkerDragEnd = useCallback(
    (ev) => {
      const latLng = ev?.latLng;
      if (!latLng) return;
      const nextLat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
      const nextLng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
      applyCoordinates(nextLat, nextLng, false);
    },
    [applyCoordinates]
  );

  const handleUseCurrentLocation = () => {
    if (isLocating) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError(
        'Este navegador o dispositivo no permite obtener la ubicación actual. Haz clic directamente en el mapa.'
      );
      return;
    }

    setIsLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        applyCoordinates(position.coords.latitude, position.coords.longitude, true);
      },
      (error) => {
        setIsLocating(false);
        if (error?.code === 1) {
          setGeoError(
            'Permiso de ubicación denegado. Habilítalo en tu navegador o marca el punto tocando el mapa.'
          );
        } else if (error?.code === 3) {
          setGeoError(
            'Se agotó el tiempo al buscar tu ubicación. Intenta de nuevo o marca el punto en el mapa.'
          );
        } else {
          setGeoError(
            'No se pudo detectar tu ubicación actual. Marca el punto directamente en el mapa.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleClearPin = () => {
    setGeoError('');
    onChangeLocation(null, null);
  };

  const initialCenter = hasCoordinates
    ? { lat: normalizedLat, lng: normalizedLng }
    : DEFAULT_VIEWPORT_CENTER;

  return (
    <div className="bg-[#151515] border border-neutral-800 rounded-xl p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="text-xs font-semibold text-white">
              Pin de Ubicación del Local
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Haz clic en el mapa o arrastra el marcador naranja para fijar la ubicación exacta.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-orange-500/40 text-orange-400 hover:text-orange-300 disabled:opacity-60 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>{isLocating ? 'Buscando...' : 'Usar ubicación actual'}</span>
          </button>

          {hasCoordinates && (
            <button
              type="button"
              onClick={handleClearPin}
              className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Quitar marcador del mapa"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Quitar pin</span>
            </button>
          )}
        </div>
      </div>

      {geoError && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-[11px] flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Contenedor con altura explícita obligatoria para evitar colapso 0x0 */}
      <div className="w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-neutral-800 bg-[#1a1a1a] relative">
        {MAPS_API_KEY ? (
          <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="es" region="PY">
            <MapStatusOverlay />
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={initialCenter}
              defaultZoom={hasCoordinates ? 16 : 13}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={false}
              fullscreenControl={false}
              onClick={handleMapClick}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <MapViewportController focusRequest={focusRequest} />
              {hasCoordinates && (
                <AdvancedMarker
                  position={{ lat: normalizedLat, lng: normalizedLng }}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                  title="Ubicación exacta del local"
                >
                  <Pin
                    background="#EA580C"
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={1.15}
                  />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center">
            <MapPin className="w-6 h-6 text-orange-500 mb-2" />
            <p className="text-xs font-semibold text-neutral-200">
              Mapa interactivo pendiente de activación
            </p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm">
              Aún puedes pulsar &quot;Usar ubicación actual&quot; para guardar tus coordenadas y el enlace del mapa.
            </p>
          </div>
        )}
      </div>

      {/* Coordenadas y enlace guardado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
        {hasCoordinates ? (
          <>
            <div className="flex items-center flex-wrap gap-2 text-neutral-300">
              <span className="px-2 py-1 rounded bg-[#222222] border border-neutral-800 font-mono text-neutral-200">
                Lat: {normalizedLat}
              </span>
              <span className="px-2 py-1 rounded bg-[#222222] border border-neutral-800 font-mono text-neutral-200">
                Lng: {normalizedLng}
              </span>
            </div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
            >
              <span>Ver en Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </>
        ) : (
          <span className="text-neutral-500">
            Sin coordenadas fijadas todavía. Toca el mapa o usa tu ubicación actual antes de guardar.
          </span>
        )}
      </div>
    </div>
  );
};

export default StoreLocationMapPicker;
