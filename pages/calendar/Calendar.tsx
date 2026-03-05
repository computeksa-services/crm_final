import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { CalendarEvent, ClientCompany, ClientContact, User, Deal, Quote } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../services/apiClient';
import { PermissionGuard } from '../../src/components/PermissionGuard';
import { useCalendarPermission } from '../../src/hooks/useCalendarPermission';

import { MonthView, WeekView, DayView } from './CalendarViews';
import { EventModal } from './EventModal';
import { EventDetailModal } from './EventDetail';
import { DeleteConfirmModal, RSVPConfirmModal, ConfirmChangesModal } from './ConfirmModals';
import { UpcomingEventsPanel } from './UpcomingEventsPanel';

// ── TYPES ────────────────────────────────────────────────────────────────────
type ViewMode = 'day' | 'week' | 'month';

interface Attendee {
  email: string;
  name?: string;
  type: 'contact' | 'user' | 'external';
  id?: string;
  is_organizer?: boolean;
}

interface FormData {
  title: string;
  description: string;
  start: string;
  end: string;
  is_all_day: boolean;
  location: string;
  generate_meeting: boolean;
  id_trato: string;
  id_client_company: string;
}

const EMPTY_FORM: FormData = {
  title: '', description: '', start: '', end: '',
  is_all_day: false, location: '', generate_meeting: false,
  id_trato: '', id_client_company: '',
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const formatForInput = (d: Date): string => {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const h  = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dy}T${h}:${mi}`;
};

const formatLocalDatetime = (ds: string): string => {
  const d = new Date(ds);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getDateRange = (currentDate: Date, viewMode: ViewMode) => {
  let startDate: Date, endDate: Date;
  if (viewMode === 'day') {
    startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);
    endDate   = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
  } else if (viewMode === 'week') {
    const clone = new Date(currentDate);
    const day   = clone.getDay();
    clone.setDate(clone.getDate() - day + (day === 0 ? -6 : 1));
    clone.setHours(0, 0, 0, 0);
    startDate = new Date(clone);
    endDate   = new Date(clone);
    endDate.setDate(clone.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    startDate = new Date(year, month, 1, 0, 0, 0);
    endDate   = new Date(year, month + 1, 0, 23, 59, 59);
  }
  return { start: startDate.toISOString(), end: endDate.toISOString() };
};

const getDateRangeLabel = (currentDate: Date, viewMode: ViewMode): string => {
  const days   = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const d = currentDate;

  if (viewMode === 'day') {
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } else if (viewMode === 'week') {
    const clone = new Date(d);
    const day   = clone.getDay();
    clone.setDate(clone.getDate() - day + (day === 0 ? -6 : 1));
    const start = new Date(clone);
    const end   = new Date(clone);
    end.setDate(clone.getDate() + 6);
    // Si mismo mes: "1 – 7 mar 2026", si distinto mes: "28 feb – 6 mar 2026"
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  }
  // month
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

const extractDeals = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first) {
      if (Array.isArray(first?.response?.tratos)) return first.response.tratos;
      if (Array.isArray(first?.data?.tratos))     return first.data.tratos;
      if (Array.isArray(first?.tratos))            return first.tratos;
    }
    if (raw.every((it: any) => it?.id_trato || it?.nombre_trato)) return raw;
    return [];
  }
  if (Array.isArray(raw?.response?.tratos)) return raw.response.tratos;
  if (Array.isArray(raw?.data?.tratos))     return raw.data.tratos;
  if (Array.isArray(raw?.tratos))           return raw.tratos;
  return [];
};

const normalizeDeal = (d: any): Deal => ({
  id_trato:            d.id_trato,
  nombre_trato:        d.nombre_trato,
  client_company_name: d.empresa_nombre ?? d.client_company_name ?? d.empresa_cliente?.name,
  id_client_company:   d.id_client_company ?? d.empresa_id ?? d.id_empresa ?? d.empresa_cliente?.id ?? '',
  id_contact:          d.id_contact ?? d.contacto_id ?? d.id_contacto ?? '',
  valor_trato:         d.valor_numeric ?? d.valor_trato ?? 0,
  id_deal_status:      d.estado_id ?? d.id_deal_status ?? d.id_estado ?? d.estado_actual?.id ?? '',
  estado_nombre:       d.estado_nombre ?? d.estado_actual?.name,
  estado_color:        d.estado_actual?.color,
  id_user:             d.id_owner ?? d.id_user ?? d.owner_id,
  owner_name:          d.owner_details?.name ?? d.owner_name,
  created_at_fmt:      d.created_at_fmt ?? d.created_at,
  contact_name:        d.contacto_nombre ?? d.contact_name,
} as unknown as Deal);

// ── SIDEBAR NAV BUTTON ────────────────────────────────────────────────────────
// Botón de vista para el sidebar desktop — más refinado que un toggle plano
const ViewTab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150
      ${active
        ? 'bg-white text-slate-800 shadow-sm'
        : 'text-slate-500 hover:text-slate-700'
      }`}
  >
    {label}
  </button>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const Calendar: React.FC = () => {
  const { user } = useAuth();
  const { grantCalendar } = useCalendarPermission(user!);

  // ── State ──────────────────────────────────────────────────────────────────
  const [events,              setEvents]             = useState<CalendarEvent[]>([]);
  const [upcomingEventsData,  setUpcomingEventsData] = useState<CalendarEvent[]>([]);
  const [contacts,            setContacts]           = useState<ClientContact[]>([]);
  const [users,               setUsers]              = useState<User[]>([]);
  const [deals,               setDeals]              = useState<Deal[]>([]);
  const [dealsLoading,        setDealsLoading]       = useState(false);
  const [dealsLoaded,         setDealsLoaded]        = useState(false);
  const [loading,             setLoading]            = useState(true);
  const [isSyncing,           setIsSyncing]          = useState(false);

  const [currentDate, setCurrentDateState] = useState<Date>(() => {
    try { const s = localStorage.getItem('calendar-current-date'); return s ? new Date(s) : new Date(); }
    catch { return new Date(); }
  });

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('calendar-view-mode') as ViewMode) || 'day'; }
    catch { return 'day'; }
  });

  // Modal state
  const [isModalOpen,             setIsModalOpen]             = useState(false);
  const [isEditing,               setIsEditing]               = useState(false);
  const [editingEventId,          setEditingEventId]          = useState<string | null>(null);
  const [submitting,              setSubmitting]              = useState(false);
  const [deleting,                setDeleting]                = useState(false);
  const [showDeleteConfirm,       setShowDeleteConfirm]       = useState(false);
  const [formData,                setFormData]                = useState<FormData>(EMPTY_FORM);
  const [attendees,               setAttendees]               = useState<Attendee[]>([]);
  const [attendeeInput,           setAttendeeInput]           = useState('');
  const [showAttendeeSuggestions, setShowAttendeeSuggestions] = useState(false);
  const [dealSearchInput,         setDealSearchInput]         = useState('');
  const [showDealSuggestions,     setShowDealSuggestions]     = useState(false);
  const [selectedDeal,            setSelectedDeal]            = useState<Deal | null>(null);
  const [autoAddedAttendees,      setAutoAddedAttendees]      = useState<string[]>([]);
  const [showConfirmChanges,      setShowConfirmChanges]      = useState(false);
  const [originalEventData,       setOriginalEventData]       = useState<any>(null);

  // Detail modal state
  const [isDetailModalOpen,   setIsDetailModalOpen]   = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any>(null);
  const [loadingDetail,       setLoadingDetail]       = useState(false);
  const [showRSVPConfirm,     setShowRSVPConfirm]     = useState(false);
  const [rsvpAction,          setRSVPAction]          = useState<'accepted' | 'declined' | 'tentative' | null>(null);
  const [submittingRSVP,      setSubmittingRSVP]      = useState(false);

  const dealsRef = useRef<Deal[]>(deals);
  useEffect(() => { dealsRef.current = deals; }, [deals]);

  // ── Setters con persistencia ───────────────────────────────────────────────
  const setCurrentDate = useCallback((date: Date | ((prev: Date) => Date)) => {
    setCurrentDateState(prev => {
      const next = typeof date === 'function' ? date(prev) : date;
      try { localStorage.setItem('calendar-current-date', next.toISOString()); } catch {}
      return next;
    });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try { localStorage.setItem('calendar-view-mode', mode); } catch {}
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.deal-search-container'))     setShowDealSuggestions(false);
      if (!t.closest('.attendee-search-container')) setShowAttendeeSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetchData();
    fetchUpcomingEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode, user]);

  // ── Navegación ─────────────────────────────────────────────────────────────
  const navigate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'day')       d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
      else if (viewMode === 'week') d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
      else                          d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
      return d;
    });
  }, [viewMode, setCurrentDate]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), [setCurrentDate]);

  const switchToCurrentView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    goToToday();
  }, [setViewMode, goToToday]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getUpcomingEvents = useCallback(() => {
    const now           = new Date();
    const today         = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow      = new Date(today.getTime() + 86400000);
    const endOfWeek     = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    const endOfNextWeek = new Date(endOfWeek.getTime() + 7 * 86400000);

    const sorted = upcomingEventsData
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const grouped = {
      today: [] as CalendarEvent[], tomorrow: [] as CalendarEvent[],
      thisWeek: [] as CalendarEvent[], nextWeek: [] as CalendarEvent[],
    };
    sorted.forEach(event => {
      const s        = new Date(event.start);
      const eventDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      if      (eventDay.getTime() === today.getTime())    grouped.today.push(event);
      else if (eventDay.getTime() === tomorrow.getTime()) grouped.tomorrow.push(event);
      else if (s <= endOfWeek)                            grouped.thisWeek.push(event);
      else if (s <= endOfNextWeek)                        grouped.nextWeek.push(event);
    });
    return grouped;
  }, [upcomingEventsData]);

  const getAttendeeSuggestions = useCallback((): Attendee[] => {
    const alreadyAdded = attendees.map(a => a.email);
    if (!attendeeInput) {
      const suggestions: Attendee[] = [];
      users.filter(u => u.id_user !== user?.id_user && !alreadyAdded.includes(u.email_user)).slice(0, 2)
        .forEach(u => suggestions.push({ email: u.email_user, name: u.name_user, type: 'user', id: u.id_user }));
      contacts.filter(c => c.email && !alreadyAdded.includes(c.email)).slice(0, 2)
        .forEach(c => suggestions.push({ email: c.email, name: `${c.first_name} ${c.last_name}`, type: 'contact', id: c.id_contact }));
      return suggestions.slice(0, 4);
    }
    const search = attendeeInput.toLowerCase();
    const suggestions: Attendee[] = [];
    contacts
      .filter(c => c.email && !alreadyAdded.includes(c.email) &&
        (c.email.toLowerCase().includes(search) || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search)))
      .slice(0, 2)
      .forEach(c => suggestions.push({
        email: c.email,
        name: `${c.first_name} ${c.last_name}${c.client_company_name ? ` (${c.client_company_name})` : ''}`,
        type: 'contact', id: c.id_contact,
      }));
    users
      .filter(u => u.id_user !== user?.id_user && !alreadyAdded.includes(u.email_user) &&
        (u.email_user.toLowerCase().includes(search) || u.name_user.toLowerCase().includes(search)))
      .slice(0, 2)
      .forEach(u => suggestions.push({ email: u.email_user, name: u.name_user, type: 'user', id: u.id_user }));
    return suggestions.slice(0, 4);
  }, [attendees, attendeeInput, users, contacts, user?.id_user]);

  const getContactsByCompany = useCallback((companyId: string) =>
    contacts.filter(c => c.id_client_company === companyId),
  [contacts]);

  const getEventChanges = useCallback((): string[] => {
    if (!originalEventData) return [];
    const changes: string[] = [];
    if (formData.title       !== originalEventData.title)       changes.push(`Título: "${originalEventData.title}" → "${formData.title}"`);
    if (formData.description !== originalEventData.description) changes.push(`Descripción: ${originalEventData.description ? `"${originalEventData.description}"` : 'vacía'} → "${formData.description}"`);
    if (formData.start       !== originalEventData.start)       changes.push(`Fecha inicio: ${new Date(originalEventData.start).toLocaleString('es-ES')} → ${new Date(formData.start).toLocaleString('es-ES')}`);
    if (formData.end         !== originalEventData.end)         changes.push(`Fecha fin: ${new Date(originalEventData.end).toLocaleString('es-ES')} → ${new Date(formData.end).toLocaleString('es-ES')}`);
    if (formData.location    !== originalEventData.location)    changes.push(`Ubicación: ${originalEventData.location || 'sin ubicación'} → ${formData.location || 'sin ubicación'}`);
    if (formData.is_all_day  !== originalEventData.is_all_day)  changes.push(`Todo el día: ${originalEventData.is_all_day ? 'Sí' : 'No'} → ${formData.is_all_day ? 'Sí' : 'No'}`);
    const oldDealId = originalEventData.id_trato || '';
    const newDealId = formData.id_trato || '';
    if (oldDealId !== newDealId) {
      const oldDeal = dealsRef.current.find(d => d.id_trato === oldDealId);
      const newDeal = dealsRef.current.find(d => d.id_trato === newDealId);
      changes.push(`Trato: ${oldDeal?.nombre_trato || oldDealId || 'sin trato'} → ${newDeal?.nombre_trato || newDealId || 'sin trato'}`);
    }
    const oldEmails = (originalEventData.attendees as any[]).map((a: any) => a.email).sort();
    const newEmails = attendees.map(a => a.email).sort();
    if (JSON.stringify(oldEmails) !== JSON.stringify(newEmails)) {
      const added   = newEmails.filter(e => !oldEmails.includes(e));
      const removed = oldEmails.filter((e: string) => !newEmails.includes(e));
      if (added.length)   changes.push(`Asistentes agregados: ${added.join(', ')}`);
      if (removed.length) changes.push(`Asistentes eliminados: ${removed.join(', ')}`);
    }
    return changes;
  }, [originalEventData, formData, attendees]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchUpcomingEvents = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    const now   = new Date();
    const start = now.toISOString();
    const end   = new Date(now.getTime() + 7 * 86400000).toISOString();
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (res.ok) { const t = await res.text(); if (t.trim()) setUpcomingEventsData(JSON.parse(t)); }
    } catch (e) { console.error('fetchUpcomingEvents:', e); }
  }, [user?.id_tenant, user?.id_user]);

  const fetchDeals = useCallback(async (): Promise<Deal[]> => {
    if (dealsLoaded || !user?.id_tenant || !user?.id_user) return [];
    setDealsLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Error fetching deals');
      const text = await res.text();
      if (!text.trim()) return [];
      const normalized: Deal[] = extractDeals(JSON.parse(text))
        .map(normalizeDeal)
        .sort((a: any, b: any) => {
          const dA = a.created_at_fmt ? new Date(a.created_at_fmt).getTime() : 0;
          const dB = b.created_at_fmt ? new Date(b.created_at_fmt).getTime() : 0;
          return dB - dA;
        })
        .slice(0, 50);
      setDeals(normalized);
      return normalized;
    } catch (e) {
      console.error('fetchDeals:', e);
      return [];
    } finally {
      setDealsLoading(false);
      setDealsLoaded(true);
    }
  }, [dealsLoaded, user?.id_tenant, user?.id_user]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    const { start, end } = getDateRange(currentDate, viewMode);
    const baseUrl        = import.meta.env.VITE_WEBHOOK_URL;
    const parseRes       = async (res: Response) => {
      if (!res.ok) return [];
      const t = await res.text();
      return t.trim() ? JSON.parse(t) : [];
    };
    try {
      setLoading(true);
      const [eventsRes, contactsRes, usersRes] = await Promise.all([
        apiFetch(`${baseUrl}/api/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
        apiFetch(`${baseUrl}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${baseUrl}/api/users?id_tenant=${user.id_tenant}`),
      ]);
      setEvents(await parseRes(eventsRes));
      setContacts(await parseRes(contactsRes));
      setUsers(await parseRes(usersRes));
    } catch (e) { console.error('fetchData fast:', e); }
    finally { setLoading(false); }

    setIsSyncing(true);
    try {
      const syncRes = await apiFetch(`${baseUrl}/api/calendar/sync?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&id_user=${user.id_user}&id_tenant=${user.id_tenant}`);
      if (syncRes.ok) {
        const updatedRes = await apiFetch(`${baseUrl}/api/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        if (updatedRes.ok) { const t = await updatedRes.text(); if (t.trim()) setEvents(JSON.parse(t)); }
      }
    } catch (e) { console.error('fetchData sync:', e); }
    finally { setIsSyncing(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode, user]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleOpenModal = useCallback((clickedDate?: Date, clickedHour?: number) => {
    setIsEditing(false); setEditingEventId(null);
    const now = clickedDate instanceof Date ? new Date(clickedDate) : new Date();
    if (clickedHour !== undefined) now.setHours(clickedHour, 0, 0, 0);
    const endDate = new Date(now.getTime() + (clickedHour !== undefined ? 60 : 120) * 60000);
    setFormData({ ...EMPTY_FORM, start: formatForInput(now), end: formatForInput(endDate) });
    setAttendees([]); setAttendeeInput(''); setSelectedDeal(null);
    setDealSearchInput(''); setShowDealSuggestions(false);
    setShowAttendeeSuggestions(false); setAutoAddedAttendees([]);
    setIsModalOpen(true);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  }, []);

  const addAttendee = useCallback((attendee: Attendee) => {
    setAttendees(prev => {
      if (prev.find(a => a.email === attendee.email)) return prev;
      return [...prev, attendee];
    });
    setAttendeeInput('');
    setShowAttendeeSuggestions(false);
  }, []);

  const handleDealChange = useCallback((dealId: string, currentDeals: Deal[]) => {
    setFormData(prev => ({ ...prev, id_trato: dealId }));
    setAutoAddedAttendees(prev => {
      if (prev.length) setAttendees(atts => atts.filter(a => !prev.includes(a.email)));
      return [];
    });
    if (!dealId || !currentDeals.length) return;
    const deal = currentDeals.find(d => d.id_trato === dealId);
    if (!deal) return;
    const newAutoAdded: string[] = [];
    if (deal.id_contact) {
      const contact = contacts.find(c => c.id_contact === deal.id_contact);
      if (contact?.email) {
        addAttendee({ email: contact.email, name: `${contact.first_name} ${contact.last_name}`, type: 'contact', id: contact.id_contact });
        newAutoAdded.push(contact.email);
      }
    }
    if (deal.id_user && deal.id_user !== user?.id_user) {
      const creator = users.find(u => u.id_user === deal.id_user);
      if (creator) {
        addAttendee({ email: creator.email_user, name: creator.name_user, type: 'user', id: creator.id_user });
        newAutoAdded.push(creator.email_user);
      }
    }
    if (newAutoAdded.length) setAutoAddedAttendees(newAutoAdded);
  }, [contacts, users, user?.id_user, addAttendee]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      const changes = getEventChanges();
      if (!changes.length) { alert('No se detectaron cambios en el evento'); return; }
      setShowConfirmChanges(true);
    } else {
      await handleCreateEvent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, getEventChanges]);

  const handleCreateEvent = useCallback(async () => {
    if (!formData.title || !formData.start || !formData.end) {
      alert('Por favor completa todos los campos requeridos'); return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', id_user: user?.id_user, id_tenant: user?.id_tenant,
          event: {
            title: formData.title, description: formData.description,
            start: new Date(formData.start).toISOString(), end: new Date(formData.end).toISOString(),
            is_all_day: formData.is_all_day, location: formData.location || undefined,
            generate_meeting: formData.generate_meeting, id_trato: formData.id_trato || undefined,
            id_tenant: user?.id_tenant, id_user: user?.id_user,
          },
          attendees,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Error al crear evento');
      await fetchData(); setIsModalOpen(false);
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al crear el evento'); }
    finally { setSubmitting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, attendees, user, fetchData]);

  const handleUpdateEvent = useCallback(async () => {
    if (!formData.title || !formData.start || !formData.end || !editingEventId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update', id_user: user?.id_user, id_tenant: user?.id_tenant,
          event: {
            id_event: editingEventId, title: formData.title, description: formData.description,
            start: formData.start, end: formData.end, is_all_day: formData.is_all_day,
            location: formData.location || undefined, generate_meeting: formData.generate_meeting,
            id_trato: formData.id_trato || undefined, id_tenant: user?.id_tenant, id_user: user?.id_user,
          },
          attendees,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Error al actualizar evento');
      await fetchData();
      setIsModalOpen(false); setIsEditing(false); setEditingEventId(null);
      setFormData(EMPTY_FORM); setAttendees([]);
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al actualizar el evento'); }
    finally { setSubmitting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, attendees, editingEventId, user, fetchData]);

  const handleDeleteEvent = useCallback(async () => {
    const event    = selectedEventDetail?.[0];
    if (!event) return;
    const id_event = event.id || event.id_event;
    if (!id_event) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_event, id_tenant: user?.id_tenant, id_trato: event.deal_id || null, id_user: user?.id_user }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Error al eliminar evento');
      setEvents(prev => prev.filter(e => (e as any).id !== id_event && (e as any).id_event !== id_event));
      await fetchData();
      setIsDetailModalOpen(false); setShowDeleteConfirm(false); setSelectedEventDetail(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar el evento'); }
    finally { setDeleting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventDetail, user, fetchData]);

  const handleRSVPEvent = useCallback(async () => {
    const event    = selectedEventDetail?.[0];
    if (!event || !rsvpAction) return;
    const id_event = event.id || event.id_event;
    if (!id_event) return;
    
    // Guardar estado original para revertir si falla
    const originalStatus = event.my_response_status;
    
    // Cambio optimista inmediato
    setSelectedEventDetail(prev => {
      if (!prev || !prev[0]) return prev;
      const updatedEvent = {
        ...prev[0],
        my_response_status: rsvpAction
      };
      // También actualizar el status en la lista de asistentes
      if (updatedEvent.attendees && Array.isArray(updatedEvent.attendees)) {
        updatedEvent.attendees = updatedEvent.attendees.map((att: any) => 
          att.is_me ? { ...att, status: rsvpAction } : att
        );
      }
      return [updatedEvent];
    });
    
    setSubmittingRSVP(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_evento: id_event, response: rsvpAction }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Error al responder');
      await fetchData();
      setShowRSVPConfirm(false); setRSVPAction(null);
    } catch (e) { 
      // Revertir cambio optimista si falla
      setSelectedEventDetail(prev => {
        if (!prev || !prev[0]) return prev;
        const revertedEvent = {
          ...prev[0],
          my_response_status: originalStatus
        };
        // También revertir el status en la lista de asistentes
        if (revertedEvent.attendees && Array.isArray(revertedEvent.attendees)) {
          revertedEvent.attendees = revertedEvent.attendees.map((att: any) => 
            att.is_me ? { ...att, status: originalStatus } : att
          );
        }
        return [revertedEvent];
      });
      alert(e instanceof Error ? e.message : 'Error al responder la invitación');
    }
    finally { setSubmittingRSVP(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventDetail, rsvpAction, fetchData]);

  const fetchEventDetail = useCallback(async (eventId: string) => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoadingDetail(true); setIsDetailModalOpen(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events/detail?id_event=${eventId}`);
      if (!res.ok) throw new Error('Error al obtener detalles');
      setSelectedEventDetail(await res.json());
    } catch (e) {
      console.error(e);
      alert('Error al cargar los detalles del evento');
      setIsDetailModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  }, [user?.id_tenant, user?.id_user]);

  const handleOpenEditModal = useCallback((event: any) => {
    setEditingEventId(event.id);
    const isAllDay        = event.allDay || event.is_all_day || event.all_day || false;
    const eventAttendees: Attendee[] = Array.isArray(event.attendees)
      ? event.attendees.map((a: any) => ({ email: a.email, name: a.name || a.email, type: 'external' as const, is_organizer: a.is_organizer || false }))
      : [];
    const fd: FormData = {
      title: event.title, description: event.description || '',
      start: formatLocalDatetime(event.start), end: formatLocalDatetime(event.end),
      is_all_day: isAllDay, location: event.location || '',
      generate_meeting: false, id_trato: event.deal_id || '', id_client_company: '',
    };
    setOriginalEventData({ ...fd, attendees: eventAttendees });
    setFormData(fd); setAttendees(eventAttendees);
    if (fd.id_trato) {
      fetchDeals().then(fetched => {
        const deal = fetched.find(d => d.id_trato === fd.id_trato);
        if (deal) { setSelectedDeal(deal); handleDealChange(deal.id_trato, fetched); }
      });
    }
    setIsEditing(true); setIsDetailModalOpen(false); setIsModalOpen(true);
  }, [fetchDeals, handleDealChange]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setIsEditing(false); setEditingEventId(null);
    setFormData(EMPTY_FORM); setAttendees([]);
    setSelectedDeal(null); setDealSearchInput('');
    setShowDealSuggestions(false); setAttendeeInput('');
    setShowAttendeeSuggestions(false); setAutoAddedAttendees([]);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const upcomingEvents = getUpcomingEvents();
  const dateRangeLabel = getDateRangeLabel(currentDate, viewMode);

  // Shared view props — FIX: onNavigate ahora se pasa correctamente
  const viewProps = {
    events,
    currentDate,
    onOpenModal:  handleOpenModal,
    onEventClick: fetchEventDetail,
    onNavigate:   navigate,           // ← antes faltaba esto en todas las vistas
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PermissionGuard user={user} permission="sync_calendar" onConnect={() => grantCalendar({})}>
      {/* FIX: h-full + flex-col en mobile, flex-row en desktop */}
      <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-4 relative">

        {/* ── SIDEBAR DESKTOP ─────────────────────────────────────────────── */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col gap-3">

          {/* Panel de controles */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">

            {/* Botón nuevo evento */}
            <button
              onClick={() => handleOpenModal()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 active:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
            >
              <i className="fa-solid fa-plus text-xs" />
              Nuevo evento
            </button>

            {/* Navegación de fecha — label centrado, flechas a los lados */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('prev')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <button
                onClick={goToToday}
                className="flex-1 text-center text-sm font-semibold text-slate-700 hover:text-slate-900 capitalize leading-tight px-1 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                title="Ir a hoy"
              >
                {dateRangeLabel}
              </button>
              <button
                onClick={() => navigate('next')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <i className="fa-solid fa-chevron-right text-xs" />
              </button>
            </div>

            {/* Selector de vista — estilo segmented control */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                <ViewTab
                  key={mode}
                  label={mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
                  active={viewMode === mode}
                  onClick={() => switchToCurrentView(mode)}
                />
              ))}
            </div>


          </div>

          {/* Panel de próximos eventos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2 shrink-0 flex items-center gap-2">
              <i className="fa-regular fa-clock text-slate-400 text-xs" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Próximos 7 días</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              <UpcomingEventsPanel grouped={upcomingEvents} onEventClick={fetchEventDetail} compact />
            </div>
          </div>
        </aside>

        {/* ── MOBILE HEADER ────────────────────────────────────────────────── */}
        <header className="lg:hidden shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Flechas + label fecha */}
            <div className="flex items-center flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm">
              <button
                onClick={() => navigate('prev')}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-l-xl transition-colors shrink-0"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <button
                onClick={goToToday}
                className="flex-1 text-center text-xs font-semibold text-slate-700 capitalize truncate px-1"
                title="Ir a hoy"
              >
                {dateRangeLabel}
              </button>
              <button
                onClick={() => navigate('next')}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-r-xl transition-colors shrink-0"
              >
                <i className="fa-solid fa-chevron-right text-xs" />
              </button>
            </div>

            {/* Indicador sync */}
            {isSyncing && (
              <div className="w-9 h-9 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
                <i className="fa-solid fa-arrows-rotate fa-spin text-brand-500 text-xs" />
              </div>
            )}
          </div>

          {/* Selector de vista móvil */}
          <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm p-0.5 gap-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <ViewTab
                key={mode}
                label={mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
                active={viewMode === mode}
                onClick={() => switchToCurrentView(mode)}
              />
            ))}
          </div>
        </header>

        {/* ── CALENDAR MAIN ─────────────────────────────────────────────────── */}
        <main className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <BrandSpinner size="lg" />
            </div>
          ) : viewMode === 'month' ? (
            <MonthView {...viewProps} />
          ) : viewMode === 'week' ? (
            <WeekView {...viewProps} />
          ) : (
            <DayView {...viewProps} />
          )}
        </main>

        {/* ── FAB MÓVIL — FIX: ahora existe y funciona ─────────────────────── */}
        <button
          onClick={() => handleOpenModal()}
          className="lg:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-slate-700 active:scale-95 transition-all"
          aria-label="Nuevo evento"
        >
          <i className="fa-solid fa-plus text-base" />
        </button>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      <EventModal
        isOpen={isModalOpen} isEditing={isEditing} submitting={submitting}
        formData={formData} attendees={attendees} attendeeInput={attendeeInput}
        showAttendeeSuggestions={showAttendeeSuggestions} dealSearchInput={dealSearchInput}
        showDealSuggestions={showDealSuggestions} selectedDeal={selectedDeal}
        deals={deals} dealsLoading={dealsLoading} dealsLoaded={dealsLoaded}
        contacts={contacts} users={users} currentUserId={user?.id_user}
        onClose={handleCloseModal} onSubmit={handleSubmit} onInputChange={handleInputChange}
        onAddAttendee={addAttendee}
        onRemoveAttendee={email => setAttendees(prev => prev.filter(a => a.email !== email))}
        onAttendeeInputChange={setAttendeeInput}
        onSetShowAttendeeSuggestions={setShowAttendeeSuggestions}
        onAddExternalAttendee={() => {
          const e = attendeeInput.trim();
          if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) addAttendee({ email: e, type: 'external' });
        }}
        onDealSearchChange={setDealSearchInput}
        onSetShowDealSuggestions={setShowDealSuggestions}
        onSelectDeal={deal => {
          setSelectedDeal(deal);
          setFormData(prev => ({ ...prev, id_trato: deal.id_trato }));
          setDealSearchInput(''); setShowDealSuggestions(false);
          handleDealChange(deal.id_trato, deals);
        }}
        onClearDeal={() => {
          if (autoAddedAttendees.length) {
            setAttendees(prev => prev.filter(a => !autoAddedAttendees.includes(a.email)));
            setAutoAddedAttendees([]);
          }
          setSelectedDeal(null);
          setFormData(prev => ({ ...prev, id_trato: '', id_client_company: '' }));
          setDealSearchInput('');
        }}
        onFetchDeals={fetchDeals}
        getAttendeeSuggestions={getAttendeeSuggestions}
        getContactsByCompany={getContactsByCompany}
      />

      <EventDetailModal
        isOpen={isDetailModalOpen}
        loadingDetail={loadingDetail}
        selectedEventDetail={selectedEventDetail}
        currentUserEmail={user?.email_user}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={handleOpenEditModal}
        onDeleteClick={() => setShowDeleteConfirm(true)}
        onRSVPClick={action => { setRSVPAction(action); setShowRSVPConfirm(true); }}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm} deleting={deleting}
        onConfirm={handleDeleteEvent} onCancel={() => setShowDeleteConfirm(false)}
      />

      <RSVPConfirmModal
        isOpen={showRSVPConfirm} rsvpAction={rsvpAction} submittingRSVP={submittingRSVP}
        onConfirm={handleRSVPEvent} onCancel={() => { setShowRSVPConfirm(false); setRSVPAction(null); }}
      />

      <ConfirmChangesModal
        isOpen={showConfirmChanges} submitting={submitting} changes={getEventChanges()}
        onConfirm={async () => { setShowConfirmChanges(false); await handleUpdateEvent(); }}
        onCancel={() => setShowConfirmChanges(false)}
      />
      {/* Indicador sync — fixed, no altera layout */}
{isSyncing && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
    <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg">
      <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
      Sincronizando
    </div>
  </div>
)}
    </PermissionGuard>
  );
};

export default Calendar;