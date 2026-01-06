import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, CustomStatus, User, DealChannel } from '../types';
import Toast from '../components/Toast';

const DealCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [deal, setDeal] = useState<Partial<Deal>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);
  const [dealChannels, setDealChannels] = useState<DealChannel[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [loading, setLoading] = useState(true);
  
  const [expandedSections, setExpandedSections] = useState({ status: false, interest: false, channel: false });
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    const { id_tenant, id_user } = user;
    const queryParams = new URLSearchParams(location.search);

    try {
      setLoading(true);
      const endpoints = [
        { name: 'Empresas', url: `/api/clients/companies` },
        { name: 'Contactos', url: `/api/clients/contacts` },
        { name: 'Estados', url: `/api/statuses/deals` },
        { name: 'Intereses', url: `/api/statuses/interests` },
        { name: 'Canales', url: `/api/channel` },
        { name: 'Usuarios', url: `/api/users` }
      ];

      const parseData = async (res: Response, endpointName: string) => {
        if (!res.ok) {
          console.warn(`⚠️ ${endpointName}: respuesta no exitosa (${res.status})`);
          return [];
        }
        
        const text = await res.text();
        
        // Si la respuesta está vacía, retornar array vacío
        if (!text || text.trim() === '') {
          console.warn(`⚠️ ${endpointName}: respuesta vacía`);
          return [];
        }
        
        try {
          const json = JSON.parse(text);
          // Manejar si el backend devuelve { data: [...] } o el array directo
          return Array.isArray(json) ? json : (json.data || []);
        } catch (e) {
          console.error(`❌ ${endpointName}: error parseando JSON`, text.substring(0, 100));
          return [];
        }
      };

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          fetch(`${import.meta.env.VITE_WEBHOOK_URL}${endpoint.url}?id_tenant=${id_tenant}&id_user=${id_user}`)
        )
      );

      const [
        companiesData, 
        contactsData, 
        dealStatusesData, 
        interestStatusesData, 
        channelsData, 
        usersData
      ] = await Promise.all(responses.map((res, idx) => parseData(res, endpoints[idx].name)));

      console.log('🔍 DATOS CARGADOS EN DEALCREATE:');
      console.log('  📋 Empresas:', companiesData?.length || 0, companiesData);
      console.log('  👤 Contactos:', contactsData?.length || 0);
      console.log('  🎯 Estados de Trato:', dealStatusesData?.length || 0, dealStatusesData);
      console.log('  ⭐ Niveles de Interés:', interestStatusesData?.length || 0, interestStatusesData);
      console.log('  📡 Canales:', channelsData?.length || 0, channelsData);
      console.log('  👥 Usuarios:', usersData?.length || 0, usersData);

      setCompanies(companiesData);
      setContacts(contactsData);
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);
      setDealChannels(channelsData);
      setAvailableUsers(usersData.filter((u: User) => u.id_user !== id_user));
      
      // Lógica para IDs por defecto
      const defaultStatus = dealStatusesData.find((s: any) => s.is_default) || dealStatusesData[0];
      const defaultInterest = interestStatusesData.find((s: any) => s.is_default) || interestStatusesData[0];
      const defaultChannel = channelsData.find((c: any) => c.is_default) || channelsData[0];

      // Normalización del ID de interés (puede venir como id_status o id_interest)
      const getInterestId = (item: any) => item?.id_status || item?.id_interest || item?.id || '';

      let initialState: Partial<Deal> = {
        nombre_trato: '',
        valor_trato: '',
        id_client_company: queryParams.get('clientCompanyId') || '',
        id_contact: queryParams.get('contactId') || '',
        id_deal_status: defaultStatus?.id_status || defaultStatus?.id || '',
        id_interest: getInterestId(defaultInterest),
        id_channel: defaultChannel?.id_channel || defaultChannel?.id || '',
        id_tenant: id_tenant,
        id_user_owner: id_user,
        id_user: id_user,
        descripcion: '',
      };

      if (initialState.id_client_company) {
        setFilteredContacts(contactsData.filter((c: ClientContact) => String(c.id_client_company) === String(initialState.id_client_company)));
      }
      setDeal(initialState);
    } catch (e) {
      console.error("Error fetching data:", e);
      setToast({ message: 'Error cargando datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, location.search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Manejador de clics fuera para cerrar dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-dropdown-container]')) {
        setExpandedSections({ status: false, interest: false, channel: false });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'id_client_company') {
      setDeal(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
      setFilteredContacts(contacts.filter(c => String(c.id_client_company) === String(value)));
    } else {
      setDeal(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!deal.nombre_trato || !deal.id_client_company || !deal.id_contact || !deal.id_deal_status) {
      setToast({ message: 'Nombre, Empresa, Contacto y Estado son obligatorios.', type: 'error' });
      return;
    }
    setProcessing(true);
    try {
      const payload = { ...deal, created_at: new Date().toISOString() };
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, { 
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

      if (selectedUserIds.length > 0) {
        await Promise.all(selectedUserIds.map(uid => 
          fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  // Helpers para encontrar los labels seleccionados (asegurando comparación de strings)
  const selectedStatus = useMemo(() => dealStatuses.find(s => String(s.id_status || s.id) === String(deal.id_deal_status)), [dealStatuses, deal.id_deal_status]);
  const selectedInterest = useMemo(() => interestStatuses.find(i => String((i as any).id_status || (i as any).id_interest || i.id) === String(deal.id_interest)), [interestStatuses, deal.id_interest]);
  const selectedChannel = useMemo(() => dealChannels.find(c => String(c.id_channel || c.id) === String(deal.id_channel)), [dealChannels, deal.id_channel]);
  const selectedCompany = useMemo(() => companies.find(c => String(c.id_client_company) === String(deal.id_client_company)), [companies, deal.id_client_company]);
  const selectedContact = useMemo(() => contacts.find(c => String(c.id_contact) === String(deal.id_contact)), [contacts, deal.id_contact]);

  return (
    <div className="w-full bg-slate-50 min-h-screen animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
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
             <button onClick={handleSave} disabled={processing || loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-50">
                 {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                 Guardar
             </button>
         </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1920px] mx-auto pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
              
              {/* COL 1: INFO */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                      <i className="fa-solid fa-file-invoice text-indigo-500"></i> Información
                  </h3>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del Trato *</label>
                      <input name="nombre_trato" value={deal.nombre_trato || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej. Venta de Servidores" />
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
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                      <i className="fa-solid fa-building-user text-indigo-500"></i> Cliente
                  </h3>
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa *</label>
                      <select name="id_client_company" value={deal.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="">-- Seleccionar Empresa --</option>
                          {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                      </select>
                  </div>
                  {selectedCompany && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
                          <p className="font-bold text-indigo-900">{selectedCompany.name_company}</p>
                          <p className="text-indigo-700 flex items-center gap-2"><i className="fa-solid fa-location-dot opacity-50"></i> {selectedCompany.city || 'Sin ciudad'}</p>
                      </div>
                  )}
                  {deal.id_client_company && (
                    <div className="mt-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto *</label>
                      <select name="id_contact" value={deal.id_contact || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="">-- Seleccionar Contacto --</option>
                          {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                      </select>
                      {selectedContact && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1 mt-2">
                              <p className="font-bold text-slate-700">{selectedContact.first_name} {selectedContact.last_name}</p>
                              <p className="text-slate-500"><i className="fa-solid fa-envelope mr-1 opacity-50"></i> {selectedContact.email}</p>
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
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, status: !p.status}))} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" style={{ backgroundColor: selectedStatus ? `${selectedStatus.color}15` : '#f8fafc', color: selectedStatus?.color || '#64748b', borderColor: selectedStatus?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedStatus ? <><i className={selectedStatus.icon}></i> {selectedStatus.name}</> : 'Seleccionar Estado'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.status ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.status && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {dealStatuses.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay estados configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  dealStatuses.map(s => (
                                      <button key={s.id_status || (s as any).id} onClick={() => { setDeal(p => ({...p, id_deal_status: s.id_status || (s as any).id})); setExpandedSections(p => ({...p, status: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: s.color }}>
                                          <i className={s.icon}></i> {s.name}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}
                  </div>

                  {/* Dropdown Interés */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Nivel de Interés *</label>
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, interest: !p.interest}))} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" style={{ backgroundColor: selectedInterest ? `${selectedInterest.color}15` : '#f8fafc', color: selectedInterest?.color || '#64748b', borderColor: selectedInterest?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedInterest ? <><i className={selectedInterest.icon}></i> {selectedInterest.name}</> : 'Seleccionar Interés'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.interest ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.interest && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {interestStatuses.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay niveles de interés configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  interestStatuses.map(i => {
                                      const id = (i as any).id_status || (i as any).id_interest || i.id;
                                      return (
                                        <button key={id} onClick={() => { setDeal(p => ({...p, id_interest: id})); setExpandedSections(p => ({...p, interest: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: i.color }}>
                                            <i className={i.icon}></i> {i.name}
                                        </button>
                                      );
                                  })
                              )}
                          </div>
                      )}
                  </div>

                  {/* Dropdown Canal */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Canal de Origen *</label>
                      <button type="button" onClick={() => setExpandedSections(p => ({...p, channel: !p.channel}))} className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" style={{ backgroundColor: selectedChannel ? `${selectedChannel.color}15` : '#f8fafc', color: selectedChannel?.color || '#64748b', borderColor: selectedChannel?.color || '#e2e8f0' }}>
                          <span className="flex items-center gap-2">
                            {selectedChannel ? <><i className={selectedChannel.icon}></i> {selectedChannel.name}</> : 'Seleccionar Canal'}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedSections.channel ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.channel && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-60 overflow-y-auto">
                              {dealChannels.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                      <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 text-amber-400"></i>
                                      <p className="font-bold">No hay canales configurados</p>
                                      <p className="text-[10px] mt-1">Ve a Ajustes para configurarlos</p>
                                  </div>
                              ) : (
                                  dealChannels.map(c => (
                                      <button key={c.id_channel || c.id} onClick={() => { setDeal(p => ({...p, id_channel: c.id_channel || c.id})); setExpandedSections(p => ({...p, channel: false})); }} className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" style={{ color: c.color }}>
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
    </div>
  );
};

export default DealCreate;