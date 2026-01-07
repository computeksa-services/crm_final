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
  setDealStatuses: (statuses: DealStatus[]) => void;
}

const DealFiltersContext = createContext<DealFiltersContextType | undefined>(undefined);

export const DealFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dealStatuses, setDealStatusesState] = useState<DealStatus[]>([]);
  const [statusesHydrated, setStatusesHydrated] = useState(false);
  const [statusFilter, setStatusFilter] = useState(() => {
    // Recuperar filtro guardado en localStorage
    const saved = localStorage.getItem('dealStatusFilter');
    return saved || '';
  });
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const { user } = useAuth();

  // Permite hidratar estados desde otra llamada (por ejemplo, /api/deals con config_estados)
  const setDealStatuses = useCallback((statuses: DealStatus[]) => {
    setDealStatusesState(statuses);
    setStatusesHydrated(true);
  }, []);

  // Reiniciar cuando cambia el usuario/tenant
  useEffect(() => {
    setDealStatusesState([]);
    setStatusesHydrated(false);
  }, [user?.id_tenant, user?.id_user]);

  // Guardar filtro en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('dealStatusFilter', statusFilter);
  }, [statusFilter]);

  // Ya no hacemos llamada separada a /api/statuses/deals.
  // Los estados se hidratan desde la respuesta de /api/deals mediante setDealStatuses.

  const value: DealFiltersContextType = {
    dealStatuses,
    statusFilter,
    setStatusFilter,
    expandedMenu,
    setExpandedMenu,
    deals,
    setDeals,
    setDealStatuses,
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
