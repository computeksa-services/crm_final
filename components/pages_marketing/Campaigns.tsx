import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MarketingCampaign } from '../../types';
import { marketingApi } from '../../services/marketingApi';
import Toast from '../Toast';
import ConfirmModal from '../ConfirmModal';
import { BrandSpinner } from '../AppLoaders';
import { useEmailSendPolicy } from '../../src/hooks/useEmailSendPolicy';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';

// --- HELPER: Status Badge ---
const StatusBadge = ({ status }: { status: string }) => {
  const styles: {[key: string]: string} = {
    SENT: 'bg-green-100 text-green-700 border-green-200',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
    SENDING: 'bg-blue-100 text-blue-700 border-blue-200',
    PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
    PAUSED: 'bg-orange-100 text-orange-700 border-orange-200',
    FAILED: 'bg-red-100 text-red-600 border-red-200',
  };
  
  const labels: {[key: string]: string} = {
    SENT: 'Enviada', COMPLETED: 'Finalizada', DRAFT: 'Borrador',
    SCHEDULED: 'Programada', SENDING: 'Enviando', PROCESSING: 'Procesando',
    PAUSED: 'Pausada', FAILED: 'Fallida',
  };

  const st = status || 'DRAFT';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${styles[st] || styles.DRAFT}`}>
      {labels[st] || st}
    </span>
  );
};

// --- HELPER: Formatear Fecha String (Sin cambiar zona horaria) ---
const formatDateString = (dateStr?: string) => {
  if (!dateStr) return '-';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr.substring(0, 16);

  return (
    <div className="flex flex-col">
       <span className="text-xs font-semibold text-slate-700">
         {dateObj.toLocaleDateString()}
       </span>
       <span className="text-[10px] text-slate-400">
         {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
       </span>
    </div>
  );
};

// --- MAIN COMPONENT ---
const Campaigns: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { policy: emailPolicy } = useEmailSendPolicy(user);
  
  // --- STATE ---
  const [data, setData] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Table State
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  
  // UI State
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal Confirm State
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    confirmText: 'Confirmar',
    isDestructive: false,
    onConfirm: async () => {}, 
  });

  const canSendCampaign = emailPolicy.status === 'corporate' || emailPolicy.status === 'personal';
  const normalizeId = (value?: string | number | null) => String(value ?? '').trim().toLowerCase();
  const isCampaignCreator = (campaign: MarketingCampaign) => {
    const userId = normalizeId(user?.id_user);
    const creatorId = normalizeId(campaign.created_by);
    if (userId && creatorId) return userId === creatorId;
    const userName = normalizeId(user?.name_user);
    const creatorName = normalizeId(campaign.created_by_name);
    if (userName && creatorName) return userName === creatorName;
    return false;
  };

  // --- DATA LOADING ---
  useEffect(() => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const load = async () => {
      try {
        const result = await marketingApi.getCampaigns(user.id_tenant, user.id_user);
        setData(result);
      } catch (error) {
        console.error(error);
        setToast({ message: 'Error al cargar campañas', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id_tenant, user?.id_user]);

  const reloadData = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      const result = await marketingApi.getCampaigns(user.id_tenant, user.id_user);
      setData(result);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al cargar campañas', type: 'error' });
    }
  };

  // Click outside to close filters
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- ACTIONS HANDLERS ---

  // Navegar al detalle
  const handleRowClick = (id: string) => {
    navigate(`/app/marketing/campaigns/${id}`);
  };

  const handleEdit = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    navigate(`/app/marketing/campaigns/edit/${row.id_campaign}`);
  };

  const handleDuplicate = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Duplicar Campaña',
      message: `¿Crear una copia de "${row.name}"?`,
      confirmText: 'Duplicar',
      isDestructive: false,
      onConfirm: async () => {
        try {
          if(!user?.id_tenant || !user?.id_user) return;
          // Action: duplicate
          const newCamp = await marketingApi.manageCampaign('duplicate', {
             id_tenant: user.id_tenant,
             id_user: user.id_user,
             id_campaign: row.id_campaign
          }) as MarketingCampaign;
          
          setToast({ message: 'Campaña duplicada correctamente', type: 'success' });
          if(newCamp?.id_campaign) navigate(`/app/marketing/campaigns/edit/${newCamp.id_campaign}`);
          else reloadData();
        } catch (e) {
          setToast({ message: 'Error al duplicar', type: 'error' });
        } finally {
            setConfirmState(prev => ({...prev, isOpen: false}));
        }
      }
    });
  };

  const handleDelete = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Campaña',
      message: `¿Estás seguro de eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          if(!user?.id_tenant || !user?.id_user) return;
          // Action: delete
          await marketingApi.manageCampaign('delete', {
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            id_campaign: row.id_campaign
          });
          setToast({ message: 'Campaña eliminada', type: 'success' });
          setData(prev => prev.filter(c => c.id_campaign !== row.id_campaign));
        } catch (e) {
          setToast({ message: 'Error al eliminar', type: 'error' });
        } finally {
            setConfirmState(prev => ({...prev, isOpen: false}));
        }
      }
    });
  };

  const handleLaunch = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    const isCreator = isCampaignCreator(row);
    if (!isCreator) {
      setToast({ message: 'Solo el creador de la campaña puede lanzar el envio.', type: 'error' });
      return;
    }
    if (!canSendCampaign) {
      setToast({ message: 'Activa permisos de envio en Integraciones o Workspace para lanzar la campaña.', type: 'error' });
      return;
    }
    const senderType = String(row.sender_type || '').toUpperCase() === 'TENANT' ? 'Corporativa' : 'Personal';
    const senderEmail = row.sender_email ? ` (${row.sender_email})` : '';
    setConfirmState({
      isOpen: true,
      title: 'Lanzar Campaña',
      message: `La campaña se enviará inmediatamente desde cuenta ${senderType}${senderEmail}. ¿Confirmar envío?`,
      confirmText: 'Enviar Ahora',
      isDestructive: false,
      onConfirm: async () => {
        try {
            if(!user?.id_tenant || !user?.id_user) return;
            // IMPORTANTE: Aquí se usa campaignAction que va al endpoint /send
            // NO se usa manageCampaign (endpoint /manage)
            await marketingApi.campaignAction({
              id_campaign: row.id_campaign,
              id_tenant: user.id_tenant,
              id_user: user.id_user,
              action: 'send',
            });
            setToast({ message: 'Campaña iniciada', type: 'success' });
            reloadData();
        } catch (e) {
            setToast({ message: 'Error al iniciar', type: 'error' });
        } finally {
            setConfirmState(prev => ({...prev, isOpen: false}));
        }
      }
    });
  };

  const handlePause = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Pausar Envío',
      message: 'Se detendrá el envío. Podrás reanudarlo después.',
      confirmText: 'Pausar',
      isDestructive: false,
      onConfirm: async () => {
        try {
            if(!user?.id_tenant || !user?.id_user) return;
            // Action: pause
            await marketingApi.campaignAction({
              id_campaign: row.id_campaign,
              id_tenant: user.id_tenant,
              id_user: user.id_user,
              action: 'pause',
            });
            setToast({ message: 'Campaña pausada', type: 'success' });
            reloadData();
        } catch (e) {
            setToast({ message: 'Error al pausar', type: 'error' });
        } finally {
            setConfirmState(prev => ({...prev, isOpen: false}));
        }
      }
    });
  };

  const handleResume = (e: React.MouseEvent, row: MarketingCampaign) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Reanudar Envío',
      message: `¿Continuar con el envío de correos pendientes?`,
      confirmText: 'Reanudar',
      isDestructive: false,
      onConfirm: async () => {
        try {
            if(!user?.id_tenant || !user?.id_user) return;
            // Action: send (vuelve a activar el estado SENDING)
            await marketingApi.campaignAction({
              id_campaign: row.id_campaign,
              id_tenant: user.id_tenant,
              id_user: user.id_user,
              action: 'send',
            });
            setToast({ message: 'Campaña reanudada', type: 'success' });
            reloadData();
        } catch (e) {
            setToast({ message: 'Error al reanudar', type: 'error' });
        } finally {
            setConfirmState(prev => ({...prev, isOpen: false}));
        }
      }
    });
  };

  // --- TABLE HELPERS ---

  const toNumber = (v: any) => {
    if(!v) return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  const getFacetedUniqueValues = (columnId: string) => {
    const counts = new Map<string, number>();
    data.forEach(row => {
      const val = (row as any)[columnId] || 'DRAFT';
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

  // --- COLUMNS DEFINITION ---

  const columns = useMemo<ColumnDef<MarketingCampaign>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Campaña',
      size: 280,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">
            {row.original.name}
          </span>
          <span className="text-xs text-slate-400 truncate max-w-[240px]">
            {row.original.subject || '(Sin asunto)'}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      size: 110,
      enableColumnFilter: true,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || 'DRAFT')
    },
    {
      accessorKey: 'sender_type',
      header: 'Remitente',
      size: 180,
      cell: ({ row, getValue }) => {
        const senderType = String(getValue() || '').toUpperCase();
        const isTenant = senderType === 'TENANT';
        const senderEmail = row.original.sender_email;
        return (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${isTenant ? 'text-indigo-600 border-indigo-100 bg-indigo-50' : 'text-emerald-600 border-emerald-100 bg-emerald-50'}`}>
              <i className={`fa-solid ${isTenant ? 'fa-building' : 'fa-user'} text-[10px]`}></i>
            </span>
            <span className="truncate max-w-[150px]">
              {senderEmail || (isTenant ? 'Cuenta corporativa' : 'Cuenta personal')}
            </span>
          </div>
        );
      }
    },
    {
      id: 'progress',
      header: 'Progreso',
      size: 160,
      cell: ({ row }) => {
        const c = row.original;
        const status = c.status || 'DRAFT';
        const total = toNumber(c.total_target) || toNumber(c.recipient_count);
        const success = toNumber(c.successful_sents) || toNumber(c.sent_count);
        const percentage = toNumber(c.progress_percentage);
        
        let barColor = 'bg-blue-500';
        if(status === 'PAUSED') barColor = 'bg-amber-500';
        if(status === 'COMPLETED' || status === 'SENT') barColor = 'bg-green-500';
        
        // Cambio "Est." por "Total:"
        if(status === 'DRAFT') return <span className="text-xs text-slate-400 font-medium">Total: {total}</span>;

        return (
          <div className="w-full">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold">
               <span>{percentage}%</span>
               <span>{success}/{total}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
          </div>
        )
      }
    },
    {
        id: 'created_at',
        header: 'Programación',
        size: 140,
        accessorFn: (row) => row.sent_at || row.scheduled_at_local || row.scheduled_at || row.created_at,
        cell: ({ row }) => {
            const c = row.original;
            // Prioridad: Fecha Enviado > Fecha Programada Local > Fecha Programada UTC
            if (c.sent_at) {
                return formatDateString(c.sent_at);
            }
            if (c.scheduled_at_local) {
                return (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-wide mb-0.5">
                            <i className="fa-regular fa-clock mr-1"></i>Prog.
                        </span>
                        {formatDateString(c.scheduled_at_local)}
                    </div>
                )
            }
             if (c.scheduled_at) {
                return (
                    <div className="flex flex-col">
                         <span className="text-[9px] font-black text-amber-500 uppercase tracking-wide mb-0.5">
                            <i className="fa-regular fa-clock mr-1"></i>Prog.
                         </span>
                         {formatDateString(c.scheduled_at)}
                    </div>
                )
            }
            return <span className="text-xs text-slate-400 font-medium">-</span>;
        }
    },
    {
        // Nueva Columna "Creado por"
        accessorKey: 'created_by_name',
        header: 'Creado',
        size: 115,
        cell: ({ row }) => {
            const name = row.original.created_by_name || 'Desconocido';
            const avatar = row.original.avatar_url;
            return (
                <div className="flex items-center justify-center" title={name}>
                    {avatar ? (
                        <img src={avatar} alt={name} className="w-6 h-6 rounded-full border border-slate-200" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 border border-slate-200 font-bold">
                            {name.charAt(0)}
                        </div>
                    )}
                </div>
            )
        }
    },
    {
        id: 'stats',
        header: 'Métricas',
        size: 120,
        cell: ({ row }) => {
            const c = row.original;
            const sent = toNumber(c.total_target) || toNumber(c.recipient_count);
            const opens = toNumber(c.unique_opens || c.open_count);
            const clicks = toNumber(c.unique_clicks || c.click_count);
            
            const openRate = sent > 0 ? ((opens/sent)*100).toFixed(0) : 0;
            const clickRate = sent > 0 ? ((clicks/sent)*100).toFixed(0) : 0;

            if(['DRAFT','SCHEDULED'].includes(c.status || '')) return <span className="text-xs text-slate-300">-</span>;

            return (
                <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Opens</span>
                        <span className="text-xs font-bold text-slate-700">{openRate}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Clicks</span>
                        <span className="text-xs font-bold text-slate-700">{clickRate}%</span>
                    </div>
                </div>
            )
        }
    },
    {
      id: 'actions',
      header: '',
      size: 90, // Reducido el tamaño
      enableColumnFilter: false,
      cell: ({ row }) => {
        const c = row.original;
        const st = c.status || 'DRAFT';
        const isCreator = isCampaignCreator(c);
        const canLaunch = isCreator && canSendCampaign;
        
        return (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            
            {/* Lanzar (Solo draft y solo el creador) */}
            {st === 'DRAFT' && (
                <button 
                  onClick={(e) => canLaunch && handleLaunch(e, c)} 
                  disabled={!canLaunch}
                  className={`w-6 h-6 flex items-center justify-center text-slate-400 rounded transition-colors ${
                    canLaunch 
                      ? 'hover:text-green-600 hover:bg-green-50 cursor-pointer' 
                      : 'opacity-40 cursor-not-allowed'
                  }`} 
                  title={!isCreator ? 'Solo el creador puede lanzar' : !canSendCampaign ? 'Activa permisos de envio en Integraciones o Workspace' : 'Lanzar'}
                >
                    <i className="fa-solid fa-rocket text-[10px]"></i>
                </button>
            )}

            {/* Pausar (Solo sending y solo el creador) */}
            {['SENDING','PROCESSING'].includes(st) && (
                <button 
                  onClick={(e) => isCreator && handlePause(e, c)} 
                  disabled={!isCreator}
                  className={`w-6 h-6 flex items-center justify-center text-slate-400 rounded transition-colors ${
                    isCreator 
                      ? 'hover:text-amber-600 hover:bg-amber-50 cursor-pointer' 
                      : 'opacity-40 cursor-not-allowed'
                  }`} 
                  title={isCreator ? 'Pausar' : 'Solo el creador puede pausar'}
                >
                    <i className="fa-solid fa-pause text-[10px]"></i>
                </button>
            )}

            {/* Reanudar (Solo paused y solo el creador) */}
            {st === 'PAUSED' && (
                <button 
                  onClick={(e) => isCreator && handleResume(e, c)} 
                  disabled={!isCreator}
                  className={`w-6 h-6 flex items-center justify-center text-slate-400 rounded transition-colors ${
                    isCreator 
                      ? 'hover:text-green-600 hover:bg-green-50 cursor-pointer' 
                      : 'opacity-40 cursor-not-allowed'
                  }`} 
                  title={isCreator ? 'Reanudar' : 'Solo el creador puede reanudar'}
                >
                    <i className="fa-solid fa-play text-[10px]"></i>
                </button>
            )}

            {/* Editar (todos pueden editar) */}
            <button 
              onClick={(e) => handleEdit(e, c)} 
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded transition-colors cursor-pointer" 
              title="Editar"
            >
               <i className="fa-solid fa-pen text-[10px]"></i>
            </button>

            {/* Duplicar (siempre visible) */}
            <button onClick={(e) => handleDuplicate(e, c)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Duplicar">
                <i className="fa-solid fa-copy text-[10px]"></i>
            </button>

            {/* Eliminar */}
            {['DRAFT','COMPLETED','FAILED','ARCHIVED'].includes(st) && (
                <button onClick={(e) => handleDelete(e, c)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                <i className="fa-solid fa-trash text-[10px]"></i>
                </button>
            )}
          </div>
        );
      }
    }
  ], []);

  // --- TABLE INSTANCE ---

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // --- RENDER ---

  return (
    // FIX: Usamos h-full en el contenedor para asegurar que ocupe todo el espacio disponible
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
      
      {/* TOOLBAR */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
         <div className="relative w-full sm:w-64">
             <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
             <input 
                 value={globalFilter} 
                 onChange={e => setGlobalFilter(e.target.value)}
                 placeholder="Buscar campañas..." 
                 className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm transition-all"
             />
         </div>
         <button 
            onClick={() => navigate('/app/marketing/campaigns/new')}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-sm border border-brand-700 transition-all flex items-center gap-2"
         >
             <i className="fa-solid fa-plus"></i> Nueva Campaña
         </button>
      </div>

      {/* TABLE CONTAINER - flex-1 y overflow-auto para scroll interno */}
      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40 shadow-sm">
             {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => {
                        const isFiltered = columnFilters.some(f => f.id === header.column.id);
                        return (
                            <th key={header.id} style={{ width: header.getSize() }} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left relative group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </span>
                                        {{
                                            asc: <i className="fa-solid fa-sort-up text-brand-600"></i>,
                                            desc: <i className="fa-solid fa-sort-down text-brand-600"></i>,
                                        }[header.column.getIsSorted() as string] ?? null}
                                    </div>
                                    {header.column.columnDef.enableColumnFilter !== false && header.column.id !== 'actions' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }}
                                            className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isFiltered ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}
                                        >
                                            <i className="fa-solid fa-filter text-[10px]"></i>
                                        </button>
                                    )}
                                </div>
                                {/* Dropdown Filter */}
                                {activeFilterMenu === header.column.id && (
                                    <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-2 animate-fadeIn">
                                        <div className="max-h-60 overflow-y-auto px-1">
                                            {getFacetedUniqueValues(header.column.id).map(([val, count]) => {
                                                const active = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                                                const checked = active.includes(val);
                                                return (
                                                    <label key={val} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-slate-300'}`}>
                                                                {checked && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700 uppercase">{val}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400">({count})</span>
                                                        <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleFilterValue(header.column.id, val)} />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </th>
                        )
                    })}
                </tr>
             ))}
          </thead>
          <tbody className="bg-white">
             {loading ? (
                 <tr>
                    <td colSpan={columns.length} className="py-24 text-center">
                  <BrandSpinner size="lg" className="mb-3" />
                        <p className="text-slate-400 text-sm font-medium">Cargando campañas...</p>
                    </td>
                 </tr>
             ) : table.getRowModel().rows.length === 0 ? (
                 <tr>
                    <td colSpan={columns.length} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <i className="fa-regular fa-paper-plane text-4xl text-slate-400"></i>
                            <p className="text-slate-500 font-bold">No hay campañas aún</p>
                            <button 
                                onClick={() => navigate('/app/marketing/campaigns/new')}
                                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <i className="fa-solid fa-plus"></i>
                                Crear campaña
                            </button>
                        </div>
                    </td>
                 </tr>
             ) : (
                table.getRowModel().rows.map(row => (
                    <tr 
                        key={row.id} 
                        // FIX: Navegar a vista detalle
                        onClick={() => handleRowClick(row.original.id_campaign)}
                        className="hover:bg-blue-50/30 cursor-pointer group border-b border-slate-100 transition-colors"
                    >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-4 py-3 border-r border-slate-50 text-sm text-slate-600">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))
             )}
          </tbody>
        </table>
      </div>

      {/* FOOTER - Solo mostrar si hay datos */}
      {data.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
           <div className="flex items-center gap-4">
              <span>{data.length} REGISTROS</span>
              {columnFilters.length > 0 && (
                  <button onClick={() => setColumnFilters([])} className="text-red-500 hover:text-red-700 font-black flex items-center gap-1">
                      <i className="fa-solid fa-filter-circle-xmark"></i> Limpiar
                  </button>
              )}
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 hover:text-brand-600 disabled:opacity-20"><i className="fa-solid fa-chevron-left"></i></button>
              <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black tracking-normal">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 hover:text-brand-600 disabled:opacity-20"><i className="fa-solid fa-chevron-right"></i></button>
           </div>
        </div>
      )}

      {/* MODALS */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen} 
        title={confirmState.title} 
        message={confirmState.message} 
        confirmText={confirmState.confirmText}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))} 
      />
    </div>
  );
};

export default Campaigns;
