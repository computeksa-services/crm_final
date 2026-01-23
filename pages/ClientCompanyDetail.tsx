import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientCompany, ClientContact } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CompanyMap from '../components/CompanyMap';
import { apiFetch } from '../services/apiClient';

const ClientCompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- ESTADOS DE DATOS ---
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [countries, setCountries] = useState<{id: string; name: string}[]>([]);
  const [companyTypes, setCompanyTypes] = useState<{id_company_types: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- ESTADOS COMPARTIR (SHARE) ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]); // Array de IDs seleccionados
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  // --- ESTADO EDICIÓN EMPRESA ---
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<ClientCompany> | null>(null);
  const [companySubmitting, setCompanySubmitting] = useState(false);

  // --- PERMISOS ---
  const isOwnerCompany = company?.created_by === user?.id_user;
  const companyAccess: 'VIEW' | 'EDIT' = (company?.access_level as any) || (user?.rol_user === 'admin' || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canEditCompany = companyAccess === 'EDIT';
  const canShare = user?.rol_user === 'admin' || isOwnerCompany;
  const canDeleteContact = (contact: ClientContact) => {
    return (user?.rol_user === 'admin') || canEditCompany || (contact.created_by === user?.id_user);
  };

  // --- DATOS DE REFERENCIA (para edición) ---
  const COMPANY_LABELS = ['Cliente','Prospecto (Lead)','Prospecto Interesado','Poco Interesado','Ex-Cliente'];

  // --- MODALES EDICIÓN ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // Obtener Empresa con todos sus datos (incluyendo contactos)
      const companyResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/detail?id_client_company=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!companyResponse.ok) throw new Error(`Error al cargar empresa.`);
      
      const companyText = await companyResponse.text();
      const parsed = companyText ? JSON.parse(companyText) : null;
      // Backend puede devolver objeto o array con un objeto
      const companyObj: any = Array.isArray(parsed)
        ? (parsed.find((c: any) => c?.id_client_company === id) ?? parsed[0] ?? null)
        : parsed;
      
      if (!companyObj) {
        setLoading(false);
        setCompany(null);
        setContacts([]);
        return;
      }

      setCompany(companyObj);
      setContacts(Array.isArray(companyObj.contacts) ? companyObj.contacts : []);

      // Actualizar breadcrumb con el nombre de la empresa
      navigate(location.pathname, {
        state: { breadcrumb: companyObj.name_company },
        replace: true
      });

    } catch (e: any) {
      console.error("Error:", e);
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setCompany(null);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleContactRowClick = (contactId: string) => navigate(`/app/client-contacts/${contactId}`);

  // --- HELPERS VISUALES ---
  const normalizeWebsite = (url?: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    const [date, time = ''] = iso.split('T');
    return `${date}${time ? ` ${time.slice(0,5)}` : ''}`;
  };

  // --- HANDLERS EMPRESA (Edit/Update) ---
  const openEditCompany = () => {
    if (!company || !canEditCompany) return;
    setEditingCompany({
      id_client_company: company.id_client_company,
      id_type: company.id_type,
      id_number: company.id_number,
      name_company: company.name_company,
      id_country: company.id_country || undefined,
      city: company.city || '',
      address: company.address || '',
      id_company_type: company.company_type_name || '',
      id_label: company.label_name || '',
      email_company: company.email_company || '',
      phone_company: company.phone_company || '',
      website: company.website || '',
    });
    setIsCompanyModalOpen(true);
  };

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingCompany(prev => (prev ? { ...prev, [name]: value } : prev));
  };

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

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !user?.id_tenant || !user?.id_user) return;

    // Validaciones específicas por tipo de ID
    if (editingCompany.id_number) {
      const idType = editingCompany.id_type || 'RUC';
      const idNumber = editingCompany.id_number.trim();

      if (idType === 'RUC') {
        if (!/^\d{13}$/.test(idNumber)) {
          setToast({ message: 'El RUC debe tener exactamente 13 dígitos numéricos.', type: 'error' });
          return;
        }
        if (!idNumber.endsWith('001')) {
          setToast({ message: 'El RUC debe terminar en 001.', type: 'error' });
          return;
        }
      } else if (idType === 'CI') {
        if (!validateCedula(idNumber)) {
          setToast({ message: 'La cédula ingresada no es válida.', type: 'error' });
          return;
        }
      } else if (idType === 'IDENTIFICACION DEL EXTERIOR') {
        if (!/^[A-Za-z0-9-]+$/.test(idNumber)) {
          setToast({ message: 'El ID del exterior solo puede contener letras, números y guion medio.', type: 'error' });
          return;
        }
      }
    }

    setCompanySubmitting(true);
    try {
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/update`;
      const payload = {
        ...editingCompany,
        id_client_company: editingCompany.id_client_company || company?.id_client_company,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
      };
      const resp = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error('Update failed');
      setToast({ message: 'Empresa actualizada con éxito.', type: 'success' });
      setIsCompanyModalOpen(false);
      await fetchData();
    } catch (err) {
      setToast({ message: 'Error al actualizar la empresa.', type: 'error' });
    } finally {
      setCompanySubmitting(false);
    }
  };

  // --- HANDLERS CONTACTO (Create/Edit/Delete) ---
  // ... (Mantenemos la lógica de contactos igual que antes)
  const handleAddContact = () => {
    if (!user?.id_tenant) return;
    if (!canEditCompany) { setToast({ message: 'No tienes permisos.', type: 'error' }); return; }
    setEditingContact({
      first_name: '', last_name: '', email: '', phone: '', position: '',
      id_client_company: id, id_tenant: user.id_tenant,
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEditContact = (contact: ClientContact) => {
    if (!canEditCompany && contact.access_level === 'VIEW') { setToast({ message: 'Solo lectura.', type: 'error' }); return; }
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDeleteContact = (contact: ClientContact) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Se eliminará este contacto.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_contact: contact.id_contact, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          setToast({ message: 'Contacto eliminado.', type: 'success' });
          await fetchData();
        } catch (error: any) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !user?.id_tenant) return;
    setSubmitting(true);
    const payload = { ...editingContact, id_client_company: id, id_tenant: user.id_tenant, id_user: user.id_user };
    try {
      const url = isEditMode && payload.id_contact
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/update`
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts`;
      await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setToast({ message: isEditMode ? 'Contacto actualizado.' : 'Contacto creado.', type: 'success' });
      setIsModalOpen(false);
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingContact(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // --- HANDLERS COMPARTIR (Nueva Lógica de UI) ---
  const openShareModal = async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      const activos = Array.isArray(data)
        ? data.filter((u: any) => u.status_user !== 'Inactivo' && u.id_user !== user.id_user)
        : [];
      setShareUsers(activos);
      setShareTargets([]);
      setSharePermission('VIEW');
      setShareModalOpen(true);
    } catch (e: any) {
      setToast({ message: 'Error al cargar usuarios.', type: 'error' });
    }
  };

  // Función para seleccionar/deseleccionar usuarios (Checkbox logic)
  const toggleShareTarget = (userId: string) => {
    setShareTargets(prev => 
        prev.includes(userId) 
        ? prev.filter(id => id !== userId) // Quitar si ya está
        : [...prev, userId] // Agregar si no está
    );
  };

  const handleShareCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user?.id_tenant || shareTargets.length === 0) {
      setToast({ message: 'Selecciona al menos un usuario.', type: 'error' });
      return;
    }
    setShareSubmitting(true);
    try {
      const requests = shareTargets.map(target =>
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/companies/share`, {
          method: 'POST',
          body: JSON.stringify({
            id_client_company: company.id_client_company,
            id_user_target: target,
            id_tenant: user.id_tenant,
            permission_level: sharePermission,
          }),
        })
      );
      await Promise.all(requests);
      setToast({ message: 'Empresa compartida.', type: 'success' });
      setShareModalOpen(false);
    } catch (error: any) {
      setToast({ message: 'Error al compartir.', type: 'error' });
    } finally {
      setShareSubmitting(false);
    }
  };

  // --- RENDER ---
  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-500 font-medium animate-pulse">Cargando...</p>
      </div>
    </div>
  );
  
  if (!company) return (
    <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
            <h3 className="text-lg font-bold text-red-700">Empresa no encontrada</h3>
            <button onClick={() => navigate('/app/client-companies')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Volver</button>
        </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm text-indigo-600 text-3xl">
                    <i className="fa-solid fa-building"></i>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{company.name_company}</h1>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600 mt-1">
                        {company.country_name && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                            <i className="fa-solid fa-globe text-slate-400"></i> {company.country_name}
                          </span>
                        )}
                        {company.city && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                            <i className="fa-solid fa-location-dot text-slate-400"></i> {company.city}
                          </span>
                        )}
                        {company.company_type_name && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1 uppercase font-bold">
                            <i className="fa-solid fa-building"></i> {company.company_type_name}
                          </span>
                        )}
                        {company.label_name && (
                          <span
                            className="px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase inline-flex items-center gap-1"
                            style={{ backgroundColor: `${company.label_color || '#64748b'}15`, color: company.label_color || '#64748b', borderColor: company.label_color || '#cbd5e1' }}
                          >
                            <i className="fa-solid fa-tag"></i> {company.label_name}
                          </span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
              {canEditCompany && (
                <button
                  onClick={openEditCompany}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 shadow-sm"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  Editar
                </button>
              )}
              <button
                  onClick={openShareModal}
                  disabled={!canShare}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      canShare 
                      ? 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 shadow-sm' 
                      : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                  }`}
              >
                  <i className="fa-solid fa-share-nodes"></i>
                  Compartir
              </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Detalles Empresa */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Información Clave</h3>
            </div>
            <div className="p-6 space-y-5">
                <div>
                    <p className="text-xs text-slate-400 mb-1">Identificación ({company.id_type || 'ID'})</p>
                    <p className="font-mono text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                        {company.id_number}
                    </p>
                </div>

                {company.website && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Sitio Web</p>
                    <a href={normalizeWebsite(company.website)} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                      {company.website} <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 pt-2 border-t border-dashed border-slate-100">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Email Principal</p>
                        <a href={`mailto:${company.email_company}`} className="text-sm text-slate-700 hover:text-brand-600 flex items-center gap-2">
                            <i className="fa-regular fa-envelope text-slate-400"></i>
                            {company.email_company || 'No registrado'}
                        </a>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Teléfono</p>
                        <div className="text-sm text-slate-700 flex items-center gap-2">
                            <i className="fa-solid fa-phone text-slate-400"></i>
                            {company.phone_company || 'No registrado'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">País</p>
                    <p className="text-sm text-slate-700">{company.country_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Ciudad</p>
                    <p className="text-sm text-slate-700">{company.city || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Tipo de Empresa</p>
                    <p className="text-xs font-bold uppercase inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{company.company_type_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Etiquetas</p>
                    {Array.isArray((company as any).label_details) && (company as any).label_details.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(company as any).label_details.map((detail: any, idx: number) => (
                          <span
                            key={detail.id_label || idx}
                            className="px-2.5 py-1 rounded-full border text-[11px] font-bold inline-block"
                            style={{ backgroundColor: `${detail.color || '#64748b'}15`, color: detail.color || '#64748b', borderColor: detail.color || '#cbd5e1' }}
                          >
                            {detail.name}
                          </span>
                        ))}
                      </div>
                    ) : company.label_name ? (
                      <span
                        className="px-2 py-1 rounded-full border text-[11px] font-bold uppercase inline-block"
                        style={{ backgroundColor: `${company.label_color || '#64748b'}15`, color: company.label_color || '#64748b', borderColor: company.label_color || '#cbd5e1' }}
                      >
                        {company.label_name}
                      </span>
                    ) : (
                      <p className="text-sm text-slate-700">—</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Dirección</p>
                  <p className="text-sm text-slate-700 leading-snug">{company.address || 'Sin dirección'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-slate-100">
                  <div className="flex items-center gap-2">
                    {company.created_by_avatar ? (
                      <img src={company.created_by_avatar} alt={company.created_by_name || 'Usuario'} className="w-6 h-6 rounded-full border" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 border">{(company.created_by_name || 'U').charAt(0)}</div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400">Creado por</p>
                      <p className="text-sm text-slate-700">{company.created_by_name || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Creado el</p>
                    <p className="text-sm text-slate-700">{formatDateTime(company.created_at) || '—'}</p>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Lista Contactos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contactos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-users text-slate-400"></i> Contactos
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{contacts.length}</span>
                </h3>
                <button 
                    onClick={handleAddContact} 
                    disabled={!canEditCompany}
                    className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i className="fa-solid fa-plus mr-1"></i> Nuevo
                </button>
            </div>

            {contacts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i className="fa-regular fa-address-book text-4xl mb-3 opacity-30"></i>
                    <p>No hay contactos registrados.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-3 border-b border-slate-100">Nombre</th>
                                <th className="px-6 py-3 border-b border-slate-100">Cargo</th>
                                <th className="px-6 py-3 border-b border-slate-100">Info</th>
                                <th className="px-6 py-3 border-b border-slate-100 text-right w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {contacts.map((contact) => {
                                const disableEdit = !canEditCompany;
                                const disableDelete = !canDeleteContact(contact);
                                return (
                                    <tr 
                                        key={contact.id_contact} 
                                        onClick={() => handleContactRowClick(contact.id_contact)} 
                                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                                                    {(contact.first_name || 'C').charAt(0)}{(contact.last_name || '').charAt(0)}
                                                </div>
                                                <span className="font-medium text-slate-700">{contact.first_name} {contact.last_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{contact.position || '-'}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">{contact.email}</div>
                                            <div className="text-xs text-slate-400">{contact.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    disabled={disableEdit}
                                                    onClick={(e) => { e.stopPropagation(); if (!disableEdit) handleEditContact(contact); }}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button
                                                    disabled={disableDelete}
                                                    onClick={(e) => { e.stopPropagation(); if (!disableDelete) handleDeleteContact(contact); }}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
          </div>

          {/* Mapa */}
          <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative ${(shareModalOpen || isCompanyModalOpen || isModalOpen) ? 'z-0' : ''}`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <i className="fa-solid fa-map"></i> Ubicación
                </h3>
            </div>
            <div className={`p-6 ${(shareModalOpen || isCompanyModalOpen || isModalOpen) ? 'pointer-events-none opacity-50' : ''}`}>
              <CompanyMap
                address={company.address}
                city={company.city}
                country={company.country_name}
                companyName={company.name_company}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SHARE MODAL MEJORADO (Estilo de la imagen) */}
      {shareModalOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h2 className="font-bold text-lg text-slate-800 uppercase tracking-wide">Compartir Empresa</h2>
                <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fa-solid fa-times text-lg"></i>
                </button>
            </div>

            <form className="p-6 space-y-6" onSubmit={handleShareCompany}>
              
              {/* LISTA DE USUARIOS (CHECKBOXES) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Usuario</label>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 custom-scrollbar">
                    {shareUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No hay usuarios disponibles.</p>
                    ) : (
                        shareUsers.map(u => {
                            const isSelected = shareTargets.includes(u.id_user);
                            return (
                                <div 
                                    key={u.id_user} 
                                    onClick={() => toggleShareTarget(u.id_user)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                                        isSelected 
                                        ? 'bg-brand-50 border-brand-200' 
                                        : 'hover:bg-slate-50 border-transparent'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                        isSelected 
                                        ? 'bg-brand-600 border-brand-600 text-white' 
                                        : 'bg-white border-slate-300'
                                    }`}>
                                        {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-slate-700'}`}>
                                            {u.name_user}
                                        </p>
                                        <p className="text-xs text-slate-400">{u.email_user}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
              </div>

              {/* PERMISOS (SEGMENTED CONTROL) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Permiso</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSharePermission('VIEW')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        sharePermission === 'VIEW' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Solo ver
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePermission('EDIT')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        sharePermission === 'EDIT' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Puede editar
                  </button>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex justify-end gap-3 pt-2">
                <button 
                    type="button" 
                    onClick={() => setShareModalOpen(false)} 
                    className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                  type="submit"
                  disabled={shareSubmitting || shareTargets.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {shareSubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Compartir'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EDITAR EMPRESA */}
      {isCompanyModalOpen && editingCompany && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-100 text-brand-600">
                   <i className="fa-solid fa-building-circle-check"></i>
                </div>
                Editar Empresa
              </h2>
              <button onClick={() => setIsCompanyModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCompanySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo ID <span className="text-red-500">*</span></label>
                    <select 
                        name="id_type" 
                        required 
                        value={editingCompany.id_type || 'RUC'} 
                        onChange={handleCompanyInputChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none"
                    >
                        <option value="RUC">RUC</option>
                        <option value="CI">Cédula</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="IDENTIFICACION DEL EXTERIOR">ID Exterior</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Número <span className="text-red-500">*</span></label>
                    <input 
                        name="id_number" 
                        required 
                        value={editingCompany.id_number || ''} 
                        onChange={handleCompanyInputChange} 
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-500" 
                        placeholder="17900..." 
                    />
                  </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razón Social <span className="text-red-500">*</span></label>
                <input
                  name="name_company"
                  required
                  value={editingCompany.name_company || ''}
                  onChange={handleCompanyInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  placeholder="Ej. Corporación Favorita"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">País <span className="text-red-500">*</span></label>
                  <select
                    name="id_country"
                    required
                    value={editingCompany.id_country || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar país</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.id}>{country.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciudad <span className="text-red-500">*</span></label>
                  <input
                    name="city"
                    required
                    value={editingCompany.city || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    placeholder="Quito"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
                <input
                  name="address"
                  value={editingCompany.address || ''}
                  onChange={handleCompanyInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="Av. Principal 123 y Secundaria"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Empresa <span className="text-red-500">*</span></label>
                  <select
                    name="id_company_type"
                    required
                    value={editingCompany.id_company_type || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar tipo</option>
                    {companyTypes.map(type => (
                      <option key={type.id_company_types} value={type.id_company_types}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta <span className="text-red-500">*</span></label>
                  <select
                    name="id_label"
                    required
                    value={editingCompany.id_label || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar etiqueta</option>
                    {COMPANY_LABELS.map(label => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Corp.</label>
                  <input
                    type="email"
                    name="email_company"
                    value={editingCompany.email_company || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                    placeholder="info@empresa.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Website</label>
                  <input
                    type="text"
                    name="website"
                    value={editingCompany.website || ''}
                    onChange={handleCompanyInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                    placeholder="empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                <input
                  name="phone_company"
                  value={editingCompany.phone_company || ''}
                  onChange={handleCompanyInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  placeholder="022..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={companySubmitting}
                  className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {companySubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CONTACTO (Mismo estilo que lista) */}
      {isModalOpen && editingContact && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre <span className="text-red-500">*</span></label>
                  <input name="first_name" value={editingContact.first_name || ''} onChange={handleInputChange} required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apellido</label>
                  <input name="last_name" value={editingContact.last_name || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Pérez" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cargo</label>
                <input name="position" value={editingContact.position || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Gerente" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input type="email" name="email" value={editingContact.email || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="email@ejemplo.com" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                <input name="phone" value={editingContact.phone || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="+593..." />
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100 mt-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                    {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                    Guardar
                 </button>
               </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ClientCompanyDetail;
