import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientCompany } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ExpandedState,
} from '@tanstack/react-table';

// DATOS DE REFERENCIA
const COUNTRIES = [
  { id: 'AF', name: 'Afganistán' },
  { id: 'AL', name: 'Albania' },
  { id: 'DE', name: 'Alemania' },
  { id: 'AD', name: 'Andorra' },
  { id: 'AO', name: 'Angola' },
  { id: 'AR', name: 'Argentina' },
  { id: 'AU', name: 'Australia' },
  { id: 'AT', name: 'Austria' },
  { id: 'BE', name: 'Bélgica' },
  { id: 'BO', name: 'Bolivia' },
  { id: 'BR', name: 'Brasil' },
  { id: 'CA', name: 'Canadá' },
  { id: 'CL', name: 'Chile' },
  { id: 'CN', name: 'China' },
  { id: 'CO', name: 'Colombia' },
  { id: 'CR', name: 'Costa Rica' },
  { id: 'CU', name: 'Cuba' },
  { id: 'EC', name: 'Ecuador' },
  { id: 'SV', name: 'El Salvador' },
  { id: 'ES', name: 'España' },
  { id: 'US', name: 'Estados Unidos' },
  { id: 'FR', name: 'Francia' },
  { id: 'GT', name: 'Guatemala' },
  { id: 'HN', name: 'Honduras' },
  { id: 'IT', name: 'Italia' },
  { id: 'MX', name: 'México' },
  { id: 'NI', name: 'Nicaragua' },
  { id: 'PA', name: 'Panamá' },
  { id: 'PY', name: 'Paraguay' },
  { id: 'PE', name: 'Perú' },
  { id: 'PR', name: 'Puerto Rico' },
  { id: 'DO', name: 'República Dominicana' },
  { id: 'UY', name: 'Uruguay' },
  { id: 'VE', name: 'Venezuela' },
];

const COMPANY_LABELS = [
  'Cliente',
  'Prospecto (Lead)',
  'Prospecto Interesado',
  'Poco Interesado',
  'Ex-Cliente',
];

const COMPANY_TYPES = [
  'Tecnología y Software',
  'Electrónica y Hardware',
  'Finanzas y Banca',
  'Servicios Legales',
  'Salud y Medicina',
  'Educación',
  'Construcción e Inmobiliaria',
  'Manufactura y Producción',
  'Retail y Comercio',
  'Logística y Transporte',
  'Alimentos y Bebidas',
  'Turismo y Hotelería',
  'Energía y Minería',
  'Marketing y Publicidad',
  'Telecomunicaciones',
  'Agricultura y Pesca',
  'Seguros',
];

const ClientCompaniesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // --- ESTADOS DE DATOS ---
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE LA TABLA ---
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name_company', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // --- ESTADOS DE UI ---
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<ClientCompany> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {}, 
    isDestructive: false 
  });

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);

      const parseResponse = async (res: Response) => {
        if (!res.ok) return [];
        const text = await res.text();
        if (!text) return [];
        const data = JSON.parse(text);
        console.log('Raw API response:', data);
        // Filtrar registros válidos que tengan al menos un id_client_company
        return Array.isArray(data) ? data.filter(company => company && company.id_client_company) : [];
      };

      setCompanies(await parseResponse(response));
    } catch (e) {
      setToast({ message: 'Error al cargar las empresas.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGroupingChange = (newGrouping: string[]) => {
    setGrouping(newGrouping);
    
    if (newGrouping.length > 0) {
      const groupByColumn = newGrouping[0];
      const allExpanded: ExpandedState = {};
      
      companies.forEach((company) => {
        const groupValue = (company as any)[groupByColumn];
        if (groupValue !== null && groupValue !== undefined) {
          allExpanded[String(groupValue)] = true;
        }
      });
      
      setExpanded(allExpanded);
    } else {
      setExpanded({});
    }
  };

  // Clic fuera para cerrar filtros
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- HELPERS ---
  const getInitials = (name: string = '') => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  // --- HANDLERS DE ACCIONES ---
  const handleAddNew = () => {
    setEditingCompany({
      id_type: 'RUC',
      id_number: '',
      name_company: '',
      address: '',
      city: '',
      email_company: '',
      phone_company: '',
      website: '',
      id_country: 'EC', // Ecuador por defecto
      id_company_type: '',
      id_label: '',
      id_tenant: user?.id_tenant,
      created_by: user?.id_user
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, company: ClientCompany) => {
    e.stopPropagation();
    setEditingCompany(company);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Empresa',
      message: '¿Estás seguro de que deseas eliminar esta empresa? Esta acción eliminará también sus contactos asociados.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id_client_company: id, 
              id_tenant: user?.id_tenant, 
              id_user: user?.id_user 
            }),
          });
          if (!response.ok) throw new Error();
          setToast({ message: 'Empresa eliminada correctamente.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: 'Error al eliminar la empresa.', type: 'error' });
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = isEditMode ? 'update' : '';
      const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingCompany,
          id_tenant: user?.id_tenant,
          id_user: user?.id_user
        }),
      });

      if (!response.ok) throw new Error();

      setToast({ 
        message: isEditMode ? 'Empresa actualizada con éxito.' : 'Empresa creada con éxito.', 
        type: 'success' 
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      setToast({ message: 'Error al procesar la solicitud.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingCompany(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // --- LÓGICA DE FILTROS FACETADOS ---
  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    companies.forEach(company => {
      const val = (company as any)[columnId] || '(Vacío)';
      counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  const toggleFilterValue = (columnId: string, value: string) => {
    const currentFilters = [...columnFilters];
    const filterIndex = currentFilters.findIndex(f => f.id === columnId);
    if (filterIndex > -1) {
      const activeValues = currentFilters[filterIndex].value as string[];
      if (activeValues.includes(value)) {
        const next = activeValues.filter(v => v !== value);
        if (next.length === 0) currentFilters.splice(filterIndex, 1);
        else currentFilters[filterIndex].value = next;
      } else {
        currentFilters[filterIndex].value = [...activeValues, value];
      }
    } else {
      currentFilters.push({ id: columnId, value: [value] });
    }
    setColumnFilters(currentFilters);
  };

  // --- COLUMNAS ---
  const columns = useMemo<ColumnDef<ClientCompany>[]>(() => [
    {
      accessorKey: 'country_name',
      header: 'País',
      size: 120,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) {
            return (
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-brand-600 text-white shadow-sm"
                >
                  <i className={`fa-solid ${row.getIsExpanded() ? 'fa-minus' : 'fa-plus'} text-[10px]`}></i>
                </button>
                <span className="font-bold text-slate-700 uppercase tracking-tight">
                  {getValue() as string || 'No asignado'}
                </span>
                <span className="ml-1 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {row.subRows.length}
                </span>
              </div>
            );
          }
          return null;
        }
        return <span className="text-slate-600 text-sm font-medium">{getValue() as string || '-'}</span>;
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || '(Vacío)')
    },
    {
      accessorKey: 'city',
      header: 'Ciudad',
      size: 120,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) {
            return (
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-brand-600 text-white shadow-sm"
                >
                  <i className={`fa-solid ${row.getIsExpanded() ? 'fa-minus' : 'fa-plus'} text-[10px]`}></i>
                </button>
                <span className="font-bold text-slate-700 uppercase tracking-tight">
                  {getValue() as string || 'No asignado'}
                </span>
                <span className="ml-1 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {row.subRows.length}
                </span>
              </div>
            );
          }
          return null;
        }
        return <span className="text-slate-600 text-sm font-medium">{getValue() as string || '-'}</span>;
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || '(Vacío)')
    },
    {
      accessorKey: 'name_company',
      header: 'Empresa',
      size: 220,
      enableColumnFilter: false,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] border border-indigo-100 shadow-sm">
              {getInitials(getValue() as string)}
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight">{getValue() as string}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'id_number',
      header: 'Identificación',
      size: 140,
      enableColumnFilter: false,
      cell: ({ row }) => row.getIsGrouped() ? null : (
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{row.original.id_type}</span>
            <span className="text-slate-700 font-mono text-sm font-bold">{row.original.id_number}</span>
        </div>
      ),
    },
    {
      accessorKey: 'company_type_name',
      header: 'Tipo',
      size: 150,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) {
            return (
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-brand-600 text-white shadow-sm"
                >
                  <i className={`fa-solid ${row.getIsExpanded() ? 'fa-minus' : 'fa-plus'} text-[10px]`}></i>
                </button>
                <span className="font-bold text-slate-700 uppercase tracking-tight">
                  {getValue() as string || 'No asignado'}
                </span>
                <span className="ml-1 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {row.subRows.length}
                </span>
              </div>
            );
          }
          return null;
        }
        return (
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 uppercase">
            {getValue() as string || '-'}
          </span>
        );
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || '(Vacío)')
    },
    {
      accessorKey: 'label_name',
      header: 'Etiqueta',
      size: 120,
      enableColumnFilter: true,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const labelName = getValue() as string;
        const labelColor = row.original.label_color;
        if (!labelName) return <span className="text-slate-400 text-sm">-</span>;
        return (
          <span 
            className="px-2 py-1 rounded-full text-xs font-bold border" 
            style={{ 
              backgroundColor: labelColor ? `${labelColor}15` : '#f1f5f9',
              color: labelColor || '#64748b',
              borderColor: labelColor || '#cbd5e1'
            }}
          >
            {labelName}
          </span>
        );
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || '(Vacío)')
    },
    {
      accessorKey: 'created_by_name',
      header: 'Creado',
      size: 140,
      enableColumnFilter: false,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const avatar = row.original.created_by_avatar;
        const name = getValue() as string || 'Desconocido';
        return (
          <div className="flex items-center gap-2">
            {avatar ? (
              <img src={avatar} alt={name} className="w-6 h-6 rounded-full border border-slate-200" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 border border-slate-200">
                {name.charAt(0)}
              </div>
            )}
            <span className="text-sm text-slate-600 font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'ACCIONES',
      size: 100,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            <button 
              onClick={(e) => handleEdit(e, row.original)} 
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"
              title="Editar"
            >
              <i className="fa-solid fa-pen text-[10px]"></i>
            </button>
            <button 
              onClick={(e) => handleDelete(e, row.original.id_client_company)} 
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"
              title="Eliminar"
            >
              <i className="fa-solid fa-trash text-[10px]"></i>
            </button>
          </div>
        );
      },
    }
  ], []);

  const table = useReactTable({
    data: companies,
    columns,
    state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
      
      {/* Toolbar superior */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input 
                    value={globalFilter} 
                    onChange={e => setGlobalFilter(e.target.value)}
                    placeholder="Buscar empresas..." 
                    className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 w-64 shadow-sm"
                />
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => handleGroupingChange(grouping.length && grouping[0] === 'country_name' ? [] : ['country_name'])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        grouping.length && grouping[0] === 'country_name' 
                        ? 'bg-brand-600 text-white border-brand-700 shadow-inner' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <i className="fa-solid fa-globe mr-2"></i> {grouping.length && grouping[0] === 'country_name' ? 'Desagrupar' : 'Agrupar por País'}
                </button>
                <button 
                    onClick={() => handleGroupingChange(grouping.length && grouping[0] === 'city' ? [] : ['city'])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        grouping.length && grouping[0] === 'city' 
                        ? 'bg-brand-600 text-white border-brand-700 shadow-inner' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <i className="fa-solid fa-city mr-2"></i> {grouping.length && grouping[0] === 'city' ? 'Desagrupar' : 'Agrupar por Ciudad'}
                </button>
                <button 
                    onClick={() => handleGroupingChange(grouping.length && grouping[0] === 'company_type_name' ? [] : ['company_type_name'])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        grouping.length && grouping[0] === 'company_type_name' 
                        ? 'bg-brand-600 text-white border-brand-700 shadow-inner' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <i className="fa-solid fa-building mr-2"></i> {grouping.length && grouping[0] === 'company_type_name' ? 'Desagrupar' : 'Agrupar por Tipo'}
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleAddNew} 
            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all"
          >
              <i className="fa-solid fa-plus mr-2"></i> Nueva Empresa
          </button>
        </div>
      </div>

      {/* Área de la Tabla */}
      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40 shadow-sm">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const canFilter = header.column.columnDef.enableColumnFilter !== false;

                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left relative group transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 cursor-pointer select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{
                            asc: <i className="fa-solid fa-sort-up text-brand-600"></i>,
                            desc: <i className="fa-solid fa-sort-down text-brand-600"></i>,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>

                        {canFilter && header.column.id !== 'actions' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id);
                            }}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                              isFiltered ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:bg-slate-200 hover:text-slate-500'
                            }`}
                          >
                            <i className="fa-solid fa-filter text-[10px]"></i>
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Filtros */}
                      {activeFilterMenu === header.column.id && (
                        <div 
                          ref={filterMenuRef}
                          className="absolute top-full left-0 mt-1 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          <div className="max-h-60 overflow-y-auto px-1">
                            {getFacetedValues(header.column.id).map(([val, count]) => {
                              const activeValues = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                              const isChecked = activeValues.includes(val);
                              return (
                                <label 
                                  key={val} 
                                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-brand-600 border-brand-600 shadow-sm' : 'bg-white border-slate-300'}`}>
                                      {isChecked && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{val}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-600">({count})</span>
                                  <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={isChecked} 
                                    onChange={() => toggleFilterValue(header.column.id, val)}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                   <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-3"></i>
                   <p className="text-slate-400 text-sm font-medium tracking-wide">Cargando empresas...</p>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                   <div className="flex flex-col items-center gap-3">
                     <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                       <i className="fa-solid fa-building text-2xl text-slate-300"></i>
                     </div>
                     <div>
                       <p className="text-slate-600 font-bold text-sm">No hay empresas registradas</p>
                       <p className="text-slate-400 text-xs mt-1">Crea tu primera empresa para comenzar</p>
                     </div>
                   </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.map(row => {
              const isGrouped = row.getIsGrouped();
              return (
                <tr 
                    key={row.id} 
                    className={`${isGrouped ? 'bg-slate-50/80 font-bold border-l-4 border-l-brand-500' : 'hover:bg-blue-50/30'} border-b border-slate-100 transition-colors group cursor-pointer`}
                    onClick={() => !isGrouped && navigate(`/app/client-companies/${row.original.id_client_company}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`px-4 border-r border-slate-50 ${isGrouped ? 'py-3' : 'py-1.5'}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / Paginación */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span>{companies.length} empresas totales</span>
            {columnFilters.length > 0 && (
                <button onClick={() => setColumnFilters([])} className="text-red-500 hover:text-red-700 font-black flex items-center gap-1 transition-colors">
                    <i className="fa-solid fa-filter-circle-xmark text-xs"></i> Limpiar Filtros
                </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black tracking-normal">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
      </div>

      {/* Modal de Creación / Edición */}
      {isModalOpen && editingCompany && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEditMode ? 'bg-brand-100 text-brand-600' : 'bg-emerald-100 text-emerald-600'}`}>
                   <i className={`fa-solid ${isEditMode ? 'fa-building-circle-check' : 'fa-building-circle-arrow-right'}`}></i>
                </div>
                {isEditMode ? 'Editar Empresa' : 'Nueva Empresa'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo ID <span className="text-red-500">*</span></label>
                    <select 
                        name="id_type" 
                        required 
                        value={editingCompany.id_type || 'RUC'} 
                        onChange={handleInputChange} 
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
                        onChange={handleInputChange} 
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
                  onChange={handleInputChange}
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
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar país</option>
                    {COUNTRIES.map(country => (
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
                    onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar tipo</option>
                    {COMPANY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta <span className="text-red-500">*</span></label>
                  <select
                    name="id_label"
                    required
                    value={editingCompany.id_label || ''}
                    onChange={handleInputChange}
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
                    onChange={handleInputChange}
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
                    onChange={handleInputChange}
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
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  placeholder="022..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  {isEditMode ? 'Actualizar Empresa' : 'Guardar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default ClientCompaniesList;