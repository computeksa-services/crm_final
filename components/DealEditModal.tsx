import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG } from '../services/gatewayConfig';
import { Deal, ClientCompany, ClientContact, CustomStatus, DealChannel } from '../types';
import Toast from './Toast';
import CompanyForm from '../pages/clients/CompanyForm';
import ContactForm from '../pages/clients/ContactForm';
import { createPortal } from 'react-dom';
import { BrandSpinner } from './AppLoaders';
import AppModalViewport from './AppModalViewport';

interface DealEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Deal;
  onSuccess: (deal: Deal) => void;
}

const DealEditModal: React.FC<DealEditModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { invalidateContacts, invalidateCompanies } = useDataCache();
  const [deal, setDeal] = useState<Partial<Deal>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);
  const [dealChannels, setDealChannels] = useState<DealChannel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  
  const [expandedSections, setExpandedSections] = useState({ status: false, interest: false, channel: false });
  const didLoadDataRef = useRef(false);

  const formatDate = (value?: string | number | Date) => {
    if (!value) return 'N/A';
    // Manejar strings ya formateados (ej. "22/01/2026 16:27:00") sin romper
    if (typeof value === 'string') {
      const raw = value.trim();
      const hasSlash = raw.includes('/');
      const hasSpace = raw.includes(' ');
      // Intentar parseo estándar primero
      const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('es-ES');
      }
      // Si viene en dd/MM/yyyy con hora, devolver la parte de fecha
      if (hasSlash && hasSpace) {
        return raw.split(' ')[0];
      }
      return raw || 'N/A';
    }
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('es-ES');
  };

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setExpandedSections({ status: false, interest: false, channel: false });
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Inicializar deal cuando cambia initialData - asegurar que campos críticos se preserven
  useEffect(() => {
    if (initialData && isOpen) {
      setDeal({
        id_trato: initialData.id_trato,
        nombre_trato: initialData.nombre_trato,
        valor_trato: initialData.valor_trato,
        descripcion: initialData.descripcion,
        id_client_company: initialData.id_client_company,
        id_contact: initialData.id_contact,
        id_deal_status: initialData.id_deal_status,
        id_interest: initialData.id_interest,
        id_channel: initialData.id_channel,
        fecha_cierre_esperada: initialData.fecha_cierre_esperada,
        created_at: initialData.created_at ?? (initialData as any).fecha_creacion,
        updated_at: initialData.updated_at ?? (initialData as any).fecha_actualizacion,
      });
    }
  }, [initialData, isOpen]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user || didLoadDataRef.current) return;
    didLoadDataRef.current = true;
    
    const { id_tenant, id_user } = user;

    try {
      setLoading(true);
      const endpoints = [
        { name: 'Empresas', url: `/api/clients/companies` },
        { name: 'Contactos', url: `/api/clients/contacts` },
        { name: 'Estados', url: `/api/statuses/deals` },
        { name: 'Intereses', url: `/api/interests/deals` },
        { name: 'Canales', url: `/api/channels/deals` },
      ];

      const parseData = async (res: Response, endpointName: string) => {
        if (!res.ok) {
          console.warn(`⚠️ ${endpointName}: respuesta no exitosa (${res.status})`);
          return [];
        }
        
        const text = await res.text();
        if (!text || text.trim() === '') {
          console.warn(`⚠️ ${endpointName}: respuesta vacía`);
          return [];
        }
        
        try {
          const json = JSON.parse(text);
          // Soporta respuesta directa, data o unified_response.rows
          if (Array.isArray(json)) {
            const unified = json.find(item => item && typeof item === 'object' && 'unified_response' in item);
            if (unified?.unified_response?.rows && Array.isArray(unified.unified_response.rows)) {
              return unified.unified_response.rows;
            }
            return json;
          }
          if (json?.unified_response?.rows && Array.isArray(json.unified_response.rows)) {
            return json.unified_response.rows;
          }
          if (Array.isArray(json?.data)) {
            return json.data;
          }
          return [];
        } catch (e) {
          console.error(`❌ ${endpointName}: error parseando JSON`);
          return [];
        }
      };

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}${endpoint.url}?id_tenant=${id_tenant}&id_user=${id_user}`)
        )
      );

      const [
        companiesData, 
        contactsData, 
        dealStatusesData, 
        interestStatusesData, 
        channelsData
      ] = await Promise.all(responses.map((res, idx) => parseData(res, endpoints[idx].name)));

      setCompanies(companiesData);
      setContacts(contactsData);
      setFilteredContacts(contactsData.filter((c: any) => String(c.id_client_company) === String(deal.id_client_company)));
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);
      setDealChannels(channelsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, deal.id_client_company]);

  useEffect(() => {
    if (isOpen) {
      didLoadDataRef.current = false;
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'id_client_company') {
      if (value === '__ADD_NEW_COMPANY__') {
        setIsCompanyModalOpen(true);
        return;
      }
      setDeal(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
      setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(value)));
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
    setCompanies(prev => [...prev, newCompany]);
    setDeal(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
    setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(newCompany.id_client_company)));
    setIsCompanyModalOpen(false);
    await invalidateCompanies(); // Recargar caché
    setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
  };

  const handleContactCreated = async (newContact: ClientContact) => {
    setContacts(prev => [...prev, newContact]);
    if (newContact.id_client_company && String(newContact.id_client_company) === String(deal.id_client_company)) {
      setFilteredContacts(prev => [...prev, newContact]);
    }
    setDeal(prev => ({ ...prev, id_contact: newContact.id_contact }));
    setIsContactModalOpen(false);
    await invalidateContacts(); // Recargar caché
    setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
  };

  const handleSave = async () => {
    if (!deal.nombre_trato || !deal.id_client_company || !deal.id_contact) {
      setToast({ message: 'Nombre, Empresa y Contacto son obligatorios.', type: 'error' });
      return;
    }
    
    setProcessing(true);
    try {
      // Construir payload con solo los campos esenciales del trato
      const payload = { 
        id_trato: deal.id_trato,
        id_tenant: user?.id_tenant,
        id_user: user?.id_user,
        nombre_trato: deal.nombre_trato,
        valor_trato: deal.valor_trato,
        descripcion: deal.descripcion,
        id_client_company: deal.id_client_company,
        id_contact: deal.id_contact,
        id_deal_status: deal.id_deal_status,
        id_interest: deal.id_interest,
        id_channel: deal.id_channel,
        fecha_cierre_esperada: deal.fecha_cierre_esperada,
      };
      
      const res = await apiFetch(GATEWAY_CONFIG.API.DEALS.UPDATE, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = 'Error al actualizar el trato';
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
      const updatedDeal = Array.isArray(data) ? data[0] : data;

      setToast({ message: 'Trato actualizado correctamente.', type: 'success' });
      onSuccess(updatedDeal);
      setTimeout(() => onClose(), 500);
    } catch (e: any) {
      setToast({ message: e.message || 'Error en el proceso', type: 'error' });
      setProcessing(false);
    }
  };

  const selectedStatus = useMemo(() => dealStatuses.find((s: any) => String(s.id_status || s.id) === String(deal.id_deal_status)), [dealStatuses, deal.id_deal_status]);
  const selectedInterest = useMemo(() => interestStatuses.find((i: any) => String(i.id_status || i.id_interest || i.id) === String(deal.id_interest)), [interestStatuses, deal.id_interest]);
  const selectedChannel = useMemo(() => dealChannels.find((c: any) => String(c.id_channel || c.id) === String(deal.id_channel)), [dealChannels, deal.id_channel]);
  const selectedCompany = useMemo(() => companies.find(c => String(c.id_client_company) === String(deal.id_client_company)), [companies, deal.id_client_company]);
  const selectedContact = useMemo(() => contacts.find(c => String(c.id_contact) === String(deal.id_contact)), [contacts, deal.id_contact]);

  if (!isOpen) return null;

  return createPortal(
    <AppModalViewport className="z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-pen-to-square text-brand-600"></i>
            Editar Trato
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* COL 1: INFO */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <i className="fa-solid fa-file-invoice text-brand-600"></i> Información
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del Trato *</label>
                <input 
                  name="nombre_trato" 
                  value={deal.nombre_trato || ''} 
                  onChange={handleInputChange} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                  placeholder="Ej. Venta de Servidores" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Valor Estimado</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input 
                    name="valor_trato" 
                    value={deal.valor_trato || ''} 
                    onChange={handleInputChange} 
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono" 
                    placeholder="0.00" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Descripción</label>
                <textarea 
                  name="descripcion" 
                  value={deal.descripcion || ''} 
                  onChange={handleInputChange} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none bg-white" 
                  placeholder="Detalles adicionales..."
                />
              </div>
            </div>

            {/* COL 2: CLIENTE */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <i className="fa-solid fa-building-user text-brand-600"></i> Cliente
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa *</label>
                <select 
                  name="id_client_company" 
                  value={deal.id_client_company || ''} 
                  onChange={handleInputChange} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">-- Seleccionar Empresa --</option>
                  <option value="__ADD_NEW_COMPANY__" className="font-bold text-emerald-600">+ Nueva Empresa</option>
                  {companies.map((c, idx) => (
                    <option key={c.id_client_company || idx} value={c.id_client_company}>
                      {c.name_company}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCompany && (
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-brand-900 text-sm mb-1">{selectedCompany.name_company}</p>
                      <p className="text-brand-600 font-mono text-xs">{selectedCompany.id_number}</p>
                    </div>
                    <div className="bg-brand-200 text-brand-800 px-2 py-1 rounded text-[10px] font-bold">
                      {selectedCompany.label_name || selectedCompany.id_label}
                    </div>
                  </div>
                  <div className="space-y-1 text-brand-700">
                    <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-location-dot opacity-50 w-3"></i> {selectedCompany.city}, {selectedCompany.country_name}</p>
                    {selectedCompany.phone_company && <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedCompany.phone_company}</p>}
                    {selectedCompany.email_company && <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-envelope opacity-50 w-3"></i> {selectedCompany.email_company}</p>}
                  </div>
                </div>
              )}
              {deal.id_client_company && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto *</label>
                  <select 
                    name="id_contact" 
                    value={deal.id_contact || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">-- Seleccionar Contacto --</option>
                    <option value="__ADD_NEW_CONTACT__" className="font-bold text-emerald-600">+ Nuevo Contacto</option>
                    {filteredContacts.map((c, idx) => (
                      <option key={c.id_contact || idx} value={c.id_contact}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                  {selectedContact && (
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs space-y-2 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-xs">
                          {selectedContact.first_name?.charAt(0)}{selectedContact.last_name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{selectedContact.first_name} {selectedContact.last_name}</p>
                          {selectedContact.position && <p className="text-slate-500 text-[10px]">{selectedContact.position}</p>}
                        </div>
                      </div>
                      <div className="space-y-1 text-slate-600">
                        <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-envelope opacity-50 w-3"></i> {selectedContact.email}</p>
                        {selectedContact.phone && <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedContact.phone}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* COL 3: CLASIFICACIÓN */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <i className="fa-solid fa-filter text-brand-600"></i> Clasificación
              </h3>

              {/* Dropdown Estado */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-600 mb-1">Estado del Pipeline</label>
                <button 
                  type="button" 
                  onClick={() => setExpandedSections(p => ({...p, status: !p.status}))} 
                  className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" 
                  style={{ 
                    backgroundColor: selectedStatus ? `${selectedStatus.color}15` : '#f8fafc', 
                    color: selectedStatus?.color || '#64748b', 
                    borderColor: selectedStatus?.color || '#e2e8f0' 
                  }}
                >
                  <span className="flex items-center gap-2">
                    {selectedStatus ? <><i className={selectedStatus.icon}></i> {selectedStatus.name}</> : 'Seleccionar'}
                  </span>
                  <i className={`fa-solid fa-chevron-down transition-transform text-[10px] ${expandedSections.status ? 'rotate-180' : ''}`}></i>
                </button>
                {expandedSections.status && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-48 overflow-y-auto">
                    {dealStatuses.map((s: any, idx: number) => (
                      <button 
                        key={s.id_status || s.id || idx} 
                        onClick={() => { 
                          setDeal((p: Partial<Deal>) => ({...p, id_deal_status: s.id_status || s.id})); 
                          setExpandedSections(p => ({...p, status: false})); 
                        }} 
                        className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" 
                        style={{ color: s.color }}
                      >
                        <i className={s.icon}></i> {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dropdown Interés */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nivel de Interés</label>
                <button 
                  type="button" 
                  onClick={() => setExpandedSections(p => ({...p, interest: !p.interest}))} 
                  className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" 
                  style={{ 
                    backgroundColor: selectedInterest ? `${selectedInterest.color}15` : '#f8fafc', 
                    color: selectedInterest?.color || '#64748b', 
                    borderColor: selectedInterest?.color || '#e2e8f0' 
                  }}
                >
                  <span className="flex items-center gap-2">
                    {selectedInterest ? <><i className={selectedInterest.icon}></i> {selectedInterest.name}</> : 'Seleccionar'}
                  </span>
                  <i className={`fa-solid fa-chevron-down transition-transform text-[10px] ${expandedSections.interest ? 'rotate-180' : ''}`}></i>
                </button>
                {expandedSections.interest && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-48 overflow-y-auto">
                    {interestStatuses.map((i: any, idx: number) => {
                      const id = i.id_status || i.id_interest || i.id;
                      return (
                        <button 
                          key={id || idx} 
                          onClick={() => { 
                            setDeal((p: Partial<Deal>) => ({...p, id_interest: id})); 
                            setExpandedSections(p => ({...p, interest: false})); 
                          }} 
                          className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" 
                          style={{ color: i.color }}
                        >
                          <i className={i.icon}></i> {i.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dropdown Canal */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-600 mb-1">Canal de Origen</label>
                <button 
                  type="button" 
                  onClick={() => setExpandedSections(p => ({...p, channel: !p.channel}))} 
                  className="w-full px-3 py-2 text-xs font-bold border rounded-lg flex items-center justify-between" 
                  style={{ 
                    backgroundColor: selectedChannel ? `${selectedChannel.color}15` : '#f8fafc', 
                    color: selectedChannel?.color || '#64748b', 
                    borderColor: selectedChannel?.color || '#e2e8f0' 
                  }}
                >
                  <span className="flex items-center gap-2">
                    {selectedChannel ? <><i className={selectedChannel.icon}></i> {selectedChannel.name}</> : 'Seleccionar'}
                  </span>
                  <i className={`fa-solid fa-chevron-down transition-transform text-[10px] ${expandedSections.channel ? 'rotate-180' : ''}`}></i>
                </button>
                {expandedSections.channel && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-2 space-y-1 max-h-48 overflow-y-auto">
                    {dealChannels.map((c: any, idx: number) => (
                      <button 
                        key={c.id_channel || c.id || idx} 
                        onClick={() => { 
                          setDeal((p: Partial<Deal>) => ({...p, id_channel: c.id_channel || c.id})); 
                          setExpandedSections(p => ({...p, channel: false})); 
                        }} 
                        className="w-full p-2 rounded-md text-left text-xs font-semibold hover:bg-slate-50 flex items-center gap-2" 
                        style={{ color: c.color }}
                      >
                        <i className={c.icon}></i> {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* COL 4: ESPACIO EXTRA */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">
                <i className="fa-solid fa-info-circle text-brand-600"></i> Detalles
              </h3>
              <div className="mt-4 text-xs text-slate-600 space-y-2">
                <p><span className="font-bold">Creado:</span> {formatDate(deal.created_at)}</p>
                <p><span className="font-bold">Actualizado:</span> {formatDate(deal.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={processing || loading}
            className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {processing ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-check"></i>}
            Guardar Cambios
          </button>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      {/* Modales inline */}
      <CompanyForm
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        mode="create"
        onSuccess={handleCompanyCreated}
      />
      
      <ContactForm
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        mode="create"
        initialData={deal.id_client_company ? { id_client_company: deal.id_client_company } : undefined}
        onSuccess={handleContactCreated}
        companies={companies}
      />
    </AppModalViewport>,
    document.body
  );
};

export default DealEditModal;

