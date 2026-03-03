import React, { useEffect, useState, useCallback } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ClientCompany, ClientContact } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import CompanyMap from './CompanyMap';
import CompanyFormModal from './CompanyFormModal';
import { apiFetch } from '../../services/apiClient';

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
  
  // --- ESTADOS ASIGNAR ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);

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
      const contactsSource = Array.isArray(companyObj.contacts_list)
        ? companyObj.contacts_list
        : Array.isArray(companyObj.contacts)
          ? companyObj.contacts
          : [];
      setContacts(contactsSource);
      if (Array.isArray(companyObj.collaborators)) {
        const mapped = companyObj.collaborators.map((u: any) => ({
          id_user: u.id_user,
          name: u.name || u.name_user || u.full_name || u.email || 'Usuario',
          avatar: u.avatar || u.avatar_url || null,
          permission_level: (u.permission_level || '').toUpperCase() === 'NONE' ? 'BLOCKED' : u.permission_level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        }));
        setShareCollaborators(mapped);
      }

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

  useEffect(() => {
    if ((location.state as any)?.openShare && company) {
      openShareModal();
      navigate(location.pathname, { state: { breadcrumb: (location.state as any)?.breadcrumb }, replace: true });
    }
  }, [company, location.pathname, location.state, navigate]);

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

  const getInitials = (name: string = '') => {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    
    // Si tiene espacio, tomar primera letra de cada palabra
    if (trimmed.includes(' ')) {
      return trimmed.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    // Si no tiene espacio, tomar primeras 2 letras
    return trimmed.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string = '') => {
    const colors = [
      { bg: '#F0E6E6', text: '#A67C7C' },    // Rojo suave
      { bg: '#F5EAF0', text: '#B397AA' },    // Rosa suave
      { bg: '#EDE4F5', text: '#9B7DB0' },    // Púrpura suave
      { bg: '#E8E0F0', text: '#8B7BA3' },    // Índigo suave
      { bg: '#E1E8F5', text: '#7A8FB5' },    // Azul suave
      { bg: '#DFF0ED', text: '#7BA89C' },    // Teal suave
      { bg: '#E9F0E8', text: '#7FA08' },     // Verde suave
      { bg: '#EEF2E7', text: '#92A680' },    // Verde claro suave
      { bg: '#F5F2E1', text: '#B8AC5B' },    // Amarillo suave
      { bg: '#F7EFEA', text: '#B88263' },    // Naranja suave
      { bg: '#EFE8E4', text: '#8B7B6F' },    // Marrón suave
      { bg: '#E8E8E8', text: '#707070' },    // Gris suave
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    const [date, time = ''] = iso.split('T');
    return `${date}${time ? ` ${time.slice(0,5)}` : ''}`;
  };

  // --- HANDLERS EMPRESA (Edit/Update) ---
  const openEditCompany = () => {
    if (!canEditCompany || !company) {
      setToast({ message: 'No tienes permisos para editar esta empresa.', type: 'error' });
      return;
    }
    setEditingCompany(company as Partial<ClientCompany>);
    setIsCompanyModalOpen(true);
  };

  const handleCompanyModalSuccess = async () => {
    setIsCompanyModalOpen(false);
    await fetchData();
    setToast({ message: 'Empresa actualizada correctamente.', type: 'success' });
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
    setEditingContact((prev: Partial<ClientContact> | null) => (prev ? { ...prev, [name]: value } : null));
  };

  // --- HANDLERS ASIGNAR ---
  const refreshShareCollaborators = useCallback(async () => {
    if (!user?.id_tenant || !company?.id_client_company) return;
    try {
      const shareRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/companies/share?id_client_company=${company.id_client_company}`);
      const shareText = await shareRes.text();
      const shareData = shareText ? JSON.parse(shareText) : [];
      const shareList = Array.isArray(shareData) ? shareData : (shareData.users || []);
      const mapped = shareList.map((u: any) => {
        const level = (u.permission_level || '').toUpperCase();
        return {
          id_user: u.id_user,
          name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
          avatar: u.avatar_url || u.avatar || null,
          permission_level: level === 'NONE' ? 'BLOCKED' : level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        };
      });
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
  }, [company?.id_client_company, user?.id_tenant]);

  const refreshCompanyCollaborators = useCallback(async () => {
    if (!company?.id_client_company || !user?.id_tenant || !user?.id_user) return;
    try {
      const companyResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/detail?id_client_company=${company.id_client_company}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!companyResponse.ok) return;
      const companyText = await companyResponse.text();
      const parsed = companyText ? JSON.parse(companyText) : null;
      const companyObj: any = Array.isArray(parsed)
        ? (parsed.find((c: any) => c?.id_client_company === company.id_client_company) ?? parsed[0] ?? null)
        : parsed;
      const collaborators = Array.isArray(companyObj?.collaborators) ? companyObj.collaborators : [];
      setCompany(prev => (prev ? ({ ...(prev as any), collaborators } as any) : prev));
    } catch {
      // keep current state on error
    }
  }, [company?.id_client_company, user?.id_tenant, user?.id_user]);

  const openShareModal = async () => {
    if (!user?.id_tenant || !company?.id_client_company) return;
    if (!shareCollaborators.length) {
      await refreshShareCollaborators();
    }
    setShareModalOpen(true);
  };

  // --- RENDER ---
  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <BrandSpinner size="xl" />
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
                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center font-bold text-[14px] shadow-sm" style={{ backgroundColor: getAvatarColor(company.name_company).bg, color: getAvatarColor(company.name_company).text, border: `2px solid ${getAvatarColor(company.name_company).text}` }}>
                    {getInitials(company.name_company)}
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
                        {company.company_size && (
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 inline-flex items-center gap-1 uppercase font-bold">
                            <i className="fa-solid fa-users"></i> {company.company_size}
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
                <i className="fa-solid fa-user-plus"></i>
                Asignar
              </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Detalles Empresa */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Información Clave</h3>
            </div>
            <div className="p-6 space-y-5">
                {company.razon_social && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Razón Social</p>
                    <p className="text-sm font-medium text-slate-700">{company.razon_social}</p>
                  </div>
                )}

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
                    <p className="text-xs text-slate-400 mb-1">Tamaño</p>
                    <p className="text-xs font-bold uppercase inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">{company.company_size || '—'}</p>
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
                    <p className="text-sm text-slate-700">{formatDateTime((company as any).created_at) || '—'}</p>
                  </div>
                </div>
            </div>
          </div>

          {/* Asignaciones */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Asignaciones</h3>
              </div>
              <button
                onClick={openShareModal}
                disabled={!canShare}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                  canShare
                  ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                <i className="fa-solid fa-gear"></i>Gestionar
              </button>
            </div>
            <div className="p-4">
              {(company as any).collaborators && (company as any).collaborators.length > 0 ? (
                <div className="space-y-2">
                  {[...(company as any).collaborators].sort((a: any, b: any) => {
                    const getOrder = (collab: any) => {
                      const level = (collab.permission_level || '').toUpperCase();
                      if (level === 'OWNER' || collab.is_owner) return 0; // Creador primero
                      if (level === 'EDIT') return 1; // Principal segundo
                      if (level === 'VIEW') return 2; // Secundaria tercero
                      return 3; // Sin asignación al final
                    };
                    return getOrder(a) - getOrder(b);
                  }).map((collaborator: any) => (
                    <div key={collaborator.id_user} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {collaborator.avatar ? (
                          <img src={collaborator.avatar} alt={collaborator.name} className="w-6 h-6 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {(collaborator.name || 'U').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-700 truncate flex items-center gap-2">
                            {collaborator.name}
                            {(collaborator.rol_user || '').toLowerCase() === 'admin' && (
                              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] text-amber-500 leading-none align-middle" title="Control total por admin">
                                <i className="fa-solid fa-star"></i>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {(() => {
                          const level = (collaborator.permission_level || '').toUpperCase();
                          if (level === 'OWNER') {
                            return (
                              <>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-star text-[9px]"></i>Creador
                                </span>
                              </>
                            );
                          }
                          if (collaborator.is_owner) {
                            return (
                              <>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-star text-[9px]"></i>Creador
                                </span>
                              </>
                            );
                          }
                          if (level === 'EDIT') {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                <i className="fa-solid fa-crown text-[9px]"></i>Principal
                              </span>
                            );
                          }
                          if (level === 'VIEW') {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                <i className="fa-solid fa-user text-[9px]"></i>Secundaria
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200 inline-flex items-center gap-1">
                              <i className="fa-regular fa-circle text-[9px]"></i>Sin asignación
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">Sin asignaciones</p>
              )}
            </div>
          </div>
        </div>

        {/* Lista Contactos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contactos */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-users text-slate-400"></i> Contactos
                        <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{contacts.length}</span>
                    </h3>
                </div>
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
                                              {(() => {
                                                const contactName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contacto';
                                                const color = getAvatarColor(contactName);
                                                return (
                                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border" style={{ backgroundColor: color.bg, color: color.text, borderColor: color.text }}>
                                                    {getInitials(contactName)}
                                                  </div>
                                                );
                                              })()}
                                              <span className="font-medium text-slate-700">{contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || '—'}</span>
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
          <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative ${(shareModalOpen || isCompanyModalOpen || isModalOpen) ? 'z-0' : ''}`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
                <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
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

      {shareModalOpen && company && (
        <ShareModal
          entity="company"
          id={company.id_client_company}
          entityName={company.name_company || company.name || `Empresa #${company.id_client_company}`}
          creatorName={(company as any).created_by_name || ''}
          isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); }}
          onShared={() => {
            setToast({ message: 'Asignaciones actualizadas.', type: 'success' });
            refreshShareCollaborators();
            refreshCompanyCollaborators();
          }}
          currentCollaborators={shareCollaborators}
        />
      )}

      {/* MODAL EDITAR EMPRESA */}
      <CompanyFormModal 
        isOpen={isCompanyModalOpen} 
        onClose={() => setIsCompanyModalOpen(false)} 
        mode="edit" 
        initialData={editingCompany || undefined} 
        onSuccess={handleCompanyModalSuccess} 
      />

      {/* MODAL DE CONTACTO (Mismo estilo que lista) */}
      {isModalOpen && editingContact && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col m-4">
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
                    {submitting ? <BrandSpinner size="xs" className="mr-2" /> : <i className="fa-solid fa-check mr-2"></i>}
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