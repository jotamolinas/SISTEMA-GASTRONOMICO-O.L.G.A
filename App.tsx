import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { AdminLayout } from './components/AdminLayout';
import { POSDashboard } from './components/POSDashboard';
import { KitchenDisplay } from './components/KitchenDisplay';
import { LoginScreen } from './components/LoginScreen';
import { User } from 'firebase/auth';
import { initAuth, logout } from './services/auth';

/**
 * Ruta de la Consola de Administración para el Dueño (/consola)
 * Carga AdminLayout con AdminSidebar a la izquierda y DashboardHome a la derecha.
 */
const AdminConsolaRoute: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      },
      () => {
        setCurrentUser(null);
        setIsCheckingAuth(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#151515] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-neutral-800 border-t-orange-500 rounded-full animate-spin"></div>
        <div className="font-bold text-neutral-400 text-xs tracking-widest uppercase">
          Cargando Panel de Administración...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={() => {}} />;
  }

  return <AdminLayout currentUser={currentUser} onLogout={handleLogout} />;
};

/**
 * Ruta Independiente para la Terminal de Mozos (/pos-terminal)
 * Ocupa el 100% de la pantalla sin menú lateral, ideal para tablets de salón.
 */
const POSTerminalRoute: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      },
      () => {
        setCurrentUser(null);
        setIsCheckingAuth(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      navigate('/');
    } catch (error) {
      console.error('Error al salir del POS:', error);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#151515] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-neutral-800 border-t-orange-500 rounded-full animate-spin"></div>
        <div className="font-bold text-neutral-400 text-xs tracking-widest uppercase">
          Iniciando Terminal de Mozos...
        </div>
      </div>
    );
  }

  // Si no hay sesión activa, permite iniciar sesión como mozo o administrador
  if (!currentUser) {
    return <LoginScreen onLogin={() => {}} />;
  }

  // Vista 100% limpia para tablets de mozos (sin sidebar)
  return <POSDashboard currentUser={currentUser} onLogout={handleLogout} />;
};

/**
 * Ruta Independiente para la Pantalla de Cocina / Barra (/cocina y /barra)
 * Muestra las comandas activas en tiempo real sin precios ni menú lateral.
 */
const CocinaRoute: React.FC<{ initialStation?: 'comidas' | 'bebidas' | 'todas' }> = ({
  initialStation
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      },
      () => {
        setCurrentUser(null);
        setIsCheckingAuth(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      navigate('/');
    } catch (error) {
      console.error('Error al salir de Cocina:', error);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#151515] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-neutral-800 border-t-orange-500 rounded-full animate-spin"></div>
        <div className="font-bold text-neutral-400 text-xs tracking-widest uppercase">
          {initialStation === 'bebidas' ? 'Iniciando Pantalla de Barra...' : 'Iniciando Pantalla de Cocina...'}
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={() => {}} />;
  }

  return (
    <KitchenDisplay
      currentUser={currentUser}
      onLogout={handleLogout}
      initialStation={initialStation}
    />
  );
};

/**
 * Enrutador Maestro de la Aplicación
 */
export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  return (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <Routes>
        {/* 1. Landing Page pública */}
        <Route path="/" element={<LandingPage />} />

        {/* 2. Panel de Administración del Dueño (con AdminSidebar y DashboardHome) */}
        <Route path="/consola" element={<AdminConsolaRoute />} />

        {/* 3. Terminal Táctil Independiente para Mozos (100% pantalla completa) */}
        <Route path="/pos-terminal" element={<POSTerminalRoute />} />

        {/* 4. Pantallas de Cocina y Barra en tiempo real */}
        <Route path="/cocina" element={<CocinaRoute />} />
        <Route path="/barra" element={<CocinaRoute initialStation="bebidas" />} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
