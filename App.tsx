import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { AdminLayout } from './components/AdminLayout';
import { POSDashboard } from './components/POSDashboard';
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
        <div className="font-bold text-slate-400 text-xs tracking-widest uppercase">
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
        <div className="font-bold text-slate-400 text-xs tracking-widest uppercase">
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
 * Enrutador Maestro de la Aplicación
 */
export default function App() {
  return (
    <Routes>
      {/* 1. Landing Page pública */}
      <Route path="/" element={<LandingPage />} />

      {/* 2. Panel de Administración del Dueño (con AdminSidebar y DashboardHome) */}
      <Route path="/consola" element={<AdminConsolaRoute />} />

      {/* 3. Terminal Táctil Independiente para Mozos (100% pantalla completa) */}
      <Route path="/pos-terminal" element={<POSTerminalRoute />} />

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
