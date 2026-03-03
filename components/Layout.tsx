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
  // Estado para modo oscuro (persistido en localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('theme-dark');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  // Estado para controlar sidebar en Desktop (contraído/expandido) - con persistencia en localStorage
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-desktop-open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  // Estado para controlar sidebar en Móvil (abierto/cerrado)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Estado para modal de confirmación de logout
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

  // Filtrar items según módulos a los que tiene acceso el usuario
  const visibleNavGroups = useMemo(() => {
    if (!user) return NAV_GROUPS;

    // Owner ve todo
    if (user.is_owner) return NAV_GROUPS;

    // Admin ve CRM siempre + módulos que le concedieron
    if (user.rol_user === 'admin') {
      return NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
          // Si el item no tiene módulo, lo mostramos
          if (!item.module) return true;
          // CRM siempre lo ve el admin
          if (item.module === 'crm') return true;
          // Otros módulos solo si tiene acceso
          return currentUser?.module_access?.[item.module as keyof typeof currentUser.module_access];
        })
      })).filter(group => group.items.length > 0);
    }

    // Usuario solo ve módulos que le concedieron
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Si el item no tiene módulo, lo mostramos
        if (!item.module) return true;
        // Solo si tiene acceso al módulo
        return currentUser?.module_access?.[item.module as keyof typeof currentUser.module_access];
      })
    })).filter(group => group.items.length > 0);
  }, [user, currentUser?.module_access]);

  // Guardar estado del sidebar en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('sidebar-desktop-open', JSON.stringify(isDesktopSidebarOpen));
  }, [isDesktopSidebarOpen]);

  // Aplicar modo oscuro a nivel de documento
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme-dark', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Calcular posición del dropdown cuando se abre
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

  // Cerrar dropdown cuando se hace clic fuera (solo el botón del avatar)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Solo cerrar si el click está fuera del botón avatar
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

  // Función auxiliar para renderizar links
  const NavLinkItem = ({ item, isCollapsed }: { item: any, isCollapsed: boolean }) => {
    if (!item.roles.includes(userRole)) return null;
    const isActive = location.pathname.startsWith(item.path);

    return (
      <li className="relative group">
        <Link 
          to={item.path}
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`flex items-center transition-all duration-200 group-hover:bg-slate-800 ${
            isCollapsed ? 'justify-center px-0 py-1.5 rounded-lg' : 'px-2 py-1.5 rounded-lg'
          } ${
            isActive 
              ? 'bg-brand-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className={`flex justify-center items-center transition-transform duration-200 ${isCollapsed ? 'w-10' : 'w-7'} ${isActive ? 'scale-105' : ''}`}>
             <i className={`fa-solid ${item.icon} text-base`}></i>
          </div>
          
          <span className={`ml-2 font-medium text-sm whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
            {item.label}
          </span>

          {/* Tooltip para modo contraído */}
          {isCollapsed && (
            <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-md border border-slate-700">
              {item.label}
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-600 overflow-hidden font-sans">
      
      {/* --- MOBILE OVERLAY (Solo visible en móvil cuando el menú está abierto) --- */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-[45] bg-slate-900/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR --- */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-slate-900 dark:bg-neutral-900 text-white border-r border-slate-800 dark:border-neutral-800
          flex flex-col transition-all duration-300 ease-in-out shadow-xl overflow-hidden
          ${isMobileSidebarOpen ? 'translate-x-0 w-52' : '-translate-x-full md:translate-x-0'}
          ${isDesktopSidebarOpen ? 'md:w-52' : 'md:w-16'}
        `}
      >
        {/* Logo Area */}
        <div className={`flex items-center border-b border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-500 transition-all duration-300 ${isDesktopSidebarOpen ? 'h-20 px-4' : 'h-16 px-0 justify-center'}`}>
           <div 
             className={`flex items-center justify-center cursor-pointer overflow-hidden w-full`}
             onClick={() => navigate('/app/dashboard')}
           >
              <img src={isDesktopSidebarOpen ? "/logo_large.png" : "/logo.png"} alt="COMPUTEKSA" className={`object-contain transition-all duration-300 ${isDesktopSidebarOpen ? 'h-16' : 'h-10 w-10'}`}/>
           </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <ul className="px-2">
            {visibleNavGroups.map((group, idx) => (
              <div key={idx}>
                {/* Título de Grupo (Solo si está expandido) */}
                <h3 className={`px-2 mb-1 mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${(!isDesktopSidebarOpen || !group.title) && 'md:opacity-0 md:hidden'}`}>
                  {group.title}
                </h3>
                {/* Separador simple para modo contraído */}
                {!isDesktopSidebarOpen && idx > 0 && <div className="h-px bg-slate-800 mx-2 my-1 md:block hidden"></div>}

                {group.items.map(item => (
                  <NavLinkItem 
                    key={item.path} 
                    item={item} 
                    isCollapsed={!isMobileSidebarOpen ? !isDesktopSidebarOpen : false}
                  />
                ))}
              </div>
            ))}

            {/* Configuración (Admin/Superadmin) */}
            {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
              <div>
                <h3 className={`px-2 mb-1 mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${!isDesktopSidebarOpen && 'md:opacity-0 md:hidden'}`}>
                  Administración
                </h3>
                 {!isDesktopSidebarOpen && <div className="h-px bg-slate-800 mx-2 my-1 md:block hidden"></div>}
                
                <li className="relative group">
                  <Link 
                    to="/app/account-settings"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                        setIsDesktopSidebarOpen(false);
                      }
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`flex items-center transition-all duration-200 group-hover:bg-slate-800 ${
                      (!isMobileSidebarOpen ? !isDesktopSidebarOpen : false)
                        ? 'justify-center px-0 py-1.5 rounded-lg'
                        : 'px-2 py-1.5 rounded-lg'
                    } ${
                      location.pathname.startsWith('/app/account-settings')
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className={`flex justify-center items-center transition-transform duration-200 ${(!isMobileSidebarOpen ? !isDesktopSidebarOpen : false) ? 'w-10' : 'w-7'} ${location.pathname.startsWith('/app/account-settings') ? 'scale-105' : ''}`}>
                       <i className="fa-solid fa-sliders text-base"></i>
                    </div>
                    <span className={`ml-2 font-medium text-sm whitespace-nowrap transition-all duration-300 ${(!isMobileSidebarOpen ? !isDesktopSidebarOpen : false) ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                      Configuración
                    </span>
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

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-slate-500 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <i className="fa-solid fa-sign-out-alt text-red-600 text-xl"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 text-center mb-2">¿Cerrar Sesión?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">¿Estás seguro de que deseas cerrar tu sesión?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* HEADER */}
        <header className="h-12 bg-white dark:bg-slate-500 border-b border-slate-200 dark:border-slate-400 flex items-center justify-between px-3 md:px-5 z-20 shrink-0">
          <div className="flex items-center gap-4">
              {/* Botón Hamburger (Móvil) */}
              <button 
                onClick={() => setIsMobileSidebarOpen(true)} 
                className="md:hidden text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <i className="fa-solid fa-bars text-xl"></i>
              </button>

              {/* Botón Toggle (Desktop) */}
              <button 
                onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)} 
                className="hidden md:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <i className={`fa-solid fa-indent text-lg transition-transform ${!isDesktopSidebarOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              {/* Breadcrumb dinámico - mejorado con links */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                {(() => {
                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const lastSegment = pathSegments[pathSegments.length - 1] || 'dashboard';
                  // Si es la página de seguimientos, mostrar solo "Seguimiento"
                  if (location.pathname === '/app/followups') {
                    return <span className="text-slate-900 dark:text-slate-100 font-bold text-base">Seguimiento</span>;
                  }
                  const knownRoutes = ['quotes', 'deals', 'financials', 'client-companies', 'client-contacts', 'companies', 'products', 'users', 'profile', 'account-settings', 'integrations', 'workspace-settings', 'settings', 'calendar', 'dashboard', 'new', 'edit', 'marketing'];
                  let breadcrumbs: { label: string; path: string; isActive: boolean }[] = [];
                  // ...existing code...
                  // Si es "edit" (e.g., /app/quotes/edit?id=xxx) → mostrar Colección > Nombre > Edición
                  if (lastSegment === 'edit' && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const collectionPath = `/app/${collectionKey}`;
                    breadcrumbs = [
                      { label: collectionName, path: collectionPath, isActive: false },
                      { label: location.state?.breadcrumb || 'Edición', path: location.pathname, isActive: true }
                    ];
                  }
                  // Si el último segmento NO está en rutas conocidas, es un ID → mostrar ruta/Detalle
                  else if (!knownRoutes.includes(lastSegment) && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const collectionPath = `/app/${collectionKey}`;
                    breadcrumbs = [
                      { label: collectionName, path: collectionPath, isActive: false },
                      { label: location.state?.breadcrumb || 'Detalle', path: location.pathname, isActive: true }
                    ];
                  }
                  // Si es "new" → mostrar Colección > Nuevo
                  else if (lastSegment === 'new' && pathSegments.length > 1) {
                    const collectionKey = pathSegments[pathSegments.length - 2];
                    const collectionName = PAGE_NAMES[collectionKey] || collectionKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const collectionPath = `/app/${collectionKey}`;
                    breadcrumbs = [
                      { label: collectionName, path: collectionPath, isActive: false },
                      { label: 'Nuevo', path: location.pathname, isActive: true }
                    ];
                  }
                  // Ruta normal
                  else {
                    const pageName = PAGE_NAMES[lastSegment] || lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    breadcrumbs = [{ label: pageName, path: location.pathname, isActive: true }];
                  }
                  return breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.path}>
                      {idx > 0 && (
                        <span className="text-slate-400 text-sm mx-1.5">
                          <i className="fa-solid fa-chevron-right"></i>
                        </span>
                      )}
                      {crumb.isActive ? (
                        <span className="text-slate-900 dark:text-slate-100 font-bold text-sm">{crumb.label}</span>
                      ) : (
                        <Link 
                          to={crumb.path} 
                          className="text-brand-600 font-medium text-sm px-2 py-1 rounded-md hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700 transition-all cursor-pointer duration-200 ease-in-out"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </React.Fragment>
                  ));
                })()}
              </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-5">
             {/* Indicador de carga del caché */}
             {cacheLoading && (
               <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                 <ButtonLoader size="xs" />
                 <span>Cargando datos...</span>
               </div>
             )}
             
             {/* Tenant Info visible junto al avatar */}
             {user?.name_tenant && (
               <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center">
                      {user?.name_tenant}
                      <i className="fa-solid fa-circle-check text-brand-500 ml-1.5 text-[10px]"></i>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Plan Enterprise</span>
               </div>
             )}
             
             {/* User dropdown */}
             <div className="relative flex items-center" ref={userMenuRef}>
               <button
                 ref={userMenuButtonRef}
                 onClick={() => setUserMenuOpen(o => !o)}
                 className="flex items-center gap-2 p-1 bg-white dark:bg-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-500 rounded-full shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
               >
                 <img
                   src={getImageUrl(user?.avatar_url) || 'https://ui-avatars.com/api/?name=User&background=random'}
                   alt="User"
                   className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-500 shadow-sm"
                   referrerPolicy="no-referrer"
                 />
                 <div className="hidden sm:flex flex-col items-start leading-tight max-w-[120px] truncate">
                   <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                     {user?.name_user || 'Usuario'}
                   </span>
                 </div>
               </button>
             </div>
          </div>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-600/60 p-1 md:p-2 scroll-smooth">
          <div className="w-full h-full">
             {children}
          </div>
        </main>

        {/* USER DROPDOWN PORTAL */}
        {userMenuOpen && menuPosition && createPortal(
          <div 
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed w-64 bg-white dark:bg-slate-500 border border-slate-200 dark:border-slate-400 rounded-xl shadow-xl py-2 z-[99999] pointer-events-auto"
            style={{ 
              top: `${menuPosition.top}px`, 
              right: `${menuPosition.right}px`,
              pointerEvents: 'auto'
            }}
          >
            {/* Sección: Cuenta personal */}
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Mi Cuenta
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAccountSettings('profile')}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <i className="fa-regular fa-user w-4 text-center"></i>
              <div className="flex-1">
                <div className="font-medium">Perfil</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Datos personales y preferencias</div>
              </div>
            </button>
            
            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
            
            {/* Sección: Integraciones */}
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Integraciones
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAccountSettings('personalIntegrations')}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-plug w-4 text-center text-brand-600"></i>
              <div className="flex-1">
                <div className="font-medium">Integraciones personales</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Conecte y gestione sus permisos</div>
              </div>
            </button>
            
            {/* Sección: Configuración del Workspace (solo admin/owner) */}
            {isWorkspaceOwner && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    Workspace
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAccountSettings('tenantIntegrations')}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <i className="fa-solid fa-building w-4 text-center text-brand-600"></i>
                  <div className="flex-1">
                    <div className="font-medium">Integraciones de workspace</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Configuración centralizada de la organización</div>
                  </div>
                </button>
              </>
            )}
            
            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
            
            {/* Preferencias */}
            <button
              type="button"
              onClick={() => {
                setIsDarkMode((prev) => !prev);
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} w-4 text-center`}></i>
              <span>{isDarkMode ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
            
            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
            
            {/* Cerrar sesión */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50/60 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
              style={{ pointerEvents: 'auto' }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket w-4 text-center"></i>
              <span>Cerrar sesión</span>
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default Layout;
