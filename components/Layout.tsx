import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import { NAV_GROUPS, PAGE_NAMES } from '../services/routes.config';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
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
  
  const [tenantName, setTenantName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('tenant-name');
    } catch {
      return null;
    }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const { user, logout } = useAuth(); 
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user?.rol_user || 'usuario';
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Guardar estado del sidebar en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('sidebar-desktop-open', JSON.stringify(isDesktopSidebarOpen));
  }, [isDesktopSidebarOpen]);

  const didFetchTenantRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id_tenant) {
      setTenantName(null);
      return;
    }

    let isMounted = true;

    const fetchTenantName = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants/detail?id_tenant=${user.id_tenant}`);
        if (response.ok) {
          const data = await response.json();
          const name = Array.isArray(data) ? data[0]?.name_tenant : data.name_tenant;
          if (isMounted) {
            setTenantName(name || null);
            try {
              if (name) localStorage.setItem('tenant-name', name);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (error) {
        console.error("Error fetching tenant", error);
      }
    };
    // Evitar doble fetch en StrictMode y dentro de una misma sesión
    const sessionKey = `tenant:fetched:${user.id_tenant}`;
    const shouldFetch = didFetchTenantRef.current !== user.id_tenant && !sessionStorage.getItem(sessionKey);
    if (shouldFetch) {
      didFetchTenantRef.current = user.id_tenant;
      sessionStorage.setItem(sessionKey, '1');
      fetchTenantName();
    }
    return () => { isMounted = false; };
  }, [user?.id_tenant]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
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
          onClick={() => setIsMobileSidebarOpen(false)} // Cerrar menú móvil al hacer click
          className={`flex items-center transition-all duration-200 group-hover:bg-slate-800 ${
            isCollapsed ? 'justify-center px-0 py-2 my-0.5 rounded-lg' : 'px-2 py-2 my-0.5 rounded-lg'
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* --- MOBILE OVERLAY (Solo visible en móvil cuando el menú está abierto) --- */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR --- */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-slate-900 text-white border-r border-slate-800
          flex flex-col transition-all duration-300 ease-in-out shadow-xl overflow-hidden
          ${isMobileSidebarOpen ? 'translate-x-0 w-52' : '-translate-x-full md:translate-x-0'}
          ${isDesktopSidebarOpen ? 'md:w-52' : 'md:w-16'}
        `}
      >
        {/* Logo Area */}
        <div className={`h-16 flex items-center border-b border-slate-200 bg-white transition-all duration-300 ${isDesktopSidebarOpen ? 'px-4' : 'px-0 justify-center'}`}>
           <div 
             className={`flex items-center gap-3 cursor-pointer overflow-hidden w-full ${isDesktopSidebarOpen ? '' : 'justify-center'}`}
             onClick={() => navigate('/app/dashboard')}
           >
              <img src="/logo.png" alt="COMPUTEKSA" className={`object-contain transition-all duration-300 ${isDesktopSidebarOpen ? 'h-10 w-10' : 'h-8 w-8'}`}/>
              <div className={`transition-all duration-300 ${!isDesktopSidebarOpen ? 'md:opacity-0 md:w-0 overflow-hidden' : 'overflow-visible'}`}>
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-sm tracking-tight text-slate-800">CRM</span>
                  <span className="font-bold text-sm tracking-tight text-brand-600">COMPUTEKSA</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Workspace</span>
                </div>
              </div>
           </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <ul className="space-y-1 px-2">
            {NAV_GROUPS.map((group, idx) => (
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
                    isCollapsed={!isDesktopSidebarOpen}

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
                
                <NavLinkItem item={{ label: 'Ajustes', path: '/app/settings', icon: 'fa-sliders', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                <NavLinkItem item={{ label: 'Usuarios', path: '/app/users', icon: 'fa-users-cog', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                <NavLinkItem item={{ label: 'Cartera', path: '/app/financials', icon: 'fa-wallet', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                {userRole === 'superadmin' && (
                  <NavLinkItem item={{ label: 'Tenants', path: '/app/companies', icon: 'fa-server', roles: ['superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                )}
              </div>
            )}
          </ul>
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/30">
          <div className={`flex items-center transition-all duration-300 ${!isDesktopSidebarOpen ? 'justify-center' : 'gap-3'}`}>
             <Link to="/app/profile" className="relative group shrink-0">
                <img 
                    src={getImageUrl(user?.avatar_url) || `https://ui-avatars.com/api/?name=${user?.name_user || 'U'}&background=6366f1&color=fff`} 
                    alt="User" 
                    className="w-10 h-10 rounded-full border-2 border-slate-600 group-hover:border-brand-500 transition-colors"
                    referrerPolicy="no-referrer"
                    onLoad={() => console.log('✅ Avatar sidebar cargado:', getImageUrl(user?.avatar_url))}
                    onError={(e) => {
                      console.error('❌ Error cargando avatar sidebar');
                      console.error('   URL original:', user?.avatar_url);
                      console.error('   URL procesada:', getImageUrl(user?.avatar_url));
                    }}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
             </Link>
             
             <div className={`flex-1 overflow-hidden transition-all duration-300 ${!isDesktopSidebarOpen && 'md:w-0 md:opacity-0'}`}>
                <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name_user || 'Usuario'}</p>
                <p className="text-[10px] text-slate-400 capitalize truncate">{user?.rol_user}</p>
             </div>

             <button 
                onClick={handleLogout} 
                className={`text-slate-400 hover:text-red-400 transition-colors ${!isDesktopSidebarOpen && 'md:hidden'}`}
                title="Cerrar Sesión"
             >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
             </button>
          </div>
        </div>
      </aside>

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <i className="fa-solid fa-sign-out-alt text-red-600 text-xl"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-800 text-center mb-2">¿Cerrar Sesión?</h2>
            <p className="text-sm text-slate-600 text-center mb-6">¿Estás seguro de que deseas cerrar tu sesión?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
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
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-5 z-20 shrink-0">
          <div className="flex items-center gap-4">
              {/* Botón Hamburger (Móvil) */}
              <button 
                onClick={() => setIsMobileSidebarOpen(true)} 
                className="md:hidden text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <i className="fa-solid fa-bars text-xl"></i>
              </button>

              {/* Botón Toggle (Desktop) */}
              <button 
                onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)} 
                className="hidden md:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
              >
                <i className={`fa-solid fa-indent text-lg transition-transform ${!isDesktopSidebarOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              {/* Breadcrumb dinámico - mejorado con links */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                {(() => {
                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const lastSegment = pathSegments[pathSegments.length - 1] || 'dashboard';
                  const knownRoutes = ['quotes', 'deals', 'financials', 'client-companies', 'client-contacts', 'companies', 'products', 'users', 'profile', 'settings', 'calendar', 'dashboard', 'new', 'edit', 'marketing'];
                  
                  let breadcrumbs: { label: string; path: string; isActive: boolean }[] = [];
                  
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
                        <span className="text-slate-400 text-base mx-1.5">
                          <i className="fa-solid fa-chevron-right"></i>
                        </span>
                      )}
                      {crumb.isActive ? (
                        <span className="text-slate-900 font-bold text-base">{crumb.label}</span>
                      ) : (
                        <Link 
                          to={crumb.path} 
                          className="text-brand-600 font-semibold text-base px-2 py-1 rounded-md hover:bg-brand-50 hover:text-brand-700 transition-all cursor-pointer duration-200 ease-in-out"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </React.Fragment>
                  ));
                })()}
              </div>
          </div>
          
          <div className="flex items-center space-x-4 md:space-x-6">
             {/* Notificaciones (Visual dummy) */}
             <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fa-regular fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>

             <div className="h-6 w-px bg-slate-200"></div>

             {/* Tenant Info visible junto al avatar */}
             {tenantName && (
               <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                      {tenantName}
                      <i className="fa-solid fa-circle-check text-brand-500 ml-1.5 text-[10px]"></i>
                  </span>
                  <span className="text-[10px] text-slate-400">Plan Enterprise</span>
               </div>
             )}
             
             {/* User dropdown */}
             <div className="relative" ref={userMenuRef}>
               <button
                 onClick={() => setUserMenuOpen((open) => !open)}
                 className="flex items-center gap-2 hover:bg-slate-50 p-1.5 pr-3 rounded-full border border-transparent hover:border-slate-200 transition-all"
               >
                  <img 
                      src={getImageUrl(user?.avatar_url) || "https://ui-avatars.com/api/?name=User&background=random"} 
                      alt="User" 
                      className="w-8 h-8 rounded-full shadow-sm"
                      referrerPolicy="no-referrer"
                      onLoad={() => console.log('✅ Avatar header cargado:', getImageUrl(user?.avatar_url))}
                      onError={(e) => {
                        console.error('❌ Error cargando avatar header');
                        console.error('   URL original:', user?.avatar_url);
                        console.error('   URL procesada:', getImageUrl(user?.avatar_url));
                      }}
                  />
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{user?.name_user || 'Usuario'}</span>
                  </div>
                  <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}></i>
               </button>

               {userMenuOpen && (
                 <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-2">
                   <Link
                     to="/app/profile"
                     onClick={() => setUserMenuOpen(false)}
                     className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                   >
                     <i className="fa-regular fa-user"></i>
                     Ver perfil
                   </Link>
                   <button
                     onClick={handleLogout}
                     className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                   >
                     <i className="fa-solid fa-arrow-right-from-bracket"></i>
                     Cerrar sesión
                   </button>
                 </div>
               )}
             </div>
          </div>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-2 md:p-4 scroll-smooth">
          <div className="w-full">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;