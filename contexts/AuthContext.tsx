import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { GATEWAY_CONFIG } from '../services/gatewayConfig';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: Partial<User>) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    authService.removeToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, []);

  const fetchUser = useCallback(async () => {
    const appToken = authService.getToken();
    if (appToken) {
      try {
        setToken(appToken);
        
        // ✅ USAR fetch DIRECTO en lugar de apiFetch para evitar logout automático
        const res = await fetch(GATEWAY_CONFIG.API.USERS.ME, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appToken}`
          }
        });
        
        if (res.ok) {
          const userDataArray = await res.json();
          let userData = Array.isArray(userDataArray) ? userDataArray[0] : userDataArray;
          if (!userData || !userData.id_user) {
             console.error('La respuesta de /api/v1/me no es válida', userData);
             logout();
             return;
          }
          
          // Cargar el nombre del workspace si no viene en la respuesta
          if (!userData.name_tenant && userData.id_tenant) {
            try {
              const tenantRes = await fetch(`${GATEWAY_CONFIG.API.TENANTS.DETAIL}?id_tenant=${userData.id_tenant}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${appToken}`
                }
              });
              
              if (tenantRes.ok) {
                const tenantDataRaw = await tenantRes.json();
                const tenantData = Array.isArray(tenantDataRaw) ? tenantDataRaw[0] : tenantDataRaw;
                if (tenantData && tenantData.name_tenant) {
                  userData = { ...userData, name_tenant: tenantData.name_tenant };
                }
              }
            } catch (error) {
              console.error('Error al cargar el nombre del workspace', error);
            }
          }
          
          // ⚠️ IMPORTANTE: Aplanar integrations al nivel raíz si existen
          const flattenedUser = userData.integrations ? {
            ...userData,
            send_emails: userData.integrations?.send_emails,
            sync_emails: userData.integrations?.sync_emails,
            sync_calendar: userData.integrations?.sync_calendar,
            watch_active: userData.integrations?.watch_active,
            granted_scopes: userData.integrations?.granted_scopes,
          } : userData;
          
          setUser(flattenedUser);
          localStorage.setItem('user', JSON.stringify(flattenedUser));
        } else if (res.status === 401 || res.status === 403) {
          // Token inválido, hacer logout
          logout();
        }
      } catch (error) {
        console.error("Error al refrescar el perfil de usuario", error);
        // No hacer logout automático en caso de error de red
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);
  
  // También intentar cargar desde localStorage al inicio
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && !user) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.id_user) {
          // ⚠️ IMPORTANTE: Aplanar integrations al nivel raíz si existen
          const flattenedUser = parsedUser.integrations ? {
            ...parsedUser,
            send_emails: parsedUser.integrations?.send_emails,
            sync_emails: parsedUser.integrations?.sync_emails,
            sync_calendar: parsedUser.integrations?.sync_calendar,
            watch_active: parsedUser.integrations?.watch_active,
            granted_scopes: parsedUser.integrations?.granted_scopes,
          } : parsedUser;
          
          setUser(flattenedUser);
        }
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
  }, [user]);

  const login = async (newToken: string, partialUser: Partial<User>) => {
    if (typeof partialUser !== 'object' || !partialUser || !partialUser.id_user || !partialUser.id_tenant) {
        console.error("🔴 ERROR CRÍTICO: Se intentó guardar un usuario inválido:", partialUser);
        return;
    }
    
    // 1. Guardar el nuevo token para que `fetchUser` pueda usarlo
    authService.saveToken(newToken);
    localStorage.setItem('token', newToken);

    // 2. Llamar a fetchUser para obtener y almacenar el perfil de usuario completo desde /me
    await fetchUser();
  };
  
  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading,
      isAuthenticated: !!user && !!token,
      refreshUser: fetchUser
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
