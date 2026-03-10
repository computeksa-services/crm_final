import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Quote, ClientCompany, ClientContact } from '../types';
import Toast from './Toast';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import CompanyForm from '../pages/clients/CompanyForm';
import ContactForm from '../pages/clients/ContactForm';
import { BrandSpinner } from './AppLoaders';

interface QuoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<Quote>;
  onSuccess?: (quote: Quote) => void;
  companies?: ClientCompany[];
  contacts?: ClientContact[];
}

const QuoteFormModal: React.FC<QuoteFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
  companies = [],
  contacts = [],
}) => {
  const { user } = useAuth();
  const mode = initialData?.id_cotizacion ? 'edit' : 'create';

  const [formData, setFormData] = useState<Partial<Quote>>({
    nombre_cotizacion: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    id_client_company: '',
    id_contact: '',
    id_quote_status: '',
    total: '',
    tiempo_entrega: '',
    garantia: '',
    validez_oferta: '',
    nota: '',
    mensaje: '',
    correos_adicionales: '',
    is_private: false,
  });

  const [companiesList, setCompaniesList] = useState<ClientCompany[]>(companies || []);
  const [contactsList, setContactsList] = useState<ClientContact[]>(contacts || []);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const didLoadDataRef = useRef(false);
  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [condicionOption, setCondicionOption] = useState<string>('CONTADO');

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        id_cotizacion: initialData.id_cotizacion,
        nombre_cotizacion: initialData.nombre_cotizacion || '',
        fecha_emision: initialData.fecha_emision?.split('T')[0] || '',
        id_client_company: initialData.id_client_company || '',
        id_contact: initialData.id_contact || '',
        id_quote_status: initialData.id_quote_status || '',
        total: initialData.total || '',
        tiempo_entrega: initialData.tiempo_entrega || '',
        garantia: initialData.garantia || '',
        validez_oferta: initialData.validez_oferta || '',
        nota: initialData.nota || '',
        mensaje: initialData.mensaje || '',
        correos_adicionales: initialData.correos_adicionales || '',
        condicion_pago: initialData.condicion_pago || '',
        is_private: initialData.is_private || false,
      });
      const options = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS'];
      const val = initialData.condicion_pago || '';
      if (val && options.includes(val.toUpperCase())) {
        setCondicionOption(val.toUpperCase());
      } else if (val) {
        setCondicionOption('OTRO');
      } else {
        setCondicionOption('CONTADO');
      }
    }
  }, [isOpen, initialData]);

  const ensureDataLoaded = async () => {
    if (didLoadDataRef.current || !user?.id_tenant || !user?.id_user) return;
    if (companiesList.length > 0 && contactsList.length > 0) return;

    setLoadingData(true);
    didLoadDataRef.current = true;

    try {
      const [companiesRes, contactsRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
      ]);

      const parseList = async (res: Response) => {
        if (!res.ok) return [];
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];
        return Array.isArray(data) ? data : [];
      };

      const [compData, contData] = await Promise.all([parseList(companiesRes), parseList(contactsRes)]);
      setCompaniesList(compData);
      setContactsList(contData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      didLoadDataRef.current = false;
      return;
    }
    ensureDataLoaded();
  }, [isOpen, user?.id_tenant, user?.id_user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.nombre_cotizacion?.trim()) {
        setToast({ message: 'El nombre de la cotización es requerido.', type: 'error' });
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

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id_tenant: user?.id_tenant,
          id_user: user?.id_user,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error al guardar la cotización');
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      const updatedQuote = Array.isArray(data) ? data[0] : data;
      setToast({ message: 'Cotización guardada correctamente.', type: 'success' });
      onSuccess?.(updatedQuote);
      setTimeout(() => onClose(), 300);
    } catch (err: any) {
      setToast({ message: err.message || 'Error en el proceso', type: 'error' });
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
            {mode === 'create' ? 'Crear Cotización' : 'Editar Cotización'}
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
              <select
                name="id_client_company"
                required
                value={formData.id_client_company || ''}
                onChange={handleInputChange}
                disabled={loadingData}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-50"
              >
                <option value="">{loadingData ? 'Cargando...' : 'Selecciona empresa'}</option>
                {companiesList.map(c => (
                  <option key={c.id_client_company} value={c.id_client_company}>
                    {c.name_company}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCompanyFormOpen(true)}
                className="text-xs text-brand-600 font-semibold hover:underline mt-1"
              >
                + Nueva empresa
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Contacto <span className="text-red-500">*</span>
              </label>
              <select
                name="id_contact"
                required
                value={formData.id_contact || ''}
                onChange={handleInputChange}
                disabled={loadingData}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-50"
              >
                <option value="">{loadingData ? 'Cargando...' : 'Selecciona contacto'}</option>
                {contactsList.map(c => (
                  <option key={c.id_contact} value={c.id_contact}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsContactFormOpen(true)}
                className="text-xs text-brand-600 font-semibold hover:underline mt-1"
              >
                + Nuevo contacto
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nombre de Cotización <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre_cotizacion"
              required
              value={formData.nombre_cotizacion || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              placeholder="Ej. Cotización Software 2025"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Fecha Emisión
              </label>
              <input
                type="date"
                name="fecha_emision"
                value={formData.fecha_emision || ''}
                readOnly
                disabled
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Total
              </label>
              <input
                type="number"
                name="total"
                value={formData.total || ''}
                readOnly
                disabled
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Validez Oferta (días)
              </label>
              <input
                type="text"
                name="validez_oferta"
                value={formData.validez_oferta || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Tiempo Entrega
              </label>
              <input
                type="text"
                name="tiempo_entrega"
                value={formData.tiempo_entrega || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="15 días"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Garantía
              </label>
              <input
                type="text"
                name="garantia"
                value={formData.garantia || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="1 año"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condición de Pago</label>
              <select
                value={condicionOption}
                onChange={(e) => {
                  const v = e.target.value;
                  setCondicionOption(v);
                  if (v !== 'OTRO') {
                    setFormData(prev => ({ ...prev, condicion_pago: v }));
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              >
                <option value="CONTADO">Contado</option>
                <option value="15 DÍAS">15 días</option>
                <option value="30 DÍAS">30 días</option>
                <option value="60 DÍAS">60 días</option>
                <option value="90 DÍAS">90 días</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            {condicionOption === 'OTRO' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Especificar</label>
                <input
                  type="text"
                  name="condicion_pago"
                  value={(formData.condicion_pago as string) || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="Ej. 45 días, Contraentrega, etc."
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nota
            </label>
            <textarea
              name="nota"
              value={formData.nota || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Mensaje
            </label>
            <textarea
              name="mensaje"
              value={formData.mensaje || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Mensaje para el cliente..."
              rows={5}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Correos adicionales (CC/BCC)
            </label>
            <textarea
              name="correos_adicionales"
              value={formData.correos_adicionales as string}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="email1@dominio.com, email2@dominio.com"
              rows={2}
            />
            <p className="text-[11px] text-slate-500 ml-1">Separa múltiples correos con coma.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_private"
              id="is_private"
              checked={(formData.is_private as boolean) || false}
              onChange={handleInputChange}
              className="w-4 h-4 rounded border-slate-200"
            />
            <label htmlFor="is_private" className="text-sm text-slate-700 font-medium">
              Cotización privada (no sigue permisos compartidos)
            </label>
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
              {submitting ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-check"></i>}
              {mode === 'create' ? 'Crear Cotización' : 'Guardar Cambios'}
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

      {isCompanyFormOpen && (
        <CompanyForm
          isOpen={isCompanyFormOpen}
          onClose={() => setIsCompanyFormOpen(false)}
          mode="create"
          onSuccess={company => {
            setCompaniesList(prev => [...prev, company]);
            setFormData(prev => ({ ...prev, id_client_company: company.id_client_company }));
          }}
        />
      )}

      {isContactFormOpen && (
        <ContactForm
          isOpen={isContactFormOpen}
          onClose={() => setIsContactFormOpen(false)}
          onSuccess={contact => {
            setContactsList(prev => [...prev, contact]);
            setFormData(prev => ({ ...prev, id_contact: contact.id_contact }));
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default QuoteFormModal;

