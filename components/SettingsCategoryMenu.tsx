import React, { useState } from 'react';

type SettingsTab = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests' | 'dealChannels' | 'companyLabels';

interface MenuItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

interface MenuCategory {
  name: string;
  icon: string;
  items: MenuItem[];
}

const MENU_CATEGORIES: MenuCategory[] = [
  {
    name: 'Ventas',
    icon: 'fa-solid fa-rocket',
    items: [
      { id: 'dealStatuses', label: 'Estados de Tratos', icon: 'fa-solid fa-layer-group' },
      { id: 'dealInterests', label: 'Niveles de Interés', icon: 'fa-solid fa-fire' },
      { id: 'dealChannels', label: 'Canales', icon: 'fa-solid fa-bullhorn' },
    ]
  },
  {
    name: 'Cotizaciones',
    icon: 'fa-solid fa-file-invoice-dollar',
    items: [
      { id: 'quoteStatuses', label: 'Estados Cotización', icon: 'fa-solid fa-file-invoice-dollar' },
    ]
  },
  {
    name: 'Catálogos',
    icon: 'fa-solid fa-list',
    items: [
      { id: 'productTypes', label: 'Tipos de Producto', icon: 'fa-solid fa-tags' },
      { id: 'companyLabels', label: 'Etiquetas de Empresas', icon: 'fa-solid fa-tag' },
    ]
  }
];

interface SettingsMenuProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ activeTab, onTabChange }) => {
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    'Ventas': true,
    'Cotizaciones': true,
    'Catálogos': true,
  });

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Menu (Left) - Always visible */}
      <div className="w-full md:w-56 flex-shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden sticky top-20">
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
                  <div className="bg-slate-50/50 border-t border-slate-100">
                    {category.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onTabChange(item.id)}
                          className={`w-full px-8 py-2.5 flex items-center gap-3 text-left hover:bg-slate-100 transition-colors border-l-2 ${
                            isActive
                              ? 'border-brand-600 bg-brand-50/50 text-brand-700'
                              : 'border-transparent text-slate-600'
                          }`}
                        >
                          <i className={`${item.icon} text-xs ${isActive ? 'text-brand-600' : 'text-slate-400'}`}></i>
                          <span className={`text-sm font-medium ${isActive ? 'text-brand-700 font-semibold' : 'text-slate-700'}`}>
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

      {/* Placeholder for content - Content renders outside this component */}
      <div className="flex-1" />
    </div>
  );
};

export default SettingsMenu;
