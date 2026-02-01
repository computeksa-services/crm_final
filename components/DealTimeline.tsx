import React from 'react';
import { UnifiedTimelineItem } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Phone, Users, Mail, Cog, FileSignature } from 'lucide-react';


const getIconForType = (type: UnifiedTimelineItem['type']) => {
  switch (type) {
    case 'CALL':
      return { icon: <Phone size={16} className="text-sky-500" />, color: 'text-sky-500', bg: 'bg-sky-50' };
    case 'MEETING':
      return { icon: <Users size={16} className="text-purple-500" />, color: 'text-purple-500', bg: 'bg-purple-50' };
    case 'EMAIL':
      return { icon: <Mail size={16} className="text-amber-500" />, color: 'text-amber-500', bg: 'bg-amber-50' };
    case 'SYSTEM':
      return { icon: <Cog size={16} className="text-slate-500" />, color: 'text-slate-500', bg: 'bg-slate-100' };
    case 'QUOTE_SENT':
      return { icon: <FileSignature size={16} className="text-emerald-500" />, color: 'text-emerald-500', bg: 'bg-emerald-50' };
    case 'NOTE':
    default:
      return { icon: <FileText size={16} className="text-gray-500" />, color: 'text-gray-500', bg: 'bg-gray-50' };
  }
};

const DealTimeline: React.FC<{ items: UnifiedTimelineItem[] }> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        <p>No hay actividades registradas para este trato.</p>
      </div>
    );
  }

  return (
    <div className="flow-root p-6">
      <ul className="-mb-8">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const { icon, bg } = getIconForType(item.type);
          const isSystem = item.type === 'SYSTEM';
          return (
            <li key={item.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full ${bg} flex items-center justify-center ring-8 ring-white`}>
                      {icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex justify-between text-sm text-slate-500">
                      <p className="font-medium text-slate-900">{item.user_name}</p>
                      <time dateTime={item.date_raw} title={item.date_fmt}>
                        {formatDistanceToNow(parseISO(item.date_raw), { addSuffix: true, locale: es })}
                      </time>
                    </div>
                    <p className={`mt-1 text-sm whitespace-pre-wrap ${isSystem ? 'italic text-slate-500 flex items-center gap-2' : 'text-slate-700'}`}>
                      {isSystem && <Cog size={14} className="inline-block mr-1 text-slate-400" />} {item.description}
                    </p>
                    {(item.next_action_desc || item.next_contact_date) && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Siguiente Acción:
                                </p>
                                <p className="text-sm text-slate-800 font-bold mt-1">{item.next_action_desc || 'N/A'}</p>
                            </div>
                            {item.next_contact_date && (
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha:</p>
                                    <p className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full mt-1">
                                        {new Date(item.next_contact_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            )}
                        </div>
                      </div>
                    )}
                    {!item.is_deal_interaction && (
                        <div className="text-xs font-semibold text-slate-400 mt-2 pt-2 border-t border-dashed">
                            Nota heredada del contacto
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DealTimeline;
