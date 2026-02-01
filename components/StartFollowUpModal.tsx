import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact } from '../types';
import { addDays, format } from 'date-fns';
import { X, LoaderCircle } from 'lucide-react';

interface StartFollowUpModalProps {
  contact: ClientContact;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StartFollowUpModal: React.FC<StartFollowUpModalProps> = ({ contact, isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [initialNote, setInitialNote] = useState('');
  const [nextContactDate, setNextContactDate] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Resetear estado al abrir
      setInitialNote('');
      setNextActionDesc('');
      setError(null);
      // Pre-llenar con fecha de mañana
      const tomorrow = addDays(new Date(), 1);
      setNextContactDate(format(tomorrow, 'yyyy-MM-dd'));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialNote.trim() || !nextContactDate || !nextActionDesc.trim()) {
      setError('Todos los campos son obligatorios para iniciar el seguimiento.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        entity_id: contact.id_contact,
        entity_type: 'CONTACT',
        interaction_type: 'NOTE',
        description: initialNote,
        next_contact_date: nextContactDate,
        next_action_desc: nextActionDesc,
        id_user: user?.id_user,
        id_tenant: user?.id_tenant,
      };

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/interactions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar el seguimiento.');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Iniciar Seguimiento de <span className="text-brand-600">{contact.first_name} {contact.last_name}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">Define tu primera acción para este contacto.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="initial_note" className="block text-sm font-medium text-slate-700 mb-1">Nota Inicial</label>
            <textarea
              id="initial_note"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              rows={4}
              className="w-full p-2 border border-slate-300 rounded-md"
              placeholder="Ej: Contacto inicial en feria, mostrar interés en producto X."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="next_contact_date" className="block text-sm font-medium text-slate-700 mb-1">Fecha Próximo Contacto</label>
              <input
                type="date"
                id="next_contact_date"
                value={nextContactDate}
                onChange={(e) => setNextContactDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="next_action_desc" className="block text-sm font-medium text-slate-700 mb-1">Siguiente Acción</label>
              <textarea
                id="next_action_desc"
                value={nextActionDesc}
                onChange={(e) => setNextActionDesc(e.target.value)}
                rows={3}
                className="w-full p-2 border border-slate-300 rounded-md"
                placeholder="Ej: Enviar email con catálogo"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100">Cancelar</button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : 'Iniciar Seguimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartFollowUpModal;
