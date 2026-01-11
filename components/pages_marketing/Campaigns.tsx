import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingCampaign } from '../../types';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../ConfirmModal';

const StatusBadge = ({ status }: { status: string }) => {
  const normalize = (s?: string): string => (s === 'PAUSE' ? 'PAUSED' : (s || 'DRAFT'));
  const st = normalize(status || 'DRAFT');
  const styles: {[key: string]: string} = {
    SENT: 'bg-green-100 text-green-700 border-green-200',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
    SENDING: 'bg-blue-100 text-blue-700 border-blue-200',
    PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
    PAUSED: 'bg-amber-100 text-amber-700 border-amber-200',
    ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
    FAILED: 'bg-red-100 text-red-600 border-red-200',
  };
  const labels: {[key: string]: string} = {
    SENT: 'Enviada',
    COMPLETED: 'Finalizada',
    DRAFT: 'Borrador',
    SCHEDULED: 'Programada',
    SENDING: 'Enviando',
    PROCESSING: 'Procesando',
    PAUSED: 'Pausada',
    ARCHIVED: 'Archivada',
    FAILED: 'Fallida',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[st] || styles.DRAFT}`}>
      {labels[st] || st}
    </span>
  );
};

const Campaigns: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [campaignToLaunch, setCampaignToLaunch] = useState<MarketingCampaign | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Cargar campañas desde la API
  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      setIsLoading(true);
      const data = await marketingApi.getCampaigns(user.id_tenant, user.id_user);
      setCampaigns(data);
    } catch (error) {
      console.error('Error al cargar campañas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---

  const handleDuplicate = (e: React.MouseEvent, campaign: MarketingCampaign) => {
    e.stopPropagation();
    (async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      try {
        const duplicated = await marketingApi.duplicateCampaign(
          campaign.id_campaign,
          user.id_tenant,
          user.id_user
        );
        // Prepend duplicated campaign in list and navigate to edit
        setCampaigns(prev => [duplicated, ...prev]);
        if (duplicated?.id_campaign) {
          navigate(`/app/marketing/campaigns/edit/${duplicated.id_campaign}`);
        } else {
          // Fallback: refresh list
          await loadCampaigns();
        }
      } catch (err) {
        console.error('Error duplicando campaña:', err);
      }
    })();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCampaignToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!campaignToDelete || !user?.id_tenant || !user?.id_user) return;
    try {
      await marketingApi.manageCampaign('delete', {
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        id_campaign: campaignToDelete,
      });
      setCampaigns(prev => prev.filter(c => c.id_campaign !== campaignToDelete));
    } catch (err) {
      console.error('Error eliminando campaña:', err);
    } finally {
      setShowDeleteConfirm(false);
      setCampaignToDelete(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/app/marketing/campaigns/edit/${id}`);
  };

  const handleLaunch = (e: React.MouseEvent, campaign: MarketingCampaign) => {
    e.stopPropagation();
    setCampaignToLaunch(campaign);
    setShowLaunchConfirm(true);
  };

  const confirmLaunch = async () => {
    if (!campaignToLaunch || !user?.id_user) return;
    try {
      setIsLaunching(true);
      await marketingApi.launchCampaign(campaignToLaunch.id_campaign, user.id_user);
      // Refrescar para reflejar el estado real desde backend
      await loadCampaigns();
    } catch (err) {
      console.error('Error lanzando campaña:', err);
    } finally {
      setIsLaunching(false);
      setShowLaunchConfirm(false);
      setCampaignToLaunch(null);
    }
  };

  // Helpers y acciones de pausa/reanudar
  const toNumber = (v: any): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  const normalizeStatus = (s?: string) => (s === 'PAUSE' ? 'PAUSED' : s || 'DRAFT');

  const calcProgress = (c: MarketingCampaign): number => {
    const p = toNumber(c.progress_percentage);
    if (p > 0) return Math.max(0, Math.min(100, p));
    const total = toNumber(c.total_target) || toNumber(c.recipient_count);
    const success = toNumber(c.successful_sents) || toNumber(c.sent_count);
    const failed = toNumber(c.failed_sents) || toNumber(c.failed_count);
    const processed = success + failed;
    if (total > 0) return Math.round((processed / total) * 100);
    return 0;
  };

  const handlePause = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user?.id_user) return;
    await marketingApi.campaignAction(id, user.id_user, 'pause');
    await loadCampaigns();
  };

  const handleResume = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user?.id_user) return;
    await marketingApi.campaignAction(id, user.id_user, 'send');
    await loadCampaigns();
  };

  // --- Filtering ---

  const filteredCampaigns = campaigns.filter(c => {
    if (filterStatus === 'ALL') return true;
    return c.status === filterStatus;
  });

  return (
    <div className="space-y-6" onClick={() => setIsFilterOpen(false)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campañas</h2>
          <p className="text-slate-500">Gestiona y monitorea tus envíos de correo masivo.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
              className={`px-4 py-2 bg-white border text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors flex items-center gap-2 ${isFilterOpen ? 'border-brand-500 text-brand-600' : 'border-slate-300'}`}
            >
              <i className="fa-solid fa-filter"></i> 
              {filterStatus === 'ALL' ? 'Todos los estados' : filterStatus}
              <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
            </button>
            
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 animate-fadeIn">
                {['ALL', 'DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'SENT', 'COMPLETED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${filterStatus === status ? 'text-brand-600 font-semibold bg-brand-50' : 'text-slate-700'}`}
                  >
                    {status === 'ALL' ? 'Todos' : <StatusBadge status={status} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link 
            to="/app/marketing/campaigns/new"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> Crear Campaña
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progreso</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Programación/Envío</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stats</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creado por</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Cargando campañas...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron campañas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr 
                    key={campaign.id_campaign} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/app/marketing/campaigns/${campaign.id_campaign}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 hover:text-brand-600 transition-colors">{campaign.name}</span>
                        <span className="text-xs text-slate-500">{campaign.subject}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {(() => {
                        const status = normalizeStatus(campaign.status);
                        const total = toNumber(campaign.total_target) || toNumber(campaign.recipient_count);
                        const success = toNumber(campaign.successful_sents) || toNumber(campaign.sent_count);
                        const failed = toNumber(campaign.failed_sents) || toNumber(campaign.failed_count);
                        const remaining = toNumber(campaign.remaining_count);
                        const progress = calcProgress(campaign);

                        if (status === 'DRAFT') {
                          return (
                            <div>
                              <p className="text-sm text-slate-600">Audiencia estimada: <span className="font-semibold">{total}</span> personas</p>
                              <div className="h-2 bg-slate-100 rounded mt-2 overflow-hidden">
                                <div className="h-2 bg-slate-300" style={{ width: '0%' }}></div>
                              </div>
                            </div>
                          );
                        }

                        if (status === 'SENDING' || status === 'PROCESSING') {
                          return (
                            <div>
                              <p className="text-sm text-slate-600">Enviando... <span className="font-semibold">{progress}%</span></p>
                              <div className="h-2 bg-slate-100 rounded mt-2 overflow-hidden" title={`${progress}%`}>
                                <div className="h-2 bg-blue-500 transition-all" style={{ width: `${progress}%` }}></div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{success} enviados, {failed} fallidos, {remaining} restantes</p>
                            </div>
                          );
                        }

                        if (status === 'PAUSED') {
                          return (
                            <div>
                              <p className="text-sm text-amber-700">Pausada al <span className="font-semibold">{progress}%</span></p>
                              <div className="h-2 bg-slate-100 rounded mt-2 overflow-hidden">
                                <div className="h-2 bg-amber-500" style={{ width: `${progress}%` }}></div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{remaining} correos detenidos en cola</p>
                            </div>
                          );
                        }

                        if (status === 'COMPLETED' || status === 'SENT') {
                          return (
                            <div>
                              <p className="text-sm text-green-700">Finalizada (<span className="font-semibold">100%</span>)</p>
                              <div className="h-2 bg-slate-100 rounded mt-2 overflow-hidden">
                                <div className="h-2 bg-green-500" style={{ width: `100%` }}></div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">Total: {total}. Éxito: {success}. Rebote: {failed}.</p>
                            </div>
                          );
                        }

                        if (status === 'FAILED') {
                          return (
                            <div>
                              <p className="text-sm text-red-600">Fallida</p>
                              <p className="text-xs text-slate-500 mt-1">Enviados: {success}. Fallidos: {failed}.</p>
                            </div>
                          );
                        }

                        return <span className="text-xs text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {campaign.sent_at 
                        ? (
                            new Date(campaign.sent_at).toLocaleDateString() + ' ' + 
                            new Date(campaign.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                          )
                        : campaign.scheduled_at_local
                          ? (
                              <span className="text-amber-600">
                                <i className="fa-regular fa-clock mr-1"></i>
                                {campaign.scheduled_at_local as string}
                              </span>
                            )
                          : <span className="text-xs text-slate-400">Inmediato</span>
                      }
                      {campaign.target_lists_display && (
                        <div className="text-[11px] text-slate-400 mt-1">Audiencias: {campaign.target_lists_display}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const sent = toNumber(campaign.sent_count || campaign.recipient_count || campaign.total_target);
                        const opened = toNumber(campaign.unique_opens || campaign.open_count);
                        const clicked = toNumber(campaign.unique_clicks || campaign.click_count);
                        const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
                        const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';
                        return (
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1" title="Aperturas únicas">
                              <i className="fa-regular fa-envelope-open text-slate-400"></i>
                              <span className="font-medium text-slate-700">{openRate}%</span>
                            </div>
                            <div className="flex items-center gap-1" title="Clicks únicos">
                              <i className="fa-solid fa-mouse-pointer text-slate-400"></i>
                              <span className="font-medium text-slate-700">{clickRate}%</span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        {campaign.avatar_url ? (
                          <img src={campaign.avatar_url} alt={campaign.created_by_name || 'Usuario'} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">
                            {(campaign.created_by_name || 'U').slice(0,1)}
                          </div>
                        )}
                        <span>{campaign.created_by === user?.id_user ? 'Tú' : (campaign.created_by_name || 'Compartido')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => handleEdit(e, campaign.id_campaign)}
                           className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" 
                           title="Editar"
                         >
                           <i className="fa-regular fa-pen-to-square"></i>
                         </button>
                         {normalizeStatus(campaign.status) === 'DRAFT' && (
                           <button 
                             onClick={(e) => handleLaunch(e, campaign)}
                             className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                             title="Lanzar ahora"
                           >
                             <i className="fa-solid fa-rocket"></i>
                           </button>
                         )}
                         {['SENDING','PROCESSING'].includes(normalizeStatus(campaign.status)) && (
                           <button 
                             onClick={(e) => handlePause(e, campaign.id_campaign)}
                             className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors" 
                             title="Pausar"
                           >
                             <i className="fa-solid fa-pause"></i>
                           </button>
                         )}
                         {normalizeStatus(campaign.status) === 'PAUSED' && (
                           <button 
                             onClick={(e) => handleResume(e, campaign.id_campaign)}
                             className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors" 
                             title="Reanudar"
                           >
                             <i className="fa-solid fa-play"></i>
                           </button>
                         )}
                         <button 
                           onClick={(e) => handleDuplicate(e, campaign)}
                           className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                           title="Duplicar"
                         >
                           <i className="fa-regular fa-copy"></i>
                         </button>
                         <button 
                           onClick={(e) => handleDelete(e, campaign.id_campaign)}
                           className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                           title="Eliminar"
                         >
                           <i className="fa-regular fa-trash-can"></i>
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
           <span className="text-xs text-slate-500">Mostrando {filteredCampaigns.length} campañas</span>
           <div className="flex gap-1">
             <button className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-400 text-xs disabled:opacity-50" disabled>Prev</button>
             <button className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-600 text-xs disabled:opacity-50" disabled>Next</button>
           </div>
        </div>
        {/* Confirmación de eliminación */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title="Eliminar campaña"
          message="Esta acción eliminará la campaña de forma permanente. ¿Deseas continuar?"
          confirmText="Eliminar"
          cancelText="Cancelar"
          isDestructive
        />
        <ConfirmModal
          isOpen={showLaunchConfirm}
          onClose={() => setShowLaunchConfirm(false)}
          onConfirm={confirmLaunch}
          title="Lanzar campaña"
          message="Esta campaña se enviará inmediatamente a las listas seleccionadas. ¿Deseas continuar?"
          confirmText={isLaunching ? 'Lanzando...' : 'Enviar ahora'}
          cancelText="Cancelar"
        />
      </div>
    </div>
  );
};

export default Campaigns;

// Modal de confirmación
// Nota: colocado al final del componente (retorno JSX)