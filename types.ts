export enum UserDecision {
  PENDING = 'PENDIENTE',
  APPROVED = 'APROBADO',
  REJECTED = 'RECHAZADO',
  NEGOCIAR = 'NEGOCIAR'
}

// 1. TENANT (La empresa que usa el software)
export interface Tenant {
  id_tenant: string;
  ruc: string;
  name_tenant: string;
  razon_social?: string;
  country: string;
  city: string;
  address: string;
  website?: string;
  logo_url?: string;
  // Email policy config
  email_policy?: 'INDIVIDUAL' | 'CORPORATE';
  corporate_email_address?: string;
}

// 2. USER (El empleado del Tenant)
export interface User {
  id_user: string;
  id_tenant: string;
  name_user: string;
  name_tenant?: string;
  email_user: string;
  phone_user?: string;
  rol_user: 'superadmin' | 'admin' | 'usuario' | 'owner';
  status_user: 'Activo' | 'Inactivo';
  avatar_url?: string;
  job_title?: string;
  is_owner: boolean;
  module_access: {
    crm: boolean;
    marketing: boolean;
    financials: boolean;
  };
  provider: 'google' | 'microsoft' | null;
  email_connected: string | null;
  sync_calendar: boolean;
  sync_emails: boolean;
  send_emails: boolean;
  watch_active: boolean;
  requires_admin_consent: boolean;
  granted_scopes: string[];
  // ⚠️ Campo opcional para compatibilidad con respuestas del backend que usan estructura anidada
  integrations?: {
    send_emails?: boolean;
    sync_emails?: boolean;
    sync_calendar?: boolean;
    watch_active?: boolean;
    granted_scopes?: string[];
  };
}

// NUEVA INTERFAZ PARA TIPOS DE PRODUCTO
export interface ProductType {
  id_product_type: string;
  id_tenant: string;
  type: string;
}

// INTERFACES PARA ESTADOS PERSONALIZADOS
export interface DealStatus {
  id_status: string;
  id_tenant: string;
  name: string; // Renombrado de status_name
  color: string;
  status_order: number;
  is_default: boolean;
  icon: string;
  status_category?: 'DRAFT' | 'PROGRESS' | 'PAUSED' | 'WON' | 'LOST';
  notify_client?: boolean; // Flag para enviar notificación al cliente por correo
}

export interface QuoteStatus {
  id_status: string;
  id_tenant: string;
  name: string; // Renombrado de status_name
  color: string;
  status_order: number;
  is_default: boolean;
  icon: string;
  status_category?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
}

// NUEVA INTERFAZ PARA INTERESES DE TRATOS
export interface DealInterest {
  id_interest: string; // Corregido de id_deal_interest
  id_tenant: string;
  name: string;
  color: string;
  icon: string;
  status_order: number;
  is_default: boolean;
}

export interface DealChannel {
  id_channel: string;
  id_tenant: string;
  name: string;
  color: string;
  icon: string;
  status_order: number;
  is_default: boolean;
}

// 3. CLIENT COMPANY (La empresa cliente B2B)
export interface ClientCompany {
  id_client_company: string;
  id_tenant: string;
  id_type: 'RUC' | 'CI' | 'PASAPORTE' | 'IDENTIFICACION DEL EXTERIOR' | 'OTRO';
  id_number: string;
  name_company: string;
  razon_social?: string;
  industry?: string;
  address?: string;
  city?: string;
  website?: string;
  phone_company?: string;
  email_company?: string;
  created_by?: string; // ID del usuario que creó el registro
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
  id_country?: string; // ID del país
  id_company_type?: string; // ID del tipo de empresa
  id_company_size?: string; // ID del tamaño de empresa
  id_label?: string; // ID de la etiqueta
  // Campos calculados por el backend
  created_by_name?: string;
  created_by_avatar?: string;
  country_name?: string;
  company_type_name?: string;
  company_size?: string;
  label_name?: string;
  label_color?: string;
}

// 4. CLIENT CONTACT (La persona de contacto)
export interface ClientContact {
      category_color?: string;
      category_icon?: string;
      status_category_label?: string;
      last_management_date?: string;
      last_management_desc?: string;
    company_details?: {
      id: string;
      name: string;
      city?: string;
      created_by?: string;
    };
  id_contact: string;
  id_entity?: string; // Desde API unificado
  id_tenant: string;
  entity_type: 'CONTACT';
  id_client_company?: string;
  name_company?: string;
  client_company_name?: string;
  created_by?: string;
  access_level?: 'VIEW' | 'EDIT';
  first_name?: string; // Desde API: usa 'title'
  title?: string; // Nuevo campo del API
  last_name?: string;
  subtitle?: string; // Nombre de empresa desde API
  email?: string;
  phone?: string;
  position?: string;
  contact_status?: 'LEAD' | 'ACTIVE' | 'DORMANT';
  next_contact_date?: string | null;
  next_action_desc?: string;
  last_contact_date?: string;
  last_note?: string | null; // Último comentario/nota
  assigned_user_name?: string;
  company_labels?: string[];
  last_interaction_description?: string;
  owner_avatar?: string;
  owner_name?: string;
  last_interactor_name?: string;
  days_inactive?: number;
  total_interactions?: string;
  current_status_name?: string; // Nuevo: nombre del estado
  current_status_color?: string; // Nuevo: color del estado
  current_status_icon?: string; // Nuevo: icono del estado
  status_category?: 'LEAD' | 'ACTIVE' | 'DORMANT'; // Nuevo: categoría del estado
  collaborators?: Array<{
    id?: string;
    id_user?: string;
    access_level?: string;
    permission_level?: string;
    is_owner?: boolean;
  }>;
}

// NUEVA INTERFAZ PARA TRATOS EN EL PANEL DE SEGUIMIENTO
export interface DealFollowUpItem {
    category_color?: string;
    category_icon?: string;
    status_category_label?: string;
    last_management_date?: string;
    last_management_desc?: string;
    last_management_user_id?: string;
    last_management_user_name?: string;
    last_management_user_avatar?: string;
    last_management_channel_icon?: string;
    last_management_channel_color?: string;
  id_entity: string; // ID del trato desde el backend
  id_trato?: string; // Compatibilidad
  id_tenant?: string;
  entity_type: 'DEAL';
  title: string; // Nombre del trato
  nombre_trato?: string; // Compatibilidad
  subtitle?: string; // Nombre de la empresa
  contact_name?: string; // Nombre del contacto principal
  valor_trato?: number | string;
  client_company_name?: string;
  contact_full_name?: string;
  email?: string; // Email del contacto principal
  phone?: string; // Teléfono del contacto principal
  owner_name?: string;
  owner_avatar?: string;
  next_contact_date?: string | null;
  next_action_desc?: string;
  last_note?: string | null;
  last_contact_date?: string;
  days_inactive?: number;
  total_interactions?: string;
  is_high_priority?: boolean;
  current_status_name: string;
  current_status_color: string;
  current_status_icon?: string; // Opcional: icon del estado
  status_category: 'DRAFT' | 'PROGRESS' | 'WON' | 'LOST' | 'LEAD';
  id_client_company?: string;
  id_contact?: string;
  id_status?: string;
  collaborators?: Array<{
    id?: string;
    id_user?: string;
    access_level?: string;
    permission_level?: string;
    is_owner?: boolean;
  }>;
}

// TIPO DE UNIÓN PARA EL PANEL DE SEGUIMIENTO
export type FollowUpItem = ClientContact | DealFollowUpItem;

// 5. PRODUCT (Catálogo de Productos/Servicios)
export interface Product {
    id_product: string;
    id_tenant: string;
    codigo: string;
    tipo: 'BIEN' | 'SERVICIO';
    categoria?: string;
    descripcion: string;
    precio_unitario: number;
    imagen_url?: string; // Base64
}

// 6. CUSTOM STATUS (Estados personalizables)
export interface CustomStatus {
    id_status: string;
    id_tenant: string;
    type: 'deal' | 'quote' | 'interest'; // To distinguish status types
    name: string;
    color?: string;
    status_order?: number;
    icon?: string; // Nuevo campo para el icono
    is_default?: boolean;
}

// 7. TRATOS (DEALS)

// Estructura para un item del timeline unificado
export interface UnifiedTimelineItem {
  id: string;
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'SYSTEM' | 'QUOTE_SENT';
  date_fmt: string;
  date_raw: string;
  user_name: string;
  description: string;
  next_action?: string | null;
  user_avatar: string;
  is_deal_interaction: boolean;
}

export interface Deal {
    archived?: boolean;
  id_trato: string;
  nombre_trato: string;
  valor_numeric?: string;
  valor_trato?: number | string;
  id_tenant: string;
  owner_id: string;
  channel?: string | null;
  deal_description?: string;
  created_at_fmt: string;
  updated_at_fmt: string;

  estado_actual: {
    id: string;
    icon: string;
    name: string;
    color: string;
    category: string;
  };

  interes_actual: {
    id: string;
    icon: string;
    name: string;
    color: string;
  };

  owner_details: {
    name: string;
    email: string;
    avatar: string;
  };

  empresa_cliente: {
    id: string;
    city: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };

  contacto_cliente: {
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
  };

  catalogo_estados: DealStatus[];
  catalogo_intereses: DealInterest[];

  // A mantener por si se usan en otras partes
  id_user_owner?: string;
  id_user?: string;
  id_client_company?: string;
  id_contact?: string;
  id_deal_status?: string;
  id_interest?: string;
  descripcion?: string;
  access_level?: 'VIEW' | 'EDIT';

  // El nuevo timeline
  timeline_unificado: UnifiedTimelineItem[];

  // Campos que pueden seguir llegando o usados en UI
  client_company_name?: string;
  contact_full_name?: string;
  owner_name?: string;
  owner_avatar?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_position?: string;
  interes_icon?: string;
  interes_color?: string;
  interes_nombre?: string;
  updated_at?: string;
}

export interface DealPermission {
    id_permission: string;
    id_trato: string;
    id_user: string;
    user_name?: string;
    permission_level: 'read' | 'write';
}

// 8. COTIZACIONES (QUOTES)
export interface Quote {
  id_cotizacion: string;
  id_tenant: string;
  id_user: string; // Vendedor/Owner
  id_client_company: string;
  id_contact: string;
  no_cotizacion: number;
  nombre_cotizacion: string;
  fecha_emision: string; // ISO Date String
  estado_decision: UserDecision; // PENDIENTE, APROBADO, RECHAZADO
  total: string; // Viene como string tipo "$0.00"
  version: number;
  mensaje?: string;
  correos_adicionales?: string | null;
  file_generado?: string | null; // URL del PDF generado
  created_at: string;
  updated_at: string;
  id_quote_status: string;
  tiempo_entrega?: string;
  garantia?: string;
  validez_oferta?: string;
  nota?: string;
  condicion_pago?: string; // Nueva: Contado | 15 días | 30 días | 60 días | 90 días | Otro
  id_trato?: string | null;
  is_private?: boolean; // Si es privada (no sigue permisos compartidos)
  
  // Campos derivados (JOINs en el backend)
  created_at_fmt?: string; // Fecha de creación formateada "12/12/2025 00:00"
  fecha_emision_fmt?: string; // Fecha de emisión formateada "12/12/2025"
  formatted_no_cotizacion?: string; // Número de cotización formateado (ej. 001, 002)
  estado?: string; // Nombre del estado de la cotización (legacy)
  estado_nombre?: string; // Nuevo formato backend
  estado_color?: string; // Color del estado de la cotización
  estado_icon?: string; // Icono del estado
  contact_name?: string; // Legacy
  contact_full_name?: string; // Nuevo formato "Pablo Luna"
  contact_email?: string;
  client_company_name?: string;
  client_company_ruc?: string;
  client_company_address?: string;
  client_company_email?: string;
  owner_name?: string; // Nombre del vendedor (legacy)
  created_by_name?: string; // Nuevo formato backend
  created_by_email?: string;
  created_by_avatar?: string;
  nombre_trato?: string; // Nombre del trato asociado (legacy)
  deal_name?: string; // Nuevo formato backend
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
  created_by?: string; // ID del usuario creador
  days_inactive?: number; // Días sin actividad desde el último envío

  // Nuevos campos desde la respuesta optimizada de detail endpoint
  items?: QuoteItem[]; // Artículos de la cotización
  versions?: PdfVersion[]; // Versiones de PDF generadas
  available_statuses?: QuoteStatus[]; // Estados disponibles
  status_detail?: QuoteStatus; // Estado actual detallado
  owner_detail?: {
    name: string;
    email: string;
    avatar: string;
  };
  company_detail?: ClientCompany;
  contact_detail?: {
    id: string;
    email: string;
    phone: string;
    full_name: string;
  };
  deal_detail?: {
    id: string;
    name: string;
    value: string;
    owner_id: string;
  };
  
  // Historial de envíos de cotización
  sent_history?: Array<{
    id_sent?: string;
    sent_at_fmt?: string; // DD/MM/YYYY HH:MI
    sent_by_name?: string; // Nombre del usuario que envió
    sent_to?: string; // Email destinatario
    sent_cc?: string | null; // CC (puede ser null)
    subject?: string | null; // Asunto (puede ser null)
    method?: string; // 'EMAIL', etc
    email_policy?: string | null; // 'CORPORATE' | 'INDIVIDUAL' (puede ser null)
    version_enviada?: number; // Versión que se envió
  }>;
}

// 9. FINANCIAL TRANSACTIONS (Transacciones financieras)
export interface FinancialTransaction {
  id_transaction: string;
  id_tenant: string;
  created_by: string;
  id_client_company?: string;
  id_related_quote?: string;
  transaction_type: 'VENTA' | 'GASTO' | 'OTRO';
  status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO';
  invoice_number: string;
  description: string;
  invoice_date: string; // Fecha de la factura real
  issue_date: string; // ISO Date (deprecated, usar invoice_date)
  credit_days?: number;
  due_date?: string; // ISO Date (autocalculado: invoice_date + credit_days)
  payment_date?: string; // ISO Date
  subtotal?: number;
  tax_amount?: number; // Porcentaje de IVA (ej: 15 para 15%)
  total_value?: number;
  has_retention?: boolean; // Indica si hay retención
  retention_number?: string;
  retention_date?: string; // ISO Date
  retention_value?: number;
  paid_amount?: number;
  payment_method?: string;
  payment_reference?: string;
  invoice_file_url?: string;
  retention_file_url?: string;
  is_urgent?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;

  // Campos derivados (JOINs)
  client_company_name?: string;
  created_by_name?: string;
  quote_number?: string;
  balance?: number; // total_value - paid_amount
  balance_due?: number;
  days_until_due?: number;
  payment_status_code?: string;
  payment_status_label?: string;
  issue_date_input?: string;
  due_date_input?: string;
  payment_date_input?: string;
  retention_date_input?: string;

  // Recordatorios automáticos de cobranza (automations)
  enable_automation?: boolean;
  automation_frequency?: number; // Frecuencia en días
  automation_recipients?: Array<{
    id: string | null;
    name: string;
    type: 'contact' | 'team' | 'external';
    email: string;
  }>;
  next_reminder_label?: string; // Texto formateado del próximo recordatorio (mapeado de v_proximo_recordatorio)

  // Historial de notificaciones manuales o automáticas
  notification_logs?: Array<{
    tipo?: string;
    fecha?: string;
    enviado_por?: string;
    estado_envio?: string;
    destinatarios?: string;
  }>;
}

// 10. QUOTE ITEMS (Artículos de la cotización)
export interface QuoteItem {
  id_quote_item?: string;
  id_articulo_cot?: string; // Campo alternativo usado por el API
  id_cotizacion: string;
  id_product?: string;
  descripcion: string; // Snapshot
  codigo?: string; // Código del producto
  cantidad: number;
  precio_unitario: number; // Snapshot
  subtotal: number;
}

// PDF VERSION (Versión PDF de una cotización)
export interface PdfVersion {
  id_version?: string;
  id_cotizacion?: string;
  file_url: string;
  version_number: number;
  created_at: string;
  created_by?: string;
  generado_por?: string;
  avatar_url?: string;
  creator_name?: string;
  sent_at?: string | null;
  is_approved?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string; 
  end: string;
  allDay: boolean;
  type: 'REUNION' | 'LLAMADA' | 'TAREA' | 'DEADLINE';
  meeting_url?: string | null;
  meeting_platform?: 'GOOGLE_MEET' | 'ZOOM' | 'TEAMS' | 'NONE';
  color?: string;
  deal_title?: string | null;
  deal_id?: string | null;
  quote_number?: string | null;
  quote_id?: string | null;
  attendees?: Array<{
    email: string;
    avatar?: string | null;
    status: 'needsAction' | 'accepted' | 'declined' | 'tentative';
    is_organizer: boolean;
  }>;
}

// --- MARKETING MODULE TYPES ---
export interface MarketingList {
  // API devuelve id_list; normalizamos manteniendo list_id como alias
  id_list?: string;
  list_id?: string;
  tenant_id?: string;
  id_tenant?: string;
  name: string;
  description?: string;
  visibility: 'PRIVATE' | 'PUBLIC_TENANT';
  type?: 'STATIC' | 'DYNAMIC';
  member_count: number | string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

export interface ListMember {
  id_member?: string;
  id_contact: string;
  id_list?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string; // Nuevo: nombre completo desde backend
  status?: 'ACTIVE' | 'UNSUBSCRIBED' | 'SUBSCRIBED'; // Agregado SUBSCRIBED
  added_at?: string;
  joined_at?: string; // Nuevo: fecha de ingreso
  position?: string;
  id_client_company?: string; // Nuevo: ID de la empresa
  company_name?: string; // Nuevo: nombre de la empresa
  company_city?: string; // Nuevo: ciudad de la empresa
}

export interface MarketingCampaign {
  id_campaign: string;
  id_tenant: string;
  name: string;
  subject: string;
  preview_text?: string;
  html_content: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'PAUSED' | 'PROCESSING' | 'SENDING' | 'FAILED' | 'COMPLETED' | 'PAUSE';
  scheduled_at?: string;
  scheduled_at_local?: string; // hora local calculada por backend
  schedule_timezone?: string; // zona horaria asociada a la programación
  sent_at?: string;
  sender_type: 'USER' | 'TENANT';
  sender_name?: string;
  sender_email?: string;
  id_sender_integration?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  attachments?: Array<{
    file_name: string;
    file_url: string;
  }>;
  // Campos opcionales calculados/joined que vienen de la API
  recipient_count?: number | string;
  open_count?: number | string;
  click_count?: number | string;
  open_rate?: number | string;
  created_by_name?: string;
  avatar_url?: string;
  total_audience?: string | number;
  target_lists?: string[] | string; // puede ser array o string "Sin listas asignadas"
  target_lists_display?: string;
  sent_count?: string | number;
  failed_count?: string | number;
  // Campos adicionales según la nueva respuesta del API de campañas
  total_target?: string | number;
  processed_count?: string | number;
  remaining_count?: string | number;
  successful_sents?: string | number;
  failed_sents?: string | number;
  unique_opens?: string | number;
  unique_clicks?: string | number;
  progress_percentage?: string | number;
  chart_data?: Array<{
    time: string;
    opens: number;
    clicks: number;
  }>;
}

export interface CampaignTemplate {
  template_id: string;
  tenant_id: string;
  name: string;
  subject: string;
  html_content: string;
  created_at: string;
  is_default?: boolean;
}
