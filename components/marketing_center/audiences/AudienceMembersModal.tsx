import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { marketingApi } from '../../../services/marketingApi';
import { apiFetch } from '../../../services/apiClient';
import { marketingToolsApi } from '../../../services/marketingHelpers';
import { useDataCache } from '../../../contexts/DataCacheContext';
import ConfirmModal from '../../ConfirmModal';

// Etiquetas hardcodeadas (mismo array que CompanyFormModal.tsx)
const COMPANY_LABELS = [
  'Cliente', 'Muy Interesado', 'Interesado', 'Poco Interesado', 'Proveedor',
];

// Definición de tipos
interface Contact {
  id_contact: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position?: string;
  company_name?: string;
  id_client_company?: string;
  city?: string;
  country?: string;
  company_category?: string;
  company_tags?: string[] | string;
  company_industry?: string;
  is_subscribed?: boolean;
}

interface CompanyOption {
  id_client_company: string;
  name_company: string;
  category?: string;
  tags?: string[];
  industry?: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface AdvancedFilters {
  search: string;
  id_company: string;
  id_company_type: string;        // ID de categoría
  tags_ids: string[];             // Array de IDs de etiquetas
  position: string;
  id_country: string;             // ID de país
  industry: string;               // Tipo de industria
  // Nuevos filtros de Historial de Ventas
  bought_product_ids: string[];
  winning_status_ids: string[];
  purchase_period_days: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
  tenantId: string;
  userId: string;
  isNewList?: boolean;
}

const AudienceMembersModal: React.FC<Props> = ({ isOpen, onClose, listId, listName, tenantId, userId, isNewList }) => {
  const { quoteStatuses, products } = useDataCache();
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'ADD'>(isNewList ? 'ADD' : 'MEMBERS');
  
  // Datos
  const [members, setMembers] = useState<Contact[]>([]);
  const [candidates, setCandidates] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  
  // Selección y Estado
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Búsqueda en MEMBERS tab
  const [memberSearch, setMemberSearch] = useState('');
  
  // Modal de confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{action: 'add' | 'remove' | 'unsubscribe', count: number} | null>(null);

  // Filtros Avanzados Mejorados
  const [filters, setFilters] = useState<AdvancedFilters>({
    search: '',
    id_company: '',
    id_company_type: '',
    tags_ids: [],
    position: '',
    id_country: '',
    industry: '',
    bought_product_ids: [],
    winning_status_ids: [],
    purchase_period_days: null
  });

  // Opciones para los filtros
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as FilterOption[],
    tags: [] as FilterOption[],
    countries: [] as FilterOption[],
    industries: [] as FilterOption[],
    products: [] as FilterOption[],
    quoteStatuses: [] as FilterOption[]
  });

  // Estado para mostrar/ocultar filtros avanzados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

// Carga inicial
useEffect(() => {
  if (isOpen && listId && listId !== 'undefined') {
    if (activeTab === 'MEMBERS') fetchMembers();
    if (activeTab === 'ADD') {
      fetchCandidates();
      fetchCompanies();
      fetchFilterOptions();  // Cargar desde endpoint único
    }
    setSelectedIds(new Set());
  } else if (isOpen) {
    console.error("ID de lista inválido al abrir modal:", listId);
  }
}, [isOpen, activeTab, listId]);

  // Debounce para filtros
  useEffect(() => {
    if (isOpen && activeTab === 'ADD') {
      const timer = setTimeout(() => {
        fetchCandidates();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filters]);

  const fetchCompanies = async () => {
    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/tools/companies?id_tenant=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading companies", error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Usar los mismos endpoints que CompanyFormModal.tsx
      const [countriesRes, companytypesRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/countries?id_tenant=${tenantId}&id_user=${userId}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/types?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      let countries: FilterOption[] = [];
      let categories: FilterOption[] = [];
      let tags: FilterOption[] = [];
      let industries: FilterOption[] = [];
      let productsList: FilterOption[] = [];
      let quoteStatusesList: FilterOption[] = [];

      // Parse countries
      if (countriesRes.ok) {
        const countryData = await countriesRes.json();
        countries = Array.isArray(countryData) ? countryData.map((c: any) => ({
          value: c.id || c.code || c.name,
          label: c.name
        })) : [];
      }

      // Parse company types
      if (companytypesRes.ok) {
        const typeData = await companytypesRes.json();
        categories = Array.isArray(typeData) ? typeData.map((t: any) => ({
          value: t.id_company_types || t.id || t.name,
          label: t.name
        })) : [];
      }

      // Usar etiquetas hardcodeadas (mismo array que CompanyFormModal)
      tags = COMPANY_LABELS.map(label => ({ value: label, label }));

      // Extraer industrias únicas de companies
      if (companies.length > 0) {
        const industriesSet = new Set<string>();
        companies.forEach(company => {
          if (company.industry) {
            industriesSet.add(company.industry);
          }
        });
        industries = Array.from(industriesSet).map(industry => ({ value: industry, label: industry }));
      }

      // Load products from DataCache
      if (products && products.length > 0) {
        productsList = products.map((p: any) => ({
          value: p.id_product || p.id,
          label: p.product_name || p.name
        }));
      }

      // Load quote statuses from DataCache
      if (quoteStatuses && quoteStatuses.length > 0) {
        quoteStatusesList = quoteStatuses.map((qs: any) => ({
          value: qs.id_status || qs.id,
          label: qs.status_name || qs.name
        }));
      }

      setFilterOptions({
        categories,
        tags,
        countries,
        industries,
        products: productsList,
        quoteStatuses: quoteStatusesList
      });
    } catch (error) {
      console.error("Error loading filter options", error);
    }
  };

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const data = await marketingApi.getListMembers(listId, userId);
      setMembers(data as any);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      // Construir payload exacto como especifica el backend
      const payload = {
        id_tenant: tenantId,
        search: filters.search || undefined,
        // FILTROS DEMOGRÁFICOS (IDs)
        id_company_type: filters.id_company_type || undefined,
        id_country: filters.id_country || undefined,
        tags_ids: filters.tags_ids.length > 0 ? filters.tags_ids : [],
        industry: filters.industry || undefined,
        position: filters.position || undefined,
        // FILTROS DE VENTAS (NUEVOS)
        bought_product_ids: filters.bought_product_ids.length > 0 ? filters.bought_product_ids : [],
        winning_status_ids: filters.winning_status_ids.length > 0 ? filters.winning_status_ids : [],
        purchase_period_days: filters.purchase_period_days || undefined
      };

      const data = await marketingApi.searchCrmContacts(tenantId, userId, payload);

      const currentMemberIds = new Set(members.map(m => m.id_contact));
      const available = data.filter((c: any) => !currentMemberIds.has(c.id_contact));
      
      setCandidates(available);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (!id || id.trim() === '') {
      return;
    }
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id_contact)));
    }
  };

  const executeAction = async (action: 'add' | 'remove' | 'unsubscribe') => {
    if (selectedIds.size === 0) {
      alert('Por favor selecciona al menos un contacto');
      return;
    }

    setPendingAction({ action, count: selectedIds.size });
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    // Filtrar cualquier ID undefined antes de enviar
    const validIds = Array.from(selectedIds).filter(id => id && id.trim() !== '');
    
    if (validIds.length === 0) {
      alert('Por favor selecciona al menos un contacto válido');
      setShowConfirm(false);
      return;
    }

    setIsSaving(true);
    try {
      await marketingApi.manageListMembers(listId, validIds, pendingAction.action);
      
      if (pendingAction.action === 'add') {
        setActiveTab('MEMBERS');
        fetchMembers(); 
      } else {
        fetchMembers();
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error al actualizar:', error);
      alert('Error al actualizar');
    } finally {
      setIsSaving(false);
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  // Helper seguro para mostrar nombres
  const renderName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.email || 'Sin Email';
  };

  // Helper seguro para obtener inicial (EVITA EL CRASH)
  const getInitial = (contact: Contact) => {
    const source = contact.first_name || contact.last_name || contact.email || '?';
    return source.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Gestionar Audiencia</h2>
            <p className="text-sm text-slate-500">Lista: <span className="font-semibold text-blue-600">{listName}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('MEMBERS')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'MEMBERS' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fa-solid fa-users mr-2"></i> Miembros ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('ADD')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'ADD' ? 'border-b-2 border-green-500 text-green-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fa-solid fa-user-plus mr-2"></i> Agregar Contactos
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL CON LAYOUT HORIZONTAL */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO: FILTROS (Solo en ADD) */}
          {activeTab === 'ADD' && (
            <div className="w-80 border-r border-slate-200 bg-slate-50 overflow-y-auto flex-shrink-0">
              <div className="p-4 space-y-4">
                
                {/* Búsqueda */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Búsqueda</label>
                  <input 
                    type="text" 
                    placeholder="🔍 Nombre o email..." 
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>

                {/* Empresa */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Empresa</label>
                  <select 
                    value={filters.id_company}
                    onChange={(e) => setFilters(prev => ({...prev, id_company: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                  >
                    <option value="">🏢 Todas</option>
                    {companies.map(c => (
                      <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>
                    ))}
                  </select>
                </div>

                {/* Categoría Empresa */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Categoría Empresa</label>
                  <select 
                    value={filters.id_company_type}
                    onChange={(e) => setFilters(prev => ({...prev, id_company_type: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Todas</option>
                    {filterOptions.categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Industria */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Industria</label>
                  <select 
                    value={filters.industry}
                    onChange={(e) => setFilters(prev => ({...prev, industry: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Todas</option>
                    {filterOptions.industries.map(ind => (
                      <option key={ind.value} value={ind.value}>{ind.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cargo */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Cargo</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Gerente" 
                    value={filters.position}
                    onChange={(e) => setFilters(prev => ({...prev, position: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>

                {/* País */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">País</label>
                  <select 
                    value={filters.id_country}
                    onChange={(e) => setFilters(prev => ({...prev, id_country: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Todos</option>
                    {filterOptions.countries.map(country => (
                      <option key={country.value} value={country.value}>{country.label}</option>
                    ))}
                  </select>
                </div>

                {/* Etiquetas Empresa */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Etiquetas Empresa</label>
                  <select 
                    multiple
                    value={filters.tags_ids}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setFilters(prev => ({...prev, tags_ids: selected}));
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-h-[120px]"
                  >
                    {filterOptions.tags.map(tag => (
                      <option key={tag.value} value={tag.value}>{tag.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Ctrl/Cmd + Click para seleccionar múltiples</p>
                </div>

                {/* Historial de Compra */}
                <div className="pt-4 border-t border-slate-300">
                  <label className="text-xs font-bold text-green-700 uppercase block mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-shopping-cart"></i> Historial de Compra
                  </label>
                  
                  {/* Productos Comprados */}
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Productos Comprados</label>
                    <select 
                      multiple
                      value={filters.bought_product_ids}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFilters(prev => ({...prev, bought_product_ids: selected}));
                      }}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white min-h-[100px]"
                    >
                      {filterOptions.products.map(product => (
                        <option key={product.value} value={product.value}>{product.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Ctrl/Cmd + Click para múltiples</p>
                  </div>

                  {/* Estado de Ventas */}
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Estado de Venta Ganada</label>
                    <select 
                      multiple
                      value={filters.winning_status_ids}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFilters(prev => ({...prev, winning_status_ids: selected}));
                      }}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white min-h-[100px]"
                    >
                      {filterOptions.quoteStatuses.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Ctrl/Cmd + Click para múltiples</p>
                  </div>

                  {/* Período */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Período (Últimos X días)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="365"
                      placeholder="Ej: 90" 
                      value={filters.purchase_period_days || ''}
                      onChange={(e) => setFilters(prev => ({...prev, purchase_period_days: e.target.value ? parseInt(e.target.value) : null}))}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Botón Limpiar */}
                <div className="pt-4 border-t border-slate-300">
                  <button
                    onClick={() => setFilters({
                      search: '',
                      id_company: '',
                      id_company_type: '',
                      tags_ids: [],
                      position: '',
                      id_country: '',
                      industry: '',
                      bought_product_ids: [],
                      winning_status_ids: [],
                      purchase_period_days: null
                    })}
                    className="w-full px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <i className="fa-solid fa-xmark mr-2"></i> Limpiar Filtros
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PANEL DERECHO: LISTA DE CONTACTOS */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barra de búsqueda para Members */}
            {activeTab === 'MEMBERS' && (
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <input 
                  type="text" 
                  placeholder="🔍 Buscar miembro..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            )}

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                </div>
              )}

              {/* === VISTA: MIEMBROS === */}
              {activeTab === 'MEMBERS' && (
                <div className="space-y-3">

              {members.filter(m => {
                const name = renderName(m).toLowerCase();
                const email = (m.email || '').toLowerCase();
                const query = memberSearch.toLowerCase();
                return name.includes(query) || email.includes(query);
              }).length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <i className="fas fa-folder-open text-4xl mb-3 opacity-50"></i>
                  <p>{memberSearch ? 'No se encontraron miembros con esa búsqueda.' : 'La lista está vacía.'}</p>
                </div>
              ) : (
                members.filter(m => {
                  const name = renderName(m).toLowerCase();
                  const email = (m.email || '').toLowerCase();
                  const query = memberSearch.toLowerCase();
                  return name.includes(query) || email.includes(query);
                }).map((member, idx) => {
                  const isUnsubscribed = member.is_subscribed === false;
                  const isSelected = selectedIds.has(member.id_contact);
                  
                  return (
                  <label 
                    key={member.id_contact || idx} 
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-300 ring-1 ring-red-300' 
                        : isUnsubscribed
                        ? 'bg-orange-50/70 border-orange-200 hover:border-orange-300 opacity-75'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        checked={selectedIds.has(member.id_contact)}
                        onChange={() => handleToggleSelect(member.id_contact)}
                      />
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">
                        {getInitial(member)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-700">{renderName(member)}</p>
                          {member.is_subscribed === false && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full">
                              DESUSCRITO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                       <div className="hidden md:block">
                         <p className="text-xs font-semibold text-slate-700">{member.company_name || 'Particular'}</p>
                         {member.position && <p className="text-[10px] text-slate-400">{member.position}</p>}
                       </div>
                    </div>
                  </label>
                  );
                })
              )}
            </div>
          )}

          {/* === VISTA: AGREGAR (SEARCH) === */}
          {activeTab === 'ADD' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2 px-1">
                 <p className="text-xs font-bold text-slate-500 uppercase">{candidates.length} resultados</p>
                 {candidates.length > 0 && (
                   <button onClick={handleSelectAll} className="text-xs text-blue-600 font-semibold hover:underline">
                      {selectedIds.size === candidates.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                   </button>
                 )}
              </div>
              
              {candidates.length === 0 && !isLoading ? (
                 <div className="text-center py-10 text-slate-400 border border-dashed rounded-lg">
                    <p>No se encontraron contactos con estos filtros.</p>
                 </div>
              ) : (
                candidates.filter(c => c.id_contact && c.id_contact.trim() !== '').map((contact) => (
                  <label 
                    key={contact.id_contact} 
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${selectedIds.has(contact.id_contact) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        checked={selectedIds.has(contact.id_contact)}
                        onChange={() => handleToggleSelect(contact.id_contact)}
                      />
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold uppercase">
                        {getInitial(contact)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{renderName(contact)}</p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                       <p className="text-xs font-bold text-slate-600">{contact.company_name || 'Sin Empresa'}</p>
                       <p className="text-xs text-slate-400">
                         {contact.position && <span>{contact.position}</span>}
                         {contact.city && <span> • {contact.city}</span>}
                       </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center z-20">
          <span className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{selectedIds.size}</span> seleccionados
          </span>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold border border-slate-200">
              Cerrar
            </button>
            
            {activeTab === 'ADD' && (
              <button 
                onClick={() => executeAction('add')}
                disabled={selectedIds.size === 0 || isSaving}
                className="px-6 py-2 text-sm bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                {isSaving ? 'Agregando...' : 'Agregar a la Lista'}
              </button>
            )}
            
            {activeTab === 'MEMBERS' && selectedIds.size > 0 && (
              <>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold border border-slate-200 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-times"></i>
                  Borrar Selección
                </button>
                
                <button 
                  onClick={() => executeAction('unsubscribe')}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-user-slash"></i>}
                  {isSaving ? 'Desuscribiendo...' : 'Desuscribir'}
                </button>
                
                <button 
                  onClick={() => executeAction('remove')}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash"></i>}
                  {isSaving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingAction(null);
        }}
        onConfirm={confirmAction}
        title={
          pendingAction?.action === 'add' ? 'Agregar Contactos' :
          pendingAction?.action === 'remove' ? 'Eliminar Contactos' :
          'Desuscribir Contactos'
        }
        message={
          pendingAction?.action === 'add' 
            ? `¿Seguro desea agregar ${pendingAction.count} contacto${pendingAction.count > 1 ? 's' : ''} a la lista?`
            : pendingAction?.action === 'remove'
            ? `¿Seguro desea eliminar ${pendingAction.count} contacto${pendingAction.count > 1 ? 's' : ''} de la lista? Esta acción no se puede deshacer.`
            : `¿Seguro desea desuscribir ${pendingAction?.count || 0} contacto${(pendingAction?.count || 0) > 1 ? 's' : ''}? No se eliminarán pero se marcarán como desuscritos y no recibirán más correos.`
        }
        confirmText={
          pendingAction?.action === 'add' ? 'Agregar' :
          pendingAction?.action === 'remove' ? 'Eliminar' :
          'Desuscribir'
        }
        cancelText="Cancelar"
        isDestructive={pendingAction?.action === 'remove'}
      />
    </div>,
    document.body
  );
};

export default AudienceMembersModal;
