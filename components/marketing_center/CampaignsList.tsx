import React, { useEffect, useState } from 'react';

// --- CORRECCIÓN DE RUTAS ---
// Solo subimos 2 niveles (../../) para salir de 'marketing_center' y 'components'
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import { MarketingCampaign } from '../../types'; 

const CampaignsList = ({ onEdit }: { onEdit: (id: string | null) => void }) => {
  const { user } = useAuth();
  // Asumimos que user tiene id_tenant. Si tu auth context usa 'tenant' objeto, ajusta aquí.
  const tenantId = user?.id_tenant; 
  const userId = user?.id_user;
  
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    if (!tenantId || !userId) return;
    try {
      const data = await marketingApi.getCampaigns(tenantId, userId);
      setCampaigns(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [tenantId, userId]);

  const normalizeStatus = (status?: string) => {
    if (!status) return 'DRAFT';
    // Normalizamos variantes ('PAUSE' -> 'PAUSED', 'SENT' -> 'COMPLETED' opcional)
    if (status === 'PAUSE') return 'PAUSED';
    return status;
  };

  const getStatusBadge = (rawStatus: string) => {
    const status = normalizeStatus(rawStatus);
    const styles: any = {
      'DRAFT': 'bg-slate-100 text-slate-600 border-slate-200',
      'PROCESSING': 'bg-blue-100 text-blue-600 border-blue-200',
      'SENDING': 'bg-purple-100 text-purple-600 border-purple-200',
      'PAUSED': 'bg-amber-100 text-amber-700 border-amber-200',
      'COMPLETED': 'bg-green-100 text-green-600 border-green-200',
      'SENT': 'bg-green-100 text-green-600 border-green-200',
      'FAILED': 'bg-red-100 text-red-600 border-red-200',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${styles[status] || styles['DRAFT']}`}>
        {status}
      </span>
    );
  };

  const toNumber = (v: any): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  const calcProgress = (camp: MarketingCampaign): number => {
    const p = toNumber(camp.progress_percentage);
    if (p > 0) return Math.max(0, Math.min(100, p));
    const total = toNumber(camp.total_target) || toNumber(camp.total_audience) || toNumber(camp.recipient_count);
    const sentOk = toNumber(camp.successful_sents) || toNumber(camp.sent_count);
    const sentFail = toNumber(camp.failed_sents) || toNumber(camp.failed_count);
    const processed = sentOk + sentFail;
    if (total > 0) return Math.round((processed / total) * 100);
    return 0;
  };

  const handlePause = async (id: string) => {
    if (!userId) return;
    await marketingApi.campaignAction(id, userId, 'pause');
    fetchCampaigns();
  };

  const handleResume = async (id: string) => {
    if (!userId) return;
    // Reanudar con 'send' según nota del usuario
    await marketingApi.campaignAction(id, userId, 'send');
    fetchCampaigns();
  };

  const handleStart = async (id: string) => {
    if (!userId) return;
    await marketingApi.launchCampaign(id, userId);
    fetchCampaigns();
  };

  if (loading) return <div className="p-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {campaigns.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 text-2xl">
            <i className="fa-solid fa-paper-plane"></i>
          </div>
          <p className="text-slate-500 font-medium">No hay campañas creadas aún.</p>
          <button 
            onClick={() => onEdit(null)}
            className="mt-4 text-blue-600 font-bold hover:underline"
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3">Nombre / Asunto</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Progreso</th>
              <th className="px-6 py-3">Envío Programado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((camp) => (
              <tr key={camp.id_campaign} className="bg-white border-b hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-800">{camp.name}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">{camp.subject || '(Sin Asunto)'}</p>
                  {camp.target_lists_display && (
                    <p className="text-[11px] text-slate-400 mt-1">Audiencias: {camp.target_lists_display}</p>
                  )}
                </td>
                <td className="px-6 py-4 align-top">
                  {getStatusBadge(camp.status)}
                </td>
                <td className="px-6 py-4 w-[360px]">
                  {(() => {
                    const status = normalizeStatus(camp.status);
                    const total = toNumber(camp.total_target) || toNumber(camp.total_audience) || toNumber(camp.recipient_count);
                    const success = toNumber(camp.successful_sents) || toNumber(camp.sent_count);
                    const failed = toNumber(camp.failed_sents) || toNumber(camp.failed_count);
                    const remaining = toNumber(camp.remaining_count);
                    const progress = calcProgress(camp);

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
                            <div className="h-2 bg-purple-500 transition-all" style={{ width: `${progress}%` }}></div>
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

                    return (
                      <div className="text-xs text-slate-500">-</div>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {camp.scheduled_at_local
                    ? <span className="text-sm text-slate-600">{camp.scheduled_at_local}</span>
                    : <span className="text-xs text-slate-400">Inmediato</span>
                  }
                </td>
                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                  {(() => {
                    const status = normalizeStatus(camp.status);
                    if (status === 'DRAFT') {
                      return (
                        <>
                          <button
                            onClick={() => onEdit(camp.id_campaign)}
                            className="text-slate-700 hover:text-slate-900 font-medium px-3 py-1 rounded hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleStart(camp.id_campaign)}
                            className="text-white bg-blue-600 hover:bg-blue-700 font-medium px-3 py-1 rounded"
                          >
                            Iniciar Campaña
                          </button>
                        </>
                      );
                    }

                    if (status === 'SENDING' || status === 'PROCESSING') {
                      return (
                        <>
                          <button
                            onClick={() => handlePause(camp.id_campaign)}
                            className="text-amber-700 bg-amber-100 hover:bg-amber-200 font-medium px-3 py-1 rounded border border-amber-200"
                          >
                            Pausar
                          </button>
                          <button
                            onClick={() => onEdit(camp.id_campaign)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                          >
                            Ver Reporte
                          </button>
                        </>
                      );
                    }

                    if (status === 'PAUSED') {
                      return (
                        <>
                          <button
                            onClick={() => handleResume(camp.id_campaign)}
                            className="text-white bg-green-600 hover:bg-green-700 font-medium px-3 py-1 rounded"
                          >
                            Reanudar
                          </button>
                          <button
                            onClick={() => onEdit(camp.id_campaign)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                          >
                            Ver Reporte
                          </button>
                        </>
                      );
                    }

                    if (status === 'COMPLETED' || status === 'SENT') {
                      return (
                        <>
                          <button
                            onClick={() => onEdit(camp.id_campaign)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                          >
                            Ver Reporte
                          </button>
                        </>
                      );
                    }

                    return (
                      <button
                        onClick={() => onEdit(camp.id_campaign)}
                        className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                      >
                        Detalle
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CampaignsList;