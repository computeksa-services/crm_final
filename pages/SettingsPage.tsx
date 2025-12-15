import React, { useState } from 'react';
import SettingsDealStatuses from '../components/SettingsDealStatuses';
import SettingsQuoteStatuses from '../components/SettingsQuoteStatuses';
import SettingsProductTypes from '../components/SettingsProductTypes';
import SettingsDealInterests from '../components/SettingsDealInterests';

type SettingsTab = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests';

// Configuración del menú para iterar limpiamente
const MENU_ITEMS: { id: SettingsTab; label: string; icon: string; description: string }[] = [
  { 
    id: 'dealStatuses', 
    label: 'Estados de Tratos', 
    icon: 'fa-solid fa-layer-group', 
    description: 'Etapas del pipeline de ventas.' 
  },
  { 
    id: 'dealInterests', 
    label: 'Niveles de Interés', 
    icon: 'fa-solid fa-fire', 
    description: 'Clasificación de probabilidad.' 
  },
  { 
    id: 'quoteStatuses', 
    label: 'Estados Cotización', 
    icon: 'fa-solid fa-file-invoice-dollar', 
    description: 'Ciclo de vida de documentos.' 
  },
  { 
    id: 'productTypes', 
    label: 'Tipos de Producto', 
    icon: 'fa-solid fa-tags', 
    description: 'Categorización de inventario.' 
  },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('dealStatuses');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dealStatuses':
        return <SettingsDealStatuses />;
      case 'quoteStatuses':
        return <SettingsQuoteStatuses />;
      case 'productTypes':
        return <SettingsProductTypes />;
      case 'dealInterests':
        return <SettingsDealInterests />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <i className="fa-solid fa-sliders text-xl"></i>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Configuración</h1>
          <p className="text-slate-500 text-sm">Administra las opciones globales de tu entorno de trabajo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar de Navegación (Izquierda) */}
        <div className="lg:col-span-3">
          <nav className="space-y-2 sticky top-6">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">General</p>
            
            {MENU_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-start group ${
                    isActive
                      ? 'bg-white shadow-md shadow-slate-200/50 text-brand-600 ring-1 ring-slate-100'
                      : 'hover:bg-white hover:shadow-sm text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <div className={`mt-0.5 w-8 flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    <i className={item.icon}></i>
                  </div>
                  <div>
                    <span className={`block text-sm font-bold ${isActive ? 'text-brand-700' : 'text-slate-700'}`}>
                        {item.label}
                    </span>
                    <span className={`block text-xs mt-0.5 ${isActive ? 'text-brand-600/70' : 'text-slate-400'}`}>
                        {item.description}
                    </span>
                  </div>
                  {isActive && (
                      <div className="ml-auto text-brand-600 text-xs mt-1">
                          <i className="fa-solid fa-chevron-right"></i>
                      </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Área de Contenido (Derecha) */}
        <div className="lg:col-span-9">
            {/* Como tus componentes hijos ya tienen tarjeta blanca (bg-white), 
                los renderizamos directamente. Añadimos una animación suave al cambiar. */}
            <div key={activeTab} className="animate-fade-in-up">
                {renderTabContent()}
            </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;