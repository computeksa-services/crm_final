import React, { useState, useEffect } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import ProfileSection from './sections/ProfileSection';
import PersonalIntegrations from './sections/PersonalIntegrations';
import TenantIntegrations from './sections/TenantIntegrations';
import TenantUsers from './sections/TenantUsers';
import TenantConfigurations from './sections/TenantConfigurations';
import SettingsDealStatuses from '../../components/SettingsDealStatuses';
import SettingsQuoteStatuses from '../../components/SettingsQuoteStatuses';
import SettingsProductTypes from '../../components/SettingsProductTypes';
import SettingsDealInterests from '../../components/SettingsDealInterests';
import SettingsDealChannels from '../../components/SettingsDealChannels';
import SettingsCompanyLabels from '../../components/SettingsCompanyLabels';

type SettingsTab = 'profile' | 'personalIntegrations' | 'tenantIntegrations' | 'tenantUsers' | 'tenantConfigurations';
type ConfigurationType = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests' | 'dealChannels' | 'companyLabels';

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
  section: 'perfil' | 'tenant';
}

const CONFIGURATION_CATEGORIES = [
  { 
    name: 'Ventas', 
    icon: 'fa-solid fa-rocket', 
    items: [
      { id: 'dealStatuses' as ConfigurationType, label: 'Estados de Tratos', icon: 'fa-solid fa-layer-group' },
      { id: 'dealInterests' as ConfigurationType, label: 'Niveles de Interés', icon: 'fa-solid fa-fire' },
      { id: 'dealChannels' as ConfigurationType, label: 'Canales', icon: 'fa-solid fa-bullhorn' },
    ]
  },
  { 
    name: 'Cotizaciones', 
    icon: 'fa-solid fa-file-invoice-dollar', 
    items: [
      { id: 'quoteStatuses' as ConfigurationType, label: 'Estados Cotización', icon: 'fa-solid fa-file-invoice-dollar' },
    ]
  },
  { 
    name: 'Catálogos', 
    icon: 'fa-solid fa-list', 
    items: [
      { id: 'productTypes' as ConfigurationType, label: 'Tipos de Producto', icon: 'fa-solid fa-tags' },
      { id: 'companyLabels' as ConfigurationType, label: 'Etiquetas de Empresas', icon: 'fa-solid fa-tag' },
    ]
  }
];

const NAV_ITEMS: NavItem[] = [
  // Perfil del usuario
  {
    id: 'profile',
    label: 'Perfil',
    icon: 'fa-user',
    section: 'perfil'
  },
  {
    id: 'personalIntegrations',
    label: 'Integraciones',
    icon: 'fa-plug',
    section: 'perfil'
  },
  // Configuración del Tenant
  {
    id: 'tenantIntegrations',
    label: 'Integraciones',
    icon: 'fa-building',
    section: 'tenant'
  },
  {
    id: 'tenantUsers',
    label: 'Usuarios',
    icon: 'fa-users',
    section: 'tenant'
  },
  {
    id: 'tenantConfigurations',
    label: 'Estados y Etiquetas',
    icon: 'fa-sliders-h',
    section: 'tenant'
  },
];

const STORAGE_KEY = 'accountSettings-activeTab';
const VALID_TABS: SettingsTab[] = ['profile', 'personalIntegrations', 'tenantIntegrations', 'tenantUsers', 'tenantConfigurations'];

const AccountSettings: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isWorkspaceOwner = user?.is_owner === true;
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tabParam = searchParams.get('tab') as SettingsTab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }
    const saved = localStorage.getItem(STORAGE_KEY) as SettingsTab | null;
    return (saved && VALID_TABS.includes(saved)) 
      ? saved 
      : 'profile';
  });

  const [configType, setConfigType] = useState<ConfigurationType>('dealStatuses');
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    'Ventas': true,
    'Cotizaciones': true,
    'Catálogos': true,
  });

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSearchParams({ tab }, { replace: true });
  };

  const handleConfigTypeChange = (type: ConfigurationType) => {
    setConfigType(type);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as SettingsTab | null;
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
      setSidebarOpen(false);
    }
  }, [searchParams, activeTab]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BrandSpinner size="xl" className="mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    const isTenantTab = ['tenantIntegrations', 'tenantUsers', 'tenantConfigurations'].includes(activeTab);
    if (isTenantTab && !isWorkspaceOwner) {
      return <ProfileSection />;
    }

    switch (activeTab) {
      case 'profile':
        return <ProfileSection />;
      case 'personalIntegrations':
        return <PersonalIntegrations />;
      case 'tenantIntegrations':
        return <TenantIntegrations />;
      case 'tenantUsers':
        return <TenantUsers />;
      case 'tenantConfigurations':
        return renderConfigurationSection();
      default:
        return <ProfileSection />;
    }
  };

  const renderConfigurationSection = () => {
    switch (configType) {
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
    <div className="bg-slate-50 dark:bg-slate-900 h-[calc(100vh-64px)] overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/50 sm:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className="flex flex-col sm:flex-row h-full">
        {/* Sidebar */}
        <div className={`w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto fixed sm:static inset-y-16 left-0 z-40 transition-transform sm:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-5">
            <button 
              onClick={() => setActiveTab('profile')}
              className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 hover:text-brand-600 transition-colors block"
            >
              Configuración
            </button>

            {/* Perfil del Usuario */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Perfil
              </h3>
              <nav className="space-y-1">
                {NAV_ITEMS.filter(item => item.section === 'perfil').map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                      activeTab === item.id
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <i className={`fas ${item.icon} w-4 text-center`}></i>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Configuración del Tenant */}
            {isWorkspaceOwner && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Workspace
                </h3>
                <nav className="space-y-1">
                  {NAV_ITEMS.filter(item => item.section === 'tenant').map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                        activeTab === item.id
                          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <i className={`fas ${item.icon} w-4 text-center`}></i>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>

                {/* Configuration Categories (shown when tenantConfigurations is active) */}
                {activeTab === 'tenantConfigurations' && (
                  <div className="mt-2">
                    {CONFIGURATION_CATEGORIES.map((category) => {
                      const isExpanded = expandedCategories[category.name];
                      const hasActiveItem = category.items.some(item => item.id === configType);

                      return (
                        <div key={category.name} className="mb-2">
                          {/* Category Header */}
                          <button
                            onClick={() => toggleCategory(category.name)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${
                              hasActiveItem
                                ? 'text-slate-700 dark:text-slate-200'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <i className={`${category.icon} text-xs`}></i>
                              <span>{category.name}</span>
                            </div>
                            <i className={`fas fa-chevron-down text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </button>

                          {/* Category Items */}
                          {isExpanded && (
                            <div className="space-y-0.5 ml-3 mt-1">
                              {category.items.map((item) => {
                                const isActive = configType === item.id;
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => handleConfigTypeChange(item.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded transition-colors text-left border-l-2 ${
                                      isActive
                                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <i className={`${item.icon} text-xs`}></i>
                                    <span>{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Mobile Header */}
          <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configuración</h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <i className="fas fa-bars text-xl text-slate-700 dark:text-slate-300"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
