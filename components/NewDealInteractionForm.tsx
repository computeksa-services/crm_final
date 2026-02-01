import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { addDays, format } from 'date-fns';

const interactionTypes = [
  { type: 'NOTE', icon: 'fa-file-alt', label: 'Nota' },
  { type: 'CALL', icon: 'fa-phone', label: 'Llamada' },
  { type: 'MEETING', icon: 'fa-users', label: 'Reunión' },
];

type InteractionType = 'NOTE' | 'CALL' | 'MEETING';

interface NewDealInteractionFormProps {
  dealId: string;
  onSuccess: () => void;
}

const NewDealInteractionForm: React.FC<NewDealInteractionFormProps> = ({ dealId, onSuccess }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [interactionType, setInteractionType] = useState<InteractionType>('NOTE');
  const [isScheduling, setIsScheduling] = useState(false);
  const [nextContactDate, setNextContactDate] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        entity_id: dealId,
        entity_type: 'DEAL',
        description,
        interaction_type: interactionType,
        id_user: user?.id_user,
        id_tenant: user?.id_tenant
      };
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
      setDescription('');
      setInteractionType('NOTE');
      setIsScheduling(false);
      setNextContactDate('');
      setNextActionDesc('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-slate-200">
      <div className="relative">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full p-3 pr-28 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow text-sm"
          placeholder="¿Qué sucedió con el trato?"
        />
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {interactionTypes.map(({ type, icon, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => setInteractionType(type as InteractionType)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                interactionType === type ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title={label}
            >
              <i className={`fa-solid ${icon}`}></i>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isScheduling}
            onChange={() => setIsScheduling((v) => !v)}
            className="form-checkbox rounded text-brand-600 focus:ring-brand-500"
          />
          Programar siguiente acción
        </label>
        {isScheduling && (
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <input
              type="date"
              value={nextContactDate}
              onChange={(e) => setNextContactDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              min={format(addDays(new Date(), 0), 'yyyy-MM-dd')}
            />
            <textarea
              value={nextActionDesc}
              onChange={(e) => setNextActionDesc(e.target.value)}
              rows={2}
              className="w-full md:w-72 p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Describe la siguiente acción..."
            />
          </div>
        )}
      </div>
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2 rounded-lg shadow-sm transition-all disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar gestión'}
        </button>
      </div>
    </form>
  );
};

export default NewDealInteractionForm;
