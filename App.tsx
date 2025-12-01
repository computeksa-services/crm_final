import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
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
import ProductsList from './pages/ProductsList';
import SettingsStatuses from './pages/SettingsStatuses';
import { MockApi } from './services/mockApi';

const AUTH_KEY = 'isAuthenticated';

const ProtectedRoute = ({ isAuthenticated, onLogout }: { isAuthenticated: boolean; onLogout: () => void }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout onLogout={onLogout}>
      <Outlet />
    </Layout>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const storedAuth = localStorage.getItem(AUTH_KEY);
    return storedAuth === 'true';
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, String(isAuthenticated));
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_KEY);
    MockApi.logout(); 
    window.location.href = '/'; 
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

        <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} onLogout={handleLogout} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/quotes/:id" element={<QuoteDetail />} />
          <Route path="/deals" element={<DealsList />} />
          <Route path="/deals/:id" element={<DealDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/users" element={<UsersList />} />
          <Route path="/companies" element={<CompaniesList />} />
          <Route path="/client-companies" element={<ClientCompaniesList />} />
          <Route path="/client-companies/:id" element={<ClientCompanyDetail />} />
          <Route path="/client-contacts" element={<ClientContactsList />} />
          <Route path="/client-contacts/:id" element={<ClientContactDetail />} />
          <Route path="/products" element={<ProductsList />} />
          <Route path="/settings/statuses" element={<SettingsStatuses />} />
          
          <Route path="/app/*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;