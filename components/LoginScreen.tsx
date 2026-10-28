import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emailSignIn, emailSignUp, resetPassword } from '../services/auth';
import { UtensilsCrossed, ArrowRight, Mail, Key, AlertTriangle } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  sessionRevokedAlert?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, sessionRevokedAlert }) => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    if (!cleanEmail || !cleanPassword) return;
    
    try {
      setLoading(true);
      setError('');
      
      if (isLogin) {
        await emailSignIn(cleanEmail, cleanPassword);
      } else {
        await emailSignUp(cleanEmail, cleanPassword);
      }
      onLogin();
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'Error de autenticación';
      if (err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
        errorMessage = isLogin 
          ? 'Credenciales inválidas. Verifica tu correo y contraseña. Si aún no te has registrado, haz clic en "Registrarse".'
          : 'No se pudo crear la cuenta con estas credenciales. Si ya existe, por favor inicia sesión.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No se encontró una cuenta con este correo. Por favor regístrate primero.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta. Puedes restablecerla abajo.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo ya está registrado. Por favor inicia sesión.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico arriba para restablecer la contraseña.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      await resetPassword(email);
      setError('Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al enviar el correo de restablecimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#151515] flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-[#222222] max-w-md w-full box-border rounded-2xl p-8 shadow-sm flex flex-col items-center text-center border border-neutral-800 relative">
        <div className="w-14 h-14 bg-[#151515] rounded-xl flex items-center justify-center mb-4 border border-neutral-800">
          <UtensilsCrossed className="w-7 h-7 text-orange-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
          Gastro<span className="text-orange-500">POS</span>
        </h1>
        <p className="text-neutral-400 font-medium mb-6 text-xs">
          {isLogin ? 'Acceso a la Administración y Salón' : 'Registro de Restaurante'}
        </p>

        {/* Selector de Iniciar Sesión o Registrarse */}
        <div className="w-full grid grid-cols-2 p-1 bg-[#151515] rounded-xl mb-6 border border-neutral-800">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isLogin 
                ? 'bg-orange-600 text-white' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              !isLogin 
                ? 'bg-orange-600 text-white' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>Registrarse</span>
          </button>
        </div>

        {sessionRevokedAlert && (
          <div className="w-full bg-red-950/60 text-red-300 text-xs p-3 rounded-lg mb-5 border border-red-900/40 flex items-center gap-2.5 text-left">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            <div className="flex-1">
              <span className="block font-semibold">{sessionRevokedAlert}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="w-full bg-[#151515] text-neutral-300 text-xs p-3 rounded-lg mb-5 border border-neutral-800 text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="w-full bg-[#151515] border border-neutral-800 text-white text-xs font-medium py-3 pl-10 pr-3 rounded-lg outline-none focus:border-orange-500 transition-colors placeholder:text-neutral-500"
              required
            />
          </div>
          
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full bg-[#151515] border border-neutral-800 text-white text-xs font-medium py-3 pl-10 pr-3 rounded-lg outline-none focus:border-orange-500 transition-colors placeholder:text-neutral-500"
              required
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs uppercase tracking-wider py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-1"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Ingresar al Sistema' : 'Crear Cuenta'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {isLogin && (
          <button
            type="button"
            onClick={handleResetPassword}
            className="text-[11px] text-neutral-400 hover:text-white transition-colors mt-4 cursor-pointer"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
