import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deal, DealStatus, DealInterest, Quote } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { canEditInline, canUserAction } from '../../utils/permissions';

interface DealsListViewProps {
  deals: Deal[];
  cachedDealStatuses: DealStatus[];
  cachedDealInterests: DealInterest[];
  showArchived: boolean;
  grouping: string[];
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (deal: Deal, statusId: string, quotes: Quote[], pendingStatusId: string) => void;
  onInterestChange: (deal: Deal, interestId: string) => void;
  onRefresh: () => void;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const parseDealValue = (value: Deal['valor_trato']) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatAmount = (amount: number): string =>
  amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Soporta dd/mm/yyyy, ISO, y yyyy-mm-dd
const formatDate = (value?: string | null): string | null => {
  if (!value) return null;

  let d: Date;

  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) {
    const [dd, mm, yyyy] = value.trim().split('/');
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    d = new Date(normalized);
  }

  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(d).replace(/\./g, '').toLowerCase();
};

const inactiveMeta = (days: number | null | undefined) => {
  if (days === null || days === undefined) return null;
  if (days === 0)    return { label: 'Al día',   cls: 'text-emerald-500' };
  if (days <= 7)     return { label: `${days}d`, cls: 'text-emerald-400' };
  if (days <= 15)    return { label: `${days}d`, cls: 'text-amber-400'   };
  if (days <= 30)    return { label: `${days}d`, cls: 'text-orange-400'  };
  return               { label: `${days}d`, cls: 'text-red-500'     };
};

// ─── INLINE BADGE SELECTOR (igual que en DealsTable) ─────────────────────────
const InlineBadgeSelector: React.FC<{
  valueId: string;
  items: { id: string; name: string; color?: string; icon?: string; notify_client?: boolean }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const current = items.find(i => i.id === valueId);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState<'bottom' | 'top'>('bottom');

  const currentIndex = items.findIndex(i => i.id === valueId);
  const itemsAbove   = currentIndex > 0 ? items.slice(0, currentIndex) : [];
  const itemsBelow   = currentIndex < items.length - 1 ? items.slice(currentIndex + 1) : [];

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropPos(window.innerHeight - rect.bottom < 200 && rect.top > 200 ? 'top' : 'bottom');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const renderNotifyBadge = () => (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">
      <i className="fa-solid fa-envelope text-[8px]" />
    </span>
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => { e.stopPropagation(); if (!disabled) setIsOpen(o => !o); }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap
          ${disabled ? 'cursor-default' : 'hover:opacity-90 cursor-pointer'}`}
        style={{ backgroundColor: current?.color || '#94a3b8', color: '#fff' }}
      >
        {current?.icon && <i className={`${current.icon} text-[8px]`} />}
        <span>{current?.name || '—'}</span>
        {current?.notify_client && <i className="fa-solid fa-envelope text-[8px] opacity-70" />}
        {!disabled && <i className="fa-solid fa-chevron-down text-[7px] opacity-60 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[200] ${dropPos === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
            left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {itemsAbove.map(item => (
              <button key={item.id}
                onClick={e => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color || '#94a3b8' }}>
                  <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
                {item.notify_client && renderNotifyBadge()}
              </button>
            ))}
            <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
              <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: current?.color || '#94a3b8' }}>
                  <i className={`${current?.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{current?.name || '—'}</span>
                {current?.notify_client && renderNotifyBadge()}
                <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" />
              </div>
            </div>
            {itemsBelow.map(item => (
              <button key={item.id}
                onClick={e => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color || '#94a3b8' }}>
                  <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
                {item.notify_client && renderNotifyBadge()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ACTIONS MENU ─────────────────────────────────────────────────────────────
const ActionsMenu: React.FC<{
  deal: Deal;
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
}> = ({ deal, user, onEdit, onShare, onArchive, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef   = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const canEdit   = canUserAction(user, deal, 'edit');
  const canDelete = canUserAction(user, deal, 'delete');
  const canShare  = canUserAction(user, deal, 'share');

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuH = 180;
    const top = window.innerHeight - rect.bottom < menuH ? rect.top - menuH - 4 : rect.bottom + 4;
    setMenuStyle({ position: 'fixed', top, left: rect.left, zIndex: 9999 });
    setIsOpen(p => !p);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler   = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onScroll  = () => setIsOpen(false);
    const onKey     = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <>
      <button ref={buttonRef} onClick={openMenu}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0"
        title="Opciones">
        <i className="fa-solid fa-ellipsis-vertical text-[11px]" />
      </button>
      {isOpen && (
        <div ref={menuRef} style={menuStyle} className="w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-sm">
          {canEdit && (
            <button onMouseDown={e => { e.stopPropagation(); onEdit(deal); setIsOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-600 flex items-center gap-2.5 text-xs transition-colors">
              <i className="fa-solid fa-pen text-slate-300 w-3.5" /> Editar
            </button>
          )}
          {canShare && (
            <button onMouseDown={e => { e.stopPropagation(); onShare(deal); setIsOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-600 flex items-center gap-2.5 text-xs transition-colors">
              <i className="fa-solid fa-user-plus text-slate-300 w-3.5" /> Compartir
            </button>
          )}
          <button onMouseDown={e => { e.stopPropagation(); onArchive(deal); setIsOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-600 flex items-center gap-2.5 text-xs transition-colors">
            <i className={`fa-solid ${deal.archived ? 'fa-box-open' : 'fa-box-archive'} text-slate-300 w-3.5`} />
            {deal.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          {canDelete && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button onMouseDown={e => { e.stopPropagation(); onDelete(deal.id_trato); setIsOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500 flex items-center gap-2.5 text-xs transition-colors">
                <i className="fa-solid fa-trash text-red-300 w-3.5" /> Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

// ─── DEAL CARD ────────────────────────────────────────────────────────────────
const DealCard: React.FC<{
  deal: Deal;
  cachedDealStatuses: DealStatus[];
  cachedDealInterests: DealInterest[];
  user: any;
  onNavigate: (id: string) => void;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onStatusSelect: (deal: Deal, id: string) => void;
  onInterestSelect: (deal: Deal, id: string) => void;
}> = ({ deal, cachedDealStatuses, cachedDealInterests, user, onNavigate,
        onEdit, onShare, onArchive, onDelete, onStatusSelect, onInterestSelect }) => {

  const status = cachedDealStatuses.find(s =>
    s.id_status === deal.id_deal_status ||
    s.name?.toUpperCase() === ((deal as any).estado_nombre ?? '').toUpperCase()
  );
  const interest = cachedDealInterests.find(i =>
    i.id_interest === deal.id_interest ||
    i.name?.toUpperCase() === deal.interes_nombre?.toUpperCase()
  );

  const valor    = parseDealValue(deal.valor_trato);
  const cierre   = formatDate((deal as any).fecha_cierre_esperada);
  const updated  = formatDate(deal.updated_at);
  const inactive = inactiveMeta(deal.days_inactive);
  const canEdit  = canEditInline(user, deal);

  return (
    <div
      onClick={() => onNavigate(deal.id_trato)}
      className="bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col"
    >
      {/* Franja de color del estado */}
      <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: status?.color || '#e2e8f0' }} />

      <div className="p-3 flex flex-col gap-2.5 flex-1">

        {/* ── HEADER: actions + estado seleccionable ── */}
        <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          <InlineBadgeSelector
            valueId={deal.id_deal_status || ''}
            items={cachedDealStatuses.map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon, notify_client: s.notify_client }))}
            onSelect={id => onStatusSelect(deal, id)}
            disabled={!canEdit}
          />
          <ActionsMenu deal={deal} user={user} onEdit={onEdit} onShare={onShare} onArchive={onArchive} onDelete={onDelete} />
        </div>

        {/* ── NOMBRE ── */}
        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-slate-900">
          {deal.nombre_trato || 'Sin nombre'}
        </h3>

        {/* ── CLIENTE + CONTACTO ── */}
        <div className="space-y-0.5">
          {deal.client_company_name && (
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-building text-[9px] text-slate-300 w-3 text-center flex-shrink-0" />
              <span className="text-xs text-slate-600 truncate">{deal.client_company_name}</span>
            </div>
          )}
          {deal.contact_full_name && (
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-user text-[9px] text-slate-300 w-3 text-center flex-shrink-0" />
              <span className="text-xs text-slate-400 truncate">{deal.contact_full_name}</span>
            </div>
          )}
        </div>

        {/* ── INTERÉS seleccionable ── */}
        {(deal.id_interest || deal.interes_nombre) && (
          <div onClick={e => e.stopPropagation()}>
            <InlineBadgeSelector
              valueId={deal.id_interest || ''}
              items={cachedDealInterests.map(i => ({ id: i.id_interest, name: i.name, color: i.color, icon: i.icon }))}
              onSelect={id => onInterestSelect(deal, id)}
              disabled={!canEdit}
            />
          </div>
        )}

        {/* ── FOOTER: valor + fechas + inactividad ── */}
        <div className="flex items-end justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
          {valor > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
              <span className="text-[11px] font-semibold text-slate-800">$</span>
              <span className="text-[11px] font-semibold text-slate-800 tabular-nums">{formatAmount(valor)}</span>
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}

          <div className="flex items-center gap-2">
            {cierre && (
              <div className="flex items-center gap-1">
                <i className="fa-solid fa-calendar-days text-[8px] text-slate-300" />
                <span className="text-[10px] text-slate-400">{cierre}</span>
              </div>
            )}
            {!cierre && updated && (
              <span className="text-[10px] text-slate-400">{updated}</span>
            )}
            {inactive && (
              <span className={`text-[10px] font-semibold ${inactive.cls}`}>
                {inactive.label}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const DealsListView: React.FC<DealsListViewProps> = ({
  deals, cachedDealStatuses, cachedDealInterests,
  showArchived, grouping, user,
  onEdit, onShare, onArchive, onDelete, onStatusChange, onInterestChange, onRefresh,
}) => {
  const navigate = useNavigate();

  // ─── LOCAL STATE FOR GROUP COLLAPSE ──────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dealsListCollapsedGroups');
    try { return new Set(saved ? JSON.parse(saved) : []); } catch { return new Set(); }
  });

  const saveCollapsedGroups = (newSet: Set<string>) => {
    setCollapsedGroups(newSet);
    localStorage.setItem('dealsListCollapsedGroups', JSON.stringify(Array.from(newSet)));
  };

  const toggleGroupCollapse = (groupKey: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupKey)) { newSet.delete(groupKey); } else { newSet.add(groupKey); }
    saveCollapsedGroups(newSet);
  };

  const expandAll = () => saveCollapsedGroups(new Set());
  const collapseAll = () => saveCollapsedGroups(new Set(groupedDeals.map(g => g.key)));

  const filteredDeals = showArchived
    ? deals.filter(d => d.archived === true)
    : deals.filter(d => !d.archived);

  const totalValor = filteredDeals.reduce((s, d) => s + parseDealValue(d.valor_trato), 0);
  const activeGroup = grouping[0] || '';

  const groupedDeals = useMemo(() => {
    if (!activeGroup) return [] as Array<{ key: string; deals: Deal[]; subtotal: number }>;

    const groups = new Map<string, Deal[]>();

    filteredDeals.forEach((deal) => {
      let key = 'Sin asignar';
      if (activeGroup === 'client_company_name') {
        key = deal.client_company_name || 'Sin cliente';
      } else if (activeGroup === 'estado_nombre') {
        key = (deal as any).estado_nombre || deal.estado_actual?.name || 'Sin estado';
      } else if (activeGroup === 'interes_nombre') {
        key = deal.interes_nombre || deal.interes_actual?.name || 'Sin interés';
      }

      const current = groups.get(key) || [];
      current.push(deal);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, groupDeals]) => ({
        key,
        deals: groupDeals,
        subtotal: groupDeals.reduce((sum, d) => sum + parseDealValue(d.valor_trato), 0),
      }));
  }, [filteredDeals, activeGroup]);

  const handleStatusSelect = async (deal: Deal, newStatusId: string) => {
    const newStatus = cachedDealStatuses.find(s => s.id_status === newStatusId);
    if (!newStatus || newStatusId === deal.id_deal_status) return;

    if (newStatus.status_category === 'WON') {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/quotes?id_trato=${deal.id_trato}`);
        const quotesData = await res.json();
        const quotes = Array.isArray(quotesData) ? quotesData : quotesData?.quotes || [];
        if (quotes.length > 0) { onStatusChange(deal, newStatusId, quotes, newStatusId); return; }
      } catch { /* fall through */ }
    }

    try {
      await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: newStatusId, id_user: user?.id_user }),
      });
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleInterestSelect = async (deal: Deal, newInterestId: string) => {
    if (newInterestId === deal.id_interest) return;
    onInterestChange(deal, newInterestId);
  };

  if (filteredDeals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-regular fa-handshake text-5xl text-slate-200" />
          <p className="text-sm text-slate-400">No hay tratos para mostrar</p>
          <button onClick={() => navigate('/app/deals/new')}
            className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
            Crear trato
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        {activeGroup ? (
          <div className="space-y-4">
            {groupedDeals.length > 0 && (
              <div className="flex items-center gap-2 text-xs mb-3">
                <button onClick={expandAll}
                  className="text-slate-400 hover:text-slate-700 transition-colors">
                  expandir
                </button>
                <span className="text-slate-300">/</span>
                <button onClick={collapseAll}
                  className="text-slate-400 hover:text-slate-700 transition-colors">
                  contraer
                </button>
              </div>
            )}
            {groupedDeals.map(group => (
              <section key={group.key} className="space-y-2">
                <button
                  onClick={() => toggleGroupCollapse(group.key)}
                  className="w-full flex items-center gap-2 px-1 py-1 hover:bg-slate-50 rounded transition-colors text-left"
                >
                  <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${collapsedGroups.has(group.key) ? '-rotate-90' : ''}`} />
                  <span className="text-xs font-semibold text-slate-600">{group.key}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">{group.deals.length}</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                    <span className="text-[10px] font-semibold text-slate-700">$</span>
                    <span className="text-[10px] font-semibold text-slate-700 tabular-nums">{formatAmount(group.subtotal)}</span>
                  </span>
                </button>
                {!collapsedGroups.has(group.key) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {group.deals.map(deal => (
                      <DealCard
                        key={deal.id_trato}
                        deal={deal}
                        cachedDealStatuses={cachedDealStatuses}
                        cachedDealInterests={cachedDealInterests}
                        user={user}
                        onNavigate={id => navigate(`/app/deals/${id}`)}
                        onEdit={onEdit}
                        onShare={onShare}
                        onArchive={onArchive}
                        onDelete={onDelete}
                        onStatusSelect={handleStatusSelect}
                        onInterestSelect={handleInterestSelect}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredDeals.map(deal => (
              <DealCard
                key={deal.id_trato}
                deal={deal}
                cachedDealStatuses={cachedDealStatuses}
                cachedDealInterests={cachedDealInterests}
                user={user}
                onNavigate={id => navigate(`/app/deals/${id}`)}
                onEdit={onEdit}
                onShare={onShare}
                onArchive={onArchive}
                onDelete={onDelete}
                onStatusSelect={handleStatusSelect}
                onInterestSelect={handleInterestSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between bg-white flex-shrink-0">
        <span className="text-xs text-slate-500">{filteredDeals.length} tratos</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</span>
          <span className="text-xs font-semibold text-slate-700">$</span>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatAmount(totalValor)}</span>
        </span>
      </div>
    </div>
  );
};

export default DealsListView;