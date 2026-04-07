import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FollowUpItem } from '../types';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG } from '../services/gatewayConfig';
import { parseISO, isBefore, startOfDay } from 'date-fns';
import { Handshake } from 'lucide-react';
import NewInteractionModal from '../components/NewInteractionModal';
import ReassignModal from '../components/ReassignModal';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import { BrandSpinner } from '../components/AppLoaders';
import { useDataCache } from '../contexts/DataCacheContext';
import Avatar from '../components/Avatar';

// ── ICONS ──────────────────────────────────────────────────────────────────
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconCalendar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconExclamation = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const IconMessage = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

// ── HELPERS ────────────────────────────────────────────────────────────────
function getUrgency(d?: string | null) {
  if (!d) return 'none';
  const date = parseISO(d);
  const today = startOfDay(new Date());
  const tom = new Date(today);
  tom.setDate(tom.getDate() + 1);
  if (isBefore(date, today)) return 'overdue';
  if (date >= today && date < tom) return 'today';
  return 'upcoming';
}

function fmtTime(d?: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tom = new Date(today);
  tom.setDate(tom.getDate() + 1);
  if (date >= today && date < tom) {
    return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ago(d?: string | null) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return `Hace ${Math.floor(days / 30)} meses`;
}

function getStatusStyle(color?: string) {
  const map: Record<string, any> = {
    '#3b82f6': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', darkBg: '#1e3a5f', darkText: '#93c5fd', darkBorder: '#1e40af' },
    '#f97316': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316', darkBg: '#5f2e0f', darkText: '#fb923c', darkBorder: '#c2410c' },
    '#10b981': { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', dot: '#10b981', darkBg: '#064e3b', darkText: '#6ee7b7', darkBorder: '#059669' },
    '#94a3b8': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8', darkBg: '#2d2d30', darkText: '#9da1a6', darkBorder: '#3c3c3c' },
    '#6366f1': { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', dot: '#6366f1', darkBg: '#3730a3', darkText: '#a5b4fc', darkBorder: '#4f46e5' },
  };
  return map[color || ''] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8', darkBg: '#2d2d30', darkText: '#9da1a6', darkBorder: '#3c3c3c' };
}

const URGENCY_CONFIG = {
  overdue: { label: 'Vencido', icon: <IconExclamation/>, bg: '#fef2f2', border: '#ef4444', textColor: '#b91c1c', timeColor: '#dc2626', darkBg: '#5f0f0f', darkBorder: '#991b1b', darkTextColor: '#f87171', darkTimeColor: '#fca5a5' },
  today: { label: 'Para Hoy', icon: <IconClock/>, bg: '#fffbeb', border: '#f59e0b', textColor: '#92400e', timeColor: '#d97706', darkBg: '#78350f', darkBorder: '#b45309', darkTextColor: '#fbbf24', darkTimeColor: '#fcd34d' },
  upcoming: { label: 'Programado', icon: <IconCalendar/>, bg: '#f8fafc', border: '#cbd5e1', textColor: '#475569', timeColor: '#64748b', darkBg: '#2d2d30', darkBorder: '#3c3c3c', darkTextColor: '#c5c5c5', darkTimeColor: '#9da1a6' },
  none: { label: 'Sin fecha', icon: null, bg: '#f8fafc', border: '#e2e8f0', textColor: '#64748b', timeColor: '#94a3b8', darkBg: '#2d2d30', darkBorder: '#3c3c3c', darkTextColor: '#9da1a6', darkTimeColor: '#6e7681' },
};

const AV_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f97316', '#ef4444', '#ec4899'];

function avColor(str: string) {
  const s = String(str || 'U');
  let h = 0;
  for (let c of s) h = (h << 5) - h + c.charCodeAt(0);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

function getInitials(collab: any) {
  if (collab.initials) return collab.initials;
  const name = collab.name || collab.id || 'U';
  return String(name).slice(0, 2).toUpperCase();
}

const roleLabels: Record<string, string> = { OWNER: 'Propietario', EDIT: 'Edición', VIEW: 'Solo lectura', BLOCKED: 'Bloqueado' };

function isClosedProspect(item: FollowUpItem) {
  if (item.entity_type !== 'CONTACT') return false;
  const status = String((item as any).contact_status || (item as any).status_category || '').toUpperCase();
  const statusName = String((item as any).current_status_name || '').toUpperCase();
  return status === 'DORMANT' || statusName === 'DORMANT';
}

function isDirectoryContact(item: FollowUpItem) {
  return item.entity_type === 'CONTACT' && !item.next_contact_date;
}

function getVisibleStatusName(item: FollowUpItem) {
  if (isClosedProspect(item)) return 'Perdido';
  return item.current_status_name || 'Sin estado';
}

// ── AVATAR GROUP ───────────────────────────────────────────────────────────
function AvatarGroupContent({ collaborators, users }: { collaborators?: any[]; users?: any[] }) {
  // Memoizar la búsqueda de cada usuario para no buscar en cada render
  const collaboratorUsers = useMemo(() => {
    if (!collaborators?.length || !users?.length) return [];
    return collaborators
      .sort((a, b) => {
        const levelOrder: Record<string, number> = { OWNER: 0, EDIT: 1, VIEW: 2 };
        return (levelOrder[a.access_level] ?? 3) - (levelOrder[b.access_level] ?? 3);
      })
      .slice(0, 3)
      .reverse()
      .map(c => ({
        collab: c,
        user: users.find(u => u.id_user === c.id)
      }));
  }, [collaborators, users]);

  if (!collaboratorUsers.length) return null;

  return (
    <div className="flex -space-x-2 items-center overflow-visible">
      {collaboratorUsers.map(({ collab: c, user }, i) => {
        const isOwner = c.access_level === 'OWNER';
        const isPrincipal = c.access_level === 'EDIT' && !isOwner;
        const isSecondary = c.access_level === 'VIEW';
        
        let badgeType: 'OWNER' | 'EDIT' | 'VIEW' = 'VIEW';
        let tooltipText = user?.name_user || 'Usuario';
        
        if (isOwner) {
          badgeType = 'OWNER';
          tooltipText = `${user?.name_user || 'Usuario'} (Creador)`;
        } else if (isPrincipal) {
          badgeType = 'EDIT';
          tooltipText = `${user?.name_user || 'Usuario'} (Principal)`;
        } else if (isSecondary) {
          badgeType = 'VIEW';
          tooltipText = `${user?.name_user || 'Usuario'} (Secundario)`;
        }
        
        return (
          <div
            key={c.id || i}
            className="relative group/collab inline-block"
            title={tooltipText}
          >
            <div className="relative transition-all group-hover/collab:scale-125 group-hover/collab:z-30">
              <Avatar 
                src={user?.avatar_url || null}
                name={user?.name_user || 'Usuario'}
                size="sm"
                badge={{ type: badgeType }}
              />
            </div>
            
            {/* Tooltip personalizado */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover/collab:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              <div className="font-bold">{user?.name_user || 'Usuario'}</div>
              <div className={`text-[9px] ${isOwner ? 'text-amber-300' : isPrincipal ? 'text-indigo-300' : 'text-slate-300'}`}>
                {isOwner ? 'Creador' : isPrincipal ? 'Principal' : 'Secundario'}
              </div>
            </div>
          </div>
        );
      })}
      {(() => {
        const total = collaborators?.length ?? 0;
        if (total > 3) {
          return (
            <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shadow-sm hover:scale-110 transition-all hover:z-20" title={`+${total - 3} más`}>
              <span className="text-[8px] font-black text-slate-500">+{total - 3}</span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

// Memoizar el componente para evitar re-renders innecesarios
const AvatarGroup = React.memo(AvatarGroupContent);

// ── STAT CARD ──────────────────────────────────────────────────────────────
function Stat({ label, value, dark }: { label: string; value: number; dark?: boolean }) {
  return (
    <div className={`rounded-xl px-5 py-4 border flex flex-col gap-0.5 ${dark ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}>
      <span className={`text-2xl font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
      <span className={`text-xs font-medium uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

// ── CARD ──────────────────────────────────────────────────────────────────
function FollowUpCard({ item, onManage, users, onNavigate, navigate, onMarkLost, isMarkingLost }: { item: FollowUpItem; onManage: (item: FollowUpItem) => void; users?: any[]; onNavigate?: (item: FollowUpItem) => void; navigate: any; onMarkLost?: (item: FollowUpItem) => void; isMarkingLost?: boolean }) {
  const lvl = getUrgency(item.next_contact_date);
  const urg = URGENCY_CONFIG[lvl as keyof typeof URGENCY_CONFIG];
  const statusStyle = getStatusStyle(item.category_color);
  const isDeal = item.entity_type === 'DEAL';

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
    onNavigate?.(item);
  };

  return (
    <div className="crm-card bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl flex flex-col cursor-pointer" onClick={handleCardClick}>
      <div className="p-5 flex-1">
        {/* Row 1: Status badge + Avatars */}
        <div className="flex justify-between items-start mb-4 overflow-visible">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border" style={{ 
            background: statusStyle.bg, 
            color: statusStyle.text, 
            borderColor: statusStyle.border,
            '--dark-bg': statusStyle.darkBg,
            '--dark-text': statusStyle.darkText,
            '--dark-border': statusStyle.darkBorder
          } as React.CSSProperties & Record<string, string>}>
            {item.category_icon ? (
              <i className={`${item.category_icon} text-xs`} />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
            )}
            {getVisibleStatusName(item)}
          </span>
          <AvatarGroup collaborators={item.collaborators} users={users} />
        </div>

        {/* Row 2: Title + Subtitle */}
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">{item.title}</h3>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <IconBuilding/>
              <span>{item.subtitle}</span>
            </div>
            {isDeal && item.contact_name && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                <IconUser/>
                <span className="font-medium">{item.contact_name}</span>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100 dark:border-slate-700 mb-4" />

        {/* Row 3: Next action (urgency box) */}
        {item.next_action_desc ? (
          <div className="border-l-4 rounded-r-lg p-3 mb-4" style={{ 
            backgroundColor: urg.bg, 
            borderColor: urg.border,
            '--dark-bg': urg.darkBg,
            '--dark-border': urg.darkBorder
          } as React.CSSProperties & Record<string, string>}>
            <div className="flex justify-between items-center mb-1">
              {(item as any).is_calendar_scheduled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                  <IconCalendar className="text-[10px]" />
                  Programado
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2" style={{ 
                  color: urg.textColor,
                  '--dark-color': urg.darkTextColor
                } as React.CSSProperties & Record<string, string>}>
                  {urg.icon}
                  {urg.label}
                </span>
              )}
              <span className="text-xs font-semibold" style={{ 
                color: urg.timeColor,
                '--dark-color': urg.darkTimeColor
              } as React.CSSProperties & Record<string, string>}>
                {fmtTime(item.next_contact_date)}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.next_action_desc}</p>
          </div>
        ) : (
          <div className="border-l-4 border-gray-200 dark:border-slate-700 rounded-r-lg p-3 mb-4 bg-gray-50 dark:bg-slate-700/30">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin próxima acción definida</p>
          </div>
        )}

        {/* Row 4: Last activity */}
        <div className="flex items-start gap-2.5">
          <div className="relative">
            {(item as any).last_management_user_avatar || (item as any).last_management_user_name ? (
              <Avatar
                src={(item as any).last_management_user_avatar || null}
                name={(item as any).last_management_user_name || 'Usuario'}
                size="xs"
                className="rounded-full border border-gray-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: (item as any).last_management_channel_color || '#d1d5db' }}>
                {(item as any).last_management_channel_icon ? (
                  <i className={`${(item as any).last_management_channel_icon} text-[10px]`} />
                ) : (
                  <IconMessage/>
                )}
              </div>
            )}
            {(item as any).last_management_channel_icon && ((item as any).last_management_user_avatar || (item as any).last_management_user_name) ? (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: (item as any).last_management_channel_color || '#6b7280' }}>
                <i className={`${(item as any).last_management_channel_icon} text-[7px]`} />
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Última actividad · {ago(item.last_management_date)}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 mt-0.5">
              {item.last_management_desc ? `"${item.last_management_desc}"` : <span className="not-italic text-gray-400 dark:text-gray-500">Sin registros previos.</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {item.phone && (
            <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp"
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-green-500 hover:border-green-200 flex items-center justify-center transition-colors">
              <IconWhatsApp/>
            </a>
          )}
          {item.email && (
            <a href={`mailto:${item.email}`} title="Correo"
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-200 flex items-center justify-center transition-colors">
              <IconMail/>
            </a>
          )}
          {!isDeal && (
            <>
              {!isClosedProspect(item) && (
                <div className="relative group/convert inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/app/deals/new', {
                        state: {
                          contactId: item.id_contact || item.id_entity,
                          companyId: item.id_client_company,
                          is_conversion: true,
                          contactName: item.title,
                          contactEmail: item.email,
                          contactPhone: item.phone,
                          companyName: item.subtitle || item.name_company
                        }
                      });
                    }}
                    className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-500 text-white flex items-center justify-center transition-all shadow-md hover:shadow-xl hover:scale-110 active:scale-95 overflow-hidden group-hover/convert:from-amber-500 group-hover/convert:via-yellow-600 group-hover/convert:to-amber-600 animate-pulse-slow">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover/convert:opacity-30 group-hover/convert:animate-shine"></div>
                    <Handshake size={16} className="relative z-10 drop-shadow-sm" />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover/convert:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                    <div className="font-bold text-amber-300">Convertir a Trato</div>
                    <div className="text-[9px] text-slate-300 dark:text-slate-400 mt-0.5">Crear negociacion desde contacto</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                </div>
              )}
              {!isDirectoryContact(item) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkLost?.(item);
                  }}
                  disabled={isMarkingLost || isClosedProspect(item)}
                  title={isClosedProspect(item) ? 'Prospección finalizada' : 'Marcar como perdido'}
                  className="w-9 h-9 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <i className="fa-solid fa-circle-xmark text-[14px]"></i>
                </button>
              )}
            </>
          )}
        </div>
        <button onClick={() => onManage(item)}
          className="flex-1 bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 active:scale-[.98] transition-all flex justify-center items-center gap-2 shadow-sm">
          Gestionar <IconArrow/>
        </button>
      </div>
    </div>
  );
}

// ── TABLE ROW ──────────────────────────────────────────────────────────────
function TableRow({ item, onManage, idx, users, onNavigate, navigate, onMarkLost, isMarkingLost }: { item: FollowUpItem; onManage: (item: FollowUpItem) => void; idx: number; users?: any[]; onNavigate?: (item: FollowUpItem) => void; navigate: any; onMarkLost?: (item: FollowUpItem) => void; isMarkingLost?: boolean }) {
  const lvl = getUrgency(item.next_contact_date);
  const urg = URGENCY_CONFIG[lvl as keyof typeof URGENCY_CONFIG];
  const statusStyle = getStatusStyle(item.category_color);
  const isDeal = item.entity_type === 'DEAL';

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
    onNavigate?.(item);
  };

  return (
    <tr className={`border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-slate-800/20' : 'dark:bg-slate-800/10'}`} onClick={handleRowClick}>
      <td className="px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <IconBuilding/>
              <span>{item.subtitle}</span>
            </div>
            {isDeal && item.contact_name && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <IconUser/>
                <span className="font-medium">{item.contact_name}</span>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border"
          style={{ background: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
          {item.current_status_name}
        </span>
      </td>
      <td className="px-5 py-4">
        {item.next_action_desc ? (
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: urg.textColor }}>
                {urg.icon} {urg.label}
              </span>
              {(item as any).is_calendar_scheduled && (
                <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap">
                  <IconCalendar/> Calendario
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{item.next_action_desc}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDateTime(item.next_contact_date)}</p>
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-500 italic">Sin accion</span>
        )}
      </td>
      <td className="px-5 py-4 min-w-[180px]">
        <AvatarGroup collaborators={item.collaborators} users={users} />
      </td>
      <td className="px-5 py-4 max-w-[200px]">
        <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
          {item.last_management_desc ? `"${item.last_management_desc}"` : <span className="not-italic text-gray-300 dark:text-gray-500">—</span>}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{ago(item.last_management_date)}</p>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2">
          {item.phone && (
            <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 hover:border-green-200 dark:hover:border-green-700 flex items-center justify-center transition-colors">
              <IconWhatsApp/>
            </a>
          )}
          {item.email && (
            <a href={`mailto:${item.email}`}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 flex items-center justify-center transition-colors">
              <IconMail/>
            </a>
          )}
          {!isDeal && (
            <>
              {!isClosedProspect(item) && (
                <div className="relative group/convert inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/app/deals/new', {
                        state: {
                          contactId: item.id_contact || item.id_entity,
                          companyId: item.id_client_company,
                          is_conversion: true,
                          contactName: item.title,
                          contactEmail: item.email,
                          contactPhone: item.phone,
                          companyName: item.subtitle || item.name_company
                        }
                      });
                    }}
                    className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-500 text-white flex items-center justify-center transition-all shadow-md hover:shadow-xl hover:scale-110 active:scale-95 overflow-hidden group-hover/convert:from-amber-500 group-hover/convert:via-yellow-600 group-hover/convert:to-amber-600 animate-pulse-slow">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover/convert:opacity-30 group-hover/convert:animate-shine"></div>
                    <Handshake size={14} className="relative z-10 drop-shadow-sm" />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover/convert:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                    <div className="font-bold text-amber-300">Convertir a Trato</div>
                    <div className="text-[9px] text-slate-300 mt-0.5">Crear negociación desde contacto</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                </div>
              )}
              {!isDirectoryContact(item) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkLost?.(item);
                  }}
                  disabled={isMarkingLost || isClosedProspect(item)}
                  title={isClosedProspect(item) ? 'Prospección finalizada' : 'Marcar como perdido'}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-700 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <i className="fa-solid fa-circle-xmark text-[12px]"></i>
                </button>
              )}
            </>
          )}
          <button onClick={() => onManage(item)}
            className="px-4 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5">
            Gestionar <IconArrow/>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────
const FollowUpsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { users: cachedUsers } = useDataCache();

  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'CONTACT' | 'DEAL'>(() => (localStorage.getItem('followups_tab') as 'ALL' | 'CONTACT' | 'DEAL') || 'ALL');
  const [view, setView] = useState<'grid' | 'table'>(() => (localStorage.getItem('followups_view') as 'grid' | 'table') || 'grid');
  const [search, setSearch] = useState('');
  const [urgFilter, setUrg] = useState('ALL');
  const [includeClosed, setIncludeClosed] = useState(() => localStorage.getItem('followups_include_closed') === 'true');
  const [managingItem, setManagingItem] = useState<FollowUpItem | null>(null);
  const [transferItem, setTransferItem] = useState<FollowUpItem | null>(null);
  const [pendingLostItem, setPendingLostItem] = useState<FollowUpItem | null>(null);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [markingLostId, setMarkingLostId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/followups`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setToast({ message: 'Error al conectar con el servidor', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    localStorage.setItem('followups_tab', tab);
  }, [tab]);

  useEffect(() => {
    localStorage.setItem('followups_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('followups_include_closed', String(includeClosed));
  }, [includeClosed]);

  const confirmMarkAsLost = useCallback(async () => {
    if (!pendingLostItem || pendingLostItem.entity_type !== 'CONTACT') {
      setPendingLostItem(null);
      setConfirmState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const contactId = pendingLostItem.id_contact || pendingLostItem.id_entity;
    if (!contactId) {
      setToast({ message: 'No se encontró el contacto para actualizar.', type: 'error' });
      setPendingLostItem(null);
      setConfirmState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setMarkingLostId(contactId);
    try {
      const payload = {
        id_contact: contactId,
        contact_status: 'DORMANT',
      };

      const res = await apiFetch(GATEWAY_CONFIG.API.CLIENTS.CONTACTS_UPDATE_STATUS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('No se pudo actualizar el prospecto.');

      setItems(prev => prev.map(current => {
        const currentId = current.id_contact || current.id_entity;
        if (currentId !== contactId) return current;
        return {
          ...current,
          contact_status: 'DORMANT',
          status_category: 'DORMANT',
          current_status_name: 'Perdido',
        } as FollowUpItem;
      }));

      setToast({ message: 'Prospecto marcado como perdido.', type: 'success' });
      setPendingLostItem(null);
      setConfirmState(prev => ({ ...prev, isOpen: false }));
      await fetchItems();
    } catch {
      setToast({ message: 'Error al marcar prospecto como perdido.', type: 'error' });
    } finally {
      setMarkingLostId(null);
    }
  }, [fetchItems, pendingLostItem]);

  const handleMarkAsLost = useCallback(async (item: FollowUpItem) => {
    if (item.entity_type !== 'CONTACT') return;
    if (isDirectoryContact(item)) {
      setToast({ message: 'Esta acción aplica solo a contactos con seguimiento activo.', type: 'error' });
      return;
    }
    if (isClosedProspect(item)) {
      setToast({ message: 'Este prospecto ya está marcado como perdido.', type: 'success' });
      return;
    }

    setPendingLostItem(item);
    setConfirmState({
      isOpen: true,
      title: 'Finalizar prospección',
      message: 'Este prospecto se marcará como Perdido y quedará como contacto simple.',
      onConfirm: () => {
        confirmMarkAsLost();
      },
      isDestructive: true,
    });
  }, [confirmMarkAsLost]);

  const base = tab === 'ALL' ? items : items.filter(i => i.entity_type === tab);

  const filtered = useMemo(() => {
    return base
      .filter(i => {
        const q = search.toLowerCase();
        if (q && !i.title?.toLowerCase().includes(q) && !i.subtitle?.toLowerCase().includes(q)) return false;
        if (!includeClosed && isClosedProspect(i)) return false;
        if (urgFilter !== 'ALL' && getUrgency(i.next_contact_date) !== urgFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.next_contact_date && !b.next_contact_date) return 0;
        if (!a.next_contact_date) return 1;
        if (!b.next_contact_date) return -1;
        return new Date(a.next_contact_date).getTime() - new Date(b.next_contact_date).getTime();
      });
  }, [base, search, urgFilter, includeClosed]);

  const counts = {
    total: base.length,
    overdue: base.filter(i => getUrgency(i.next_contact_date) === 'overdue').length,
    today: base.filter(i => getUrgency(i.next_contact_date) === 'today').length,
    upcoming: base.filter(i => getUrgency(i.next_contact_date) === 'upcoming').length,
  };

  const handleNavigateToDetails = (item: FollowUpItem) => {
    if (item.entity_type === 'DEAL') {
      navigate(`/app/deals/${item.id_entity}`);
    } else if (item.entity_type === 'CONTACT') {
      navigate(`/app/client-contacts/${item.id_entity}`);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <BrandSpinner size="lg" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* HEADER */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500">Gestiona tus próximos contactos y negociaciones pendientes.</p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total" value={counts.total} dark/>
          <Stat label="Vencidos" value={counts.overdue}/>
          <Stat label="Hoy" value={counts.today}/>
          <Stat label="Próximos" value={counts.upcoming}/>
        </div>

        {/* TOOLBAR */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-2 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
            {[
              { k: 'ALL', label: 'Todos' },
              { k: 'CONTACT', label: 'Prospectos' },
              { k: 'DEAL', label: 'Negociaciones' },
            ].map(t => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as 'ALL' | 'CONTACT' | 'DEAL')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-md text-sm font-semibold transition-all ${
                  tab === t.k ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Urgency pills */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                ['ALL', 'Todos'],
                ['overdue', 'Vencidos'],
                ['today', 'Hoy'],
                ['upcoming', 'Próximos'],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setUrg(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    urgFilter === k
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIncludeClosed(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                includeClosed
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {includeClosed ? 'Ocultando perdidos' : 'Mostrar perdidos'}
            </button>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                <IconSearch/>
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contacto o empresa..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-600 transition-all placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* View toggle */}
            <div className="flex border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`px-3 py-2.5 text-sm transition-colors ${
                  view === 'grid' ? 'bg-gray-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
              >
                ⊞
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-3 py-2.5 text-sm transition-colors border-l border-gray-200 dark:border-slate-700 ${
                  view === 'table' ? 'bg-gray-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
              >
                ≡
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl py-20 text-center">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">Sin seguimientos pendientes</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Todo al dia por el momento!</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(item => (
              <FollowUpCard
                key={item.id_entity}
                item={item}
                onManage={setManagingItem}
                users={cachedUsers}
                onNavigate={handleNavigateToDetails}
                navigate={navigate}
                onMarkLost={handleMarkAsLost}
                isMarkingLost={markingLostId === (item.id_contact || item.id_entity)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    {['Cliente', 'Estado', 'Proxima accion', 'Equipo', 'Ultima gestion', ''].map((h, i) => (
                      <th key={i} className="px-5 py-3.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <TableRow
                      key={item.id_entity}
                      item={item}
                      onManage={setManagingItem}
                      idx={idx}
                      users={cachedUsers}
                      onNavigate={handleNavigateToDetails}
                      navigate={navigate}
                      onMarkLost={handleMarkAsLost}
                      isMarkingLost={markingLostId === (item.id_contact || item.id_entity)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALES */}
      {managingItem && (
        <NewInteractionModal
          isOpen={!!managingItem}
          onClose={() => setManagingItem(null)}
          entityId={managingItem.entity_type === 'DEAL'
            ? (managingItem.id_entity || (managingItem as any).id_trato || '')
            : (managingItem.id_entity || (managingItem as any).id_contact || '')}
          entityType={managingItem.entity_type}
          contactEmail={managingItem.email}
          contactName={(managingItem as any).contact_name || (managingItem as any).contact_full_name || managingItem.title || 'Contacto'}
          collaborators={(managingItem as any).collaborators || []}
          useEventModalCapture={true}
          eventCaptureDeal={managingItem.entity_type === 'DEAL' ? {
            id_trato: managingItem.id_entity || (managingItem as any).id_trato || '',
            nombre_trato: (managingItem as any).nombre_trato || managingItem.title,
            id_client_company: (managingItem as any).id_client_company || '',
            client_company_name: (managingItem as any).client_company_name || managingItem.subtitle || '',
            contact_name: (managingItem as any).contact_name || (managingItem as any).contact_full_name || '',
          } : undefined}
          onSuccess={() => {
            setManagingItem(null);
            fetchItems();
            setToast({ message: 'Gestión guardada exitosamente', type: 'success' });
          }}
        />
      )}

      {transferItem && (
        <ReassignModal
          isOpen={!!transferItem}
          contact={transferItem as any}
          users={cachedUsers}
          onClose={() => setTransferItem(null)}
          onSuccess={() => {
            setTransferItem(null);
            fetchItems();
            setToast({ message: 'Responsable actualizado correctamente', type: 'success' });
          }}
        />
      )}

      <ConfirmModal
        {...confirmState}
        onClose={() => {
          if (!markingLostId) {
            setPendingLostItem(null);
            setConfirmState(prev => ({ ...prev, isOpen: false }));
          }
        }}
        onConfirm={confirmMarkAsLost}
        confirmText={markingLostId ? 'Procesando...' : 'Marcar perdido'}
        cancelText="Cancelar"
        isDestructive={confirmState.isDestructive}
      />
    </div>
  );
};

export default FollowUpsPage;
