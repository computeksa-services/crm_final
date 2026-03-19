import React, { useState, useEffect, useRef } from 'react';
import { BrandSpinner } from '../../AppLoaders';
import { createPortal } from 'react-dom';
import { marketingApi } from '../../../services/marketingApi';
import { apiFetch } from '../../../services/apiClient';
import { useDataCache } from '../../../contexts/DataCacheContext';
import ConfirmModal from '../../ConfirmModal';
import AppModalViewport from '../../AppModalViewport';

// Tipos
interface Contact {
  id_contact: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position?: string;
  name_company?: string;
  company_name?: string;
  id_client_company?: string;
  company_city?: string;
  city?: string;
  country_name?: string;
  country?: string;
  category_name?: string;
  company_category?: string;
  label_names?: string;
  company_tags?: string[] | string;
  company_industry?: string;
  is_subscribed?: boolean;
}

interface CompanyOption {
  id_client_company: string;
  name_company: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface AdvancedFilters {
  search: string;
  id_company: string[];
  id_company_type: string[];
  id_company_size: string[];
  tags_ids: string[];
  position: string;
  id_country: string[];
  bought_product_ids: string[];
  winning_status_ids: string[];
  purchase_period_days: number | null;
}

// Componente de Combobox mejorado
interface ComboboxProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  icon?: string;
}

const Combobox: React.FC<ComboboxProps> = ({ label, options, selected, onChange, icon }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Cerrar al salir del componente
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node) && 
          !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggleValue = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const hasSelection = selected.length > 0;

  // Obtener labels de seleccionados
  const getSelectedLabels = () => {
    if (selected.length === 0) return null;
    if (selected.length === 1) {
      const option = options.find(o => o.value === selected[0]);
      return option?.label || selected[0];
    }
    return `${selected.length} seleccionados`;
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-9 px-3 text-[13px] rounded-md border transition-all flex items-center justify-between gap-2 ${
          hasSelection
            ? 'bg-gray-50 dark:bg-slate-600 border-gray-300 dark:border-slate-500 text-gray-900 dark:text-white'
            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <i className={`${icon} text-gray-400 dark:text-slate-500 text-xs flex-shrink-0`}></i>}
          <span className="truncate text-left">
            {hasSelection ? getSelectedLabels() : label}
          </span>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] text-gray-400 dark:text-slate-500 transition-transform flex-shrink-0 ${
          open ? 'rotate-180' : ''
        }`}></i>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: buttonRef.current!.getBoundingClientRect().bottom + 4,
            left: buttonRef.current!.getBoundingClientRect().left,
            width: Math.max(buttonRef.current!.getBoundingClientRect().width, 280),
            zIndex: 99999
          }}
          className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-2xl"
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-slate-600">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 px-2 text-[13px] bg-gray-50 dark:bg-slate-600 border-none rounded outline-none focus:bg-gray-100 dark:focus:bg-slate-500 dark:text-white dark:placeholder-slate-400"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-slate-500">
                Sin resultados
              </div>
            ) : (
              filtered.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer group"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected.includes(opt.value)
                      ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                      : 'border-gray-300 dark:border-slate-500 group-hover:border-gray-400 dark:group-hover:border-slate-400'
                  }`}>
                    {selected.includes(opt.value) && (
                      <i className="fa-solid fa-check text-white text-[10px]"></i>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleValue(opt.value)}
                  />
                  <span className="text-[13px] text-gray-700 dark:text-slate-300 truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={() => { onChange([]); setOpen(false); setSearch(''); }}
                className="w-full h-7 text-[12px] text-gray-600 hover:text-gray-900 font-medium"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
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

const AudienceMembersModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  listId, 
  listName, 
  tenantId, 
  userId, 
  isNewList 
}) => {
  const { quoteStatuses, products, countries, companyTypes, companySizes } = useDataCache();
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'ADD'>(isNewList ? 'ADD' : 'MEMBERS');
  
  const [members, setMembers] = useState<Contact[]>([]);
  const [candidates, setCandidates] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [memberSearch, setMemberSearch] = useState('');
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: 'add' | 'remove' | 'unsubscribe', 
    count: number
  } | null>(null);

  const [filters, setFilters] = useState<AdvancedFilters>({
    search: '',
    id_company: [],
    id_company_type: [],
    id_company_size: [],
    tags_ids: [],
    position: '',
    id_country: [],
    bought_product_ids: [],
    winning_status_ids: [],
    purchase_period_days: null
  });

  const [filterOptions, setFilterOptions] = useState({
    categories: [] as FilterOption[],
    sizes: [] as FilterOption[],
    tags: [] as FilterOption[],
    countries: [] as FilterOption[],
    products: [] as FilterOption[],
    quoteStatuses: [] as FilterOption[]
  });

  // Carga inicial
  useEffect(() => {
    if (isOpen && listId && listId !== 'undefined') {
      if (activeTab === 'MEMBERS') fetchMembers();
      if (activeTab === 'ADD') {
        fetchCandidates();
        fetchCompanies();
        fetchFilterOptions();
      }
      setSelectedIds(new Set());
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

  // Rebuild filter options
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
      let tags: FilterOption[] = [];
      let productsList: FilterOption[] = [];
      let quoteStatusesList: FilterOption[] = [];

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

      if (products && products.length > 0) {
        productsList = products.map((p: any) => ({
          value: p.id_product || p.id,
          label: p.product_name || p.name || p.descripcion || p.description || p.codigo || 'Producto'
        }));
      }

      if (quoteStatuses && quoteStatuses.length > 0) {
        quoteStatusesList = quoteStatuses.map((qs: any) => ({
          value: qs.id_status || qs.id,
          label: qs.status_name || qs.name
        }));
      }

      const countriesOptions: FilterOption[] = (countries || []).map(c => ({ value: c.id, label: c.name }));
      const categoriesOptions: FilterOption[] = (companyTypes || []).map(t => ({ value: t.id, label: t.name }));
      const sizesOptions: FilterOption[] = (companySizes || []).map(s => ({ value: s.id, label: s.name }));

      setFilterOptions({
        categories: categoriesOptions,
        sizes: sizesOptions,
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
      setMembers(membersList as Contact[]);
    } catch (error) {
      console.error('Error en fetchMembers:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const payload = {
        id_tenant: tenantId,
        search: filters.search || undefined,
        id_company: filters.id_company.length > 0 ? filters.id_company : undefined,
        id_company_type: filters.id_company_type.length > 0 ? filters.id_company_type : undefined,
        id_company_size: filters.id_company_size.length > 0 ? filters.id_company_size : undefined,
        id_country: filters.id_country.length > 0 ? filters.id_country : undefined,
        tags_ids: filters.tags_ids.length > 0 ? filters.tags_ids : undefined,
        position: filters.position || undefined,
        bought_product_ids: filters.bought_product_ids.length > 0 ? filters.bought_product_ids : undefined,
        winning_status_ids: filters.winning_status_ids.length > 0 ? filters.winning_status_ids : undefined,
        purchase_period_days: filters.purchase_period_days || undefined
      };

      const data = await marketingApi.searchCrmContacts(tenantId, userId, payload);
      const contactsData = Array.isArray(data) ? data : [];
      
      const currentMemberIds = new Set(members.map(m => m.id_contact));
      const available = contactsData.filter((c: any) => !currentMemberIds.has(c.id_contact));
      
      setCandidates(available);
    } catch (error) {
      console.error('Error en fetchCandidates:', error);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (!id?.trim()) return;
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
      alert('Selecciona al menos un contacto');
      return;
    }
    setPendingAction({ action, count: selectedIds.size });
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    const validIds = Array.from(selectedIds).filter(id => id?.trim());
    
    if (validIds.length === 0) {
      alert('Selecciona al menos un contacto válido');
      setShowConfirm(false);
      return;
    }

    setIsSaving(true);
    try {
      await marketingApi.manageListMembers(listId, validIds, pendingAction.action);
      
      if (pendingAction.action === 'add') {
        setActiveTab('MEMBERS');
      }
      fetchMembers();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    } finally {
      setIsSaving(false);
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  const renderName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.email || 'Sin Email';
  };

  const getInitial = (contact: Contact) => {
    const name = renderName(contact);
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper para obtener label de un filtro
  const getFilterLabel = (filterKey: string, valueId: string): string => {
    if (filterKey === 'company') {
      return companies.find(c => c.id_client_company === valueId)?.name_company || valueId;
    }
    if (filterKey === 'category') {
      return filterOptions.categories.find(c => c.value === valueId)?.label || valueId;
    }
    if (filterKey === 'size') {
      return filterOptions.sizes.find(s => s.value === valueId)?.label || valueId;
    }
    if (filterKey === 'country') {
      return filterOptions.countries.find(c => c.value === valueId)?.label || valueId;
    }
    if (filterKey === 'tags') {
      return filterOptions.tags.find(t => t.value === valueId)?.label || valueId;
    }
    if (filterKey === 'products') {
      return filterOptions.products.find(p => p.value === valueId)?.label || valueId;
    }
    if (filterKey === 'status') {
      return filterOptions.quoteStatuses.find(s => s.value === valueId)?.label || valueId;
    }
    return valueId;
  };

  // Remover un chip individual
  const removeFilterChip = (filterKey: string, value?: string) => {
    if (filterKey === 'search') {
      setFilters(prev => ({ ...prev, search: '' }));
    } else if (filterKey === 'position') {
      setFilters(prev => ({ ...prev, position: '' }));
    } else if (filterKey === 'period') {
      setFilters(prev => ({ ...prev, purchase_period_days: null }));
    } else if (filterKey === 'company' && value) {
      setFilters(prev => ({ ...prev, id_company: prev.id_company.filter(v => v !== value) }));
    } else if (filterKey === 'category' && value) {
      setFilters(prev => ({ ...prev, id_company_type: prev.id_company_type.filter(v => v !== value) }));
    } else if (filterKey === 'size' && value) {
      setFilters(prev => ({ ...prev, id_company_size: prev.id_company_size.filter(v => v !== value) }));
    } else if (filterKey === 'country' && value) {
      setFilters(prev => ({ ...prev, id_country: prev.id_country.filter(v => v !== value) }));
    } else if (filterKey === 'tags' && value) {
      setFilters(prev => ({ ...prev, tags_ids: prev.tags_ids.filter(v => v !== value) }));
    } else if (filterKey === 'products' && value) {
      setFilters(prev => ({ ...prev, bought_product_ids: prev.bought_product_ids.filter(v => v !== value) }));
    } else if (filterKey === 'status' && value) {
      setFilters(prev => ({ ...prev, winning_status_ids: prev.winning_status_ids.filter(v => v !== value) }));
    }
  };

  // Calcular chips activos
  const getActiveChips = () => {
    const chips: { key: string; label: string; value: string }[] = [];

    if (filters.search) {
      chips.push({ key: 'search', label: filters.search, value: '' });
    }
    if (filters.position) {
      chips.push({ key: 'position', label: filters.position, value: '' });
    }
    if (filters.purchase_period_days) {
      chips.push({ key: 'period', label: `${filters.purchase_period_days} días`, value: '' });
    }

    filters.id_company.forEach(id => {
      chips.push({ key: 'company', label: getFilterLabel('company', id), value: id });
    });
    filters.id_company_type.forEach(id => {
      chips.push({ key: 'category', label: getFilterLabel('category', id), value: id });
    });
    filters.id_company_size.forEach(id => {
      chips.push({ key: 'size', label: getFilterLabel('size', id), value: id });
    });
    filters.id_country.forEach(id => {
      chips.push({ key: 'country', label: getFilterLabel('country', id), value: id });
    });
    filters.tags_ids.forEach(id => {
      chips.push({ key: 'tags', label: getFilterLabel('tags', id), value: id });
    });
    filters.bought_product_ids.forEach(id => {
      chips.push({ key: 'products', label: getFilterLabel('products', id), value: id });
    });
    filters.winning_status_ids.forEach(id => {
      chips.push({ key: 'status', label: getFilterLabel('status', id), value: id });
    });

    return chips;
  };

  const activeChips = getActiveChips();

  const clearAllFilters = () => {
    setFilters({
      search: '',
      id_company: [],
      id_company_type: [],
      id_company_size: [],
      tags_ids: [],
      position: '',
      id_country: [],
      bought_product_ids: [],
      winning_status_ids: [],
      purchase_period_days: null
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <AppModalViewport className="bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="h-14 px-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{listName}</h2>
            <span className="text-gray-300 dark:text-slate-600">•</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">Gestionar audiencia</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('MEMBERS')}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-all ${
                activeTab === 'MEMBERS'
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <i className="fa-solid fa-users mr-1"></i> Miembros · {members.length}
            </button>
            <button
              onClick={() => setActiveTab('ADD')}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-all ${
                activeTab === 'ADD'
                  ? 'bg-green-600 text-white dark:bg-green-700'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <i className="fa-solid fa-plus mr-1"></i> Agregar
            </button>
          </div>

          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* CONTENIDO */}
        {activeTab === 'ADD' ? (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar de filtros */}
            <div className="w-72 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex flex-col">
              
              {/* Search principal - FIJO ARRIBA */}
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 flex-shrink-0">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Buscar contactos..."
                    value={filters.search}
                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full h-9 pl-9 pr-3 text-[13px] bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 dark:text-white dark:placeholder-slate-400 rounded-md outline-none focus:bg-white dark:focus:bg-slate-500 focus:border-gray-300 dark:focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Filtros - SCROLLABLE */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Empresa
                  </label>
                  <Combobox
                    label="Seleccionar"
                    icon="fa-solid fa-building"
                    options={companies.map(c => ({ value: c.id_client_company, label: c.name_company }))}
                    selected={filters.id_company}
                    onChange={vals => setFilters(prev => ({ ...prev, id_company: vals }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Categoría
                  </label>
                  <Combobox
                    label="Seleccionar"
                    icon="fa-solid fa-tag"
                    options={filterOptions.categories}
                    selected={filters.id_company_type}
                    onChange={vals => setFilters(prev => ({ ...prev, id_company_type: vals }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Tamaño
                  </label>
                  <Combobox
                    label="Seleccionar"
                    icon="fa-solid fa-chart-simple"
                    options={filterOptions.sizes}
                    selected={filters.id_company_size}
                    onChange={vals => setFilters(prev => ({ ...prev, id_company_size: vals }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    País
                  </label>
                  <Combobox
                    label="Seleccionar"
                    icon="fa-solid fa-globe"
                    options={filterOptions.countries}
                    selected={filters.id_country}
                    onChange={vals => setFilters(prev => ({ ...prev, id_country: vals }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Etiquetas
                  </label>
                  <Combobox
                    label="Seleccionar"
                    icon="fa-solid fa-tags"
                    options={filterOptions.tags}
                    selected={filters.tags_ids}
                    onChange={vals => setFilters(prev => ({ ...prev, tags_ids: vals }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Cargo
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Gerente"
                    value={filters.position}
                    onChange={e => setFilters(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full h-9 px-3 text-[13px] bg-white border border-gray-200 rounded-md outline-none focus:border-gray-300"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Historial de compras
                  </label>
                  
                  <div className="space-y-3">
                    <Combobox
                      label="Productos"
                      icon="fa-solid fa-box"
                      options={filterOptions.products}
                      selected={filters.bought_product_ids}
                      onChange={vals => setFilters(prev => ({ ...prev, bought_product_ids: vals }))}
                    />

                    <Combobox
                      label="Estados"
                      icon="fa-solid fa-circle-check"
                      options={filterOptions.quoteStatuses}
                      selected={filters.winning_status_ids}
                      onChange={vals => setFilters(prev => ({ ...prev, winning_status_ids: vals }))}
                    />

                    <div>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Últimos días (ej. 90)"
                        value={filters.purchase_period_days || ''}
                        onChange={e => setFilters(prev => ({ 
                          ...prev, 
                          purchase_period_days: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                        className="w-full h-9 px-3 text-[13px] bg-white border border-gray-200 rounded-md outline-none focus:border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer de filtros */}
              {activeChips.length > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 flex-shrink-0">
                  <button
                    onClick={clearAllFilters}
                    className="w-full h-8 text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 flex items-center justify-center gap-2 rounded transition-all"
                  >
                    <i className="fa-solid fa-filter-circle-xmark"></i>
                    Limpiar {activeChips.length} filtro{activeChips.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </div>

            {/* Lista de resultados */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Chips de filtros activos - ARRIBA */}
              {activeChips.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex-shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    {activeChips.map((chip, idx) => (
                      <button
                        key={`${chip.key}-${chip.value || idx}`}
                        onClick={() => removeFilterChip(chip.key, chip.value || undefined)}
                        className="inline-flex items-center gap-1.5 h-6 px-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[11px] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-600 transition-all group"
                      >
                        <span className="truncate max-w-[200px]">{chip.label}</span>
                        <i className="fa-solid fa-xmark text-[10px] text-gray-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400"></i>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div className="h-12 px-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {candidates.length} contacto{candidates.length !== 1 ? 's' : ''}
                  </span>
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-gray-300 dark:text-slate-600">•</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>

                {candidates.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    {selectedIds.size === candidates.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                )}
              </div>

              {/* Grid de contactos */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-800">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <BrandSpinner size="lg" />
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <i className="fa-solid fa-inbox text-gray-400 dark:text-slate-500 text-xl"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Sin resultados</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Intenta ajustar los filtros</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {candidates.map(contact => (
                      <label
                        key={contact.id_contact}
                        className={`group relative bg-white dark:bg-slate-700 border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedIds.has(contact.id_contact)
                            ? 'border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <div className="absolute top-3 right-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selectedIds.has(contact.id_contact)
                              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                              : 'border-gray-300 dark:border-slate-500 group-hover:border-gray-400 dark:group-hover:border-slate-400'
                          }`}>
                            {selectedIds.has(contact.id_contact) && (
                              <i className="fa-solid fa-check text-white text-[10px]"></i>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={selectedIds.has(contact.id_contact)}
                            onChange={() => handleToggleSelect(contact.id_contact)}
                          />
                        </div>

                        <div className="pr-6">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                                {getInitial(contact)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {renderName(contact)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                {contact.email}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-slate-400">
                            {(contact.name_company || contact.company_name) && (
                              <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-building text-gray-400 dark:text-slate-500 w-3"></i>
                                <span className="truncate dark:text-slate-300">
                                  {contact.name_company || contact.company_name}
                                </span>
                              </div>
                            )}
                            {contact.position && (
                              <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-briefcase text-gray-400 dark:text-slate-500 w-3"></i>
                                <span className="truncate dark:text-slate-300">{contact.position}</span>
                              </div>
                            )}
                            {(contact.company_city || contact.city) && (
                              <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-location-dot text-gray-400 dark:text-slate-500 w-3"></i>
                                <span className="truncate dark:text-slate-300">
                                  {contact.company_city || contact.city}
                                  {contact.country_name && `, ${contact.country_name}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // TAB DE MIEMBROS
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Search bar */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700">
              <div className="relative max-w-md">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs"></i>
                <input
                  type="text"
                  placeholder="Buscar miembros..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-[13px] bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 dark:text-white dark:placeholder-slate-400 rounded-md outline-none focus:bg-white dark:focus:bg-slate-500 focus:border-gray-300 dark:focus:border-slate-400"
                />
              </div>
            </div>

            {/* Members grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-800">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <BrandSpinner size="lg" />
                </div>
              ) : (() => {
                const filtered = members.filter(m => {
                  const name = renderName(m).toLowerCase();
                  const email = (m.email || '').toLowerCase();
                  const query = memberSearch.toLowerCase();
                  return name.includes(query) || email.includes(query);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                        <i className="fa-solid fa-users text-gray-400 dark:text-slate-500 text-xl"></i>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {memberSearch ? 'Sin resultados' : 'Lista vacía'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {memberSearch ? 'Intenta con otro término' : 'Agrega contactos para comenzar'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(member => {
                      const isUnsubscribed = member.is_subscribed === false;
                      const isSelected = selectedIds.has(member.id_contact);

                      return (
                        <label
                          key={member.id_contact}
                          className={`group relative bg-white dark:bg-slate-700 border rounded-lg p-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400 dark:ring-red-500'
                              : isUnsubscribed
                              ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          <div className="absolute top-3 right-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected
                                ? 'bg-red-600 dark:bg-red-500 border-red-600 dark:border-red-500'
                                : 'border-gray-300 dark:border-slate-500 group-hover:border-gray-400 dark:group-hover:border-slate-400'
                            }`}>
                              {isSelected && (
                                <i className="fa-solid fa-check text-white text-[10px]"></i>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(member.id_contact)}
                            />
                          </div>

                          <div className="pr-6">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                                  {getInitial(member)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {renderName(member)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                  {member.email}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-slate-400">
                              {(member.name_company || member.company_name) && (
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-building text-gray-400 dark:text-slate-500 w-3"></i>
                                  <span className="truncate dark:text-slate-300">
                                    {member.name_company || member.company_name}
                                  </span>
                                </div>
                              )}
                              {member.position && (
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-briefcase text-gray-400 dark:text-slate-500 w-3"></i>
                                  <span className="truncate dark:text-slate-300">{member.position}</span>
                                </div>
                              )}
                              {isUnsubscribed && (
                                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                                  <i className="fa-solid fa-ban w-3"></i>
                                  <span className="font-medium">Desuscrito</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="h-16 px-6 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {selectedIds.size > 0 && (
              <span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedIds.size}</span> seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'ADD' ? (
              <button
                onClick={() => executeAction('add')}
                disabled={selectedIds.size === 0 || isSaving}
                className="h-9 px-4 text-[13px] font-medium bg-gray-900 dark:bg-green-600 text-white rounded-md hover:bg-gray-800 dark:hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <BrandSpinner size="xs" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus text-xs"></i>
                    Agregar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </>
                )}
              </button>
            ) : selectedIds.size > 0 ? (
              <>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isSaving}
                  className="h-9 px-4 text-[13px] font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => executeAction('unsubscribe')}
                  disabled={isSaving}
                  className="h-9 px-4 text-[13px] font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-ban text-xs"></i>
                  Desuscribir
                </button>
                <button
                  onClick={() => executeAction('remove')}
                  disabled={isSaving}
                  className="h-9 px-4 text-[13px] font-medium bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <BrandSpinner size="xs" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-trash text-xs"></i>
                      Eliminar
                    </>
                  )}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingAction(null);
        }}
        onConfirm={confirmAction}
        title={
          pendingAction?.action === 'add' ? 'Agregar contactos' :
          pendingAction?.action === 'remove' ? 'Eliminar contactos' :
          'Desuscribir contactos'
        }
        message={
          pendingAction?.action === 'add' 
            ? `¿Agregar ${pendingAction.count} contacto${pendingAction.count > 1 ? 's' : ''} a la lista?`
            : pendingAction?.action === 'remove'
            ? `¿Eliminar ${pendingAction.count} contacto${pendingAction.count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`
            : `¿Desuscribir ${pendingAction?.count || 0} contacto${(pendingAction?.count || 0) > 1 ? 's' : ''}? No recibirán más correos.`
        }
        confirmText={
          pendingAction?.action === 'add' ? 'Agregar' :
          pendingAction?.action === 'remove' ? 'Eliminar' :
          'Desuscribir'
        }
        cancelText="Cancelar"
        isDestructive={pendingAction?.action === 'remove'}
      />
    </AppModalViewport>,
    document.body
  );
};

export default AudienceMembersModal;