import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

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

    
    // Primero intentar cargar el appToken del nuevo sistema
    const appToken = authService.getToken();
    const storedUser = localStorage.getItem('user');

    // También verificamos el token legacy por compatibilidad
    const legacyToken = localStorage.getItem('token');





    const finalToken = appToken || legacyToken;

    if (finalToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);


        
        setToken(finalToken);
        setUser(parsedUser);

      } catch (e) {
        console.error("🔴 Error al leer usuario del storage", e);
        authService.removeToken();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {

    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {

    console.log("   Token recibido:", newToken ? "Sí (Oculto)" : "No");
    console.log("   Usuario recibido:", JSON.stringify(newUser, null, 2));





    // VALIDACIÓN DE SEGURIDAD
    if (typeof newUser !== 'object' || !newUser) {
        console.error("🔴 ERROR CRÍTICO: Se intentó guardar un usuario inválido:", newUser);
        return; // Detenemos el login si el usuario no es un objeto
    }

    // Validar que el usuario tenga los campos esenciales
    // Estos campos vienen mapeados desde la respuesta del Gateway
    // Gateway: id, tenantId, name, email, role, avatar
    // Mapeados a: id_user, id_tenant, name_user, email_user, rol_user, avatar_url
    if (!newUser.id_user || !newUser.id_tenant) {
        console.error("🔴 ERROR: Usuario sin id_user o id_tenant:", newUser);
        return;
    }

    // 1. Actualizar Estado
    setToken(newToken);
    setUser(newUser);

    // 2. Persistir en LocalStorage
    // El usuario fue mapeado desde la respuesta del Gateway
    authService.saveToken(newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    // También guardamos en el formato legacy por compatibilidad temporal
    localStorage.setItem('token', newToken);
    




    console.log("     - id_user (Gateway.id)");
    console.log("     - id_tenant (Gateway.tenantId)");
    console.log("     - name_user (Gateway.name)");
    console.log("     - email_user (Gateway.email)");
    console.log("     - rol_user (Gateway.role)");
    console.log("     - avatar_url (Gateway.avatar)");
    console.log("   localStorage.appToken:", authService.getToken() ? "✓" : "✗");
    console.log("   localStorage.user:", localStorage.getItem('user') ? "✓" : "✗");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    authService.removeToken();
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
