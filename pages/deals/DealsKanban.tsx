import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Deal, DealStatus } from '../../types';
import DealKanbanColumn from '../../components/DealKanbanColumn';
import DealKanbanCard from '../../components/DealKanbanCard';
import { useDealKanban } from '../../hooks/useDealKanban';
import { canEditInline } from '../../utils/permissions';
import { useAuth } from '../../contexts/AuthContext';
import { BrandSpinner } from '../../components/AppLoaders';

interface DealsKanbanProps {
  deals: Deal[];
  dealStatuses: DealStatus[];
  onRefresh: () => void;
}

const DealsKanban: React.FC<DealsKanbanProps> = ({ deals, dealStatuses, onRefresh }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Configurar sensores para drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requiere mover 8px antes de activar drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const {
    columns,
    draggedDeal,
    isUpdating,
    handleDragEnd,
    handleDragStart,
    handleDragCancel,
  } = useDealKanban(deals, dealStatuses, onRefresh);

  const handleCardClick = (deal: Deal) => {
    navigate(`/app/deals/${deal.id_trato}`);
  };

  // Verificar si el usuario puede editar
  const canDrag = (deal: Deal) => {
    return canEditInline(user, deal);
  };

  return (
    <div className="h-full">
      {/* Loading overlay */}
      {isUpdating && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3">
            <BrandSpinner size="md" />
            <span className="text-sm font-semibold text-gray-700">Actualizando trato...</span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 px-4" style={{ height: 'calc(100vh - 200px)' }}>
          {columns.map(column => (
            <DealKanbanColumn
              key={column.category}
              category={column.category}
              title={column.title}
              color={column.color}
              icon={column.icon}
              deals={column.deals}
              isDraggable={true} // Se verifica a nivel de tarjeta
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedDeal ? (
            <div className="rotate-3 scale-105">
              <DealKanbanCard
                deal={draggedDeal}
                isDraggable={canDrag(draggedDeal)}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {deals.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
          </svg>
          <h3 className="text-xl font-bold text-gray-600 mb-2">Sin tratos</h3>
          <p className="text-sm text-gray-500">Crea tu primer trato para comenzar</p>
        </div>
      )}
    </div>
  );
};

export default DealsKanban;
