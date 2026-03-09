import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDataCache } from '../contexts/DataCacheContext';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { addDays, format } from 'date-fns';
import { CalendarCheck, CalendarPlus, UserPlus, X } from 'lucide-react';
import Avatar from './Avatar';
import { BrandSpinner } from './AppLoaders';
import InteractionEventCaptureModal from './InteractionEventCaptureModal';
import { EventAttendee, EventFormData } from '../pages/calendar/EventModal';

type InteractionType = 'NOTE' | 'CALL' | 'MEETING';

interface NewInteractionFormProps {
  entityId: string;
  entityType: 'CONTACT' | 'DEAL';
  onSuccess: () => void;
  onCancel?: () => void;
  contactEmail?: string;
  contactName?: string;
  collaborators?: Array<{
    id_user?: string;
    id?: string;
    email?: string;
    name?: string;
    avatar?: string | null;
  }>;
  useEventModalCapture?: boolean;
  eventCaptureDeal?: {
    id_trato: string;
    nombre_trato?: string;
    id_client_company?: string;
    client_company_name?: string;
    contact_name?: string;
  };
}

// ── Chip ─────────────────────────────────────────────────────────────────────
const Chip: React.FC<{ avatar?: string | null | React.ReactNode; label: string; onRemove: () => void }> = ({ avatar, label, onRemove }) => (
  <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] text-slate-600 max-w-full">
    {typeof avatar === 'string' ? <Avatar src={avatar} name={label} size="xs" /> : avatar}
    <span className="truncate">{label}</span>
    <button type="button" onClick={onRemove}
      className="shrink-0 w-3.5 h-3.5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
      ×
    </button>
  </span>
);

// ── Dropdown row ──────────────────────────────────────────────────────────────
const DropdownItem: React.FC<{
  avatar?: string | null; primary: string; secondary?: string; badge?: string; onClick: () => void;
}> = ({ avatar, primary, secondary, badge, onClick }) => (
  <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
    {avatar !== undefined && <Avatar src={avatar} name={primary} size="xs" />}
    <div className="flex-1 min-w-0">
      <div className="text-[12px] text-slate-700 truncate font-medium">{primary}</div>
      {secondary && <div className="text-[10px] text-slate-400 truncate">{secondary}</div>}
    </div>
    {badge && (
      <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-slate-100 text-slate-500">
        {badge}
      </span>
    )}
  </button>
);

// ── Portal dropdown ───────────────────────────────────────────────────────────
const AttendeeDropdown: React.FC<{
  inputRef: React.RefObject<HTMLInputElement>;
  visible: boolean;
  externalCandidate: string;
  includeContact: boolean;
  resolvedContactEmail: string;
  resolvedContactName: string;
  cachedContactAvatar: string | null | undefined;
  suggestionItems: Array<{ id: string; email: string; name: string; avatar: string | null; isPrimary: boolean }>;
  onAddExternal: (email: string) => void;
  onAddContact: () => void;
  onAddCollaborator: (id: string) => void;
}> = ({ inputRef, visible, externalCandidate, includeContact, resolvedContactEmail, resolvedContactName, cachedContactAvatar, suggestionItems, onAddExternal, onAddContact, onAddCollaborator }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!visible || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 1000000 });
  }, [visible]);
  if (!visible) return null;
  return createPortal(
    <div style={style} className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
      {externalCandidate && <DropdownItem primary="Agregar invitado externo" secondary={externalCandidate} badge="Externo" onClick={() => onAddExternal(externalCandidate)} />}
      {!includeContact && resolvedContactEmail && <DropdownItem avatar={cachedContactAvatar} primary={resolvedContactName} secondary={resolvedContactEmail} badge="Contacto" onClick={onAddContact} />}
      {suggestionItems.map(c => <DropdownItem key={c.id} avatar={c.avatar} primary={c.name} secondary={c.email} onClick={() => onAddCollaborator(c.id)} />)}
    </div>,
    document.body
  );
};

// ── Calendar panel — floats to the right of the modal via portal ─────────────
interface CalendarPanelProps {
  formRef: React.RefObject<HTMLFormElement>;
  nextContactTime: string; setNextContactTime: (v: string) => void;
  eventEndTime: string; setEventEndTime: (v: string) => void;
  eventLocation: string; setEventLocation: (v: string) => void;
  extraAttendees: number;
  includeContact: boolean; resolvedContactEmail: string; resolvedContactName: string;
  cachedContactAvatar: string | null | undefined;
  selectedCollaboratorItems: Array<{ id: string; email: string; name: string; avatar: string | null; isPrimary: boolean }>;
  externalEmails: string[];
  collaboratorQuery: string; setCollaboratorQuery: (v: string) => void;
  inputFocused: boolean; setInputFocused: (v: boolean) => void;
  dropdownVisible: boolean; externalCandidate: string;
  suggestionItems: Array<{ id: string; email: string; name: string; avatar: string | null; isPrimary: boolean }>;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void; onRemoveContact: () => void;
  onRemoveCollaborator: (id: string) => void;
  onRemoveExternal: (email: string) => void;
  onAddExternal: (email: string) => void;
  onAddContact: () => void;
  onAddCollaborator: (id: string) => void;
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({
  formRef, nextContactTime, setNextContactTime, eventEndTime, setEventEndTime,
  eventLocation, setEventLocation, extraAttendees, includeContact, resolvedContactEmail,
  resolvedContactName, cachedContactAvatar, selectedCollaboratorItems, externalEmails,
  collaboratorQuery, setCollaboratorQuery, inputFocused, setInputFocused, dropdownVisible,
  externalCandidate, suggestionItems, inputRef, onClose, onRemoveContact,
  onRemoveCollaborator, onRemoveExternal, onAddExternal, onAddContact, onAddCollaborator,
}) => {
  const [floatStyle, setFloatStyle] = useState<React.CSSProperties>({});
  const [isFloating, setIsFloating] = useState(true);

  useEffect(() => {
    const calculate = () => {
      if (!formRef.current) return;
      const modalEl = formRef.current.closest('[role="dialog"], .rounded-xl, .rounded-2xl, .shadow-xl') as HTMLElement | null;
      const modalRect = modalEl ? modalEl.getBoundingClientRect() : formRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - modalRect.right;
      // Need at least 300px to the right to float
      if (spaceRight >= 300) {
        setIsFloating(true);
        setFloatStyle({
          position: 'fixed',
          top: modalRect.top,
          left: modalRect.right + 16,
          width: Math.min(280, spaceRight - 24),
          maxHeight: modalRect.height,
          zIndex: 1000000,
        });
      } else {
        setIsFloating(false);
      }
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [formRef]);

  // Shared panel body content (used in both modes)
  const panelBody = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} className="text-blue-500" />
          <span className="text-[12px] font-semibold text-slate-700">Detalles del evento</span>
        </div>
        <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="px-5 py-5 space-y-5">
        {/* Hora inicio / fin */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Inicio</label>
            <input type="time" value={nextContactTime} onChange={(e) => setNextContactTime(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Fin</label>
            <input type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
        </div>

        {/* Ubicación */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Ubicación</label>
          <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300"
            placeholder="Sala, enlace de Meet, Zoom…" />
        </div>

        {/* Invitados */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Invitados</label>
          {/* Input primero */}
          <div className="relative flex items-center mb-2">
            <UserPlus size={13} className="absolute left-2.5 text-slate-300 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={collaboratorQuery}
              onChange={(e) => setCollaboratorQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && externalCandidate) { e.preventDefault(); onAddExternal(externalCandidate); }
                if (e.key === 'Escape') inputRef.current?.blur();
              }}
              className="w-full pl-7 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300"
              placeholder="Nombre o correo…"
            />
          </div>
          {/* Chips debajo — siempre visibles en flujo normal */}
          {extraAttendees > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {includeContact && resolvedContactEmail && (
                <Chip avatar={<Avatar src={cachedContactAvatar || null} name={resolvedContactName} size="xs" />}
                  label={resolvedContactName} onRemove={onRemoveContact} />
              )}
              {selectedCollaboratorItems.map(c => (
                <Chip key={c.id} avatar={<Avatar src={c.avatar} name={c.name} size="xs" />}
                  label={c.name} onRemove={() => onRemoveCollaborator(c.id)} />
              ))}
              {externalEmails.map(email => (
                <Chip key={email} avatar={null} label={email} onRemove={() => onRemoveExternal(email)} />
              ))}
            </div>
          )}
          <AttendeeDropdown
            inputRef={inputRef} visible={dropdownVisible}
            externalCandidate={externalCandidate} includeContact={includeContact}
            resolvedContactEmail={resolvedContactEmail} resolvedContactName={resolvedContactName}
            cachedContactAvatar={cachedContactAvatar}
            suggestionItems={suggestionItems}
            onAddExternal={onAddExternal} onAddContact={onAddContact} onAddCollaborator={onAddCollaborator}
          />
        </div>
      </div>
    </>
  );

  // Desktop with space: float via portal with scroll inside panel
  if (isFloating) return createPortal(
    <div style={floatStyle} className="bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
      {panelBody}
    </div>,
    document.body
  );

  // Mobile / compact: render inline, no fixed height, content flows naturally in the modal scroll
  return (
    <div className="mx-5 mb-4 rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
      {panelBody}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const NewInteractionForm: React.FC<NewInteractionFormProps> = ({
  entityId, entityType, onSuccess, onCancel, contactEmail, contactName, collaborators = [],
  useEventModalCapture = false,
  eventCaptureDeal,
}) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const interactionType: InteractionType = 'NOTE';
  const [isScheduling, setIsScheduling] = useState(false);
  const [nextContactDate, setNextContactDate] = useState('');
  const [nextContactTime, setNextContactTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [includeContact, setIncludeContact] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState<string[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextDateInputRef = useRef<HTMLInputElement>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [isEventCaptureOpen, setIsEventCaptureOpen] = useState(false);
  const [capturedEventFormData, setCapturedEventFormData] = useState<Partial<EventFormData>>({});
  const [capturedEventAttendees, setCapturedEventAttendees] = useState<EventAttendee[]>([]);
  const [isChannelLocked, setIsChannelLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dealChannels, contacts, users } = useDataCache();
  const [selectedType, setSelectedType] = useState<string>('NOTE');

  const cachedContact = useMemo(() => {
    if (entityType !== 'CONTACT') return null;
    return contacts.find(c => String(c.id_contact) === String(entityId)) || null;
  }, [contacts, entityId, entityType]);

  const resolvedContactEmail = contactEmail || cachedContact?.email || '';
  const resolvedContactName = contactName
    || (cachedContact?.first_name || cachedContact?.last_name ? `${cachedContact?.first_name || ''} ${cachedContact?.last_name || ''}`.trim() : '')
    || cachedContact?.title || cachedContact?.email || 'Contacto';

  const normalizedCollaborators = useMemo(() => collaborators.map(collab => {
    const id = collab.id_user || collab.id || '';
    const cachedUser = id ? users.find(u => String(u.id_user) === String(id)) : undefined;
    return { id, email: collab.email || cachedUser?.email_user || '', name: collab.name || cachedUser?.name_user || cachedUser?.email_user || 'Usuario', avatar: collab.avatar || cachedUser?.avatar_url || null };
  }).filter(c => c.id && c.email && c.id !== user?.id_user), [collaborators, users, user?.id_user]);

  const allUsers = useMemo(() => users
    .filter(u => u.id_user && u.email_user && u.id_user !== user?.id_user)
    .map(u => ({ id: u.id_user, email: u.email_user, name: u.name_user || u.email_user, avatar: u.avatar_url || null })),
    [users, user?.id_user]);

  const mergedCollaborators = useMemo(() => {
    const map = new Map<string, { id: string; email: string; name: string; avatar: string | null; isPrimary: boolean }>();
    normalizedCollaborators.forEach(c => map.set(c.id, { ...c, isPrimary: true }));
    allUsers.forEach(u => { if (!map.has(u.id)) map.set(u.id, { ...u, isPrimary: false }); });
    return Array.from(map.values());
  }, [normalizedCollaborators, allUsers]);

  const canSyncCalendar = Boolean(user?.sync_calendar || user?.integrations?.sync_calendar);
  const channelOptions = useMemo(() => (dealChannels || []).filter((c: any) => c?.id_channel), [dealChannels]);
  const selectedChannel = useMemo(() => {
    if (selectedType === 'NOTE') {
      return {
        id_channel: 'NOTE',
        name: 'Nota',
        icon: 'fa-solid fa-file-lines',
        color: '#18181b',
      };
    }
    return channelOptions.find((c: any) => String(c.id_channel) === String(selectedType)) || null;
  }, [channelOptions, selectedType]);
  const canStartNextAction = description.trim().length > 0 && Boolean(selectedType);

  const formatNextActionDateLabel = (dateStr: string) => {
    if (!dateStr) return 'Selecciona fecha';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'Selecciona fecha';
    return new Intl.DateTimeFormat('es-EC', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(date);
  };

  const activateNextAction = () => {
    if (!canStartNextAction) return;
    setIsScheduling(true);
    setIsChannelLocked(true);
    if (!nextContactDate) setNextContactDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  };

  useEffect(() => {
    if (isScheduling) {
      setNextContactDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    } else {
      setNextContactDate(''); setNextContactTime(''); setEventEndTime('');
      setNextActionDesc(''); setAddToCalendar(false); setIncludeContact(false);
      setIsChannelLocked(false);
      setSelectedCollaborators([]); setExternalEmails([]); setCollaboratorQuery(''); setEventLocation('');
      setCapturedEventFormData({});
      setCapturedEventAttendees([]);
    }
  }, [isScheduling]);

  useEffect(() => {
    if (addToCalendar && canSyncCalendar) {
      if (!nextContactTime) {
        const now = new Date();
        const startTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        setNextContactTime(startTime);
        
        const endTime = new Date(now.getTime() + 60 * 60 * 1000);
        const endTimeStr = String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0');
        setEventEndTime(endTimeStr);
      }
    } else {
      setIncludeContact(false); setSelectedCollaborators([]); setExternalEmails([]); setCollaboratorQuery('');
    }
  }, [addToCalendar, canSyncCalendar]);

  const selectedCollaboratorItems = useMemo(() => mergedCollaborators.filter(c => selectedCollaborators.includes(c.id)), [mergedCollaborators, selectedCollaborators]);

  const knownEmails = useMemo(() => {
    const s = new Set<string>();
    mergedCollaborators.forEach(c => s.add(c.email.toLowerCase()));
    if (resolvedContactEmail) s.add(resolvedContactEmail.toLowerCase());
    externalEmails.forEach(e => s.add(e.toLowerCase()));
    if (user?.email_user) s.add(user.email_user.toLowerCase());
    return s;
  }, [mergedCollaborators, resolvedContactEmail, externalEmails, user?.email_user]);

  const externalCandidate = useMemo(() => {
    const q = collaboratorQuery.trim().toLowerCase();
    if (!q || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) || knownEmails.has(q)) return '';
    return q;
  }, [collaboratorQuery, knownEmails]);

  const suggestionItems = useMemo(() => {
    const q = collaboratorQuery.trim().toLowerCase();
    const pool = q
      ? mergedCollaborators.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : [...mergedCollaborators].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    return pool.filter(c => !selectedCollaborators.includes(c.id)).slice(0, 8);
  }, [collaboratorQuery, mergedCollaborators, selectedCollaborators]);

  const dropdownVisible = inputFocused && (suggestionItems.length > 0 || !!externalCandidate || (!includeContact && !!resolvedContactEmail));

  const addCollaborator = (id: string) => {
    setSelectedCollaborators(prev => prev.includes(id) ? prev : [...prev, id]);
    setCollaboratorQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleCollaborator = (id: string) =>
    setSelectedCollaborators(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addExternalEmail = (value: string) => {
    const n = value.trim().toLowerCase();
    if (!n || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n) || externalEmails.includes(n)) return;
    setExternalEmails(prev => [...prev, n]);
    setCollaboratorQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const buildAttendees = () => {
    const s = new Set<string>();
    if (user?.email_user) s.add(user.email_user);
    if (includeContact && resolvedContactEmail) s.add(resolvedContactEmail);
    selectedCollaborators.forEach(id => { const c = mergedCollaborators.find(x => x.id === id); if (c?.email) s.add(c.email); });
    externalEmails.forEach(e => s.add(e));
    return Array.from(s);
  };

  const buildDateTime = (date: string, time: string) => {
    if (!date) return '';
    if (!time) return date;
    const d = new Date(`${date}T${time}`);
    return isNaN(d.getTime()) ? date : d.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError('La descripción no puede estar vacía.'); return; }
    setIsSubmitting(true); setError(null);
    try {
      const payload: any = { description, interaction_type: interactionType, id_user: user?.id_user, id_tenant: user?.id_tenant, entity_type: entityType, entity_id: entityId };
      if (selectedType !== 'NOTE') payload.id_channel = selectedType;
      if (isScheduling) {
        payload.next_contact_date = buildDateTime(nextContactDate, nextContactTime);
        payload.next_action_desc = nextActionDesc;
        if (addToCalendar && canSyncCalendar) {
          payload.create_event = true;
          payload.attendees = buildAttendees();
          if (eventEndTime) payload.event_end_date = buildDateTime(nextContactDate, eventEndTime);
          if (eventLocation.trim()) payload.location = eventLocation.trim();
        }
      }
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/interactions/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Error al registrar la gestión.');
      setDescription(''); setIsScheduling(false); setSelectedType('NOTE');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const extraAttendees = (includeContact ? 1 : 0) + selectedCollaboratorItems.length + externalEmails.length;
  const showCalPanel = !useEventModalCapture && addToCalendar && canSyncCalendar && isScheduling;
  const formRef = useRef<HTMLFormElement>(null);

  const capturedStartTime = capturedEventFormData.start?.split('T')[1]?.slice(0, 5) || '';
  const capturedEndTime = capturedEventFormData.end?.split('T')[1]?.slice(0, 5) || '';
  const resolvedStartDate = nextContactDate || capturedEventFormData.start?.split('T')[0] || '';
  const resolvedStartTime = nextContactTime || capturedStartTime || '09:00';
  const resolvedEndTime = eventEndTime || capturedEndTime || '10:00';

  const initialCaptureFormData: Partial<EventFormData> = {
    ...capturedEventFormData,
    title: capturedEventFormData.title ?? nextActionDesc,
    description: capturedEventFormData.description ?? '',
    start: resolvedStartDate ? `${resolvedStartDate}T${resolvedStartTime}` : capturedEventFormData.start,
    end: resolvedStartDate ? `${resolvedStartDate}T${resolvedEndTime}` : capturedEventFormData.end,
    location: eventLocation,
    id_trato: eventCaptureDeal?.id_trato || (entityType === 'DEAL' ? entityId : ''),
    id_client_company: eventCaptureDeal?.id_client_company || '',
  };

  const initialCaptureAttendees: EventAttendee[] = capturedEventAttendees.length > 0
    ? capturedEventAttendees
    : [
    ...(includeContact && resolvedContactEmail ? [{ email: resolvedContactEmail, name: resolvedContactName, type: 'contact' as const }] : []),
    ...selectedCollaboratorItems.map(c => ({ email: c.email, name: c.name, type: 'user' as const, id: c.id })),
    ...externalEmails.map(email => ({ email, type: 'external' as const })),
  ];

  const applyCapturedEvent = (payload: { formData: EventFormData; attendees: EventAttendee[] }) => {
    const { formData: capturedForm, attendees: capturedAttendees } = payload;

    const [capturedDate = '', capturedStartTime = ''] = (capturedForm.start || '').split('T');
    const [, capturedEndTime = ''] = (capturedForm.end || '').split('T');

    setIsScheduling(true);
    setAddToCalendar(true);
    setCapturedEventFormData(capturedForm);
    setCapturedEventAttendees(capturedAttendees);
    if (capturedDate) setNextContactDate(capturedDate);
    if (capturedStartTime) setNextContactTime(capturedStartTime.slice(0, 5));
    if (capturedEndTime) setEventEndTime(capturedEndTime.slice(0, 5));
    setEventLocation(capturedForm.location || '');
    if (!nextActionDesc.trim() && capturedForm.title.trim()) setNextActionDesc(capturedForm.title.trim());

    const normalizedEmails = new Set(capturedAttendees.map(a => a.email.trim().toLowerCase()));
    const contactEmailNormalized = resolvedContactEmail.trim().toLowerCase();
    setIncludeContact(Boolean(contactEmailNormalized && normalizedEmails.has(contactEmailNormalized)));

    const selectedIds = mergedCollaborators
      .filter(c => normalizedEmails.has(c.email.trim().toLowerCase()))
      .map(c => c.id);
    setSelectedCollaborators(selectedIds);

    const internalEmailSet = new Set([
      ...mergedCollaborators.map(c => c.email.trim().toLowerCase()),
      contactEmailNormalized,
      (user?.email_user || '').trim().toLowerCase(),
    ]);
    const externals = Array.from(normalizedEmails).filter(email => email && !internalEmailSet.has(email));
    setExternalEmails(externals);

    setIsEventCaptureOpen(false);
  };

  const isRegisterDisabled = isSubmitting
    || !description.trim()
    || (isScheduling && (!nextContactDate || !nextActionDesc.trim()));

  const hasCalendarEventConfigured = addToCalendar && Boolean(
    nextContactTime
    || eventEndTime
    || eventLocation.trim()
    || includeContact
    || selectedCollaborators.length
    || externalEmails.length
  );

  const hasDraft = Boolean(
    description.trim()
    || selectedType !== 'NOTE'
    || isScheduling
    || nextActionDesc.trim()
    || addToCalendar
    || eventLocation.trim()
    || includeContact
    || selectedCollaborators.length
    || externalEmails.length
  );
  const hasActivityDraft = description.trim().length > 0;

  const clearDraft = () => {
    setDescription('');
    setSelectedType('NOTE');
    setIsScheduling(false);
    setAddToCalendar(false);
    setCapturedEventFormData({});
    setCapturedEventAttendees([]);
    setError(null);
    setIsEventCaptureOpen(false);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>

      {/* ══ MAIN FORM — never changes layout ══════════════════════════════ */}
      <div className="px-3 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">

          {/* Editor estilo Activity Wall */}
          <div className="relative border border-zinc-200 rounded-lg shadow-sm focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 transition-all overflow-hidden bg-white">
            {isScheduling && isChannelLocked && selectedChannel && (
              <button
                type="button"
                onClick={() => setIsChannelLocked(false)}
                className="absolute top-2.5 right-3 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border border-zinc-200 bg-white text-[12px]"
                style={{ color: selectedChannel.color || '#64748b' }}
                title="Cambiar canal"
              >
                <i className={selectedChannel.icon?.startsWith('fa') ? selectedChannel.icon : `fa-solid ${selectedChannel.icon || 'fa-circle'}`} />
              </button>
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-[12px] sm:text-[13px] p-2.5 sm:p-3 text-zinc-800 bg-transparent border-0 focus:ring-0 resize-none h-14 sm:h-16 outline-none placeholder:text-zinc-400"
              placeholder="Escribe una nota interna o registra una actividad..."
            />
            <div className={`flex items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 border-t border-zinc-100 transition-colors duration-200 ${isScheduling ? 'bg-white' : 'bg-zinc-50/50'}`}>
              <div className="relative flex-1 min-w-0 pr-1.5 sm:pr-2 min-h-[30px] sm:min-h-[32px]">
                <div className={`flex items-center gap-1 overflow-x-auto scrollbar-hide transition-all duration-200 ease-out ${isScheduling && isChannelLocked ? 'pointer-events-none opacity-0 -translate-x-3 absolute inset-0' : 'opacity-100 translate-x-0 relative'}`}>
                  <button
                    type="button"
                    title="Nota"
                    onClick={() => setSelectedType('NOTE')}
                    className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded transition-colors text-[11px] sm:text-[12px] ${selectedType === 'NOTE' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700'}`}
                  >
                    <i className="fa-solid fa-file-lines" />
                  </button>
                  {channelOptions.map((c: any) => {
                    const isActive = selectedType === c.id_channel;
                    return (
                      <button
                        key={c.id_channel}
                        type="button"
                        title={c.name}
                        onClick={() => setSelectedType(prev => prev === c.id_channel ? 'NOTE' : c.id_channel)}
                        className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded transition-colors text-[11px] sm:text-[12px] ${isActive ? 'shadow-sm' : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700'}`}
                        style={isActive
                          ? { backgroundColor: `${c.color || '#64748b'}1A`, color: c.color || '#64748b' }
                          : undefined}
                      >
                        <i className={c.icon?.startsWith('fa') ? c.icon : `fa-solid ${c.icon || 'fa-circle'}`} />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={activateNextAction}
                    disabled={!canStartNextAction}
                    className="ml-0.5 sm:ml-1 inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-semibold rounded border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!canStartNextAction ? 'Escribe la actividad y selecciona un canal para continuar' : 'Configurar siguiente acción'}
                  >
                    <i className="fa-regular fa-calendar-plus text-[11px] sm:hidden" />
                    <span className="hidden sm:inline">Next action</span>
                    <i className="fa-solid fa-arrow-right text-[10px] hidden sm:inline" />
                  </button>
                </div>

                <div className={`flex items-center gap-0 w-full min-w-0 border border-zinc-200 rounded-lg overflow-hidden bg-white transition-all duration-200 ease-out ${isScheduling && isChannelLocked ? 'opacity-100 translate-x-0 relative' : 'pointer-events-none opacity-0 translate-x-3 absolute inset-0'}`}>
                  <button
                    type="button"
                    onClick={() => nextDateInputRef.current?.showPicker?.()}
                    className="shrink-0 px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-[12px] text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border-r border-zinc-200 inline-flex items-center gap-1 sm:gap-1.5"
                    title="Seleccionar fecha"
                  >
                    <i className="fa-regular fa-calendar text-zinc-400 text-[12px]"></i>
                    <span className="font-medium max-w-[84px] sm:max-w-none truncate">{formatNextActionDateLabel(nextContactDate)}</span>
                  </button>
                  <input
                    ref={nextDateInputRef}
                    type="date"
                    value={nextContactDate}
                    onChange={(e) => setNextContactDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                  />

                  <input
                    type="text"
                    value={nextActionDesc}
                    onChange={(e) => setNextActionDesc(e.target.value)}
                    placeholder="Siguiente acción..."
                    className="flex-1 min-w-0 px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-[12px] text-zinc-700 bg-white focus:outline-none placeholder:text-zinc-400"
                  />

                  <button
                    type="button"
                    onClick={() => setIsScheduling(false)}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border-l border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    title="Cancelar next action"
                  >
                    <i className="fa-solid fa-arrow-left text-[11px]"></i>
                  </button>

                  <button
                    type="button"
                    disabled={!canSyncCalendar}
                    onClick={() => {
                      if (!canSyncCalendar) return;
                      if (useEventModalCapture) {
                        setIsEventCaptureOpen(true);
                        return;
                      }
                      setAddToCalendar(v => !v);
                    }}
                    className={`hidden sm:flex relative w-7 h-7 sm:w-8 sm:h-8 items-center justify-center border-l border-zinc-200 transition-all duration-200 ${hasCalendarEventConfigured ? 'bg-emerald-50 text-emerald-600 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28)] ring-1 ring-emerald-200/70' : addToCalendar ? 'bg-zinc-100 text-zinc-700' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'} ${!canSyncCalendar ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={canSyncCalendar ? 'Agregar calendario' : 'Integración de calendario no activa'}
                  >
                    <CalendarPlus size={14} />
                    {hasCalendarEventConfigured && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>
              {!isScheduling && (
                <div className="flex items-center gap-1.5 sm:gap-2 ml-2 sm:ml-3 shrink-0">
                  {hasActivityDraft && (
                    <button
                      type="button"
                      onClick={clearDraft}
                      disabled={isSubmitting}
                      className="w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Borrar borrador"
                    >
                      <i className="fa-regular fa-trash-can text-[12px]"></i>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isRegisterDisabled}
                    className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 py-1.5 bg-zinc-900 text-white text-[11px] sm:text-[12px] font-medium rounded hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <BrandSpinner size="xs" />
                    ) : (
                      <>
                        <i className="fa-regular fa-floppy-disk text-[12px] sm:hidden"></i>
                        <span className="hidden sm:inline">Registrar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Acciones de programación dentro del mismo contenedor */}
            {isScheduling && (
              <div className="border-t border-zinc-100 bg-zinc-50/50 px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-end gap-1.5 sm:gap-2">
                {canSyncCalendar && (
                  <button
                    type="button"
                    disabled={!canSyncCalendar}
                    onClick={() => {
                      if (!canSyncCalendar) return;
                      if (useEventModalCapture) {
                        setIsEventCaptureOpen(true);
                        return;
                      }
                      setAddToCalendar(v => !v);
                    }}
                    className={`sm:hidden relative w-7 h-7 inline-flex items-center justify-center rounded border border-zinc-200 transition-all duration-200 ${hasCalendarEventConfigured ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70' : addToCalendar ? 'bg-zinc-100 text-zinc-700' : 'bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'} ${!canSyncCalendar ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={canSyncCalendar ? 'Agregar calendario' : 'Integración de calendario no activa'}
                  >
                    <CalendarPlus size={13} />
                    {hasCalendarEventConfigured && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                )}
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-[11px] sm:text-[12px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                {hasDraft && (
                  <button
                    type="button"
                    onClick={clearDraft}
                    disabled={isSubmitting}
                    className="w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Borrar borrador"
                  >
                    <i className="fa-regular fa-trash-can text-[12px]"></i>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isRegisterDisabled}
                  className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 py-1.5 bg-zinc-900 text-white text-[11px] sm:text-[12px] font-medium rounded hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <BrandSpinner size="xs" />
                  ) : (
                    <>
                      <i className="fa-regular fa-floppy-disk text-[12px] sm:hidden"></i>
                      <span className="hidden sm:inline">Registrar</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-red-400 shrink-0 text-[13px]">⚠</span>
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </div>

      {/* ══ CALENDAR PANEL inline (móvil) — dentro del scroll, ANTES del footer ══ */}
      {showCalPanel && (
        <CalendarPanel
          formRef={formRef}
          nextContactTime={nextContactTime}
          setNextContactTime={setNextContactTime}
          eventEndTime={eventEndTime}
          setEventEndTime={setEventEndTime}
          eventLocation={eventLocation}
          setEventLocation={setEventLocation}
          extraAttendees={extraAttendees}
          includeContact={includeContact}
          resolvedContactEmail={resolvedContactEmail}
          resolvedContactName={resolvedContactName}
          cachedContactAvatar={cachedContact?.owner_avatar || null}
          selectedCollaboratorItems={selectedCollaboratorItems}
          externalEmails={externalEmails}
          collaboratorQuery={collaboratorQuery}
          setCollaboratorQuery={setCollaboratorQuery}
          inputFocused={inputFocused}
          setInputFocused={setInputFocused}
          dropdownVisible={dropdownVisible}
          externalCandidate={externalCandidate}
          suggestionItems={suggestionItems}
          inputRef={inputRef}
          onClose={() => setAddToCalendar(false)}
          onRemoveContact={() => setIncludeContact(false)}
          onRemoveCollaborator={toggleCollaborator}
          onRemoveExternal={(email) => setExternalEmails(prev => prev.filter(x => x !== email))}
          onAddExternal={addExternalEmail}
          onAddContact={() => { setIncludeContact(true); setCollaboratorQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
          onAddCollaborator={addCollaborator}
        />
      )}

      {useEventModalCapture && canSyncCalendar && (
        <InteractionEventCaptureModal
          isOpen={isEventCaptureOpen}
          onClose={() => setIsEventCaptureOpen(false)}
          onCapture={applyCapturedEvent}
          contacts={contacts}
          users={users}
          currentUserId={user?.id_user}
          dealContext={eventCaptureDeal || (entityType === 'DEAL' ? {
            id_trato: entityId,
            nombre_trato: contactName,
          } : undefined)}
          initialFormData={initialCaptureFormData}
          initialAttendees={initialCaptureAttendees}
        />
      )}
    </form>
  );
};

export default NewInteractionForm;