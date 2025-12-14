import React, { useState } from 'react';
import SettingsDealStatuses from '../components/SettingsDealStatuses';
import SettingsQuoteStatuses from '../components/SettingsQuoteStatuses';
import SettingsProductTypes from '../components/SettingsProductTypes';
import SettingsDealInterests from '../components/SettingsDealInterests';

type SettingsTab = 'dealStatuses' | 'quoteStatuses' | 'productTypes' | 'dealInterests';

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

  const TabButton: React.FC<{tabName: SettingsTab, label: string}> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tabName
          ? 'bg-brand-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ajustes del Tenant</h1>
          <p className="text-slate-500 text-sm">Personaliza los estados y opciones para tu espacio de trabajo.</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 mb-4">
        <TabButton tabName="dealStatuses" label="Estados de Tratos" />
        <TabButton tabName="quoteStatuses" label="Estados de Cotizaciones" />
        <TabButton tabName="dealInterests" label="Interés del Trato" />
        <TabButton tabName="productTypes" label="Tipos de Producto" />
      </div>
      
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default SettingsPage;