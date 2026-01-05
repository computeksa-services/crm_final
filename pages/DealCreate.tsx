import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, CustomStatus, User, DealChannel } from '../types';
import Toast from '../components/Toast';

const DealCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // --- ESTADOS Y LÓGICA (Sin cambios funcionales) ---
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
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Estados para las secciones desplegables de Clasificación
  const [expandedSections, setExpandedSections] = useState({ status: false, interest: false, channel: false });
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    const tenantId = user.id_tenant;
    const userId = user.id_user;
    const queryParams = new URLSearchParams(location.search);

    try {
      setLoadingUsers(true);
      const [companiesRes, contactsRes, dealStatusesRes, interestStatusesRes, channelsRes, usersRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/interests?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/channel?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${tenantId}&id_user=${userId}`),
      ]);

      const parseResponse = async (res: Response) => res.ok ? JSON.parse(await res.text()) : [];

      const [companiesData, contactsData, dealStatusesData, interestStatusesData, channelsData, usersData] = await Promise.all([
        parseResponse(companiesRes),
        parseResponse(contactsRes),
        parseResponse(dealStatusesRes),
        parseResponse(interestStatusesRes),
        parseResponse(channelsRes),
        parseResponse(usersRes)
      ]);

      setCompanies(companiesData);
      setContacts(contactsData);
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);
      setDealChannels(channelsData);
      setAvailableUsers(Array.isArray(usersData) ? usersData.filter((u: User) => u.id_user !== userId) : []);
      
      const defaultStatus = dealStatusesData.find((s: CustomStatus) => s.is_default) || dealStatusesData[0];
      const defaultInterest = interestStatusesData.find((s: CustomStatus) => s.is_default) || interestStatusesData[0];
      const defaultInterestId = (defaultInterest?.id_status as string) || (defaultInterest as any)?.id_interest || '';
      const defaultChannel = channelsData.find((c: DealChannel) => c.is_default) || channelsData[0];

      let initialState: Partial<Deal> = {
        nombre_trato: '',
        valor_trato: '',
        id_client_company: queryParams.get('clientCompanyId') || '',
        id_contact: queryParams.get('contactId') || '',
        id_deal_status: defaultStatus?.id_status || '',
        id_interest: defaultInterestId,
        id_channel: defaultChannel?.id_channel || '',
        id_tenant: tenantId,
        id_user_owner: userId,
        id_user: userId,
        descripcion: '',
      };

      if (initialState.id_client_company) {
        setFilteredContacts(contactsData.filter((c: ClientContact) => c.id_client_company === initialState.id_client_company));
      }
      setDeal(initialState);
    } catch (e) {
      setToast({ message: 'Error cargando datos.', type: 'error' });
    } finally {
      setLoadingUsers(false);
    }
  }, [user, location.search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cerrar dropdowns al hacer clic fuera o cuando el mouse sale del dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const dropdownContainer = target.closest('[data-dropdown-container]');
      
      if (!dropdownContainer) {
        setExpandedSections({ status: false, interest: false, channel: false });
      }
    };

    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target && target instanceof HTMLElement && target.hasAttribute('data-dropdown-container') && closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target && target instanceof HTMLElement && target.hasAttribute('data-dropdown-container')) {
        closeTimeoutRef.current = setTimeout(() => {
          setExpandedSections({ status: false, interest: false, channel: false });
        }, 300);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'id_client_company') {
      setDeal(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
      setFilteredContacts(contacts.filter(c => c.id_client_company === value));
    } else {
      setDeal(prev => ({ ...prev, [name]: value }));
    }
  };

  const selectedCompany = useMemo(() => companies.find(c => c.id_client_company === deal.id_client_company), [companies, deal.id_client_company]);
  const selectedContact = useMemo(() => contacts.find(c => c.id_contact === deal.id_contact), [contacts, deal.id_contact]);

  const handleSave = async () => {
    if (!deal.nombre_trato || !deal.id_client_company || !deal.id_contact || !deal.id_deal_status || !deal.id_channel) {
      setToast({ message: 'Nombre, Empresa, Contacto, Estado y Canal son obligatorios.', type: 'error' });
      return;
    }
    setProcessing(true);
    try {
      // Paso 1: Crear el trato
      const payload = { ...deal, id_tenant: user?.id_tenant, id_user: user?.id_user, created_at: new Date().toISOString() };
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Error al crear el trato');
      const data = await res.json();
      const newId = data?.id_trato || data?.id;

      if (!newId) throw new Error('No se obtuvo el ID del trato creado');

      // Paso 2: Compartir con colaboradores seleccionados
      if (selectedUserIds.length > 0) {
        const sharePromises = selectedUserIds.map(uid => 
          fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_tenant: user?.id_tenant,
              id_trato: newId,
              id_user_target: uid,
              permission_level: sharePermission
            })
          }).then(r => {
            if (!r.ok) throw new Error(`Error compartiendo con usuario ${uid}`);
            return r.json();
          })
        );
        await Promise.all(sharePromises);
      }

      setToast({ message: 'Trato creado correctamente.', type: 'success' });
      setTimeout(() => navigate(`/app/deals/${newId}`), 1000);
    } catch (e: any) {
      setToast({ message: e.message || 'Error en el proceso', type: 'error' });
      setProcessing(false);
    }
  };

  // --- COMPONENTES VISUALES ---

  const renderStatusSelector = () => (
    <div className="flex flex-col gap-1.5">
      {dealStatuses.map(status => {
        const isSelected = deal.id_deal_status === status.id_status;
        return (
          <button
            key={status.id_status}
            type="button"
            onClick={() => {
              setDeal(prev => ({ ...prev, id_deal_status: status.id_status }));
              setExpandedSections(prev => ({ ...prev, status: false }));
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-bold text-left flex items-center gap-2 transition-all ${
                isSelected ? 'ring-2 ring-offset-1 border-transparent shadow-sm' : 'hover:brightness-95 border-transparent'
            }`}
            style={{
                backgroundColor: `${status.color || '#cccccc'}20`,
                color: status.color || '#333',
                borderColor: isSelected ? status.color : 'transparent',
                ['--tw-ring-color' as any]: status.color
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/50 text-sm">
                 {status.icon && <i className={status.icon}></i>}
            </div>
            <span className="flex-1">{status.name}</span>
            {isSelected && <i className="fa-solid fa-check text-sm"></i>}
          </button>
        );
      })}
    </div>
  );

  const renderInterestSelector = () => (
    <div className="flex flex-col gap-1.5">
      {interestStatuses.map(int => {
        const valueId = (int as any).id_status || (int as any).id_interest || (int as any).id;
        const isSelected = deal.id_interest === valueId;
        return (
          <button
            key={valueId}
            type="button"
            onClick={() => {
              setDeal(prev => ({ ...prev, id_interest: valueId }));
              setExpandedSections(prev => ({ ...prev, interest: false }));
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-bold text-left flex items-center gap-2 transition-all ${
                isSelected ? 'ring-2 ring-offset-1 border-transparent shadow-sm' : 'hover:brightness-95 border-transparent'
            }`}
            style={{
                backgroundColor: `${int.color || '#cccccc'}20`,
                color: int.color || '#333',
                borderColor: isSelected ? int.color : 'transparent',
                ['--tw-ring-color' as any]: int.color
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/50 text-sm">
                 {int.icon && <i className={int.icon}></i>}
            </div>
            <span className="flex-1">{int.name}</span>
            {isSelected && <i className="fa-solid fa-check text-sm"></i>}
          </button>
        );
      })}
    </div>
  );

  const renderCanalSelector = () => (
    <div className="flex flex-col gap-1.5">
      {dealChannels.map(channel => {
        const isSelected = deal.id_channel === channel.id_channel;
        return (
          <button
            key={channel.id_channel}
            type="button"
            onClick={() => {
              setDeal(prev => ({ ...prev, id_channel: channel.id_channel }));
              setExpandedSections(prev => ({ ...prev, channel: false }));
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-bold text-left flex items-center gap-2 transition-all ${
                isSelected ? 'ring-2 ring-offset-1 border-transparent shadow-sm' : 'hover:brightness-95 border-transparent'
            }`}
            style={{
                backgroundColor: `${channel.color || '#cccccc'}20`,
                color: channel.color || '#333',
                borderColor: isSelected ? channel.color : 'transparent',
                ['--tw-ring-color' as any]: channel.color
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/50 text-sm">
                 {channel.icon && <i className={channel.icon}></i>}
            </div>
            <span className="flex-1">{channel.name}</span>
            {isSelected && <i className="fa-solid fa-check text-sm"></i>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full bg-slate-50 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER UNIFICADO */}
      <div className="z-50 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                 <i className="fa-solid fa-arrow-left text-lg md:text-xl"></i>
             </button>
             <h1 className="text-lg md:text-xl font-extrabold text-slate-800">Nuevo Trato</h1>
         </div>
         <div className="flex gap-3">
             <button onClick={() => navigate(-1)} className="px-4 md:px-5 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs md:text-sm font-bold hover:bg-slate-50 transition-colors">
                 Cancelar
             </button>
             <button onClick={handleSave} disabled={processing} className="px-4 md:px-6 py-2 rounded-lg bg-brand-600 text-white text-xs md:text-sm font-bold hover:bg-brand-700 shadow-md flex items-center gap-2 transition-all">
                 {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                 Guardar
             </button>
         </div>
      </div>

      {/* LAYOUT DE 4 COLUMNAS (Estilo Kanban/Dashboard) */}
      <div className="p-4 md:p-6 max-w-[1920px] mx-auto pb-8 md:pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
              
              {/* COLUMNA 1: DETALLES PRINCIPALES */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 h-full">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 border-b pb-2">
                      <i className="fa-solid fa-file-invoice text-brand-500"></i> Información
                  </h3>
                  
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del Trato <span className="text-red-500">*</span></label>
                      <input 
                        name="nombre_trato" 
                        value={deal.nombre_trato || ''} 
                        onChange={handleInputChange} 
                        autoFocus
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                        placeholder="Ej. Venta de Servidores"
                      />
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Valor Estimado</label>
                      <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-500 font-bold">$</span>
                          <input 
                            name="valor_trato" 
                            value={deal.valor_trato || ''} 
                            onChange={handleInputChange} 
                            className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                            placeholder="0.00"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Descripción</label>
                      <textarea 
                        name="descripcion" 
                        value={deal.descripcion || ''} 
                        onChange={handleInputChange} 
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none bg-slate-50"
                        placeholder="Escribe los detalles aquí..."
                      ></textarea>
                  </div>
              </div>

              {/* COLUMNA 2: CLIENTE */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 h-full">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 border-b pb-2">
                      <i className="fa-solid fa-building-user text-brand-500"></i> Cliente
                  </h3>

                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select name="id_client_company" value={deal.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer">
                            <option value="">-- Seleccionar --</option>
                            {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-xs text-slate-400 pointer-events-none"></i>
                      </div>
                  </div>

                  {/* VISTA PREVIA EMPRESA */}
                  {selectedCompany && (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
                          <p className="font-bold text-indigo-900">{selectedCompany.name_company}</p>
                          <p className="text-indigo-700 flex items-center gap-2"><i className="fa-solid fa-id-card opacity-50"></i> {selectedCompany.id_number || 'N/A'}</p>
                          <p className="text-indigo-700 flex items-center gap-2"><i className="fa-solid fa-location-dot opacity-50"></i> {selectedCompany.city || ''}</p>
                      </div>
                  )}

                  {deal.id_client_company && (
                    <div className="mt-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select name="id_contact" value={deal.id_contact || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer">
                            <option value="">-- Seleccionar --</option>
                            {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-xs text-slate-400 pointer-events-none"></i>
                      </div>

                      {/* VISTA PREVIA CONTACTO */}
                      {selectedContact && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1 mt-2">
                              <p className="font-bold text-slate-700">{selectedContact.first_name} {selectedContact.last_name}</p>
                              <p className="text-slate-500 flex items-center gap-2"><i className="fa-solid fa-envelope opacity-50"></i> {selectedContact.email}</p>
                              <p className="text-slate-500 flex items-center gap-2"><i className="fa-solid fa-phone opacity-50"></i> {selectedContact.phone || '-'}</p>
                          </div>
                      )}
                    </div>
                  )}
              </div>

              {/* COLUMNA 3: CLASIFICACIÓN (Dropdowns) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 h-full">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 border-b pb-2">
                      <i className="fa-solid fa-filter text-brand-500"></i> Clasificación
                  </h3>

                  {/* DROPDOWN 1: ESTADO */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Estado del Pipeline <span className="text-red-500">*</span></label>
                      <button
                          type="button"
                          onClick={() => setExpandedSections(prev => ({ ...prev, status: !prev.status }))}
                          className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition"
                          style={{
                              backgroundColor: dealStatuses.find(s => s.id_status === deal.id_deal_status) ? `${dealStatuses.find(s => s.id_status === deal.id_deal_status)?.color}10` : 'transparent',
                              color: dealStatuses.find(s => s.id_status === deal.id_deal_status)?.color || '#666'
                          }}
                      >
                          <span className="flex items-center gap-2">
                              {dealStatuses.find(s => s.id_status === deal.id_deal_status) ? (
                                  <>
                                      <i className={dealStatuses.find(s => s.id_status === deal.id_deal_status)?.icon}></i>
                                      {dealStatuses.find(s => s.id_status === deal.id_deal_status)?.name}
                                  </>
                              ) : (
                                  'Seleccionar'
                              )}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform text-xs ${expandedSections.status ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.status && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                              {renderStatusSelector()}
                          </div>
                      )}
                  </div>

                  {/* DROPDOWN 2: INTERÉS */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Nivel de Interés <span className="text-red-500">*</span></label>
                      <button
                          type="button"
                          onClick={() => setExpandedSections(prev => ({ ...prev, interest: !prev.interest }))}
                          className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition"
                          style={{
                              backgroundColor: interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest) ? `${interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest)?.color}10` : 'transparent',
                              color: interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest)?.color || '#666'
                          }}
                      >
                          <span className="flex items-center gap-2">
                              {interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest) ? (
                                  <>
                                      <i className={interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest)?.icon}></i>
                                      {interestStatuses.find(i => (i as any).id_status === deal.id_interest || (i as any).id_interest === deal.id_interest)?.name}
                                  </>
                              ) : (
                                  'Seleccionar'
                              )}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform text-xs ${expandedSections.interest ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.interest && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                              {renderInterestSelector()}
                          </div>
                      )}
                  </div>

                  {/* DROPDOWN 3: CANAL */}
                  <div className="relative" data-dropdown-container>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Canal <span className="text-red-500">*</span></label>
                      <button
                          type="button"
                          onClick={() => setExpandedSections(prev => ({ ...prev, channel: !prev.channel }))}
                          className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition"
                          style={{
                              backgroundColor: dealChannels.find(c => c.id_channel === deal.id_channel) ? `${dealChannels.find(c => c.id_channel === deal.id_channel)?.color}10` : 'transparent',
                              color: dealChannels.find(c => c.id_channel === deal.id_channel)?.color || '#666'
                          }}
                      >
                          <span className="flex items-center gap-2">
                              {dealChannels.find(c => c.id_channel === deal.id_channel) ? (
                                  <>
                                      <i className={dealChannels.find(c => c.id_channel === deal.id_channel)?.icon}></i>
                                      {dealChannels.find(c => c.id_channel === deal.id_channel)?.name}
                                  </>
                              ) : (
                                  'Seleccionar'
                              )}
                          </span>
                          <i className={`fa-solid fa-chevron-down transition-transform text-xs ${expandedSections.channel ? 'rotate-180' : ''}`}></i>
                      </button>
                      {expandedSections.channel && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                              {renderCanalSelector()}
                          </div>
                      )}
                  </div>
              </div>

              {/* COLUMNA 4: EQUIPO */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 h-full">
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <i className="fa-solid fa-users text-brand-500"></i> Equipo
                    </h3>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{selectedUserIds.length}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                     <button type="button" onClick={() => setSelectedUserIds(prev => prev.length === availableUsers.length ? [] : availableUsers.map(u => u.id_user))} className="text-brand-600 hover:underline font-bold">
                        {selectedUserIds.length === availableUsers.length ? 'Ninguno' : 'Todos'}
                     </button>
                     <div className="flex bg-slate-100 rounded p-0.5">
                        <button onClick={() => setSharePermission('VIEW')} className={`px-2 py-0.5 rounded transition ${sharePermission === 'VIEW' ? 'bg-white shadow text-black' : 'text-slate-500'}`}>Ver</button>
                        <button onClick={() => setSharePermission('EDIT')} className={`px-2 py-0.5 rounded transition ${sharePermission === 'EDIT' ? 'bg-white shadow text-black' : 'text-slate-500'}`}>Editar</button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg p-1 max-h-[400px]">
                      {availableUsers.map(u => (
                          <label key={u.id_user} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                              <input type="checkbox" checked={selectedUserIds.includes(u.id_user)} onChange={() => setSelectedUserIds(prev => prev.includes(u.id_user) ? prev.filter(id => id !== u.id_user) : [...prev, u.id_user])} className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500" />
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-300">
                                  {(u.name_user || 'U').charAt(0)}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-slate-700 truncate">{u.name_user}</p>
                                <p className="text-[10px] text-slate-400 truncate">{(u as any).email_user}</p>
                              </div>
                          </label>
                      ))}
                      {availableUsers.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No hay otros usuarios.</p>}
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default DealCreate;