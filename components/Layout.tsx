import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; 

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

// Definición de grupos de navegación para mejor organización
const NAV_GROUPS = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'fa-chart-pie', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Calendario', path: '/calendar', icon: 'fa-calendar-days', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Cotizaciones', path: '/quotes', icon: 'fa-file-invoice-dollar', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Tratos', path: '/deals', icon: 'fa-handshake', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Directorio',
    items: [
      { label: 'Empresas', path: '/client-companies', icon: 'fa-building', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Contactos', path: '/client-contacts', icon: 'fa-address-book', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Inventario',
    items: [
      { label: 'Productos', path: '/products', icon: 'fa-box-archive', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  }
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Estado para controlar sidebar en Desktop (contraído/expandido)
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  // Estado para controlar sidebar en Móvil (abierto/cerrado)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const [tenantName, setTenantName] = useState<string | null>(null);
  
  const { user, logout } = useAuth(); 
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user?.rol_user || 'usuario';

  useEffect(() => {
    if (!user?.id_tenant) {
      setTenantName(null);
      return;
    }

    let isMounted = true;

    const fetchTenantName = async () => {
      try {
        const response = await fetch(`https://service.computeksa.com/webhook/api/tenants/detail?id_tenant=${user.id_tenant}`);
        if (response.ok) {
          const data = await response.json();
          const name = Array.isArray(data) ? data[0]?.name_tenant : data.name_tenant;
          if (isMounted) setTenantName(name || "Mi Organización");
        }
      } catch (error) {
        console.error("Error fetching tenant", error);
      }
    };

    fetchTenantName();
    return () => { isMounted = false; };
  }, [user?.id_tenant]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Función auxiliar para renderizar links
  const NavLinkItem = ({ item, isCollapsed }: { item: any, isCollapsed: boolean }) => {
    if (!item.roles.includes(userRole)) return null;
    const isActive = location.pathname.startsWith(item.path);

    return (
      <li className="relative group">
        <Link 
          to={item.path}
          onClick={() => setIsMobileSidebarOpen(false)} // Cerrar menú móvil al hacer click
          className={`flex items-center px-3 py-2.5 my-1 rounded-xl transition-all duration-200 group-hover:bg-slate-800 ${
            isActive 
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className={`w-8 flex justify-center items-center transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
             <i className={`fa-solid ${item.icon} text-lg`}></i>
          </div>
          
          <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
            {item.label}
          </span>

          {/* Tooltip para modo contraído */}
          {isCollapsed && (
            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-md border border-slate-700">
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
          flex flex-col transition-all duration-300 ease-in-out shadow-xl
          ${isMobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isDesktopSidebarOpen ? 'md:w-64' : 'md:w-20'}
        `}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950/50">
           <div 
             className="flex items-center gap-3 cursor-pointer w-full overflow-hidden" 
             onClick={() => navigate('/dashboard')}
           >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/20">
                  <img src="/logo.png" alt="C" className="h-6 w-auto opacity-90"/>
              </div>
              <div className={`transition-all duration-300 ${!isDesktopSidebarOpen && 'md:opacity-0 md:w-0'}`}>
                <span className="font-bold text-lg tracking-tight text-white block leading-none">COMPUTEKSA 360</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Workspace</span>
              </div>
           </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <ul className="space-y-6 px-3">
            {NAV_GROUPS.map((group, idx) => (
              <div key={idx}>
                {/* Título de Grupo (Solo si está expandido) */}
                <h3 className={`px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${(!isDesktopSidebarOpen || !group.title) && 'md:opacity-0 md:hidden'}`}>
                  {group.title}
                </h3>
                {/* Separador simple para modo contraído */}
                {!isDesktopSidebarOpen && idx > 0 && <div className="h-px bg-slate-800 mx-2 my-2 md:block hidden"></div>}

                {group.items.map(item => (
                  <NavLinkItem 
                    key={item.path} 
                    item={item} 
                    isCollapsed={!isDesktopSidebarOpen} // En móvil siempre está expandido si se ve
                  />
                ))}
              </div>
            ))}

            {/* Configuración (Admin/Superadmin) */}
            {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
              <div>
                <h3 className={`px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${!isDesktopSidebarOpen && 'md:opacity-0 md:hidden'}`}>
                  Administración
                </h3>
                 {!isDesktopSidebarOpen && <div className="h-px bg-slate-800 mx-2 my-2 md:block hidden"></div>}
                
                <NavLinkItem item={{ label: 'Ajustes', path: '/settings', icon: 'fa-sliders', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                <NavLinkItem item={{ label: 'Usuarios', path: '/users', icon: 'fa-users-cog', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                <NavLinkItem item={{ label: 'Cartera', path: '/financials', icon: 'fa-wallet', roles: ['admin', 'superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                {user.rol_user === 'superadmin' && (
                  <NavLinkItem item={{ label: 'Tenants', path: '/companies', icon: 'fa-server', roles: ['superadmin'] }} isCollapsed={!isDesktopSidebarOpen} />
                )}
              </div>
            )}
          </ul>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          <div className={`flex items-center gap-3 transition-all duration-300 ${!isDesktopSidebarOpen ? 'justify-center' : ''}`}>
             <Link to="/profile" className="relative group">
                <img 
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name_user || 'U'}&background=6366f1&color=fff`} 
                    alt="User" 
                    className="w-9 h-9 rounded-full border border-slate-600 group-hover:border-brand-500 transition-colors" 
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>
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


      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-20 shrink-0">
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
              
              {/* Breadcrumb / Page Title Placeholder (Opcional) */}
              <div className="hidden sm:block text-slate-400 text-sm">
                 / <span className="text-slate-800 font-medium ml-2 capitalize">{location.pathname.split('/')[1] || 'Dashboard'}</span>
              </div>
          </div>
          
          <div className="flex items-center space-x-4 md:space-x-6">
             {/* Notificaciones (Visual dummy) */}
             <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fa-regular fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>

             <div className="h-6 w-px bg-slate-200"></div>

             {/* Tenant Info */}
             {tenantName && (
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                        {tenantName}
                        <i className="fa-solid fa-circle-check text-brand-500 ml-1.5 text-[10px]"></i>
                    </span>
                    <span className="text-[10px] text-slate-400">Plan Enterprise</span>
                </div>
             )}
             
             {/* Profile Link (Avatar mobile) */}
             <Link to="/profile" className="flex items-center gap-2 hover:bg-slate-50 p-1.5 pr-3 rounded-full border border-transparent hover:border-slate-200 transition-all">
                <img 
                    src={user?.avatar_url || "https://ui-avatars.com/api/?name=User&background=random"} 
                    alt="User" 
                    className="w-8 h-8 rounded-full shadow-sm" 
                />
                <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 hidden sm:block"></i>
             </Link>
          </div>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8 scroll-smooth">
          <div className="w-full">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;