import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Deal } from '../types';
import DealKanbanCard from './DealKanbanCard';

interface DealKanbanColumnProps {
  category: string;
  title: string;
  color: string;
  icon: string;
  deals: Deal[];
  isDraggable: boolean;
  onCardClick: (deal: Deal) => void;
}

// Mapeo de categorías a colores
const categoryStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  DRAFT: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-600',
  },
  PROGRESS: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-600',
  },
  PAUSED: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-600',
  },
  WON: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-600',
  },
  LOST: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-600',
  },
};

const DealKanbanColumn: React.FC<DealKanbanColumnProps> = ({
  category,
  title,
  color,
  icon,
  deals,
  isDraggable,
  onCardClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: category,
  });

  const styles = categoryStyles[category] || categoryStyles.DRAFT;
  const dealIds = deals.map(d => d.id_trato);

  // Calcular valor total de la columna
  const totalValue = deals.reduce((sum, deal) => {
    const value = typeof deal.valor_trato === 'string' ? parseFloat(deal.valor_trato) : (deal.valor_trato || 0);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const formatTotal = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalValue);

  return (
    <div className="flex flex-col h-full min-w-[320px] w-[320px]">
      {/* Column Header */}
      <div className={`${styles.bg} ${styles.border} border-2 rounded-t-xl p-4 sticky top-0 z-10`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <i className={`${icon} text-lg ${styles.text}`} />
            <h3 className={`font-bold text-sm ${styles.text} uppercase tracking-wide`}>
              {title}
            </h3>
          </div>
          <span className={`${styles.badge} text-xs font-bold px-2 py-1 rounded-full`}>
            {deals.length}
          </span>
        </div>
        
        {/* Total value */}
        {totalValue > 0 && (
          <div className={`text-xs font-semibold ${styles.text}`}>
            Total: {formatTotal}
          </div>
        )}
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 ${styles.bg} ${styles.border} border-x-2 border-b-2 rounded-b-xl p-3 overflow-y-auto transition-colors ${
          isOver ? 'ring-2 ring-blue-400 ring-inset' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}
      >
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>
              <p className="text-sm font-medium">Sin tratos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deals.map(deal => (
                <DealKanbanCard
                  key={deal.id_trato}
                  deal={deal}
                  isDraggable={isDraggable}
                  onClick={() => onCardClick(deal)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default DealKanbanColumn;
