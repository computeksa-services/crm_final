import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ClientCompany } from '../types';
import Toast from './Toast';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<ClientCompany>;
  onSuccess?: (company: ClientCompany) => void;
}

interface CompanyLabel {
  id_label: string;
  name: string;
  color?: string;
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialData,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [countries, setCountries] = useState<{id: string; name: string}[]>([]);
  const [companyTypes, setCompanyTypes] = useState<{id_company_types: string; name: string}[]>([]);
  const [companyLabels, setCompanyLabels] = useState<CompanyLabel[]>([]);
  const lastLoadedIdRef = useRef<string | undefined>(undefined);
  const [formData, setFormData] = useState<Partial<ClientCompany>>({
    id_type: 'RUC',
    id_number: '',
    name_company: '',
    id_country: 'Ecuador',
    city: '',
    address: '',
    id_company_type: '',
    labels: [],
    email_company: '',
    phone_company: '',
    website: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [customLabels, setCustomLabels] = useState<CompanyLabel[]>([]);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  const resolveLabel = useCallback((label: any): CompanyLabel => {
    const id = typeof label === 'string' ? label : (label.id_label || label.id || '');
    const found = [...companyLabels, ...customLabels].find(l => l.id_label === id || (l as any).id === id);
    return {
      id_label: id,
      name: found?.name || (typeof label === 'string' ? label : label.name || id),
      color: found?.color || (typeof label === 'string' ? undefined : label.color),
    };
  }, [companyLabels, customLabels]);

  const handleAddCustomLabel = useCallback((nameParam?: string) => {
    const name = (nameParam ?? newLabelName).trim();
    if (!name) return;
    const tempId = `temp_${Date.now()}`;
    const newLabel: CompanyLabel = { id_label: tempId, name, color: '#3B82F6' };
    setCustomLabels(prev => [...prev, newLabel]);
    setFormData(prev => ({
      ...prev,
      labels: ([...(prev.labels as any[]) || [], newLabel]) as any,
    }));
    setNewLabelName('');
    setLabelQuery('');
    setLabelMenuOpen(false);
  }, [newLabelName]);

  // Normaliza etiquetas existentes cuando cambia el diccionario cargado
  useEffect(() => {
    if (!isOpen) return;
    const current = (formData.labels as any[]) || [];
    if (current.length === 0) return;
    const normalized = current.map(resolveLabel);
    setFormData(prev => ({ ...prev, labels: normalized }));
  }, [companyLabels, customLabels, isOpen, resolveLabel]);

  // Reset al cerrar el modal para evitar arrastrar etiquetas temp
  useEffect(() => {
    if (!isOpen) {
      setCustomLabels([]);
      setLabelQuery('');
      setLabelMenuOpen(false);
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!labelDropdownRef.current) return;
      if (!labelDropdownRef.current.contains(e.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cargar países desde API
  useEffect(() => {
    const loadCountries = async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      try {
        const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/countries?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (response.ok) {
          const data = await response.json();
          setCountries(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error loading countries:', error);
      }
    };
    loadCountries();
  }, [user]);

  // Cargar tipos de empresa desde API
  useEffect(() => {
    const loadCompanyTypes = async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      try {
        const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/types?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (response.ok) {
          const data = await response.json();
          setCompanyTypes(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error loading company types:', error);
      }
    };
    loadCompanyTypes();
  }, [user]);

  // Cargar etiquetas al abrir el modal (trae etiquetas vigentes y, si aplica, de la empresa)
  const loadLabels = useCallback(async () => {
    if (!isOpen || !user?.id_tenant || !user?.id_user) return;
    try {
      const url = new URL(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels`);
      url.searchParams.set('id_tenant', user.id_tenant);
      url.searchParams.set('id_user', user.id_user);
      if (mode === 'edit' && initialData?.id_client_company) {
        url.searchParams.set('id_client_company', initialData.id_client_company);
      }

      const response = await apiFetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setCompanyLabels(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading company labels:', error);
    }
  }, [isOpen, user?.id_tenant, user?.id_user, mode, initialData?.id_client_company]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // Inicializar formulario cuando el modal se abre con nuevos datos
  useEffect(() => {
    if (!isOpen) {
      lastLoadedIdRef.current = undefined;
      return;
    }

    // Solo cargar si es una nueva empresa o diferente a la última cargada
    const currentId = initialData?.id_client_company;
    if (mode === 'edit' && initialData && lastLoadedIdRef.current !== currentId) {

      lastLoadedIdRef.current = currentId;
      
      const newFormData = {
        id_client_company: initialData.id_client_company,
        id_type: initialData.id_type || 'RUC',
        id_number: initialData.id_number || '',
        name_company: initialData.name_company || '',
        id_country: (initialData as any).country_name || initialData.id_country || 'Ecuador',
        city: initialData.city || '',
        address: initialData.address || '',
        id_company_type: (initialData as any).company_type_name || (initialData as any).id_company_type || '',
        labels: (initialData as any).labels || [],
        email_company: initialData.email_company || '',
        phone_company: initialData.phone_company || '',
        website: initialData.website || '',
      };
      setFormData(newFormData);
    } else if (mode === 'create') {
      lastLoadedIdRef.current = undefined;
      setFormData({
        id_type: 'RUC',
        id_number: '',
        name_company: '',
        id_country: 'Ecuador',
        city: '',
        address: '',
        id_company_type: '',
        labels: [],
        email_company: '',
        phone_company: '',
        website: '',
      });
    }
  }, [isOpen, mode, initialData?.id_client_company]); // Usar solo el id como dependencia

  // Validación de cédula ecuatoriana
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
    
    const digitoVerificador = parseInt(cedula[9]);
    const resultado = (10 - (suma % 10)) % 10;
    
    return resultado === digitoVerificador;
  };

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

      // Validaciones específicas por tipo de ID
      const idType = formData.id_type || 'RUC';
      const idNumber = formData.id_number.trim();

      if (idType === 'RUC') {
        if (!/^\d{13}$/.test(idNumber)) {
          setToast({ message: 'El RUC debe tener exactamente 13 dígitos numéricos.', type: 'error' });
          setSubmitting(false);
          return;
        }
        if (!idNumber.endsWith('001')) {
          setToast({ message: 'El RUC debe terminar en 001.', type: 'error' });
          setSubmitting(false);
          return;
        }
      } else if (idType === 'CI') {
        if (!validateCedula(idNumber)) {
          setToast({ message: 'La cédula ingresada no es válida.', type: 'error' });
          setSubmitting(false);
          return;
        }
      } else if (idType === 'IDENTIFICACION DEL EXTERIOR') {
        if (!/^[A-Za-z0-9-]+$/.test(idNumber)) {
          setToast({ message: 'El ID del exterior solo puede contener letras, números y guion medio.', type: 'error' });
          setSubmitting(false);
          return;
        }
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

      if (!formData.labels || (formData.labels as any[]).length === 0) {
        setToast({ message: 'Selecciona al menos una etiqueta.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!user?.id_tenant || !user?.id_user) {
        setToast({ message: 'Usuario no autenticado.', type: 'error' });
        setSubmitting(false);
        return;
      }

      // Crear etiquetas nuevas primero
      const labelsArray = (formData.labels as any[] || []).map(resolveLabel);
      const finalLabelIds: string[] = [];
      
      for (const label of labelsArray) {
        if (label.id_label.startsWith('temp_')) {
          // Esta es una etiqueta nueva, crearla en el backend
          try {
            const createLabelRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: label.name,
                color: label.color || '#3B82F6',
                id_tenant: user.id_tenant,
                id_user: user.id_user,
              })
            });
            
            if (createLabelRes.ok) {
              const response = await createLabelRes.json();
              const createdLabel = Array.isArray(response) ? response[0] : response;
              finalLabelIds.push(createdLabel.id_label || createdLabel.id || label.name);
            } else {
              throw new Error(`Error al crear etiqueta: ${label.name}`);
            }
          } catch (error) {
            console.error('Error creando etiqueta:', error);
            setToast({ message: `Error al crear etiqueta: ${label.name}`, type: 'error' });
            setSubmitting(false);
            return;
          }
        } else {
          finalLabelIds.push(label.id_label);
        }
      }

      // Conectar al backend
      const endpoint = mode === 'edit' ? 'update' : '';
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/${endpoint}`;

      const payload = {
        ...formData,
        labels: finalLabelIds,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        ...(mode === 'create' ? { created_by: user.id_user } : {}),
      };

      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
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
          {/* Tipo ID, Número y Tipo de Empresa */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '160px 0.6fr 1fr' }}>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Tipo ID <span className="text-red-500">*</span>
              </label>
              <select
                name="id_type"
                required
                value={formData.id_type || 'RUC'}
                onChange={handleInputChange}
                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
              >
                <option value="RUC">RUC</option>
                <option value="CI">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="IDENTIFICACION DEL EXTERIOR">ID DEL EXTERIOR</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Número <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="id_number"
                required
                value={formData.id_number || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={
                  formData.id_type === 'RUC' ? '1790016919001' :
                  formData.id_type === 'CI' ? '1714567890' :
                  formData.id_type === 'IDENTIFICACION DEL EXTERIOR' ? 'ABC-123456' : '...'
                }
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">
                {formData.id_type === 'RUC' && '13 dígitos numéricos, debe terminar en 001'}
                {formData.id_type === 'CI' && '10 dígitos numéricos (cédula válida)'}
                {formData.id_type === 'IDENTIFICACION DEL EXTERIOR' && 'Letras, números y guion medio permitidos'}
                {formData.id_type === 'PASAPORTE' && 'Formato alfanumérico'}
              </p>
            </div>
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
                {companyTypes.map(type => (
                  <option key={type.id_company_types || type.name} value={type.name}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Razón Social (triple columna) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 space-y-1">
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
          </div>

          {/* País | Ciudad | Teléfono */}
          <div className="grid grid-cols-3 gap-4">
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
                {countries.map(country => (
                  <option key={country.id || country.name} value={country.name}>{country.name}</option>
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
          </div>

          {/* Dirección (2 cols) | Email Corp. */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="Av. Principal 123"
              />
            </div>
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
          </div>

          {/* Website | Etiquetas (2 cols) */}
          <div className="grid grid-cols-3 gap-4">
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
            <div className="col-span-2 space-y-2" ref={labelDropdownRef}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Etiquetas <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-brand-500 outline-none text-sm flex items-center flex-wrap gap-1">
                  {((formData.labels as any[]) || []).map((raw) => {
                    const label = resolveLabel(raw);
                    return (
                      <span
                        key={label.id_label}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap"
                        style={{
                          backgroundColor: `${label.color || '#2563eb'}15`,
                          color: label.color || '#1d4ed8',
                          borderColor: label.color || '#bfdbfe',
                        }}
                      >
                        {label.name}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              labels: (prev.labels as any[]).filter(l => resolveLabel(l).id_label !== label.id_label)
                            }));
                            if (label.id_label.startsWith('temp_')) {
                              setCustomLabels(prev => prev.filter(l => l.id_label !== label.id_label));
                            }
                          }}
                          className="hover:opacity-80 text-xs"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    value={labelQuery}
                    onChange={(e) => {
                      setLabelQuery(e.target.value);
                      setLabelMenuOpen(true);
                    }}
                    onFocus={() => setLabelMenuOpen(true)}
                    onBlur={() => setTimeout(() => setLabelMenuOpen(false), 200)}
                    placeholder={((formData.labels as any[]) || []).length === 0 ? "Buscar o crear" : ""}
                    className="flex-1 min-w-[100px] px-0 py-0 bg-transparent outline-none text-sm placeholder:text-slate-400"
                  />
                </div>

                {labelMenuOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-50">
                    {(() => {
                      const query = labelQuery.trim().toLowerCase();
                      const selectedIds = new Set(((formData.labels as any[]) || []).map(l => resolveLabel(l).id_label));
                      const allLabels = [...companyLabels, ...customLabels];
                      const filtered = allLabels.filter(l => {
                        const id = (l as any).id_label || (l as any).id;
                        if (!id || selectedIds.has(id)) return false;
                        if (!query) return true;
                        return (l.name || '').toLowerCase().includes(query);
                      });

                      if (filtered.length > 0) {
                        return filtered.map(l => {
                          const id = (l as any).id_label || (l as any).id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  labels: ([...(prev.labels as any[]) || [], resolveLabel(l)]) as any,
                                }));
                                setLabelQuery('');
                                setLabelMenuOpen(true);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between gap-2"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: (l as any).color || '#cbd5e1' }}
                                ></span>
                                <span className="text-sm font-medium text-slate-700">{l.name}</span>
                              </span>
                              <span className="text-xs text-slate-400">Agregar</span>
                            </button>
                          );
                        });
                      }

                      if (query) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleAddCustomLabel(labelQuery)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold text-brand-600"
                          >
                            <i className="fa-solid fa-plus"></i>
                            Crear etiqueta "{labelQuery}"
                          </button>
                        );
                      }

                      return (
                        <div className="px-4 py-3 text-sm text-slate-500">Escribe para buscar una etiqueta</div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

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
