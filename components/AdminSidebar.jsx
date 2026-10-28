import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Settings, 
  ExternalLink, 
  LogOut, 
  Menu, 
  X, 
  Tablet
} from 'lucide-react';

export const AdminSidebar = ({ 
  activeSection = 'tablero', 
  onSelectSection, 
  currentUser, 
  onLogout 
}) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'tablero', label: 'Tablero (Métricas)', icon: LayoutDashboard },
    { id: 'inventario', label: 'Inventario Rápido', icon: Package },
    { id: 'menu-qr', label: 'Menú QR y Landing', icon: QrCode },
    { id: 'configuracion', label: 'Configuración', icon: Settings }
  ];

  const handleNavClick = (sectionId) => {
    if (onSelectSection) onSelectSection(sectionId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Botón flotante móvil */}
      <div className="lg:hidden fixed top-3 left-4 z-50">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-[#1a1a1a] border border-neutral-800 text-neutral-200 rounded-lg shadow-sm flex items-center justify-center cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-xs z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Negro Granito */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#151515] border-r border-neutral-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Encabezado */}
        <div className="p-5 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-9 h-9 rounded-lg object-contain bg-black border border-neutral-800 shrink-0 shadow-xs" 
            />
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">
                Gastro<span className="text-orange-500">POS</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-medium mt-1 block">
                Panel de Administración
              </span>
            </div>
          </div>

          <div className="mt-4 px-3 py-2 bg-[#222222] rounded-lg border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-medium text-neutral-200 truncate">
                {currentUser?.email?.split('@')[0] || 'Propietario'}
              </span>
            </div>
            <span className="text-[9px] uppercase font-semibold text-neutral-400">
              Dueño
            </span>
          </div>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Módulos
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Acceso Rápido al POS */}
          <div className="pt-4 mt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => navigate('/pos-terminal')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold bg-[#222222] border border-neutral-800 text-orange-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4 text-orange-500" />
                <span>Terminal de Mozos</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300" />
            </button>
          </div>
        </nav>

        {/* Pie del menú */}
        <div className="p-4 border-t border-neutral-800 bg-[#151515]">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-1.5 px-3 text-center rounded-lg bg-[#222222] hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Landing
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
