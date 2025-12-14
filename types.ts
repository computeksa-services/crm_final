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
  country: string;
  city: string;
  address: string;
  website?: string;
  logo_url?: string;
}

// 2. USER (El empleado del Tenant)
export interface User {
  id_user: string;
  id_tenant: string; // Foreign Key a Tenant
  name_user: string;
  email_user: string;
  password?: string;
  phone_user?: string;
  rol_user: 'superadmin' | 'admin' | 'usuario';
  status_user: 'Activo' | 'Inactivo';
  avatar_url?: string;
  job_title?: string;
  
  // Sync Status
  googleConnected: boolean;
  outlookConnected: boolean;
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
}

export interface QuoteStatus {
  id_status: string;
  id_tenant: string;
  name: string; // Renombrado de status_name
  color: string;
  status_order: number;
  is_default: boolean;
  icon: string;
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

// 3. CLIENT COMPANY (La empresa cliente B2B)
export interface ClientCompany {
  id_client_company: string;
  id_tenant: string;
  id_type: 'RUC' | 'CI' | 'PASAPORTE' | 'OTRO';
  id_number: string;
  name_company: string;
  industry?: string;
  address?: string;
  city?: string;
  website?: string;
  phone_company?: string;
  email_company?: string;
  created_by?: string; // ID del usuario que creó el registro
}

// 4. CLIENT CONTACT (La persona de contacto)
export interface ClientContact {
  id_contact: string;
  id_tenant: string;
  id_client_company?: string;
  client_company_name?: string; // Helper
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  position?: string;
}

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
export interface Deal {
  id_trato: string;
  id_tenant: string;
  id_user_owner: string;
  owner_name?: string;
  id_client_company: string;
  client_company_name?: string;
  id_contact: string;
  contact_name?: string;
  nombre_trato: string;
  valor_trato: number;
  id_deal_status: string; // FK a CustomStatus
  estado?: string; // Enriched data from API
  estado_color?: string; // Enriched data from API
  estado_icon?: string; // Enriched data from API
  id_interest_status: string; // FK a CustomStatus where type is 'interest'
  interes?: string; // Enriched data
  interes_color?: string; // Enriched data
  interes_icon?: string; // Enriched data
  created_at: string;
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
  no_cotizacion: number;
  nombre_cotizacion: string;
  fecha_emision: string;
  
  // Relaciones
  id_tenant: string;
  id_user: string;
  id_client_company: string;
  client_company_name?: string;
  id_contact?: string;
  contact_name?: string;
  id_trato?: string;
  id_quote_status?: string; // FK a CustomStatus
  
  estado: string; // Usará el nombre del CustomStatus
  version: number;
  total: number;
  
  // Nuevos campos de detalle
  tiempo_entrega?: string;
  garantia?: string;
  validez_oferta?: string;
  nota?: string;
  
  mensaje?: string;
  correos_adicionales?: string;
  file_generado?: string;
  estado_decision: UserDecision;
  
  // UI triggers
  trigger2: boolean; 
  trigger3: boolean;
}

// 9. QUOTE ITEMS (Artículos de la cotización)
export interface QuoteItem {
  id_quote_item: string;
  id_cotizacion: string;
  id_product?: string;
  descripcion: string; // Snapshot
  cantidad: number;
  precio_unitario: number; // Snapshot
  subtotal: number;
}

export interface CalendarEvent {
  id_evento: string;
  titulo: string;
  descripcion: string;
  fecha_inicio: string; 
  fecha_fin: string; 
  tipo: 'REUNION' | 'LLAMADA' | 'TAREA' | 'DEADLINE';
  id_user: string;
  id_client_company?: string;
  client_company_name?: string;
}