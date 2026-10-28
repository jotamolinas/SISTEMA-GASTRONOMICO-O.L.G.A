import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ChevronDown, 
  Check, 
  Zap, 
  ArrowRight, 
  Users, 
  Activity, 
  Settings, 
  Beer, 
  Coffee, 
  Pizza, 
  Flame, 
  ShoppingBag, 
  Clock, 
  Receipt, 
  Layers, 
  Sparkles, 
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../services/auth';
import { onAuthStateChanged, User } from 'firebase/auth';

const Logo: React.FC<{ darkTheme?: boolean }> = ({ darkTheme = false }) => (
  <div className="flex items-center gap-3">
    <img 
      src="/logo.png" 
      alt="Logo" 
      className="w-10 h-10 rounded-xl object-contain bg-black border border-neutral-800 shrink-0 shadow-xs" 
    />
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span className="font-bold tracking-tight text-xl leading-none text-white">
          Gastro<span className="text-orange-500">POS</span>
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/30">
          PRO
        </span>
      </div>
      <span className="text-[10px] font-medium tracking-wider uppercase mt-0.5 text-neutral-400">
        SaaS Gastronómico
      </span>
    </div>
  </div>
);

const CarouselMockup = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = [
    {
      id: 'pos',
      title: 'Punto de Venta Ultrarrápido',
      icon: <Receipt className="w-4 h-4 text-orange-500" />,
      content: (
        <div className="w-full h-full bg-[#151515] rounded-xl border border-neutral-800 flex flex-col text-left">
          <div className="bg-[#222222] p-3 border-b border-neutral-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <div className="font-bold text-white text-xs">Comanda • Mesa 04</div>
            </div>
            <div className="px-2.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-semibold">
              #1042
            </div>
          </div>
          <div className="p-3 flex-1 space-y-2 bg-[#151515]">
            {[
              { name: 'Hamburguesa Doble Smash', qty: '2x', price: '90.000 Gs.', category: 'Cocina' },
              { name: 'Cerveza IPA Tirada 500ml', qty: '3x', price: '75.000 Gs.', category: 'Barra' },
              { name: 'Papas Rústicas Trufadas', qty: '1x', price: '28.000 Gs.', category: 'Cocina' }
            ].map((item, i) => (
              <div key={i} className="bg-[#222222] p-2.5 rounded-lg border border-neutral-800 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#151515] flex items-center justify-center font-bold text-xs text-orange-500">
                    {item.qty}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{item.name}</div>
                    <div className="text-[10px] text-neutral-400">{item.category}</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-neutral-200 font-mono">
                  {item.price}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#222222] text-white px-4 py-2.5 flex justify-between items-center text-xs border-t border-neutral-800">
            <span className="text-neutral-400">Total a Cobrar:</span>
            <span className="font-bold text-orange-500 font-mono text-sm">193.000 Gs.</span>
          </div>
        </div>
      )
    },
    {
      id: 'mesas',
      title: 'Control de Mesas y Salón',
      icon: <Layers className="w-4 h-4 text-orange-500" />,
      content: (
        <div className="w-full h-full bg-[#151515] rounded-xl border border-neutral-800 flex flex-col">
          <div className="bg-[#222222] p-3 border-b border-neutral-800 flex justify-between items-center">
            <div className="font-bold text-white text-xs">Salón Principal</div>
            <div className="flex gap-2 text-[10px]">
              <span className="px-2 py-0.5 bg-neutral-800 text-orange-400 font-semibold rounded">6 Ocupadas</span>
              <span className="px-2 py-0.5 bg-[#151515] text-neutral-400 rounded">6 Libres</span>
            </div>
          </div>
          <div className="p-3 flex-1 grid grid-cols-3 gap-2 bg-[#151515]">
            {[
              { mesa: 'Mesa 01', status: 'Ocupada', total: '145.000 Gs.' },
              { mesa: 'Mesa 02', status: 'Libre', total: 'Disponible' },
              { mesa: 'Mesa 03', status: 'Ocupada', total: '88.000 Gs.' },
              { mesa: 'Mesa 04', status: 'Cobrar', total: '193.000 Gs.' },
              { mesa: 'Barra 01', status: 'Ocupada', total: '55.000 Gs.' },
              { mesa: 'Terraza 01', status: 'Libre', total: 'Disponible' }
            ].map((item, i) => (
              <div key={i} className="bg-[#222222] p-2.5 rounded-lg border border-neutral-800 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-white">{item.mesa}</span>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-neutral-300">{item.total}</div>
                  <div className="text-[9px] text-orange-400 mt-0.5">{item.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="w-full h-full flex flex-col relative z-10">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          {slides[activeIndex].icon}
          <span className="font-semibold text-white text-xs">{slides[activeIndex].title}</span>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === activeIndex ? 'bg-orange-500 w-4' : 'bg-neutral-700'}`}
            />
          ))}
        </div>
      </div>
      
      <div className="flex-1 w-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {slides[activeIndex].content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser || null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#151515] font-sans text-neutral-200 flex flex-col select-none">
      {/* 1. NAVBAR */}
      <header className="fixed top-0 inset-x-0 bg-[#151515]/95 backdrop-blur-xs border-b border-neutral-800 z-50">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <Logo darkTheme={true} />
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-400">
            <a href="#funciones" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#rubros" className="hover:text-white transition-colors">Rubros</a>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
          </div>

          <div>
            <button 
              onClick={() => navigate('/consola')}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-neutral-700"
            >
              {currentUser ? 'Ir a mi Consola' : 'Ir a Consola'}
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col pt-16">
        {/* 2. HERO SECTION */}
        <section className="pt-16 pb-20 px-6 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 w-full">
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#222222] text-orange-400 text-xs font-semibold rounded-lg border border-neutral-800">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              SaaS Gastronómico de Alta Velocidad
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
              Automatiza tu Restaurante y Acelera tus Ventas
            </h1>

            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Punto de Venta (POS) ultrarrápido y gestión de inventario para bares y restaurantes. Diseñado para pantallas táctiles, comanderas de cocina, control de mesas y arqueos de caja sin fricción.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button 
                onClick={() => navigate(currentUser ? '/consola' : '/consola')}
                className="w-full sm:w-auto px-6 py-3 bg-orange-600 text-white text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{currentUser ? 'Ir a mi Consola' : 'Iniciar Sesión o Registrarse'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/pos-terminal')}
                className="w-full sm:w-auto px-6 py-3 bg-[#222222] text-neutral-300 border border-neutral-800 text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                Ver Terminal de Mozos
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-neutral-400 pt-2">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-orange-500" /> Modo Local-First</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-orange-500" /> Compatible con impresoras térmicas</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-orange-500" /> Listo en 1 minuto</span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-lg">
            <div className="bg-[#222222] border border-neutral-800 rounded-2xl p-4 shadow-sm">
              <div className="h-80 flex flex-col">
                <CarouselMockup />
              </div>
            </div>
          </div>
        </section>

        {/* 3. MÓDULOS DEL POS */}
        <section id="funciones" className="py-16 bg-[#1a1a1a] border-y border-neutral-800">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white tracking-tight">Potencia Diseñada para el Ritmo del Salón</h2>
              <p className="text-neutral-400 mt-2 text-xs sm:text-sm max-w-xl mx-auto">Elimina los cuellos de botella desde el pedido hasta la comanda de cocina.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <article className="bg-[#222222] border border-neutral-800 p-6 rounded-xl">
                <div className="w-10 h-10 bg-[#151515] border border-neutral-800 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">POS Táctil Ultrarrápido</h3>
                <p className="text-neutral-400 leading-relaxed text-xs">
                  Botones limpios y de alto contraste para camareros y cajeros. Añade platos y envía pedidos en menos de 3 clics.
                </p>
              </article>

              <article className="bg-[#222222] border border-neutral-800 p-6 rounded-xl">
                <div className="w-10 h-10 bg-[#151515] border border-neutral-800 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Inventario en Vivo</h3>
                <p className="text-neutral-400 leading-relaxed text-xs">
                  Descuenta insumos automáticamente con cada venta. Controla stock crítico de carnes, barriles y porciones.
                </p>
              </article>

              <article className="bg-[#222222] border border-neutral-800 p-6 rounded-xl">
                <div className="w-10 h-10 bg-[#151515] border border-neutral-800 rounded-lg flex items-center justify-center mb-4">
                  <Layers className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Mesas y Comandas</h3>
                <p className="text-neutral-400 leading-relaxed text-xs">
                  Visualiza el salón completo: mesas libres, ocupadas y por cobrar. Separa cuentas fácilmente por comensal.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 4. PREGUNTAS */}
        <section id="faq" className="py-16 bg-[#151515]">
          <div className="max-w-2xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-white tracking-tight">Preguntas Frecuentes</h2>
              <p className="text-neutral-400 mt-1 text-xs">Respuestas directas para operar tu restaurante.</p>
            </div>

            <div className="space-y-3">
              <article className="bg-[#222222] border border-neutral-800 rounded-xl overflow-hidden">
                <button 
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left font-semibold text-xs text-white"
                  onClick={() => toggleFaq(0)}
                >
                  ¿Funciona en cualquier tablet o pantalla táctil?
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${openFaq === 0 ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === 0 && (
                  <div className="px-5 pb-3.5 text-neutral-400 text-xs border-t border-neutral-800 pt-2.5">
                    Sí, GastroPOS funciona en cualquier navegador moderno de tablets iPad, Android o computadoras All-in-One sin instalar software adicional.
                  </div>
                )}
              </article>

              <article className="bg-[#222222] border border-neutral-800 rounded-xl overflow-hidden">
                <button 
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left font-semibold text-xs text-white"
                  onClick={() => toggleFaq(1)}
                >
                  ¿Qué ocurre si se corta la conexión a internet?
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${openFaq === 1 ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === 1 && (
                  <div className="px-5 pb-3.5 text-neutral-400 text-xs border-t border-neutral-800 pt-2.5">
                    El sistema cuenta con diseño Local-First. Puedes seguir emitiendo comandas y cobrando normalmente. Al reconectar, los datos se sincronizan con la nube.
                  </div>
                )}
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#101010] py-8 px-6 mt-auto border-t border-neutral-800 text-neutral-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo darkTheme={true} />
          <p>© 2026 GastroPOS. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
