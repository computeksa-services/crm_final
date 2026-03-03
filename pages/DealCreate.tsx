import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Deal, ClientCompany, ClientContact, User } from '../types';
import { apiFetch } from '../services/apiClient';
import Toast from '../components/Toast';
import CompanyFormModal from './clients/CompanyFormModal';
import ContactFormModal from './clients/ContactFormModal';

const DealCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Usar datos del cache centralizado
  const { 
    companies: cachedCompanies, 
    contacts: cachedContacts,
    dealStatuses: cachedDealStatuses,
    dealInterests: cachedDealInterests,
    dealChannels: cachedDealChannels,
    users: cachedUsers,
    loading: cacheLoading,
    invalidateContacts,
    invalidateCompanies
  } = useDataCache();

  const [deal, setDeal] = useState<Partial<Deal>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isConversion, setIsConversion] = useState(false); // Estado para modo conversión

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  
  // Modal states
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  
  const [expandedSections, setExpandedSections] = useState({ status: false, interest: false, channel: false });

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setExpandedSections({ status: false, interest: false, channel: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Efecto unificado para inicializar el estado del trato
  useEffect(() => {
    if (cacheLoading || !user) return;

    // 1. Obtener valores por defecto
    const defaultStatus = cachedDealStatuses.find(s => s.is_default) || cachedDealStatuses[0];
    const defaultInterest = cachedDealInterests.find(i => i.is_default) || cachedDealInterests[0];
    const defaultChannel = cachedDealChannels.find(c => c.is_default) || cachedDealChannels[0];

    // 2. Leer parámetros de la URL
    const queryParams = new URLSearchParams(location.search);
    const clientCompanyId = queryParams.get('clientCompanyId');
    const contactId = queryParams.get('contactId');

    // 3. Construir estado inicial en un solo paso
    const initialState: Partial<Deal> = {
      nombre_trato: '',
      valor_trato: '',
      descripcion: '',
      id_deal_status: defaultStatus?.id_status,
      id_interest: defaultInterest?.id_interest,
      channel: defaultChannel?.id_channel,
      id_tenant: user.id_tenant,
      id_user_owner: user.id_user,
      id_user: user.id_user,
    };

    if (clientCompanyId && contactId) {
      setIsConversion(true);
      initialState.id_client_company = clientCompanyId;
      initialState.id_contact = contactId;
    }

    setDeal(initialState);

  }, [cacheLoading, user, location.search, cachedDealStatuses, cachedDealInterests, cachedDealChannels]);
  
  // Filtrar contactos de forma reactiva
  const filteredContacts = useMemo(() => {
    if (!deal.id_client_company) return [];
    return cachedContacts.filter(c => String(c.id_client_company) === String(deal.id_client_company));
  }, [deal.id_client_company, cachedContacts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'id_client_company') {
      if (value === '__ADD_NEW_COMPANY__') {
        setIsCompanyModalOpen(true);
        return;
      }
      setDeal(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
    } else if (name === 'id_contact') {
      if (value === '__ADD_NEW_CONTACT__') {
        setIsContactModalOpen(true);
        return;
      }
      setDeal(prev => ({ ...prev, [name]: value }));
    } else {
      setDeal(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCompanyCreated = async (newCompany: ClientCompany) => {
    setDeal(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
    setFilteredContacts(cachedContacts.filter(c => String(c.id_client_company) === String(newCompany.id_client_company)));
    setIsCompanyModalOpen(false);
    await invalidateCompanies(); // Recargar caché
    setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
  };

  const handleContactCreated = async (newContact: ClientContact) => {
    if (newContact.id_client_company && String(newContact.id_client_company) === String(deal.id_client_company)) {
      setFilteredContacts(prev => [...prev, newContact]);
    }
    setDeal(prev => ({ ...prev, id_contact: newContact.id_contact }));
    setIsContactModalOpen(false);
    await invalidateContacts(); // Recargar caché
    setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
  };

  const handleSave = async () => {
    if (!deal.nombre_trato || !deal.id_client_company || !deal.id_contact || !deal.id_deal_status) {
      setToast({ message: 'Nombre, Empresa, Contacto y Estado son obligatorios.', type: 'error' });
      return;
    }

    setProcessing(true);
    try {
      const payload = { 
        ...deal, 
        created_at: new Date().toISOString(),
        is_conversion: isConversion 
      };
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = 'Error al crear el trato';
        try {
          if (text) {
            const err = JSON.parse(text);
            errorMsg = err.message || errorMsg;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const newId = data?.id_trato || data?.id || data?.data?.id_trato;

      if (!newId) throw new Error('No se obtuvo el ID del trato creado');

      await invalidateContacts(); // Invalidar el caché de contactos

      if (selectedUserIds.length > 0) {
        await Promise.all(selectedUserIds.map(uid => 
          apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`, {
            method: 'POST',
            body: JSON.stringify({
              id_tenant: user?.id_tenant,
              id_trato: newId,
              id_user_target: uid,
              permission_level: sharePermission
            })
          })
        ));
      }

      setToast({ message: 'Trato creado correctamente.', type: 'success' });
      setTimeout(() => navigate(`/app/deals/${newId}`), 1000);
    } catch (e: any) {
      setToast({ message: e.message || 'Error en el proceso', type: 'error' });
      setProcessing(false);
    }
  };

  // Helpers para encontrar elementos seleccionados
  const selectedStatus = useMemo(() => 
    cachedDealStatuses.find((s: any) => String(s.id_status || s.id) === String(deal.id_deal_status)), 
    [cachedDealStatuses, deal.id_deal_status]
  );
  
  const selectedInterest = useMemo(() => 
    cachedDealInterests.find((i: any) => String(i.id_interest || i.id) === String(deal.id_interest)), 
    [cachedDealInterests, deal.id_interest]
  );
  
  const selectedChannel = useMemo(() => 
    cachedDealChannels.find((c: any) => String(c.id_channel || c.id) === String(deal.channel)), 
    [cachedDealChannels, deal.channel]
  );
  
  const selectedCompany = useMemo(() => 
    cachedCompanies.find(c => String(c.id_client_company) === String(deal.id_client_company)), 
    [cachedCompanies, deal.id_client_company]
  );
  
  const selectedContact = useMemo(() => 
    cachedContacts.find(c => String(c.id_contact) === String(deal.id_contact)), 
    [cachedContacts, deal.id_contact]
  );

  const availableUsers = useMemo(() => 
    cachedUsers.filter((u: User) => u.id_user !== user?.id_user),
    [cachedUsers, user?.id_user]
  );

  return (
    <div className="w-full bg-slate-50 min-h-screen animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-white dark:bg-slate-500 border-b border-slate-200 dark:border-slate-400 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                 <i className="fa-solid fa-arrow-left text-lg"></i>
             </button>
             <h1 className="text-lg md:text-xl font-extrabold text-slate-800">Nuevo Trato</h1>
         </div>
         <div className="flex gap-3">
             <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-bold hover:bg-slate-50">
                 Cancelar
             </button>
             <button onClick={handleSave} disabled={processing || cacheLoading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-50">
                 {processing ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-check"></i>}
                 Guardar
             </button>
         </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1920px] mx-auto pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
              
              {/* COL 1: INFO */}
              <div className="bg-white dark:bg-slate-600 rounded-xl shadow-sm border border-slate-200 dark:border-slate-500 p-5 flex flex-col gap-5">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-200 uppercase tracking-wider border-b dark:border-slate-500 pb-2 flex items-center gap-2">
                      <i className="fa-solid fa-file-invoice text-indigo-500"></i> Información
                  </h3>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Nombre del Trato *</label>
                      <input name="nombre_trato" value={deal.nombre_trato || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-300 dark:bg-slate-400 dark:text-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej. Venta de Servidores" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Valor Estimado</label>
                      <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                          <input name="valor_trato" value={deal.valor_trato || ''} onChange={handleInputChange} className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono" placeholder="0.00" />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Descripción</label>
                      <textarea name="descripcion" value={deal.descripcion || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50" placeholder="Detalles adicionales..."></textarea>
                  </div>
              </div>

              {/* COL 2: CLIENTE */}
              <div className="bg-white dark:bg-slate-600 rounded-xl shadow-sm border border-slate-200 dark:border-slate-500 p-5 flex flex-col gap-5">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-200 uppercase tracking-wider border-b dark:border-slate-500 pb-2 flex items-center gap-2">
                      <i className="fa-solid fa-building-user text-indigo-500"></i> Cliente
                  </h3>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Empresa *</label>
                      <select name="id_client_company" value={deal.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-400 dark:text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-500 disabled:text-slate-500 dark:disabled:text-slate-700" disabled={cacheLoading || isConversion}>
                          <option value="">{cacheLoading ? 'Cargando...' : '-- Seleccionar Empresa --'}</option>
                          <option value="__ADD_NEW_COMPANY__" className="font-bold text-emerald-600 bg-emerald-50">+ Nueva Empresa</option>
                          {cachedCompanies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                      </select>
                  </div>
                  {selectedCompany && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-xs space-y-2">
                          <div className="flex items-start justify-between">
                              <div className="flex-1">
                                  <p className="font-bold text-indigo-900 text-sm mb-1">{selectedCompany.name_company}</p>
                                  <p className="text-indigo-600 font-mono text-xs">{selectedCompany.id_number}</p>
                              </div>
                              <div className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded text-[10px] font-bold">
                                  {selectedCompany.label_name || selectedCompany.id_label}
                              </div>
                          </div>
                          <div className="space-y-1 text-indigo-700">
                              <p className="flex items-center gap-2"><i className="fa-solid fa-location-dot opacity-50 w-3"></i> {selectedCompany.city}, {selectedCompany.country_name || selectedCompany.id_country}</p>
                              {selectedCompany.phone_company && <p className="flex items-center gap-2"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedCompany.phone_company}</p>}
                              {selectedCompany.email_company && <p className="flex items-center gap-2"><i className="fa-solid fa-envelope opacity-50 w-3"></i> {selectedCompany.email_company}</p>}
                              {selectedCompany.website && <p className="flex items-center gap-2"><i className="fa-solid fa-globe opacity-50 w-3"></i> {selectedCompany.website}</p>}
                          </div>
                      </div>
                  )}
                  {deal.id_client_company && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto *</label>
                      <select name="id_contact" value={deal.id_contact || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500" disabled={cacheLoading || isConversion}>
                          <option value="">{cacheLoading ? 'Cargando...' : '-- Seleccionar Contacto --'}</option>
                          <option value="__ADD_NEW_CONTACT__" className="font-bold text-emerald-600 bg-emerald-50">+ Nuevo Contacto</option>
                          {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                      </select>
                      {selectedContact && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2 mt-3">
                              <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                      {selectedContact.first_name?.charAt(0)}{selectedContact.last_name?.charAt(0)}
                                  </div>
                                  <div className="flex-1">
                                      <p className="font-bold text-slate-800">{selectedContact.first_name} {selectedContact.last_name}</p>
                                      {selectedContact.position && <p className="text-slate-500 text-[10px]">{selectedContact.position}</p>}
                                  </div>
                              </div>
                              <div className="space-y-1 text-slate-600">
                                  <p className="flex items-center gap-2"><i className="fa-solid fa-envelope opacity-50 w-3"></i> {selectedContact.email}</p>
                                  {selectedContact.phone && <p className="flex items-center gap-2"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedContact.phone}</p>}
                              </div>
                          </div>
                      )}
                    </div>
                  )}
              </div>

              {/* COL 3: CLASIFICACIÓN */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                      <i className="fa-solid fa-filter text-indigo-500"></i> Clasificación
                  </h3>

                  {/* Dropdown Estado */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Estado del Pipeline *</label>
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, status: !p.status}))} disabled={cacheLoading} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between disabled:opacity-60" style={{ backgroundColor: selectedStatus ? `${selectedStatus.color}15` : '#f8fafc', color: selectedStatus?.color || '#64748b', borderColor: selectedStatus?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedStatus ? <><i className={selectedStatus.icon}></i> {selectedStatus.nombre_estado || selectedStatus.name}</> : 'Seleccionar Estado'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.status ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.status && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {cachedDealStatuses.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay estados configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  cachedDealStatuses.map(s => (
                                      <button key={s.id_status || (s as any).id} onClick={() => { setDeal(p => ({...p, id_deal_status: s.id_status || (s as any).id})); setExpandedSections(p => ({...p, status: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: s.color }}>
                                          <i className={s.icon}></i> {s.nombre_estado || s.name}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}
                  </div>

                  {/* Dropdown Interés */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Nivel de Interés *</label>
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, interest: !p.interest}))} disabled={cacheLoading} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between disabled:opacity-60" style={{ backgroundColor: selectedInterest ? `${selectedInterest.color}15` : '#f8fafc', color: selectedInterest?.color || '#64748b', borderColor: selectedInterest?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedInterest ? <><i className={selectedInterest.icon}></i> {selectedInterest.nombre_interes || selectedInterest.name}</> : 'Seleccionar Interés'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.interest ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.interest && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {cachedDealInterests.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay niveles de interés configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  cachedDealInterests.map(i => (
                                      <button key={i.id_interest || (i as any).id} onClick={() => { setDeal(p => ({...p, id_interest: i.id_interest || (i as any).id})); setExpandedSections(p => ({...p, interest: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: i.color }}>
                                          <i className={i.icon}></i> {i.nombre_interes || i.name}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}
                  </div>

                  {/* Dropdown Canal */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Canal de Origen *</label>
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, channel: !p.channel}))} disabled={cacheLoading} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between disabled:opacity-60" style={{ backgroundColor: selectedChannel ? `${selectedChannel.color}15` : '#f8fafc', color: selectedChannel?.color || '#64748b', borderColor: selectedChannel?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedChannel ? <><i className={selectedChannel.icon}></i> {selectedChannel.name}</> : 'Seleccionar Canal'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.channel ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.channel && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {cachedDealChannels.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay canales configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  cachedDealChannels.map(c => (
                                      <button key={c.id_channel || (c as any).id} onClick={() => { setDeal(p => ({...p, channel: c.id_channel || (c as any).id})); setExpandedSections(p => ({...p, channel: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: c.color }}>
                                          <i className={c.icon}></i> {c.name}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}
                  </div>
              </div>

              {/* COL 4: EQUIPO */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 h-full">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <i className="fa-solid fa-users text-indigo-500"></i> Colaboradores
                    </h3>
                    <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{selectedUserIds.length}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold">
                     <button type="button" onClick={() => setSelectedUserIds(prev => prev.length === availableUsers.length ? [] : availableUsers.map(u => u.id_user))} className="text-indigo-600 hover:underline">
                        {selectedUserIds.length === availableUsers.length ? 'DESELECCIONAR TODOS' : 'SELECCIONAR TODOS'}
                     </button>
                     <div className="flex bg-slate-100 rounded p-0.5">
                        <button onClick={() => setSharePermission('VIEW')} className={`px-2 py-0.5 rounded ${sharePermission === 'VIEW' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>VER</button>
                        <button onClick={() => setSharePermission('EDIT')} className={`px-2 py-0.5 rounded ${sharePermission === 'EDIT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>EDITAR</button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-50 rounded-lg">
                      {availableUsers.map(u => (
                          <label key={u.id_user} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                              <input type="checkbox" checked={selectedUserIds.includes(u.id_user)} onChange={() => setSelectedUserIds(prev => prev.includes(u.id_user) ? prev.filter(id => id !== u.id_user) : [...prev, u.id_user])} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                                  {u.name_user?.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 truncate">{u.name_user}</p>
                                <p className="text-[10px] text-slate-400 truncate">{u.email_user}</p>
                              </div>
                          </label>
                      ))}
                      {availableUsers.length === 0 && <p className="text-xs text-slate-400 text-center py-10">No hay otros usuarios disponibles.</p>}
                  </div>
              </div>

          </div>
      </div>

      {/* Modals para creación inline */}
      <CompanyFormModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        mode="create"
        onSuccess={handleCompanyCreated}
      />
      
      <ContactFormModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        mode="create"
        initialData={deal.id_client_company ? { id_client_company: deal.id_client_company } : undefined}
        onSuccess={handleContactCreated}
        companies={cachedCompanies}
      />
    </div>
  );
};

export default DealCreate;
