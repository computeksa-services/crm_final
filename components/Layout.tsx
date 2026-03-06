import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { getImageUrl } from '../utils/imageUtils';
import { NAV_GROUPS, PAGE_NAMES } from '../services/routes.config';
import { ButtonLoader } from './AppLoaders';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('theme-dark');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-desktop-open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const { user, logout } = useAuth();
  const { loading: cacheLoading, currentUser } = useDataCache();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user?.rol_user || 'usuario';
  const isWorkspaceOwner = user?.is_owner === true;
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const mobileCurrentRouteLabel = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || 'dashboard';
    const knownRoutes = ['quotes', 'deals', 'financials', 'client-companies', 'client-contacts', 'companies', 'products', 'users', 'profile', 'account-settings', 'integrations', 'workspace-settings', 'settings', 'calendar', 'dashboard', 'new', 'edit', 'marketing'];

    if (location.pathname === '/app/followups') {
      return 'Seguimiento';
    }

    if (lastSegment === 'edit' && pathSegments.length > 1) {
      return location.state?.breadcrumb || 'Edición';
    }

    if (!knownRoutes.includes(lastSegment) && pathSegments.length > 1) {
      return location.state?.breadcrumb || 'Detalle';
    }

    if (lastSegment === 'new' && pathSegments.length > 1) {
      return 'Nuevo';
    }

    return PAGE_NAMES[lastSegment] || lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [location.pathname, location.state]);

  const visibleNavGroups = useMemo(() => {
    if (!user) return NAV_GROUPS;
    if (user.is_owner) return NAV_GROUPS;
    if (user.rol_user === 'admin') {
      return NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (!item.module) return true;
          if (item.module === 'crm') return true;
          return currentUser?.module_access?.[item.module as keyof typeof currentUser.module_access];
        })
      })).filter(group => group.items.length > 0);
    }
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.module) return true;
        return currentUser?.module_access?.[item.module as keyof typeof currentUser.module_access];
      })
    })).filter(group => group.items.length > 0);
  }, [user, currentUser?.module_access]);

  useEffect(() => {
    localStorage.setItem('sidebar-desktop-open', JSON.stringify(isDesktopSidebarOpen));
  }, [isDesktopSidebarOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme-dark', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (userMenuOpen && userMenuButtonRef.current) {
      const rect = userMenuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const openAccountSettings = (tab: 'profile' | 'personalIntegrations' | 'tenantIntegrations' | 'tenantUsers' | 'tenantConfigurations' = 'profile') => {
    localStorage.setItem('accountSettings-activeTab', tab);
    setUserMenuOpen(false);
    navigate(`/app/account-settings?tab=${tab}`);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuButtonRef.current && !userMenuButtonRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  // ─── Nav Link Item ────────────────────────────────────────────────────────
  const NavLinkItem = ({ item, isCollapsed }: { item: any, isCollapsed: boolean }) => {
    if (!item.roles.includes(userRole)) return null;
    const isActive = location.pathname.startsWith(item.path);

    return (
      <li className="relative group">
        <Link
          to={item.path}
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`
            flex items-center gap-2 rounded-md transition-all duration-150 select-none
            ${isCollapsed ? 'justify-center px-0 py-1.5 mx-1' : 'px-2.5 py-1.5 mx-1'}
            ${isActive
              ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-600'
              : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
            }
          `}
        >
          {/* Icon */}
          <span className={`flex-shrink-0 flex items-center justify-center ${isCollapsed ? 'w-5 h-5' : 'w-5 h-5'}`}>
            <i className={`fa-solid ${item.icon} text-[13px] ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}></i>
          </span>

          {/* Label */}
          {!isCollapsed && (
            <span className="text-[13px] leading-none whitespace-nowrap">
              {item.label}
            </span>
          )}

          {/* Tooltip para modo contraído */}
          {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 bg-slate-800 dark:bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
              {item.label}
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800 dark:border-r-slate-900"></span>
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 overflow-hidden font-sans">

      {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/20 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-white dark:bg-slate-900
          border-r border-slate-200 dark:border-slate-800
          flex flex-col transition-all duration-200 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0 w-44' : '-translate-x-full md:translate-x-0'}
          ${isDesktopSidebarOpen ? 'md:w-44' : 'md:w-11'}
        `}
      >
        {/* Logo */}
        <div
          className={`flex items-center border-b border-slate-200 dark:border-slate-800 cursor-pointer shrink-0
            ${isDesktopSidebarOpen ? 'h-[52px] px-2 justify-start' : 'h-[52px] px-0 justify-center'}
          `}
          onClick={() => navigate('/app/dashboard')}
        >
          {isDesktopSidebarOpen ? (
            <img src="/logo_large2.png" alt="COMPUTEKSA" className="w-full h-7 object-contain object-left" />
          ) : (
            <img src="/logo.png" alt="COMPUTEKSA" className="w-6 h-6 object-contain" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
          <ul className="space-y-0.5">
            {visibleNavGroups.map((group, idx) => (
              <div key={idx}>
                {/* Group label */}
                {isDesktopSidebarOpen && group.title && (
                  <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest select-none">
                    {group.title}
                  </p>
                )}
                {!isDesktopSidebarOpen && idx > 0 && (
                  <div className="h-px bg-slate-200 dark:bg-slate-800 mx-3 my-2" />
                )}

                {group.items.map(item => (
                  <NavLinkItem
                    key={item.path}
                    item={item}
                    isCollapsed={!isMobileSidebarOpen ? !isDesktopSidebarOpen : false}
                  />
                ))}
              </div>
            ))}

            {/* Admin section */}
            {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
              <div>
                {isDesktopSidebarOpen && (
                  <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest select-none">
                    Administración
                  </p>
                )}
                {!isDesktopSidebarOpen && (
                  <div className="h-px bg-slate-200 dark:bg-slate-800 mx-3 my-2" />
                )}

                {/* Configuración */}
                <li className="relative group list-none">
                  <Link
                    to="/app/account-settings"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                        setIsDesktopSidebarOpen(false);
                      }
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`
                      flex items-center gap-2 rounded-md transition-all duration-150 select-none mx-1
                      ${(!isMobileSidebarOpen ? !isDesktopSidebarOpen : false)
                        ? 'justify-center px-0 py-1.5'
                        : 'px-2.5 py-1.5'
                      }
                      ${location.pathname.startsWith('/app/account-settings')
                        ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-600'
                        : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
                      }
                    `}
                  >
                    <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5`}>
                      <i className={`fa-solid fa-sliders text-[13px] ${location.pathname.startsWith('/app/account-settings') ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-700'}`}></i>
                    </span>
                    {(!isMobileSidebarOpen ? isDesktopSidebarOpen : true) && (
                      <span className="text-[13px] leading-none whitespace-nowrap">Configuración</span>
                    )}
                    {(!isMobileSidebarOpen ? !isDesktopSidebarOpen : false) && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 bg-slate-800 dark:bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
                        Configuración
                        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800 dark:border-r-slate-900"></span>
                      </div>
                    )}
                  </Link>
                </li>

                {user?.rol_user === 'superadmin' && (
                  <NavLinkItem item={{ label: 'Usuarios', path: '/app/users', icon: 'fa-users-cog', roles: ['superadmin'] }} isCollapsed={!isMobileSidebarOpen ? !isDesktopSidebarOpen : false} />
                )}
                {(user?.rol_user === 'superadmin' || currentUser?.module_access?.financials) && (
                  <NavLinkItem item={{ label: 'Cartera', path: '/app/financials', icon: 'fa-wallet', roles: ['admin', 'superadmin'] }} isCollapsed={!isMobileSidebarOpen ? !isDesktopSidebarOpen : false} />
                )}
                {userRole === 'superadmin' && (
                  <NavLinkItem item={{ label: 'Tenants', path: '/app/companies', icon: 'fa-server', roles: ['superadmin'] }} isCollapsed={!isMobileSidebarOpen ? !isDesktopSidebarOpen : false} />
                )}
              </div>
            )}
          </ul>
        </nav>
      </aside>

      {/* ── Logout Confirm Modal ─────────────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-xs w-full mx-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 mx-auto mb-4">
              <i className="fa-solid fa-arrow-right-from-bracket text-red-500 text-base"></i>
            </div>
            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 text-center mb-1">¿Cerrar sesión?</h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center mb-5">Tu sesión actual será terminada.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2 px-4 rounded-lg text-[13px] font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Header */}
        <header className="h-[52px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <i className="fa-solid fa-bars text-base"></i>
            </button>

            {/* Toggle (desktop) */}
            <button
              onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
              className="hidden md:flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
            >
              <i className={`fa-solid fa-indent text-sm transition-transform duration-200 ${!isDesktopSidebarOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="sm:hidden text-slate-800 dark:text-slate-100 font-medium text-[12px] truncate max-w-[160px]">
                {mobileCurrentRouteLabel}
              </span>

              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                {(() => {
                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const lastSegment = pathSegments[pathSegments.length - 1] || 'dashboard';
                  if (location.pathname === '/app/followups') {
                    return <span className="text-slate-800 dark:text-slate-100 font-medium text-[13px]">Seguimiento</span>;
                  }
                  const knownRoutes = ['quotes', 'deals', 'financials', 'client-companies', 'client-contacts', 'companies', 'products', 'users', 'profile', 'account-settings', 'integrations', 'workspace-settings', 'settings', 'calendar', 'dashboard', 'new', 'edit', 'marketing'];
                  let breadcrumbs: { label: string; path: string; isActive: boolean }[] = [];
                  if (lastSegment === 'edit' && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    breadcrumbs = [
                      { label: collectionName, path: `/app/${collectionKey}`, isActive: false },
                      { label: location.state?.breadcrumb || 'Edición', path: location.pathname, isActive: true }
                    ];
                  } else if (!knownRoutes.includes(lastSegment) && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    breadcrumbs = [
                      { label: collectionName, path: `/app/${collectionKey}`, isActive: false },
                      { label: location.state?.breadcrumb || 'Detalle', path: location.pathname, isActive: true }
                    ];
                  } else if (lastSegment === 'new' && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    breadcrumbs = [
                      { label: collectionName, path: `/app/${collectionKey}`, isActive: false },
                      { label: 'Nuevo', path: location.pathname, isActive: true }
                    ];
                  } else {
                    const pageName = PAGE_NAMES[lastSegment] || lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    breadcrumbs = [{ label: pageName, path: location.pathname, isActive: true }];
                  }
                  return breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.path}>
                      {idx > 0 && (
                        <i className="fa-solid fa-chevron-right text-[9px] text-slate-300 dark:text-slate-600 mx-0.5"></i>
                      )}
                      {crumb.isActive ? (
                        <span className="text-slate-800 dark:text-slate-100 font-medium text-[13px]">{crumb.label}</span>
                      ) : (
                        <Link
                          to={crumb.path}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-[13px] transition-colors"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </React.Fragment>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {cacheLoading && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ButtonLoader size="xs" />
                <span className="hidden sm:block">Cargando...</span>
              </div>
            )}

            {user?.name_tenant && (
              <div className="flex flex-col items-end leading-none">
                <span className="text-[11px] sm:text-[12px] font-semibold text-slate-900 dark:text-slate-100 tracking-wide">
                  {user.name_tenant}
                </span>
                <span className="text-[9px] sm:text-[10px] italic text-slate-500 dark:text-slate-400 mt-0.5">Workspace</span>
              </div>
            )}

            {/* Avatar button */}
            <div className="relative flex items-center" ref={userMenuRef}>
              <button
                ref={userMenuButtonRef}
                onClick={() => setUserMenuOpen(o => !o)}
                className={`relative flex items-center justify-center p-1 rounded-full transition-all duration-150 border
                  ${userMenuOpen
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }
                `}
              >
                <img
                  src={getImageUrl(user?.avatar_url) || 'https://ui-avatars.com/api/?name=User&background=random'}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 dark:bg-slate-800/30 p-1 md:p-2 scroll-smooth">
          <div className="w-full h-full">
            {children}
          </div>
        </main>

        {/* ── User dropdown portal ───────────────────────────────────────────── */}
        {userMenuOpen && menuPosition && createPortal(
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-[99999]"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/80 mb-1">
              <div className="flex items-center gap-2.5">
                <img
                  src={getImageUrl(user?.avatar_url) || 'https://ui-avatars.com/api/?name=User&background=random'}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {user?.name_user || 'Usuario'}
                  </p>
                  {user?.name_tenant && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{user.name_tenant}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mi Cuenta */}
            <MenuSection label="Mi cuenta">
              <MenuItem
                icon="fa-regular fa-user"
                label="Perfil"
                onClick={() => openAccountSettings('profile')}
              />
            </MenuSection>

            <MenuDivider />

            {/* Integraciones */}
            <MenuSection label="Integraciones">
              <MenuItem
                icon="fa-solid fa-plug"
                label="Integraciones personales"
                onClick={() => openAccountSettings('personalIntegrations')}
              />
            </MenuSection>

            {isWorkspaceOwner && (
              <>
                <MenuDivider />
                <MenuSection label="Workspace">
                  <MenuItem
                    icon="fa-solid fa-building"
                    label="Integraciones del workspace"
                    onClick={() => openAccountSettings('tenantIntegrations')}
                  />
                </MenuSection>
              </>
            )}

            <MenuDivider />

            {/* Preferencias */}
            <button
              type="button"
              onClick={() => { setIsDarkMode((prev) => !prev); setUserMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors rounded-md mx-auto"
              style={{ width: 'calc(100% - 8px)', marginLeft: 4, marginRight: 4 }}
            >
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} w-4 text-center text-slate-400 text-[12px]`}></i>
              <span>{isDarkMode ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>

            <MenuDivider />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-md"
              style={{ width: 'calc(100% - 8px)', marginLeft: 4, marginRight: 4 }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket w-4 text-center text-[12px]"></i>
              <span>Cerrar sesión</span>
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

// ── Helper sub-components ──────────────────────────────────────────────────────

const MenuSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
      {label}
    </p>
    {children}
  </div>
);

const MenuDivider = () => (
  <div className="h-px bg-slate-100 dark:bg-slate-700/60 my-1.5 mx-3" />
);

const MenuItem = ({
  icon,
  label,
  description,
  onClick,
}: {
  icon: string;
  label: string;
  description?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors rounded-md"
    style={{ width: 'calc(100% - 8px)', marginLeft: 4, marginRight: 4 }}
  >
    <i className={`${icon} w-4 text-center text-slate-400 dark:text-slate-500 text-[12px] flex-shrink-0`}></i>
    <div className="min-w-0">
      <span className="block">{label}</span>
      {description && (
        <span className="block text-[11px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">{description}</span>
      )}
    </div>
  </button>
);

export default Layout;