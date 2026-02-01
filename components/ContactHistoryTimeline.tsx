import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';

interface ContactInteraction {
  id: string;
  type: string;
  description: string;
  date_fmt: string;
  user_name: string;
  user_avatar?: string;
  planned_action?: string;
  planned_date?: string;
  channel_icon?: string;
  channel_color?: string;
  channel_name?: string;
}

interface ContactHistoryGroup {
  group_id: string;
  group_name: string;
  group_status_name: string | null;
  group_status_color: string | null;
  group_value: number | null;
  interactions: ContactInteraction[];
}

interface ContactHistoryTimelineProps {
  contactId: string;
  refreshKey?: number;
}

const ContactHistoryTimeline: React.FC<ContactHistoryTimelineProps> = ({ contactId, refreshKey = 0 }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ContactHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!contactId || !user) {
      console.log('[ContactHistoryTimeline] contactId o user no disponible', { contactId, user });
      return;
    }
    setLoading(true);
    try {
      const url = buildUrl(GATEWAY_CONFIG.API.CLIENTS.CONTACTS_HISTORY, { id_contact: contactId });
      console.log('[ContactHistoryTimeline] Fetching history from:', url);
      const response = await apiFetch(url);
      console.log('[ContactHistoryTimeline] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[ContactHistoryTimeline] Data received:', data);
        // Filtrar grupos que no tengan interacciones válidas
        if (Array.isArray(data)) {
          setGroups(
            data.filter(
              (g: any) => Array.isArray(g.interactions) && g.interactions.length > 0
            )
          );
        } else {
          setGroups([]);
        }
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('[ContactHistoryTimeline] Error fetching history:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500"></i>
      </div>
    );
  }

  if (!groups.length) {
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
    <div className="space-y-8">
      {groups.map((group, gIdx) => {
        const isGeneral = group.group_id === 'SIN_TRATO';
        const groupTitle = isGeneral ? 'Seguimiento General' : group.group_status_name || group.group_name;
        return (
          <div key={group.group_id || gIdx} className={`rounded-2xl border ${isGeneral ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50'} shadow-sm p-0`}> 
            {/* Header */}
            <div className={`flex items-center gap-3 px-6 py-3 border-b ${isGeneral ? 'border-slate-100' : 'border-emerald-100 bg-emerald-100/40'} rounded-t-2xl`}>
              <span className={`w-2 h-6 ${isGeneral ? 'bg-blue-500' : 'bg-emerald-500'} rounded-full`}></span>
              <h3 className={`font-bold text-sm ${isGeneral ? 'text-slate-700' : 'text-emerald-700'}`}>{groupTitle}</h3>
              {!isGeneral && group.group_value && group.group_value > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700 font-mono font-bold text-xs">
                  ${group.group_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            {/* Interactions */}
            <div className="p-6 space-y-6">
              {(group.interactions || []).map((interaction, idx) => {
                const isLatest = idx === 0;
                // Usar key única: id o idx
                // Canal info: icon/color
                const channelIcon = interaction.channel_icon;
                const channelColor = interaction.channel_color;
                // Mostrar avatar primero, icono canal a la derecha de la hora
                return (
                  <div key={interaction.id || idx} className={`relative flex items-start gap-4 p-4 rounded-xl ${isLatest ? 'border-2 border-brand-200 bg-brand-50/40 shadow-sm' : 'border border-slate-100 bg-white'} ${isLatest ? 'after:content-[\'Última Gestión\'] after:absolute after:-top-3 after:right-4 after:bg-brand-600 after:text-white after:text-[10px] after:font-bold after:px-2 after:py-0.5 after:rounded-full' : ''}`}>
                    {/* Avatar primero */}
                    <img
                      src={interaction.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(interaction.user_name || 'S')}&background=random`}
                      alt="avatar"
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-sm truncate">{interaction.user_name || 'Sistema'}</span>
                        <span className="text-xs text-slate-400">{interaction.date_fmt}</span>
                        {/* Icono canal a la derecha de la hora */}
                        {channelIcon && (
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center border-2 ml-2"
                            style={{ backgroundColor: '#f3f4f6' }}
                            title={interaction.channel_name || 'Canal'}
                          >
                            <i className={channelIcon.startsWith('fa') ? channelIcon : `fa-solid ${channelIcon}`}
                               style={{ color: channelColor || '#555', fontSize: '1rem' }}></i>
                          </span>
                        )}
                        {isLatest && <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase">Última Gestión</span>}
                      </div>
                      <div className="text-slate-700 text-[15px] whitespace-pre-line mb-1">{interaction.description}</div>
                      {interaction.planned_action && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <i className="fa-solid fa-arrow-right text-slate-400"></i>
                          <span className="font-semibold">Compromiso establecido:</span>
                          <span>{interaction.planned_action}</span>
                          {interaction.planned_date && <span className="ml-2">({interaction.planned_date})</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContactHistoryTimeline;
