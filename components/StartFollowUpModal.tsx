import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact } from '../types';
import { addDays, format } from 'date-fns';
import { CalendarCheck, CalendarPlus, UserPlus, LoaderCircle } from 'lucide-react';
import { useDataCache } from '../contexts/DataCacheContext';
import Avatar from './Avatar';
import { createPortal } from 'react-dom';

// ── Chip ─────────────────────────────────────────────────────────────────────
const Chip: React.FC<{
  avatar?: string | null | React.ReactNode;
  label: string;
  onRemove: () => void;
}> = ({ avatar, label, onRemove }) => (
  <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] text-slate-600 max-w-full">
    {typeof avatar === 'string' ? <Avatar src={avatar} name={label} size="xs" /> : avatar}
    <span className="truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      className="shrink-0 w-3.5 h-3.5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
    >
      ×
    </button>
  </span>
);

// ── Dropdown row ──────────────────────────────────────────────────────────────
const DropdownItem: React.FC<{
  avatar?: string | null;
  primary: string;
  secondary?: string;
  badge?: string;
  onClick: () => void;
}> = ({ avatar, primary, secondary, badge, onClick }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
  >
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
  contactEmail: string;
  contactName: string;
  suggestionItems: Array<{ id: string; email: string; name: string; avatar: string | null }>;
  onAddExternal: (email: string) => void;
  onAddContact: () => void;
  onAddCollaborator: (id: string) => void;
}> = ({ inputRef, visible, externalCandidate, includeContact, contactEmail, contactName, suggestionItems, onAddExternal, onAddContact, onAddCollaborator }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!visible || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 });
  }, [visible]);

  if (!visible) return null;
  return createPortal(
    <div style={style} className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
      {externalCandidate && (
        <DropdownItem primary="Agregar invitado externo" secondary={externalCandidate} badge="Externo" onClick={() => onAddExternal(externalCandidate)} />
      )}
      {!includeContact && contactEmail && (
        <DropdownItem avatar={null} primary={contactName} secondary={contactEmail} badge="Contacto" onClick={onAddContact} />
      )}
      {suggestionItems.map(c => (
        <DropdownItem key={c.id} avatar={c.avatar} primary={c.name} secondary={c.email} onClick={() => onAddCollaborator(c.id)} />
      ))}
    </div>,
    document.body
  );
};

// ── Field label ───────────────────────────────────────────────────────────────
const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const inputCls = "w-full px-3 py-2.5 text-[13px] text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300 transition";

// ── Props ─────────────────────────────────────────────────────────────────────
interface StartFollowUpFormProps {
  contact: ClientContact;
  onSuccess: () => void;
  onClose?: () => void;
  isOpen?: boolean;
}

// ── Main modal wrapper ────────────────────────────────────────────────────────
const StartFollowUpModal: React.FC<StartFollowUpFormProps> = ({ contact, onSuccess, onClose, isOpen = true }) => {
  if (!isOpen) return null;
  
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contacto';

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bg-white w-full sm:max-w-[600px] sm:rounded-xl rounded-t-2xl shadow-xl overflow-hidden flex flex-col max-h-[96dvh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between shrink-0 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-0.5">Iniciar seguimiento</p>
            <h2 className="text-[15px] font-semibold text-slate-800 leading-tight">{contactName}</h2>
            {contact.email && <p className="text-[12px] text-slate-400 mt-0.5">{contact.email}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors mt-0.5">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          <StartFollowUpForm contact={contact} onSuccess={onSuccess} onCancel={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Main form ─────────────────────────────────────────────────────────────────
interface StartFollowUpFormProps2 {
  contact: ClientContact;
  onSuccess: () => void;
  onCancel?: () => void;
}

const StartFollowUpForm: React.FC<StartFollowUpFormProps2> = ({ contact, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { users } = useDataCache();

  const [initialNote, setInitialNote] = useState('');
  const [nextContactDate, setNextContactDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [nextContactTime, setNextContactTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [nextActionDesc, setNextActionDesc] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [includeContact, setIncludeContact] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState<string[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [eventLocation, setEventLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [floatStyle, setFloatStyle] = useState<React.CSSProperties>({});
  const [isFloating, setIsFloating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const canSyncCalendar = Boolean(user?.sync_calendar || user?.integrations?.sync_calendar);
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contacto';

  // Preselect local times when calendar is enabled
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
      setIncludeContact(false);
      setSelectedCollaborators([]);
      setExternalEmails([]);
      setCollaboratorQuery('');
    }
  }, [addToCalendar, canSyncCalendar]);

  // Calculate floating position for event details panel
  useEffect(() => {
    const calculate = () => {
      if (!formRef.current) return;
      const modalEl = formRef.current.closest('[role="dialog"], .rounded-xl, .shadow-xl') as HTMLElement | null;
      const modalRect = modalEl ? modalEl.getBoundingClientRect() : formRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - modalRect.right;
      // Need at least 350px to the right to float
      if (spaceRight >= 350) {
        setIsFloating(true);
        setFloatStyle({
          position: 'fixed',
          top: modalRect.top + 80, // Start slightly lower than modal top
          left: modalRect.right + 16,
          width: Math.min(340, spaceRight - 24),
          maxHeight: Math.max(400, modalRect.height - 120),
          zIndex: 1000000,
        });
      } else {
        setIsFloating(false);
      }
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [addToCalendar, canSyncCalendar]);

  const mergedCollaborators = useMemo(() => users
    .filter(u => u.id_user && u.email_user && u.id_user !== user?.id_user)
    .map(u => ({ id: u.id_user, email: u.email_user, name: u.name_user || u.email_user, avatar: u.avatar_url || null })),
    [users, user?.id_user]
  );

  const selectedCollaboratorItems = useMemo(
    () => mergedCollaborators.filter(c => selectedCollaborators.includes(c.id)),
    [mergedCollaborators, selectedCollaborators]
  );

  const knownEmails = useMemo(() => {
    const s = new Set<string>();
    mergedCollaborators.forEach(c => s.add(c.email.toLowerCase()));
    if (contact.email) s.add(contact.email.toLowerCase());
    externalEmails.forEach(e => s.add(e.toLowerCase()));
    if (user?.email_user) s.add(user.email_user.toLowerCase());
    return s;
  }, [mergedCollaborators, contact.email, externalEmails, user?.email_user]);

  const externalCandidate = useMemo(() => {
    const q = collaboratorQuery.trim().toLowerCase();
    if (!q || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) || knownEmails.has(q)) return '';
    return q;
  }, [collaboratorQuery, knownEmails]);

  const suggestionItems = useMemo(() => {
    const q = collaboratorQuery.trim().toLowerCase();
    const pool = q
      ? mergedCollaborators.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : mergedCollaborators;
    return pool.filter(c => !selectedCollaborators.includes(c.id)).slice(0, 8);
  }, [collaboratorQuery, mergedCollaborators, selectedCollaborators]);

  const dropdownVisible = inputFocused && (
    suggestionItems.length > 0 || !!externalCandidate || (!includeContact && !!contact.email)
  );

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

  const buildDateTime = (date: string, time: string) => {
    if (!date) return '';
    if (!time) return date;
    const d = new Date(`${date}T${time}`);
    return isNaN(d.getTime()) ? date : d.toISOString();
  };

  const buildAttendees = () => {
    const s = new Set<string>();
    if (user?.email_user) s.add(user.email_user);
    if (includeContact && contact.email) s.add(contact.email);
    selectedCollaborators.forEach(id => { const c = mergedCollaborators.find(x => x.id === id); if (c?.email) s.add(c.email); });
    externalEmails.forEach(e => s.add(e));
    return Array.from(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialNote.trim() || !nextContactDate || !nextActionDesc.trim()) {
      setError('Completa todos los campos requeridos para continuar.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        entity_id: contact.id_contact,
        entity_type: 'CONTACT',
        interaction_type: 'NOTE',
        description: initialNote,
        next_contact_date: buildDateTime(nextContactDate, nextContactTime),
        next_action_desc: nextActionDesc,
        id_user: user?.id_user,
        id_tenant: user?.id_tenant,
      };
      if (addToCalendar && canSyncCalendar) {
        payload.create_event = true;
        payload.attendees = buildAttendees();
        if (eventEndTime) payload.event_end_date = buildDateTime(nextContactDate, eventEndTime);
        if (eventLocation.trim()) payload.location = eventLocation.trim();
      }
      const response = await apiFetch(
        `${import.meta.env.VITE_WEBHOOK_URL}/api/crm/interactions/create`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (!response.ok) throw new Error('Error al iniciar el seguimiento.');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const extraAttendees = (includeContact ? 1 : 0) + selectedCollaboratorItems.length + externalEmails.length;

  return (
    <form ref={formRef} onSubmit={handleSubmit}>

      {/* ── Body ── */}
      <div className="px-5 py-4 space-y-4">

        {/* Nota inicial */}
        <div>
          <FieldLabel required>Nota inicial</FieldLabel>
          <textarea
            value={initialNote}
            onChange={(e) => setInitialNote(e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder="Contexto del primer contacto…"
          />
        </div>

        {/* Siguiente acción */}
        <div>
          <FieldLabel required>Acción siguiente</FieldLabel>
          <textarea
            value={nextActionDesc}
            onChange={(e) => setNextActionDesc(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
            placeholder="Ej: Enviar propuesta por email"
          />
        </div>

        {/* Fecha */}
        <div>
          <FieldLabel required>Fecha</FieldLabel>
          <input type="date" value={nextContactDate} onChange={(e) => setNextContactDate(e.target.value)} className={inputCls} />
        </div>

        {/* Calendario toggle */}
        {canSyncCalendar ? (
          <button
            type="button"
            onClick={() => setAddToCalendar(v => !v)}
            className={`flex items-center gap-2 text-[13px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
              addToCalendar
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {addToCalendar ? <CalendarCheck size={14} className="text-blue-600" /> : <CalendarPlus size={14} />}
            {addToCalendar ? 'En calendario' : 'Agregar al calendario'}
            {addToCalendar && extraAttendees > 0 && (
              <span className="ml-1 text-[10px] font-semibold text-blue-500">
                · +{extraAttendees} invitado{extraAttendees > 1 ? 's' : ''}
              </span>
            )}
          </button>
        ) : (
          <p className="text-[11px] text-slate-400">Activa la sincronización de calendario en ajustes para crear eventos.</p>
        )}

        {/* Panel de detalles del evento - Panel Body */}
        {addToCalendar && canSyncCalendar && (
          <>
            {isFloating ? (
              createPortal(
                <div style={floatStyle} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xl">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                    <CalendarCheck size={13} className="text-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Detalles del evento</span>
                  </div>
                  <div className="px-5 py-5 space-y-5 bg-slate-50/50 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
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
                            if (e.key === 'Enter' && externalCandidate) { e.preventDefault(); addExternalEmail(externalCandidate); }
                            if (e.key === 'Escape') inputRef.current?.blur();
                          }}
                          className="w-full pl-7 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300"
                          placeholder="Nombre o correo…"
                        />
                      </div>
                      {extraAttendees > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {includeContact && contact.email && (
                            <Chip
                              avatar={<Avatar src={null} name={contactName} size="xs" />}
                              label={contactName}
                              onRemove={() => setIncludeContact(false)}
                            />
                          )}
                          {selectedCollaboratorItems.map(c => (
                            <Chip key={c.id} avatar={<Avatar src={c.avatar} name={c.name} size="xs" />} label={c.name} onRemove={() => toggleCollaborator(c.id)} />
                          ))}
                          {externalEmails.map(email => (
                            <Chip key={email} avatar={null} label={email} onRemove={() => setExternalEmails(prev => prev.filter(x => x !== email))} />
                          ))}
                        </div>
                      )}
                      <AttendeeDropdown
                        inputRef={inputRef} visible={dropdownVisible}
                        externalCandidate={externalCandidate} includeContact={includeContact}
                        contactEmail={contact.email || ''} contactName={contactName}
                        suggestionItems={suggestionItems}
                        onAddExternal={addExternalEmail}
                        onAddContact={() => { setIncludeContact(true); setCollaboratorQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
                        onAddCollaborator={addCollaborator}
                      />
                    </div>
                  </div>
                </div>,
                document.body
              )
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                  <CalendarCheck size={13} className="text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Detalles del evento</span>
                </div>
                <div className="px-5 py-5 space-y-5 bg-slate-50/50">

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
                          if (e.key === 'Enter' && externalCandidate) { e.preventDefault(); addExternalEmail(externalCandidate); }
                          if (e.key === 'Escape') inputRef.current?.blur();
                        }}
                        className="w-full pl-7 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-300"
                        placeholder="Nombre o correo…"
                      />
                    </div>
                    {extraAttendees > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {includeContact && contact.email && (
                          <Chip
                            avatar={<Avatar src={null} name={contactName} size="xs" />}
                            label={contactName}
                            onRemove={() => setIncludeContact(false)}
                          />
                        )}
                        {selectedCollaboratorItems.map(c => (
                          <Chip key={c.id} avatar={<Avatar src={c.avatar} name={c.name} size="xs" />} label={c.name} onRemove={() => toggleCollaborator(c.id)} />
                        ))}
                        {externalEmails.map(email => (
                          <Chip key={email} avatar={null} label={email} onRemove={() => setExternalEmails(prev => prev.filter(x => x !== email))} />
                        ))}
                      </div>
                    )}
                    <AttendeeDropdown
                      inputRef={inputRef} visible={dropdownVisible}
                      externalCandidate={externalCandidate} includeContact={includeContact}
                      contactEmail={contact.email || ''} contactName={contactName}
                      suggestionItems={suggestionItems}
                      onAddExternal={addExternalEmail}
                      onAddContact={() => { setIncludeContact(true); setCollaboratorQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
                      onAddCollaborator={addCollaborator}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
            <span className="text-red-400 shrink-0 text-[13px]">⚠</span>
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex justify-end gap-2 z-10">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !initialNote.trim() || !nextActionDesc.trim() || !nextContactDate}
          className="px-4 py-2 text-[13px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {isSubmitting ? <LoaderCircle size={13} className="animate-spin" /> : 'Iniciar seguimiento'}
        </button>
      </div>
    </form>
  );
};

export default StartFollowUpModal;