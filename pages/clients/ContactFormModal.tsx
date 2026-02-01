import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ClientContact, ClientCompany } from '../../types';
import Toast from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../services/apiClient';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<ClientContact>;
  onSuccess?: (contact: ClientContact) => void;
  preselectedCompanyId?: string;
  companies?: ClientCompany[];
}

const ContactFormModal: React.FC<ContactFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialData,
  onSuccess,
  preselectedCompanyId,
  companies = [],
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<ClientContact>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    id_client_company: preselectedCompanyId || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [companiesList, setCompaniesList] = useState<ClientCompany[]>(companies || []);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const didRequestCompaniesRef = useRef(false);

  // Inicializar formulario SOLO cuando el modal se abre, no en cada cambio
  useEffect(() => {
    if (!isOpen) return; // Solo ejecutar cuando el modal está abierto

    if (mode === 'edit' && initialData) {
      setFormData({
        id_contact: initialData.id_contact,
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        position: initialData.position || '',
        id_client_company: initialData.id_client_company || '',
      });
    } else if (mode === 'create') {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: '',
        // Pre-llenar empresa desde initialData o preselectedCompanyId
        id_client_company: initialData?.id_client_company || preselectedCompanyId || '',
      });
    }
  }, [isOpen]); // SOLO depende de isOpen, no de initialData ni preselectedCompanyId

  const ensureCompaniesLoaded = async () => {
    // Si ya hay empresas, o ya estamos cargando, o no hay usuario válido, no hacer nada
    if ((companiesList && companiesList.length > 0) || loadingCompanies || !user?.id_tenant || !user?.id_user) return;
    if (didRequestCompaniesRef.current) return;
    didRequestCompaniesRef.current = true;
    try {
      setLoadingCompanies(true);
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Error al cargar empresas');
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      
      // Soportar unified_response.rows además de array plano
      let companiesArray: any[] = [];
      if (Array.isArray(data)) {
        const unified = data.find(item => item && typeof item === 'object' && 'unified_response' in item);
        if (unified?.unified_response?.rows && Array.isArray(unified.unified_response.rows)) {
          companiesArray = unified.unified_response.rows;
        } else {
          companiesArray = data;
        }
      } else if (data?.unified_response?.rows && Array.isArray(data.unified_response.rows)) {
        companiesArray = data.unified_response.rows;
      }
      
      const valid = companiesArray.filter((c: any) => c && c.id_client_company);
      setCompaniesList(valid);
    } catch (err) {
      setToast({ message: 'No se pudieron cargar las empresas.', type: 'error' });
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Cargar empresas al abrir el modal si no vienen por props
  useEffect(() => {
    if (!isOpen) return;
    if (companies && companies.length > 0) {
      setCompaniesList(companies);
      return;
    }
    // Lazy: solicitar empresas una sola vez por apertura
    ensureCompaniesLoaded();
  }, [isOpen, companies]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validaciones básicas
      if (!formData.first_name?.trim()) {
        setToast({ message: 'El nombre es requerido.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_client_company) {
        setToast({ message: 'Selecciona una empresa.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!user?.id_tenant || !user?.id_user) {
        setToast({ message: 'Usuario no autenticado.', type: 'error' });
        setSubmitting(false);
        return;
      }

      // Conectar al backend
      const endpoint = mode === 'edit' ? 'update' : '';
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/${endpoint}`;

      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });

      if (!response.ok) throw new Error('Error al guardar contacto');

      const result = await response.json();
      // El backend devuelve un array, extraer el primer elemento
      const savedContact = Array.isArray(result) ? result[0] : result;
      setToast({ message: mode === 'create' ? 'Contacto creado exitosamente.' : 'Contacto actualizado exitosamente.', type: 'success' });
      
      onSuccess?.(savedContact);
      onClose();
    } catch (error: any) {
      setToast({ message: error.message || 'Error al procesar el contacto.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'create' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'}`}>
              <i className={`fa-solid ${mode === 'create' ? 'fa-user-plus' : 'fa-user-pen'}`}></i>
            </div>
            {mode === 'create' ? 'Nuevo Contacto' : 'Editar Contacto'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Empresa <span className="text-red-500">*</span>
            </label>
            <select
              name="id_client_company"
              required
              value={formData.id_client_company || ''}
              onChange={handleInputChange}
              onFocus={ensureCompaniesLoaded}
              onClick={ensureCompaniesLoaded}
              disabled={!!(preselectedCompanyId && mode === 'create')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Selecciona empresa</option>
              {loadingCompanies ? (
                <option value="" disabled>Cargando empresas...</option>
              ) : companiesList.map(c => (
                <option key={c.id_client_company} value={c.id_client_company}>
                  {c.name_company}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                required
                value={formData.first_name || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="Juan"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Apellido
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Cargo / Posición
            </label>
            <input
              type="text"
              name="position"
              value={formData.position || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Gerente de TI"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="nombre@empresa.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Teléfono
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="+593 ..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              {mode === 'create' ? 'Crear Contacto' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default ContactFormModal;
