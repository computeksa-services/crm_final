import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Cargar sesión al iniciar la app
    console.log("🔄 AuthContext: Cargando sesión desde localStorage...");
    
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    console.log("   Token encontrado:", storedToken ? "✓" : "✗");
    console.log("   Usuario encontrado:", storedUser ? "✓" : "✗");

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("   Usuario parseado:", parsedUser);
        console.log("   Rol del usuario:", parsedUser?.rol_user);
        
        setToken(storedToken);
        setUser(parsedUser);
        console.log("✅ Sesión restaurada correctamente");
      } catch (e) {
        console.error("🔴 Error al leer usuario del storage", e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      console.log("ℹ️ No hay sesión guardada");
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    console.log("🟢 AuthContext.login ejecutándose");
    console.log("   Token recibido:", newToken ? "Sí (Oculto)" : "No");
    console.log("   Usuario recibido:", JSON.stringify(newUser, null, 2));
    console.log("   Rol del usuario:", newUser?.rol_user);

    // VALIDACIÓN DE SEGURIDAD
    if (typeof newUser !== 'object' || !newUser) {
        console.error("🔴 ERROR CRÍTICO: Se intentó guardar un usuario inválido:", newUser);
        return; // Detenemos el login si el usuario no es un objeto
    }

    // 1. Actualizar Estado
    setToken(newToken);
    setUser(newUser);

    // 2. Persistir en LocalStorage
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    console.log("✅ Sesión guardada en localStorage");
    console.log("   localStorage.token:", localStorage.getItem('token') ? "✓" : "✗");
    console.log("   localStorage.user:", localStorage.getItem('user') ? "✓" : "✗");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading,
      isAuthenticated: !!user && !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};