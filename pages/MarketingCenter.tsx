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
  
  // 1. Efecto para GUARDAR la ruta actual
  useEffect(() => {
    // No guardamos rutas de edición/creación para evitar que el usuario quede atrapado
    // en un formulario si recarga la página principal, preferimos que vuelva a la lista.
    // Tampoco guardamos la ruta raíz exacta.
    const isRoot = location.pathname === '/app/marketing' || location.pathname === '/app/marketing/';
    const isWizard = location.pathname.includes('/new') || location.pathname.includes('/edit');

    if (!isRoot && !isWizard) {
      localStorage.setItem('marketing_last_view', location.pathname);
    }
  }, [location]);

  // 2. Efecto para RESTAURAR la vista al entrar
  useEffect(() => {
    // Solo ejecutamos si el usuario entró a la raíz exacta "/app/marketing"
    if (location.pathname === '/app/marketing' || location.pathname === '/app/marketing/') {
      const lastView = localStorage.getItem('marketing_last_view');
      // Si existe una vista guardada, vamos ahí. Si no, al Dashboard.
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

  // Detectar si estamos en el "Wizard" (Crear/Editar) para ocultar el menú principal
  const isWizardRoute = location.pathname.includes('/app/marketing/campaigns/new')
    || location.pathname.includes('/app/marketing/campaigns/edit');

  if (isWizardRoute) {
    return (
      <div className="h-full w-full bg-slate-50">
        <Outlet />
      </div>
    );
  }

  // Helper para clases de los botones
  const getNavLinkClass = (isActive: boolean) => `
    flex items-center justify-center px-4 py-3 rounded-xl text-sm font-bold transition-all border
    ${isActive
      ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm ring-1 ring-blue-100'
      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50'
    }
  `;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-y-auto">
      
      {/* HEADER + NAVEGACIÓN (Grid Responsiva, No Sticky) */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="w-full px-4 md:px-8 py-6">
          
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                Marketing Center
              </span>
            </h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">
              Gestiona tus comunicaciones y audiencias.
            </p>
          </div>

          {/* Menú Grid: 2 cols en Móvil, Flex en Desktop */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
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

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-1 w-full p-4 md:p-8">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default MarketingCenter;