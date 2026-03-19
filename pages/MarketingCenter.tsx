import React, { useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandSpinner } from '../components/AppLoaders';

const MarketingCenter: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Lógica de memoria
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

  if (!user?.id_tenant || !user?.id_user) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <BrandSpinner size="lg" />
          <p className="text-sm">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  // Detectar wizard para ocultar navegación
  const isWizardRoute = location.pathname.includes('/app/marketing/campaigns/new')
    || location.pathname.includes('/app/marketing/campaigns/edit');

  if (isWizardRoute) {
    return (
      <div className="h-full w-full bg-gray-50 dark:bg-slate-900">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-slate-900">
      
      {/* HEADER CON NAVEGACIÓN */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          
          {/* Navegación horizontal - estilo tabs */}
          <nav className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg w-fit">
            <NavLink
              to="/app/marketing/dashboard"
              className={({ isActive }) => `
                flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap
                ${isActive
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <i className="fa-solid fa-chart-pie text-xs"></i>
              <span>Dashboard</span>
            </NavLink>
            
            <NavLink
              to="/app/marketing/campaigns"
              className={({ isActive }) => `
                flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap
                ${isActive || location.pathname.includes('/campaigns')
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
              <span>Campañas</span>
            </NavLink>
            
            <NavLink
              to="/app/marketing/lists"
              className={({ isActive }) => `
                flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap
                ${isActive || location.pathname.includes('/lists')
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <i className="fa-solid fa-users text-xs"></i>
              <span>Listas</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default MarketingCenter;