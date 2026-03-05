import React, { useRef, useEffect, useCallback } from 'react';
import { ClientContact, User, Deal } from '../../types';
import { SectionLoader, ButtonLoader, SimpleSpinner } from '../../components/AppLoaders';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Attendee {
  email: string;
  name?: string;
  type: 'contact' | 'user' | 'external';
  id?: string;
  is_organizer?: boolean;
}

interface EventFormData {
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

interface EventModalProps {
  isOpen: boolean;
  isEditing: boolean;
  submitting: boolean;
  formData: EventFormData;
  attendees: Attendee[];
  attendeeInput: string;
  showAttendeeSuggestions: boolean;
  dealSearchInput: string;
  showDealSuggestions: boolean;
  selectedDeal: Deal | null;
  deals: Deal[];
  dealsLoading: boolean;
  dealsLoaded: boolean;
  contacts: ClientContact[];
  users: User[];
  currentUserId?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onAddAttendee: (attendee: Attendee) => void;
  onRemoveAttendee: (email: string) => void;
  onAttendeeInputChange: (value: string) => void;
  onSetShowAttendeeSuggestions: (show: boolean) => void;
  onAddExternalAttendee: () => void;
  onDealSearchChange: (value: string) => void;
  onSetShowDealSuggestions: (show: boolean) => void;
  onSelectDeal: (deal: Deal) => void;
  onClearDeal: () => void;
  onFetchDeals: () => void;
  getAttendeeSuggestions: () => Attendee[];
  getContactsByCompany: (companyId: string) => ClientContact[];
}

// ── INLINE ICONS ───────────────────────────────────────────────────────────
// FIX: IconX now accepts size prop so it can be reused at different sizes
const IconX: React.FC<{ className?: string; size?: number }> = ({ className, size = 12 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCalendar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconLocation: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconVideo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);
const IconBriefcase: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconUsers: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconPen = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconDescription: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

// ── TIME HELPERS ──────────────────────────────────────────────────────────
const formatTimeInput = (input: string): string => {
  if (!input) return '';
  input = input.trim();
  if (input.match(/^\d:/) && !input.match(/^\d\d:/)) input = '0' + input;
  if (input.match(/^\d{1,2}$/) && !input.includes(':')) input = input.padStart(2, '0') + ':00';
  if (!input.match(/^\d{2}:\d{2}$/)) return '';
  return input;
};

const calculateTimeDifference = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return '';
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const diff = (endH * 60 + endM) - (startH * 60 + startM);
  if (diff <= 0) return '';
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  if (minutes === 30) return `${hours}.5h`;
  return `${hours}h ${minutes}min`;
};

const generateTimeOptions = (): string[] => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return times;
};

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
};

const formatTimeDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const time = dateStr.split('T')[1] || '';
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
};

// ── TIME DROPDOWN ─────────────────────────────────────────────────────────
// FIX: Extracted to own component so it auto-scrolls to selected time on open
interface TimeDropdownProps {
  options: string[];
  selected: string;
  startTime?: string;
  onSelect: (time: string) => void;
  showDiff?: boolean;
}

const TimeDropdown: React.FC<TimeDropdownProps> = ({ options, selected, startTime, onSelect, showDiff }) => {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll to selected time when dropdown opens
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const filtered = startTime
    ? options.filter(time => {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = time.split(':').map(Number);
        return eH * 60 + eM > sH * 60 + sM;
      })
    : options;

  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
      style={{ minWidth: showDiff ? '120px' : '80px' }}
    >
      {filtered.map(time => {
        const diff = showDiff && startTime ? calculateTimeDifference(startTime, time) : null;
        const isSelected = time === selected;
        return (
          <button
            key={time}
            ref={isSelected ? selectedRef : null}
            type="button"
            onClick={() => onSelect(time)}
            className={`w-full px-3 py-1.5 text-sm hover:bg-gray-100 flex justify-between gap-2 ${
              isSelected ? 'bg-blue-50 text-blue-600 font-medium' : ''
            }`}
          >
            <span>{time}</span>
            {diff && <span className={`text-xs ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>({diff})</span>}
          </button>
        );
      })}
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export const EventModal: React.FC<EventModalProps> = ({
  isOpen, isEditing, submitting,
  formData, attendees, attendeeInput, showAttendeeSuggestions,
  dealSearchInput, showDealSuggestions, selectedDeal, deals, dealsLoading, dealsLoaded,
  onClose, onSubmit, onInputChange,
  onAddAttendee, onRemoveAttendee, onAttendeeInputChange, onSetShowAttendeeSuggestions, onAddExternalAttendee,
  onDealSearchChange, onSetShowDealSuggestions, onSelectDeal, onClearDeal, onFetchDeals,
  getAttendeeSuggestions,
}) => {
  const titleRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [showStartTime, setShowStartTime] = React.useState(false);
  const [showEndTime, setShowEndTime] = React.useState(false);
  const [startTimeInput, setStartTimeInput] = React.useState('09:00');
  const [endTimeInput, setEndTimeInput] = React.useState('10:00');

  const timeOptions = React.useMemo(() => generateTimeOptions(), []);

  useEffect(() => {
    if (isOpen) setTimeout(() => titleRef.current?.focus(), 60);
  }, [isOpen]);

  // FIX: Only depend on isOpen to avoid infinite loop if parent doesn't memoize onFetchDeals
  useEffect(() => {
    if (isOpen && !dealsLoaded) onFetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setStartTimeInput(formatTimeDisplay(formData.start) || '09:00');
      setEndTimeInput(formatTimeDisplay(formData.end) || '10:00');
    }
  }, [isOpen, formData.start, formData.end]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowStartTime(false);
        setShowEndTime(false);
        onSetShowDealSuggestions(false);
        onSetShowAttendeeSuggestions(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSetShowDealSuggestions, onSetShowAttendeeSuggestions]);

  // FIX: Extracted shared end-time adjustment logic to avoid duplication
  const adjustEndIfNeeded = useCallback((startTime: string, date: string) => {
    const currentEnd = formatTimeDisplay(formData.end) || '10:00';
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = currentEnd.split(':').map(Number);
    if (eH * 60 + eM <= sH * 60 + sM) {
      const newMins = sH * 60 + sM + 60;
      const newEnd = `${Math.floor(newMins / 60) % 24}`.padStart(2, '0') + ':' + `${newMins % 60}`.padStart(2, '0');
      onInputChange({ target: { name: 'end', value: `${date}T${newEnd}` } } as any);
      setEndTimeInput(newEnd);
    }
  }, [formData.end, onInputChange]);

  if (!isOpen) return null;

  const currentDate = formData.start ? formData.start.split('T')[0] : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* HEADER */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm ${isEditing ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
              {isEditing ? <IconPen /> : <IconCalendar />}
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors shrink-0"
            title="Cerrar"
          >
            <IconX />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-5 space-y-4">
            <input
              ref={titleRef}
              type="text" name="title" required
              value={formData.title} onChange={onInputChange}
              className="w-full text-2xl font-semibold text-gray-900 placeholder-gray-400 outline-none border-0 p-0"
              placeholder="Agregar título"
            />

            <div className="flex flex-col md:flex-row md:items-center md:gap-6 gap-3">
              {/* Date */}
              <div className="flex items-center gap-3 flex-1 md:flex-none">
                <IconCalendar className="w-5 h-5 text-gray-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="text-sm text-gray-700 hover:text-gray-900 font-medium focus:outline-none hover:underline"
                >
                  {formatDateDisplay(formData.start) || 'Selecciona fecha'}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={currentDate}
                  onChange={e => {
                    const date = e.target.value;
                    const startTime = formData.start ? formData.start.split('T')[1] || '09:00' : '09:00';
                    const endTime = formData.end ? formData.end.split('T')[1] || '10:00' : '10:00';
                    onInputChange({ target: { name: 'start', value: `${date}T${startTime}` } } as any);
                    onInputChange({ target: { name: 'end', value: `${date}T${endTime}` } } as any);
                  }}
                  className="absolute opacity-0 pointer-events-none"
                />
              </div>

              {!formData.is_all_day && (
                <div className="flex items-center gap-3">
                  {/* Start time */}
                  <div className="relative">
                    <input
                      type="text"
                      value={startTimeInput}
                      onChange={e => setStartTimeInput(e.target.value)}
                      onBlur={e => {
                        const formatted = formatTimeInput(e.target.value);
                        if (formatted) {
                          onInputChange({ target: { name: 'start', value: `${currentDate}T${formatted}` } } as any);
                          setStartTimeInput(formatted);
                          adjustEndIfNeeded(formatted, currentDate);
                        } else {
                          setStartTimeInput(formatTimeDisplay(formData.start) || '09:00');
                        }
                        setTimeout(() => setShowStartTime(false), 150);
                      }}
                      onFocus={() => setShowStartTime(true)}
                      className="w-16 px-2 py-1 text-sm text-center border-0 bg-transparent text-gray-700 hover:bg-gray-100 rounded focus:outline-none"
                    />
                    {showStartTime && (
                      <TimeDropdown
                        options={timeOptions}
                        selected={startTimeInput}
                        onSelect={time => {
                          onInputChange({ target: { name: 'start', value: `${currentDate}T${time}` } } as any);
                          setStartTimeInput(time);
                          adjustEndIfNeeded(time, currentDate);
                          setShowStartTime(false);
                        }}
                      />
                    )}
                  </div>

                  <span className="text-gray-400 text-xs">–</span>

                  {/* End time */}
                  <div className="relative">
                    <input
                      type="text"
                      value={endTimeInput}
                      onChange={e => setEndTimeInput(e.target.value)}
                      onBlur={e => {
                        const formatted = formatTimeInput(e.target.value);
                        if (formatted) {
                          const startTime = formatTimeDisplay(formData.start) || '09:00';
                          const [sH, sM] = startTime.split(':').map(Number);
                          const [eH, eM] = formatted.split(':').map(Number);
                          if (eH * 60 + eM > sH * 60 + sM) {
                            onInputChange({ target: { name: 'end', value: `${currentDate}T${formatted}` } } as any);
                            setEndTimeInput(formatted);
                          } else {
                            adjustEndIfNeeded(startTime, currentDate);
                          }
                        } else {
                          setEndTimeInput(formatTimeDisplay(formData.end) || '10:00');
                        }
                        setTimeout(() => setShowEndTime(false), 150);
                      }}
                      onFocus={() => setShowEndTime(true)}
                      className="w-16 px-2 py-1 text-sm text-center border-0 bg-transparent text-gray-700 hover:bg-gray-100 rounded focus:outline-none"
                    />
                    {showEndTime && (
                      <TimeDropdown
                        options={timeOptions}
                        selected={endTimeInput}
                        startTime={formatTimeDisplay(formData.start) || '09:00'}
                        onSelect={time => {
                          onInputChange({ target: { name: 'end', value: `${currentDate}T${time}` } } as any);
                          setEndTimeInput(time);
                          setShowEndTime(false);
                        }}
                        showDiff
                      />
                    )}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_all_day"
                  checked={formData.is_all_day}
                  onChange={onInputChange}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-xs text-gray-600">Todo el día</span>
              </label>
            </div>

            <hr className="border-gray-100" />

            <div className="space-y-3">
              {/* Trato Relacionado */}
              <div className="relative">
                <div className="flex items-center gap-3">
                  <IconBriefcase className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 w-full">
                    {selectedDeal ? (
                      <div className="bg-gray-100 px-3 py-2 rounded">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-medium text-sm text-gray-900 truncate flex-1">{selectedDeal.nombre_trato}</div>
                          {/* FIX: size prop instead of broken className on IconX */}
                          <button type="button" onClick={onClearDeal} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                            <IconX size={14} />
                          </button>
                        </div>
                        {selectedDeal.client_company_name && (
                          <div className="text-xs text-gray-600 truncate mb-1">{selectedDeal.client_company_name}</div>
                        )}
                        {selectedDeal.contact_name && (
                          <div className="text-xs text-gray-500 italic">Contacto principal: {selectedDeal.contact_name}</div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={dealSearchInput}
                        onChange={e => { onDealSearchChange(e.target.value); onSetShowDealSuggestions(true); }}
                        onFocus={() => onSetShowDealSuggestions(true)}
                        onBlur={() => setTimeout(() => onSetShowDealSuggestions(false), 150)}
                        placeholder="Buscar trato relacionado"
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand-500"
                      />
                    )}
                  </div>
                </div>
                {showDealSuggestions && (
                  <div className="absolute z-50 top-full left-8 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {dealsLoading
                      ? <div className="p-2 flex justify-center"><SimpleSpinner size="sm" /></div>
                      : (() => {
                          const normalizeText = (value: string) =>
                            value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                          const searchTerms = normalizeText(dealSearchInput)
                            .split(/\s+/)
                            .filter(Boolean);

                          const filteredDeals = deals.filter(deal => {
                            const searchableText = normalizeText([
                              deal.nombre_trato || '',
                              deal.client_company_name || '',
                              deal.contact_name || ''
                            ].join(' '));

                            return searchTerms.every(term => searchableText.includes(term));
                          });

                          return filteredDeals.length === 0
                            ? <div className="p-2 text-xs text-gray-400">Sin resultados</div>
                            : filteredDeals.map(deal => (
                                <button key={deal.id_trato} type="button" onMouseDown={() => onSelectDeal(deal)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                  <div className="font-medium text-gray-900">{deal.nombre_trato}</div>
                                  {deal.client_company_name && <div className="text-gray-500 text-xs">{deal.client_company_name}</div>}
                                </button>
                              ));
                        })()
                    }
                  </div>
                )}
              </div>

              {/* Invitados */}
              <div className="flex items-start gap-3">
                <IconUsers className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1 w-full relative">
                  <input
                    type="text"
                    value={attendeeInput}
                    onChange={e => onAttendeeInputChange(e.target.value)}
                    onFocus={() => onSetShowAttendeeSuggestions(true)}
                    onBlur={() => setTimeout(() => onSetShowAttendeeSuggestions(false), 150)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddExternalAttendee(); } }}
                    placeholder="Agregar invitados (email)"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand-500"
                  />
                  {attendees.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attendees.map(att => (
                        <div key={att.email} className="bg-gray-100 px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 whitespace-nowrap group relative" title={att.email}>
                          <span className="truncate flex-1 max-w-[150px]">{att.name || att.email}</span>
                          <button type="button" onClick={() => onRemoveAttendee(att.email)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                            <IconX />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {att.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showAttendeeSuggestions && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {getAttendeeSuggestions().map((s, idx) => (
                        <button key={idx} type="button" onMouseDown={() => onAddAttendee(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <div className="font-medium text-gray-900">{s.name || s.email}</div>
                          <div className="text-gray-500">{s.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Video */}
              <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  name="generate_meeting"
                  checked={formData.generate_meeting}
                  onChange={onInputChange}
                  className="w-4 h-4 rounded"
                />
                <IconVideo className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700">Generar videollamada</span>
              </label>

              {/* Lugar */}
              <div className="flex items-center gap-3">
                <IconLocation className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  type="text" name="location"
                  value={formData.location} onChange={onInputChange}
                  placeholder="Agregar lugar"
                  className="flex-1 text-sm border-0 p-0 bg-transparent focus:underline outline-none"
                />
              </div>

              {/* Descripción */}
              <div className="flex gap-3">
                <IconDescription className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <textarea
                  name="description"
                  value={formData.description} onChange={onInputChange}
                  placeholder="Agregar descripción" rows={2}
                  className="flex-1 text-sm border border-gray-200 rounded p-2 outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-gray-400 hidden sm:flex items-center gap-1.5">
              <IconShield />
              Se sincroniza con tu calendario
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={submitting}
                className={`px-5 py-2 text-sm font-bold text-white rounded-lg flex items-center gap-2 ${
                  submitting ? 'bg-gray-600' : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {submitting ? <ButtonLoader size="sm" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};