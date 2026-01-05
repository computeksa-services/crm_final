import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface DealStatus {
  id_status: string;
  name: string;
  color: string;
  icon?: string;
}

interface Deal {
  id_deal: string;
  id_deal_status: string;
  [key: string]: any;
}

interface DealFiltersContextType {
  dealStatuses: DealStatus[];
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  expandedMenu: string | null;
  setExpandedMenu: (menu: string | null) => void;
  deals: Deal[];
  setDeals: (deals: Deal[]) => void;
}

const DealFiltersContext = createContext<DealFiltersContextType | undefined>(undefined);

export const DealFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState(() => {
    // Recuperar filtro guardado en localStorage
    const saved = localStorage.getItem('dealStatusFilter');
    return saved || '';
  });
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const { user } = useAuth();

  // Guardar filtro en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('dealStatusFilter', statusFilter);
  }, [statusFilter]);

  // Cargar deal statuses
  useEffect(() => {
    if (!user?.id_tenant || !user?.id_user) {
      setDealStatuses([]);
      return;
    }

    let isMounted = true;

    const fetchDealStatuses = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setDealStatuses(Array.isArray(data) ? data : []);
          }
        }
      } catch (error) {
        console.error("Error fetching deal statuses", error);
      }
    };

    fetchDealStatuses();
    return () => { isMounted = false; };
  }, [user?.id_tenant, user?.id_user]);

  const value: DealFiltersContextType = {
    dealStatuses,
    statusFilter,
    setStatusFilter,
    expandedMenu,
    setExpandedMenu,
    deals,
    setDeals,
  };

  return (
    <DealFiltersContext.Provider value={value}>
      {children}
    </DealFiltersContext.Provider>
  );
};

export const useDealFilters = () => {
  const context = useContext(DealFiltersContext);
  if (!context) {
    throw new Error('useDealFilters must be used within a DealFiltersProvider');
  }
  return context;
};
