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
  
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    if (!tenantId) return;
    try {
      const data = await marketingApi.getCampaigns(tenantId);
      setCampaigns(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [tenantId]);

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'DRAFT': 'bg-slate-100 text-slate-600 border-slate-200',
      'PROCESSING': 'bg-blue-100 text-blue-600 border-blue-200',
      'SENDING': 'bg-purple-100 text-purple-600 border-purple-200',
      'SENT': 'bg-green-100 text-green-600 border-green-200',
      'FAILED': 'bg-red-100 text-red-600 border-red-200',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${styles[status] || styles['DRAFT']}`}>
        {status}
      </span>
    );
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
              <th className="px-6 py-3">Estadísticas</th>
              <th className="px-6 py-3">Fecha</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((camp) => (
              <tr key={camp.id_campaign} className="bg-white border-b hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-800">{camp.name}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">{camp.subject || '(Sin Asunto)'}</p>
                </td>
                <td className="px-6 py-4">{getStatusBadge(camp.status)}</td>
                <td className="px-6 py-4">
                  {camp.status === 'DRAFT' ? (
                     <span className="text-xs text-slate-400">
                        <i className="fa-solid fa-users mr-1"></i> {camp.total_audience || 0} potencial
                     </span>
                  ) : (
                    <div className="flex gap-3 text-xs">
                      <span title="Enviados" className="text-blue-600"><i className="fa-solid fa-paper-plane"></i> {camp.sent_count || 0}</span>
                      <span title="Abiertos" className="text-green-600"><i className="fa-regular fa-eye"></i> {camp.open_count || 0}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {new Date(camp.created_at || '').toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onEdit(camp.id_campaign)}
                    className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                  >
                    {camp.status === 'DRAFT' ? 'Editar' : 'Reporte'}
                  </button>
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