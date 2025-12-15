import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importar
import Layout from './components/Layout';
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

// Componente para proteger rutas
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Cargando sesión...</div>; // O un spinner
  }

  return user ? <Layout><Outlet /></Layout> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
      </HashRouter>
    </AuthProvider>
  );
};

export default App;