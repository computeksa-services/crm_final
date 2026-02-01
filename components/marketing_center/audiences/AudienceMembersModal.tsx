import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { marketingApi } from '../../../services/marketingApi';
import { apiFetch } from '../../../services/apiClient';
import { marketingToolsApi } from '../../../services/marketingHelpers';
import { useDataCache } from '../../../contexts/DataCacheContext';
import ConfirmModal from '../../ConfirmModal';

// Definición de tipos
interface Contact {
  id_contact: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position?: string;
  name_company?: string;  // Campo que devuelve el backend
  company_name?: string;  // Alias para compatibilidad
  id_client_company?: string;
  company_city?: string;  // Campo que devuelve el backend
  city?: string;          // Alias para compatibilidad
  country_name?: string;  // Campo que devuelve el backend
  country?: string;       // Alias para compatibilidad
  category_name?: string; // Campo que devuelve el backend
  company_category?: string; // Alias para compatibilidad
  label_names?: string;   // Campo que devuelve el backend
  company_tags?: string[] | string; // Alias para compatibilidad
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
  id_company: string[];
  id_company_type: string[];      // IDs de categoría
  tags_ids: string[];             // Array de IDs de etiquetas
  position: string;
  id_country: string[];           // IDs de país
  // Nuevos filtros de Historial de Ventas
  bought_product_ids: string[];
  winning_status_ids: string[];
  purchase_period_days: number | null;
}

interface CheckboxDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  placeholder?: string;
  onChange: (values: string[]) => void;
}

const CheckboxDropdown: React.FC<CheckboxDropdownProps> = ({ label, options, selected, placeholder = 'Seleccionar', onChange }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const toggleValue = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl p-2"
      onMouseEnter={() => {
        if (closeTimer.current) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
      }}
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 150);
      }}
    >
      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded"
              checked={selected.includes(opt.value)}
              onChange={() => toggleValue(opt.value)}
            />
            <span className="truncate" title={opt.label}>{opt.label}</span>
          </label>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-1">Sin opciones</p>
        )}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
        <button
          type="button"
          onClick={() => { onChange([]); setOpen(false); }}
          className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-blue-600 font-semibold"
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className="text-left text-slate-700 font-semibold">{label}</span>
        <span className="text-xs text-slate-500">{selected.length > 0 ? `${selected.length} seleccionados` : placeholder}</span>
      </button>
      {menu}
    </div>
  );
};

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
  const { quoteStatuses, products, countries, companyTypes } = useDataCache();
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
    id_company: [],
    id_company_type: [],
    tags_ids: [],
    position: '',
    id_country: [],
    bought_product_ids: [],
    winning_status_ids: [],
    purchase_period_days: null
  });

  // Opciones para los filtros
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as FilterOption[],
    tags: [] as FilterOption[],
    countries: [] as FilterOption[],
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

  // Rebuild filter options when cache data arrives (products, quote statuses)
  useEffect(() => {
    if (isOpen && activeTab === 'ADD') {
      fetchFilterOptions();
    }
  }, [products, quoteStatuses, isOpen, activeTab]);

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
      // Usar cache para countries y companyTypes
      let tags: FilterOption[] = [];
      let productsList: FilterOption[] = [];
      let quoteStatusesList: FilterOption[] = [];

      // Etiquetas desde API
      const labelsRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels?id_tenant=${tenantId}&id_user=${userId}`);
      if (labelsRes.ok) {
        const labelsData = await labelsRes.json();
        tags = Array.isArray(labelsData)
          ? labelsData.map((l: any) => ({
              value: l.id_label || l.id || l.name,
              label: l.name
            }))
          : [];
      }

      // Load products from DataCache
      if (products && products.length > 0) {
        productsList = products.map((p: any) => ({
          value: p.id_product || p.id,
          label: p.product_name || p.name || p.descripcion || p.description || p.codigo || 'Producto'
        }));
      }

      // Load quote statuses from DataCache
      if (quoteStatuses && quoteStatuses.length > 0) {
        quoteStatusesList = quoteStatuses.map((qs: any) => ({
          value: qs.id_status || qs.id,
          label: qs.status_name || qs.name
        }));
      }

      // Use cached countries and companyTypes
      const countriesOptions: FilterOption[] = (countries || []).map(c => ({ value: c.id, label: c.name }));
      const categoriesOptions: FilterOption[] = (companyTypes || []).map(t => ({ value: t.id, label: t.name }));

      setFilterOptions({
        categories: categoriesOptions,
        tags,
        countries: countriesOptions,
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
      const membersList = Array.isArray(data) ? data : [];
      console.log(`👥 Miembros de la lista: ${membersList.length} cargados`);
      setMembers(membersList);
    } catch (error) {
      console.error('❌ Error en fetchMembers:', error);
      setMembers([]);
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
        id_company: filters.id_company && filters.id_company.length > 0 ? filters.id_company : undefined,
        id_company_type: filters.id_company_type && filters.id_company_type.length > 0 ? filters.id_company_type : undefined,
        id_country: filters.id_country && filters.id_country.length > 0 ? filters.id_country : undefined,
        tags_ids: filters.tags_ids && filters.tags_ids.length > 0 ? filters.tags_ids : undefined,
        position: filters.position || undefined,
        // FILTROS DE VENTAS (NUEVOS)
        bought_product_ids: filters.bought_product_ids && filters.bought_product_ids.length > 0 ? filters.bought_product_ids : undefined,
        winning_status_ids: filters.winning_status_ids && filters.winning_status_ids.length > 0 ? filters.winning_status_ids : undefined,
        purchase_period_days: filters.purchase_period_days || undefined
      };

      const data = await marketingApi.searchCrmContacts(tenantId, userId, payload);

      // Si el backend devuelve {success: true} sin array, o cualquier cosa que no sea array, usar array vacío
      const contactsData = Array.isArray(data) ? data : [];
      console.log(`📊 Búsqueda de candidatos: ${contactsData.length} resultados encontrados`);
      
      const currentMemberIds = new Set(members.map(m => m.id_contact));
      const available = contactsData.filter((c: any) => !currentMemberIds.has(c.id_contact));
      
      setCandidates(available);
    } catch (error) {
      console.error('❌ Error en fetchCandidates:', error);
      setCandidates([]);
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
    const first = (contact.first_name || contact.last_name || contact.email || '??').charAt(0).toUpperCase();
    const last = (contact.last_name || contact.first_name || contact.email || '??').charAt(0).toUpperCase();
    return (first + last).substring(0, 2);
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
                <div className="space-y-1">
                  <CheckboxDropdown
                    label="Empresa"
                    options={companies.map(c => ({ value: c.id_client_company, label: c.name_company }))}
                    selected={filters.id_company}
                    placeholder="Todas"
                    onChange={(vals) => setFilters(prev => ({ ...prev, id_company: vals }))}
                  />
                </div>

                {/* Categoría Empresa */}
                <div className="space-y-1">
                  <CheckboxDropdown
                    label="Categoría Empresa"
                    options={filterOptions.categories}
                    selected={filters.id_company_type}
                    placeholder="Todas"
                    onChange={(vals) => setFilters(prev => ({ ...prev, id_company_type: vals }))}
                  />
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
                <div className="space-y-1">
                  <CheckboxDropdown
                    label="País"
                    options={filterOptions.countries}
                    selected={filters.id_country}
                    placeholder="Todos"
                    onChange={(vals) => setFilters(prev => ({ ...prev, id_country: vals }))}
                  />
                </div>

                {/* Etiquetas Empresa */}
                <div className="space-y-1">
                  <CheckboxDropdown
                    label="Etiquetas Empresa"
                    options={filterOptions.tags}
                    selected={filters.tags_ids}
                    placeholder="Todas"
                    onChange={(vals) => setFilters(prev => ({ ...prev, tags_ids: vals }))}
                  />
                </div>

                {/* Historial de Compra */}
                <div className="pt-4 border-t border-slate-300">
                  <label className="text-xs font-bold text-green-700 uppercase block mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-shopping-cart"></i> Historial de Compra
                  </label>
                  
                  {/* Productos Comprados */}
                  <div className="mb-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Productos Comprados</label>
                    <CheckboxDropdown
                      label="Productos"
                      options={filterOptions.products}
                      selected={filters.bought_product_ids}
                      placeholder="Todos"
                      onChange={(vals) => setFilters(prev => ({ ...prev, bought_product_ids: vals }))}
                    />
                  </div>

                  {/* Estado de Ventas */}
                  <div className="mb-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Estado de Venta Ganada</label>
                    <CheckboxDropdown
                      label="Estados"
                      options={filterOptions.quoteStatuses}
                      selected={filters.winning_status_ids}
                      placeholder="Todos"
                      onChange={(vals) => setFilters(prev => ({ ...prev, winning_status_ids: vals }))}
                    />
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
                      id_company: [],
                      id_company_type: [],
                      tags_ids: [],
                      position: '',
                      id_country: [],
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
                <div className="grid grid-cols-3 gap-3">

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
                    className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-300 ring-1 ring-red-300' 
                        : isUnsubscribed
                        ? 'bg-orange-50/70 border-orange-200 hover:border-orange-300 opacity-75'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500 mt-0.5 flex-shrink-0"
                        checked={selectedIds.has(member.id_contact)}
                        onChange={() => handleToggleSelect(member.id_contact)}
                      />
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                        {getInitial(member)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{renderName(member)}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-1">
                        <i className="fa-solid fa-building text-slate-400"></i>
                        <p className="font-semibold text-slate-700 truncate">{member.name_company || member.company_name || 'Particular'}</p>
                      </div>
                      {member.position && <p className="truncate"><span className="font-medium">Cargo:</span> {member.position}</p>}
                      {member.is_subscribed === false && (
                        <div className="flex items-center gap-1 text-orange-600">
                          <i className="fa-solid fa-exclamation-circle text-xs"></i>
                          <span className="font-bold">DESUSCRITO</span>
                        </div>
                      )}
                    </div>
                  </label>
                  );
                })
              )}
            </div>
          )}

          {/* === VISTA: AGREGAR (SEARCH) === */}
          {activeTab === 'ADD' && (
            <div>
              <div className="flex justify-between items-center mb-4 px-1">
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
                <div className="grid grid-cols-3 gap-3">
                  {candidates.filter(c => c.id_contact && c.id_contact.trim() !== '').map((contact) => (
                    <label 
                      key={contact.id_contact} 
                      className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${selectedIds.has(contact.id_contact) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-0.5 flex-shrink-0"
                          checked={selectedIds.has(contact.id_contact)}
                          onChange={() => handleToggleSelect(contact.id_contact)}
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                          {getInitial(contact)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{renderName(contact)}</p>
                          <p className="text-xs text-slate-500 truncate">{contact.email}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                        <div className="flex items-center gap-1">
                          <i className="fa-solid fa-building text-slate-400"></i>
                          <p className="font-semibold text-slate-700 truncate">{contact.name_company || contact.company_name || '—'}</p>
                        </div>
                        {contact.position && <p className="truncate"><span className="font-medium">Cargo:</span> {contact.position}</p>}
                        {(contact.company_city || contact.city) && <p className="truncate"><span className="font-medium">Ciudad:</span> {contact.company_city || contact.city}</p>}
                        {contact.category_name && <p className="truncate"><span className="font-medium">Categoría:</span> {contact.category_name}</p>}
                        {contact.country_name && <p className="truncate"><span className="font-medium">País:</span> {contact.country_name}</p>}
                      </div>
                    </label>
                  ))}
                </div>
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
