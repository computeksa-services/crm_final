import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { FollowUpItem } from '../types';
import { X, LoaderCircle } from 'lucide-react';
import { addDays, format } from 'date-fns';
import NewInteractionForm from './NewInteractionForm';

interface LogActionModalProps {
  item: FollowUpItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LogActionModal: React.FC<LogActionModalProps> = ({ item, isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [nextContactDate, setNextContactDate] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Resetear estado al abrir
      setDescription('');
      setNextActionDesc('');
      setError(null);
      // Pre-llenar con fecha de mañana
      const tomorrow = addDays(new Date(), 1);
      setNextContactDate(format(tomorrow, 'yyyy-MM-dd'));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Debes describir qué sucedió.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      // Obtener el ID correcto de la entidad
      let entityId: string;
      if (item.entity_type === 'DEAL') {
        entityId = item.id_entity || item.id_trato || '';
      } else {
        entityId = item.id_entity || item.id_contact || '';
      }

      if (!entityId) {
        throw new Error('No se pudo obtener el ID de la entidad.');
      }

      const payload = {
        entity_id: entityId,
        entity_type: item.entity_type,
        interaction_type: 'NOTE',
        description,
        next_contact_date: nextContactDate || null,
        next_action_desc: nextActionDesc || null,
        id_user: user?.id_user,
        id_tenant: user?.id_tenant,
      };

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/interactions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al registrar la gestión.');
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-lg animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative flex flex-col items-stretch">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={22}/></button>
        <h2 className="font-black text-xl text-slate-800 mb-4 px-8 pt-8">Registrar Gestión</h2>
        <div className="px-8 pb-8">
          <NewInteractionForm
            entityId={item.entity_type === 'DEAL' ? (item.id_entity || item.id_trato || '') : (item.id_entity || item.id_contact || '')}
            entityType={item.entity_type}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
};

export default LogActionModal;
