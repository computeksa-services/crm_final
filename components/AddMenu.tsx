import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AddMenuProps {
  onAddDeal: () => void;
  onAddContact: () => void;
  onAddCompany: () => void;
  onAddQuote: () => void;
  onAddProduct: () => void;
  onAddPortfolio: () => void;
  onAddCampaign: () => void;
  isCollapsed?: boolean;
}

const AddMenu: React.FC<AddMenuProps> = ({
  onAddDeal,
  onAddContact,
  onAddCompany,
  onAddQuote,
  onAddProduct,
  onAddPortfolio,
  onAddCampaign,
  isCollapsed = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuItems = [
    { label: 'Trato',      icon: 'fa-handshake', color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10',   onClick: onAddDeal },
    { label: 'Contacto',   icon: 'fa-user',       color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-500/10', onClick: onAddContact },
    { label: 'Empresa',    icon: 'fa-building',   color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10',  onClick: onAddCompany },
    { label: 'Cotización', icon: 'fa-receipt',    color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10',  onClick: onAddQuote },
    { label: 'Producto',   icon: 'fa-box',        color: 'text-cyan-500',   bg: 'bg-cyan-50 dark:bg-cyan-500/10',   onClick: onAddProduct },
    { label: 'Cartera',    icon: 'fa-briefcase',  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10', onClick: onAddPortfolio },
    { label: 'Campaña',    icon: 'fa-bullhorn',   color: 'text-pink-500',   bg: 'bg-pink-50 dark:bg-pink-500/10',   onClick: onAddCampaign },
  ];

  // Calcular posición cuando abre
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = menuItems.length * 40 + 16;

      let finalLeft = rect.right + 8;
      let finalTop = rect.top;

      if (finalLeft + menuWidth > window.innerWidth - 16) {
        finalLeft = rect.left - menuWidth - 8;
      }
      if (finalTop + menuHeight > window.innerHeight - 16) {
        finalTop = window.innerHeight - menuHeight - 16;
      }

      setPosition({ left: finalLeft, top: finalTop });

      // pequeño delay para animar la entrada
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  const handleMenuItemClick = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(o => !o)}
        className={`
          flex items-center rounded-lg transition-all duration-150 select-none
          ${isCollapsed
            ? 'gap-0 px-0 py-0 w-10 h-10 justify-center rounded-full'
            : 'gap-2 px-3 py-1.5 w-full'
          }
          ${isOpen
            ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-600'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
          }
        `}
        title={isCollapsed ? 'Nuevo' : undefined}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
          {/* El icono rota suavemente al abrir */}
          <i
            className="fa-solid fa-plus text-[13px] transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          />
        </span>
        <span
          className={`text-[13px] leading-none whitespace-nowrap font-semibold transition-opacity duration-200 ${
            isCollapsed ? 'hidden' : 'block'
          }`}
        >
          Nuevo
        </span>
      </button>

      {/* Menú portal */}
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80]"
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
              // Animación de entrada: scale + opacity + translate
              transformOrigin: 'left top',
              transform: mounted ? 'scale(1) translateX(0)' : 'scale(0.95) translateX(-6px)',
              opacity: mounted ? 1 : 0,
              transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1), opacity 120ms ease',
            }}
          >
              <div
                className="
                  bg-white dark:bg-slate-800
                  rounded-xl
                  shadow-xl shadow-slate-900/10 dark:shadow-slate-900/40
                  border border-slate-200/80 dark:border-slate-700/60
                  py-1.5
                  min-w-[200px]
                  overflow-hidden
                "
              >
                {/* Cabecera discreta */}
                <div className="px-4 pt-1 pb-2 mb-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
                    Nuevo
                  </p>
                </div>

                {/* Separador */}
                <div className="h-px bg-slate-100 dark:bg-slate-700/60 mx-2 mb-1" />

                {menuItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMenuItemClick(item.onClick)}
                    className="
                      w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left
                      text-slate-700 dark:text-slate-300
                      hover:bg-slate-50 dark:hover:bg-slate-700/40
                      active:bg-slate-100 dark:active:bg-slate-700/70
                      transition-colors duration-75
                      font-medium
                      group
                      mx-auto
                    "
                    style={{ width: 'calc(100% - 0px)' }}
                  >
                    {/* Ícono con fondo de color suave */}
                    <span
                      className={`
                        flex-shrink-0 flex items-center justify-center
                        w-6 h-6 rounded-md
                        ${item.bg}
                        transition-transform duration-100 group-hover:scale-110
                      `}
                    >
                      <i className={`fa-solid ${item.icon} ${item.color} text-[11px]`} />
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
    </>
  );
};

export default AddMenu;