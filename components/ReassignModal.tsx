import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import { ClientContact, User } from '../types';
import { X, LoaderCircle, ArrowRightLeft } from 'lucide-react';

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contact: ClientContact;
  users: User[];
}

const ReassignModal: React.FC<ReassignModalProps> = ({ isOpen, onClose, onSuccess, contact, users }) => {
  const { user } = useAuth();
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Encontrar el usuario actual basado en el nombre y excluirlo de la lista
  const currentOwner = users.find(u => u.name_user === contact.owner_name);
  const availableUsers = users.filter(u => u.id_user !== currentOwner?.id_user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerId) {
      setError('Debes seleccionar un nuevo responsable.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        id_tenant: user?.id_tenant,
        id_contact: contact.id_entity || contact.id_contact,
        id_user_new_owner: newOwnerId,
        reason: reason || 'Reasignación desde panel de seguimiento.',
      };

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/contacts/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al reasignar el prospecto.');
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const contactName = contact.title || `${contact.first_name || ''} ${contact.last_name || ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in-fast">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-slide-in-from-bottom-fast">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft size={20} className="text-indigo-500" /> Reasignar Prospecto</h2>
            <p className="text-sm text-slate-500">
              Mover a <span className="font-semibold text-brand-600">{contactName}</span> a otro responsable.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {currentOwner && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
              <span className="text-slate-500">Responsable actual:</span>
              <div className="flex items-center gap-2 mt-1">
                <img src={currentOwner.avatar_url || `https://ui-avatars.com/api/?name=${currentOwner.name_user}&background=random`} alt={currentOwner.name_user} className="w-6 h-6 rounded-full" />
                <span className="font-bold text-slate-700">{currentOwner.name_user}</span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="new_owner" className="block text-sm font-medium text-slate-700 mb-1">Nuevo Responsable</label>
            <select
              id="new_owner"
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">-- Seleccionar usuario --</option>
              {availableUsers.map(u => (
                <option key={u.id_user} value={u.id_user}>{u.name_user}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">Motivo (Opcional)</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500"
              placeholder="Ej: Cambio de cartera, enfoque en otra región..."
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100">Cancelar</button>
            <button
              type="submit"
              disabled={isSubmitting || !newOwnerId}
              className="px-5 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}
              {isSubmitting ? 'Reasignando...' : 'Reasignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReassignModal;
