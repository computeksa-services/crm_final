import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ContactFormModal from '../components/ContactFormModal';
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
  
  // --- ESTADOS DE DATOS ---
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE LA TABLA ---
  const [sorting, setSorting] = useState<SortingState>([{ id: 'first_name', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('contactsList_grouping');
    return saved ? JSON.parse(saved) : [];
  }); 
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // --- ESTADOS DE UI ---
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | null>(null);
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
      const contactsRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);

      const parseResponse = async (res: Response) => {
        if (!res.ok) return [];
        const text = await res.text();
        if (!text) return [];
        const data = JSON.parse(text);
        return Array.isArray(data) ? data.filter(item => item && item.id_contact) : [];
      };

      setContacts(await parseResponse(contactsRes));
    } catch (e) {
      setToast({ message: 'Error al cargar los datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchData();
  }, [fetchData]);

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

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchData();
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
          const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/delete`, {
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
          fetchData();
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
      if (columnId === 'id_client_company') val = getCompanyNameForContact(contact);
      else val = (contact as any)[columnId] || '(Vacío)';
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
  const columns = useMemo<ColumnDef<ClientContact>[]>(() => [
    {
      accessorKey: 'id_client_company',
      header: 'Empresa',
      size: 220,
      enableColumnFilter: true,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) {
          // CAMBIO: Ya no renderizamos un botón clickeable, solo un contenedor visual.
          // La acción de click se maneja en el <tr onClick> de la tabla.
          return (
            <div className="flex items-center gap-3">
              {/* Ícono de flecha que rota (chevron) en lugar del botón más/menos pesado */}
              <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
              
              <span className="font-bold text-slate-700 uppercase tracking-tight">
                {((row.subRows?.[0]?.original as any)?.name_company) || 'SIN EMPRESA'}
              </span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {row.subRows.length}
              </span>
            </div>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100 uppercase">
            {((row.original as any).name_company) || 'SIN EMPRESA'}
          </span>
        );
      },
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(((row.original as any).name_company) || 'SIN EMPRESA')
    },
    {
      accessorKey: 'first_name',
      header: 'Contacto',
      size: 250,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const c = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-[10px] border border-slate-200 shadow-sm">
              {getInitials(c.first_name, c.last_name)}
            </div>
            <span className="font-semibold text-slate-800">{`${c.first_name} ${c.last_name || ''}`}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'position',
      header: 'Cargo',
      size: 180,
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
      
      {/* TOOLBAR RESPONSIVO */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {(loading || contacts.length > 0) && (
          <>
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
          </>
        )}
        
        <button 
          onClick={handleAddNew} 
          className={`order-1 lg:order-3 w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all flex items-center justify-center gap-2 ${(!loading && contacts.length === 0) ? 'mx-auto sm:mx-0' : ''}`}
        >
            <i className="fa-solid fa-plus"></i> Nuevo Contacto
        </button>
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
                          {isFiltered && (
                            <div className="mt-2 pt-2 border-t border-slate-100 px-3">
                              <button 
                                onClick={() => setColumnFilters(prev => prev.filter(f => f.id !== header.column.id))}
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
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                   <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-3"></i>
                   <p className="text-slate-400 text-sm font-medium tracking-wide">Cargando contactos...</p>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                   <div className="flex flex-col items-center gap-3">
                     <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                       <i className="fa-solid fa-user text-2xl text-slate-300"></i>
                     </div>
                     <div>
                       <p className="text-slate-600 font-bold text-sm">No hay contactos registrados</p>
                       <p className="text-slate-400 text-xs mt-1">Crea tu primer contacto para comenzar</p>
                     </div>
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
                    <td key={cell.id} className={`px-4 py-2 border-r border-slate-50 ${isGrouped ? 'py-3' : ''}`}>
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
            <span>{contacts.length} registros</span>
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default ClientContactsList;