import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import Toast from '../../components/Toast';

// ── TYPES ────────────────────────────────────────────────────────────────────
type RSVPAction = 'accepted' | 'declined' | 'tentative';
type RSVPStatus = RSVPAction | 'needsAction';

interface EventAttendee {
  email: string;
  name?: string;
  avatar?: string;
  status?: string;
  is_me?: boolean;
  is_organizer?: boolean;
}

interface EventDetail {
  id?: string;
  id_event?: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  is_all_day?: boolean;
  color?: string;
  type?: string;
  location?: string;
  meeting_url?: string;
  meeting_platform?: string;
  deal_id?: string;
  deal_title?: string;
  quote_number?: string | number;
  attendees?: EventAttendee[];
  my_response_status?: string;
  can_edit?: boolean;
  can_delete?: boolean;
  editable?: boolean;
  permissions?: {
    can_edit?: boolean;
    can_delete?: boolean;
  };
}

interface EventDetailModalProps {
  isOpen: boolean;
  loadingDetail: boolean;
  selectedEventDetail: EventDetail[] | null;
  currentUserEmail?: string;
  onClose: () => void;
  onEdit: (event: EventDetail) => void;
  onDeleteClick: () => void;
  onRSVPClick: (action: RSVPAction) => void;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt2        = (n: number): string => n.toString().padStart(2, '0');
const DAYS_ES     = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS_ES   = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formatDate  = (d: Date): string => `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
const formatTime  = (d: Date): string => `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
const isAllDay    = (ev: EventDetail): boolean => Boolean(ev.allDay || ev.is_all_day);
const getInitials = (email: string): string => email.split('@')[0].slice(0, 2).toUpperCase();

const normalizeStatus = (s?: string): RSVPStatus | null => {
  if (!s) return null;
  if (s === 'needs_action' || s === 'needsAction') return 'needsAction';
  if (s === 'accepted' || s === 'declined' || s === 'tentative') return s as RSVPAction;
  return null;
};

// ── ICONS (SVG inline — sin dependencias externas) ────────────────────────────
const IconX         = ({ size = 14 }: { size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCal       = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconClock     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconPin       = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconVideo     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
const IconDoc       = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconUsers     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconBriefcase = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
const IconCopy      = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IconPen       = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const RSVP_LABELS: Record<RSVPStatus, string> = {
  accepted:    'Aceptado',
  declined:    'Rechazado',
  tentative:   'Tentativo',
  needsAction: 'Sin responder',
};

const STATUS_DOT: Record<RSVPStatus, string> = {
  accepted:    'bg-emerald-400',
  declined:    'bg-red-400',
  tentative:   'bg-amber-400',
  needsAction: 'bg-gray-300',
};

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

// Fila de metadato: icono + contenido
const MetaRow: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-start gap-3">
    <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
    <div className="flex-1 min-w-0 text-sm text-gray-700">{children}</div>
  </div>
);

// Fila de asistente con avatar + dot de estado
const AttendeeRow: React.FC<{ attendee: EventAttendee; color?: string }> = ({ attendee, color }) => {
  const status = normalizeStatus(attendee.status) ?? 'needsAction';
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="relative shrink-0">
        {attendee.avatar ? (
          <img src={attendee.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: color || '#94a3b8' }}
          >
            {getInitials(attendee.email)}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_DOT[status]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-gray-800 truncate">
            {attendee.name || attendee.email}
          </span>
          {attendee.is_me && (
            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-semibold tracking-wide">
              TÚ
            </span>
          )}
          {attendee.is_organizer && (
            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded tracking-wide">
              organizador
            </span>
          )}
        </div>
        {attendee.name && (
          <p className="text-[10px] text-gray-400 truncate">{attendee.email}</p>
        )}
      </div>
      <span className="text-[10px] text-gray-400 shrink-0">{RSVP_LABELS[status]}</span>
    </div>
  );
};

// Sección RSVP — botones solo visibles cuando no hay respuesta o al hacer clic en respuesta actual
const RSVPSection: React.FC<{ 
  myStatus: RSVPStatus | null; 
  showButtons: boolean;
  onRSVPClick: (a: RSVPAction) => void;
  onStatusClick: () => void;
}> = ({ myStatus, showButtons, onRSVPClick, onStatusClick }) => {
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Scroll automático cuando aparecen los botones
  useEffect(() => {
    if (showButtons && buttonsRef.current) {
      buttonsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showButtons]);

  const getButtonClass = (action: RSVPAction, isActive: boolean) => {
    const baseClass = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors';
    
    if (!isActive) {
      return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
    }
    
    if (action === 'accepted') {
      return `${baseClass} bg-green-600 hover:bg-green-700 text-white`;
    } else if (action === 'tentative') {
      return `${baseClass} bg-yellow-500 hover:bg-yellow-600 text-white`;
    } else {
      return `${baseClass} bg-red-600 hover:bg-red-700 text-white`;
    }
  };

  const getStatusBadgeClass = (status: RSVPStatus) => {
    const baseClass = 'px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md';
    if (status === 'accepted') {
      return `${baseClass} bg-green-600 text-white hover:bg-green-700`;
    } else if (status === 'tentative') {
      return `${baseClass} bg-yellow-500 text-white hover:bg-yellow-600`;
    } else if (status === 'declined') {
      return `${baseClass} bg-red-600 text-white hover:bg-red-700`;
    }
    return baseClass;
  };

  // Si no hay respuesta, siempre mostrar botones
  const shouldShowButtons = showButtons || !myStatus || myStatus === 'needsAction';

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      {shouldShowButtons ? (
        <>
          <p className="text-xs text-gray-500">¿Asistirás a este evento?</p>
          <div ref={buttonsRef} className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onRSVPClick('accepted')}
              className={getButtonClass('accepted', myStatus === 'accepted')}
            >
              <i className="fa-solid fa-check mr-1" /> Aceptar
            </button>
            <button
              onClick={() => onRSVPClick('tentative')}
              className={getButtonClass('tentative', myStatus === 'tentative')}
            >
              <i className="fa-solid fa-question mr-1" /> Tal vez
            </button>
            <button
              onClick={() => onRSVPClick('declined')}
              className={getButtonClass('declined', myStatus === 'declined')}
            >
              <i className="fa-solid fa-times mr-1" /> Rechazar
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Estado actual:</p>
          <button
            onClick={onStatusClick}
            className={getStatusBadgeClass(myStatus!)}
            title="Haz clic para cambiar tu respuesta"
          >
            {RSVP_LABELS[myStatus!]}
          </button>
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen, loadingDetail, selectedEventDetail,
  currentUserEmail,
  onClose, onEdit, onDeleteClick, onRSVPClick,
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [localMyStatus, setLocalMyStatus] = useState<RSVPStatus | null>(null);
  const [showRSVPButtons, setShowRSVPButtons] = useState(true);

  const event     = selectedEventDetail?.[0] ?? null;
  const startDate = useMemo(() => event ? new Date(event.start) : null, [event]);
  const endDate   = useMemo(() => event ? new Date(event.end)   : null, [event]);
  const myStatus  = localMyStatus || normalizeStatus(event?.my_response_status);
  const attendees = event?.attendees ?? [];

  const myAttendee = useMemo(() => {
    if (!attendees.length) return null;
    const byFlag = attendees.find(a => a.is_me);
    if (byFlag) return byFlag;
    if (!currentUserEmail) return null;
    return attendees.find(a => a.email?.toLowerCase() === currentUserEmail.toLowerCase()) ?? null;
  }, [attendees, currentUserEmail]);

  const canEditEvent = useMemo(() => {
    if (!event) return false;
    return Boolean(myAttendee?.is_organizer);
  }, [event, myAttendee]);

  const canDeleteEvent = useMemo(() => {
    if (!event) return false;
    return Boolean(myAttendee?.is_organizer);
  }, [event, myAttendee]);

  const isOrganizer = Boolean(myAttendee?.is_organizer);

  // Sincronizar estado local cuando cambia el evento
  useEffect(() => {
    const status = normalizeStatus(event?.my_response_status);
    setLocalMyStatus(status);
    // Mostrar botones solo si no hay respuesta aún
    setShowRSVPButtons(!status || status === 'needsAction');
  }, [event?.my_response_status]);

  const handleRSVPClick = (action: RSVPAction) => {
    // Solo pasar al Calendar que abre el modal de confirmación
    // No hacer cambio optimista aquí
    onRSVPClick(action);
    // Ocultar botones después de seleccionar
    setShowRSVPButtons(false);
  };

  const handleStatusClick = () => {
    // Mostrar botones cuando el usuario hace clic en su respuesta actual
    setShowRSVPButtons(true);
  };

  const handleCopyLink = async (url: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setToast({ message: 'Link copiado', type: 'success' });
    } catch {
      setToast({ message: 'No se pudo copiar', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-[2px]"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal card */}
        <div
          className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 2rem)' }}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: event?.color || '#94a3b8' }}
              />
              <div className="min-w-0">
                {loadingDetail ? (
                  <div className="h-5 w-40 bg-gray-100 animate-pulse rounded" />
                ) : (
                  <h2 className="text-base font-semibold text-gray-900 leading-snug truncate">
                    {event?.title ?? '—'}
                  </h2>
                )}
                {event?.type && (
                  <p className="text-xs text-gray-400 mt-0.5">{event.type}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <IconX />
            </button>
          </div>

          {/* ── BODY ───────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingDetail ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
                <BrandSpinner size="md" />
                <span className="text-sm">Cargando…</span>
              </div>
            ) : !event || !startDate || !endDate ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                No se pudo cargar el evento
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">

                {/* Fecha / hora / ubicación */}
                <div className="space-y-2">
                  <MetaRow icon={<IconCal />}>
                    <span className="capitalize">{formatDate(startDate)}</span>
                  </MetaRow>
                  {isAllDay(event) ? (
                    <MetaRow icon={<IconClock />}>Todo el día</MetaRow>
                  ) : (
                    <MetaRow icon={<IconClock />}>
                      {formatTime(startDate)} – {formatTime(endDate)}
                    </MetaRow>
                  )}
                  {event.location && (
                    <MetaRow icon={<IconPin />}>{event.location}</MetaRow>
                  )}
                </div>

                {/* Videollamada */}
                {event.meeting_url && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 shrink-0">
                      <IconVideo />
                    </span>
                    <div className="flex-1 min-w-0">
                      {event.meeting_platform && (
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                          {event.meeting_platform.replace('_', ' ')}
                        </p>
                      )}
                      <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-700 hover:text-gray-900 underline underline-offset-2 truncate block"
                      >
                        {event.meeting_url}
                      </a>
                    </div>
                    <button
                      onClick={() => handleCopyLink(event.meeting_url!)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                      title="Copiar link"
                    >
                      <IconCopy />
                    </button>
                  </div>
                )}

                {/* Descripción */}
                {event.description && (
                  <>
                    <hr className="border-gray-100" />
                    <MetaRow icon={<IconDoc />}>
                      <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">
                        {event.description}
                      </p>
                    </MetaRow>
                  </>
                )}

                {/* Trato / cotización */}
                {(event.deal_title || event.quote_number) && (
                  <>
                    <hr className="border-gray-100" />
                    <div className="space-y-2">
                      {event.deal_title && (
                        <MetaRow icon={<IconBriefcase />}>
                          <span className="text-gray-700">{event.deal_title}</span>
                        </MetaRow>
                      )}
                      {event.quote_number && (
                        <MetaRow icon={<IconDoc />}>
                          <span className="text-gray-700">Cotización #{event.quote_number}</span>
                        </MetaRow>
                      )}
                    </div>
                  </>
                )}

                {/* Asistentes */}
                {attendees.length > 0 && (
                  <>
                    <hr className="border-gray-100" />
                    <MetaRow icon={<IconUsers />}>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {attendees.length} asistente{attendees.length !== 1 ? 's' : ''}
                      </p>
                      <div className="divide-y divide-gray-50">
                        {attendees.map((att, i) => (
                          <AttendeeRow
                            key={`${att.email}-${i}`}
                            attendee={att}
                            color={event.color}
                          />
                        ))}
                      </div>
                    </MetaRow>
                  </>
                )}

                {/* RSVP */}
                {!isOrganizer && (
                  <RSVPSection 
                    myStatus={myStatus} 
                    showButtons={showRSVPButtons}
                    onRSVPClick={handleRSVPClick}
                    onStatusClick={handleStatusClick}
                  />
                )}

              </div>
            )}
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          {!loadingDetail && event && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {canEditEvent && (
                  <button
                    onClick={() => onEdit(event)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <IconPen /> Editar
                  </button>
                )}
                {canDeleteEvent && (
                  <button
                    onClick={onDeleteClick}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <IconTrash /> Eliminar
                  </button>
                )}
                {!canEditEvent && !canDeleteEvent && (
                  <span className="text-[11px] text-gray-400 font-medium">
                    Solo lectura
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
};