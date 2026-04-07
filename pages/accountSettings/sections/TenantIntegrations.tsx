import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { TenantEmailSettings } from '../../../src/components/users/TenantEmailSettings';
import { Navigate } from 'react-router-dom';
import Toast from '../../../components/Toast';
import { BrandSpinner } from '../../../components/AppLoaders';
import { apiFetch } from '../../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../../services/gatewayConfig';

// --- NUEVO COMPONENTE: CONFIGURACIÓN DEL RESPONSABLE FINANCIERO ---
const TenantFinanceSettings: React.FC<{ user: any }> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactData, setContactData] = useState({ name: '', email: '' });
  const [hasContact, setHasContact] = useState(false);

  const fetchTenantConfig = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      setLoading(true);
      // Usamos el endpoint existente de detalle del tenant para leer el JSONB settings
      const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant }));
      if (res.ok) {
        const data = await res.json();
        const tenant = Array.isArray(data) ? data[0] : data;
        
        // Extraemos la configuración del contacto financiero del JSON settings
        const financeContact = tenant?.settings?.finance_contact;
        if (financeContact && financeContact.email) {
          setContactData({ name: financeContact.name || '', email: financeContact.email });
          setHasContact(true);
        }
      }
    } catch (error) {
      console.error("Error cargando config financiera:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id_tenant]);

  useEffect(() => {
    fetchTenantConfig();
  }, [fetchTenantConfig]);

  const handleSave = async (action: 'save' | 'delete') => {
    if (action === 'save' && (!contactData.name || !contactData.email)) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Complete nombre y correo electrónico.', type: 'error' }}));
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tenant: user.id_tenant,
          name: contactData.name,
          email: contactData.email,
          action: action
        })
      });

      if (!res.ok) throw new Error();

      if (action === 'delete') {
        setContactData({ name: '', email: '' });
        setHasContact(false);
        window.dispatchEvent(new CustomEvent('finance-contact-updated'));
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Contacto financiero eliminado.', type: 'success' }}));
      } else {
        setHasContact(true);
        window.dispatchEvent(new CustomEvent('finance-contact-updated'));
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Contacto financiero guardado correctamente.', type: 'success' }}));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Error al actualizar configuración.', type: 'error' }}));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 flex justify-center"><BrandSpinner size="sm" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          <i className="fa-solid fa-file-invoice-dollar text-lg"></i>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Responsable de Finanzas</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define la persona o departamento que recibirá alertas sobre gastos, compras o notificaciones administrativas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre / Departamento</label>
          <input
            type="text"
            value={contactData.name}
            onChange={(e) => setContactData(p => ({ ...p, name: e.target.value }))}
            placeholder="Ej: Departamento Contable, María Pérez..."
            className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico *</label>
          <input
            type="email"
            value={contactData.email}
            onChange={(e) => setContactData(p => ({ ...p, email: e.target.value }))}
            placeholder="contabilidad@miempresa.com"
            className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-3">
        <button
          onClick={() => handleSave('save')}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-70 flex items-center gap-2"
        >
          {saving ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-floppy-disk"></i>}
          Guardar Contacto
        </button>
        
        {hasContact && (
          <button
            onClick={() => handleSave('delete')}
            disabled={saving}
            className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 text-sm font-semibold rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            <i className="fa-solid fa-trash-can"></i>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL DE LA VISTA ---
const TenantIntegrations: React.FC = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Escuchar evento global para mostrar toasts desde componentes hijos
  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      setToast(event.detail);
    };
    window.addEventListener('showToast' as any, handleShowToast);
    return () => window.removeEventListener('showToast' as any, handleShowToast);
  }, []);

  // Solo owner puede acceder
  if (!user?.is_owner) {
    return <Navigate to="/app/account-settings?tab=profile" replace />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BrandSpinner size="xl" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* 1. SECCIÓN DE CORREO CORPORATIVO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6 lg:p-8 mb-6 rounded-xl shadow-sm">
        <TenantEmailSettings user={user} />
      </div>

      {/* 2. SECCIÓN DE RESPONSABLE FINANCIERO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6 lg:p-8 mb-6 rounded-xl shadow-sm">
        <TenantFinanceSettings user={user} />
      </div>

      {/* Info footer */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
          <i className="fa-solid fa-info-circle text-slate-400 mt-0.5 w-5 flex-shrink-0"></i>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">¿Qué es la configuración del Workspace?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Estas configuraciones afectan a toda la organización. El correo corporativo se utiliza para enviar 
              cotizaciones, alertas y notificaciones automáticas. Los roles financieros sirven para enrutar notificaciones internas. Solo los administradores y propietarios pueden modificar estas configuraciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantIntegrations;