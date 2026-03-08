import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Deal, DealStatus, DealInterest, Quote } from '../../types';
import { canEditInline } from '../../utils/permissions';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';
import { quotesService } from '../../services/quotes.service';
import { BrandSpinner } from '../../components/AppLoaders';
import SelectWinningQuoteModal from '../../components/SelectWinningQuoteModal';
import Toast from '../../components/Toast';
import Avatar from '../../components/Avatar';
import DealActionsMenu from '../../components/DealActionsMenu';

// Componente DropZone para zonas de drop
const DropZone: React.FC<{ id: string; icon: string; label: string; color: string }> = ({ id, icon, label, color }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`
        drop-option ${color} text-white rounded-full cursor-pointer border-2 border-white/70
        flex flex-col items-center justify-center shadow-md
        transition-all duration-200 ease-out
        ${isOver
          ? 'w-24 h-24 scale-110 ring-4 ring-blue-300 shadow-xl bg-opacity-100'
          : 'w-16 h-16 scale-100 opacity-80 bg-opacity-70'}
      `}
      style={{ zIndex: 50 }}
    >
      <i className={`fa-solid ${icon} ${isOver ? 'text-2xl' : 'text-base'} mb-0.5`} />
      <span className={`font-semibold leading-none ${isOver ? 'text-[11px]' : 'text-[9px]'}`}>{label}</span>
    </div>
  );
};

interface DealsKanbanProps {
  deals: Deal[];
  dealStatuses: DealStatus[];
  dealInterests?: DealInterest[];
  cachedUsers?: any[];
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

// ÔöÇÔöÇÔöÇ UTILS ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const formatValue = (value?: number | string) => {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!n || isNaN(n)) return null;
  return new Intl.NumberFormat('es-EC', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
};

const formatShortDate = (value?: string | null) => {
  if (!value) return null;
  let d: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) {
    const [dd, mm, yyyy] = value.trim().split('/');
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  }
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' })
    .format(d)
    .replace(/\./g, '')
    .toLowerCase();
};

const normalizeFaIcon = (icon?: string | null) => {
  const raw = (icon || '').trim();
  if (!raw) return 'fa-solid fa-bullseye';
  if (raw.includes('fa-')) {
    return raw.startsWith('fa-') ? `fa-solid ${raw}` : raw;
  }
  return `fa-solid fa-${raw}`;
};

const parseDealValue = (value?: number | string) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

// Agrupar estados por categor├¡a para columnas
const CATEGORY_ORDER = ['DRAFT', 'PROGRESS', 'PAUSED', 'WON', 'LOST'];

const normalizeCategory = (category?: string | null) => {
  const raw = (category || '').toUpperCase().trim();
  if (!raw) return 'DRAFT';
  if (raw === 'IN_PROGRESS' || raw === 'OPEN' || raw === 'ACTIVE') return 'PROGRESS';
  if (raw === 'ON_HOLD' || raw === 'HOLD') return 'PAUSED';
  if (raw === 'CLOSED_WON' || raw === 'GANADO') return 'WON';
  if (raw === 'CLOSED_LOST' || raw === 'PERDIDO') return 'LOST';
  if (CATEGORY_ORDER.includes(raw)) return raw;
  return 'DRAFT';
};

const categoryMeta: Record<string, { headerBg: string; accent: string; emptyIcon: string }> = {
  DRAFT:    { headerBg: 'bg-slate-100',   accent: '#94a3b8', emptyIcon: 'fa-pencil'      },
  PROGRESS: { headerBg: 'bg-blue-50',     accent: '#3b82f6', emptyIcon: 'fa-arrow-right' },
  PAUSED:   { headerBg: 'bg-amber-50',    accent: '#f59e0b', emptyIcon: 'fa-pause'       },
  WON:      { headerBg: 'bg-emerald-50',  accent: '#10b981', emptyIcon: 'fa-trophy'      },
  LOST:     { headerBg: 'bg-red-50',      accent: '#ef4444', emptyIcon: 'fa-xmark'       },
};

const getReadableTextColor = (hex?: string) => {
  if (!hex) return '#ffffff';
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return '#ffffff';

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(v => Number.isNaN(v))) return '#ffffff';

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
};

const resolveUser = (users: any[] = [], collabId: any) => {
  if (!collabId) return undefined;
  const collabIdStr = String(collabId).trim();
  return users.find(u => {
    const userId = u.id_user || u.id || u.username || u.user_id;
    const ownerId = u.id_user_owner;
    if (!userId) return false;
    const userIdStr = String(userId).trim();
    const ownerIdStr = ownerId ? String(ownerId).trim() : '';
    return (
      userIdStr === collabIdStr ||
      ownerIdStr === collabIdStr ||
      userIdStr.includes(collabIdStr) ||
      collabIdStr.includes(userIdStr) ||
      (ownerIdStr && (ownerIdStr.includes(collabIdStr) || collabIdStr.includes(ownerIdStr)))
    );
  });
};

const getCachedUsersFromLocalStorage = (tenantId?: string, userId?: string) => {
  if (!tenantId || !userId) return [] as any[];
  try {
    const prefix = `cache_${tenantId}_${userId}_v`;
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .sort((a, b) => {
        const av = Number(a.split('_v').pop() || 0);
        const bv = Number(b.split('_v').pop() || 0);
        return bv - av;
      });

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.users) && parsed.users.length > 0) {
        return parsed.users;
      }
    }
  } catch {
    return [];
  }
  return [];
};

// ÔöÇÔöÇÔöÇ COLLABORATOR AVATARS ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const CollaboratorAvatars: React.FC<{ deal: Deal; cachedUsers?: any[] }> = ({ deal, cachedUsers = [] }) => {
  const collaborators = deal.collaborators ?? [];
  if (collaborators.length === 0) {
    // fallback: solo owner
    const name   = deal.owner_details?.name || deal.owner_name || '';
    const avatar = deal.owner_details?.avatar || deal.owner_avatar || null;
    if (!name) return null;
    return (
      <div className="flex items-center gap-1.5">
        <Avatar
          src={avatar}
          name={name}
          size="xs"
          className="cursor-pointer"
          badgeInset
          badge={{ type: 'OWNER' }}
          enableHoverZoom
          hoverScale={1.18}
          showTooltip
          tooltipRole="Creador"
          tooltipPosition="bottom"
        />
        <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{name.split(' ')[0]}</span>
      </div>
    );
  }

  // Ordenar: owner primero
  const sorted = [...collaborators].sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const order = { EDIT: 0, VIEW: 1, BLOCKED: 2 };
    const aLevel = String(a.access_level || 'VIEW').toUpperCase();
    const bLevel = String(b.access_level || 'VIEW').toUpperCase();
    return (order[aLevel as keyof typeof order] ?? 2) - (order[bLevel as keyof typeof order] ?? 2);
  });

  const visible = sorted.slice(0, 4);
  const extra   = sorted.length - visible.length;

  return (
    <div className="flex items-center gap-1 leading-none">
      <div className="flex items-center gap-0.5">
        {visible.map((c, i) => {
          const collabId = c.id ?? c.id_user ?? c.user_id ?? c.userId ?? c.id_user_owner;
          const resolvedUser = resolveUser(cachedUsers, collabId);
          const name = c.name || c.user_name || c.name_user || c.user?.name_user || c.user?.name || resolvedUser?.name_user || resolvedUser?.name || resolvedUser?.full_name || 'Usuario';
          const avatar =
            resolvedUser?.avatar_url ||
            resolvedUser?.avatar ||
            resolvedUser?.photo_url ||
            resolvedUser?.image_url ||
            c.avatar ||
            c.user_avatar ||
            c.avatar_url ||
            c.user?.avatar_url ||
            c.user?.avatar ||
            null;
          const level = String(c.access_level || 'VIEW').toUpperCase();
          const badgeType: 'OWNER' | 'EDIT' | 'VIEW' = c.is_owner ? 'OWNER' : level === 'EDIT' ? 'EDIT' : 'VIEW';
          const tooltipLevel = c.is_owner ? 'Creador' : level === 'EDIT' ? 'Principal' : 'Secundario';
          return (
            <div key={c.id ?? c.id_user ?? i} className="relative">
              <Avatar
                src={avatar}
                name={name}
                size="xs"
                className="ring-1 ring-white block cursor-pointer"
                badgeInset
                badge={{ type: badgeType }}
                enableHoverZoom
                hoverScale={1.18}
                showTooltip
                tooltipRole={tooltipLevel}
                tooltipPosition="bottom"
              />
            </div>
          );
        })}
      </div>
      {extra > 0 && (
        <span className="text-[9px] text-slate-400 font-medium">+{extra}</span>
      )}
    </div>
  );
};

// ÔöÇÔöÇÔöÇ KANBAN CARD ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const KanbanCard: React.FC<{
  deal: Deal;
  dealInterests?: DealInterest[];
  cachedUsers?: any[];
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  isDraggable: boolean;
  isOverlay?: boolean;
  onOpen: () => void;
  style?: React.CSSProperties;
}> = ({ deal, dealInterests = [], cachedUsers = [], user, onEdit, onShare, onArchive, onDelete, isDraggable, isOverlay, onOpen, style }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id_trato, disabled: !isDraggable });

  const mergedStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(style || {}),
    ...(isDragging ? { opacity: 0.5 } : {}),
  };

  const valorNumber = parseDealValue(deal.valor_trato);
  const valor = valorNumber > 0 ? formatValue(valorNumber) : null;

  const interestFromCatalog = (dealInterests || []).find(i =>
    i.id_interest === deal.id_interest ||
    i.name?.toUpperCase() === (deal.interes_nombre || deal.interes_actual?.name || '').toUpperCase()
  ) || (deal.catalogo_intereses || []).find(i =>
    i.id_interest === deal.id_interest ||
    i.name?.toUpperCase() === (deal.interes_nombre || deal.interes_actual?.name || '').toUpperCase()
  );

  const interestName = deal.interes_nombre || deal.interes_actual?.name || null;
  const interestIcon = normalizeFaIcon(
    deal.interes_icon ||
    deal.interes_actual?.icon ||
    interestFromCatalog?.icon
  );
  const interestColor =
    deal.interes_color ||
    deal.interes_actual?.color ||
    interestFromCatalog?.color ||
    '#94a3b8';

  const expectedClose = formatShortDate((deal as any).fecha_cierre_esperada);
  const inactiveLabel = (deal.inactive_time_text || '').trim() || (deal.days_inactive === 0 ? 'Al día' : deal.days_inactive != null ? `${deal.days_inactive}d` : '');

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      onClick={onOpen}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={`
        bg-white border rounded-lg overflow-visible select-none
        transition-all duration-150
        ${isDragging ? 'opacity-50 shadow-none' : 'shadow-sm hover:shadow-md hover:border-slate-300'}
        ${isOverlay ? 'rotate-1 shadow-xl scale-105 border-slate-300 opacity-50' : 'border-slate-200'}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      `}
    >
      {/* Drag handle ÔÇö franja superior */}
      {/* Eliminar drag handle, ahora toda la tarjeta es draggable */}

      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-slate-800 line-clamp-2 leading-4 flex-1 min-w-0">
            {deal.nombre_trato || 'Sin nombre'}
          </p>
          {valor && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700 tabular-nums whitespace-nowrap"
              style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
            >
              {valor}
            </span>
          )}
        </div>

        <div className="space-y-0.5">
          {(deal.client_company_name || deal.empresa_cliente?.name) && (
            <div className="flex items-center gap-1.5 min-w-0">
              <i className="fa-solid fa-building text-[9px] text-slate-300 w-3 text-center flex-shrink-0" />
              <span className="text-[11px] text-slate-600 truncate">
                {deal.client_company_name || deal.empresa_cliente?.name}
              </span>
            </div>
          )}
          {(deal.contact_full_name || deal.contacto_cliente?.name) && (
            <div className="flex items-center gap-1.5 min-w-0">
              <i className="fa-solid fa-user text-[9px] text-slate-300 w-3 text-center flex-shrink-0" />
              <span className="text-[11px] text-slate-400 truncate">
                {deal.contact_full_name || deal.contacto_cliente?.name}
              </span>
            </div>
          )}
        </div>

        {(interestName || expectedClose) && (
          <div className="flex flex-wrap items-center gap-1">
            {interestName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600 max-w-full">
                <i className={`${interestIcon} text-[8px] flex-shrink-0`} style={{ color: interestColor }} />
                <span className="truncate max-w-[112px]">{interestName}</span>
              </span>
            )}
            {expectedClose && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600">
                <i className="fa-solid fa-calendar-days text-[8px] text-slate-400" />
                <span>{expectedClose}</span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
          <CollaboratorAvatars deal={deal} cachedUsers={cachedUsers} />
          <div className="flex items-center gap-1.5">
            {inactiveLabel && (
              <span className={`inline-flex items-center h-6 px-1.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold leading-none ${
                deal.days_inactive === 0 ? 'text-emerald-500' :
                deal.days_inactive <= 7  ? 'text-emerald-400' :
                deal.days_inactive <= 15 ? 'text-amber-400' :
                deal.days_inactive <= 30 ? 'text-orange-400' : 'text-red-500'
              }`}>
                {inactiveLabel}
              </span>
            )}
            <DealActionsMenu
              deal={deal}
              user={user}
              onEdit={onEdit}
              onShare={onShare}
              onArchive={onArchive}
              onDelete={onDelete}
              anchor="top-right"
              triggerClassName="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center"
              showTrigger={!isOverlay}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ÔöÇÔöÇÔöÇ KANBAN COLUMN ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const KanbanColumn: React.FC<{
  status: DealStatus;
  deals: Deal[];
  dealInterests?: DealInterest[];
  cachedUsers?: any[];
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onCardClick: (deal: Deal) => void;
  canDrag: (deal: Deal) => boolean;
}> = ({ status, deals, dealInterests = [], cachedUsers = [], user, onEdit, onShare, onArchive, onDelete, onCardClick, canDrag }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status.id_status });
  const normalizedCategory = normalizeCategory(status.status_category);
  const meta = categoryMeta[normalizedCategory] ?? categoryMeta.DRAFT;
  const headerColor = status.color || meta.accent;
  const headerTextColor = getReadableTextColor(headerColor);

  const total = deals.reduce((s, d) => s + parseDealValue(d.valor_trato), 0);
  const totalFmt = total > 0 ? formatValue(total) : null;

  return (
    <div className="flex flex-col h-full min-h-0 w-72 flex-shrink-0">
      {/* Header */}
      <div
        className="rounded-t-xl px-3 py-2.5 border border-b-0"
        style={{ backgroundColor: headerColor, borderColor: `${headerColor}66` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.icon && (
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <i className={`${status.icon} text-[10px]`} style={{ color: headerTextColor }} />
              </div>
            )}
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: headerTextColor }}>
              {status.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {totalFmt && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tabular-nums"
                style={{
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  color: headerTextColor,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderColor: 'rgba(255,255,255,0.35)'
                }}
              >
                <span>{totalFmt}</span>
              </span>
            )}
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
              style={{
                color: headerTextColor,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderColor: 'rgba(255,255,255,0.35)'
              }}
            >
              {deals.length}
            </span>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-b-xl border border-slate-200
          transition-colors duration-150 min-h-[200px]
          ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'}
        `}
      >
        <SortableContext items={deals.map(d => d.id_trato)} strategy={verticalListSortingStrategy}>
          {deals.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
            }`}>
              <i className={`fa-solid ${meta.emptyIcon} text-lg mb-1`}
                style={{ color: isOver ? '#3b82f6' : '#cbd5e1' }} />
              <p className="text-[11px] text-slate-400">Arrastra aquí</p>
            </div>
          ) : (
            deals.map(deal => (
              <KanbanCard
                key={deal.id_trato}
                deal={deal}
                dealInterests={dealInterests}
                cachedUsers={cachedUsers}
                user={user}
                onEdit={onEdit}
                onShare={onShare}
                onArchive={onArchive}
                onDelete={onDelete}
                isDraggable={canDrag(deal)}
                onOpen={() => onCardClick(deal)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// ÔöÇÔöÇÔöÇ MAIN COMPONENT ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const DealsKanban: React.FC<DealsKanbanProps> = ({ deals, dealStatuses, dealInterests = [], cachedUsers = [], user, onEdit, onShare, onArchive, onDelete, onRefresh }) => {
  const navigate = useNavigate();

  const cachedUsersFromStorage = useMemo(
    () => getCachedUsersFromLocalStorage(user?.id_tenant, user?.id_user),
    [user?.id_tenant, user?.id_user]
  );

  const usersSource = useMemo(() => {
    const byId = new Map<string, any>();

    const addUsers = (list: any[] = []) => {
      list.forEach(u => {
        const id = String(u?.id_user || u?.id || u?.user_id || '').trim();
        if (!id) return;
        const prev = byId.get(id) || {};
        byId.set(id, { ...prev, ...u });
      });
    };

    addUsers(cachedUsers);
    addUsers(cachedUsersFromStorage);

    return Array.from(byId.values());
  }, [cachedUsers, cachedUsersFromStorage]);

  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast]           = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [winnerModal, setWinnerModal] = useState<{
    isOpen: boolean; deal: Deal | null; quotes: Quote[]; targetStatusId: string;
    resolve: ((v: boolean) => void) | null;
  }>({ isOpen: false, deal: null, quotes: [], targetStatusId: '', resolve: null });

  // Identificadores para zonas de drop
  const TRASH_ID = '__kanban_trash__';
  const ARCHIVE_ID = '__kanban_archive__';

  // Sync local state cuando cambian los deals del padre
  React.useEffect(() => { setLocalDeals(deals); }, [deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Construir columnas desde dealStatuses ordenados por categor├¡a
  const columns = React.useMemo(() => {
    const sorted = [...dealStatuses].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(normalizeCategory(a.status_category));
      const bi = CATEGORY_ORDER.indexOf(normalizeCategory(b.status_category));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted.map(status => ({
      status,
      deals: localDeals.filter(d =>
        d.id_deal_status === status.id_status ||
        d.estado_nombre?.toUpperCase() === status.name?.toUpperCase()
      ),
    }));
  }, [dealStatuses, localDeals]);

  const activeDeal = activeId ? localDeals.find(d => d.id_trato === activeId) : null;

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const draggedDeal = localDeals.find(d => d.id_trato === active.id);
    if (!draggedDeal) return;

    // Si se suelta sobre basurero
    if (over.id === TRASH_ID) {
      setIsUpdating(true);
      try {
        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_trato: draggedDeal.id_trato, id_user: user?.id_user }),
        });
        setLocalDeals(prev => prev.filter(d => d.id_trato !== draggedDeal.id_trato));
        setToast({ message: 'Trato enviado a basurero', type: 'success' });
      } catch {
        setToast({ message: 'Error al eliminar el trato', type: 'error' });
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    // Si se suelta sobre archivar
    if (over.id === ARCHIVE_ID) {
      setIsUpdating(true);
      try {
        await apiFetch(GATEWAY_CONFIG.API.DEALS.ARCHIVED, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_trato: draggedDeal.id_trato,
            id_tenant: user?.id_tenant,
            id_user: user?.id_user,
            archived: true
          })
        });
        setLocalDeals(prev => prev.map(d =>
          d.id_trato === draggedDeal.id_trato ? { ...d, archived: true } : d
        ));
        setToast({ message: 'Trato archivado', type: 'success' });
      } catch {
        setToast({ message: 'Error al archivar el trato', type: 'error' });
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    // Determinar el status destino: puede ser un id_status (columna) o id de otro deal
    let targetStatusId: string;
    const overIsStatus = dealStatuses.some(s => s.id_status === over.id);

    if (overIsStatus) {
      targetStatusId = over.id as string;
    } else {
      // over es un deal ÔÇö buscar en qu├® columna est├í
      const overDeal = localDeals.find(d => d.id_trato === over.id);
      if (!overDeal) return;
      targetStatusId = overDeal.id_deal_status || '';
    }

    if (!targetStatusId || targetStatusId === draggedDeal.id_deal_status) return;

    const targetStatus = dealStatuses.find(s => s.id_status === targetStatusId);
    if (!targetStatus) return;

    // ...existing code for status change...
    setLocalDeals(prev => prev.map(d =>
      d.id_trato === draggedDeal.id_trato
        ? { ...d, id_deal_status: targetStatusId, estado_nombre: targetStatus.name }
        : d
    ));

    // ...existing code for winner modal and status update...
    if (normalizeCategory(targetStatus.status_category) === 'WON') {
      try {
        const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.QUOTES.LIST, { id_trato: draggedDeal.id_trato }));
        const data = await res.json();
        const quotes: Quote[] = Array.isArray(data) ? data : (data?.quotes ?? []);

        if (quotes.length > 0) {
          const confirmed = await new Promise<boolean>(resolve => {
            setWinnerModal({ isOpen: true, deal: draggedDeal, quotes, targetStatusId, resolve });
          });
          if (!confirmed) {
            // revertir
            setLocalDeals(deals);
          }
          return;
        }
      } catch { /* contin├║a con cambio normal */ }
    }

    setIsUpdating(true);
    try {
      await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_trato: draggedDeal.id_trato,
          id_deal_status: targetStatusId,
          id_user: user?.id_user,
        }),
      });
    } catch {
      setToast({ message: 'Error al actualizar el estado', type: 'error' });
      setLocalDeals(prev => prev.map(d =>
        d.id_trato === draggedDeal.id_trato ? draggedDeal : d
      ));
    } finally {
      setIsUpdating(false);
    }
  }, [localDeals, dealStatuses, user, deals]);

  const handleWinnerConfirm = useCallback(async (selectedQuoteId: string, createInCartera: boolean) => {
    const { deal, targetStatusId, resolve } = winnerModal;
    if (!deal || !targetStatusId) { resolve?.(false); return; }

    setWinnerModal(p => ({ ...p, isOpen: false }));
    setIsUpdating(true);

    try {
      const result = await quotesService.markWinningQuote({
        id_trato: deal.id_trato,
        id_cotizacion_ganadora: selectedQuoteId,
        crear_en_cartera: createInCartera,
      });

      onRefresh();

      const quoteNumber = result?.quote?.formatted_no_cotizacion || result?.quote?.no_cotizacion || selectedQuoteId;
      let successMessage = `Cotizaci├│n #${quoteNumber} marcada como ganadora.`;
      const notifications: string[] = [];
      if (result?.notifications?.client_notified) notifications.push('Cliente notificado por correo');
      if (createInCartera) notifications.push('Abriendo formulario de cartera');
      if (notifications.length > 0) successMessage += ` [${notifications.join(', ')}]`;

      setToast({ message: successMessage, type: 'success' });
      if (createInCartera) {
        setTimeout(() => navigate(`/app/financials/new?from_deal=${deal.id_trato}&quote_id=${selectedQuoteId}&client_id=${deal.id_client_company}`), 500);
      }
      resolve?.(true);
    } catch {
      setToast({ message: 'Error al actualizar el estado', type: 'error' });
      resolve?.(false);
    } finally {
      setIsUpdating(false);
    }
  }, [winnerModal, user, onRefresh, navigate]);

  if (deals.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <i className="fa-regular fa-handshake text-5xl text-slate-200" />
        <p className="text-sm">Sin tratos para mostrar</p>
        <button onClick={() => navigate('/app/deals/new')}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
          Crear trato
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 flex flex-col overflow-hidden">
      {isUpdating && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
          <div className="bg-white rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 border border-slate-200">
            <BrandSpinner size="sm" />
            <span className="text-xs font-semibold text-slate-600">ActualizandoÔÇª</span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="kanban-board-scroll flex-1 min-h-0 flex gap-3 overflow-x-scroll overflow-y-hidden pb-4 px-4 pt-2">
          {columns.map(({ status, deals: colDeals }) => (
            <KanbanColumn
              key={status.id_status}
              status={status}
              deals={colDeals}
              dealInterests={dealInterests}
              cachedUsers={usersSource}
              user={user}
              onEdit={onEdit}
              onShare={onShare}
              onArchive={onArchive}
              onDelete={onDelete}
              onCardClick={d => navigate(`/app/deals/${d.id_trato}`)}
              canDrag={d => canEditInline(user, d)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeDeal && (
            <KanbanCard
              deal={activeDeal}
              dealInterests={dealInterests}
              cachedUsers={usersSource}
              user={user}
              onEdit={onEdit}
              onShare={onShare}
              onArchive={onArchive}
              onDelete={onDelete}
              isDraggable={true}
              isOverlay
              onOpen={() => {}}
            />
          )}
        </DragOverlay>

        {/* Barra inferior de opciones al arrastrar */}
        {activeDeal && (
          <div className="fixed left-0 right-0 bottom-0 z-40 flex justify-center gap-40 pb-16">
            <DropZone id={TRASH_ID} icon="fa-trash" label="Basurero" color="bg-red-500" />
            <DropZone id={ARCHIVE_ID} icon="fa-box-archive" label="Archivar" color="bg-slate-500" />
          </div>
        )}
      </DndContext>

      {winnerModal.isOpen && winnerModal.deal && (
        <SelectWinningQuoteModal
          isOpen={winnerModal.isOpen}
          onClose={() => {
            setWinnerModal(p => ({ ...p, isOpen: false }));
            winnerModal.resolve?.(false);
            // revertir optimistic
            setLocalDeals(deals);
          }}
          onConfirm={handleWinnerConfirm}
          quotes={winnerModal.quotes}
          dealName={winnerModal.deal.nombre_trato || `Trato #${winnerModal.deal.id_trato}`}
          hasCarteraAccess={Boolean(user?.module_access?.financials || (user?.rol_user && ['admin', 'superadmin'].includes(user.rol_user)))}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default DealsKanban;
