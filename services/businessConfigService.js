import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEY = 'gastropos_business_config';
const CONFIG_COLLECTION = 'configuracion';
const CONFIG_DOC_ID = 'local';

const toValidCoord = (value, min, max) => {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return Number(num.toFixed(6));
};

export const buildGoogleMapsUrl = (lat, lng) => {
  const validLat = toValidCoord(lat, -90, 90);
  const validLng = toValidCoord(lng, -180, 180);
  if (validLat === null || validLng === null) return '';
  return `https://www.google.com/maps?q=${validLat},${validLng}`;
};

export const DEFAULT_BUSINESS_CONFIG = {
  nombreComercial: 'GastroPOS Restaurant & Bar',
  telefono: '',
  direccion: '',
  ruc: '',
  lat: null,
  lng: null,
  mapsUrl: '',
  moneda: 'Guaraníes (Gs. / PYG)',
  impuesto: '10% Incluido',
  impresora: 'ESC/POS 80mm - Red / USB'
};

export const normalizeBusinessConfig = (raw = {}) => {
  const lat = toValidCoord(raw?.lat, -90, 90);
  const lng = toValidCoord(raw?.lng, -180, 180);
  const hasCoords = lat !== null && lng !== null;

  return {
    nombreComercial:
      typeof raw?.nombreComercial === 'string' && raw.nombreComercial.trim()
        ? raw.nombreComercial
        : DEFAULT_BUSINESS_CONFIG.nombreComercial,
    telefono: typeof raw?.telefono === 'string' ? raw.telefono : '',
    direccion: typeof raw?.direccion === 'string' ? raw.direccion : '',
    ruc: typeof raw?.ruc === 'string' ? raw.ruc : '',
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    mapsUrl: hasCoords ? buildGoogleMapsUrl(lat, lng) : '',
    moneda:
      typeof raw?.moneda === 'string' && raw.moneda.trim()
        ? raw.moneda
        : DEFAULT_BUSINESS_CONFIG.moneda,
    impuesto:
      typeof raw?.impuesto === 'string' && raw.impuesto.trim()
        ? raw.impuesto
        : DEFAULT_BUSINESS_CONFIG.impuesto,
    impresora:
      typeof raw?.impresora === 'string' && raw.impresora.trim()
        ? raw.impresora
        : DEFAULT_BUSINESS_CONFIG.impresora
  };
};

export const getCachedBusinessConfig = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_BUSINESS_CONFIG };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BUSINESS_CONFIG };
    const parsed = JSON.parse(raw);
    return normalizeBusinessConfig(parsed);
  } catch {
    return { ...DEFAULT_BUSINESS_CONFIG };
  }
};

export const saveCachedBusinessConfig = (config) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeBusinessConfig(config)));
  } catch {
    // Ignorar errores de almacenamiento en modo privado
  }
};

export const subscribeBusinessConfig = (onUpdate) => {
  const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const merged = normalizeBusinessConfig(snap.data());
        saveCachedBusinessConfig(merged);
        onUpdate(merged);
      } else {
        onUpdate(getCachedBusinessConfig());
      }
    },
    (err) => {
      console.warn('No se pudo sincronizar la configuración del local:', err);
      onUpdate(getCachedBusinessConfig());
    }
  );
};

export const saveBusinessConfig = async (config) => {
  const lat = toValidCoord(config?.lat, -90, 90);
  const lng = toValidCoord(config?.lng, -180, 180);
  const hasCoords = lat !== null && lng !== null;

  const payload = {
    nombreComercial: (config?.nombreComercial || '').trim() || DEFAULT_BUSINESS_CONFIG.nombreComercial,
    telefono: (config?.telefono || '').trim(),
    direccion: (config?.direccion || '').trim(),
    ruc: (config?.ruc || '').trim(),
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    mapsUrl: hasCoords ? buildGoogleMapsUrl(lat, lng) : '',
    moneda: (config?.moneda || '').trim() || DEFAULT_BUSINESS_CONFIG.moneda,
    impuesto: (config?.impuesto || '').trim() || DEFAULT_BUSINESS_CONFIG.impuesto,
    impresora: (config?.impresora || '').trim() || DEFAULT_BUSINESS_CONFIG.impresora
  };

  saveCachedBusinessConfig(payload);

  const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
  await setDoc(
    docRef,
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return payload;
};
