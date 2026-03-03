import React, { useMemo, useRef, useCallback, memo, useEffect, useState } from 'react';
import { CalendarEvent } from '../../types';

// ── TYPES ────────────────────────────────────────────────────────────────────
export interface ViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onOpenModal: (date?: Date, hour?: number) => void;
  onEventClick: (eventId: string) => void;
  onNavigate?: (dir: 'prev' | 'next') => void; // para swipe
}

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const HOUR_HEIGHT_MD = 64;
const HOUR_HEIGHT_SM = 52;
const HOURS          = Array.from({ length: 24 }, (_, i) => i);
const DAYS_SHORT     = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAYS_ES        = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const WEEKDAYS_ES    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES      = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── PURE HELPERS ──────────────────────────────────────────────────────────────
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const toMinutes  = (d: Date) => d.getHours() * 60 + d.getMinutes();
const fmt2       = (n: number) => n.toString().padStart(2, '0');
const fmtTime    = (d: Date) => `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
const getInitials = (email: string) => email.split('@')[0].slice(0, 2).toUpperCase();

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const layoutEvents = (dayEvents: CalendarEvent[], hourHeight: number): PositionedEvent[] => {
  const sorted = [...dayEvents]
    .filter(e => !e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  type Base = { event: CalendarEvent; startMin: number; endMin: number; top: number; height: number };

  const base: Base[] = sorted.map(ev => {
    const s    = new Date(ev.start);
    const e    = new Date(ev.end);
    const sMin = toMinutes(s);
    const eMin = Math.max(toMinutes(e), sMin + 30);
    return {
      event:    ev,
      startMin: sMin,
      endMin:   eMin,
      top:      (sMin / 60) * hourHeight,
      height:   Math.max(((eMin - sMin) / 60) * hourHeight, 24),
    };
  });

  const groups: Base[][] = [];
  let group: Base[] = [], groupEnd = -1;
  base.forEach(item => {
    if (!group.length || item.startMin < groupEnd) {
      group.push(item);
      groupEnd = Math.max(groupEnd, item.endMin);
    } else {
      groups.push(group);
      group = [item];
      groupEnd = item.endMin;
    }
  });
  if (group.length) groups.push(group);

  const result: PositionedEvent[] = [];
  groups.forEach(g => {
    const active: Array<{ endMin: number; col: number }> = [];
    let maxCol = 0;
    const cols: number[] = [];
    g.forEach(item => {
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].endMin <= item.startMin) active.splice(i, 1);
      }
      const used = new Set(active.map(a => a.col));
      let col = 0;
      while (used.has(col)) col++;
      active.push({ endMin: item.endMin, col });
      maxCol = Math.max(maxCol, col);
      cols.push(col);
    });
    const totalCols = maxCol + 1;
    g.forEach((item, i) => result.push({ ...item, col: cols[i], totalCols }));
  });
  return result;
};

// ── HOOK: swipe horizontal ─────────────────────────────────────────────────
const useSwipe = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    // Solo disparar si el swipe es más horizontal que vertical
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? onSwipeLeft() : onSwipeRight();
    }
    startX.current = null;
    startY.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
};

// ── HOOK: tamaño de pantalla ───────────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
};

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

// Chip compacto — mes y all-day
const EventChip = memo<{ event: CalendarEvent; onClick: () => void; compact?: boolean }>(
  ({ event, onClick, compact }) => {
    const start = new Date(event.start);
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        className="w-full text-left truncate flex items-center gap-1 hover:opacity-75 transition-opacity"
        style={{
          padding: compact ? '1px 4px' : '2px 6px',
          borderRadius: 3,
          fontSize: compact ? 9 : 10,
          lineHeight: '14px',
          backgroundColor: event.color ? `${event.color}18` : '#f1f5f9',
          color: event.color || '#475569',
          borderLeft: `2px solid ${event.color || '#94a3b8'}`,
        }}
        title={event.title}
      >
        {!event.allDay && (
          <span className="shrink-0 opacity-55 tabular-nums">
            {fmt2(start.getHours())}:{fmt2(start.getMinutes())}
          </span>
        )}
        <span className="truncate font-medium">{event.title}</span>
        {event.meeting_url && <i className="fa-solid fa-video shrink-0 opacity-40" style={{ fontSize: 7 }} />}
      </button>
    );
  }
);

// Card de evento en grid de hora
const EventCard = memo<{
  item: PositionedEvent;
  colWidth: number;
  colOffset: number;
  onClick: () => void;
}>(({ item, colWidth, colOffset, onClick }) => {
  const ev      = item.event;
  const start   = new Date(ev.start);
  const end     = new Date(ev.end);
  const isShort = item.height < 38;

  return (
    <div
      data-event-card
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="absolute pointer-events-auto rounded cursor-pointer overflow-hidden group transition-opacity hover:opacity-90"
      style={{
        top:    `${item.top}px`,
        height: `${item.height}px`,
        left:   `${colOffset + 0.5}%`,
        width:  `${colWidth - 1}%`,
        backgroundColor: ev.color ? `${ev.color}14` : '#f8fafc',
        borderLeft: `2px solid ${ev.color || '#94a3b8'}`,
        zIndex: 10,
      }}
      title={ev.title}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col overflow-hidden">
        {isShort ? (
          <p className="text-[9px] font-semibold truncate leading-none mt-0.5" style={{ color: ev.color || '#334155' }}>
            {ev.title}
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-0.5">
              <p className="text-[10px] font-semibold leading-tight line-clamp-2 flex-1" style={{ color: ev.color || '#334155' }}>
                {ev.title}
              </p>
              {ev.meeting_url && <i className="fa-solid fa-video text-[7px] shrink-0 opacity-40 mt-0.5" />}
            </div>
            <p className="text-[9px] opacity-45 tabular-nums mt-0.5 shrink-0">
              {fmtTime(start)}–{fmtTime(end)}
            </p>
            {(ev.attendees?.length ?? 0) > 0 && item.height > 60 && (
              <div className="flex mt-1 gap-0.5">
                {ev.attendees!.slice(0, 3).map((att, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                    style={{ backgroundColor: ev.color || '#94a3b8' }}
                    title={att.email}
                  >
                    {getInitials(att.email)}
                  </div>
                ))}
                {(ev.attendees?.length ?? 0) > 3 && (
                  <span className="text-[8px] opacity-35 self-center">+{ev.attendees!.length - 3}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// Fila de hora en grid día/semana
const HourCell = memo<{
  hour: number;
  hourHeight: number;
  showLabel: boolean;
  onClick: () => void;
}>(({ hour, hourHeight, showLabel, onClick }) => (
  <div
    style={{ height: `${hourHeight}px` }}
    className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-colors relative group"
    onClick={onClick}
  >
    {showLabel && hour > 0 && (
      <span className="absolute -top-2.5 left-0 right-0 text-center text-[9px] text-slate-300 tabular-nums pointer-events-none select-none">
        {fmt2(hour)}:00
      </span>
    )}
    {/* línea de media hora */}
    <div className="absolute inset-x-0 top-1/2 border-t border-slate-50" />
  </div>
));

// Modal para mostrar eventos extras del día (cuando se hace click en "+N más")
const DayOverflowModal = memo<{
  isOpen: boolean;
  date: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (id: string) => void;
  onOpenNewEvent: (date: Date) => void;
}>(({ isOpen, date, events, onClose, onEventClick, onOpenNewEvent }) => {
  if (!isOpen || !date) return null;

  const sorted = [...events].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:w-96 max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-800">
            {date.getDate()} de {MONTHS_ES[date.getMonth()]} • {events.length} evento{events.length !== 1 ? 's' : ''}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <i className="fa-solid fa-times text-sm" />
          </button>
        </div>

        {/* Eventos */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
          {sorted.map(ev => {
            const start = new Date(ev.start);
            const end = new Date(ev.end);
            return (
              <button
                key={ev.id}
                onClick={() => { onEventClick(ev.id); onClose(); }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ev.allDay ? 'Todo el día' : `${fmtTime(start)} – ${fmtTime(end)}`}
                  </p>
                  {ev.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ev.description}</p>
                  )}
                </div>
                <div 
                  className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: ev.color || '#94a3b8' }}
                />
              </button>
            );
          })}
        </div>

        {/* Footer con botón de nuevo evento */}
        <div className="border-t border-slate-100 px-4 py-3 shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => { onOpenNewEvent(date); onClose(); }}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <i className="fa-solid fa-plus text-xs" />
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
});

// Lista de eventos para el día seleccionado (MonthView mobile)
const DayAgendaList = memo<{
  date: Date;
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
  onOpenModal: (date: Date) => void;
}>(({ date, events, onEventClick, onOpenModal }) => {
  const sorted = [...events].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-10">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {date.getDate()} de {MONTHS_ES[date.getMonth()]}
        </span>
        <button
          onClick={() => onOpenModal(date)}
          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <i className="fa-solid fa-plus text-[8px]" /> Nuevo
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-300">
          <i className="fa-regular fa-calendar text-2xl mb-2" />
          <p className="text-xs">Sin eventos</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {sorted.map(ev => {
            const start = new Date(ev.start);
            const end   = new Date(ev.end);
            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev.id)}
                className="w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col items-end shrink-0 w-10 mt-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                    {ev.allDay ? 'Todo' : fmtTime(start)}
                  </span>
                  {!ev.allDay && (
                    <span className="text-[10px] text-slate-300 tabular-nums">{fmtTime(end)}</span>
                  )}
                </div>
                <div
                  className="w-0.5 shrink-0 rounded-full self-stretch"
                  style={{ backgroundColor: ev.color || '#94a3b8' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-700 truncate">{ev.title}</p>
                  {ev.location && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      <i className="fa-solid fa-location-dot mr-1 text-[9px]" />{ev.location}
                    </p>
                  )}
                  {ev.meeting_url && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      <i className="fa-solid fa-video mr-1 text-[9px]" />Videollamada
                    </p>
                  )}
                  {(ev.attendees?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      <i className="fa-solid fa-users mr-1 text-[8px]" />
                      {ev.attendees!.length} asistente{ev.attendees!.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── MONTH VIEW ────────────────────────────────────────────────────────────────
// Desktop: grid completo con chips de evento
// Mobile: mini-calendario + lista agenda del día seleccionado
export const MonthView: React.FC<ViewProps> = memo(({ events, currentDate, onOpenModal, onEventClick, onNavigate }) => {
  const isMobile = useIsMobile();
  const today    = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(currentDate);
  const [overflowDaySelected, setOverflowDaySelected] = useState<Date | null>(null);

  // Sincronizar selectedDay cuando cambia el mes
  useEffect(() => { setSelectedDay(currentDate); }, [currentDate]);

  const swipe = useSwipe(
    () => onNavigate?.('next'),
    () => onNavigate?.('prev'),
  );

  const weeks = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    const dow   = first.getDay();
    start.setDate(first.getDate() - (dow === 0 ? 6 : dow - 1));

    const result: Date[][] = [];
    const cursor = new Date(start);
    const last   = new Date(year, month + 1, 0);

    while (cursor <= last || result.length < 5) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(week);
      if (cursor > last && result.length >= 5) break;
    }
    return result;
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(ev => {
      const key = new Date(ev.start).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  // Cuántos eventos mostrar por celda según si es mobile
  const maxVisible = isMobile ? 1 : 7;

  const selectedDayEvents = useMemo(() =>
    eventsByDay.get(selectedDay.toDateString()) ?? [],
  [eventsByDay, selectedDay]);

  // Eventos extras del día seleccionado en el modal de overflow
  const overflowDayEvents = useMemo(() => {
    if (!overflowDaySelected) return [];
    const dayEvs = eventsByDay.get(overflowDaySelected.toDateString()) ?? [];
    return dayEvs.slice(maxVisible);
  }, [eventsByDay, overflowDaySelected, maxVisible]);

  const MiniGrid = (
    <div className={`flex flex-col ${isMobile ? '' : 'h-full'} select-none`} {...(isMobile ? swipe : {})}>
      {/* Header días */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {(isMobile ? DAYS_SHORT : WEEKDAYS_ES).map((d, i) => (
          <div key={i} className={`text-center font-semibold text-slate-400 uppercase tracking-wide
            ${isMobile ? 'py-1.5 text-[10px]' : 'py-2 text-[10px]'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Semanas */}
      <div
        className={`${isMobile ? '' : 'flex-1 overflow-y-auto'} grid overflow-x-hidden`}
        style={{ gridTemplateRows: `repeat(${weeks.length}, ${isMobile ? '40px' : '130px'})` }}
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0 min-h-0">
            {week.map((day, di) => {
              const isToday        = isSameDay(day, today);
              const isSelected     = isMobile && isSameDay(day, selectedDay);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const dayEvs         = eventsByDay.get(day.toDateString()) ?? [];
              const visible        = dayEvs.slice(0, maxVisible);
              const overflow       = dayEvs.length - maxVisible;

              return (
                <div
                  key={di}
                  onClick={() => isMobile ? setSelectedDay(day) : onOpenModal(day)}
                  className={`border-r border-slate-100 last:border-r-0 flex flex-col cursor-pointer transition-colors min-h-0 overflow-hidden
                    ${isMobile ? 'items-center justify-start pt-0.5 gap-0.5' : 'px-1 pt-0.5 pb-1 gap-0.5'}
                    ${isCurrentMonth ? 'hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}
                >
                  {/* Número */}
                  <span className={`flex items-center justify-center rounded-full transition-colors font-semibold shrink-0
                    ${isMobile ? 'w-5 h-5 text-[10px]' : 'w-4 h-4 text-[9px] self-end'}
                    ${isToday && !isSelected ? 'bg-slate-800 text-white'
                      : isSelected ? 'bg-brand-600 text-white'
                      : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}
                  >
                    {day.getDate()}
                  </span>

                  {/* Dots en mobile, chips en desktop */}
                  {isMobile ? (
                    dayEvs.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center px-1">
                        {dayEvs.slice(0, 3).map((ev, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full shrink-0"
                            style={{ backgroundColor: ev.color || '#94a3b8' }}
                          />
                        ))}
                        {dayEvs.length > 3 && (
                          <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1 w-full">
                      {visible.map(ev => (
                        <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev.id)} compact />
                      ))}
                      {overflow > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setOverflowDaySelected(day); }}
                          className="text-[9px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-left px-1.5 font-medium rounded transition-colors"
                        >
                          +{overflow} más
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="shrink-0 border-b border-slate-100">{MiniGrid}</div>
          <DayAgendaList
            date={selectedDay}
            events={selectedDayEvents}
            onEventClick={onEventClick}
            onOpenModal={onOpenModal}
          />
        </div>
        <DayOverflowModal
          isOpen={overflowDaySelected !== null}
          date={overflowDaySelected}
          events={overflowDayEvents}
          onClose={() => setOverflowDaySelected(null)}
          onEventClick={onEventClick}
          onOpenNewEvent={onOpenModal}
        />
      </>
    );
  }

  return (
    <>
      {MiniGrid}
      <DayOverflowModal
        isOpen={overflowDaySelected !== null}
        date={overflowDaySelected}
        events={overflowDayEvents}
        onClose={() => setOverflowDaySelected(null)}
        onEventClick={onEventClick}
        onOpenNewEvent={onOpenModal}
      />
    </>
  );
});

// ── WEEK VIEW ─────────────────────────────────────────────────────────────────
// Desktop: 7 columnas
// Mobile: 3 días visibles + swipe
export const WeekView: React.FC<ViewProps> = memo(({ events, currentDate, onOpenModal, onEventClick, onNavigate }) => {
  const isMobile   = useIsMobile();
  const hourHeight = isMobile ? HOUR_HEIGHT_SM : HOUR_HEIGHT_MD;
  const today      = new Date();
  const scrollRef  = useRef<HTMLDivElement>(null);

  const swipe = useSwipe(
    () => onNavigate?.('next'),
    () => onNavigate?.('prev'),
  );

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // En mobile mostrar 3 días centrados en hoy o currentDate
  const visibleDays = useMemo(() => {
    if (!isMobile) return weekDays;
    const idx = weekDays.findIndex(d => isSameDay(d, currentDate));
    const center = idx >= 0 ? idx : 0;
    const start  = Math.max(0, Math.min(center - 1, weekDays.length - 3));
    return weekDays.slice(start, start + 3);
  }, [isMobile, weekDays, currentDate]);

  const allDayEvents = useMemo(() => events.filter(e => e.allDay), [events]);

  const positionedByDay = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    weekDays.forEach(day => {
      const dayEvs = events.filter(e => !e.allDay && isSameDay(new Date(e.start), day));
      map.set(day.toDateString(), layoutEvents(dayEvs, hourHeight));
    });
    return map;
  }, [events, weekDays, hourHeight]);

  useEffect(() => {
    const now    = new Date();
    const target = Math.max(0, (now.getHours() - 1) * hourHeight);
    scrollRef.current?.scrollTo({ top: target, behavior: 'smooth' });
  }, [hourHeight]);

  // Columna de horas compacta en mobile (cada 2h)
  const hourLabels = isMobile
    ? HOURS.filter(h => h % 2 === 0)
    : HOURS;

  return (
    <div className="flex flex-col h-full" {...swipe}>
      {/* Header */}
      <div className="border-b border-slate-100 bg-white shrink-0 z-20">
        <div className="flex">
          <div className={`shrink-0 ${isMobile ? 'w-8' : 'w-10'}`} />
          {visibleDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={i} className="flex-1 py-2 text-center border-l border-slate-100 first:border-l-0">
                <p className={`font-medium uppercase tracking-wide ${isMobile ? 'text-[9px]' : 'text-[10px]'} text-slate-400`}>
                  {isMobile ? DAYS_SHORT[weekDays.indexOf(day)] : DAYS_ES[weekDays.indexOf(day)]}
                </p>
                <div className={`mx-auto flex items-center justify-center rounded-full font-semibold mt-0.5
                  ${isMobile ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs'}
                  ${isToday ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day strip */}
        {allDayEvents.some(e => visibleDays.some(d => isSameDay(new Date(e.start), d))) && (
          <div className="flex border-t border-slate-100 py-1">
            <div className={`shrink-0 ${isMobile ? 'w-8' : 'w-10'} flex items-center justify-center`}>
            </div>
            {visibleDays.map((day, i) => {
              const evs = allDayEvents.filter(e => isSameDay(new Date(e.start), day));
              return (
                <div key={i} className="flex-1 border-l border-slate-100 first:border-l-0 px-0.5 flex flex-col gap-0.5 min-w-0">
                  {evs.map(ev => <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev.id)} compact={isMobile} />)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ minHeight: `${HOURS.length * hourHeight}px` }}>
          {/* Horas */}
          <div className={`shrink-0 relative bg-white border-r border-slate-100 ${isMobile ? 'w-8' : 'w-10'}`}>
            {HOURS.map(h => (
              <div
                key={h}
                style={{ height: `${hourHeight}px` }}
                className="relative flex items-start justify-center"
              >
                {h > 0 && (!isMobile || h % 2 === 0) && (
                  <span className="text-[9px] text-slate-600 tabular-nums -translate-y-2.5">
                    {fmt2(h)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Días */}
          {visibleDays.map((day, i) => {
            const positioned = positionedByDay.get(day.toDateString()) ?? [];
            const isToday    = isSameDay(day, today);
            return (
              <div
                key={i}
                className={`flex-1 border-l border-slate-100 first:border-l-0 relative min-w-0
                  ${isToday ? 'bg-blue-50/10' : ''}`}
              >
                {/* Celdas clickables */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    style={{ height: `${hourHeight}px` }}
                    className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors relative"
                    onClick={e => {
                      if ((e.target as HTMLElement).closest('[data-event-card]')) return;
                      onOpenModal(day, h);
                    }}
                  >
                    <div className="absolute inset-x-0 top-1/2 border-t border-slate-50/80" />
                  </div>
                ))}

                {/* Overlay eventos */}
                <div className="absolute inset-0 pointer-events-none">
                  {positioned.map(item => (
                    <EventCard
                      key={item.event.id}
                      item={item}
                      colWidth={100 / item.totalCols}
                      colOffset={item.col * (100 / item.totalCols)}
                      onClick={() => onEventClick(item.event.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ── DAY VIEW ──────────────────────────────────────────────────────────────────
export const DayView: React.FC<ViewProps> = memo(({ events, currentDate, onOpenModal, onEventClick, onNavigate }) => {
  const isMobile   = useIsMobile();
  const hourHeight = isMobile ? HOUR_HEIGHT_SM : HOUR_HEIGHT_MD;
  const today      = new Date();
  const isToday    = isSameDay(currentDate, today);
  const scrollRef  = useRef<HTMLDivElement>(null);

  const swipe = useSwipe(
    () => onNavigate?.('next'),
    () => onNavigate?.('prev'),
  );

  const allDayEvents = useMemo(() =>
    events.filter(e => e.allDay && isSameDay(new Date(e.start), currentDate)),
  [events, currentDate]);

  const positioned = useMemo(() => {
    const dayEvs = events.filter(e => !e.allDay && isSameDay(new Date(e.start), currentDate));
    return layoutEvents(dayEvs, hourHeight);
  }, [events, currentDate, hourHeight]);

  useEffect(() => {
    const now    = new Date();
    const target = Math.max(0, (now.getHours() - 1) * hourHeight);
    scrollRef.current?.scrollTo({ top: target, behavior: 'smooth' });
  }, [currentDate, hourHeight]);

  const nowLineTop = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * hourHeight;
  }, [isToday, hourHeight]);

  // Actualizar línea de tiempo cada minuto
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => forceUpdate(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  return (
    <div className="flex flex-col h-full" {...swipe}>
      {/* All-day */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-slate-100 px-3 py-1.5 flex flex-wrap gap-1 bg-slate-50/40 shrink-0">
          
          {allDayEvents.map(ev => (
            <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev.id)} compact={isMobile} />
          ))}
        </div>
      )}

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ minHeight: `${HOURS.length * hourHeight}px` }}>
          {/* Columna de horas */}
          <div className={`shrink-0 bg-white border-r border-slate-100 ${isMobile ? 'w-10' : 'w-14'}`}>
            {HOURS.map(h => (
              <div
                key={h}
                style={{ height: `${hourHeight}px` }}
                className="flex items-start justify-center"
              >
                {h > 0 && (
                  <span className={`text-slate-600 tabular-nums -translate-y-2.5 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
                    {fmt2(h)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Columna principal */}
          <div className="flex-1 relative">
            {HOURS.map(h => (
              <div
                key={h}
                style={{ height: `${hourHeight}px` }}
                className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors relative"
                onClick={e => {
                  if ((e.target as HTMLElement).closest('[data-event-card]')) return;
                  onOpenModal(currentDate, h);
                }}
              >
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-50/80" />
              </div>
            ))}

            {/* Línea hora actual */}
            {nowLineTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${nowLineTop}px` }}
              >
                <div className="w-2 h-2 rounded-full bg-slate-700 -ml-1 shrink-0" />
                <div className="flex-1 border-t-2 border-slate-700 opacity-60" />
              </div>
            )}

            {/* Eventos */}
            <div className="absolute inset-0 pointer-events-none px-1">
              {positioned.map(item => (
                <EventCard
                  key={item.event.id}
                  item={item}
                  colWidth={100 / item.totalCols}
                  colOffset={item.col * (100 / item.totalCols)}
                  onClick={() => onEventClick(item.event.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});