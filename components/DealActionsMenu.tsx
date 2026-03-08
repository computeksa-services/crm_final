import React, { useEffect, useRef, useState } from 'react';
import { Deal } from '../types';
import { canUserAction } from '../utils/permissions';

interface DealActionsMenuProps {
  deal: Deal;
  user: any;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  anchor?: 'auto-left' | 'auto-right' | 'top-left' | 'top-right';
  triggerClassName?: string;
  showTrigger?: boolean;
}

const MENU_WIDTH = 176;
const MENU_MAX_HEIGHT = 220;
const VIEWPORT_PADDING = 8;
const HOVER_CLOSE_DELAY_MS = 550;

const DealActionsMenu: React.FC<DealActionsMenuProps> = ({
  deal,
  user,
  onEdit,
  onShare,
  onArchive,
  onDelete,
  anchor = 'auto-left',
  triggerClassName,
  showTrigger = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const canEdit = canUserAction(user, deal, 'edit');
  const canDelete = canUserAction(user, deal, 'delete');
  const canShare = canUserAction(user, deal, 'share');

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  const computeMenuPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || MENU_MAX_HEIGHT;
    const menuWidth = menuRef.current?.offsetWidth || MENU_WIDTH;

    const placeTop =
      anchor.startsWith('top') ||
      (anchor.startsWith('auto') && (window.innerHeight - rect.bottom < menuHeight + 8));
    const alignRight = anchor.endsWith('right');

    const top = placeTop ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = alignRight ? rect.right - menuWidth : rect.left;

    const clampedTop = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PADDING));
    const clampedLeft = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PADDING));

    setMenuStyle({ position: 'fixed', top: clampedTop, left: clampedLeft, zIndex: 9999 });
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    clearCloseTimer();
    computeMenuPosition();
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      computeMenuPosition();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, anchor]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => setIsOpen(false);
    const handleResize = () => setIsOpen(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  if (!showTrigger) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={() => { if (isOpen) scheduleClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openMenu}
        className={triggerClassName || 'w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0'}
        title="Opciones"
      >
        <i className="fa-solid fa-ellipsis-vertical text-[11px]" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-sm"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onEdit(deal);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
            >
              <i className="fa-solid fa-pen text-slate-400 w-3.5" /> Editar
            </button>
          )}

          {canShare && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onShare(deal);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
            >
              <i className="fa-solid fa-user-plus text-slate-400 w-3.5" /> Compartir
            </button>
          )}

          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              onArchive(deal);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
          >
            <i className={`fa-solid ${deal.archived ? 'fa-box-open' : 'fa-box-archive'} text-slate-400 w-3.5`} />
            {deal.archived ? 'Desarchivar' : 'Archivar'}
          </button>

          {canDelete && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onDelete(deal.id_trato);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2.5 text-xs transition-colors"
              >
                <i className="fa-solid fa-trash text-red-400 w-3.5" /> Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default DealActionsMenu;
