import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import ContactsImportExportModal from '../../components/ContactsImportExportModal';
import { ClientContact } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import ContactFormModal from './ContactFormModal';
import StartFollowUpModal from '../../components/StartFollowUpModal';
import { AvatarBadge } from '../../components/AvatarBadge';
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

const ClientContactsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contacts: cachedContacts, loading: cacheLoading, invalidateContacts } = useDataCache();
  
  // --- ESTADOS DE DATOS ---
  const contacts = useMemo(() => cachedContacts.filter(c => c && c.id_contact), [cachedContacts]);
  const loading = cacheLoading;
  
  // --- ESTADOS DE LA TABLA ---
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('contactsList_grouping');
    return saved ? JSON.parse(saved) : [];
  }); 
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [columnSizing, setColumnSizing] = useState({});

  // --- ESTADOS DE UI ---
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | undefined>(undefined);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareContactId, setShareContactId] = useState<string | null>(null);
  const [shareContactName, setShareContactName] = useState<string>('');
  const [shareContactCreator, setShareContactCreator] = useState<string>('');
  const [shareContactCollaborators, setShareContactCollaborators] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {}, 
    isDestructive: false 
  });
  const [followUpContact, setFollowUpContact] = useState<ClientContact | null>(null);

  // --- CARGA DE DATOS (Ya no necesaria, usa caché) ---
  // El caché se carga automáticamente

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Guardar estado de agrupación en localStorage
  useEffect(() => {
    localStorage.setItem('contactsList_grouping', JSON.stringify(grouping));
  }, [grouping]);

  // --- HELPERS ---
  const getCompanyNameForContact = useCallback((contact: ClientContact) => {
    return (contact as any).name_company || 'SIN EMPRESA';
  }, []);

  const getInitials = (first: string = '', last: string = '') => {
    const f = first?.charAt(0) || '';
    const l = last?.charAt(0) || '';
    return (f + l).toUpperCase() || '?';
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

  const getFollowUpStatus = (nextDateStr?: string | null) => {
    if (!nextDateStr) {
      return { 
        label: 'Directorio', 
        color: 'bg-slate-200 text-slate-600',
        tooltip: 'Contacto sin seguimiento activo' 
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const nextDate = new Date(nextDateStr);
    nextDate.setHours(0, 0, 0, 0);

    if (nextDate < today) {
      return { 
        label: 'Atrasado', 
        color: 'bg-red-100 text-red-700 border border-red-200',
        tooltip: `Siguiente acción vencida (Fecha: ${nextDate.toLocaleDateString()})` 
      };
    } else if (nextDate.getTime() === today.getTime()) {
      return { 
        label: 'Para Hoy', 
        color: 'bg-amber-100 text-amber-700 border border-amber-200',
        tooltip: `Siguiente acción programada para hoy`
      };
    } else {
      return { 
        label: 'Programado', 
        color: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        tooltip: `Siguiente acción: ${nextDate.toLocaleDateString()}` 
      };
    }
  };

  // --- FILTRO GLOBAL PERSONALIZADO ---
  const globalContactFilter = (row: any, columnId: string, filterValue: string) => {
    if (!filterValue) return true;
    
    const searchTerm = filterValue.toLowerCase();
    const contact = row.original as ClientContact;
    
    // Buscar en todos los campos relevantes
    const searchableFields = [
      contact.first_name || '',
      contact.last_name || '',
      contact.email || '',
      contact.phone || '',
      contact.position || '',
      (contact as any).name_company || '',
      (contact as any).client_company_name || '',
      (contact as any).subtitle || '',
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim(), // Nombre completo
      `${contact.last_name || ''} ${contact.first_name || ''}`.trim(), // Apellido Nombre
    ];
    
    return searchableFields.some(field => 
      field.toLowerCase().includes(searchTerm)
    );
  };

  // --- HANDLERS DE ACCIONES ---
  const handleAddNew = () => {
    setEditingContact(undefined);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, contact: ClientContact) => {
    e.stopPropagation();
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const openShareModal = async (contact: ClientContact) => {
    setShareContactId(contact.id_contact || null);
    setShareContactName((contact as any).full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || '');
    setShareContactCreator((contact as any).created_by_name || '');
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/contacts/share?id_contact=${contact.id_contact}`);
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
      setShareContactCollaborators(mapped);
    } catch {
      setShareContactCollaborators([]);
    }
    setShareModalOpen(true);
  };

  const handleModalSuccess = async (savedContact?: ClientContact) => {
    setIsModalOpen(false);
    await invalidateContacts(savedContact); // Recargar caché con actualización optimista
    setToast({ message: isEditMode ? 'Contacto actualizado.' : 'Contacto creado.', type: 'success' });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro de que deseas eliminar este contacto? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id_contact: id, 
              id_tenant: user?.id_tenant, 
              id_user: user?.id_user 
            }),
          });
          if (!response.ok) throw new Error();
          setToast({ message: 'Contacto eliminado correctamente.', type: 'success' });
          await invalidateContacts(); // Recargar caché
        } catch (error) {
          setToast({ message: 'Error al eliminar el contacto.', type: 'error' });
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // --- LÓGICA DE FILTROS FACETADOS ---
  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    contacts.forEach(contact => {
      let val = '';
      if (columnId === 'id_client_company') {
        val = getCompanyNameForContact(contact);
      } else if (columnId === 'contact_status') {
        val = getFollowUpStatus(contact.next_contact_date).label;
      } else {
        val = (contact as any)[columnId] || '(Vacío)';
      }
      counts.set(val, (counts.get(val) || 0) + 1);
    });
    const entries = Array.from(counts.entries());
    if (columnId === 'id_client_company' || columnId === 'position') {
      return entries.sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }));
    }
    return entries.sort((a, b) => b[1] - a[1]);
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
  const columns = useMemo<ColumnDef<ClientContact>[]>(() => [
    {
      accessorKey: 'first_name',
      header: 'Contacto',
      size: 420,
      minSize: 340,
      maxSize: 580,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const c = row.original;
        const contactName = `${c.first_name || ''} ${c.last_name || ''}`;
        return (
          <div className="flex items-center gap-3">
            <AvatarBadge
              initials={getInitials(c.first_name, c.last_name)}
              name={contactName}
              size="sm"
              className="rounded-full"
            />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{`${c.last_name} ${c.first_name || ''}`}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'id_client_company',
      header: 'Empresa',
      size: 420,
      minSize: 340,
      maxSize: 580,
      enableColumnFilter: true,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) {
          // CAMBIO: Ya no renderizamos un botón clickeable, solo un contenedor visual.
          // La acción de click se maneja en el <tr onClick> de la tabla.
          return (
            <div className="flex items-center gap-3">
              {/* Ícono de flecha que rota (chevron) en lugar del botón más/menos pesado */}
              <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
              
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                {((row.subRows?.[0]?.original as any)?.name_company) || 'SIN EMPRESA'}
              </span>
              <span className="bg-slate-200 dark:bg-slate-400 text-slate-600 dark:text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {row.subRows.length}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-3 py-1">
            {(() => {
              const companyName = (row.original as any).name_company || 'SIN EMPRESA';
              const companyInitials = companyName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
              return (
                <>
                  <AvatarBadge
                    initials={companyInitials}
                    name={companyName}
                    size="sm"
                    className="rounded-none"
                  />
                  <span className="font-bold text-black text-sm tracking-tight break-words">
                    {companyName}
                  </span>
                </>
              );
            })()}
          </div>
        );
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(((row.original as any).name_company) || 'SIN EMPRESA')
    },
    {
      accessorKey: 'position',
      header: 'Cargo',
      size: 250,
      enableColumnFilter: true,
      cell: ({ row, getValue }) => 
        row.getIsGrouped() ? null : <span className="text-slate-500 text-[13px]">{getValue() as string || '-'}</span>,
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || '(Vacío)')
    },
    {
      accessorKey: 'email',
      header: 'Email',
      size: 250,
      enableColumnFilter: false,
      cell: ({ row, getValue }) => 
        row.getIsGrouped() ? null : <span className="text-brand-600 text-[13px] truncate block hover:underline">{getValue() as string}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Teléfono',
      size: 150,
      enableColumnFilter: false,
      cell: ({ row, getValue }) => 
        row.getIsGrouped() ? null : <span className="text-slate-600 text-[13px]">{getValue() as string || '-'}</span>,
    },
    {
      accessorKey: 'contact_status', 
      header: 'Estado',
      size: 180,
      enableColumnFilter: true,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const contact = row.original;
        const status = getFollowUpStatus(contact.next_contact_date);
        
        if (status.label === 'Directorio') {
            return (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setFollowUpContact(contact);
                    }}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1.5"
                >
                    <i className="fa-solid fa-rocket text-xs"></i>
                    Start Follow-Up
                </button>
            );
        }

        return (
          <div className="flex items-center gap-2" title={status.tooltip}>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${status.color}`}>
              {status.label}
            </span>
          </div>
        );
      },
       filterFn: (row, id, filterValue: string[]) => {
        if (filterValue.length === 0) return true;
        const status = getFollowUpStatus(row.original.next_contact_date);
        return filterValue.includes(status.label);
      }
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
              onClick={(e) => { e.stopPropagation(); openShareModal(row.original); }} 
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"
              title="Asignar"
            >
              <i className="fa-solid fa-user-plus text-[10px]"></i>
            </button>
            <button 
              onClick={(e) => handleDelete(e, row.original.id_contact)} 
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
    data: contacts,
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
    columnResizeMode: 'onChange',
    globalFilterFn: globalContactFilter,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-58px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
      
      {/* TOOLBAR RESPONSIVO */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative order-3 lg:order-1 w-full lg:flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
                value={globalFilter} 
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Buscar contacto..." 
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
        </div>

        <div className="order-2 lg:order-2 w-full lg:w-auto flex items-center justify-start lg:justify-center flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm min-w-[200px]">
            <span className="text-[11px] font-black text-slate-400 uppercase px-2 whitespace-nowrap">Agrupar por:</span>
            <div className="flex items-center gap-1 flex-wrap">
                <button 
                    onClick={() => setGrouping(prev => prev.length ? [] : ['id_client_company'])}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                        grouping.length 
                        ? 'bg-brand-600 text-white shadow-inner' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    <i className="fa-solid fa-building text-[11px]"></i> Empresa
                </button>
            </div>
        </div>
        
        <div className="flex gap-2 order-1 lg:order-3 w-full sm:w-auto">
          <button 
            onClick={handleAddNew} 
            className={`px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all flex items-center justify-center gap-2 ${(!loading && contacts.length === 0) ? 'mx-auto sm:mx-0' : ''}`}
          >
              <i className="fa-solid fa-plus"></i> Nuevo Contacto
          </button>
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-bold hover:bg-sky-700 shadow-sm border border-sky-700 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-file-arrow-up"></i> Importar
          </button>
        </div>
        {/* Modal de Importación */}
        <ContactsImportExportModal open={isImportExportOpen} onClose={() => setIsImportExportOpen(false)} />
      </div>

      {/* Área de la Tabla */}
      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="border-separate border-spacing-0" style={{ width: `${table.getTotalSize()}px`, minWidth: '100%' }}>
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
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-4 h-4 min-w-4 min-h-4 shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-brand-600 border-brand-600 shadow-sm' : 'bg-white border-slate-300'}`}>
                                      {isChecked && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                    </div>
                                    <span
                                      title={val}
                                      className={`text-xs font-bold text-slate-700 tracking-tight truncate ${header.column.id === 'position' ? 'normal-case' : 'uppercase'}`}
                                    >
                                      {val}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-600 shrink-0 ml-2">({count})</span>
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
                          {isFiltered && (
                            <div className="mt-2 pt-2 border-t border-slate-100 px-3">
                              <button 
                                onClick={() => setColumnFilters([])}
                                className="text-[10px] font-bold text-red-500 hover:underline"
                              >
                                Limpiar filtro
                              </button>
                            </div>
                          )}
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
              <>
                {/* Skeleton Loader - 8 filas */}
                {[...Array(8)].map((_, idx) => (
                  <tr key={idx} className="border-b border-slate-100 animate-pulse">
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-full"></div>
                        <div className="space-y-1.5">
                          <div className="h-3.5 bg-slate-200 rounded w-32"></div>
                          <div className="h-3 bg-slate-200 rounded w-24"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-40"></div></td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-4 py-1.5"><div className="h-3 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-1.5"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1.5">
                        <div className="w-7 h-7 bg-slate-200 rounded"></div>
                        <div className="w-7 h-7 bg-slate-200 rounded"></div>
                        <div className="w-7 h-7 bg-slate-200 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                   <div className="flex flex-col items-center gap-3 text-slate-500">
                     <i className="fa-solid fa-user text-4xl text-slate-300"></i>
                     <p className="text-slate-600 font-bold text-sm">No hay contactos aún</p>
                     <p className="text-slate-400 text-sm">Crea tu primer contacto para visualizarlo aquí.</p>
                     <button onClick={handleAddNew} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all text-sm font-bold">Crear contacto</button>
                   </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.map(row => {
              const isGrouped = row.getIsGrouped();
              
              // CAMBIO: Definimos el manejador de clic para la fila
              const handleRowClick = () => {
                if (isGrouped) {
                  // Si es grupo, expandir/colapsar
                  row.toggleExpanded();
                } else {
                  // Si no es grupo, navegar
                  navigate(`/app/client-contacts/${row.original.id_contact}`);
                }
              };

              return (
                <tr 
                    key={row.id} 
                    // CAMBIO: onClick condicional
                    onClick={handleRowClick}
                    className={`
                      ${isGrouped 
                        ? 'bg-slate-50/80 font-bold border-l-4 border-l-brand-500 cursor-pointer' // cursor-pointer importante
                        : 'hover:bg-blue-50/30 cursor-pointer group'
                      } 
                      border-b border-slate-100 transition-colors
                    `}
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
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-4">
            <span>{contacts.length} REGISTROS</span>
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
      <ContactFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={isEditMode ? 'edit' : 'create'}
        initialData={editingContact}
        onSuccess={handleModalSuccess}
      />

      {followUpContact && (
        <StartFollowUpModal
            contact={followUpContact}
            isOpen={!!followUpContact}
            onClose={() => setFollowUpContact(null)}
            onSuccess={() => {
                setFollowUpContact(null);
                invalidateContacts();
                setToast({ message: 'Seguimiento iniciado.', type: 'success' });
            }}
        />
      )}

      {shareModalOpen && shareContactId && (
        <ShareModal
          entity="contact"
          id={shareContactId}
          entityName={shareContactName || `Contacto #${shareContactId}`}
          creatorName={shareContactCreator}
          isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareContactId(null); setShareContactName(''); setShareContactCreator(''); setShareContactCollaborators([]); }}
          onShared={() => setToast({ message: 'Asignaciones actualizadas.', type: 'success' })}
          currentCollaborators={shareContactCollaborators}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default ClientContactsList;
