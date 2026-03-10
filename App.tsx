import React, { Suspense } from 'react';
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
import QuotesList from './pages/quotes/QuotesList';
import QuotesDetailNew from './pages/quotes/QuotesDetailNew';
import Profile from './pages/users/Profile';
import AccountSettings from './pages/accountSettings/AccountSettings';
import Integrations from './pages/users/Integrations';
import UsersList from './pages/users/UsersList';
import WorkspaceSettings from './pages/workspace/WorkspaceSettings';
import CompaniesList from './pages/clients/CompaniesList'; // Tenants
import ClientCompaniesList from './pages/clients/ClientCompaniesList';
import ClientCompanyDetail from './pages/clients/ClientCompanyDetail';
import ClientContactsList from './pages/clients/ClientContactsList';
import ClientContactDetail from './pages/clients/ClientContactDetail';
import Deals from './pages/deals/Deals';
import DealDetail from './pages/deals/DealDetail';
import DealForm from './pages/deals/DealForm';
import ProductsList from './pages/ProductsList';
import SettingsPage from './pages/SettingsPage';
import QuoteCreate from './pages/quotes/QuoteCreate'; // RUTA CORREGIDA
import FinancialsList from './pages/financials/FinancialsList';
import FinancialForm from './pages/financials/FinancialForm';
import FinancialDetail from './pages/financials/FinancialDetail';
import AuthCallbackPage from './pages/AuthCallbackPage';
import FollowUpsPage from './pages/FollowsUpsNew';
import { PageLoader, AppLoadingFallback } from './components/AppLoaders';

// Lazy load componentes pesados
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Calendar = React.lazy(() => import('./pages/calendar/Calendar'));
const MarketingCenter = React.lazy(() => import('./pages/MarketingCenter'));

// Marketing Pages - lazy load
const MarketingDashboard = React.lazy(() => import('./components/pages_marketing/Dashboard'));
const MarketingCampaigns = React.lazy(() => import('./components/pages_marketing/Campaigns'));
const MarketingCampaignDetail = React.lazy(() => import('./components/pages_marketing/CampaignDetail'));
const MarketingCampaignWizard = React.lazy(() => import('./components/pages_marketing/CampaignWizard'));
const MarketingLists = React.lazy(() => import('./components/pages_marketing/Lists'));
const MarketingListDetail = React.lazy(() => import('./components/pages_marketing/ListDetail'));

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
    return <PageLoader message="Cargando sesión..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si aún está cargando permisos, renderizar de todos modos para evitar delay
  // La validación se hará cuando currentUser esté disponible
  const moduleKey = getModuleForPath(location.pathname);

  if (moduleKey && currentUser) {
    // Owner (is_owner) y superadmin ven todo
    if (user.is_owner || user.rol_user === 'superadmin') {
      return <Layout onLogout={() => {}}><Outlet /></Layout>;
    }

    // Admin ve CRM siempre + módulos concedidos
    if (user.rol_user === 'admin') {
      if (moduleKey === 'crm') {
        return <Layout onLogout={() => {}}><Outlet /></Layout>;
      }

      const hasAccess = currentUser?.module_access?.[moduleKey];
      if (!hasAccess) {
        return <Navigate to="/app/dashboard" replace />;
      }
    }

    // Usuario solo ve módulos concedidos
    if (user.rol_user === 'usuario') {
      const hasAccess = currentUser?.module_access?.[moduleKey];
      if (!hasAccess) {
        return <Navigate to="/app/dashboard" replace />;
      }
    }
  }

  return <Layout onLogout={() => {}}><Outlet /></Layout>;
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
              <Route path="dashboard" element={
                <Suspense fallback={<AppLoadingFallback />}>
                  <Dashboard />
                </Suspense>
              } />
              <Route path="quotes" element={<QuotesList />} />
              <Route path="quotes/new" element={<QuoteCreate />} />
              <Route path="quotes/edit" element={<QuoteCreate />} />
              <Route path="quotes/:id" element={<QuotesDetailNew />} />
              <Route path="deals" element={<DealFiltersProvider><Deals /></DealFiltersProvider>} />
              <Route path="deals/new" element={<DealForm />} />
              <Route path="deals/edit" element={<DealForm />} />
              <Route path="deals/:id" element={<DealDetail />} />
              <Route path="financials" element={<FinancialsList />} />
              <Route path="financials/new" element={<FinancialForm />} />
              <Route path="financials/edit" element={<FinancialForm />} />
              <Route path="financials/:id" element={<FinancialDetail />} />
              <Route path="calendar" element={
                <Suspense fallback={<AppLoadingFallback />}>
                  <Calendar />
                </Suspense>
              } />
              <Route path="profile" element={<Profile />} />
              <Route path="account-settings" element={<AccountSettings />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="workspace-settings" element={<WorkspaceSettings />} />
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
              <Route path="marketing" element={
                <Suspense fallback={<AppLoadingFallback />}>
                  <MarketingCenter />
                </Suspense>
              }>
                <Route index element={<Navigate to="/app/marketing/dashboard" replace />} />
                <Route path="dashboard" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingDashboard />
                  </Suspense>
                } />
                <Route path="campaigns" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingCampaigns />
                  </Suspense>
                } />
                <Route path="campaigns/new" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingCampaignWizard />
                  </Suspense>
                } />
                <Route path="campaigns/edit/:id" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingCampaignWizard />
                  </Suspense>
                } />
                <Route path="campaigns/:id" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingCampaignDetail />
                  </Suspense>
                } />
                <Route path="lists" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingLists />
                  </Suspense>
                } />
                <Route path="lists/:id" element={
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MarketingListDetail />
                  </Suspense>
                } />
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
