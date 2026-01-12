import React, { useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MarketingCenter: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ---------------------------------------------------------
  // LÓGICA DE MEMORIA (Recordar última vista)
  // ---------------------------------------------------------
  
  useEffect(() => {
    const isRoot = location.pathname === '/app/marketing' || location.pathname === '/app/marketing/';
    const isWizard = location.pathname.includes('/new') || location.pathname.includes('/edit');

    if (!isRoot && !isWizard) {
      localStorage.setItem('marketing_last_view', location.pathname);
    }
  }, [location]);

  useEffect(() => {
    if (location.pathname === '/app/marketing' || location.pathname === '/app/marketing/') {
      const lastView = localStorage.getItem('marketing_last_view');
      if (lastView) {
        navigate(lastView, { replace: true });
      } else {
        navigate('/app/marketing/dashboard', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  // ---------------------------------------------------------
  // RENDERIZADO
  // ---------------------------------------------------------

  if (!user?.id_tenant || !user?.id_user) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <p>Cargando sesión...</p>
        </div>
      </div>
    );
  }

  // Detectar si estamos en el "Wizard" para ocultar el menú principal
  const isWizardRoute = location.pathname.includes('/app/marketing/campaigns/new')
    || location.pathname.includes('/app/marketing/campaigns/edit');

  if (isWizardRoute) {
    return (
      <div className="h-full w-full bg-slate-50">
        <Outlet />
      </div>
    );
  }

  // Helper para clases de los botones (Más compacto: py-2 en lugar de py-3)
  const getNavLinkClass = (isActive: boolean) => `
    flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold transition-all border
    ${isActive
      ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm ring-1 ring-blue-100'
      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50'
    }
  `;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-y-auto">
      
      {/* HEADER COMPACTO */}
      <div className="bg-white border-b border-slate-200 shrink-0 sticky top-0 z-20">
        <div className="w-full px-4 md:px-6 py-3">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Título a la izquierda */}
            <div className="shrink-0 flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                  Marketing Center
                </span>
              </h1>
              {/* Separador visual opcional para desktop */}
              <div className="hidden md:block h-5 w-px bg-slate-200 mx-1"></div>
            </div>

            {/* Menú a la derecha (Horizontal) */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
              <NavLink
                to="/app/marketing/dashboard"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <i className="fa-solid fa-chart-pie mr-2"></i> Dashboard
              </NavLink>
              
              <NavLink
                to="/app/marketing/campaigns"
                className={({ isActive }) => getNavLinkClass(isActive || location.pathname.includes('/app/marketing/campaigns'))}
              >
                <i className="fa-solid fa-paper-plane mr-2"></i> Campañas
              </NavLink>
              
              <NavLink
                to="/app/marketing/lists"
                className={({ isActive }) => getNavLinkClass(isActive || location.pathname.includes('/app/marketing/lists'))}
              >
                <i className="fa-solid fa-users mr-2"></i> Listas
              </NavLink>
              
              <NavLink
                to="/app/marketing/integrations"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <i className="fa-solid fa-plug mr-2"></i> Integraciones
              </NavLink>
            </div>

          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-1 w-full p-4 md:p-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default MarketingCenter;