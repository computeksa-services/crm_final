import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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

const inputClasses = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold transition-all";
const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block";

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({ isOpen, onClose, mode, initialData, onSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [companyTypes, setCompanyTypes] = useState<{ id: string; name: string }[]>([]);
  const [companyLabels, setCompanyLabels] = useState<CompanyLabel[]>([]);
  const [customLabels, setCustomLabels] = useState<CompanyLabel[]>([]);
  const [formData, setFormData] = useState<Partial<ClientCompany>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // --- Lógica para cerrar el menú de etiquetas al hacer clic fuera ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Validaciones de Ecuador ---
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

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      const [resCountries, resTypes, resLabels] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/countries?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/types?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels?id_tenant=${user.id_tenant}&id_user=${user.id_user}${mode === 'edit' ? `&id_client_company=${initialData?.id_client_company}` : ''}`)
      ]);

      if (resCountries.ok) {
        const data = await resCountries.json();
        setCountries(data.map((i: any) => ({ id: i.id_country || i.id || i.name, name: i.name })));
      }
      if (resTypes.ok) {
        const data = await resTypes.json();
        setCompanyTypes(data.map((i: any) => ({ id: i.id_company_type || i.id_company_types || i.id || i.name, name: i.name })));
      }
      if (resLabels.ok) setCompanyLabels(await resLabels.json());
    } catch (e) { console.error(e); }
  }, [user, mode, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
    if (mode === 'edit' && initialData) {
      setFormData({ ...initialData, labels: (initialData as any).labels || [] });
    } else {
      setFormData({ 
        id_type: 'RUC', 
        id_country: 'EC', 
        labels: [],
        id_number: '', name_company: '', razon_social: '', city: '', address: ''
      });
    }
    setLabelMenuOpen(false); // Resetear estado del menú al abrir modal
  }, [isOpen, mode, initialData, fetchData]);

  const resolveLabel = (label: any): CompanyLabel => {
    const id = typeof label === 'string' ? label : (label.id_label || label.id || '');
    const found = [...companyLabels, ...customLabels].find(l => l.id_label === id);
    return { id_label: id, name: found?.name || label.name || id, color: found?.color || label.color };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_company?.trim()) return setToast({ message: 'Nombre requerido', type: 'error' });
    
    const idNum = formData.id_number?.trim() || '';
    if (idNum) {
      if (formData.id_type === 'RUC') {
        if (!/^\d{13}$/.test(idNum) || !idNum.endsWith('001')) 
          return setToast({ message: 'RUC inválido: 13 dígitos y terminar en 001', type: 'error' });
      } else if (formData.id_type === 'CI') {
        if (!validateCedula(idNum)) return setToast({ message: 'Cédula inválida', type: 'error' });
      }
    }

    setSubmitting(true);
    try {
      const labelsArray = ((formData.labels as any[]) || []).map(resolveLabel);
      const finalLabelIds: string[] = [];

      for (const lbl of labelsArray) {
        if (lbl.id_label.startsWith('temp_')) {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels`, {
            method: 'POST',
            body: JSON.stringify({ name: lbl.name, color: '#3B82F6', id_tenant: user?.id_tenant, id_user: user?.id_user })
          });
          const created = await res.json();
          finalLabelIds.push((Array.isArray(created) ? created[0] : created).id_label);
        } else {
          finalLabelIds.push(lbl.id_label);
        }
      }

      const endpoint = mode === 'edit' ? 'update' : '';
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ ...formData, labels: finalLabelIds, id_tenant: user?.id_tenant, id_user: user?.id_user })
      });

      if (!response.ok) throw new Error("Error al guardar la empresa");
      
      const result = await response.json();
      const savedCompany = Array.isArray(result) ? result[0] : result;
      
      setToast({
        message: mode === 'create' ? 'Empresa creada, redirigiendo...' : 'Empresa actualizada.',
        type: 'success'
      });
      
      onSuccess?.(savedCompany);
      
      if (mode === 'create' && savedCompany?.id_client_company) {
        setTimeout(() => {
          navigate(`/app/client-companies/${savedCompany.id_client_company}`);
          onClose();
        }, 1500);
      } else {
        setSubmitting(false);
        onClose();
      }
    } catch (err) {
      setToast({ message: (err as Error).message || 'Error al procesar la solicitud', type: 'error' });
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'create' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'}`}>
              <i className={`fa-solid ${mode === 'create' ? 'fa-building-circle-arrow-right' : 'fa-building-check'}`}></i>
            </div>
            {mode === 'create' ? 'Nueva Empresa' : 'Editar Empresa'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* Fila 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Nombre Empresa <span className="text-red-500">*</span></label>
              <input name="name_company" required value={formData.name_company || ''} onChange={handleInputChange} className={inputClasses} placeholder="Nombre Comercial" />
            </div>
            <div>
              <label className={labelClasses}>Razón Social</label>
              <input name="razon_social" value={formData.razon_social || ''} onChange={handleInputChange} className={inputClasses} placeholder="Razón Social Legal" />
            </div>
          </div>

          {/* Fila 2 */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4">
              <label className={labelClasses}>Tipo de Empresa <span className="text-red-500">*</span></label>
              <select name="id_company_type" required value={formData.id_company_type || ''} onChange={handleInputChange} className={inputClasses}>
                <option value="">Seleccionar...</option>
                {companyTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClasses}>Tipo ID</label>
              <select name="id_type" value={formData.id_type || 'RUC'} onChange={handleInputChange} className={inputClasses}>
                <option value="RUC">RUC</option>
                <option value="CI">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="ID. DEL EXTERIOR">ID. DEL EXTERIOR</option>
              </select>
            </div>
            <div className="col-span-6 md:col-span-5">
              <label className={labelClasses}>Número</label>
              <input name="id_number" value={formData.id_number || ''} onChange={handleInputChange} className={`${inputClasses} font-mono`} placeholder="Ej: 1790016919001" />
            </div>
          </div>

          {/* Fila 3 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>País <span className="text-red-500">*</span></label>
              <select name="id_country" required value={formData.id_country || ''} onChange={handleInputChange} className={inputClasses}>
                {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Ciudad <span className="text-red-500">*</span></label>
              <input name="city" required value={formData.city || ''} onChange={handleInputChange} className={inputClasses} placeholder="Quito" />
            </div>
            <div>
              <label className={labelClasses}>Teléfono</label>
              <input name="phone_company" value={formData.phone_company || ''} onChange={handleInputChange} className={inputClasses} placeholder="022..." />
            </div>
          </div>

          {/* Fila 4 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelClasses}>Dirección</label>
              <input name="address" value={formData.address || ''} onChange={handleInputChange} className={inputClasses} placeholder="Av. Principal y Calle..." />
            </div>
            <div>
              <label className={labelClasses}>Email Corp.</label>
              <input type="email" name="email_company" value={formData.email_company || ''} onChange={handleInputChange} className={inputClasses} placeholder="info@empresa.com" />
            </div>
          </div>

          {/* Website y Etiquetas (Dropdown corregido) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>Website</label>
              <input name="website" value={formData.website || ''} onChange={handleInputChange} className={inputClasses} placeholder="empresa.com" />
            </div>
            <div className="col-span-2 relative" ref={labelDropdownRef}>
              <label className={labelClasses}>Etiquetas</label>
              <div 
                className={`${inputClasses} flex flex-wrap gap-1 items-center min-h-[42px] cursor-text`}
                onClick={() => setLabelMenuOpen(true)}
              >
                {((formData.labels as any[]) || []).map(l => {
                  const label = resolveLabel(l);
                  return (
                    <span key={label.id_label} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border" style={{ backgroundColor: `${label.color}15`, color: label.color, borderColor: `${label.color}30` }}>
                      {label.name}
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, labels: (prev.labels as any[]).filter(x => resolveLabel(x).id_label !== label.id_label) }));
                      }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  );
                })}
                <input 
                  className="flex-1 bg-transparent outline-none text-sm placeholder:font-normal placeholder:text-slate-400" 
                  placeholder={!formData.labels?.length ? "Buscar o crear..." : ""}
                  value={labelQuery}
                  onFocus={() => setLabelMenuOpen(true)}
                  onChange={(e) => setLabelQuery(e.target.value)}
                />
              </div>

              {/* Dropdown que se despliega hacia ARRIBA y se cierra correctamente */}
              {labelMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] max-h-52 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {(() => {
                    const filtered = [...companyLabels, ...customLabels].filter(l => 
                      l.name.toLowerCase().includes(labelQuery.toLowerCase()) && 
                      !((formData.labels as any[]) || []).some(sl => resolveLabel(sl).id_label === l.id_label)
                    );

                    return (
                      <>
                        {filtered.map(l => (
                          <button key={l.id_label} type="button" onClick={() => {
                            setFormData(prev => ({ ...prev, labels: [...(prev.labels as any[]), l] }));
                            setLabelQuery('');
                            setLabelMenuOpen(false); // Cierra al seleccionar
                          }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-sm font-bold text-slate-700 transition-colors">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }}></span> {l.name}
                          </button>
                        ))}
                        
                        {labelQuery && (
                          <button type="button" onClick={() => {
                            const nl = { id_label: `temp_${Date.now()}`, name: labelQuery, color: '#3B82F6' };
                            setCustomLabels(p => [...p, nl]);
                            setFormData(prev => ({ ...prev, labels: [...(prev.labels as any[]), nl] }));
                            setLabelQuery('');
                            setLabelMenuOpen(false); // Cierra al crear
                          }} className="w-full text-left px-3 py-2 bg-brand-50/50 hover:bg-brand-50 text-brand-600 rounded-lg text-sm font-bold flex items-center gap-2 mt-1">
                            <i className="fa-solid fa-plus text-xs"></i> Crear etiqueta "{labelQuery}"
                          </button>
                        )}

                        {filtered.length === 0 && !labelQuery && (
                          <div className="px-3 py-2 text-xs text-slate-400 text-center italic">
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

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
            <button type="submit" disabled={submitting} className="px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2">
              {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              {mode === 'create' ? 'Crear Empresa' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>,
    document.body
  );
};

export default CompanyFormModal;