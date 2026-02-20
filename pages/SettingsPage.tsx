/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/sections/TenantConfigurations.tsx
 * Ruta anterior: /app/settings
 * Nueva ruta: /app/account-settings?tab=tenantConfigurations
 */

import React, { useState } from 'react';
import SettingsDealStatuses from '../components/SettingsDealStatuses';
import SettingsQuoteStatuses from '../components/SettingsQuoteStatuses';
import SettingsProductTypes from '../components/SettingsProductTypes';
import SettingsDealInterests from '../components/SettingsDealInterests';
import SettingsDealChannels from '../components/SettingsDealChannels';
import SettingsCompanyLabels from '../components/SettingsCompanyLabels';

type SettingsTab = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests' | 'dealChannels' | 'companyLabels';

const MENU_CATEGORIES = [
  { 
    name: 'Ventas', 
    icon: 'fa-solid fa-rocket', 
    items: [
      { id: 'dealStatuses' as SettingsTab, label: 'Estados de Tratos', icon: 'fa-solid fa-layer-group' },
      { id: 'dealInterests' as SettingsTab, label: 'Niveles de Interés', icon: 'fa-solid fa-fire' },
      { id: 'dealChannels' as SettingsTab, label: 'Canales', icon: 'fa-solid fa-bullhorn' },
    ]
  },
  { 
    name: 'Cotizaciones', 
    icon: 'fa-solid fa-file-invoice-dollar', 
    items: [
      { id: 'quoteStatuses' as SettingsTab, label: 'Estados Cotización', icon: 'fa-solid fa-file-invoice-dollar' },
    ]
  },
  { 
    name: 'Catálogos', 
    icon: 'fa-solid fa-list', 
    items: [
      { id: 'productTypes' as SettingsTab, label: 'Tipos de Producto', icon: 'fa-solid fa-tags' },
      { id: 'companyLabels' as SettingsTab, label: 'Etiquetas de Empresas', icon: 'fa-solid fa-tag' },
    ]
  }
];

const STORAGE_KEY = 'settings-active-tab';

const SettingsPage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SettingsTab | null;
    return saved && ['dealStatuses','quoteStatuses','productTypes','dealInterests','dealChannels','companyLabels'].includes(saved)
      ? saved
      : 'dealStatuses';
  });

  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    'Ventas': true,
    'Cotizaciones': true,
    'Catálogos': true,
  });

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
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
      case 'companyLabels':
        return <SettingsCompanyLabels />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full px-6 space-y-6 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200 flex-shrink-0">
              <i className="fa-solid fa-sliders text-lg md:text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">Configuración</h1>
            <p className="text-xs md:text-sm text-slate-500">Administra opciones globales de tu entorno.</p>
          </div>
        </div>
        {/* Tablet Sidebar Toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex lg:hidden items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <i className={`fa-solid ${sidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
        </button>
      </div>

      {/* Layout: Sidebar + Content */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative">
        
        {/* Tablet Overlay */}
        {sidebarOpen && (
          <div
            className="hidden md:block lg:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Menu (Left) */}
        <div className={`w-full md:w-56 flex-shrink-0 z-40 md:z-auto ${sidebarOpen ? 'block' : 'hidden md:block lg:block'}`}>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden sticky top-20">
            {/* Sidebar Header */}
            <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-bars text-sm"></i>
              <h2 className="text-xs font-semibold uppercase tracking-wider">Estados y Etiquetas</h2>
            </div>
            
            {/* Categories */}
            {MENU_CATEGORIES.map((category) => {
              const isExpanded = expandedCategories[category.name];
              const hasActiveItem = category.items.some(item => item.id === activeTab);

              return (
                <div key={category.name} className="border-b border-slate-100 last:border-b-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      hasActiveItem ? 'bg-brand-50/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <i className={`${category.icon} ${hasActiveItem ? 'text-brand-600' : 'text-slate-400'}`}></i>
                      <span className={`text-sm font-semibold ${hasActiveItem ? 'text-brand-700' : 'text-slate-700'}`}>
                        {category.name}
                      </span>
                    </div>
                    <i className={`fas fa-chevron-down text-xs transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                      hasActiveItem ? 'text-brand-600' : 'text-slate-400'
                    }`}></i>
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/80 px-2 py-1.5">
                      {category.items.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full px-3 py-2 my-0.5 flex items-center gap-2 text-left hover:bg-slate-200 rounded transition-colors border-l-2 text-sm ${
                              isActive
                                ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                                : 'border-transparent text-slate-600'
                            }`}
                          >
                            <i className={`${item.icon} text-xs ${isActive ? 'text-brand-600' : 'text-slate-400'}`}></i>
                            <span>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content (Right) */}
        <div className="flex-1 bg-white rounded-lg md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 md:p-6">
            <div key={activeTab} className="animate-fade-in">
              {renderTabContent()}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default SettingsPage;
