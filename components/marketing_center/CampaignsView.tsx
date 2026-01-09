import React, { useState } from 'react';

// CORRECCIÓN 1: Si CampaignsList está en la misma carpeta 'marketing_center'
import CampaignsList from './CampaignsList'; 

// CORRECCIÓN 2: El Wizard está dentro de la subcarpeta 'campaigns'
import CampaignWizardModal from './campaigns/CampaignWizardModal';

interface Props {
  tenantId: string;
  userId: string;
}

const CampaignsView: React.FC<Props> = ({ tenantId, userId }) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Clave para forzar recarga de la lista cuando guardamos (truco de React)
  const [refreshKey, setRefreshKey] = useState(0); 

  const handleEdit = (id: string | null) => {
    setEditingId(id);
    setIsWizardOpen(true);
  };

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1); // Esto fuerza a CampaignsList a recargar datos
    // El modal se cerrará automáticamente desde el Wizard cuando llame a onSuccess
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Campañas de Email</h2>
          <p className="text-sm text-slate-500">Crea, edita y monitorea tus boletines.</p>
        </div>
        
        {/* Botón superior opcional (ya tienes uno en la lista, pero este se ve bien aquí) */}
        <button 
          onClick={() => handleEdit(null)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Crear Campaña
        </button>
      </div>

      {/* Lista de Campañas */}
      <CampaignsList 
        key={refreshKey} // Vital: fuerza re-render al guardar
        onEdit={handleEdit} 
      />

      {/* Modal Wizard */}
      {isWizardOpen && (
        <CampaignWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          campaignId={editingId}
          tenantId={tenantId}
          userId={userId}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default CampaignsView;