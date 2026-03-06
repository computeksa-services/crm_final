import { useState, useMemo, useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { Deal, DealStatus, Quote } from '../types';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export interface KanbanColumn {
  category: string;
  title: string;
  color: string;
  icon: string;
  deals: Deal[];
}

export const useDealKanban = (
  deals: Deal[],
  dealStatuses: DealStatus[],
  onUpdate: () => void,
  onBeforeStatusChange?: (deal: Deal, targetStatus: DealStatus) => Promise<boolean>
) => {
  const { user } = useAuth();
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Configuración de columnas por categoría
  const columnConfig = useMemo(() => [
    { category: 'DRAFT', title: 'Borrador', color: '#94a3b8', icon: 'fa-solid fa-file-lines' },
    { category: 'PROGRESS', title: 'En Progreso', color: '#3b82f6', icon: 'fa-solid fa-spinner' },
    { category: 'PAUSED', title: 'Pausado', color: '#f59e0b', icon: 'fa-solid fa-pause-circle' },
    { category: 'WON', title: 'Ganado', color: '#10b981', icon: 'fa-solid fa-circle-check' },
    { category: 'LOST', title: 'Perdido', color: '#ef4444', icon: 'fa-solid fa-circle-xmark' },
  ], []);

  // Agrupar deals por categoría
  const columns = useMemo<KanbanColumn[]>(() => {
    return columnConfig.map(config => ({
      ...config,
      deals: deals.filter(deal => deal.estado_actual?.category === config.category),
    }));
  }, [deals, columnConfig]);

  // Encontrar el primer estado de una categoría
  const findStatusForCategory = useCallback(
    (category: string): DealStatus | null => {
      return dealStatuses.find(s => s.status_category === category) || null;
    },
    [dealStatuses]
  );

  // Manejar el drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        setDraggedDeal(null);
        return;
      }

      const dealId = active.id as string;
      const targetCategory = over.id as string;

      // Encontrar el deal que se está moviendo
      const deal = deals.find(d => d.id_trato === dealId);
      if (!deal) {
        setDraggedDeal(null);
        return;
      }

      // Si la categoría es la misma, no hacer nada
      if (deal.estado_actual?.category === targetCategory) {
        setDraggedDeal(null);
        return;
      }

      // Encontrar el estado objetivo
      const targetStatus = findStatusForCategory(targetCategory);
      if (!targetStatus) {
        console.error('No se encontró estado para la categoría:', targetCategory);
        setDraggedDeal(null);
        return;
      }

      // Verificar si el estado notifica al cliente
      const shouldNotify = targetStatus.notify_client;

      if (shouldNotify) {
        const confirmed = window.confirm(
          `Al mover este trato a "${targetStatus.name}" se enviará una notificación por correo al cliente. ¿Deseas continuar?`
        );
        if (!confirmed) {
          setDraggedDeal(null);
          return;
        }
      }

      // Ejecutar callback antes del cambio de estado (para interceptar cambios a WON, etc.)
      if (onBeforeStatusChange) {
        const shouldProceed = await onBeforeStatusChange(deal, targetStatus);
        if (!shouldProceed) {
          setDraggedDeal(null);
          setIsUpdating(false);
          return;
        }
      }

      // Actualización optimista
      setIsUpdating(true);
      const previousDeals = [...deals];

      try {
        // Llamar al API para actualizar el estado
        const payload = {
          id_trato: dealId,
          id_deal_status: targetStatus.id_status,
          id_tenant: user?.id_tenant,
          id_user: user?.id_user,
        };

        const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Error al actualizar el estado del trato');
        }

        // Recargar los datos, onBeforeStatusChange
        onUpdate();
      } catch (error) {
        console.error('Error updating deal status:', error);
        alert('Error al actualizar el estado del trato. Por favor, intenta nuevamente.');
      } finally {
        setIsUpdating(false);
        setDraggedDeal(null);
      }
    },
    [deals, findStatusForCategory, user, onUpdate]
  );

  const handleDragStart = useCallback((event: any) => {
    const deal = deals.find(d => d.id_trato === event.active.id);
    setDraggedDeal(deal || null);
  }, [deals]);

  const handleDragCancel = useCallback(() => {
    setDraggedDeal(null);
  }, []);

  return {
    columns,
    draggedDeal,
    isUpdating,
    handleDragEnd,
    handleDragStart,
    handleDragCancel,
  };
};
