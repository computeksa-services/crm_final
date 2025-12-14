import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext'; // 1. Importar el hook de autenticación

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void; 
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // 2. Obtener el usuario y la función de logout

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'fa-chart-pie', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Cotizaciones', path: '/quotes', icon: 'fa-file-invoice-dollar', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Tratos', path: '/deals', icon: 'fa-handshake', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Calendario', path: '/calendar', icon: 'fa-calendar-days', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Empresas Clientes', path: '/client-companies', icon: 'fa-building', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Contactos Clientes', path: '/client-contacts', icon: 'fa-address-book', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Productos', path: '/products', icon: 'fa-box-archive', roles: ['superadmin', 'admin', 'usuario'] },
    { label: 'Tenants', path: '/companies', icon: 'fa-server', roles: ['superadmin'] }, 
    { label: 'Usuarios', path: '/users', icon: 'fa-user-gear', roles: ['superadmin', 'admin'] },
    { label: 'Ajustes', path: '/settings/statuses', icon: 'fa-cog', roles: ['superadmin', 'admin'] },
  ];

  const userRole = currentUser?.rol_user || 'usuario';

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <aside 
        className={`bg-slate-900 text-white transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-700 cursor-pointer px-4" onClick={() => navigate('/dashboard')}>
           {isSidebarOpen ? (
             <div className="flex items-center space-x-3">
                <img src="/logo.png" alt="Computeksa 360 Logo" className="h-8 w-auto"/>
                <span className="font-bold text-lg tracking-wide">COMPUTEKSA 360</span>
             </div>
           ) : (
             <img src="/logo.png" alt="Computeksa 360 Logo" className="h-8 w-auto"/>
           )}
        </div>

        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              if (!item.roles.includes(userRole)) return null;

              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link 
                    to={item.path}
                    className={`flex items-center p-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-brand-600 text-white shadow-md' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} w-6 text-center ${isSidebarOpen ? 'mr-3' : 'mr-0 text-xl'}`}></i>
                    <span className={`${isSidebarOpen ? 'block' : 'hidden'} font-medium`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* 3. Lógica para roles */}
          {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
            <>
              <h2 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2">Configuración</h2>
              <ul>
                <li><Link to="/settings" className="flex items-center p-3 rounded-lg transition-colors">
                   <i className="fa-solid fa-sliders w-6 text-center"></i>
                   <span className="ml-3 text-sm font-medium">Ajustes</span>
                </Link></li>
                <li><Link to="/users" className="flex items-center p-3 rounded-lg transition-colors">
                   <i className="fa-solid fa-users-cog w-6 text-center"></i>
                   <span className="ml-3 text-sm font-medium">Usuarios</span>
                </Link></li>
                {user.rol_user === 'superadmin' && (
                  <li><Link to="/companies" className="flex items-center p-3 rounded-lg transition-colors">
                     <i className="fa-solid fa-building-user w-6 text-center"></i>
                     <span className="ml-3 text-sm font-medium">Tenants</span>
                  </Link></li>
                )}
              </ul>
            </>
          )}

        </nav>

        <div className="p-4 border-t border-slate-700">
          <Link to="/profile" className="flex items-center hover:bg-slate-800 p-2 rounded-lg transition-colors group mb-2">
             <img src={currentUser?.avatar_url || "https://ui-avatars.com/api/?name=User"} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-500 group-hover:border-brand-500" />
             <div className={`ml-3 ${isSidebarOpen ? 'block' : 'hidden'}`}>
                <p className="text-sm font-semibold text-white truncate w-32">{currentUser?.name_user || 'Cargando...'}</p>
                <p className="text-xs text-slate-400 capitalize">{currentUser?.rol_user}</p>
             </div>
          </Link>
          <button onClick={handleLogout} className={`w-full flex items-center p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors`}>
             <i className="fa-solid fa-sign-out-alt w-6 text-center text-xl"></i>
             <span className={`ml-3 ${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-500 hover:text-slate-700 focus:outline-none"
          >
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          
          <div className="flex items-center space-x-4">
             <button className="p-2 text-slate-400 hover:text-brand-600 relative">
               <i className="fa-solid fa-bell text-lg"></i>
               <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
             </button>
             <div className="h-8 w-px bg-slate-200"></div>
             <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-slate-900">Perfil</Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;