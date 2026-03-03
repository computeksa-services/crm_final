import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BrandSpinner } from '../../../components/AppLoaders';
import SettingsPage from '../../SettingsPage';

const TenantConfigurations: React.FC = () => {
  const { user } = useAuth();

  // Solo owner puede acceder
  if (!user?.is_owner) {
    return <Navigate to="/app/account-settings?tab=profile" replace />;
  }

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

  return (
    <div>
      <SettingsPage />
    </div>
  );
};

export default TenantConfigurations;
