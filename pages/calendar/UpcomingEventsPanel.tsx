import React from 'react';
import { CalendarEvent } from '../../types';

interface GroupedEvents {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  thisWeek: CalendarEvent[];
  nextWeek: CalendarEvent[];
}

interface UpcomingEventsPanelProps {
  grouped: GroupedEvents;
  onEventClick: (eventId: string) => void;
  compact?: boolean; // true = mobile version
}

const EventCard: React.FC<{ event: CalendarEvent; onEventClick: (id: string) => void; showDate?: boolean; compact?: boolean }> = ({
  event, onEventClick, showDate, compact,
}) => {
  const startDate = new Date(event.start);
  const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
  const dateLabel = startDate.toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', ...(showDate ? { month: 'short' } : {}),
  });
  const pad = compact ? 'p-2.5' : 'p-3';

  return (
    <div
      onClick={() => onEventClick(event.id)}
      className={`${pad} rounded-lg border-l-4 hover:bg-slate-50 cursor-pointer transition-colors`}
      style={{ borderColor: event.color || '#6366f1' }}
    >
      <div className="flex items-start justify-between mb-0.5">
        {showDate ? (
          <span className="text-xs font-semibold text-slate-500 uppercase">{dateLabel}</span>
        ) : (
          <h4 className={`font-semibold ${compact ? 'text-sm' : 'text-sm'} text-slate-800 flex-1`}>{event.title}</h4>
        )}
        <span className="text-xs font-bold ml-2" style={{ color: event.color || '#6366f1' }}>{timeStr}</span>
      </div>
      {showDate && <h4 className="font-semibold text-sm text-slate-800">{event.title}</h4>}
      {!compact && event.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{event.description}</p>
      )}
      {compact && event.description && (
        <p className="text-xs text-slate-500 line-clamp-1">{event.description}</p>
      )}
      {!compact && event.meeting_url && (
        <div className="mt-2 flex items-center text-xs text-brand-600">
          <i className="fa-solid fa-video mr-1" /><span>Reunión virtual</span>
        </div>
      )}
      {!compact && !showDate && event.attendees && event.attendees.length > 0 && (
        <div className="mt-2 flex items-center text-xs text-slate-500">
          <i className="fa-solid fa-users mr-1" />
          <span>{event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <h4 className="text-xs font-bold text-slate-600 uppercase mb-2 px-1">{label}</h4>
);

export const UpcomingEventsPanel: React.FC<UpcomingEventsPanelProps> = ({ grouped, onEventClick, compact }) => {
  const isEmpty = !grouped.today.length && !grouped.tomorrow.length && !grouped.thisWeek.length && !grouped.nextWeek.length;

  if (isEmpty) {
    return (
      <div className="text-center text-slate-400 py-8">
        <i className={`fa-solid fa-calendar-xmark ${compact ? 'text-2xl mb-1' : 'text-3xl mb-2'}`} />
        <p className={compact ? 'text-xs' : 'text-sm'}>No hay eventos próximos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.today.length > 0 && (
        <div>
          <SectionLabel label="Hoy" />
          <div className="space-y-2">
            {grouped.today.map(ev => <EventCard key={ev.id} event={ev} onEventClick={onEventClick} compact={compact} />)}
          </div>
        </div>
      )}
      {grouped.tomorrow.length > 0 && (
        <div>
          <SectionLabel label="Mañana" />
          <div className="space-y-2">
            {grouped.tomorrow.map(ev => <EventCard key={ev.id} event={ev} onEventClick={onEventClick} compact={compact} />)}
          </div>
        </div>
      )}
      {grouped.thisWeek.length > 0 && (
        <div>
          <SectionLabel label="Esta Semana" />
          <div className="space-y-2">
            {grouped.thisWeek.map(ev => <EventCard key={ev.id} event={ev} onEventClick={onEventClick} showDate compact={compact} />)}
          </div>
        </div>
      )}
      {grouped.nextWeek.length > 0 && (
        <div>
          <SectionLabel label="Próxima Semana" />
          <div className="space-y-2">
            {grouped.nextWeek.map(ev => <EventCard key={ev.id} event={ev} onEventClick={onEventClick} showDate compact={compact} />)}
          </div>
        </div>
      )}
    </div>
  );
};
