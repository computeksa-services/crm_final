import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ClientCompany } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../services/apiClient';
import { useDataCache } from '../../contexts/DataCacheContext';

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<ClientCompany>;
  onSuccess?: (company: ClientCompany) => void;
  redirectOnCreate?: boolean;
}

interface CompanyLabel {
  id_label: string;
  name: string;
  color?: string;
}

interface CompanyFormData extends Omit<Partial<ClientCompany>, 'id_type' | 'labels'> {
  labels?: CompanyLabel[] | any[];
  id_type?: 'RUC' | 'CI' | 'PASAPORTE' | 'IDENTIFICACION DEL EXTERIOR' | 'OTRO' | '' | undefined;
}

const normalizeIntegerField = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeDecimalField = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeBooleanField = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí';
  }
  return false;
};

const normalizeCompanyFormData = (data?: Partial<ClientCompany>): CompanyFormData => ({
  ...data,
  payment_terms_days: normalizeIntegerField(data?.payment_terms_days ?? data?.billing_details?.payment_terms_days),
  applies_iva: normalizeBooleanField(data?.applies_iva ?? data?.billing_details?.applies_iva),
  iva_percentage: normalizeDecimalField(data?.iva_percentage ?? data?.billing_details?.iva_percentage),
  preferred_payment_method: data?.preferred_payment_method || data?.billing_details?.preferred_payment_method || '',
  bank_details: data?.bank_details || data?.billing_details?.bank_details || ''
});

const CompanyForm: React.FC<CompanyFormProps> = ({ isOpen, onClose, mode, initialData, onSuccess, redirectOnCreate = true }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { countries = [], companyTypes = [], companySizes = [], companyLabelsMap, invalidateCompanies } = useDataCache();
  
  const [customLabels, setCustomLabels] = useState<CompanyLabel[]>([]);
  const [formData, setFormData] = useState<CompanyFormData>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [showFinancialFields, setShowFinancialFields] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // Unsaved changes detection
  const [initialFormData, setInitialFormData] = useState<CompanyFormData | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Cerrar menú de etiquetas al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validación de Cédula Ecuatoriana
  const validateCedula = (cedula: string): boolean => {
    if (!/^\d{10}$/.test(cedula)) return false;
    const provincia = parseInt(cedula.substring(0, 2));
    if (provincia < 1 || provincia > 24) return false;
    const tercerDigito = parseInt(cedula[2]);
    if (tercerDigito > 5) return false;
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let valor = parseInt(cedula[i]) * coeficientes[i];
      if (valor > 9) valor -= 9;
      suma += valor;
    }
    const resultado = (10 - (suma % 10)) % 10;
    return resultado === parseInt(cedula[9]);
  };

  // Inicializar formulario
  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialData) {
      const dataWithLabels = initialData as any;
      const formDataNew = {
        ...normalizeCompanyFormData(initialData),
        id_company_size: initialData.id_company_size || (initialData as any).company_size || '',
        labels: Array.isArray(dataWithLabels.labels)
          ? dataWithLabels.labels.map(resolveLabel)
          : []
      };
      setFormData(formDataNew);
      // Guardar estado inicial para detectar cambios
      setInitialFormData({ ...formDataNew });
    } else {
      const formDataNew: CompanyFormData = {
        id_type: '' as any,
        id_country: 'EC',
        id_company_size: '',
        labels: [],
        id_number: '', 
        name_company: '', 
        razon_social: '', 
        city: '', 
        address: '',
        payment_terms_days: undefined,
        applies_iva: false,
        iva_percentage: undefined,
        preferred_payment_method: '',
        bank_details: ''
      };
      setFormData(formDataNew);
      // Guardar estado inicial para detectar cambios
      setInitialFormData({ ...formDataNew });
    }
    setLabelMenuOpen(false);
    setLabelQuery('');
    setShowFinancialFields(false);
  }, [isOpen, mode, initialData]);

  // Detectar cambios no guardados
  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData || !isOpen) return false;
    
    // Comparar campos del formulario
    const formChanged = Object.keys(initialFormData).some(key => {
      if (key === 'labels') {
        // Comparar etiquetas por id_label
        const initialLabels = ((initialFormData.labels as any[]) || []).map(l => resolveLabel(l).id_label).sort();
        const currentLabels = ((formData.labels as any[]) || []).map(l => resolveLabel(l).id_label).sort();
        return JSON.stringify(initialLabels) !== JSON.stringify(currentLabels);
      }
      return formData[key as keyof CompanyFormData] !== initialFormData[key as keyof CompanyFormData];
    });
    
    return formChanged;
  }, [formData, initialFormData, isOpen]);

  // Manejar intento de cierre
  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Confirmar descarte de cambios
  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    setInitialFormData(null);
    onClose();
  }, [onClose]);

  // Manejar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (labelMenuOpen) {
          // Cerrar dropdown de etiquetas primero
          setLabelMenuOpen(false);
        } else if (showDiscardConfirm) {
          // Cerrar modal de confirmación
          setShowDiscardConfirm(false);
        } else {
          // Intentar cerrar el modal
          handleAttemptClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, labelMenuOpen, showDiscardConfirm, handleAttemptClose]);

  function resolveLabel(label: any): CompanyLabel {
    const id = typeof label === 'string' ? label : (label.id_label || label.id || '');
    const found = companyLabelsMap[id] || customLabels.find(l => l.id_label === id);
    return { id_label: id, name: found?.name || label.name || id, color: found?.color || '#3B82F6' };
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const { name } = target;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const checked = target.checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        ...(name === 'applies_iva' && !checked ? { iva_percentage: undefined } : {})
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: target.value }));
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {
      ...formData,
      payment_terms_days: normalizeIntegerField(formData.payment_terms_days),
      applies_iva: normalizeBooleanField(formData.applies_iva),
      iva_percentage: normalizeBooleanField(formData.applies_iva)
        ? normalizeDecimalField(formData.iva_percentage)
        : undefined,
      preferred_payment_method: formData.preferred_payment_method?.trim() || undefined,
      bank_details: formData.bank_details?.trim() || undefined,
      id_tenant: user?.id_tenant,
      id_user: user?.id_user
    };

    if (!payload.id_type) delete payload.id_type;
    if (payload.payment_terms_days === undefined) delete payload.payment_terms_days;
    if (payload.iva_percentage === undefined) delete payload.iva_percentage;
    if (!payload.preferred_payment_method) delete payload.preferred_payment_method;
    if (!payload.bank_details) delete payload.bank_details;

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_company?.trim()) {
      return setToast({ message: 'Nombre de empresa requerido', type: 'error' });
    }
    
    const idNum = formData.id_number?.trim() || '';
    if (idNum && formData.id_type) {
      if (formData.id_type === 'RUC') {
        if (!/^\d{13}$/.test(idNum) || !idNum.endsWith('001')) {
          return setToast({ message: 'RUC inválido: debe tener 13 dígitos y terminar en 001', type: 'error' });
        }
      } else if (formData.id_type === 'CI') {
        if (!validateCedula(idNum)) {
          return setToast({ message: 'Cédula inválida', type: 'error' });
        }
      }
    }

    setSubmitting(true);
    try {
      const labelsArray = ((formData.labels as any[]) || []).map(resolveLabel);
      
      // Crear etiquetas temporales
      const finalLabelIds: string[] = await Promise.all(labelsArray.map(async (lbl) => {
        if (lbl.id_label && lbl.id_label.startsWith('temp_')) {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels`, {
            method: 'POST',
            body: JSON.stringify({ 
              name: lbl.name, 
              color: lbl.color || '#3B82F6', 
              id_tenant: user?.id_tenant, 
              id_user: user?.id_user 
            })
          });
          const created = await res.json();
          return (Array.isArray(created) ? created[0] : created).id_label;
        }
        return lbl.id_label || '';
      }));
      
      const filteredLabelIds = finalLabelIds.filter(id => id && String(id).trim() !== '');

      const endpoint = mode === 'edit' ? 'update' : '';
      const payload = {
        ...buildPayload(),
        labels: filteredLabelIds
      };
      
      const response = await apiFetch(
        `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/${endpoint}`, 
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) throw new Error("Error al guardar la empresa");
      
      const result = await response.json();
      const savedCompany = Array.isArray(result) ? result[0] : result;
      
      setToast({
        message: mode === 'create'
          ? (redirectOnCreate ? 'Empresa creada, redirigiendo...' : 'Empresa creada.')
          : 'Empresa actualizada.',
        type: 'success'
      });
      
      await invalidateCompanies(savedCompany);
      onSuccess?.(savedCompany);
      
      if (mode === 'create' && savedCompany?.id_client_company && redirectOnCreate) {
        setTimeout(() => {
          navigate(`/app/client-companies/${savedCompany.id_client_company}`);
          onClose();
        }, 1500);
      } else {
        setSubmitting(false);
        onClose();
      }
    } catch (err) {
      setToast({ 
        message: (err as Error).message || 'Error al procesar la solicitud', 
        type: 'error' 
      });
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 backdrop-blur-sm p-4 sm:p-6 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) handleAttemptClose(); }}
    >
      {/* Contenedor del Modal */}
      <div className="w-full max-w-[720px] bg-white rounded-xl shadow-2xl border border-zinc-200/60 flex flex-col overflow-hidden">
        
        {/* Header Minimalista */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            {mode === 'create' ? 'Nueva Empresa' : 'Editar Empresa'}
          </h2>
          <button 
            onClick={handleAttemptClose}
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <i className="fa-solid fa-xmark text-[13px]"></i>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Contenedor scrolleable */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            
            {/* Fila 1: Nombres */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Nombre de la Empresa <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="name_company"
                  required 
                  value={formData.name_company || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="Ej. Computeksa S.A."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Razón Social
                </label>
                <input 
                  type="text" 
                  name="razon_social"
                  value={formData.razon_social || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="Nombre legal completo"
                />
              </div>
            </div>

            {/* Fila 2: Clasificación e Identificación */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select 
                  name="id_company_type"
                  required 
                  value={formData.id_company_type || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2020%2020%27%3e%3cpath%20stroke=%27%239ca3af%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20stroke-width=%271.5%27%20d=%27M6%208l4%204%204-4%27/%3e%3c/svg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  <option value="" disabled>Elegir...</option>
                  {companyTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Tamaño
                </label>
                <select 
                  name="id_company_size"
                  value={formData.id_company_size || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2020%2020%27%3e%3cpath%20stroke=%27%239ca3af%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20stroke-width=%271.5%27%20d=%27M6%208l4%204%204-4%27/%3e%3c/svg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  <option value="" disabled>Elegir...</option>
                  {companySizes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Tipo ID
                </label>
                <select 
                  name="id_type"
                  value={formData.id_type || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2020%2020%27%3e%3cpath%20stroke=%27%239ca3af%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20stroke-width=%271.5%27%20d=%27M6%208l4%204%204-4%27/%3e%3c/svg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  <option value="" disabled>Elegir...</option>
                  <option value="RUC">RUC</option>
                  <option value="CI">Cédula</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="ID. DEL EXTERIOR">ID. DEL EXTERIOR</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Número ID
                </label>
                <input 
                  type="text" 
                  name="id_number"
                  value={formData.id_number || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] font-mono text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="17900...001"
                />
              </div>
            </div>

            {/* Fila 3: Ubicación y Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  País <span className="text-red-500">*</span>
                </label>
                <select 
                  name="id_country"
                  required 
                  value={formData.id_country || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20fill=%27none%27%20viewBox=%270%200%2020%2020%27%3e%3cpath%20stroke=%27%239ca3af%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20stroke-width=%271.5%27%20d=%27M6%208l4%204%204-4%27/%3e%3c/svg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  <option value="">Seleccionar...</option>
                  {countries.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Ciudad
                </label>
                <input 
                  type="text" 
                  name="city"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="Ej. Quito"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Teléfono
                </label>
                <input 
                  type="tel" 
                  name="phone_company"
                  value={formData.phone_company || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="02 2..."
                />
              </div>
            </div>

            {/* Fila 4: Dirección y Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Dirección Física
                </label>
                <input 
                  type="text" 
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="Av. Principal y Calle Secundaria..."
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Email Corporativo
                </label>
                <input 
                  type="email" 
                  name="email_company"
                  value={formData.email_company || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="info@empresa.com"
                />
              </div>
            </div>

            {/* Fila 5: Website y Etiquetas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Sitio Web
                </label>
                <input 
                  type="text" 
                  name="website"
                  value={formData.website || ''}
                  onChange={handleInputChange}
                  className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400" 
                  placeholder="www.empresa.com"
                />
              </div>
              
              <div className="md:col-span-2 relative" ref={labelDropdownRef}>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                  Etiquetas / Segmentación
                </label>
                {/* Input Multi-Select */}
                <div 
                  className="w-full min-h-[38px] bg-white border border-zinc-300 rounded-md px-2 py-1.5 flex flex-wrap gap-1.5 items-center shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 cursor-text"
                  onClick={() => setLabelMenuOpen(true)}
                >
                  {/* Etiquetas Seleccionadas */}
                  {((formData.labels as any[]) || []).map((l, idx) => {
                    const label = resolveLabel(l);
                    const key = label.id_label || `${label.name}_${idx}`;
                    const color = label.color || '#3B82F6';
                    const bgColor = `${color}15`;
                    const borderColor = `${color}30`;
                    
                    return (
                      <span 
                        key={key} 
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border" 
                        style={{ backgroundColor: bgColor, color: color, borderColor: borderColor }}
                      >
                        {label.name}
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ 
                              ...prev, 
                              labels: (prev.labels as any[]).filter(x => resolveLabel(x).id_label !== label.id_label) 
                            }));
                          }}
                          className="hover:opacity-70"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </span>
                    );
                  })}

                  {/* Input Real de Búsqueda */}
                  <input 
                    type="text" 
                    value={labelQuery}
                    onChange={(e) => setLabelQuery(e.target.value)}
                    onFocus={() => setLabelMenuOpen(true)}
                    className="flex-1 bg-transparent border-none outline-none text-[13px] min-w-[120px] text-zinc-900 placeholder:text-zinc-400" 
                    placeholder={!formData.labels?.length ? "Buscar o crear..." : ""}
                  />
                </div>

                {/* Dropdown de Etiquetas (hacia arriba) */}
                {labelMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-zinc-200 rounded-lg shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                    {(() => {
                      const filtered = [
                        ...Object.entries(companyLabelsMap).map(([id_label, v]) => ({ 
                          id_label, 
                          name: v.name, 
                          color: v.color 
                        })),
                        ...customLabels
                      ].filter(l => 
                        l.id_label &&
                        l.name &&
                        l.name.toLowerCase().includes(labelQuery.toLowerCase()) &&
                        !((formData.labels as any[]) || []).some(sl => resolveLabel(sl).id_label === l.id_label)
                      );

                      return (
                        <>
                          {filtered.map((l, idx) => {
                            const key = l.id_label || `${l.name}_${idx}`;
                            const color = l.color || '#3B82F6';
                            
                            return (
                              <button 
                                key={key} 
                                type="button" 
                                onClick={() => {
                                  setFormData(prev => {
                                    const prevLabels = (prev.labels as any[]) || [];
                                    if (prevLabels.some(x => resolveLabel(x).id_label === l.id_label)) return prev;
                                    return { ...prev, labels: [...prevLabels, l] };
                                  });
                                  setLabelQuery('');
                                  setTimeout(() => setLabelMenuOpen(false), 100);
                                }} 
                                className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-2 text-[12px] font-medium text-zinc-700 transition-colors"
                              >
                                <span 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: color }}
                                ></span> 
                                {l.name}
                              </button>
                            );
                          })}
                          
                          {labelQuery && (
                            <div className="border-t border-zinc-100 mt-1 pt-1">
                              <button 
                                type="button" 
                                onClick={() => {
                                  const nl = { 
                                    id_label: `temp_${Date.now()}`, 
                                    name: labelQuery, 
                                    color: '#3B82F6' 
                                  };
                                  if (!nl.id_label || !nl.name) return;
                                  setCustomLabels(p => [...p, nl]);
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    labels: [...(prev.labels as any[]), nl] 
                                  }));
                                  setLabelQuery('');
                                  setLabelMenuOpen(false);
                                }} 
                                className="w-full text-left px-3 py-1.5 bg-blue-50/50 hover:bg-blue-50 text-blue-600 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
                              >
                                <i className="fa-solid fa-plus text-[10px]"></i> 
                                Crear etiqueta "{labelQuery}"
                              </button>
                            </div>
                          )}

                          {filtered.length === 0 && !labelQuery && (
                            <div className="px-3 py-2 text-xs text-zinc-400 text-center italic">
                              Escribe para buscar o crear...
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-zinc-200 rounded-lg bg-zinc-50/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowFinancialFields(prev => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-100/70 transition-colors"
              >
                <div>
                  <p className="text-[12px] font-semibold text-zinc-800">Datos financieros</p>
                  <p className="text-[11px] text-zinc-500">Despliega esta sección para completar información de pago del cliente.</p>
                </div>
                <i className={`fa-solid fa-chevron-down text-[12px] text-zinc-400 transition-transform ${showFinancialFields ? 'rotate-180' : ''}`}></i>
              </button>

              {showFinancialFields && (
                <div className="px-4 pb-4 border-t border-zinc-200 bg-white space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                        Días de plazo para el pago
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        name="payment_terms_days"
                        value={formData.payment_terms_days ?? ''}
                        onChange={handleInputChange}
                        className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400"
                        placeholder="Ej. 30"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                        Método de pago preferido
                      </label>
                      <input
                        type="text"
                        name="preferred_payment_method"
                        value={formData.preferred_payment_method || ''}
                        onChange={handleInputChange}
                        className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400"
                        placeholder="Ej. Transferencia"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="applies_iva"
                          checked={!!formData.applies_iva}
                          onChange={handleInputChange}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block text-[12px] font-medium text-zinc-800">Aplica IVA</span>
                          <span className="block text-[11px] text-zinc-500">Marca esta opción si el cliente paga IVA.</span>
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                        Porcentaje de IVA
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="iva_percentage"
                        value={formData.iva_percentage ?? ''}
                        onChange={handleInputChange}
                        disabled={!formData.applies_iva}
                        className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200"
                        placeholder="Ej. 15.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                      Datos bancarios
                    </label>
                    <textarea
                      name="bank_details"
                      value={formData.bank_details || ''}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400 resize-y"
                      placeholder="Banco, números de cuenta u observaciones"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer / Acciones */}
          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={handleAttemptClose}
              className="h-8 px-4 bg-white border border-zinc-200 text-zinc-600 rounded-md text-[12px] font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="h-8 px-4 bg-zinc-900 text-white rounded-md text-[12px] font-medium hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
              ) : (
                <i className="fa-solid fa-check text-[10px]"></i>
              )}
              {mode === 'create' ? 'Crear Empresa' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>

      {/* Modal de confirmación para descartar cambios */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar. Si sales ahora se perderán."
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        isDestructive={true}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e4e4e7; border-radius: 10px; }
      `}</style>
    </div>,
    document.body
  );
};

export default CompanyForm;
