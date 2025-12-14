import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; 

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void; // Hice opcional esto por si acaso no lo pasas desde el padre
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tenantName, setTenantName] = useState<string | null>(null);
  
  // 1. Usamos 'user' directamente, sin crear un estado 'currentUser' intermedio
  const { user, logout } = useAuth(); 
  
  const location = useLocation();
  const navigate = useNavigate();

  // 2. Fetch del Tenant Name optimizado
  useEffect(() => {
    // Si no hay usuario o no tiene id_tenant, no hacemos nada
    if (!user?.id_tenant) {
      setTenantName(null);
      return;
    }

    let isMounted = true; // Para evitar actualizaciones si el componente se desmonta

    const fetchTenantName = async () => {
      try {
        const response = await fetch(`https://service.computeksa.com/webhook/api/tenants/detail?id_tenant=${user.id_tenant}`);
        
        if (response.ok) {
          const data = await response.json();
          // Aseguramos que data sea un objeto y tenga la propiedad
          const name = Array.isArray(data) ? data[0]?.name_tenant : data.name_tenant;
          
          if (isMounted) setTenantName(name || "Sin Nombre");
        } else {
          console.error("Error fetching tenant name");
        }
      } catch (error) {
        console.error("Error de red al obtener tenant:", error);
      }
    };

    fetchTenantName();

    return () => { isMounted = false; };
  }, [user?.id_tenant]); // Solo se ejecuta si CAMBIA el id_tenant, no todo el objeto user

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
    // Eliminé 'Usuarios' y 'Tenants' de aquí si ya los tienes abajo en "Configuración" para no duplicar
  ];

  const userRole = user?.rol_user || 'usuario';

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* SIDEBAR */}
      <aside 
        className={`bg-slate-900 text-white transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-700 cursor-pointer px-4" onClick={() => navigate('/dashboard')}>
           {isSidebarOpen ? (
             <div className="flex items-center space-x-3">
                <img src="/logo.png" alt="Logo" className="h-8 w-auto"/>
                <span className="font-bold text-lg tracking-wide">COMPUTEKSA</span>
             </div>
           ) : (
             <img src="/logo.png" alt="Logo" className="h-8 w-auto"/>
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
                      isActive ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} w-6 text-center ${isSidebarOpen ? 'mr-3' : 'mr-0 text-xl'}`}></i>
                    <span className={`${isSidebarOpen ? 'block' : 'hidden'} font-medium`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Menú de Configuración (Solo Admins) */}
          {user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
            <>
              <div className={`px-5 mt-6 mb-2 ${!isSidebarOpen && 'hidden'}`}>
                 <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Configuración</h2>
              </div>
              <ul className="space-y-1 px-3">
                <li>
                    <Link to="/settings" className="flex items-center p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <i className="fa-solid fa-sliders w-6 text-center text-xl mr-3"></i>
                        <span className={`${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Ajustes</span>
                    </Link>
                </li>
                <li>
                    <Link to="/users" className="flex items-center p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <i className="fa-solid fa-users-cog w-6 text-center text-xl mr-3"></i>
                        <span className={`${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Usuarios</span>
                    </Link>
                </li>
                {user.rol_user === 'superadmin' && (
                  <li>
                    <Link to="/companies" className="flex items-center p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <i className="fa-solid fa-server w-6 text-center text-xl mr-3"></i>
                        <span className={`${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Tenants</span>
                    </Link>
                  </li>
                )}
              </ul>
            </>
          )}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-700">
          <Link to="/profile" className="flex items-center hover:bg-slate-800 p-2 rounded-lg transition-colors group mb-2">
             <img 
                src={user?.avatar_url || "https://ui-avatars.com/api/?name=User&background=random"} 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-slate-500 group-hover:border-brand-500" 
             />
             <div className={`ml-3 ${isSidebarOpen ? 'block' : 'hidden'} overflow-hidden`}>
                <p className="text-sm font-semibold text-white truncate">{user?.name_user || 'Usuario'}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.rol_user}</p>
             </div>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
             <i className="fa-solid fa-sign-out-alt w-6 text-center text-xl"></i>
             <span className={`ml-3 ${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-700 focus:outline-none">
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          
          <div className="flex items-center space-x-6">
             {/* AQUÍ MOSTRAMOS LA INFO DE TENANT Y USUARIO */}
             <div className="hidden md:flex flex-col items-end text-sm">
                 {tenantName && (
                    <span className="font-bold text-slate-700">
                        <i className="fa-solid fa-building mr-2 text-slate-400"></i>
                        {tenantName}
                    </span>
                 )}
                 {user?.name_user && (
                    <span className="text-xs text-slate-500">
                        Hola, {user.name_user}
                    </span>
                 )}
             </div>

             <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
             
             <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-slate-900">Perfil</Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;