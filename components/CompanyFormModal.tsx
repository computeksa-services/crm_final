import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ClientCompany } from '../types';
import Toast from './Toast';
import { useAuth } from '../contexts/AuthContext';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<ClientCompany>;
  onSuccess?: (company: ClientCompany) => void;
}

// Datos de referencia (mismo que en ClientCompaniesList y ClientCompanyDetail)
const COUNTRIES = [
  { id: 'AF', name: 'Afganistán' }, { id: 'AL', name: 'Albania' }, { id: 'DE', name: 'Alemania' },
  { id: 'AD', name: 'Andorra' }, { id: 'AO', name: 'Angola' }, { id: 'AR', name: 'Argentina' },
  { id: 'AU', name: 'Australia' }, { id: 'AT', name: 'Austria' }, { id: 'BE', name: 'Bélgica' },
  { id: 'BO', name: 'Bolivia' }, { id: 'BR', name: 'Brasil' }, { id: 'CA', name: 'Canadá' },
  { id: 'CL', name: 'Chile' }, { id: 'CN', name: 'China' }, { id: 'CO', name: 'Colombia' },
  { id: 'CR', name: 'Costa Rica' }, { id: 'CU', name: 'Cuba' }, { id: 'EC', name: 'Ecuador' },
  { id: 'SV', name: 'El Salvador' }, { id: 'ES', name: 'España' }, { id: 'US', name: 'Estados Unidos' },
  { id: 'FR', name: 'Francia' }, { id: 'GT', name: 'Guatemala' }, { id: 'HN', name: 'Honduras' },
  { id: 'IT', name: 'Italia' }, { id: 'MX', name: 'México' }, { id: 'NI', name: 'Nicaragua' },
  { id: 'PA', name: 'Panamá' }, { id: 'PY', name: 'Paraguay' }, { id: 'PE', name: 'Perú' },
  { id: 'PR', name: 'Puerto Rico' }, { id: 'DO', name: 'República Dominicana' }, { id: 'UY', name: 'Uruguay' },
  { id: 'VE', name: 'Venezuela' },
];

const COMPANY_LABELS = [
  'Cliente', 'Prospecto (Lead)', 'Prospecto Interesado', 'Poco Interesado', 'Ex-Cliente',
];

const COMPANY_TYPES = [
  'Tecnología y Software', 'Electrónica y Hardware', 'Finanzas y Banca', 'Servicios Legales',
  'Salud y Medicina', 'Educación', 'Construcción e Inmobiliaria', 'Manufactura y Producción',
  'Retail y Comercio', 'Logística y Transporte', 'Alimentos y Bebidas', 'Turismo y Hotelería',
  'Energía y Minería', 'Marketing y Publicidad', 'Telecomunicaciones', 'Agricultura y Pesca', 'Seguros'
];

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialData,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<ClientCompany>>({
    id_type: 'RUC',
    id_number: '',
    name_company: '',
    id_country: 'EC',
    city: '',
    address: '',
    id_company_type: '',
    id_label: '',
    email_company: '',
    phone_company: '',
    website: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Inicializar formulario SOLO cuando el modal se abre
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialData) {
      setFormData({
        id_client_company: initialData.id_client_company,
        id_type: initialData.id_type || 'RUC',
        id_number: initialData.id_number || '',
        name_company: initialData.name_company || '',
        id_country: initialData.id_country || 'EC',
        city: initialData.city || '',
        address: initialData.address || '',
        id_company_type: initialData.id_company_type || initialData.company_type_name || '',
        id_label: initialData.id_label || initialData.label_name || '',
        email_company: initialData.email_company || '',
        phone_company: initialData.phone_company || '',
        website: initialData.website || '',
      });
    } else if (mode === 'create') {
      setFormData({
        id_type: 'RUC',
        id_number: '',
        name_company: '',
        id_country: 'EC',
        city: '',
        address: '',
        id_company_type: '',
        id_label: '',
        email_company: '',
        phone_company: '',
        website: '',
      });
    }
  }, [isOpen]); // SOLO depende de isOpen

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
      if (!formData.id_number?.trim()) {
        setToast({ message: 'El número de identificación es requerido.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.name_company?.trim()) {
        setToast({ message: 'El nombre de la empresa es requerido.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_country) {
        setToast({ message: 'Selecciona un país.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.city?.trim()) {
        setToast({ message: 'La ciudad es requerida.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_company_type) {
        setToast({ message: 'Selecciona un tipo de empresa.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_label) {
        setToast({ message: 'Selecciona una etiqueta.', type: 'error' });
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
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });

      if (!response.ok) throw new Error('Error al guardar empresa');

      const result = await response.json();
      // El backend devuelve un array, extraer el primer elemento
      const savedCompany = Array.isArray(result) ? result[0] : result;
      setToast({ message: mode === 'create' ? 'Empresa creada exitosamente.' : 'Empresa actualizada exitosamente.', type: 'success' });
      
      onSuccess?.(savedCompany);
      onClose();
    } catch (error: any) {
      setToast({ message: 'Error al procesar la empresa.', type: 'error' });
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
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'create' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'}`}>
              <i className={`fa-solid ${mode === 'create' ? 'fa-building-circle-arrow-right' : 'fa-building-circle-check'}`}></i>
            </div>
            {mode === 'create' ? 'Nueva Empresa' : 'Editar Empresa'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Tipo ID y Número */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Tipo ID <span className="text-red-500">*</span>
              </label>
              <select
                name="id_type"
                required
                value={formData.id_type || 'RUC'}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none"
              >
                <option value="RUC">RUC</option>
                <option value="CI">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="IDENTIFICACION DEL EXTERIOR">ID Exterior</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Número <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="id_number"
                required
                value={formData.id_number || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="17900..."
              />
            </div>
          </div>

          {/* Razón Social */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Razón Social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name_company"
              required
              value={formData.name_company || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              placeholder="Ej. Corporación Favorita"
            />
          </div>

          {/* País y Ciudad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                País <span className="text-red-500">*</span>
              </label>
              <select
                name="id_country"
                required
                value={formData.id_country || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              >
                <option value="">Seleccionar país</option>
                {COUNTRIES.map(country => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                required
                value={formData.city || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="Quito"
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Av. Principal 123 y Secundaria"
            />
          </div>

          {/* Tipo de Empresa y Etiqueta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Tipo de Empresa <span className="text-red-500">*</span>
              </label>
              <select
                name="id_company_type"
                required
                value={formData.id_company_type || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              >
                <option value="">Seleccionar tipo</option>
                {COMPANY_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Etiqueta <span className="text-red-500">*</span>
              </label>
              <select
                name="id_label"
                required
                value={formData.id_label || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              >
                <option value="">Seleccionar etiqueta</option>
                {COMPANY_LABELS.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Email y Website */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Email Corp.
              </label>
              <input
                type="email"
                name="email_company"
                value={formData.email_company || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                placeholder="info@empresa.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Website
              </label>
              <input
                type="text"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                placeholder="empresa.com"
              />
            </div>
          </div>

          {/* Teléfono */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone_company"
              value={formData.phone_company || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
              placeholder="022..."
            />
          </div>

          {/* Botones */}
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
              {mode === 'create' ? 'Crear Empresa' : 'Guardar Cambios'}
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

export default CompanyFormModal;
