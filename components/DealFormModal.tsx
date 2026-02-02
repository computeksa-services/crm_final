import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Deal, ClientCompany, ClientContact, DealStatus, DealChannel } from '../types';
import Toast from './Toast';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { apiFetch } from '../services/apiClient';
import CompanyFormModal from '../pages/clients/CompanyFormModal';
import ContactFormModal from '../pages/clients/ContactFormModal';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<Deal>;
  onSuccess?: (deal: Deal) => void;
  companies?: ClientCompany[];
  contacts?: ClientContact[];
}

const DealFormModal: React.FC<DealFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
  companies = [],
  contacts = [],
}) => {
  const { user } = useAuth();
  const { 
    companies: cachedCompanies, 
    contacts: cachedContacts,
    dealStatuses: cachedDealStatuses,
    dealInterests: cachedDealInterests,
    dealChannels: cachedDealChannels,
    loading: cacheLoading 
  } = useDataCache();

  const [formData, setFormData] = useState<Partial<Deal>>({
    nombre_trato: '',
    valor_trato: '',
    descripcion: '',
    id_client_company: '',
    id_contact: '',
    id_deal_status: '',
    id_interest: '',
    channel: '',
  });

  const [companiesList, setCompaniesList] = useState<ClientCompany[]>([]);
  const [contactsList, setContactsList] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modales inline para crear empresa/contacto
  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  // Sincronizar con datos del cache
  useEffect(() => {
    if (cachedCompanies.length > 0) {
      setCompaniesList(cachedCompanies);
    }
  }, [cachedCompanies]);

  useEffect(() => {
    if (cachedContacts.length > 0) {
      setContactsList(cachedContacts);
    }
  }, [cachedContacts]);

  // Inicializar form con datos de edición
  useEffect(() => {
    if (!isOpen || !initialData) return;
    setFormData({
      id_trato: initialData.id_trato,
      nombre_trato: initialData.nombre_trato || '',
      valor_trato: initialData.valor_trato || '',
      descripcion: initialData.descripcion || '',
      id_client_company: initialData.id_client_company ? String(initialData.id_client_company) : '',
      id_contact: initialData.id_contact ? String(initialData.id_contact) : '',
      id_deal_status: initialData.id_deal_status ? String(initialData.id_deal_status) : '',
      id_interest: initialData.id_interest ? String(initialData.id_interest) : '',
      channel: initialData.id_channel
        ? String(initialData.id_channel)
        : initialData.channel
        ? String(initialData.channel)
        : '',
    });
  }, [isOpen, initialData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validaciones básicas
      if (!formData.nombre_trato?.trim()) {
        setToast({ message: 'El nombre del trato es requerido.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_client_company) {
        setToast({ message: 'Selecciona una empresa.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_contact) {
        setToast({ message: 'Selecciona un contacto.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!user?.id_tenant || !user?.id_user) {
        setToast({ message: 'Usuario no autenticado.', type: 'error' });
        setSubmitting(false);
        return;
      }

      // Conectar al backend para edición
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/update`;
      const payload = {
        ...formData,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
      };
      
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar trato');
      const result = await response.json();
      const savedDeal = Array.isArray(result) ? result[0] : result;

      setToast({ message: 'Trato actualizado exitosamente.', type: 'success' });
      onSuccess?.(savedDeal);
      onClose();
    } catch (error: any) {
      setToast({ message: 'Error al procesar el trato.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-100 text-brand-600">
              <i className="fa-solid fa-pen-to-square"></i>
            </div>
            Editar Trato
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Empresa <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="id_client_company"
                  required
                  value={formData.id_client_company || ''}
                  onChange={handleInputChange}
                  disabled={cacheLoading}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60"
                >
                  <option value="">{cacheLoading ? 'Cargando...' : 'Selecciona empresa'}</option>
                  {companiesList.map(c => (
                    <option key={c.id_client_company} value={c.id_client_company}>
                      {c.name_company}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCompanyFormOpen(true)}
                  className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-sm font-bold rounded-xl transition-all border border-emerald-200"
                  title="Crear nueva empresa"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Contacto <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="id_contact"
                  required
                  value={formData.id_contact || ''}
                  onChange={handleInputChange}
                  disabled={cacheLoading}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60"
                >
                  <option value="">{cacheLoading ? 'Cargando...' : 'Selecciona contacto'}</option>
                  {contactsList.map(c => (
                    <option key={c.id_contact} value={c.id_contact}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsContactFormOpen(true)}
                  className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-bold rounded-xl transition-all border border-blue-200"
                  title="Crear nuevo contacto"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nombre del Trato <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre_trato"
              required
              value={formData.nombre_trato || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              placeholder="Ej. Venta de Software"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Valor del Trato
              </label>
              <input
                type="number"
                name="valor_trato"
                value={formData.valor_trato || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="5000.00"
                step="0.01"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Estado del Trato
              </label>
              <select
                name="id_deal_status"
                value={formData.id_deal_status || ''}
                onChange={handleInputChange}
                disabled={cacheLoading}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60"
              >
                <option value="">{cacheLoading ? 'Cargando...' : 'Selecciona estado'}</option>
                {cachedDealStatuses.map(s => (
                  <option key={s.id_status} value={s.id_status}>
                    {s.nombre_estado}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Interés
              </label>
              <select
                name="id_interest"
                value={formData.id_interest || ''}
                onChange={handleInputChange}
                disabled={cacheLoading}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60"
              >
                <option value="">{cacheLoading ? 'Cargando...' : 'Selecciona interés'}</option>
                {cachedDealInterests.map(i => (
                  <option key={i.id_interest} value={i.id_interest}>
                    {i.nombre_interes}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Canal
              </label>
              <select
                name="channel"
                value={formData.channel || ''}
                onChange={handleInputChange}
                disabled={cacheLoading}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-60"
              >
                <option value="">{cacheLoading ? 'Cargando...' : 'Selecciona canal'}</option>
                {cachedDealChannels.map(ch => (
                  <option key={ch.id_channel} value={ch.id_channel}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Notas sobre el trato..."
              rows={3}
            />
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
              Guardar Cambios
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

      {/* Modales inline para crear empresa y contacto */}
      <CompanyFormModal
        isOpen={isCompanyFormOpen}
        onClose={() => setIsCompanyFormOpen(false)}
        onSuccess={(newCompany) => {
          setCompaniesList(prev => [...prev, newCompany]);
          setFormData(prev => ({ ...prev, id_client_company: newCompany.id_client_company }));
          setIsCompanyFormOpen(false);
          setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
        }}
      />

      <ContactFormModal
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        onSuccess={(newContact) => {
          setContactsList(prev => [...prev, newContact]);
          setFormData(prev => ({ ...prev, id_contact: newContact.id_contact }));
          setIsContactFormOpen(false);
          setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
        }}
      />
    </div>,
    document.body
  );
};

export default DealFormModal;
