import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Deal, DealStatus } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';

import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import SelectWinningQuoteModal from '../../components/SelectWinningQuoteModal';
import NewInteractionForm from '../../components/NewInteractionForm';
import Avatar from '../../components/Avatar';
import DealActionsMenu from '../../components/DealActionsMenu';
import { EventDetailModal } from '../calendar/EventDetail';

const getInitials = (n?: string) => n ? n.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?';

const formatCurrency = (val: string | number | undefined) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const SYSTEM_CATEGORY_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  PROGRESS: '#10b981',
  PAUSED: '#f59e0b',
  WON: '#3b82f6',
  LOST: '#ef4444',
};

const splitDateTime = (value?: string) => {
  if (!value) return { date: '', time: '' };
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { date: parts[0], time: parts[1] };
  }
  return { date: value, time: '' };
};

const formatHistoryDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatHistoryTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const parseCommonDate = (value?: string) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const isoCandidate = new Date(raw);
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate;

  const dmYhm = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (dmYhm) {
    const [, dd, mm, yyyy, hh = '00', mi = '00'] = dmYhm;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
};

const toReadableDate = (value?: string) => {
  const parsed = parseCommonDate(value);
  if (!parsed) return value || '';
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const toReadableTime = (value?: string) => {
  const parsed = parseCommonDate(value);
  if (!parsed) return '';
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
};

const normalizeHistoryResponse = (raw: any) => {
  const groups = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.history)
      ? raw.history
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  return groups.map((group: any) => ({
    group_id: group?.group_id || '',
    group_name: group?.group_name || 'Historial',
    interactions: (Array.isArray(group?.interactions) ? group.interactions : []).map((item: any) => ({
      calendar_info: item?.calendar_info || {},
      is_calendar_scheduled: Boolean(
        item?.is_calendar_scheduled
        || item?.calendar_synced
        || item?.calendar_sync_status === 'SYNCED'
        || item?.calendar_info?.scheduled
        || item?.calendar_info?.synced
        || item?.calendar_info?.event_id
      ),
      ...item,
      date_fmt: toReadableDate(item?.date_fmt) || formatHistoryDate(item?.date_iso),
      time_fmt: item?.time_fmt || toReadableTime(item?.date_fmt) || formatHistoryTime(item?.date_iso),
      time_ago_text: item?.time_ago_text || '',
      planned_date: item?.planned_date || formatHistoryDate(item?.planned_date_iso),
      channel_name: item?.channel_name || '',
      channel_icon: item?.channel_icon || '',
      channel_color: item?.channel_color || '',
    })),
  }));
};

const DealDetailSkeleton = () => (
  <div className="min-h-screen bg-[#F9F9F8] p-8 animate-pulse space-y-8">
    <div className="h-20 bg-white rounded-xl border border-zinc-200"></div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-4 h-96 bg-white rounded-xl border border-zinc-200"></div>
      <div className="col-span-8 h-96 bg-white rounded-xl border border-zinc-200"></div>
    </div>
  </div>
);

const StatusSelector: React.FC<{ currentStatusId: string; statuses: DealStatus[]; onSelect: (id: string) => void; disabled: boolean; }> = ({ currentStatusId, statuses, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const current = statuses.find(s => s.id_status === currentStatusId) || { id_status: '', name: 'Sin valor', color: '#94a3b8', icon: 'fa-solid fa-circle', notify_client: false };

  const renderNotifyBadge = () => (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">
      <i className="fa-solid fa-envelope text-[8px]" />
    </span>
  );

  const currentIndex = statuses.findIndex(s => s.id_status === currentStatusId);
  const statusesAbove = currentIndex > 0 ? statuses.slice(0, currentIndex) : [];
  const statusesBelow = currentIndex < statuses.length - 1 ? statuses.slice(currentIndex + 1) : [];

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition(window.innerHeight - rect.bottom < 200 && rect.top > 200 ? 'top' : 'bottom');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex max-w-full items-center align-middle" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
        className={`
          inline-flex items-center gap-1.5 px-2 py-0.5 min-h-[20px] rounded text-[10px] font-semibold
          transition-all whitespace-nowrap
          ${disabled ? 'cursor-default' : 'hover:brightness-95 cursor-pointer'}
        `}
        style={{ backgroundColor: current.color || '#94a3b8', color: '#ffffff' }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
            <i className={`${current.icon || 'fa-solid fa-circle'} text-[9px] leading-none`} />
          </span>
          <span>{current.name || 'Sin valor'}</span>
          {(current as any).notify_client && (
            <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none text-white">
              <i className="fa-solid fa-envelope text-[8px] leading-none" />
            </span>
          )}
        </div>
        {!disabled && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-0.5 text-white">
            <i className="fa-solid fa-chevron-down text-[7px] leading-none" />
          </span>
        )}
      </button>

      {isOpen && !disabled && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} 
            left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {statusesAbove.map(s => (
              <button
                key={s.id_status}
                onClick={(e) => { e.stopPropagation(); onSelect(s.id_status); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: s.color || '#94a3b8' }}>
                  <i className={`${s.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{s.name}</span>
                {s.notify_client && renderNotifyBadge()}
              </button>
            ))}
            <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
              <div className="flex items-center gap-2 text-slate-500 cursor-not-allowed">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: current.color || '#94a3b8' }}>
                  <i className={`${current.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{current.name || 'Sin valor'}</span>
                {(current as any).notify_client && renderNotifyBadge()}
                <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" />
              </div>
            </div>
            {statusesBelow.map(s => (
              <button
                key={s.id_status}
                onClick={(e) => { e.stopPropagation(); onSelect(s.id_status); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: s.color || '#94a3b8' }}>
                  <i className={`${s.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{s.name}</span>
                {s.notify_client && renderNotifyBadge()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InterestSelector: React.FC<{ currentInterestId: string; interests: any[]; onSelect: (id: string) => void; disabled: boolean; }> = ({ currentInterestId, interests, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const current = interests.find(i => i.id_interest === currentInterestId) || { id_interest: '', name: 'Sin valor', icon: 'fa-solid fa-circle', color: '#94a3b8' };

  const currentIndex = interests.findIndex(i => i.id_interest === currentInterestId);
  const interestsAbove = currentIndex > 0 ? interests.slice(0, currentIndex) : [];
  const interestsBelow = currentIndex < interests.length - 1 ? interests.slice(currentIndex + 1) : [];

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition(window.innerHeight - rect.bottom < 200 && rect.top > 200 ? 'top' : 'bottom');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex max-w-full items-center align-middle" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
        className={`
          inline-flex items-center gap-1.5 px-2 py-0.5 min-h-[20px] rounded text-[10px] font-semibold
          transition-all whitespace-nowrap
          ${disabled ? 'cursor-default' : 'hover:brightness-95 cursor-pointer'}
        `}
        style={{ backgroundColor: current.color || '#94a3b8', color: '#ffffff' }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
            <i className={`${current.icon || 'fa-solid fa-circle'} text-[9px] leading-none`} />
          </span>
          <span>{current.name || 'Sin valor'}</span>
        </div>
        {!disabled && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-0.5 text-white">
            <i className="fa-solid fa-chevron-down text-[7px] leading-none" />
          </span>
        )}
      </button>

      {isOpen && !disabled && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} 
            left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {interestsAbove.map(i => (
              <button
                key={i.id_interest}
                onClick={(e) => { e.stopPropagation(); onSelect(i.id_interest); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: i.color || '#94a3b8' }}>
                  <i className={`${i.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{i.name || 'Sin valor'}</span>
              </button>
            ))}
            <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
              <div className="flex items-center gap-2 text-slate-500 cursor-not-allowed">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: current.color || '#94a3b8' }}>
                  <i className={`${current.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{current.name || 'Sin valor'}</span>
                <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" />
              </div>
            </div>
            {interestsBelow.map(i => (
              <button
                key={i.id_interest}
                onClick={(e) => { e.stopPropagation(); onSelect(i.id_interest); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: i.color || '#94a3b8' }}>
                  <i className={`${i.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{i.name || 'Sin valor'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DealDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dealStatuses: cachedDealStatuses,
    dealInterests: cachedDealInterests,
    dealChannels: cachedDealChannels,
    users: cachedUsers,
  } = useDataCache();
  
  const id = useParams<{ id: string }>().id || new URLSearchParams(location.search).get('id');

  const [deal, setDeal] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'quotes' | 'files'>('activity');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const[history, setHistory] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [activityView, setActivityView] = useState<'ALL' | 'INTERACTIONS' | 'EMAILS'>('ALL');
  const [refreshTimelineKey, setRefreshTimelineKey] = useState(0);
  const[confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '' as React.ReactNode, onConfirm: () => {}, onCancel: () => {} });
  const [selectWinnerModal, setSelectWinnerModal] = useState({ isOpen: false, pendingStatusId: '' });
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [loadingEventDetail, setLoadingEventDetail] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any[] | null>(null);

  const getChannelDisplay = useCallback((channelValue: unknown) => {
    if (channelValue === null || channelValue === undefined) {
      return { name: '', icon: '' };
    }

    const raw = String(channelValue).trim();
    if (!raw) {
      return { name: '', icon: '' };
    }

    const channelMatch = cachedDealChannels?.find((c: any) => {
      const id = String(c.id_channel || c.id || '').trim();
      const channelName = String(c.name || c.channel_name || '').trim();
      return id === raw || channelName.toUpperCase() === raw.toUpperCase();
    });

    if (channelMatch) {
      const channelMatchAny = channelMatch as any;
      return {
        name: channelMatch.name || channelMatchAny.channel_name || raw,
        icon: channelMatch.icon || channelMatchAny.channel_icon || '',
      };
    }

    return { name: raw, icon: '' };
  }, [cachedDealChannels]);

  const refreshShareCollaborators = useCallback(async () => {
    if (!deal) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${deal.id_trato}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list.map((u: any) => {
        const cachedUser = cachedUsers?.find((cu: any) => String(cu.id_user) === String(u.id_user));
        return {
          id_user: u.id_user,
          name: u.name || u.name_user || cachedUser?.name_user || cachedUser?.email_user || u.id_user,
          avatar: u.avatar || u.avatar_url || cachedUser?.avatar_url || null,
          permission_level: (u.permission_level || '').toUpperCase() || 'VIEW',
          rol_user: u.rol_user || cachedUser?.rol_user,
          is_owner: Boolean(u.is_owner || (u.permission_level || '').toUpperCase() === 'OWNER'),
        };
      });
      setShareCollaborators(mapped);
    } catch { setShareCollaborators([]); }
  }, [deal, cachedUsers]);

  const refreshDealCollaborators = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) return;
      const parsed = JSON.parse(await res.text());
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      const mapped = (payload?.collaborators || []).map((c: any) => ({
        id_user: c.id_user,
        name: c.name || c.name_user || c.id_user,
        avatar: c.avatar || c.avatar_url || null,
        permission_level: (c.permission_level || '').toUpperCase() || 'VIEW',
        is_owner: Boolean(c.is_owner || (c.permission_level || '').toUpperCase() === 'OWNER'),
      }));

      setDeal((prev: any) => (prev ? { ...prev, collaborators: mapped } : prev));
      setShareCollaborators(mapped);
    } catch {
      // Keep UI state if refresh fails.
    }
  }, [id, user]);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      const parsed = JSON.parse(await res.text());
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!payload) { setDeal(null); return; }

      const channelDisplay = getChannelDisplay(payload.channel);
      const mappedCollaborators = (payload.collaborators || []).map((c: any) => ({
        id_user: c.id_user,
        name: c.name || c.name_user || c.id_user,
        avatar: c.avatar || c.avatar_url || null,
        permission_level: (c.permission_level || '').toUpperCase() || 'VIEW',
        is_owner: Boolean(c.is_owner || (c.permission_level || '').toUpperCase() === 'OWNER'),
      }));

      const mappedStatuses: DealStatus[] = Array.isArray(payload.catalogo_estados)
        ? payload.catalogo_estados.map((s: any, idx: number) => ({
            id_status: s.id_status || s.id || '',
            id_tenant: s.id_tenant || user.id_tenant,
            name: s.name || '',
            color: s.color || '#94a3b8',
            status_order: s.status_order ?? idx,
            icon: s.icon || 'fa-solid fa-circle',
            is_default: Boolean(s.is_default),
            status_category: s.status_category || s.category,
            notify_client: Boolean(s.notify_client),
          }))
        : [];

      const mappedDeal = {
        ...payload,
        archived: Boolean(payload.archived),
        id_client_company: payload.company_details?.id || payload.id_client_company || '',
        id_contact: payload.contact_details?.id || payload.id_contact || '',
        id_deal_status: payload.estado_actual?.id || payload.id_deal_status || '',
        id_interest: payload.interes_actual?.id || payload.id_interest || '',
        owner_name: payload.owner_details?.name || payload.owner_name || '',
        owner_avatar: payload.owner_details?.avatar || payload.owner_avatar || '',
        client_company_name: payload.company_details?.name || payload.client_company_name || '',
        contact_full_name: payload.contact_details?.full_name || payload.contact_full_name || '',
        contact_email: payload.contact_details?.email || payload.contact_email || '',
        company_details: payload.company_details || {},
        contact_details: payload.contact_details || {},
        owner_details: payload.owner_details || {},
        timeline_info: payload.timeline_info || {},
        estado_actual: {
          id: payload.estado_actual?.id || '',
          name: payload.estado_actual?.name || 'Sin estado',
          color: payload.estado_actual?.color || '#94a3b8',
          category: payload.estado_actual?.category || 'PROGRESS',
          icon: payload.estado_actual?.icon || 'fa-solid fa-circle',
        },
        interes_actual: {
          id: payload.interes_actual?.id || '',
          icon: payload.interes_actual?.icon || 'fa-solid fa-circle',
          name: payload.interes_actual?.name || 'Sin interés',
          color: payload.interes_actual?.color || '#94a3b8',
        },
        channel_display: channelDisplay.name,
        channel_icon: channelDisplay.icon,
        collaborators: mappedCollaborators,
      };

      setDeal(mappedDeal);
      setQuotes(Array.isArray(payload.cotizaciones_activas) ? payload.cotizaciones_activas : []);
      const normalizedEmails = Array.isArray(payload.historial_envios)
        ? payload.historial_envios.map((em: any) => ({
            ...em,
            fecha_human: toReadableDate(em?.fecha_fmt || em?.fecha),
            time_human: em?.time_fmt || toReadableTime(em?.fecha_fmt || em?.fecha),
          }))
        : [];
      setEmailHistory(normalizedEmails);
      setDealStatuses(mappedStatuses.length ? mappedStatuses : cachedDealStatuses);
      setShareCollaborators(mappedCollaborators);
    } catch { setDeal(null); } finally { setLoading(false); }
  },[id, user, cachedDealStatuses, getChannelDisplay]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const historyUrl = buildUrl(GATEWAY_CONFIG.API.DEALS.HISTORY, {
        id_trato: id,
        include_calendar_sync_status: true,
        include_calendar_info: true,
        _ts: Date.now(),
      });
      const res = await apiFetch(historyUrl, { cache: 'no-store' });
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : [];
      setHistory(normalizeHistoryResponse(parsed));
    } catch { setHistory([]); }
  }, [id]);

  const openEventDetail = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setLoadingEventDetail(true);
    setIsEventDetailOpen(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/detail?id_event=${encodeURIComponent(eventId)}`);
      if (!res.ok) throw new Error('No se pudo cargar el detalle del evento');
      const data = await res.json();
      setSelectedEventDetail(Array.isArray(data) ? data : [data]);
    } catch {
      setSelectedEventDetail(null);
      setToast({ message: 'No se pudo abrir el detalle del evento.', type: 'error' });
      setIsEventDetailOpen(false);
    } finally {
      setLoadingEventDetail(false);
    }
  }, []);

  const handleRSVPFromDealDetail = useCallback(async (action: 'accepted' | 'declined' | 'tentative') => {
    const event = selectedEventDetail?.[0];
    const eventId = event?.id || event?.id_event;
    if (!eventId) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_evento: eventId, response: action }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar tu respuesta');
      await openEventDetail(String(eventId));
      setToast({ message: 'Respuesta al evento actualizada.', type: 'success' });
    } catch {
      setToast({ message: 'Error al responder el evento.', type: 'error' });
    }
  }, [selectedEventDetail, openEventDetail]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchHistory(); }, [fetchHistory, refreshTimelineKey]);
  useEffect(() => {
    if (!refreshTimelineKey) return;
    const timer = window.setTimeout(() => {
      fetchHistory();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [refreshTimelineKey, fetchHistory]);
  useEffect(() => { if (location.state?.refresh) fetchData(); }, [location.state, fetchData]);

  const handleStatusChange = (newStatusId: string) => {
    if (!deal || newStatusId === deal.estado_actual?.id) return;
    const newStatus = dealStatuses.find(s => s.id_status === newStatusId);
    if ((newStatus?.status_category === 'WON' || newStatus?.name?.toUpperCase().includes('GANADO')) && quotes.length > 0) {
      setSelectWinnerModal({ isOpen: true, pendingStatusId: newStatusId });
      return;
    }
    setConfirmState({
      isOpen: true,
      title: 'Actualizar Estado',
      message: (
        <div className="space-y-3 text-sm">
          <p>¿Cambiar el estado del trato a <span className="font-bold">"{newStatus?.name}"</span>?</p>
        </div>
      ),
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: newStatusId, id_tenant: user?.id_tenant, id_user: user?.id_user })
          });
          if (!res.ok) throw new Error();
          setDeal((prev: any) => prev ? {
            ...prev,
            id_deal_status: newStatusId,
            estado_actual: {
              ...(prev.estado_actual || {}),
              id: newStatusId,
              name: newStatus?.name || prev.estado_actual?.name,
              color: newStatus?.color || prev.estado_actual?.color,
              category: newStatus?.status_category || prev.estado_actual?.category,
            },
          } : null);
          setToast({ message: 'Estado actualizado.', type: 'success' });
        } catch { setToast({ message: 'Error al actualizar el estado.', type: 'error' }); } finally { setProcessing(false); }
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleInterestChange = (newInterestId: string) => {
    if (!deal) return;
    const newInterest = cachedDealInterests?.find((i: any) => i.id_interest === newInterestId);
    setConfirmState({
      isOpen: true, title: 'Actualizar Interés', message: `¿Cambiar interés a "${newInterest?.name}"?`,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/interest/deals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: deal.id_trato, id_interest: newInterestId, id_tenant: user?.id_tenant, id_user: user?.id_user })
          });
          setDeal((prev: any) => prev ? {
            ...prev,
            id_interest: newInterestId,
            interes_actual: {
              ...(prev.interes_actual || {}),
              id: newInterestId,
              name: newInterest?.name || prev.interes_actual?.name,
              icon: newInterest?.icon || prev.interes_actual?.icon,
              color: newInterest?.color || prev.interes_actual?.color,
            },
          } : null);
          setToast({ message: 'Interés actualizado.', type: 'success' });
        } catch { setToast({ message: 'Error al actualizar.', type: 'error' }); } finally { setProcessing(false); }
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleWinningQuoteConfirm = async (selectedQuoteId: string, createInCartera: boolean) => {
    if (!deal || !selectWinnerModal.pendingStatusId || !user?.id_user) return;
    setSelectWinnerModal({ isOpen: false, pendingStatusId: '' });
    setProcessing(true);
    try {
      const resStatus = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: selectWinnerModal.pendingStatusId, id_user: user.id_user, id_cotizacion: selectedQuoteId })
      });
      if (!resStatus.ok) throw new Error();
      await fetchData();
      setToast({ message: 'Cotización ganadora registrada.', type: 'success' });
      if (createInCartera) setTimeout(() => navigate(`/app/financials/new?from_deal=${deal.id_trato}&quote_id=${selectedQuoteId}&client_id=${deal.id_client_company}`), 500);
    } catch { setToast({ message: 'Error al procesar victoria.', type: 'error' }); } finally { setProcessing(false); }
  };

  const handleArchiveDeal = async (targetDeal: Deal) => {
    try {
      await apiFetch(GATEWAY_CONFIG.API.DEALS.ARCHIVED, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_trato: targetDeal.id_trato,
          id_tenant: user?.id_tenant,
          id_user: user?.id_user,
          archived: !targetDeal.archived,
        }),
      });

      setDeal((prev: any) => (prev ? { ...prev, archived: !Boolean(prev.archived) } : prev));
      setToast({
        message: targetDeal.archived ? 'Trato desarchivado.' : 'Trato archivado.',
        type: 'success',
      });
    } catch {
      setToast({ message: 'Error al archivar el trato.', type: 'error' });
    }
  };

  const handleDeleteDeal = (idToDelete: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar trato',
      message: '¿Estás seguro? Esta acción es irreversible.',
      onConfirm: async () => {
        try {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: idToDelete, id_tenant: user?.id_tenant, id_user: user?.id_user }),
          });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          navigate('/app/deals');
        } catch {
          setToast({ message: 'Error al eliminar el trato.', type: 'error' });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false })),
    });
  };

  if (loading) return <DealDetailSkeleton />;
  if (!deal) return <div className="flex h-screen items-center justify-center text-zinc-500 font-medium">Trato no encontrado.</div>;

  const canEdit = deal.access_level === 'EDIT' || user?.rol_user === 'admin';
  const effectiveStatuses = (dealStatuses && dealStatuses.length > 0) ? dealStatuses : (cachedDealStatuses || []);
  const statusFromCache = effectiveStatuses.find((s: any) =>
    String(s.id_status || '').trim() === String(deal.id_deal_status || deal.estado_actual?.id || '').trim() ||
    String(s.name || '').toUpperCase() === String(deal.estado_actual?.name || '').toUpperCase()
  );
  const effectiveStatus = {
    id: statusFromCache?.id_status || deal.estado_actual?.id || '',
    name: statusFromCache?.name || deal.estado_actual?.name || 'Sin valor',
    color: statusFromCache?.color || deal.estado_actual?.color || '#94a3b8',
    icon: statusFromCache?.icon || deal.estado_actual?.icon || 'fa-solid fa-circle',
    category: statusFromCache?.status_category || deal.estado_actual?.category || 'PROGRESS',
    notify_client: Boolean(statusFromCache?.notify_client),
  };

  const interestFromCache = (cachedDealInterests || []).find((i: any) =>
    String(i.id_interest || '').trim() === String(deal.id_interest || deal.interes_actual?.id || '').trim() ||
    String(i.name || '').toUpperCase() === String(deal.interes_actual?.name || '').toUpperCase()
  );
  const effectiveInterest = {
    id: interestFromCache?.id_interest || deal.interes_actual?.id || '',
    name: interestFromCache?.name || deal.interes_actual?.name || 'Sin valor',
    icon: interestFromCache?.icon || deal.interes_actual?.icon || 'fa-solid fa-circle',
    color: interestFromCache?.color || deal.interes_actual?.color || '#94a3b8',
  };

  const channelBase = getChannelDisplay(deal.channel_display || deal.channel);
  const channelFromCache = (cachedDealChannels || []).find((c: any) =>
    String(c.id_channel || '').trim() === String(deal.channel || '').trim() ||
    String(c.name || '').toUpperCase() === String(channelBase.name || '').toUpperCase() ||
    String(c.name || '').toUpperCase() === String(deal.channel || '').toUpperCase()
  );
  const effectiveChannel = {
    name: channelFromCache?.name || channelBase.name || '',
    icon: channelFromCache?.icon || channelBase.icon || '',
    color: channelFromCache?.color || '#94a3b8',
  };

  const pipelineCats = ['DRAFT', 'PROGRESS', 'PAUSED', 'WON', 'LOST'];
  const currentCat = String(effectiveStatus.category || 'PROGRESS').toUpperCase();
  const catIndex = pipelineCats.indexOf(currentCat);
  const channelLabel = effectiveChannel.name || 'Sin valor';
  const channelIcon = effectiveChannel.icon || (String(channelLabel).toUpperCase().includes('WHATSAPP') ? 'fa-brands fa-whatsapp' : '');
  const createdFromFmt = splitDateTime(deal.timeline_info?.created_at_fmt || deal.created_at_fmt);
  const updatedFromFmt = splitDateTime(deal.timeline_info?.updated_at_fmt || deal.updated_at_fmt);
  const createdDateLabel =
    deal.timeline_info?.created_at_human ||
    createdFromFmt.date ||
    '-';
  const updatedDateLabel =
    deal.timeline_info?.updated_at_human ||
    updatedFromFmt.date ||
    '-';
  const createdTimeLabel =
    deal.timeline_info?.created_time ||
    createdFromFmt.time ||
    '';
  const updatedTimeLabel =
    deal.timeline_info?.updated_time ||
    updatedFromFmt.time ||
    '';
  const showInteractions = activityView !== 'EMAILS';
  const showEmails = activityView !== 'INTERACTIONS';
  const hasInteractions = history.length > 0;
  const hasEmails = emailHistory.length > 0;
  const interactionCount = history.reduce((acc: number, group: any) => acc + (Array.isArray(group?.interactions) ? group.interactions.length : 0), 0);
  const emailCount = emailHistory.length;
  const totalActivityCount = interactionCount + emailCount;
  const contactEmail = deal.contact_details?.email || deal.contact_email || '';
  const contactPhoneRaw = deal.contact_details?.phone || '';
  const contactPhoneDigits = String(contactPhoneRaw).replace(/\D/g, '');
  const whatsappHref = contactPhoneDigits ? `https://wa.me/${contactPhoneDigits}` : '';
  const pipelineLabel = (cat: string) => (
    cat === 'DRAFT' ? 'Borrador' :
    cat === 'PROGRESS' ? 'En Progreso' :
    cat === 'PAUSED' ? 'Pausado' :
    cat === 'WON' ? 'Ganado' :
    'Perdido'
  );

  return (
    <div className="min-h-screen bg-[#F9F9F8] text-zinc-800 pb-20 font-sans selection:bg-orange-100 selection:text-orange-900">
      
      {/* HEADER */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight truncate">{deal.nombre_trato}</h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border shadow-sm"
                  style={{
                    backgroundColor: effectiveStatus.color || '#94a3b8',
                    borderColor: effectiveStatus.color || '#94a3b8',
                    color: '#ffffff',
                  }}
                >
                  <i className={`${effectiveStatus.icon || 'fa-solid fa-circle'} text-[9px]`} />
                  <span>{effectiveStatus.name || 'Sin valor'}</span>
                  {effectiveStatus.notify_client && <i className="fa-solid fa-envelope text-[8px]" />}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
              <div className="text-left sm:text-right mr-2">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Valor</div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {formatCurrency(deal.valor_numeric).split('.')[0]}<span className="text-zinc-400 text-lg">.{formatCurrency(deal.valor_numeric).split('.')[1] || '00'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsShareOpen(true); refreshShareCollaborators(); }} className="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm" title="Compartir">
                  <i className="fa-solid fa-share-nodes text-[13px]"></i>
                </button>
                <button onClick={() => navigate(`/app/deals/edit?id=${deal.id_trato}`)} className="h-9 px-4 bg-zinc-900 text-white rounded-md font-medium text-[13px] hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
                  <i className="fa-solid fa-pen text-[11px]"></i> Editar
                </button>
                <DealActionsMenu
                  deal={deal as Deal}
                  user={user}
                  onEdit={(targetDeal) => navigate(`/app/deals/edit?id=${targetDeal.id_trato}`)}
                  onShare={() => { setIsShareOpen(true); refreshShareCollaborators(); }}
                  onArchive={handleArchiveDeal}
                  onDelete={handleDeleteDeal}
                  anchor="auto-right"
                  triggerClassName="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* PIPELINE */}
          <div className="mt-5 hidden md:block overflow-x-auto overflow-y-visible scrollbar-hide">
            <div className="flex min-w-[700px] gap-2.5">
              {pipelineCats.map((cat, idx) => {
                const isActive = idx === catIndex;
                const isCompleted = idx < catIndex && currentCat !== 'LOST'; // Si está perdido, no marca verde los siguientes

                const activeColor = SYSTEM_CATEGORY_COLORS[currentCat] || '#10b981';
                const completedColor = SYSTEM_CATEGORY_COLORS[cat] || '#6b7280';

                return (
                  <div key={cat} className={`flex-${isActive ? '[1.5]' : '1'} group cursor-pointer`}>
                    <div className="h-1.5 w-full rounded-full mb-2 relative" style={{ backgroundColor: isCompleted ? completedColor : isActive ? activeColor : '#e4e4e7' }}>
                       {isActive && <div className="absolute inset-0 rounded-full" style={{ backgroundColor: activeColor }}></div>}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${isActive ? 'font-bold text-zinc-900' : 'text-zinc-400'}`}>
                      {isCompleted && <i className="fa-solid fa-circle-check text-zinc-400"></i>}
                      {!isCompleted && !isActive && <i className="fa-regular fa-circle text-[10px]"></i>}
                      {isActive && (
                        <span
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
                          style={{
                            borderColor: activeColor,
                            backgroundColor: `${activeColor}22`,
                          }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeColor }}></span>
                        </span>
                      )}
                      <span style={isActive ? { color: activeColor } : undefined}>{pipelineLabel(cat)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 md:hidden">
            <div className="space-y-3">
              {pipelineCats.map((cat, idx) => {
                const isActive = idx === catIndex;
                const isCompleted = idx < catIndex && currentCat !== 'LOST';
                const activeColor = SYSTEM_CATEGORY_COLORS[currentCat] || '#10b981';
                const completedColor = SYSTEM_CATEGORY_COLORS[cat] || '#6b7280';

                return (
                  <div key={`mobile-${cat}`} className="relative pl-6">
                    <span className={`absolute left-[6px] top-0 h-full w-[1px] ${idx === pipelineCats.length - 1 ? 'hidden' : 'block'}`} style={{ backgroundColor: '#e4e4e7' }}></span>
                    <div className="relative flex items-center gap-2">
                      <span
                        className="absolute -left-6 mt-0.5 flex h-3 w-3 items-center justify-center rounded-full border"
                        style={{
                          backgroundColor: isActive ? activeColor : isCompleted ? completedColor : '#ffffff',
                          borderColor: isActive ? activeColor : isCompleted ? completedColor : '#d4d4d8',
                        }}
                      ></span>
                      <span className={`text-[12px] font-semibold uppercase tracking-wide ${isActive ? 'font-bold' : isCompleted ? 'text-zinc-700' : 'text-zinc-400'}`} style={isActive ? { color: activeColor } : undefined}>
                        {pipelineLabel(cat)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-5 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* ASIDE PROPIEDADES */}
        <aside className="lg:col-span-4 space-y-8">
          
          {deal.deal_description && (
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Descripción</h3>
              <p className="text-[13px] text-zinc-700 leading-relaxed bg-white border border-zinc-200 p-3 rounded-lg shadow-sm whitespace-pre-wrap">
                {deal.deal_description}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Acerca del trato</span>
            </h3>
            <div className="space-y-1">
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-building w-4 text-center"></i> Empresa</div>
                <div className="w-2/3 text-zinc-900 text-[13px] font-medium truncate">
                  <Link to={`/app/client-companies/${deal.id_client_company}`} className="inline-flex max-w-full items-center rounded px-1 py-0.5 text-zinc-900 transition-colors hover:bg-zinc-100 no-underline hover:no-underline">
                    <span className="truncate">{deal.company_details?.name || deal.client_company_name}</span>
                  </Link>
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-user w-4 text-center"></i> Contacto</div>
                <div className="w-2/3 min-w-0 flex items-center gap-2 text-zinc-900 text-[13px] font-medium">
                  <div className="min-w-0 truncate">
                    {deal.id_contact ? (
                      <Link to={`/app/client-contacts/${deal.id_contact}`} className="inline-flex max-w-full items-center rounded px-1 py-0.5 text-zinc-900 transition-colors hover:bg-zinc-100 no-underline hover:no-underline">
                        <span className="truncate">{deal.contact_details?.full_name || deal.contact_full_name || 'Sin contacto'}</span>
                      </Link>
                    ) : (
                      <span className="text-zinc-500">{deal.contact_details?.full_name || deal.contact_full_name || 'Sin contacto'}</span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-6 h-6 inline-flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Escribir por WhatsApp"
                      >
                        <i className="fa-brands fa-whatsapp text-[12px]" />
                      </a>
                    )}
                    {contactEmail && (
                      <a
                        href={`mailto:${contactEmail}`}
                        className="w-6 h-6 inline-flex items-center justify-center rounded text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Enviar correo"
                      >
                        <i className="fa-regular fa-envelope text-[11px]" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-envelope w-4 text-center"></i> Email</div>
                <div className="w-2/3 text-zinc-600 text-[13px] truncate">
                  <a href={`mailto:${deal.contact_details?.email || deal.contact_email}`} className="inline-flex max-w-full items-center rounded px-1 py-0.5 text-zinc-600 transition-colors hover:bg-zinc-100 no-underline hover:no-underline">
                    <span className="truncate">{deal.contact_details?.email || deal.contact_email || 'Sin correo'}</span>
                  </a>
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-solid fa-bullhorn w-4 text-center"></i> Origen</div>
                <div className="w-2/3 flex items-center gap-1.5 text-zinc-700 text-[13px]">
                  {channelIcon ? <i className={`${channelIcon} text-[12px]`} style={{ color: effectiveChannel.color }}></i> : null}
                  {channelLabel}
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-solid fa-bars-progress w-4 text-center"></i> Estado</div>
                <div className="w-2/3 flex items-center gap-2 min-h-[24px]">
                  <StatusSelector currentStatusId={effectiveStatus.id || ''} statuses={effectiveStatuses} onSelect={handleStatusChange} disabled={!canEdit || processing} />
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-star w-4 text-center"></i> Interés</div>
                <div className="w-2/3 flex items-center gap-2 min-h-[24px] text-zinc-700 text-[13px]">
                   <InterestSelector currentInterestId={effectiveInterest.id || ''} interests={cachedDealInterests || []} onSelect={handleInterestChange} disabled={!canEdit || processing} />
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors mt-2">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-calendar-plus w-4 text-center"></i> Creación</div>
                <div className="w-2/3 text-zinc-700 text-[13px]">
                  <span className="text-zinc-500">{createdDateLabel}{createdTimeLabel ? `  • ${createdTimeLabel}` : ''}</span>
                </div>
              </div>
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2"><i className="fa-regular fa-calendar-check w-4 text-center"></i> Updated</div>
                <div className="w-2/3 text-zinc-700 text-[13px]">
                  <span className="text-zinc-500">{updatedDateLabel}{updatedTimeLabel ? `  • ${updatedTimeLabel}` : ''}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Equipo asignado
            </h3>
            <div className="space-y-2.5 text-left">
              {(deal.collaborators || [])
                .slice()
                .sort((a: any, b: any) => {
                  const rank = (c: any) => {
                    const level = String(c?.permission_level || '').toUpperCase();
                    if (level === 'OWNER' || c?.is_owner) return 0;
                    if (level === 'EDIT') return 1;
                    if (level === 'VIEW') return 2;
                    return 3;
                  };
                  return rank(a) - rank(b);
                })
                .map((collab: any) => {
                  const level = String(collab.permission_level || '').toUpperCase();
                  const isOwner = level === 'OWNER' || collab.is_owner;
                  const roleText = isOwner ? 'Propietario' : level === 'EDIT' ? 'Principal' : 'Secundario';
                  const isCurrentUser = String(collab.id_user || '') === String(user?.id_user || '');

                  return (
                    <div
                      key={collab.id_user}
                      className="flex items-center justify-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm"
                    >
                      <div className="shrink-0 w-9 h-9 flex items-center justify-center self-center">
                        <Avatar
                          src={collab.avatar || null}
                          name={collab.name || collab.id_user || 'Usuario'}
                          size="sm"
                          enableHoverZoom
                          hoverScale={1.05}
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[13px] font-semibold text-zinc-900 truncate">
                          {collab.name || collab.id_user}
                          {isCurrentUser && <span className="text-zinc-400 font-medium"> (Tú)</span>}
                        </p>
                        <p className="text-[12px] text-zinc-500 leading-tight">{roleText}</p>
                      </div>
                    </div>
                  );
                })}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => { setIsShareOpen(true); refreshShareCollaborators(); }}
                  className="w-full mt-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-left hover:bg-zinc-100 transition-colors"
                >
                  <span className="inline-flex items-center justify-start gap-2 text-zinc-500">
                    <span className="w-6 h-6 rounded-full bg-zinc-200/70 text-zinc-600 inline-flex items-center justify-center">
                      <i className="fa-solid fa-plus text-[11px]"></i>
                    </span>
                    <span className="text-[13px] font-medium">Asignar colaborador...</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* TABS DERECHA */}
        <section className="lg:col-span-8 relative">
          <div className="flex gap-6 border-b border-zinc-200 mb-6 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('activity')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 ${activeTab === 'activity' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>Muro de Actividad</button>
            <button onClick={() => setActiveTab('quotes')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'quotes' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>Cotizaciones <span className="bg-zinc-100 text-zinc-600 px-1.5 rounded-full text-[10px] font-semibold">{quotes.length}</span></button>
            <button onClick={() => setActiveTab('files')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 ${activeTab === 'files' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>Archivos</button>
          </div>

          {/* TAB: MURO DE ACTIVIDAD (DISEÑO EXACTO) */}
          {activeTab === 'activity' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <NewInteractionForm
                  entityId={deal.id_trato}
                  entityType="DEAL"
                  contactEmail={deal.contact_details?.email || deal.contact_email}
                  contactName={deal.contact_details?.full_name || deal.contact_full_name || ''}
                  collaborators={deal.collaborators || []}
                  useEventModalCapture={true}
                  eventCaptureDeal={{
                    id_trato: deal.id_trato,
                    nombre_trato: deal.nombre_trato,
                    id_client_company: deal.id_client_company,
                    client_company_name: deal.client_company_name,
                    contact_name: deal.contact_details?.full_name || deal.contact_full_name || '',
                  }}
                  onSuccess={() => {
                    setRefreshTimelineKey(prev => prev + 1);
                    setToast({ message: 'Gestión registrada.', type: 'success' });
                  }}
                />
              </div>

              <div className="mb-4 flex items-center gap-2">
                {[
                  { key: 'ALL', label: 'Todo', count: totalActivityCount },
                  { key: 'INTERACTIONS', label: 'Interacciones', count: interactionCount },
                  { key: 'EMAILS', label: 'Envios', count: emailCount },
                ].map((seg) => {
                  const isActive = activityView === seg.key;
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      onClick={() => setActivityView(seg.key as 'ALL' | 'INTERACTIONS' | 'EMAILS')}
                      className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                        isActive
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800'
                      }`}
                    >
                      <span>{seg.label}</span>
                      <span
                        className={`ml-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {seg.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:w-[1px] before:bg-zinc-200">
                {activityView === 'INTERACTIONS' && !hasInteractions && (
                  <p className="pl-10 text-[13px] text-zinc-400 italic">No hay interacciones registradas.</p>
                )}
                {activityView === 'EMAILS' && !hasEmails && (
                  <p className="pl-10 text-[13px] text-zinc-400 italic">No hay envios registrados.</p>
                )}
                {activityView === 'ALL' && !hasInteractions && !hasEmails && (
                  <p className="pl-10 text-[13px] text-zinc-400 italic">No hay actividad registrada.</p>
                )}

                {/* HISTORIAL API */}
                {showInteractions && history.map((g: any, gIdx: number) => (
                  <React.Fragment key={g.group_id || gIdx}>
                    <div className="relative pl-10 pt-1 mb-1">
                      <div className="absolute left-[-4px] top-3 w-[39px] h-[1px] bg-zinc-200"></div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-zinc-200 text-zinc-600 shadow-sm relative z-10 uppercase">
                        {g.group_name}
                      </span>
                    </div>

                    {g.interactions?.map((item: any) => {
                      const isSystem = item.type === 'SYSTEM';
                      const isWhatsapp = item.channel_name?.toUpperCase() === 'WHATSAPP';
                      return (
                        <div key={item.id} className="relative pl-10 group mb-4">
                          {/* AVATAR FLOTANTE IZQUIERDA */}
                          <div className="absolute left-0 top-2 w-8 h-8 rounded-full border border-zinc-200 bg-white overflow-hidden z-10 shadow-sm flex items-center justify-center text-zinc-400">
                            {isSystem ? <i className="fa-solid fa-code-branch text-[11px]"></i> : (item.user_avatar ? <img src={item.user_avatar} alt="av" className="w-full h-full object-cover" /> : <span className="text-[10px] font-medium">{getInitials(item.user_name)}</span>)}
                          </div>
                          
                          {/* CONTENEDOR MENSAJE DERECHA */}
                          {isSystem ? (
                            <div className="py-1.5">
                              <p className="text-[11px] text-zinc-400 font-normal tracking-[0.01em] mb-0.5">{item.date_fmt || '-'}{item.time_fmt ? ` • ${item.time_fmt}` : ''}{item.time_ago_text ? ` • hace ${item.time_ago_text}` : ''}</p>
                              <p className="text-[13px] text-zinc-600">{item.description}</p>
                            </div>
                          ) : (
                            <div className={`bg-white border rounded-xl p-3 sm:p-4 shadow-sm transition-shadow relative ${isWhatsapp ? 'border-emerald-200' : 'border-zinc-200'}`}>
                              {isWhatsapp && (
                                <div className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-sm border-2 border-white" title="WhatsApp"><i className="fa-brands fa-whatsapp text-[12px]"></i></div>
                              )}
                              <div className="flex justify-between items-start gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                                <p className="text-[13px] font-semibold text-zinc-900 truncate">{item.user_name || 'Usuario'}</p>
                                <div className="text-right text-[11px] text-zinc-400 font-normal tracking-[0.01em] whitespace-nowrap shrink-0">
                                  <span className="md:hidden">{item.date_fmt || '-'}</span>
                                  <span className="hidden md:inline">
                                    {item.date_fmt || '-'}
                                    {item.time_fmt ? ` • ${item.time_fmt}` : ''}
                                    {item.time_ago_text ? ` • hace ${item.time_ago_text}` : ''}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[13px] text-zinc-700 leading-[1.45] whitespace-pre-line">{item.description}</p>
                              
                              {/* TAREA PLANIFICADA O VENCIDA */}
                              {(item.planned_action || item.planned_date) && (
                                <div
                                  className={`rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 mt-2.5 sm:mt-3 border ${
                                    item.is_planned_overdue
                                      ? 'bg-red-50 border-red-100'
                                      : item.is_calendar_scheduled
                                        ? 'bg-emerald-50 border-emerald-100'
                                        : 'bg-blue-50 border-blue-100'
                                  }`}
                                >
                                  {(() => {
                                    const eventId =
                                      item?.calendar_info?.id_evento
                                      || item?.calendar_info?.id_event
                                      || item?.calendar_info?.event_id
                                      || item?.id_evento
                                      || item?.id_event;

                                    return (
                                      <div className="flex items-center justify-between gap-2 mb-0.5 sm:mb-1">
                                        <p
                                          className={`text-[12px] leading-[1.35] ${
                                            item.is_planned_overdue
                                              ? 'text-red-900'
                                              : item.is_calendar_scheduled
                                                ? 'text-emerald-900'
                                                : 'text-blue-900'
                                          }`}
                                        >
                                          {item.planned_action || ''}
                                        </p>
                                        {eventId ? (
                                          <button
                                            type="button"
                                            onClick={() => openEventDetail(String(eventId))}
                                            className={`text-[11px] font-semibold bg-white border px-2 py-0.5 rounded inline-flex items-center justify-center gap-1 whitespace-nowrap hover:brightness-95 transition-colors ${
                                              item.is_planned_overdue
                                                ? 'text-red-600 border-red-200'
                                                : item.is_calendar_scheduled
                                                  ? 'text-emerald-600 border-emerald-200'
                                                  : 'text-blue-600 border-blue-200'
                                            }`}
                                            title="Ver detalle del evento"
                                          >
                                            <i className={`fa-regular ${item.is_calendar_scheduled ? 'fa-calendar-check' : 'fa-calendar'} text-[10px]`}></i>
                                            {item.planned_date}
                                          </button>
                                        ) : (
                                          <span
                                            className={`text-[11px] font-semibold bg-white border px-2 py-0.5 rounded inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                                              item.is_planned_overdue
                                                ? 'text-red-600 border-red-200'
                                                : item.is_calendar_scheduled
                                                  ? 'text-emerald-600 border-emerald-200'
                                                  : 'text-blue-600 border-blue-200'
                                            }`}
                                          >
                                            <i className={`fa-regular ${item.is_calendar_scheduled ? 'fa-calendar-check' : 'fa-calendar'} text-[10px]`}></i>
                                            {item.planned_date}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* CORREOS ENVIADOS */}
                {showEmails && emailHistory.map((em: any, idx: number) => (
                  <div key={em.id_sent || idx} className="relative pl-10 pt-1 mb-4 group">
                    <div className="absolute left-0 top-2.5 w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center z-10 text-blue-500 shadow-sm"><i className="fa-regular fa-envelope text-[11px]"></i></div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:border-zinc-300 transition-colors relative">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 pr-2">
                          <p className="text-[13px] text-zinc-900"><span className="font-semibold">{em.enviado_por_name || 'Usuario'}</span> envio cotizacion a <a href={`mailto:${em.enviado_a}`} className="text-blue-600 font-medium hover:underline">{em.enviado_a}</a></p>
                        </div>
                        <div className="text-right text-[11px] text-zinc-400 font-normal tracking-[0.01em] whitespace-nowrap shrink-0">
                          <span className="md:hidden">{em.fecha_human || toReadableDate(em.fecha_fmt || em.fecha) || '-'}</span>
                          <span className="hidden md:inline">
                            {em.fecha_human || toReadableDate(em.fecha_fmt || em.fecha) || '-'}
                            {em.time_human ? ` • ${em.time_human}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 rounded-md p-2.5 text-[12px]">
                        <p className="font-semibold text-zinc-800 mb-1">Asunto: {em.subject}</p>
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 shadow-sm rounded text-zinc-700 font-medium hover:bg-zinc-50 hover:text-sky-600 cursor-pointer transition-colors">
                            <i className="fa-solid fa-file-invoice-dollar text-zinc-400"></i> Ver Cotización (v{em.version_no || em.version || 1})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: COTIZACIONES */}
          {activeTab === 'quotes' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-zinc-900">Documentos Financieros</h3>
                {canEdit && (
                  <button onClick={() => navigate(`/app/quotes/new?dealId=${deal.id_trato}&clientCompanyId=${deal.id_client_company}&contactId=${deal.id_contact}&dealName=${encodeURIComponent(deal.nombre_trato || '')}`)} className="text-[12px] font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
                    <i className="fa-solid fa-plus text-[10px]"></i> Nueva Cotización
                  </button>
                )}
              </div>
              {quotes.length > 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-6 md:col-span-5">Cotización</div><div className="col-span-3 hidden md:block">Fecha / Valor</div><div className="col-span-3">Estado</div><div className="col-span-3 md:col-span-1 text-right"></div>
                  </div>
                  {quotes.map(q => {
                    const isRej = q.estado_name?.toUpperCase() === 'RECHAZADO' || q.estado?.toUpperCase() === 'RECHAZADO';
                    const isApp = q.estado_name?.toUpperCase() === 'APROBADO' || q.estado?.toUpperCase() === 'APROBADO';
                    return (
                      <div key={q.id || q.id_cotizacion} onClick={() => navigate(`/app/quotes/${q.id || q.id_cotizacion}`)} className={`grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-zinc-100 hover:bg-zinc-50 transition-colors group cursor-pointer last:border-0 ${isRej ? 'bg-red-50' : ''}`}>
                        <div className="col-span-6 md:col-span-5 flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-md bg-white border border-zinc-200 shadow-sm flex items-center justify-center shrink-0 ${isApp ? 'text-emerald-500 group-hover:border-emerald-200' : isRej ? 'text-red-500 group-hover:border-red-200' : 'text-zinc-400 group-hover:text-sky-500 group-hover:border-sky-200'}`}><i className="fa-solid fa-file-invoice-dollar"></i></div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-[13px] font-bold truncate ${isRej ? 'text-zinc-600 line-through group-hover:text-red-600' : isApp ? 'text-zinc-900 group-hover:text-emerald-600' : 'text-zinc-900 group-hover:text-sky-600'}`}>COT-{q.numero || q.formatted_no_cotizacion}</div>
                            <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1.5 mt-0.5"><span className="font-mono bg-zinc-100 border border-zinc-200 px-1 rounded text-[9px] font-bold text-zinc-600">v{q.version || 1}</span>{q.nombre || q.nombre_cotizacion || 'Sin título'}</div>
                          </div>
                        </div>
                        <div className="col-span-3 hidden md:block"><div className="text-[12px] text-zinc-500 font-medium">{q.fecha || q.fecha_emision}</div><div className={`text-[13px] font-bold mt-0.5 ${isRej ? 'text-zinc-400' : 'text-zinc-900'}`}>{formatCurrency(q.total)}</div></div>
                        <div className="col-span-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${isApp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isRej ? 'bg-red-50 text-red-600 border-red-100' : 'bg-sky-50 text-sky-700 border-sky-100'}`}>{q.estado_name || q.estado}</span>
                          <div className="text-[12px] font-bold text-zinc-900 mt-1 md:hidden">{formatCurrency(q.total)}</div>
                        </div>
                        <div className="col-span-3 md:col-span-1 text-right"><button className="text-zinc-400 hover:text-zinc-900 w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 transition-colors"><i className="fa-solid fa-chevron-right text-[11px]"></i></button></div>
                      </div>
                    );
                  })}
                </div>
              ) : (<div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl p-12 text-center text-zinc-500"><i className="fa-solid fa-file-invoice-dollar text-2xl text-zinc-300 mb-3"></i><p className="text-[13px] font-medium">No hay cotizaciones activas.</p></div>)}
            </div>
          )}

         {/* TAB 3: ARCHIVOS */}
          {activeTab === 'files' && (
            <div className="animate-fade-in">
              <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 rounded-xl p-12 text-center hover:bg-zinc-100 transition-colors hover:border-zinc-400 cursor-pointer">
                 <div className="w-12 h-12 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center mx-auto mb-3 text-zinc-400 group-hover:text-blue-500 transition-colors">
                   <i className="fa-solid fa-cloud-arrow-up"></i>
                 </div>
                 <h3 className="text-[14px] font-semibold text-zinc-900 mb-1">Sube archivos adjuntos</h3>
                 <p className="text-[13px] text-zinc-500">Arrastra PDFs, órdenes de compra o especificaciones técnicas aquí.</p>
              </div>
            </div>
          )}
          
        </section>
      </main>

      {/* --- MODALES --- */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      {confirmState.isOpen && (
        <ConfirmModal 
          isOpen={confirmState.isOpen} 
          title={confirmState.title} 
          message={confirmState.message} 
          onConfirm={confirmState.onConfirm} 
          onClose={confirmState.onCancel} 
        />
      )}

      {selectWinnerModal.isOpen && (
        <SelectWinningQuoteModal 
          isOpen={selectWinnerModal.isOpen} 
          onClose={() => setSelectWinnerModal({ isOpen: false, pendingStatusId: '' })} 
          onConfirm={handleWinningQuoteConfirm} 
          quotes={quotes} 
          dealName={deal.nombre_trato || ''} 
          hasCarteraAccess={user?.module_access?.financials || user?.rol_user === 'admin'} 
        />
      )}

      {isShareOpen && (
        <ShareModal 
          entity="deal" 
          id={deal.id_trato} 
          entityName={deal.nombre_trato || ''} 
          creatorName={deal.owner_details?.name || deal.owner_name || ''} 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          onShared={() => { 
            setToast({ message: 'Asignaciones actualizadas.', type: 'success' }); 
            refreshShareCollaborators(); 
            refreshDealCollaborators(); 
          }} 
          currentCollaborators={shareCollaborators} 
        />
      )}

      <EventDetailModal
        isOpen={isEventDetailOpen}
        loadingDetail={loadingEventDetail}
        selectedEventDetail={selectedEventDetail}
        currentUserEmail={user?.email_user}
        onClose={() => {
          setIsEventDetailOpen(false);
          setSelectedEventDetail(null);
        }}
        onEdit={(event) => {
          const eventId = (event as any)?.id || (event as any)?.id_event;
          if (!eventId) return;
          navigate(`/app/calendar?eventId=${encodeURIComponent(String(eventId))}`);
        }}
        onDeleteClick={() => {
          setToast({ message: 'Eliminación disponible desde la vista de calendario.', type: 'error' });
        }}
        onRSVPClick={handleRSVPFromDealDetail}
      />
    </div>
  );
};

export default DealDetail;