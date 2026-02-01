import React, { useState, useEffect } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { addDays, format } from 'date-fns';

type InteractionType = 'NOTE' | 'CALL' | 'MEETING';

interface NewInteractionFormProps {
  entityId: string;
  entityType: 'CONTACT' | 'DEAL';
  onSuccess: () => void;
}

const interactionTypes: { type: InteractionType; icon: string; label: string }[] = [
  { type: 'NOTE', icon: 'fa-file-alt', label: 'Nota' },
  { type: 'CALL', icon: 'fa-phone', label: 'Llamada' },
  { type: 'MEETING', icon: 'fa-users', label: 'Reunión' },
];

const NewInteractionForm: React.FC<NewInteractionFormProps> = ({ entityId, entityType, onSuccess }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  // Siempre será 'NOTE' para el backend
  const interactionType: InteractionType = 'NOTE';
  const [isScheduling, setIsScheduling] = useState(false);
  const [nextContactDate, setNextContactDate] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dealChannels } = useDataCache();
  // 'NOTE' es la opción por defecto y visual
  const [selectedType, setSelectedType] = useState<string>('NOTE');

  useEffect(() => {
    if (dealChannels && dealChannels.length > 0 && selectedType === '') {
      setSelectedType('NOTE');
    }
  }, [dealChannels]);

  useEffect(() => {
    // Pre-llenar con fecha de mañana al cambiar el estado de programación
    if (isScheduling) {
      const tomorrow = addDays(new Date(), 1);
      setNextContactDate(format(tomorrow, 'yyyy-MM-dd'));
    } else {
      setNextContactDate('');
      setNextActionDesc('');
    }
  }, [isScheduling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() === '') {
      setError('La descripción no puede estar vacía.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        description,
        interaction_type: selectedType === 'NOTE' ? 'NOTE' : 'NOTE',
        id_user: user?.id_user,
        id_tenant: user?.id_tenant,
        entity_type: entityType // Obligatorio para el backend
      };
      // Enviar id_contact o id_deal según el tipo
      if (entityType === 'CONTACT' && entityId) {
        payload.id_contact = entityId;
      }
      if (entityType === 'DEAL' && entityId) {
        payload.id_deal = entityId;
      }
      if (selectedType !== 'NOTE') {
        payload.id_channel = selectedType;
      }

      if (isScheduling) {
        payload.next_contact_date = nextContactDate;
        payload.next_action_desc = nextActionDesc;
      }

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/interactions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Error al registrar la gestión.');
      }
      
      // Reset form and notify parent
      setDescription('');
      setIsScheduling(false);
      setNextContactDate('');
      setNextActionDesc('');
      setSelectedType('NOTE');
      onSuccess();

    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-slate-200">
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow text-sm"
          placeholder="¿Qué sucedió con el contacto?"
          style={{ resize: 'vertical', minHeight: 48 }}
        />
        {/* Selector visual de tipo de interacción y canal */}
        <div className="flex items-center gap-1 mt-2">
          {/* Opción Nota */}
          <button
            key="NOTE"
            type="button"
            onClick={() => setSelectedType('NOTE')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 ${
              selectedType === 'NOTE' ? 'bg-brand-600 text-white border-brand-600 shadow' : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
            }`}
            title="Nota"
          >
            <i className="fa-solid fa-file-alt"></i>
          </button>
          {/* Canales */}
          {dealChannels && dealChannels.length > 0 && dealChannels.map((c) => (
            <button
              key={c.id_channel}
              type="button"
              onClick={() => setSelectedType(c.id_channel)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 ${
                selectedType === c.id_channel ? 'bg-brand-600 text-white border-brand-600 shadow' : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
              }`}
              title={c.name}
              style={{ color: selectedType === c.id_channel ? '#fff' : c.color, backgroundColor: selectedType === c.id_channel ? c.color : undefined }}
            >
              <i className={c.icon.startsWith('fa') ? c.icon : `fa-solid ${c.icon}`}></i>
            </button>
          ))}
        </div>
      </div>

      {/* Fin selector visual de canal */}

      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isScheduling}
            onChange={(e) => setIsScheduling(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Programar Siguiente Acción
        </label>
      </div>

      {isScheduling && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label htmlFor="next_contact_date" className="block text-xs font-medium text-slate-500 mb-1">
              Fecha Próximo Contacto
            </label>
            <input
              type="date"
              id="next_contact_date"
              value={nextContactDate}
              onChange={(e) => setNextContactDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label htmlFor="next_action_desc" className="block text-xs font-medium text-slate-500 mb-1">
              Descripción Siguiente Acción
            </label>
            <textarea
              id="next_action_desc"
              value={nextActionDesc}
              onChange={(e) => setNextActionDesc(e.target.value)}
              rows={3}
              placeholder="Ej: Llamar para confirmar"
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || description.trim() === ''}
          className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {isSubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Registrar Gestión'}
        </button>
      </div>
    </form>
  );
};

export default NewInteractionForm;
