import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importar
import { DealFiltersProvider } from './contexts/DealFiltersContext';
import { DataCacheProvider, useDataCache } from './contexts/DataCacheContext';
import Layout from './components/Layout';
import { APP_ROUTES, MODULE_ROUTES } from './services/routes.config';
import { googleClientId } from './services/oauthConfig';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Dashboard from './pages/Dashboard';
import QuotesList from './pages/quotes/QuotesList';
import QuoteDetail from './pages/quotes/QuoteDetail';
import Calendar from './pages/Calendar';
import UserProfile from './pages/users/UserProfile';
import UsersList from './pages/users/UsersList';
import CompaniesList from './pages/clients/CompaniesList'; // Tenants
import ClientCompaniesList from './pages/clients/ClientCompaniesList';
import ClientCompanyDetail from './pages/clients/ClientCompanyDetail';
import ClientContactsList from './pages/clients/ClientContactsList';
import ClientContactDetail from './pages/clients/ClientContactDetail';
import DealsList from './pages/deals/DealsList';
import DealDetail from './pages/deals/DealDetail';
import DealCreate from './pages/deals/DealCreate';
import ProductsList from './pages/ProductsList';
import SettingsPage from './pages/SettingsPage';
import QuoteCreate from './pages/quotes/QuoteCreate'; // RUTA CORREGIDA
import FinancialsList from './pages/financials/FinancialsList';
import FinancialForm from './pages/financials/FinancialForm';
import FinancialDetail from './pages/financials/FinancialDetail';
import AuthCallbackPage from './pages/AuthCallbackPage';
import MarketingCenter from './pages/MarketingCenter';
import FollowUpsPage from './pages/FollowUpsPage';

// Marketing Pages
import MarketingDashboard from './components/pages_marketing/Dashboard';
import MarketingCampaigns from './components/pages_marketing/Campaigns';
import MarketingCampaignDetail from './components/pages_marketing/CampaignDetail';
import MarketingCampaignWizard from './components/pages_marketing/CampaignWizard';
import MarketingLists from './components/pages_marketing/Lists';
import MarketingListDetail from './components/pages_marketing/ListDetail';

// Componente para proteger rutas
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { currentUser, loading: cacheLoading } = useDataCache();
  const location = useLocation();

  const getModuleForPath = (pathname: string) => {
    const entries = Object.entries(MODULE_ROUTES) as Array<[keyof typeof MODULE_ROUTES, string[]]>;
    for (const [moduleKey, routes] of entries) {
      if (routes.some(route => pathname.startsWith(route))) {
        return moduleKey;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
          </div>
          <p className="text-slate-600">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (user && cacheLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
          </div>
          <p className="text-slate-600">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (user) {
    const moduleKey = getModuleForPath(location.pathname);

    if (moduleKey) {
      // Owner y superadmin ven todo
      if (user.rol_user === 'owner' || user.rol_user === 'superadmin') {
        return <Layout onLogout={() => {}}><Outlet /></Layout>;
      }

      // Admin ve CRM siempre + módulos concedidos
      if (user.rol_user === 'admin') {
        if (moduleKey === 'crm') {
          return <Layout onLogout={() => {}}><Outlet /></Layout>;
        }

        const hasAccess = currentUser?.module_access?.[moduleKey];
        return hasAccess ? <Layout onLogout={() => {}}><Outlet /></Layout> : <Navigate to="/app/dashboard" replace />;
      }

      // Usuario solo ve módulos concedidos
      const hasAccess = currentUser?.module_access?.[moduleKey];
      return hasAccess ? <Layout onLogout={() => {}}><Outlet /></Layout> : <Navigate to="/app/dashboard" replace />;
    }
  }

  return user ? <Layout onLogout={() => {}}><Outlet /></Layout> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <DataCacheProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/app" element={<ProtectedRoute />}>
              {/* Todas las rutas anidadas usarán Layout y estarán protegidas */}
              <Route index element={<Navigate to="/app/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="quotes" element={<QuotesList />} />
              <Route path="quotes/new" element={<QuoteCreate />} />
              <Route path="quotes/edit" element={<QuoteCreate />} />
              <Route path="quotes/:id" element={<QuoteDetail />} />
              <Route path="deals" element={<DealFiltersProvider><DealsList /></DealFiltersProvider>} />
              <Route path="deals/new" element={<DealCreate />} />
              <Route path="deals/edit" element={<DealCreate />} />
              <Route path="deals/:id" element={<DealDetail />} />
              <Route path="financials" element={<FinancialsList />} />
              <Route path="financials/new" element={<FinancialForm />} />
              <Route path="financials/edit" element={<FinancialForm />} />
              <Route path="financials/:id" element={<FinancialDetail />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="users" element={<UsersList />} />
              <Route path="companies" element={<CompaniesList />} />
              <Route path="client-companies" element={<ClientCompaniesList />} />
              <Route path="client-companies/:id" element={<ClientCompanyDetail />} />
              <Route path="client-contacts" element={<ClientContactsList />} />
              <Route path="client-contacts/:id" element={<ClientContactDetail />} />
              <Route path="followups" element={<FollowUpsPage />} />
              <Route path="products" element={<ProductsList />} />
              <Route path="settings" element={<SettingsPage />} />
              
              {/* Marketing Center - Sistema independiente con subrutas */}
              <Route path="marketing" element={<MarketingCenter />}>
                <Route index element={<Navigate to="/app/marketing/dashboard" replace />} />
                <Route path="dashboard" element={<MarketingDashboard />} />
                <Route path="campaigns" element={<MarketingCampaigns />} />
                <Route path="campaigns/new" element={<MarketingCampaignWizard />} />
                <Route path="campaigns/edit/:id" element={<MarketingCampaignWizard />} />
                <Route path="campaigns/:id" element={<MarketingCampaignDetail />} />
                <Route path="lists" element={<MarketingLists />} />
                <Route path="lists/:id" element={<MarketingListDetail />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </DataCacheProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
