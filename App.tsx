import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importar
import Layout from './components/Layout';
import { googleClientId } from './services/oauthConfig';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import QuotesList from './pages/QuotesList';
import QuoteDetail from './pages/QuoteDetail';
import Calendar from './pages/Calendar';
import UserProfile from './pages/UserProfile';
import UsersList from './pages/UsersList';
import CompaniesList from './pages/CompaniesList'; // Tenants
import ClientCompaniesList from './pages/ClientCompaniesList';
import ClientCompanyDetail from './pages/ClientCompanyDetail';
import ClientContactsList from './pages/ClientContactsList';
import ClientContactDetail from './pages/ClientContactDetail';
import DealsList from './pages/DealsList';
import DealDetail from './pages/DealDetail';
import DealCreate from './pages/DealCreate';
import ProductsList from './pages/ProductsList';
import SettingsPage from './pages/SettingsPage';
import QuoteCreate from './pages/QuoteCreate'; // RUTA CORREGIDA
import FinancialsList from './pages/FinancialsList';
import FinancialCreate from './pages/FinancialCreate';
import FinancialDetail from './pages/FinancialDetail';
import AuthCallbackPage from './pages/AuthCallbackPage';

// Componente para proteger rutas
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

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

  return user ? <Layout onLogout={() => {}}><Outlet /></Layout> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<ProtectedRoute />}>
            {/* Todas las rutas anidadas usarán Layout y estarán protegidas */}
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="quotes" element={<QuotesList />} />
            <Route path="quotes/new" element={<QuoteCreate />} />
            <Route path="quotes/:id" element={<QuoteDetail />} />
            <Route path="deals" element={<DealsList />} />
            <Route path="deals/new" element={<DealCreate />} />
            <Route path="deals/:id" element={<DealDetail />} />
            <Route path="financials" element={<FinancialsList />} />
            <Route path="financials/new" element={<FinancialCreate />} />
            <Route path="financials/:id" element={<FinancialDetail />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="users" element={<UsersList />} />
            <Route path="companies" element={<CompaniesList />} />
            <Route path="client-companies" element={<ClientCompaniesList />} />
            <Route path="client-companies/:id" element={<ClientCompanyDetail />} />
            <Route path="client-contacts" element={<ClientContactsList />} />
            <Route path="client-contacts/:id" element={<ClientContactDetail />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;