import React, { useEffect, useState } from 'react';
import { marketingApi } from '../../../services/marketingApi';
import { MarketingCampaign, MarketingList } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import CampaignWizard from './CampaignWizard';

interface Props {
  campaignId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const CampaignDetail: React.FC<Props> = ({ campaignId, onClose, onRefresh }) => {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const loadCampaignDetail = async () => {
      try {
        setLoading(true);
        const data = await marketingApi.getCampaignDetail(campaignId);
        setCampaign(data);
      } catch (error) {
        console.error('Error loading campaign detail:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCampaignDetail();
  }, [campaignId]);

  const formatLocalDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      PROCESSING: 'bg-blue-100 text-blue-700',
      SENDING: 'bg-purple-100 text-purple-700',
      SENT: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
    };
    return colors[status || 'DRAFT'] || colors.DRAFT;
  };

  const handleSaved = () => {
    setShowEditModal(false);
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 shadow-xl">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
            <p className="text-slate-600 font-semibold">Cargando campaña...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 shadow-xl max-w-md">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Error</h3>
          <p className="text-slate-600 mb-6">No se pudo cargar la campaña.</p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">Detalles de Campaña</p>
            <h2 className="text-3xl font-bold text-slate-900">{campaign.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Status & Meta Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Estado</label>
              <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${getStatusColor(campaign.status)}`}>
                {campaign.status || 'DRAFT'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Creado Por</label>
              <div className="flex items-center gap-3">
                {campaign.avatar_url ? (
                  <img
                    src={campaign.avatar_url}
                    alt={campaign.created_by_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                    {(campaign.created_by_name || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-slate-800">{campaign.created_by_name || 'Sistema'}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Creado</label>
              <p className="text-slate-700 font-semibold">{formatLocalDate(campaign.created_at)}</p>
            </div>
            {campaign.sent_at && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Enviado</label>
                <p className="text-slate-700 font-semibold">{formatLocalDate(campaign.sent_at)}</p>
              </div>
            )}
            {campaign.scheduled_at && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Programado Para</label>
                <p className="text-slate-700 font-semibold">{formatLocalDate(campaign.scheduled_at)}</p>
              </div>
            )}
          </div>

          {/* Content Info */}
          <div className="border-t pt-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Contenido</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto</label>
                <p className="text-slate-600 bg-slate-50 px-4 py-3 rounded-lg">{campaign.subject || '(Sin asunto)'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Remitente</label>
                <p className="text-slate-600 bg-slate-50 px-4 py-3 rounded-lg">
                  {campaign.sender_type === 'USER' ? '👤 Personal' : '🏢 Corporativo'}
                </p>
              </div>
              {campaign.html_content && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Vista Previa del Contenido</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 max-h-64 overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none text-slate-700"
                      dangerouslySetInnerHTML={{ __html: campaign.html_content }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audience Info */}
          <div className="border-t pt-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Audiencia</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-bold uppercase mb-1">Total Audiencia</p>
                <p className="text-3xl font-bold text-blue-700">{campaign.total_audience || '0'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-600 font-bold uppercase mb-1">Listas Asignadas</p>
                <p className="text-slate-700">{campaign.target_lists_display || 'Sin listas asignadas'}</p>
              </div>
            </div>
          </div>

          {/* Statistics (if sent) */}
          {campaign.status !== 'DRAFT' && (
            <div className="border-t pt-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Estadísticas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-green-600 font-bold uppercase mb-2">Enviados</p>
                  <p className="text-2xl font-bold text-green-700">{campaign.sent_count || '0'}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
                  <p className="text-xs text-red-600 font-bold uppercase mb-2">Fallidos</p>
                  <p className="text-2xl font-bold text-red-700">{campaign.failed_count || '0'}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs text-purple-600 font-bold uppercase mb-2">Abiertos</p>
                  <p className="text-2xl font-bold text-purple-700">{campaign.open_count || '0'}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs text-orange-600 font-bold uppercase mb-2">Clics</p>
                  <p className="text-2xl font-bold text-orange-700">{campaign.click_count || '0'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
          >
            Cerrar
          </button>
          {campaign.status === 'DRAFT' && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
            >
              <i className="fas fa-edit"></i>
              Editar Campaña
            </button>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <CampaignWizard
          campaignId={campaignId}
          onClose={() => setShowEditModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default CampaignDetail;
