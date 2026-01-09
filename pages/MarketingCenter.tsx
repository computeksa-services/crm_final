import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MarketingCenter: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user?.id_tenant || !user?.id_user) {
    return <div className="p-10 text-center">Cargando sesión...</div>;
  }

  // Determinar la sección activa basada en la ruta
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                Marketing Center
              </span>
            </h1>
            <p className="text-slate-500 mt-1">
              Gestiona tus comunicaciones, audiencias y resultados en un solo lugar.
            </p>
          </div>
        </div>

        {/* Navegación (Tabs con Links) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 inline-flex gap-1">
          <NavLink
            to="/app/marketing/dashboard"
            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isActive
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-chart-pie mr-2"></i> Dashboard
          </NavLink>
          
          <NavLink
            to="/app/marketing/campaigns"
            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isActive || location.pathname.includes('/app/marketing/campaigns')
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-paper-plane mr-2"></i> Campañas
          </NavLink>
          
          <NavLink
            to="/app/marketing/lists"
            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isActive || location.pathname.includes('/app/marketing/lists')
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-users mr-2"></i> Listas
          </NavLink>
          
          <NavLink
            to="/app/marketing/integrations"
            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isActive
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-plug mr-2"></i> Integraciones
          </NavLink>
        </div>

        {/* Contenido Dinámico - Aquí se renderizarán las subrutas */}
        <div className="animate-in fade-in duration-300">
          <Outlet />
        </div>

      </div>
    </div>
  );
};

export default MarketingCenter;