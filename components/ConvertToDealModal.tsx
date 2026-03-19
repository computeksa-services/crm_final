import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact, DealStatus, DealInterest, DealChannel } from '../types';
import { apiFetch } from '../services/apiClient';
import { X } from 'lucide-react';
import { SimpleSpinner } from './AppLoaders';
import AppModalViewport from './AppModalViewport';

interface ConvertToDealModalProps {
  contact: ClientContact;
  dealStatuses: DealStatus[];
  dealInterests: DealInterest[];
  dealChannels: DealChannel[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDealId: string) => void;
}

const ConvertToDealModal: React.FC<ConvertToDealModalProps> = ({ contact, dealStatuses, dealInterests, dealChannels, isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [dealName, setDealName] = useState(`Trato - ${contact.name_company || contact.first_name}`);
  const [dealValue, setDealValue] = useState('');
  const [dealStatusId, setDealStatusId] = useState<string>('');
  const [interestId, setInterestId] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealStatuses.length > 0) setDealStatusId(dealStatuses[0].id_status);
    if (dealInterests.length > 0) setInterestId(dealInterests[0].id_interest);
    if (dealChannels.length > 0) setChannelId(dealChannels[0].id_channel);
  }, [dealStatuses, dealInterests, dealChannels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName || !dealValue || !dealStatusId || !interestId || !channelId) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        nombre_trato: dealName,
        valor_trato: parseFloat(dealValue),
        descripcion: description,
        id_client_company: contact.id_client_company,
        id_contact: contact.id_contact,
        id_deal_status: dealStatusId,
        id_interest: interestId,
        channel: channelId,
        id_tenant: user?.id_tenant,
        id_user_owner: user?.id_user,
        id_user: user?.id_user,
      };

      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al crear el trato.');
      
      const result = await response.json();
      onSuccess(result.id_trato);

    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AppModalViewport className="z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in-fast">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-slide-in-from-bottom-fast">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Convertir a Trato</h2>
            <p className="text-sm text-slate-500">Nuevo trato para {contact.first_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dealName" className="block text-sm font-medium text-slate-700 mb-1">Nombre del Trato</label>
              <input type="text" id="dealName" value={dealName} onChange={(e) => setDealName(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="dealValue" className="block text-sm font-medium text-slate-700 mb-1">Valor Estimado</label>
              <input type="number" id="dealValue" value={dealValue} onChange={(e) => setDealValue(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" placeholder="Ej: 5000" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="dealStatus" className="block text-sm font-medium text-slate-700 mb-1">Etapa</label>
              <select id="dealStatus" value={dealStatusId} onChange={(e) => setDealStatusId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md">
                {dealStatuses.map(status => <option key={status.id_status} value={status.id_status}>{status.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="interest" className="block text-sm font-medium text-slate-700 mb-1">Interés</label>
              <select id="interest" value={interestId} onChange={(e) => setInterestId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md">
                {dealInterests.map(interest => <option key={interest.id_interest} value={interest.id_interest}>{interest.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="channel" className="block text-sm font-medium text-slate-700 mb-1">Canal</label>
              <select id="channel" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md">
                {dealChannels.map(channel => <option key={channel.id_channel} value={channel.id_channel}>{channel.name}</option>)}
              </select>
            </div>
          </div>
           <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-md" />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <SimpleSpinner size="sm" />}
              {isSubmitting ? 'Creando...' : '🚀 Crear Trato'}
            </button>
          </div>
        </form>
      </div>
    </AppModalViewport>
  );
};

export default ConvertToDealModal;
