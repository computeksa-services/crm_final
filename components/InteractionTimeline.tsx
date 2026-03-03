import React, { useEffect, useState, useCallback } from 'react';
import { BrandSpinner } from './AppLoaders';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';

interface Interaction {
  id_interaction: string;
  interaction_type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL';
  description: string;
  created_at: string;
  creator_name: string;
  next_action_desc?: string;
  next_contact_date?: string;
}

interface InteractionTimelineProps {
  contactId: string;
  refreshKey: number;
}

const getIconForType = (type: Interaction['interaction_type']) => {
  switch (type) {
    case 'CALL':
      return { icon: 'fa-phone', color: 'text-sky-500', bg: 'bg-sky-50' };
    case 'MEETING':
      return { icon: 'fa-users', color: 'text-purple-500', bg: 'bg-purple-50' };
    case 'EMAIL':
      return { icon: 'fa-envelope', color: 'text-amber-500', bg: 'bg-amber-50' };
    case 'NOTE':
    default:
      return { icon: 'fa-file-alt', color: 'text-gray-500', bg: 'bg-gray-50' };
  }
};

const InteractionTimeline: React.FC<InteractionTimelineProps> = ({ contactId, refreshKey }) => {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Siempre fetch directo al endpoint, sin cache
  const fetchInteractions = useCallback(async () => {
    if (!contactId || !user) return;
    setLoading(true);
    try {
      const url = buildUrl(GATEWAY_CONFIG.API.CLIENTS.CONTACTS_DETAIL.replace('/detail', '/history'), { id_contact: contactId });
      const response = await apiFetch(url);
      if (response.ok) {
        const data = await response.json();
        setInteractions(Array.isArray(data) ? data : []);
      } else {
        setInteractions([]);
      }
    } catch (error) {
      console.error('Error fetching interactions:', error);
      setInteractions([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions, refreshKey]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <BrandSpinner size="lg" />
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <i className="fa-solid fa-comments text-3xl text-slate-300"></i>
        </div>
        <h4 className="font-bold text-slate-700">Aún no hay actividad registrada</h4>
        <p className="text-sm text-slate-500 max-w-xs mt-2">
          ¡Inicia el seguimiento registrando tu primera gestión!
        </p>
      </div>
    );
  }

  return (
    <div className="flow-root p-6">
      <ul className="-mb-8">
        {interactions.map((interaction, index) => {
          const { icon, color, bg } = getIconForType(interaction.interaction_type);
          const isLast = index === interactions.length - 1;

          return (
            <li key={interaction.id_interaction}>
              <div className="relative pb-8">
                {!isLast && (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full ${bg} flex items-center justify-center ring-8 ring-white`}>
                      <i className={`fa-solid ${icon} ${color} text-sm`}></i>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex justify-between text-sm text-slate-500">
                      <p className="font-medium text-slate-900">{interaction.creator_name}</p>
                      <time dateTime={interaction.created_at}>
                        {formatDistanceToNow(parseISO(interaction.created_at), { addSuffix: true, locale: es })}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{interaction.description}</p>
                    {(interaction.next_action_desc || interaction.next_contact_date) && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Siguiente Acción:
                                </p>
                                <p className="text-sm text-slate-800 font-bold mt-1">{interaction.next_action_desc || 'N/A'}</p>
                            </div>
                            {interaction.next_contact_date && (
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha:</p>
                                    <p className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full mt-1">
                                        {new Date(interaction.next_contact_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default InteractionTimeline;
