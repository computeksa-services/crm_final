import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '../types';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DealKanbanCardProps {
  deal: Deal;
  isDraggable: boolean;
  onClick?: () => void;
}

const DealKanbanCard: React.FC<DealKanbanCardProps> = ({ deal, isDraggable, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: deal.id_trato,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Formatear el valor del trato
  const formatValue = (value?: number | string) => {
    if (!value) return '$0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '$0';
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  // Formatear fecha de última actualización
  const getLastUpdated = () => {
    try {
      if (!deal.updated_at_fmt) return 'Reciente';
      const date = new Date(deal.updated_at_fmt);
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 ${
        isDragging ? 'shadow-xl ring-2 ring-blue-400' : ''
      } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      onClick={onClick}
    >
      {/* Drag handle area */}
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-center text-gray-300 hover:text-gray-400 transition-colors cursor-grab active:cursor-grabbing"
        >
          <svg width="20" height="8" viewBox="0 0 20 8" fill="currentColor">
            <circle cx="3" cy="2" r="1.5"/>
            <circle cx="10" cy="2" r="1.5"/>
            <circle cx="17" cy="2" r="1.5"/>
            <circle cx="3" cy="6" r="1.5"/>
            <circle cx="10" cy="6" r="1.5"/>
            <circle cx="17" cy="6" r="1.5"/>
          </svg>
        </div>
      )}

      <div className="p-4">
        {/* Deal name */}
        <h3 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2 leading-snug">
          {deal.nombre_trato}
        </h3>

        {/* Company */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span className="truncate">{deal.empresa_cliente?.name || deal.client_company_name || 'Sin empresa'}</span>
        </div>

        {/* Contact */}
        {(deal.contacto_cliente?.name || deal.contact_full_name) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span className="truncate">{deal.contacto_cliente?.name || deal.contact_full_name}</span>
          </div>
        )}

        {/* Value - highlighted */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
          <div className="text-xl font-black text-blue-700">
            {formatValue(deal.valor_trato)}
          </div>
        </div>

        {/* Footer: Owner avatar + Last updated */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Avatar
              src={deal.owner_details?.avatar || deal.owner_avatar || null}
              name={deal.owner_details?.name || deal.owner_name || 'Usuario'}
              size="xs"
            />
            <span className="text-xs text-gray-500 font-medium truncate max-w-[100px]">
              {(deal.owner_details?.name || deal.owner_name || 'Usuario').split(' ')[0]}
            </span>
          </div>
          <div className="text-[10px] text-gray-400">
            {getLastUpdated()}
          </div>
        </div>

        {/* Permission indicator */}
        {!isDraggable && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className="font-semibold">Solo lectura</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealKanbanCard;
