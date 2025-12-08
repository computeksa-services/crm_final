import { Quote, QuoteItem, UserDecision, CalendarEvent, User, Tenant, ClientCompany, ClientContact, Deal, DealPermission, Product, CustomStatus, InterestStatus } from '../types';

const USE_REAL_API = true; // Cambiar a true cuando configures n8n
const N8N_BASE_URL = 'https://service.computeksa.com/webhook'; 

// CONSTANTE PARA EVITAR ERRORES DE PARÁMETROS EN N8N
const EMPTY_FLAG = '__EMPTY__';

// --- CACHE ---
let clientCompaniesCache: ClientCompany[] | null = null;
let clientContactsCache: ClientContact[] | null = null;
let dealsCache: Deal[] | null = null;
let productsCache: Product[] | null = null;
let dealStatusesCache: CustomStatus[] | null = null;
let quoteStatusesCache: CustomStatus[] | null = null;
let quotesCache: Quote[] | null = null;
let interestStatusesCache: CustomStatus[] | null = null;


// --- MOCK DATA ---
let mockTenants: Tenant[] = [
  {
    id_tenant: 'tenant_001',
    ruc: '1792111846001',
    name_tenant: 'Computeksa S.A.',
    country: 'Ecuador',
    city: 'Quito',
    address: 'Av. República',
    website: 'http://www.computeksa.com',
    logo_url: ''
  }
];

let mockUsers: User[] = [
  {
    id_user: 'u_001',
    id_tenant: 'tenant_001',
    name_user: 'Admin Computeksa',
    email_user: 'admin@computeksa.com',
    rol_user: 'superadmin',
    status_user: 'Activo',
    job_title: 'Gerente General',
    avatar_url: 'https://ui-avatars.com/api/?name=Admin',
    googleConnected: false,
    outlookConnected: false
  }
];

let currentUser: User | null = null;

try {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }
} catch (e) {
  console.error("Error parsing stored user", e);
}

let mockClientCompanies: ClientCompany[] = [
  {
    id_client_company: 'cc_001',
    id_tenant: 'tenant_001',
    id_type: 'RUC',
    id_number: '2010000001',
    name_company: 'TechSolutions S.A.',
    industry: 'Tecnología',
    city: 'Guayaquil',
    email_company: 'contacto@tech.com',
    created_by: 'u_001'
  }
];

let mockClientContacts: ClientContact[] = [
  {
    id_contact: 'c_test_1',
    id_tenant: 'tenant_001',
    id_client_company: 'cc_001',
    first_name: 'Carlos',
    last_name: 'Pérez',
    email: 'carlos@techsolutions.com',
    phone: '0991234567',
    position: 'Gerente IT'
  }
];

let mockDeals: Deal[] = [
    {
        id_trato: 'deal_001',
        id_tenant: 'tenant_001',
        id_user_owner: 'u_001',
        id_client_company: 'cc_001',
        id_contact: 'c_test_1',
        nombre_trato: 'Proyecto de Transformador para Hospital',
        valor_trato: 99500.00,
        id_deal_status: 'ds_1', // FK to status
        id_interest_status: 'is_1', // FK to interest status
        created_at: new Date().toISOString(),
    }
];

let mockDealStatuses: CustomStatus[] = [
    { id_status: 'ds_1', id_tenant: 'tenant_001', type: 'deal', name: 'CALIFICADO', color: '#3b82f6', icon: 'fa-solid fa-star', is_default: true },
    { id_status: 'ds_2', id_tenant: 'tenant_001', type: 'deal', name: 'PROPUESTA ENVIADA', color: '#f97316', icon: 'fa-solid fa-file-signature' },
    { id_status: 'ds_3', id_tenant: 'tenant_001', type: 'deal', name: 'NEGOCIACIÓN', color: '#a855f7', icon: 'fa-solid fa-comments-dollar' },
    { id_status: 'ds_4', id_tenant: 'tenant_001', type: 'deal', name: 'GANADO', color: '#22c55e', icon: 'fa-solid fa-trophy' },
    { id_status: 'ds_5', id_tenant: 'tenant_001', type: 'deal', name: 'PERDIDO', color: '#ef4444', icon: 'fa-solid fa-thumbs-down' },
];
let mockInterestStatuses: CustomStatus[] = [
  { id_status: 'is_1', id_tenant: 'tenant_001', type: 'interest', name: 'Alto', color: '#ef4444', icon: 'fa-solid fa-fire-flame-curved', is_default: true },
  { id_status: 'is_2', id_tenant: 'tenant_001', type: 'interest', name: 'Medio', color: '#f97316', icon: 'fa-solid fa-bolt' },
  { id_status: 'is_3', id_tenant: 'tenant_001', type: 'interest', name: 'Bajo', color: '#22c55e', icon: 'fa-solid fa-leaf' },
];
let mockQuoteStatuses: CustomStatus[] = [
    { id_status: 'qs_1', id_tenant: 'tenant_001', type: 'quote', name: 'BORRADOR', color: '#64748b', icon: 'fa-solid fa-pen-ruler', is_default: true },
    { id_status: 'qs_2', id_tenant: 'tenant_001', type: 'quote', name: 'ENVIADO', color: '#3b82f6', icon: 'fa-solid fa-paper-plane' },
    { id_status: 'qs_3', id_tenant: 'tenant_001', type: 'quote', name: 'APROBADO', color: '#22c55e', icon: 'fa-solid fa-check-double' },
];
let mockProducts: Product[] = [
    { id_product: 'p_1', id_tenant: 'tenant_001', codigo: 'PROD-001', tipo: 'BIEN', descripcion: 'Licencia de Software CRM', precio_unitario: 1500.00 }
];


let quotes: Quote[] = [];
let quoteItems: QuoteItem[] = [];

const apiFetch = async (endpoint: string, method: string = 'GET', body?: any) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(`${N8N_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (response.status === 401) throw new Error('Credenciales inválidas');
    if (!response.ok) {
       if(method === 'GET') return []; 
       throw new Error('Network response was not ok');
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error(`API Error ${method} ${endpoint}:`, error);
    if(method === 'GET') return [];
    throw error;
  }
};

export const MockApi = {
  login: async (email: string, password: string): Promise<User | null> => {
     if (USE_REAL_API) {
        try {
          const user = await apiFetch('/api/auth/login', 'POST', { email, password });
          if (user && user.id_user) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            return user;
          }
          return null;
        } catch (error) {
          console.error("Login real failed", error);
          return null;
        }
     }
     return new Promise((resolve) => {
        setTimeout(() => {
           if (email.includes('@')) {
             currentUser = mockUsers[0];
             localStorage.setItem('currentUser', JSON.stringify(currentUser));
             resolve(currentUser);
           }
           else resolve(null);
        }, 800);
     });
  },
  
  logout: () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    // CLEAR CACHE ON LOGOUT TO PREVENT DATA LEAK BETWEEN TENANTS
    clientCompaniesCache = null;
    clientContactsCache = null;
    dealsCache = null;
    productsCache = null;
    dealStatusesCache = null;
    quoteStatusesCache = null;
    quotesCache = null;
  },
  
  getUser: async (): Promise<User | null> => {
    if (!currentUser) {
       const stored = localStorage.getItem('currentUser');
       if (stored) currentUser = JSON.parse(stored);
    }
    return new Promise(resolve => setTimeout(() => resolve(currentUser), 100));
  },

  updateUserSync: async (provider: 'google' | 'outlook', status: boolean) => currentUser,

  // --- TENANTS ---
  getTenants: async (): Promise<Tenant[]> => {
    if (USE_REAL_API) {
      try { return await apiFetch('/api/tenants'); } 
      catch (e) { return []; }
    }
    return new Promise(resolve => setTimeout(() => resolve([...mockTenants]), 400));
  },
  
  addTenant: async (data: Partial<Tenant>): Promise<Tenant> => {
    if (USE_REAL_API) {
      const payload = {
        ruc: data.ruc || EMPTY_FLAG,
        name_tenant: data.name_tenant || EMPTY_FLAG,
        country: data.country || EMPTY_FLAG,
        city: data.city || EMPTY_FLAG,
        address: data.address || EMPTY_FLAG,
        website: data.website || EMPTY_FLAG,
        logo_url: data.logo_url || EMPTY_FLAG
      };
      return apiFetch('/api/tenants', 'POST', payload);
    }
    return new Promise(resolve => {
        const newT = { ...data, id_tenant: `t_${Date.now()}` } as Tenant;
        mockTenants.push(newT);
        resolve(newT);
    });
  },

  updateTenant: async (id: string, data: Partial<Tenant>): Promise<Tenant> => {
    if (USE_REAL_API) {
      const payload = {
        id_tenant: id,
        ruc: data.ruc || EMPTY_FLAG,
        name_tenant: data.name_tenant || EMPTY_FLAG,
        country: data.country || EMPTY_FLAG,
        city: data.city || EMPTY_FLAG,
        address: data.address || EMPTY_FLAG,
        website: data.website || EMPTY_FLAG,
        logo_url: data.logo_url || EMPTY_FLAG
      };
      return apiFetch('/api/tenants/update', 'POST', payload);
    }
    const idx = mockTenants.findIndex(t => t.id_tenant === id);
    if(idx !== -1) mockTenants[idx] = { ...mockTenants[idx], ...data } as Tenant;
    return mockTenants[idx];
  },

  deleteTenant: async (id: string): Promise<void> => {
    if (USE_REAL_API) return apiFetch('/api/tenants/delete', 'POST', { id_tenant: id });
    mockTenants = mockTenants.filter(t => t.id_tenant !== id);
  },

  // --- CLIENT COMPANIES ---
  getClientCompanies: async (): Promise<ClientCompany[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];
  
    if (clientCompaniesCache) {
      return Promise.resolve([...clientCompaniesCache]);
    }
  
    if (USE_REAL_API) {
      try {
        const result = await apiFetch(`/api/client-companies?id_tenant=${user.id_tenant}`);
        const list = Array.isArray(result) ? result : [];
        // SECURITY FILTER: Double check to ensure we only get our tenant's data
        const filteredList = list.filter((item: ClientCompany) => item.id_tenant === user.id_tenant);
        clientCompaniesCache = filteredList;
        return filteredList;
      } catch (e) {
        return [];
      }
    }
  
    const filteredMock = mockClientCompanies.filter(cc => cc.id_tenant === user.id_tenant);
    clientCompaniesCache = filteredMock;
    return new Promise(resolve => setTimeout(() => resolve(filteredMock), 400));
  },

  getClientCompanyById: async (id: string): Promise<ClientCompany | undefined> => {
    const companies = await MockApi.getClientCompanies();
    return companies.find(c => c.id_client_company === id);
  },

  addClientCompany: async (data: Partial<ClientCompany>): Promise<ClientCompany> => {
    clientCompaniesCache = null; // Invalidar caché
    if (USE_REAL_API) {
      const payload = {
        id_tenant: currentUser?.id_tenant || EMPTY_FLAG,
        id_type: data.id_type || EMPTY_FLAG,
        id_number: data.id_number || EMPTY_FLAG,
        name_company: data.name_company || EMPTY_FLAG,
        industry: data.industry || EMPTY_FLAG,
        address: data.address || EMPTY_FLAG,
        city: data.city || EMPTY_FLAG,
        website: data.website || EMPTY_FLAG,
        phone_company: data.phone_company || EMPTY_FLAG,
        email_company: data.email_company || EMPTY_FLAG,
        created_by: currentUser?.id_user || EMPTY_FLAG
      };
      return apiFetch('/api/client-companies', 'POST', payload);
    }
    return new Promise(resolve => {
        const newCC = { 
            ...data, 
            id_client_company: `cc_${Date.now()}`, 
            id_tenant: currentUser?.id_tenant || 'tenant_001',
            created_by: currentUser?.id_user
        } as ClientCompany;
        mockClientCompanies.push(newCC);
        resolve(newCC);
    });
  },

  updateClientCompany: async (id: string, data: Partial<ClientCompany>): Promise<ClientCompany> => {
    clientCompaniesCache = null; // Invalidar caché
    if (USE_REAL_API) {
      const payload = {
        id_client_company: id,
        id_tenant: currentUser?.id_tenant || EMPTY_FLAG,
        id_type: data.id_type || EMPTY_FLAG,
        id_number: data.id_number || EMPTY_FLAG,
        name_company: data.name_company || EMPTY_FLAG,
        industry: data.industry || EMPTY_FLAG,
        address: data.address || EMPTY_FLAG,
        city: data.city || EMPTY_FLAG,
        website: data.website || EMPTY_FLAG,
        phone_company: data.phone_company || EMPTY_FLAG,
        email_company: data.email_company || EMPTY_FLAG
      };
      return apiFetch('/api/client-companies/update', 'POST', payload);
    }
    const idx = mockClientCompanies.findIndex(cc => cc.id_client_company === id);
    if(idx !== -1) mockClientCompanies[idx] = { ...mockClientCompanies[idx], ...data } as ClientCompany;
    return mockClientCompanies[idx];
  },

  deleteClientCompany: async (id: string): Promise<void> => {
    clientCompaniesCache = null; // Invalidar caché
    if (USE_REAL_API) return apiFetch('/api/client-companies/delete', 'POST', { id_client_company: id });
    mockClientCompanies = mockClientCompanies.filter(cc => cc.id_client_company !== id);
  },

  // --- CLIENT CONTACTS ---
  getClientContacts: async (): Promise<ClientContact[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];
  
    if (clientContactsCache) {
      return Promise.resolve([...clientContactsCache]);
    }
  
    if (USE_REAL_API) {
      try {
        const result = await apiFetch(`/api/client-contacts?id_tenant=${user.id_tenant}`);
        let contacts: ClientContact[] = [];
  
        if (Array.isArray(result)) {
          if (result.length > 0 && result[0] && result[0].hasOwnProperty('json')) {
            contacts = result.map(item => item.json);
          } else {
            contacts = result;
          }
        }
        
        // SECURITY FILTER
        const filteredContacts = contacts.filter(item => item.id_tenant === user.id_tenant);
        clientContactsCache = filteredContacts;
        return filteredContacts;
  
      } catch (e) {
        return [];
      }
    }
  
    const filteredMock = mockClientContacts.filter(contact => contact.id_tenant === user.id_tenant);
    clientContactsCache = filteredMock;
    return new Promise(resolve => setTimeout(() => resolve(filteredMock), 400));
  },
  
  getClientContactById: async (id: string): Promise<ClientContact | undefined> => {
    const contacts = await MockApi.getClientContacts();
    return contacts.find(c => c.id_contact === id);
  },

  addClientContact: async (data: Partial<ClientContact>): Promise<ClientContact> => {
    clientContactsCache = null;
    if (USE_REAL_API) {
      if (!data.id_client_company) {
          throw new Error("Missing id_client_company for contact creation");
      }

      const payload = {
        id_tenant: currentUser?.id_tenant || EMPTY_FLAG,
        id_client_company: data.id_client_company, 
        first_name: data.first_name || EMPTY_FLAG,
        last_name: data.last_name || EMPTY_FLAG,
        email: data.email || EMPTY_FLAG,
        phone: data.phone || EMPTY_FLAG,
        position: data.position || EMPTY_FLAG,
      };
      return apiFetch('/api/client-contacts', 'POST', payload);
    }
    return new Promise(resolve => {
        const newContact = { ...data, id_contact: `contact_${Date.now()}`, id_tenant: currentUser?.id_tenant || 'tenant_001' } as ClientContact;
        mockClientContacts.push(newContact);
        resolve(newContact);
    });
  },

  updateClientContact: async (id: string, data: Partial<ClientContact>): Promise<ClientContact> => {
    clientContactsCache = null;
    if (USE_REAL_API) {
      const payload = {
        id_contact: id,
        id_tenant: currentUser?.id_tenant || EMPTY_FLAG,
        id_client_company: data.id_client_company || EMPTY_FLAG,
        first_name: data.first_name || EMPTY_FLAG,
        last_name: data.last_name || EMPTY_FLAG,
        email: data.email || EMPTY_FLAG,
        phone: data.phone || EMPTY_FLAG,
        position: data.position || EMPTY_FLAG,
      };
      return apiFetch('/api/client-contacts/update', 'POST', payload);
    }
    const idx = mockClientContacts.findIndex(cc => cc.id_contact === id);
    if(idx !== -1) mockClientContacts[idx] = { ...mockClientContacts[idx], ...data } as ClientContact;
    return mockClientContacts[idx];
  },

  deleteClientContact: async (id: string): Promise<void> => {
    clientContactsCache = null;
    if (USE_REAL_API) return apiFetch('/api/client-contacts/delete', 'POST', { id_contact: id, id_tenant: currentUser?.id_tenant || EMPTY_FLAG });
    mockClientContacts = mockClientContacts.filter(cc => cc.id_contact !== id);
  },

  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];

    if (USE_REAL_API) {
        try {
            const endpoint = user.rol_user === 'superadmin' ? '/api/users' : `/api/users?id_tenant=${user.id_tenant}`;
            const result = await apiFetch(endpoint);
            const list = Array.isArray(result) ? result : [];
            
            // SECURITY FILTER (skip for superadmin who sees all)
            if (user.rol_user !== 'superadmin') {
                return list.filter((u: User) => u.id_tenant === user.id_tenant);
            }
            return list;
        } catch (e) {
            return [];
        }
    }
    const list = user.rol_user === 'superadmin' ?
        [...mockUsers] :
        mockUsers.filter(u => u.id_tenant === user.id_tenant);
    return new Promise(resolve => setTimeout(() => resolve(list), 400));
  },

  addUser: async (userData: Partial<User>): Promise<User> => {
     if (USE_REAL_API) {
        const payload = {
            id_tenant: userData.id_tenant,
            name_user: userData.name_user || EMPTY_FLAG,
            email_user: userData.email_user || EMPTY_FLAG,
            password: userData.password || EMPTY_FLAG, 
            phone_user: userData.phone_user || EMPTY_FLAG,
            rol_user: userData.rol_user || 'usuario',
            job_title: userData.job_title || EMPTY_FLAG
        };
        return apiFetch('/api/users', 'POST', payload);
     }
     return new Promise(resolve => {
         const u = { ...userData, id_user: `u_${Date.now()}`, id_tenant: 'tenant_001', avatar_url: '' } as User;
         mockUsers.push(u);
         resolve(u);
     });
  },

  updateUser: async (id: string, userData: Partial<User>): Promise<User> => {
    if (USE_REAL_API) {
        const payload = {
            id_user: id,
            name_user: userData.name_user || EMPTY_FLAG,
            email_user: userData.email_user || EMPTY_FLAG,
            phone_user: userData.phone_user || EMPTY_FLAG,
            rol_user: userData.rol_user || 'usuario',
            job_title: userData.job_title || EMPTY_FLAG,
            id_tenant: userData.id_tenant,
            password: userData.password || '__NO_CHANGE__'
        };
        return apiFetch('/api/users/update', 'POST', payload);
    }
    const idx = mockUsers.findIndex(u => u.id_user === id);
    if(idx !== -1) mockUsers[idx] = { ...mockUsers[idx], ...userData };
    return mockUsers[idx];
  },

  deleteUser: async (id: string): Promise<void> => {
    if (USE_REAL_API) return apiFetch('/api/users/delete', 'POST', { id_user: id });
    mockUsers = mockUsers.filter(u => u.id_user !== id);
  },

  // --- DEALS ---
  getDeals: async (): Promise<Deal[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];

    if (dealsCache) {
        return Promise.resolve([...dealsCache]);
    }

    if (USE_REAL_API) {
        try {
            // Se obtienen todos los datos en paralelo para mayor eficiencia
            const [dealsResult, dealStatuses, interestStatuses, clientCompanies, users] = await Promise.all([
                apiFetch(`/api/deals?id_tenant=${user.id_tenant}`),
                MockApi.getDealStatuses(),
                MockApi.getInterestStatuses(),
                MockApi.getClientCompanies(),
                MockApi.getUsers()
            ]);

            const dealsList = Array.isArray(dealsResult) ? dealsResult : [];

            // Se enriquecen los datos
            const enrichedDeals = dealsList.map((deal: Deal) => {
                const status = dealStatuses.find((s: CustomStatus) => s.id_status === deal.id_deal_status);
                const interest = interestStatuses.find((i: CustomStatus) => i.id_status === deal.id_interest_status);
                const company = clientCompanies.find((c: ClientCompany) => c.id_client_company === deal.id_client_company);
                const owner = users.find((u: User) => u.id_user === deal.id_user_owner);

                return {
                    ...deal,
                    estado: status?.name || 'Desconocido',
                    estado_color: status?.color,
                    estado_icon: status?.icon,
                    interes: interest?.name || 'N/D',
                    interes_color: interest?.color,
                    interes_icon: interest?.icon,
                    client_company_name: company?.name_company,
                    owner_name: owner?.name_user,
                };
            });
            
            dealsCache = enrichedDeals;
            return enrichedDeals;
        } catch (e) {
            console.error("Error fetching or enriching real deals:", e);
            return [];
        }
    }

    // El código de simulación (mock) se mantiene igual
    const filteredMock = mockDeals.filter(d => d.id_tenant === user.id_tenant);
    const enrichedDeals = filteredMock.map(deal => {
        const status = mockDealStatuses.find(s => s.id_status === deal.id_deal_status);
        return {
            ...deal,
            estado: status?.name || 'Desconocido',
            estado_color: status?.color,
            estado_icon: status?.icon,
            client_company_name: mockClientCompanies.find(c => c.id_client_company === deal.id_client_company)?.name_company,
            owner_name: mockUsers.find(u => u.id_user === deal.id_user_owner)?.name_user,
        };
    });
    dealsCache = enrichedDeals;
    return new Promise(resolve => setTimeout(() => resolve(enrichedDeals), 400));
  },

  getDealById: async (id: string): Promise<Deal | undefined> => {
    const deals = await MockApi.getDeals();
    return deals.find(d => d.id_trato === id);
  },

  getInterestStatuses: async (): Promise<CustomStatus[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];

    if (USE_REAL_API) {
      if (interestStatusesCache) return interestStatusesCache;
      const data = await apiFetch(`/api/statuses/interests?id_tenant=${user.id_tenant}`);
      interestStatusesCache = data;
      return data;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    return JSON.parse(JSON.stringify(mockInterestStatuses));
  },

  addInterestStatus: async (status: Partial<CustomStatus>): Promise<CustomStatus> => {
    const user = await MockApi.getUser();
    if (!user) throw new Error("Unauthorized");
    interestStatusesCache = null;

    if (USE_REAL_API) {
      const payload = {
        id_tenant: user.id_tenant,
        name: status.name || 'Nuevo Estado',
        color: status.color || '#cccccc',
        icon: status.icon || 'fa-solid fa-question-circle',
        is_default: status.is_default || false,
      };
      return apiFetch('/api/statuses/interests', 'POST', payload);
    }

    // El código de simulación (mock) sí necesita generar un ID.
    const newStatus: CustomStatus = {
        ...status,
        name: status.name || 'Nuevo Estado Mock', // <-- CORRECCIÓN AQUÍ
        id_status: `is_${Date.now()}`,
        id_tenant: user.id_tenant,
        type: 'interest',
    };
    mockInterestStatuses.push(newStatus);
    return newStatus;
  },

  updateInterestStatus: async (id: string, data: Partial<CustomStatus>): Promise<CustomStatus> => {
    interestStatusesCache = null;
    if (USE_REAL_API) {
      // CORRECCIÓN: Replicando la estructura exacta de las otras funciones de actualización.
      const payload = { ...data };
      return apiFetch('/api/statuses/interests/update', 'POST', { id_status: id, ...payload, id_tenant: currentUser?.id_tenant });
    }
    // Lógica de simulación (mock)
    const index = mockInterestStatuses.findIndex(s => s.id_status === id);
    if (index === -1) throw new Error("Status not found");
    mockInterestStatuses[index] = { ...mockInterestStatuses[index], ...data } as CustomStatus;
    return Promise.resolve(mockInterestStatuses[index]);
  },

  deleteInterestStatus: async (id: string): Promise<void> => {
    interestStatusesCache = null;
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/interests/delete', 'POST', { id_status: id, id_tenant: currentUser?.id_tenant });
    }
    mockInterestStatuses = mockInterestStatuses.filter(s => s.id_status !== id);
    return Promise.resolve();
  },

  getProducts: async (): Promise<Product[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];
  
    if (productsCache) return Promise.resolve([...productsCache]);
  
    if (USE_REAL_API) {
      try {
        const results = await apiFetch(`/api/products?id_tenant=${user.id_tenant}`);
        const list = Array.isArray(results) ? results : [];
        
        // SECURITY FILTER
        const filteredList = list.filter((p: Product) => p.id_tenant === user.id_tenant);
        productsCache = filteredList;
        return filteredList;
      } catch (e) {
        return [];
      }
    }
    const filtered = mockProducts.filter(p => p.id_tenant === user.id_tenant);
    productsCache = filtered;
    return Promise.resolve(filtered);
  },
  addProduct: async (data: Partial<Product>): Promise<Product> => {
    productsCache = null;
    const newProd = {
        ...data,
        id_product: `prod_${Date.now()}`,
        id_tenant: currentUser?.id_tenant
    } as Product;
    mockProducts.push(newProd);
    return Promise.resolve(newProd);
  },
  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> => {
    productsCache = null;
    const idx = mockProducts.findIndex(p => p.id_product === id);
    mockProducts[idx] = { ...mockProducts[idx], ...data } as Product;
    return Promise.resolve(mockProducts[idx]);
  },
  deleteProduct: async (id: string): Promise<void> => {
    productsCache = null;
    mockProducts = mockProducts.filter(p => p.id_product !== id);
    return Promise.resolve();
  },

  // --- CUSTOM STATUSES ---
  getDealStatuses: async (): Promise<CustomStatus[]> => {
    if (dealStatusesCache) return Promise.resolve([...dealStatusesCache]);
    const user = await MockApi.getUser();
    
    if (USE_REAL_API) {
        try {
            const results = await apiFetch(`/api/statuses/deals?id_tenant=${user?.id_tenant}`);
            const list = Array.isArray(results) ? results : [];
            // SECURITY FILTER
            const filtered = list.filter((s: CustomStatus) => s.id_tenant === user?.id_tenant);
            dealStatusesCache = filtered;
            return filtered;
        } catch (e) {
            return [];
        }
    }
    const filtered = mockDealStatuses.filter(s => s.id_tenant === user?.id_tenant);
    dealStatusesCache = filtered;
    return Promise.resolve(filtered);
  },
  addDealStatus: async (data: Partial<CustomStatus>): Promise<CustomStatus> => {
    dealStatusesCache = null;
    const payload = { ...data, id_tenant: currentUser?.id_tenant, name: data.name?.toUpperCase() };
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/deals', 'POST', payload);
    }
    const newStatus = {
      ...payload,
      id_status: `ds_${Date.now()}`,
      color: data.color || '#cccccc'
    } as CustomStatus;
    mockDealStatuses.push(newStatus);
    return Promise.resolve(newStatus);
  },
  updateDealStatus: async (id: string, data: Partial<CustomStatus>): Promise<CustomStatus> => {
    dealStatusesCache = null;
    const payload = { ...data, name: data.name?.toUpperCase() };
     if (USE_REAL_API) {
      return apiFetch('/api/statuses/deals/update', 'POST', { id_status: id, ...payload, id_tenant: currentUser?.id_tenant });
    }
    const idx = mockDealStatuses.findIndex(s => s.id_status === id);
    if (idx !== -1) {
      mockDealStatuses[idx] = { ...mockDealStatuses[idx], ...payload } as CustomStatus;
    }
    return Promise.resolve(mockDealStatuses[idx]);
  },
  deleteDealStatus: async (id: string): Promise<void> => {
    dealStatusesCache = null;
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/deals/delete', 'POST', { id_status: id, id_tenant: currentUser?.id_tenant });
    }
    mockDealStatuses = mockDealStatuses.filter(s => s.id_status !== id);
    return Promise.resolve();
  },
  getQuoteStatuses: async (): Promise<CustomStatus[]> => {
    if (quoteStatusesCache) return Promise.resolve([...quoteStatusesCache]);
    const user = await MockApi.getUser();
    if (USE_REAL_API) {
      try {
            const results = await apiFetch(`/api/statuses/quotes?id_tenant=${user?.id_tenant}`);
            const list = Array.isArray(results) ? results : [];
            // SECURITY FILTER
            const filtered = list.filter((s: CustomStatus) => s.id_tenant === user?.id_tenant);
            quoteStatusesCache = filtered;
            return filtered;
        } catch (e) {
            return [];
        }
    }
    const filtered = mockQuoteStatuses.filter(s => s.id_tenant === user?.id_tenant);
    quoteStatusesCache = filtered;
    return Promise.resolve(filtered);
  },
  addQuoteStatus: async (data: Partial<CustomStatus>): Promise<CustomStatus> => {
    quoteStatusesCache = null;
    const payload = { ...data, id_tenant: currentUser?.id_tenant, name: data.name?.toUpperCase() };
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/quotes', 'POST', payload);
    }
    const newStatus = {
      ...payload,
      id_status: `qs_${Date.now()}`,
      color: data.color || '#cccccc'
    } as CustomStatus;
    mockQuoteStatuses.push(newStatus);
    return Promise.resolve(newStatus);
  },
  updateQuoteStatus: async (id: string, data: Partial<CustomStatus>): Promise<CustomStatus> => {
    quoteStatusesCache = null;
    const payload = { ...data, name: data.name?.toUpperCase() };
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/quotes/update', 'POST', { id_status: id, ...payload, id_tenant: currentUser?.id_tenant });
    }
    const idx = mockQuoteStatuses.findIndex(s => s.id_status === id);
    if (idx !== -1) {
      mockQuoteStatuses[idx] = { ...mockQuoteStatuses[idx], ...payload } as CustomStatus;
    }
    return Promise.resolve(mockQuoteStatuses[idx]);
  },
  deleteQuoteStatus: async (id: string): Promise<void> => {
    quoteStatusesCache = null;
    if (USE_REAL_API) {
      return apiFetch('/api/statuses/quotes/delete', 'POST', { id_status: id, id_tenant: currentUser?.id_tenant });
    }
    mockQuoteStatuses = mockQuoteStatuses.filter(s => s.id_status !== id);
    return Promise.resolve();
  },
  
  // OTHERS
  getQuotes: async (): Promise<Quote[]> => {
    const user = await MockApi.getUser();
    if (!user) return [];

    if (quotesCache) {
      return Promise.resolve([...quotesCache]);
    }

    if (USE_REAL_API) {
      try {
        const result = await apiFetch(`/api/quotes?id_tenant=${user.id_tenant}`);
        const list = Array.isArray(result) ? result : [];
        // SECURITY FILTER
        const filteredList = list.filter((q: Quote) => q.id_tenant === user.id_tenant);
        quotesCache = filteredList;
        return filteredList;
      } catch (e) {
        return [];
      }
    }
    
    // Fallback Mock Data Logic if not using real API
    const filtered = quotes.filter(q => q.id_tenant === user.id_tenant);
    quotesCache = filtered;
    return filtered;
  },
  getEvents: async (): Promise<CalendarEvent[]> => [],
  addEvent: async (e: Partial<CalendarEvent>) => e as CalendarEvent,
  getQuoteById: async (id: string) => quotes.find(q => q.id_cotizacion === id),
  getQuoteItems: async (id_cotizacion: string): Promise<QuoteItem[]> => {
    return Promise.resolve(quoteItems.filter(i => i.id_cotizacion === id_cotizacion));
  },
  addQuoteItem: async (item: Partial<QuoteItem>) => {
    const newItem = { ...item, id_quote_item: `qi_${Date.now()}` } as QuoteItem;
    quoteItems.push(newItem);
    return newItem;
  },
  generatePDF: async (id:string) => quotes[0],
  sendQuote: async (id:string) => quotes[0],
  updateDecision: async (id: string, decision: UserDecision) => quotes[0]
};