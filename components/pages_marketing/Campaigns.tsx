import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingCampaign } from '../../types';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../ConfirmModal';

const StatusBadge = ({ status }: { status: string }) => {
  const styles: {[key: string]: string} = {
    SENT: 'bg-green-100 text-green-700 border-green-200',
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
    SENDING: 'bg-blue-100 text-blue-700 border-blue-200',
    ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  
  const labels: {[key: string]: string} = {
    SENT: 'Enviada',
    DRAFT: 'Borrador',
    SCHEDULED: 'Programada',
    SENDING: 'Enviando',
    ARCHIVED: 'Archivada',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.DRAFT}`}>
      {labels[status] || status}
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
    if (!user?.id_tenant) return;
    
    try {
      setIsLoading(true);
      const data = await marketingApi.getCampaigns(user.id_tenant);
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
    const newCampaign: MarketingCampaign = {
      ...campaign,
      id_campaign: `mcamp_${Date.now()}`,
      name: `${campaign.name} (Copia)`,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      sent_at: undefined,
      scheduled_at: undefined,
      open_count: 0,
      click_count: 0,
      recipient_count: 0
    };
    setCampaigns([newCampaign, ...campaigns]);
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
                {['ALL', 'DRAFT', 'SCHEDULED', 'SENT', 'SENDING'].map((status) => (
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
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Enviado/Programado</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stats (Open/Click)</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creado Por</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Cargando campañas...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
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
                      {campaign.sent_at 
                        ? (
                            new Date(campaign.sent_at).toLocaleDateString() + ' ' + 
                            new Date(campaign.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                          )
                        : campaign.scheduled_at_local
                          ? (
                              <span className="text-amber-600">
                                <i className="fa-regular fa-clock mr-1"></i>
                                {new Date(campaign.scheduled_at as string).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )
                          : campaign.scheduled_at
                            ? (
                                <span className="text-amber-600">
                                  <i className="fa-regular fa-clock mr-1"></i>
                                  {new Date(campaign.scheduled_at as string).toLocaleString('es-ES', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )
                            : '-'
                      }
                    </td>
                    <td className="px-6 py-4">
                      {campaign.status === 'SENT' ? (
                         <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1" title="Tasa de Apertura">
                              <i className="fa-regular fa-envelope-open text-slate-400"></i>
                              <span className="font-medium text-slate-700">
                                {(() => {
                                  const sent = Number(campaign.sent_count || campaign.recipient_count || 0);
                                  const opened = Number(campaign.open_count || 0);
                                  return sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
                                })()}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1" title="Tasa de Clicks">
                              <i className="fa-solid fa-mouse-pointer text-slate-400"></i>
                              <span className="font-medium text-slate-700">
                                {(() => {
                                  const sent = Number(campaign.sent_count || campaign.recipient_count || 0);
                                  const clicked = Number(campaign.click_count || 0);
                                  return sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';
                                })()}%
                              </span>
                            </div>
                         </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No disponible</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {campaign.created_by === user?.id_user ? 'Tú' : (campaign.created_by_name || 'Compartido')}
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
                         {campaign.status === 'DRAFT' && (
                           <button 
                             onClick={(e) => handleLaunch(e, campaign)}
                             className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                             title="Lanzar ahora"
                           >
                             <i className="fa-solid fa-rocket"></i>
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