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

// Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  const config: {[key: string]: { bg: string; text: string; label: string; icon?: string }} = {
    SENT: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', label: 'Enviada', icon: 'fa-check' },
    COMPLETED: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', label: 'Finalizada', icon: 'fa-check-double' },
    DRAFT: { bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-600 dark:text-gray-400', label: 'Borrador', icon: 'fa-file' },
    SCHEDULED: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', label: 'Programada', icon: 'fa-clock' },
    SENDING: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', label: 'Enviando', icon: 'fa-paper-plane' },
    PROCESSING: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', label: 'Procesando', icon: 'fa-spinner' },
    PAUSED: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-400', label: 'Pausada', icon: 'fa-pause' },
    FAILED: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400', label: 'Fallida', icon: 'fa-exclamation-triangle' },
  };

  const st = status || 'DRAFT';
  const { bg, text, label, icon } = config[st] || config.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${bg} ${text}`}>
      {icon && <i className={`fa-solid ${icon} text-[10px]`}></i>}
      {label}
    </span>
  );
};

const formatDateString = (dateStr?: string) => {
  if (!dateStr) return '-';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr.substring(0, 16);

  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
        {dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
      </span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">
        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

// Componente de Menú de Acciones
const ActionsMenu = ({ 
  campaign, 
  isCreator, 
  canLaunch,
  onLaunch,
  onPause,
  onResume,
  onEdit,
  onDuplicate,
  onDelete
}: {
  campaign: MarketingCampaign;
  isCreator: boolean;
  canLaunch: boolean;
  onLaunch: () => void;
  onPause: () => void;
  onResume: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const st = campaign.status || 'DRAFT';

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
      >
        <i className="fa-solid fa-ellipsis-vertical"></i>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1"
        >
          {/* Lanzar */}
          {st === 'DRAFT' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canLaunch) {
                  onLaunch();
                  setOpen(false);
                }
              }}
              disabled={!canLaunch}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                canLaunch
                  ? 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 cursor-pointer'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={!isCreator ? 'Solo el creador puede lanzar' : !canLaunch ? 'Activa permisos de envío' : ''}
            >
              <i className="fa-solid fa-rocket w-4"></i>
              Lanzar
            </button>
          )}

          {/* Pausar */}
          {['SENDING', 'PROCESSING'].includes(st) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isCreator) {
                  onPause();
                  setOpen(false);
                }
              }}
              disabled={!isCreator}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                isCreator
                  ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={!isCreator ? 'Solo el creador puede pausar' : ''}
            >
              <i className="fa-solid fa-pause w-4"></i>
              Pausar
            </button>
          )}

          {/* Reanudar */}
          {st === 'PAUSED' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isCreator) {
                  onResume();
                  setOpen(false);
                }
              }}
              disabled={!isCreator}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                isCreator
                  ? 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 cursor-pointer'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={!isCreator ? 'Solo el creador puede reanudar' : ''}
            >
              <i className="fa-solid fa-play w-4"></i>
              Reanudar
            </button>
          )}

          {/* Editar */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <i className="fa-solid fa-pen w-4"></i>
            Editar
          </button>

          {/* Duplicar */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <i className="fa-solid fa-copy w-4"></i>
            Duplicar
          </button>

          {/* Eliminar */}
          {['DRAFT', 'COMPLETED', 'FAILED', 'ARCHIVED'].includes(st) && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-slate-700"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 transition-colors"
              >
                <i className="fa-solid fa-trash w-4"></i>
                Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Campaigns: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { policy: emailPolicy } = useEmailSendPolicy(user);
  
  const [data, setData] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRowClick = (id: string) => {
    navigate(`/app/marketing/campaigns/${id}`);
  };

  const handleEdit = (row: MarketingCampaign) => {
    navigate(`/app/marketing/campaigns/edit/${row.id_campaign}`);
  };

  const handleDuplicate = (row: MarketingCampaign) => {
    setConfirmState({
      isOpen: true,
      title: 'Duplicar Campaña',
      message: `¿Crear una copia de "${row.name}"?`,
      confirmText: 'Duplicar',
      isDestructive: false,
      onConfirm: async () => {
        try {
          if(!user?.id_tenant || !user?.id_user) return;
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

  const handleDelete = (row: MarketingCampaign) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Campaña',
      message: `¿Estás seguro de eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          if(!user?.id_tenant || !user?.id_user) return;
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

  const handleLaunch = (row: MarketingCampaign) => {
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

  const handlePause = (row: MarketingCampaign) => {
    setConfirmState({
      isOpen: true,
      title: 'Pausar Envío',
      message: 'Se detendrá el envío. Podrás reanudarlo después.',
      confirmText: 'Pausar',
      isDestructive: false,
      onConfirm: async () => {
        try {
            if(!user?.id_tenant || !user?.id_user) return;
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

  const handleResume = (row: MarketingCampaign) => {
    setConfirmState({
      isOpen: true,
      title: 'Reanudar Envío',
      message: `¿Continuar con el envío de correos pendientes?`,
      confirmText: 'Reanudar',
      isDestructive: false,
      onConfirm: async () => {
        try {
            if(!user?.id_tenant || !user?.id_user) return;
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

  const columns = useMemo<ColumnDef<MarketingCampaign>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Campaña',
      size: 320,
      cell: ({ row }) => {
        const c = row.original;
        const isCreator = isCampaignCreator(c);
        const canLaunch = isCreator && canSendCampaign;

        return (
          <div className="flex items-start gap-2 min-w-0">
            <div className="shrink-0">
              <ActionsMenu
                campaign={c}
                isCreator={isCreator}
                canLaunch={canLaunch}
                onLaunch={() => handleLaunch(c)}
                onPause={() => handlePause(c)}
                onResume={() => handleResume(c)}
                onEdit={() => handleEdit(c)}
                onDuplicate={() => handleDuplicate(c)}
                onDelete={() => handleDelete(c)}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {c.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {c.subject || '(Sin asunto)'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      size: 100,
      enableColumnFilter: true,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      filterFn: (row, id, filterValue: string[]) => 
        filterValue.length === 0 || filterValue.includes(row.getValue(id) || 'DRAFT')
    },
    {
      accessorKey: 'sender_type',
      header: 'Remitente',
      size: 120,
      cell: ({ row, getValue }) => {
        const senderType = String(getValue() || '').toUpperCase();
        const isTenant = senderType === 'TENANT';
        const senderEmail = row.original.sender_email;
        return (
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isTenant 
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' 
                : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
            }`}>
              <i className={`fa-solid ${isTenant ? 'fa-building' : 'fa-user'} text-xs`}></i>
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[140px]" title={senderEmail}>
              {senderEmail || (isTenant ? 'Corporativa' : 'Personal')}
            </span>
          </div>
        );
      }
    },
    {
      id: 'progress',
      header: 'Progreso',
      size: 110,
      cell: ({ row }) => {
        const c = row.original;
        const status = c.status || 'DRAFT';
        const total = toNumber(c.total_target) || toNumber(c.recipient_count);
        const success = toNumber(c.successful_sents) || toNumber(c.sent_count);
        const percentage = toNumber(c.progress_percentage);
        
        let barColor = 'bg-blue-500';
        if(status === 'PAUSED') barColor = 'bg-amber-500';
        if(status === 'COMPLETED' || status === 'SENT') barColor = 'bg-green-500';
        
        if(status === 'DRAFT') return (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {total} destinatarios
          </span>
        );

        return (
          <div className="w-full">
            <div className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">
              <span>{percentage}%</span>
              <span>{success}/{total}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${barColor} transition-all duration-500`} 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        )
      }
    },
    {
        id: 'created_at',
        header: 'Fecha',
        size: 60,
        accessorFn: (row) => row.sent_at || row.scheduled_at_local || row.scheduled_at || row.created_at,
        cell: ({ row }) => {
            const c = row.original;
            if (c.sent_at) {
                return formatDateString(c.sent_at);
            }
            if (c.scheduled_at_local || c.scheduled_at) {
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <i className="fa-solid fa-clock text-[9px]"></i>
                            Programada
                        </span>
                        {formatDateString(c.scheduled_at_local || c.scheduled_at)}
                    </div>
                )
            }
            return <span className="text-xs text-gray-400 dark:text-gray-500">-</span>;
        }
    },
    {
        accessorKey: 'created_by_name',
        header: 'Creador',
        size: 10,
        cell: ({ row }) => {
            const name = row.original.created_by_name || 'Desconocido';
            const avatar = row.original.avatar_url;
            return (
                <div className="flex items-center justify-center" title={name}>
                    {avatar ? (
                        <img 
                          src={avatar} 
                          alt={name} 
                          className="w-7 h-7 rounded-full border border-gray-200 dark:border-slate-700" 
                        />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700 font-medium">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            )
        }
    },
    {
        id: 'stats',
        header: 'Métricas',
        size: 90,
        cell: ({ row }) => {
            const c = row.original;
            const sent = toNumber(c.total_target) || toNumber(c.recipient_count);
            const opens = toNumber(c.unique_opens || c.open_count);
            const clicks = toNumber(c.unique_clicks || c.click_count);
            
            const openRate = sent > 0 ? ((opens/sent)*100).toFixed(0) : 0;
            const clickRate = sent > 0 ? ((clicks/sent)*100).toFixed(0) : 0;

            if(['DRAFT','SCHEDULED'].includes(c.status || '')) return (
              <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
            );

            return (
                <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Apertura</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{openRate}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clicks</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{clickRate}%</span>
                    </div>
                </div>
            )
        }
    }
  ], [canSendCampaign]);

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      
      {/* TOOLBAR */}
      <div className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative w-full sm:w-64">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs"></i>
          <input 
            value={globalFilter} 
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Buscar campañas..." 
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-all"
          />
        </div>
        <button 
          onClick={() => navigate('/app/marketing/campaigns/new')}
          className="h-9 px-4 bg-gray-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-slate-600 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-plus text-xs"></i> 
          Nueva Campaña
        </button>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  return (
                    <th 
                      key={header.id} 
                      style={{ width: header.getSize() }} 
                      className="border-b border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-left relative group"
                    >
                      {/* Título de la columna - ocupa todo el ancho con padding para el botón */}
                      <div 
                        className="flex items-center gap-2 cursor-pointer select-none pr-8" 
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {{
                          asc: <i className="fa-solid fa-sort-up text-blue-600 dark:text-blue-400 text-xs"></i>,
                          desc: <i className="fa-solid fa-sort-down text-blue-600 dark:text-blue-400 text-xs"></i>,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      
                      {/* Botón de filtro - posicionado absolute, no ocupa espacio en el flow */}
                      {header.column.columnDef.enableColumnFilter !== false && header.column.id !== 'actions' && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); 
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            isFiltered 
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' 
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <i className="fa-solid fa-filter text-[10px]"></i>
                        </button>
                      )}
                      
                      {/* Dropdown del filtro */}
                      {activeFilterMenu === header.column.id && (
                        <div 
                          ref={filterMenuRef} 
                          className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-200 dark:border-slate-700 z-50 py-2"
                        >
                          <div className="max-h-60 overflow-y-auto px-1">
                            {getFacetedUniqueValues(header.column.id).map(([val, count]) => {
                              const active = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                              const checked = active.includes(val);
                              return (
                                <label 
                                  key={val} 
                                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                      checked 
                                        ? 'bg-gray-900 dark:bg-slate-600 border-gray-900 dark:border-slate-600' 
                                        : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600'
                                    }`}>
                                      {checked && <i className="fa-solid fa-check text-[9px] text-white"></i>}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      {val}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                    ({count})
                                  </span>
                                  <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={checked} 
                                    onChange={() => toggleFilterValue(header.column.id, val)} 
                                  />
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
          <tbody className="bg-white dark:bg-slate-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                  <BrandSpinner size="lg" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Cargando campañas...</p>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                      <i className="fa-solid fa-paper-plane text-2xl text-gray-400 dark:text-gray-500"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sin campañas</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Crea tu primera campaña</p>
                    <button 
                      onClick={() => navigate('/app/marketing/campaigns/new')}
                      className="mt-2 h-9 px-4 bg-gray-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-slate-600 transition-all flex items-center gap-2"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      Crear campaña
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  onClick={() => handleRowClick(row.original.id_campaign)}
                  className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 cursor-pointer group border-b border-gray-100 dark:border-slate-700 transition-colors"
                >
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      style={{ width: cell.column.getSize() }} 
                      className="px-4 py-3 border-r border-gray-50 dark:border-slate-700/50"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      {data.length > 0 && (
        <div className="bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-medium">{data.length} campañas</span>
            {columnFilters.length > 0 && (
              <button 
                onClick={() => setColumnFilters([])} 
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-1"
              >
                <i className="fa-solid fa-filter-circle-xmark"></i> 
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => table.previousPage()} 
              disabled={!table.getCanPreviousPage()} 
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-medium text-gray-900 dark:text-gray-100">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button 
              onClick={() => table.nextPage()} 
              disabled={!table.getCanNextPage()} 
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      )}

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