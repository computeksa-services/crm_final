import React, { useState } from 'react';
import SettingsDealStatuses from '../components/SettingsDealStatuses';
import SettingsQuoteStatuses from '../components/SettingsQuoteStatuses';
import SettingsProductTypes from '../components/SettingsProductTypes';
import SettingsDealInterests from '../components/SettingsDealInterests';
import SettingsDealChannels from '../components/SettingsDealChannels';

type SettingsTab = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests' | 'dealChannels';

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
    id: 'dealChannels', 
    label: 'Canales', 
    icon: 'fa-solid fa-bullhorn', 
    description: 'Origen de los tratos.' 
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

const STORAGE_KEY = 'settings-active-tab';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SettingsTab | null;
    return saved && ['dealStatuses','quoteStatuses','productTypes','dealInterests','dealChannels'].includes(saved)
      ? saved
      : 'dealStatuses';
  });

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

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
      case 'dealChannels':
        return <SettingsDealChannels />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full px-6 space-y-6 pb-12 animate-fade-in">
      
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

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200">
          {MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex-shrink-0 px-6 py-4 flex items-center gap-3 border-b-2 transition-all ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-brand-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <i className={`${item.icon} ${isActive ? 'text-brand-600' : 'text-slate-400'}`}></i>
                <div className="text-left">
                  <div className={`text-sm font-bold whitespace-nowrap ${isActive ? 'text-brand-700' : 'text-slate-700'}`}>
                    {item.label}
                  </div>
                  <div className={`text-xs ${isActive ? 'text-brand-600/70' : 'text-slate-400'}`}>
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <div key={activeTab} className="animate-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;
