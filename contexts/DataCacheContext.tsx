import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/apiClient';
import type { ClientCompany, Product, User, Tenant, DealStatus, QuoteStatus, ProductType, DealInterest, DealChannel, FinancialTransaction } from '../types';

// --- TIPOS ---
type Contact = {
  id_contact: string;
  first_name: string;
  last_name: string;
  email: string;
  email_contact?: string;
  position?: string;
  phone?: string;
  id_client_company?: string;
  id_company?: string;
  company_id?: string;
  es_principal?: boolean;
  is_main?: boolean;
};

type DataCacheState = {
  // Datos
  companies: ClientCompany[];
  companyLabelsMap: Record<string, { name: string; color?: string }>;
  contacts: Contact[];
  products: Product[];
  users: User[];
  tenants: Tenant[];
  dealStatuses: DealStatus[];
  quoteStatuses: QuoteStatus[];
  productTypes: ProductType[];
  dealInterests: DealInterest[];
  dealChannels: DealChannel[];
  financialsCache: Record<string, { result: any; lastUpdated: number }>;
  
  // Estado de carga
  loading: boolean;
  loaded: boolean;
  
  // Métodos de invalidación
  invalidateCompanies: () => Promise<void>;
  invalidateContacts: () => Promise<void>;
  invalidateProducts: () => Promise<void>;
  invalidateUsers: () => Promise<void>;
  invalidateTenants: () => Promise<void>;
  invalidateDealStatuses: () => Promise<void>;
  invalidateQuoteStatuses: () => Promise<void>;
  invalidateProductTypes: () => Promise<void>;
  invalidateDealInterests: () => Promise<void>;
  invalidateDealChannels: () => Promise<void>;
  invalidateFinancials: (params: { start?: string; end?: string; include_open?: boolean }) => Promise<void>;
  invalidateAll: () => Promise<void>;
  
  // Métodos auxiliares
  getContactsByCompany: (companyId: string | number) => Contact[];
  getCompanyById: (companyId: string | number) => ClientCompany | undefined;
  getProductById: (productId: string | number) => Product | undefined;
  getUserById: (userId: string | number) => User | undefined;
};

const DataCacheContext = createContext<DataCacheState | undefined>(undefined);

export const DataCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [companyLabelsMap, setCompanyLabelsMap] = useState<Record<string, { name: string; color?: string }>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [dealInterests, setDealInterests] = useState<DealInterest[]>([]);
  const [dealChannels, setDealChannels] = useState<DealChannel[]>([]);
  const [financialsCache, setFinancialsCache] = useState<Record<string, { result: any; lastUpdated: number }>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Normaliza una respuesta que puede venir como array envolviendo unified_response o como array plano
  const parseCompaniesPayload = useCallback((payload: any) => {
    const normalized = Array.isArray(payload)
      ? payload.find(item => item && typeof item === 'object' && 'unified_response' in item) ?? payload
      : payload;

    let companiesArray: any[] = [];
    let labelsMap: Record<string, { name: string; color?: string }> = {};

    if (normalized && typeof normalized === 'object' && (normalized as any).unified_response) {
      const ur = (normalized as any).unified_response;
      const dict = Array.isArray(ur?.dictionary) ? ur.dictionary : [];
      dict.forEach((l: any) => {
        if (l?.id_label) labelsMap[l.id_label] = { name: l.name, color: l.color };
      });
      const rows = Array.isArray(ur?.rows) ? ur.rows : [];
      companiesArray = rows.filter((item: any) => item.id_client_company || item.name_company);
    } else {
      const arr = Array.isArray(normalized) ? normalized : [];
      companiesArray = arr.filter((item: any) => item.id_client_company || item.name_company);
    }

    return { companiesArray, labelsMap };
  }, []);

  // --- CARGA INICIAL ---
  const loadData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    // 1. Intentar cargar desde localStorage primero (sin parpadeo)
    // Limpieza de clave legacy por inquilino sin usuario
    try {
      localStorage.removeItem(`cache_${user.id_tenant}`);
    } catch (e) {}
    const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
    const cached = localStorage.getItem(cachedKey);
    if (cached) {
      try {
        const { 
          companies: cachedCompanies, 
          companyLabelsMap: cachedCompanyLabelsMap,
          contacts: cachedContacts, 
          products: cachedProducts, 
          users: cachedUsers, 
          tenants: cachedTenants,
          dealStatuses: cachedDealStatuses,
          quoteStatuses: cachedQuoteStatuses,
          productTypes: cachedProductTypes,
          dealInterests: cachedDealInterests,
          dealChannels: cachedDealChannels,
          financialsCache: cachedFinancialsCache
        } = JSON.parse(cached);
        
        console.log('📦 DataCache: Cargando desde localStorage', {
          dealStatuses: Array.isArray(cachedDealStatuses) ? cachedDealStatuses.length : 0,
          quoteStatuses: Array.isArray(cachedQuoteStatuses) ? cachedQuoteStatuses.length : 0,
          productTypes: Array.isArray(cachedProductTypes) ? cachedProductTypes.length : 0,
          dealInterests: Array.isArray(cachedDealInterests) ? cachedDealInterests.length : 0,
          dealChannels: Array.isArray(cachedDealChannels) ? cachedDealChannels.length : 0
        });
        
        setCompanies(Array.isArray(cachedCompanies) ? cachedCompanies : []);
        setCompanyLabelsMap(cachedCompanyLabelsMap || {});
        setContacts(Array.isArray(cachedContacts) ? cachedContacts : []);
        setProducts(Array.isArray(cachedProducts) ? cachedProducts : []);
        setUsers(Array.isArray(cachedUsers) ? cachedUsers : []);
        setTenants(Array.isArray(cachedTenants) ? cachedTenants : []);
        setDealStatuses(Array.isArray(cachedDealStatuses) ? cachedDealStatuses : []);
        setQuoteStatuses(Array.isArray(cachedQuoteStatuses) ? cachedQuoteStatuses : []);
        setProductTypes(Array.isArray(cachedProductTypes) ? cachedProductTypes : []);
        setDealInterests(Array.isArray(cachedDealInterests) ? cachedDealInterests : []);
        setDealChannels(Array.isArray(cachedDealChannels) ? cachedDealChannels : []);
        setFinancialsCache(cachedFinancialsCache && typeof cachedFinancialsCache === 'object' ? cachedFinancialsCache : {});
        setLoaded(true);
        // NO mostrar loading si ya tenemos datos en cache
      } catch (e) {
        console.error('❌ Error al parsear cache, limpiando...', e);
        localStorage.removeItem(cachedKey);
      }
    } else {
      console.log('📦 DataCache: No hay cache, mostrando loading');
      // Solo mostrar loading si NO hay cache
      setLoading(true);
    }
    
    // 2. Sincronizar con API en segundo plano
    console.log('🌐 DataCache: Iniciando fetch desde API...');
    const safeJson = async <T = any,>(res: Response, fallback: T): Promise<T> => {
      try {
        const text = await res.text();
        if (!text) return fallback;
        return JSON.parse(text);
      } catch (err) {
        console.error('⚠️ DataCache: Error parseando JSON', err);
        return fallback;
      }
    };
    try {
      const [companiesRes, contactsRes, productsRes, usersRes, tenantsRes, dealStatusesRes, quoteStatusesRes, productTypesRes, dealInterestsRes, dealChannelsRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        user.rol_user === 'superadmin' 
          ? apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants?id_user=${user.id_user}`)
          : apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants/detail?id_tenant=${user.id_tenant}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${user.id_tenant}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes?id_tenant=${user.id_tenant}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type?id_tenant=${user.id_tenant}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/interests/deals?id_tenant=${user.id_tenant}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/channels/deals?id_tenant=${user.id_tenant}`)
      ]);
      
      console.log('✅ DataCache: Respuestas recibidas', {
        dealStatusesOk: dealStatusesRes.ok,
        quoteStatusesOk: quoteStatusesRes.ok,
        productTypesOk: productTypesRes.ok,
        dealInterestsOk: dealInterestsRes.ok,
        dealChannelsOk: dealChannelsRes.ok
      });

      const [companiesData, contactsData, productsData, usersData, tenantsData, dealStatusesData, quoteStatusesData, productTypesData, dealInterestsData, dealChannelsData] = await Promise.all([
        companiesRes.ok ? safeJson(companiesRes, []) : [],
        contactsRes.ok ? safeJson(contactsRes, []) : [],
        productsRes.ok ? safeJson(productsRes, []) : [],
        usersRes.ok ? safeJson(usersRes, []) : [],
        tenantsRes.ok ? safeJson(tenantsRes, []) : [],
        dealStatusesRes.ok ? safeJson(dealStatusesRes, []) : [],
        quoteStatusesRes.ok ? safeJson(quoteStatusesRes, []) : [],
        productTypesRes.ok ? safeJson(productTypesRes, []) : [],
        dealInterestsRes.ok ? safeJson(dealInterestsRes, []) : [],
        dealChannelsRes.ok ? safeJson(dealChannelsRes, []) : []
      ]);

      // Soportar unified_response { dictionary, rows } y el array envolviendo
      const { companiesArray, labelsMap } = parseCompaniesPayload(companiesData);
      const contactsArray = Array.isArray(contactsData) ? contactsData.filter((item: any) => item.id_contact || item.first_name || item.last_name) : [];
      const productsArray = Array.isArray(productsData) ? productsData.filter((item: any) => item.id_product || item.product_name) : [];
      const usersArray = Array.isArray(usersData) ? usersData.filter((item: any) => item.id_user || item.nombre_user) : [];
      const tenantsArray = Array.isArray(tenantsData) ? (user.rol_user === 'superadmin' ? tenantsData.filter((item: any) => item.id_tenant || item.tenant_name) : [tenantsData].filter((item: any) => item.id_tenant || item.tenant_name)) : [];
      const dealStatusesArray = Array.isArray(dealStatusesData) ? dealStatusesData.filter((item: any) => item.id_status || item.status_name) : [];
      const quoteStatusesArray = Array.isArray(quoteStatusesData) ? quoteStatusesData.filter((item: any) => item.id_status || item.status_name) : [];
      const productTypesArray = Array.isArray(productTypesData) ? productTypesData.filter((item: any) => item.id_product_type || item.product_type_name) : [];
      const dealInterestsArray = Array.isArray(dealInterestsData) ? dealInterestsData.filter((item: any) => item.id_interest || item.interest_name) : [];
      const dealChannelsArray = Array.isArray(dealChannelsData) ? dealChannelsData.filter((item: any) => item.id_channel || item.channel_name) : [];

      console.log('📊 DataCache: Datos parseados desde API', {
        dealStatusesData,
        dealStatusesArray: dealStatusesArray.length,
        quoteStatusesArray: quoteStatusesArray.length,
        productTypesArray: productTypesArray.length,
        dealInterestsArray: dealInterestsArray.length,
        dealChannelsArray: dealChannelsArray.length
      });

      setCompanies(companiesArray);
      setCompanyLabelsMap(labelsMap);
      setContacts(contactsArray);
      setProducts(productsArray);
      setUsers(usersArray);
      setTenants(tenantsArray);
      setDealStatuses(dealStatusesArray);
      setQuoteStatuses(quoteStatusesArray);
      setProductTypes(productTypesArray);
      setDealInterests(dealInterestsArray);
      setDealChannels(dealChannelsArray);
      
      console.log('📦 DataCache: Datos cargados desde API', {
        companies: companiesArray.length,
        contacts: contactsArray.length,
        users: usersArray.length,
        dealStatuses: dealStatusesArray.length,
        quoteStatuses: quoteStatusesArray.length,
        productTypes: productTypesArray.length,
        dealInterests: dealInterestsArray.length,
        dealChannels: dealChannelsArray.length
      });
      
      // 3. Guardar en localStorage para próxima carga
      try {
        localStorage.setItem(cachedKey, JSON.stringify({ 
          companies: companiesArray, 
          companyLabelsMap: labelsMap,
          contacts: contactsArray,
          products: productsArray,
          users: usersArray,
          tenants: tenantsArray,
          dealStatuses: dealStatusesArray,
          quoteStatuses: quoteStatusesArray,
          productTypes: productTypesArray,
          dealInterests: dealInterestsArray,
          dealChannels: dealChannelsArray,
          financialsCache,
          meta: { id_tenant: user.id_tenant, id_user: user.id_user },
          timestamp: Date.now()
        }));
      } catch (e) {
        // localStorage lleno, ignorar
      }
      
      setLoaded(true);
    } catch (error) {
      console.error('❌ DataCache: Error en fetch API', error);
    } finally {
      setLoading(false);
    }
  }, [user, parseCompaniesPayload]);

  // Cargar datos al montar si hay usuario
  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- INVALIDACIÓN (RECARGA) ---
  const invalidateCompanies = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (res.ok) {
        const data = await res.json();
        const { companiesArray, labelsMap } = parseCompaniesPayload(data);
        setCompanies(companiesArray);
        setCompanyLabelsMap(labelsMap);
        
        // Guardar en localStorage
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : { contacts: [] };
          localStorage.setItem(cachedKey, JSON.stringify({ 
            ...parsed,
            companies: companiesArray,
            companyLabelsMap: labelsMap
          }));
        } catch (e) {}
      }
    } catch (error) {
    }
  }, [user, parseCompaniesPayload]);

  const invalidateContacts = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const contactsArray = Array.isArray(data) ? data.filter((item: any) => item.id_contact || item.first_name || item.last_name) : [];
        setContacts(contactsArray);
        
        // Guardar en localStorage
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : { companies: [] };
          localStorage.setItem(cachedKey, JSON.stringify({ 
            ...parsed,
            contacts: contactsArray 
          }));
        } catch (e) {}
      }
    } catch (error) {
    }
  }, [user]);

  const invalidateProducts = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const productsArray = Array.isArray(data) ? data.filter((item: any) => item.id_product || item.product_name) : [];
        setProducts(productsArray);
        
        // Guardar en localStorage
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ 
            ...parsed,
            products: productsArray 
          }));
        } catch (e) {}
      }
    } catch (error) {
    }
  }, [user]);

  const invalidateUsers = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const usersArray = Array.isArray(data) ? data.filter((item: any) => item.id_user || item.nombre_user) : [];
        setUsers(usersArray);
        
        // Guardar en localStorage
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ 
            ...parsed,
            users: usersArray 
          }));
        } catch (e) {}
      }
    } catch (error) {
    }
  }, [user]);

  const invalidateTenants = useCallback(async () => {
    if (!user?.id_user) return;
    
    try {
      const res = user.rol_user === 'superadmin'
        ? await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants?id_user=${user.id_user}`)
        : await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants/detail?id_tenant=${user.id_tenant}`);
      
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const tenantsArray = Array.isArray(data) ? (user.rol_user === 'superadmin' ? data.filter((item: any) => item.id_tenant || item.tenant_name) : [data].filter((item: any) => item.id_tenant || item.tenant_name)) : [];
        setTenants(tenantsArray);
        
        // Guardar en localStorage
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ 
            ...parsed,
            tenants: tenantsArray 
          }));
        } catch (e) {}
      }
    } catch (error) {
    }
  }, [user]);

  const invalidateDealStatuses = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const array = Array.isArray(data) ? data.filter((item: any) => item.id_status || item.status_name) : [];
        setDealStatuses(array);
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, dealStatuses: array }));
        } catch (e) {}
      }
    } catch (error) {}
  }, [user]);

  const invalidateQuoteStatuses = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const array = Array.isArray(data) ? data.filter((item: any) => item.id_status || item.status_name) : [];
        setQuoteStatuses(array);
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, quoteStatuses: array }));
        } catch (e) {}
      }
    } catch (error) {}
  }, [user]);

  const invalidateProductTypes = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const array = Array.isArray(data) ? data.filter((item: any) => item.id_product_type || item.product_type_name) : [];
        setProductTypes(array);
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, productTypes: array }));
        } catch (e) {}
      }
    } catch (error) {}
  }, [user]);

  const invalidateDealInterests = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/interests/deals?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const array = Array.isArray(data) ? data.filter((item: any) => item.id_interest || item.interest_name) : [];
        setDealInterests(array);
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, dealInterests: array }));
        } catch (e) {}
      }
    } catch (error) {}
  }, [user]);

  const invalidateDealChannels = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/channels/deals?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar objetos phantom {success: true} sin datos reales
        const array = Array.isArray(data) ? data.filter((item: any) => item.id_channel || item.channel_name) : [];
        setDealChannels(array);
        const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, dealChannels: array }));
        } catch (e) {}
      }
    } catch (error) {}
  }, [user]);

  const invalidateFinancials = useCallback(async (params: { start?: string; end?: string; include_open?: boolean }) => {
    if (!user?.id_tenant) return;
    try {
      const query = new URLSearchParams({
        start_date: params.start || '',
        end_date: params.end || '',
        include_open: String(params.include_open || false)
      }).toString();
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials?${query}`);
      if (res.ok) {
        const data = await res.json();
        const result = Array.isArray(data) ? data[0] : data;
        const key = `${params.start || ''}|${params.end || ''}|${params.include_open ? 1 : 0}`;
        setFinancialsCache(prev => {
          const next = { ...prev, [key]: { result, lastUpdated: Date.now() } };
          // Persistir en localStorage junto al resto del cache
          const cachedKey = `cache_${user.id_tenant}_${user.id_user}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            const parsed = cached ? JSON.parse(cached) : {};
            localStorage.setItem(cachedKey, JSON.stringify({ ...parsed, financialsCache: next }));
          } catch (e) {}
          return next;
        });
      }
    } catch (e) {
    }
  }, [user]);

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      invalidateCompanies(),
      invalidateContacts(),
      invalidateProducts(),
      invalidateUsers(),
      invalidateTenants(),
      invalidateDealStatuses(),
      invalidateQuoteStatuses(),
      invalidateProductTypes(),
      invalidateDealInterests(),
      invalidateDealChannels()
    ]);
  }, [invalidateCompanies, invalidateContacts, invalidateProducts, invalidateUsers, invalidateTenants, invalidateDealStatuses, invalidateQuoteStatuses, invalidateProductTypes, invalidateDealInterests, invalidateDealChannels]);

  // --- MÉTODOS AUXILIARES ---
  const getContactsByCompany = useCallback((companyId: string | number) => {
    return contacts.filter(c => 
      String(c.id_client_company || c.id_company || c.company_id) === String(companyId)
    );
  }, [contacts]);

  const getCompanyById = useCallback((companyId: string | number) => {
    return companies.find(c => String(c.id_client_company) === String(companyId));
  }, [companies]);

  const getProductById = useCallback((productId: string | number) => {
    return products.find(p => String(p.id_product) === String(productId));
  }, [products]);

  const getUserById = useCallback((userId: string | number) => {
    return users.find(u => String(u.id_user) === String(userId));
  }, [users]);

  const value: DataCacheState = {
    companies,
    companyLabelsMap,
    contacts,
    products,
    users,
    tenants,
    dealStatuses,
    quoteStatuses,
    productTypes,
    dealInterests,
    dealChannels,
    financialsCache,
    loading,
    loaded,
    invalidateCompanies,
    invalidateContacts,
    invalidateProducts,
    invalidateUsers,
    invalidateTenants,
    invalidateDealStatuses,
    invalidateQuoteStatuses,
    invalidateProductTypes,
    invalidateDealInterests,
    invalidateDealChannels,
    invalidateFinancials,
    invalidateAll,
    getContactsByCompany,
    getCompanyById,
    getProductById,
    getUserById
  };

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache debe usarse dentro de DataCacheProvider');
  }
  return context;
};
