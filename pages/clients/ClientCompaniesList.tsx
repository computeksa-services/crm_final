import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { ClientCompany } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import CompanyFormModal from './CompanyFormModal';
import { apiFetch } from '../../services/apiClient';
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

const ClientCompaniesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companies: cachedCompanies, companyLabelsMap, companySizes = [], loading: cacheLoading, invalidateCompanies } = useDataCache();
  
  const companies = useMemo(() => 
    cachedCompanies.filter(c => c && c.id_client_company), 
    [cachedCompanies]
  );
  const loading = cacheLoading;
  
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name_company', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('companiesList_grouping');
    return saved ? JSON.parse(saved) : [];
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [columnSizing, setColumnSizing] = useState({});

  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<ClientCompany> | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCompanyId, setShareCompanyId] = useState<string | null>(null);
  const [shareCompanyName, setShareCompanyName] = useState<string>('');
  const [shareCompanyCreator, setShareCompanyCreator] = useState<string>('');
  const [shareCompanyCollaborators, setShareCompanyCollaborators] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false 
  });

  useEffect(() => {
    localStorage.setItem('companiesList_grouping', JSON.stringify(grouping));
  }, [grouping]);

  const handleGroupingChange = useCallback((newGrouping: string[]) => {
    setGrouping(newGrouping);
    if (newGrouping.length > 0) setExpanded(true);
    else setExpanded({});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleAddNew = () => {
    setEditingCompany(null);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openShareModal = async (company: ClientCompany) => {
    setShareCompanyId(company.id_client_company || null);
    setShareCompanyName((company as any).name_company || (company as any).company_name || '');
    setShareCompanyCreator((company as any).created_by_name || '');
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/companies/share?id_client_company=${company.id_client_company}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list.map((u: any) => {
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
      setShareCompanyCollaborators(mapped);
    } catch {
      setShareCompanyCollaborators([]);
    }
    setShareModalOpen(true);
  };

  const handleEdit = async (e: React.MouseEvent, company: ClientCompany) => {
    e.stopPropagation();
    try {
      // Fetch a full, detailed record to ensure all fields are populated
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/detail?id_client_company=${company.id_client_company}&id_tenant=${user?.id_tenant}&id_user=${user?.id_user}`);
      if (!response.ok) throw new Error('Failed to fetch company details');
      const detailedCompany = await response.json();
      
      setEditingCompany(detailedCompany[0] || company); // Fallback to list data if fetch fails
      setIsEditMode(true);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching company details for edit:", error);
      setToast({ message: 'No se pudieron cargar los detalles completos de la empresa.', type: 'error' });
      // Fallback: Open modal with potentially incomplete data from the list
      setEditingCompany(company);
      setIsEditMode(true);
      setIsModalOpen(true);
    }
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    await invalidateCompanies();
    setToast({ message: isEditMode ? 'Empresa actualizada.' : 'Empresa creada.', type: 'success' });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Empresa',
      message: '¿Estás seguro de que deseas eliminar esta empresa?',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_client_company: id, id_tenant: user?.id_tenant, id_user: user?.id_user }),
          });
          if (!response.ok) throw new Error();
          setToast({ message: 'Empresa eliminada correctamente.', type: 'success' });
          await invalidateCompanies();
        } catch (error) {
          setToast({ message: 'Error al eliminar la empresa.', type: 'error' });
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    companies.forEach(company => {
      if (columnId === 'labels') {
        const ids: string[] = Array.isArray((company as any).labels) ? (company as any).labels : [];
        if (ids.length === 0) counts.set('(Sin etiqueta)', (counts.get('(Sin etiqueta)') || 0) + 1);
        else ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
      } else {
        const val = (company as any)[columnId] ?? '(Vacío)';
        counts.set(String(val), (counts.get(String(val)) || 0) + 1);
      }
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

  // --- PASO 1: PREPARACIÓN DE DATOS (FLATTENING) ---
  const tableData = useMemo(() => {
    if (grouping.length > 0 && grouping[0] === 'labels') {
      return companies.flatMap((company) => {
        const ids = Array.isArray((company as any).labels) ? (company as any).labels : [];
        if (ids.length === 0) return [{ ...company, __f_label: '(Sin etiqueta)' }];
        return ids.map((id: string) => ({ ...company, __f_label: id }));
      });
    }
    return companies;
  }, [companies, grouping]);

  // --- PASO 2: COLUMNAS ---
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name_company',
      header: 'Empresa',
      size: 420,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const companyName = getValue() as string;
        const avatarColor = getAvatarColor(companyName);
        return (
          <div className="flex items-center gap-3 py-1">
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold text-[10px] border shadow-sm" style={{ backgroundColor: avatarColor.bg, color: '#000', borderColor: avatarColor.text }}>
              {getInitials(companyName)}
            </div>
            <span className="font-bold text-black text-sm tracking-tight break-words">{companyName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'id_number',
      header: 'Identificación',
      size: 140,
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
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped() && grouping[0] === column.id) {
          return (
            <div className="flex items-center gap-3">
              <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
              <span className="font-bold text-slate-700 uppercase tracking-tight">{getValue() as string || 'No asignado'}</span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
            </div>
          );
        }
        return row.getIsGrouped() ? null : (
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 uppercase whitespace-nowrap">{getValue() as string || '-'}</span>
        );
      },
    },
    {
      accessorKey: 'company_size',
      header: 'Tamaño',
      size: 130,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const sizeValue = getValue() as string | undefined;
        if (!sizeValue) return <span className="text-slate-400 text-sm">-</span>;
        const sizeInfo = companySizes.find(s => s.id === sizeValue);
        const tooltipText = sizeInfo?.name || sizeValue;
        return (
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100 uppercase whitespace-nowrap cursor-help" title={tooltipText}>{sizeValue}</span>
        );
      },
    },
    {
      id: 'labels',
      header: 'Etiquetas',
      size: 240,
      // EL CAMBIO CLAVE: El accessor cambia según si estamos agrupando o no
      accessorFn: (row) => (grouping[0] === 'labels' ? (row as any).__f_label : (row as any).labels),
      cell: ({ row, column, getValue }) => {
        if (row.getIsGrouped() && grouping[0] === column.id) {
          const labelId = getValue() as string;
          const isNone = labelId === '(Sin etiqueta)';
          const info = !isNone ? companyLabelsMap[labelId] : null;
          
          return (
            <div className="flex items-center gap-3">
              <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap"
                style={{ 
                  backgroundColor: info?.color ? `${info.color}15` : '#f1f5f9', 
                  color: info?.color || '#475569', 
                  borderColor: info?.color || '#cbd5e1' 
                }}>
                {isNone ? 'Sin etiqueta' : (info?.name || labelId)}
              </span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
            </div>
          );
        }
        
        if (row.getIsGrouped()) return null;

        const labelIds: string[] = Array.isArray((row.original as any).labels) ? (row.original as any).labels : [];
        if (labelIds.length === 0) return <span className="text-slate-400 text-sm py-1">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {labelIds.map((id) => {
              const info = companyLabelsMap[id];
              return (
                <span key={id} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap"
                  style={{ backgroundColor: info?.color ? `${info.color}15` : '#f1f5f9', color: info?.color || '#475569', borderColor: info?.color || '#cbd5e1' }}>
                  {info?.name || id}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      accessorKey: 'country_name',
      header: 'País',
      size: 120,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped() && grouping[0] === column.id) {
          return (
            <div className="flex items-center gap-3">
              <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
              <span className="font-bold text-slate-700 uppercase tracking-tight">{getValue() as string || 'No asignado'}</span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
            </div>
          );
        }
        return row.getIsGrouped() ? null : <span className="text-slate-600 text-sm font-medium">{getValue() as string || '-'}</span>;
      },
    },
    {
      accessorKey: 'created_by_name',
      header: 'Creado',
      size: 200,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const avatar = row.original.created_by_avatar;
        const name = getValue() as string || 'Desconocido';
        return (
          <div className="flex items-center gap-2 py-1">
            {avatar ? <img src={avatar} alt={name} className="w-8 h-8 rounded-full border border-slate-200 object-cover" /> : 
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 border border-slate-200 font-bold">{getInitials(name)}</div>}
            <span className="text-sm text-slate-600 font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'ACCIONES',
      size: 100,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={(e) => handleEdit(e, row.original)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
            <button onClick={(e) => { e.stopPropagation(); openShareModal(row.original); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-user-plus text-[10px]"></i></button>
            <button onClick={(e) => handleDelete(e, row.original.id_client_company)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
          </div>
        );
      },
    }
  ], [grouping, companyLabelsMap]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableColumnResizing: true,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-58px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative order-3 lg:order-1 w-full lg:flex-1">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Buscar empresas..." className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm" />
        </div>
        <div className="order-2 lg:order-2 w-full lg:w-auto flex items-center justify-start lg:justify-center flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm min-w-[200px]">
          <span className="text-[11px] font-black text-slate-400 uppercase px-2 whitespace-nowrap">Agrupar por:</span>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => handleGroupingChange(grouping[0] === 'country_name' ? [] : ['country_name'])} className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${grouping[0] === 'country_name' ? 'bg-brand-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-globe"></i> País</button>      
            <button onClick={() => handleGroupingChange(grouping[0] === 'company_type_name' ? [] : ['company_type_name'])} className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${grouping[0] === 'company_type_name' ? 'bg-brand-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-building"></i> Tipo</button>
            <button onClick={() => handleGroupingChange(grouping[0] === 'labels' ? [] : ['labels'])} className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${grouping[0] === 'labels' ? 'bg-brand-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-tags"></i> Etiquetas</button>
          </div>
        </div>
        <button onClick={handleAddNew} className="order-1 lg:order-3 w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-plus"></i> Nueva Empresa</button>
      </div>

      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="border-separate border-spacing-0" style={{ width: `${table.getTotalSize()}px`, minWidth: '100%' }}>
          <thead className="sticky top-0 z-40 shadow-sm bg-slate-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} style={{ width: header.getSize() }} className="border-b border-r border-slate-200 px-4 py-3 text-left">
                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      {{ asc: <i className="fa-solid fa-sort-up text-brand-600"></i>, desc: <i className="fa-solid fa-sort-down text-brand-600"></i> }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <>
                {/* Skeleton Loader - 8 filas */}
                {[...Array(8)].map((_, idx) => (
                  <tr key={idx} className="border-b border-slate-100 animate-pulse">
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                        <div className="space-y-1.5">
                          <div className="h-3.5 bg-slate-200 rounded w-36"></div>
                          <div className="h-3 bg-slate-200 rounded w-28"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-32"></div></td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-1.5"><div className="h-6 bg-slate-200 rounded-full w-24"></div></td>
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1.5">
                        <div className="w-7 h-7 bg-slate-200 rounded"></div>
                        <div className="w-7 h-7 bg-slate-200 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-20 text-center"><p className="font-bold text-slate-600">No hay empresas aún</p></td></tr>
            ) : table.getRowModel().rows.map(row => {
              const isGrouped = row.getIsGrouped();
              return (
                <tr key={row.id} onClick={() => isGrouped ? row.toggleExpanded() : navigate(`/app/client-companies/${row.original.id_client_company}`)} className={`${isGrouped ? 'bg-slate-50/80 font-bold border-l-4 border-l-brand-500 cursor-pointer' : 'hover:bg-blue-50/30 cursor-pointer group'} border-b border-slate-100 transition-colors`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`px-4 ${isGrouped ? 'py-3' : 'py-1.5'} border-r border-slate-50`}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase shrink-0">
          <span>{companies.length} REGISTROS</span>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
      </div>

      <CompanyFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} mode={isEditMode ? 'edit' : 'create'} initialData={editingCompany || undefined} onSuccess={handleModalSuccess} />
      {shareModalOpen && shareCompanyId && (
        <ShareModal
          entity="company"
          id={shareCompanyId}
          entityName={shareCompanyName || `Empresa #${shareCompanyId}`}
          creatorName={shareCompanyCreator}
          isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareCompanyId(null); setShareCompanyName(''); setShareCompanyCreator(''); setShareCompanyCollaborators([]); }}
          onShared={() => setToast({ message: 'Asignaciones actualizadas.', type: 'success' })}
          currentCollaborators={shareCompanyCollaborators}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default ClientCompaniesList;