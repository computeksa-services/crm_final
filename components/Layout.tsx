import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { NAV_GROUPS, PAGE_NAMES } from '../services/routes.config';
import { ButtonLoader } from './AppLoaders';
import Avatar from './Avatar';
import AddMenu from './AddMenu';
import CompanyForm from '../pages/clients/CompanyForm';
import ContactForm from '../pages/clients/ContactForm';
import InteractionEventCaptureModal from './InteractionEventCaptureModal';
import { EventFormData, EventAttendee } from '../pages/calendar/EventModal';
import { apiFetch } from '../services/apiClient';

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
  const [collapsedNavHover, setCollapsedNavHover] = useState<{ label: string; top: number; left: number } | null>(null);
  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const { user, logout } = useAuth();
  const { loading: cacheLoading, currentUser, contacts, users } = useDataCache();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user?.rol_user || 'usuario';
  const isWorkspaceOwner = user?.is_owner === true;
  const isSidebarCollapsed = !isDesktopSidebarOpen && !isMobileSidebarOpen;
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

  useEffect(() => {
    if (isDesktopSidebarOpen || isMobileSidebarOpen) {
      setCollapsedNavHover(null);
    }
  }, [isDesktopSidebarOpen, isMobileSidebarOpen]);

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

  const handleEventCapture = async (payload: { formData: EventFormData; attendees: EventAttendee[] }) => {
    if (!user?.id_user || !user?.id_tenant) return;

    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          id_user: user.id_user,
          id_tenant: user.id_tenant,
          event: {
            title: payload.formData.title,
            description: payload.formData.description,
            start: new Date(payload.formData.start).toISOString(),
            end: new Date(payload.formData.end).toISOString(),
            is_all_day: payload.formData.is_all_day,
            location: payload.formData.location || undefined,
            generate_meeting: payload.formData.generate_meeting,
            id_trato: payload.formData.id_trato || undefined,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
          },
          attendees: payload.attendees,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Error al crear evento');
      }

      setIsEventModalOpen(false);
    } catch (error) {
      console.error('Error creating event:', error);
      alert(error instanceof Error ? error.message : 'Error al crear el evento');
    }
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
      <li
        className={`relative group ${isCollapsed ? 'flex justify-center' : ''}`}
        onMouseEnter={(e) => {
          if (!isCollapsed) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setCollapsedNavHover({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 10 });
        }}
        onMouseLeave={() => { if (isCollapsed) setCollapsedNavHover(null); }}
      >
        <Link
          to={item.path}
          onClick={() => { setIsMobileSidebarOpen(false); setCollapsedNavHover(null); }}
          className={`
            flex items-center rounded-lg transition-all duration-150 select-none
            ${isCollapsed
              ? 'gap-0 px-0 py-0 w-10 h-10 justify-center rounded-full'
              : 'gap-2 px-3 py-1.5 mx-2 w-auto'}
            ${isActive
              ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-600'
              : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
            }
          `}
        >
          {/* Icon */}
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
            <i className={`fa-solid ${item.icon} text-[13px] ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}></i>
          </span>

          {/* Label - ocultar cuando contraído */}
          <span className={`text-[13px] leading-none whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'hidden' : 'block'}`}>
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-slate-900 overflow-hidden font-sans flex-col">

      {/* ── HEADER FIJO ──────────────────────────────────────────────────────── */}
      <header className="h-[52px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-[60] px-4 flex-shrink-0">
        
        {/* Hamburguesa + Logo */}
        <div className="flex items-center gap-3">
{/* Mobile hamburger to toggle sidebar overlay */}
          <button
            onClick={() => setIsMobileSidebarOpen(o => !o)}
            className="md:hidden flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>

          {/* Desktop toggle */}
          <button
            onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
            className="hidden md:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>

          {/* Logo: show small favicon on mobile, full logo on md+ */}
          <img 
            src="/favicon.png" 
            alt="COMPUTEK" 
            className="w-8 h-8 object-contain cursor-pointer block md:hidden" 
            onClick={() => navigate('/app/dashboard')}
          />
          <img 
            src="/logo_large2.png" 
            alt="COMPUTEKSA" 
            className="w-24 h-auto object-contain cursor-pointer hidden md:block" 
            onClick={() => navigate('/app/dashboard')}
          />
        </div>

        <div className="flex items-center gap-6 flex-1 ml-3 md:ml-4 border-l border-slate-200 dark:border-slate-800 pl-5 md:pl-6">
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
        <div className="flex items-center gap-3 ml-auto">
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
              <Avatar src={user?.avatar_url || null} name={user?.name_user || 'Usuario'} size="sm" />
              <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENEDOR PRINCIPAL (Sidebar + Content) ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-[45] bg-black/20 backdrop-blur-[2px] md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
        <aside
          onMouseLeave={() => { setCollapsedNavHover(null); if (isMobileSidebarOpen) setIsMobileSidebarOpen(false); }}
          className={`
            bg-white dark:bg-slate-900
            border-r border-slate-200 dark:border-slate-800
            flex flex-col shrink-0 transition-all duration-200 ease-in-out
            fixed md:relative inset-y-0 left-0 top-[52px] md:top-0 z-[50]
            ${isMobileSidebarOpen ? 'translate-x-0 w-44' : '-translate-x-full md:translate-x-0'}
            ${isDesktopSidebarOpen ? 'md:w-48' : 'md:w-16'}
          `}
        >
          {/* Nav */}
          <nav className={`flex-1 py-2 scrollbar-none ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>
            <ul className="space-y-0.5">
              {/* Add Menu Button - encima de Dashboard */}
              <li className={`${isSidebarCollapsed ? 'flex justify-center' : 'px-2'} mb-2`}>
                <AddMenu
                  isCollapsed={isSidebarCollapsed}
                  onAddEvent={() => setIsEventModalOpen(true)}
                  onAddDeal={() => navigate('/app/deals/new')}
                  onAddContact={() => setIsContactFormOpen(true)}
                  onAddCompany={() => setIsCompanyFormOpen(true)}
                  onAddQuote={() => { /* TODO: Implementar */ }}
                  onAddProduct={() => { /* TODO: Implementar */ }}
                  onAddPortfolio={() => { /* TODO: Implementar */ }}
                  onAddCampaign={() => { /* TODO: Implementar */ }}
                />
              </li>

              {visibleNavGroups.map((group, idx) => (
                <div key={idx}>
                  {/* Group label - solo cuando expandido */}
                  {!isSidebarCollapsed && group.title && (
                    <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest select-none">
                      {group.title}
                    </p>
                  )}

                  {group.items.map(item => (
                    <NavLinkItem
                      key={item.path}
                      item={item}
                      isCollapsed={isSidebarCollapsed}
                    />
                  ))}
                </div>
              ))}

              {/* Admin section */}
              {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
                <div>
                  {!isSidebarCollapsed && (
                    <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest select-none">
                      Administración
                    </p>
                  )}

                  {user?.rol_user === 'superadmin' && (
                    <NavLinkItem item={{ label: 'Usuarios', path: '/app/users', icon: 'fa-users-cog', roles: ['superadmin'] }} isCollapsed={isSidebarCollapsed} />
                  )}
                  {(user?.rol_user === 'superadmin' || currentUser?.module_access?.crm) && (
                    <NavLinkItem item={{ label: 'Productos', path: '/app/products', icon: 'fa-box-archive', roles: ['admin', 'superadmin'] }} isCollapsed={isSidebarCollapsed} />
                  )}
                  {userRole === 'superadmin' && (
                    <NavLinkItem item={{ label: 'Tenants', path: '/app/companies', icon: 'fa-server', roles: ['superadmin'] }} isCollapsed={isSidebarCollapsed} />
                  )}

                  {/* Configuración */}
                  <li
                    className={`relative group list-none ${isSidebarCollapsed ? 'flex justify-center' : ''}`}
                    onMouseEnter={(e) => {
                      if (!isSidebarCollapsed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setCollapsedNavHover({ label: 'Configuración', top: rect.top + rect.height / 2, left: rect.right + 10 });
                    }}
                    onMouseLeave={() => { if (isSidebarCollapsed) setCollapsedNavHover(null); }}
                  >
                    <Link
                      to="/app/account-settings"
                      onClick={() => { setIsMobileSidebarOpen(false); setCollapsedNavHover(null); }}
                      className={`
                        flex items-center rounded-lg transition-all duration-150 select-none
                        ${isSidebarCollapsed
                          ? 'gap-0 px-0 py-0 w-10 h-10 justify-center rounded-full'
                          : 'gap-2 px-3 py-1.5 mx-2 w-auto'}
                        ${location.pathname.startsWith('/app/account-settings')
                          ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-600'
                          : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
                        }
                      `}
                    >
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                        <i className={`fa-solid fa-sliders text-[13px] ${location.pathname.startsWith('/app/account-settings') ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-700'}`}></i>
                      </span>
                      <span className={`text-[13px] leading-none whitespace-nowrap transition-opacity duration-200 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                        Configuración
                      </span>
                    </Link>
                  </li>
                </div>
              )}
            </ul>
          </nav>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-800/30">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>

      {collapsedNavHover && !isDesktopSidebarOpen && !isMobileSidebarOpen && (
        <div
          className="fixed z-[80] pointer-events-none"
          style={{ top: `${collapsedNavHover.top}px`, left: `${collapsedNavHover.left}px` }}
        >
          <div className="-translate-y-1/2 px-2.5 py-1.5 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-[12px] font-medium text-slate-700 dark:text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.16)] whitespace-nowrap">
            {collapsedNavHover.label}
          </div>
        </div>
      )}

      <CompanyForm
        isOpen={isCompanyFormOpen}
        onClose={() => setIsCompanyFormOpen(false)}
        mode="create"
        onSuccess={() => setIsCompanyFormOpen(false)}
        redirectOnCreate={false}
      />

      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        mode="create"
        onSuccess={() => setIsContactFormOpen(false)}
      />

      <InteractionEventCaptureModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onCapture={handleEventCapture}
        contacts={contacts}
        users={users}
        currentUserId={user?.id_user}
      />

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
              <Avatar src={user?.avatar_url || null} name={user?.name_user || 'Usuario'} size="sm" className="flex-shrink-0" />
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