import { 
  MarketingCampaign, 
  MarketingList, 
  MarketingListMember, 
  MarketingIntegration, 
  SharedUser,
  CurrentUser 
} from './marketingTypes';

// Mock Current User
export const CURRENT_USER: CurrentUser = {
  id_user: 'user_001',
  id_tenant: 'tenant_abc',
  name: 'Juan Pérez',
  email: 'juan@empresa.com'
};

// Mock Campaigns
export const MOCK_CAMPAIGNS: MarketingCampaign[] = [
  {
    id_campaign: 'mcamp_001',
    id_tenant: 'tenant_abc',
    name: 'Boletín Mensual - Diciembre',
    subject: '🎄 Novedades y ofertas especiales de fin de año',
    from_email: 'marketing@empresa.com',
    from_name: 'Equipo Marketing',
    status: 'SENT',
    sent_at: '2025-12-15T10:00:00Z',
    created_at: '2025-12-10T09:00:00Z',
    created_by: 'user_001',
    stats: {
      sent: 1250,
      opened: 320,
      clicked: 85,
      bounced: 3,
      unsubscribed: 2
    }
  },
  {
    id_campaign: 'mcamp_002',
    id_tenant: 'tenant_abc',
    name: 'Lanzamiento Producto Nuevo',
    subject: '🚀 Te presentamos nuestro nuevo servicio premium',
    from_email: 'marketing@empresa.com',
    from_name: 'Equipo Marketing',
    status: 'DRAFT',
    created_at: '2026-01-05T14:30:00Z',
    created_by: 'user_001',
    stats: {
      sent: 0,
      opened: 0,
      clicked: 0
    }
  },
  {
    id_campaign: 'mcamp_003',
    id_tenant: 'tenant_abc',
    name: 'Webinar: Mejores Prácticas 2026',
    subject: '📊 Únete a nuestro webinar exclusivo',
    from_email: 'eventos@empresa.com',
    from_name: 'Eventos Empresa',
    status: 'SCHEDULED',
    scheduled_at: '2026-01-20T09:00:00Z',
    created_at: '2026-01-03T11:00:00Z',
    created_by: 'user_001',
    stats: {
      sent: 0,
      opened: 0,
      clicked: 0
    }
  },
  {
    id_campaign: 'mcamp_004',
    id_tenant: 'tenant_abc',
    name: 'Black Friday 2025',
    subject: '💥 Descuentos de hasta 50% - Solo hoy',
    from_email: 'ventas@empresa.com',
    from_name: 'Ventas',
    status: 'SENT',
    sent_at: '2025-11-29T08:00:00Z',
    created_at: '2025-11-25T10:00:00Z',
    created_by: 'user_001',
    stats: {
      sent: 2100,
      opened: 890,
      clicked: 245,
      bounced: 8,
      unsubscribed: 5
    }
  }
];

// Mock Lists
export const MOCK_LISTS: MarketingList[] = [
  {
    id_list: 'mlist_001',
    id_tenant: 'tenant_abc',
    name: 'Clientes Activos',
    description: 'Clientes que han realizado compras en los últimos 6 meses',
    type: 'DYNAMIC',
    visibility: 'SHARED',
    member_count: 342,
    created_at: '2025-06-15T10:00:00Z',
    created_by: 'user_001'
  },
  {
    id_list: 'mlist_002',
    id_tenant: 'tenant_abc',
    name: 'Prospectos Cualificados',
    description: 'Leads que han mostrado interés pero aún no compran',
    type: 'STATIC',
    visibility: 'PRIVATE',
    member_count: 128,
    created_at: '2025-09-20T14:30:00Z',
    created_by: 'user_001'
  },
  {
    id_list: 'mlist_003',
    id_tenant: 'tenant_abc',
    name: 'Webinar Enero 2026',
    description: 'Registrados para el webinar de mejores prácticas',
    type: 'STATIC',
    visibility: 'PUBLIC',
    member_count: 67,
    created_at: '2026-01-02T09:00:00Z',
    created_by: 'user_002'
  },
  {
    id_list: 'mlist_004',
    id_tenant: 'tenant_abc',
    name: 'Clientes Premium',
    description: 'Clientes con plan premium o enterprise',
    type: 'DYNAMIC',
    visibility: 'SHARED',
    member_count: 45,
    created_at: '2025-03-10T11:00:00Z',
    created_by: 'user_001'
  },
  {
    id_list: 'mlist_005',
    id_tenant: 'tenant_abc',
    name: 'Newsletter General',
    description: 'Suscriptores del boletín mensual',
    type: 'STATIC',
    visibility: 'PUBLIC',
    member_count: 1250,
    created_at: '2024-12-01T08:00:00Z',
    created_by: 'user_001'
  }
];

// Mock List Members
export const MOCK_LIST_MEMBERS: MarketingListMember[] = [
  {
    id_member: 'mem_001',
    id_list: 'mlist_001',
    email: 'ana.garcia@cliente.com',
    first_name: 'Ana',
    last_name: 'García',
    company: 'Tech Solutions SL',
    status: 'ACTIVE',
    added_at: '2025-06-16T10:00:00Z',
    source: 'CRM_SYNC'
  },
  {
    id_member: 'mem_002',
    id_list: 'mlist_001',
    email: 'carlos.rodriguez@empresa.com',
    first_name: 'Carlos',
    last_name: 'Rodríguez',
    company: 'Innovación SA',
    status: 'ACTIVE',
    added_at: '2025-07-22T14:30:00Z',
    source: 'MANUAL'
  },
  {
    id_member: 'mem_003',
    id_list: 'mlist_002',
    email: 'maria.lopez@startup.io',
    first_name: 'María',
    last_name: 'López',
    company: 'StartupHub',
    status: 'ACTIVE',
    added_at: '2025-10-05T09:15:00Z',
    source: 'LANDING_PAGE'
  },
  {
    id_member: 'mem_004',
    id_list: 'mlist_001',
    email: 'pedro.martinez@corp.com',
    first_name: 'Pedro',
    last_name: 'Martínez',
    status: 'UNSUBSCRIBED',
    added_at: '2025-08-12T11:00:00Z',
    source: 'IMPORT'
  }
];

// Mock Integrations
export const MOCK_INTEGRATIONS: MarketingIntegration[] = [
  {
    id_integration: 'int_001',
    id_tenant: 'tenant_abc',
    provider: 'GOOGLE',
    email_connected: 'marketing@empresa.com',
    status: 'CONNECTED',
    connected_at: '2025-05-10T10:00:00Z'
  }
];

// Mock Users for Sharing
export const MOCK_USERS_FOR_SHARING: SharedUser[] = [
  {
    id_user: 'user_002',
    name: 'Laura Sánchez',
    email: 'laura@empresa.com',
    role: 'EDITOR'
  },
  {
    id_user: 'user_003',
    name: 'Miguel Torres',
    email: 'miguel@empresa.com',
    role: 'VIEWER'
  },
  {
    id_user: 'user_004',
    name: 'Sofia Ramírez',
    email: 'sofia@empresa.com',
    role: 'ADMIN'
  }
];
