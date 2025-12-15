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
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
}

// 4. CLIENT CONTACT (La persona de contacto)
export interface ClientContact {
  id_contact: string;
  id_tenant: string;
  id_client_company?: string;
  client_company_name?: string; // Helper
  created_by?: string;
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
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
  id_user_owner: string; // Propietario del trato (legacy, usar id_user)
  id_user: string; // Propietario del trato
  id_client_company: string;
  id_contact: string;
  id_deal_status: string;
  id_interest: string;
  nombre_trato: string;
  valor_trato: number | string; // Puede venir como "$1,000.00" o number
  fecha_creacion?: string; // ISO Date String
  created_at?: string; // ISO Date String (nuevo formato backend)
  created_at_fmt?: string; // Fecha formateada "12/12/2025 20:24"
  fecha_cierre_esperada?: string; // ISO Date String
  descripcion?: string;
  created_by?: string; // ID del usuario que creó el trato
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
  
  // Campos derivados (JOINs en el backend)
  client_company_name?: string;
  contact_name?: string; // Legacy
  contact_full_name?: string; // Nuevo formato "Pablo Luna"
  contact_email?: string;
  contact_phone?: string;
  owner_name?: string; // Nombre del propietario
  owner_avatar?: string; // Avatar del propietario
  estado?: string; // Nombre del estado del trato (legacy)
  estado_nombre?: string; // Nuevo formato backend
  estado_color?: string; // Color del estado del trato
  estado_icon?: string; // Icono del estado del trato
  interes?: string; // Nombre del nivel de interés (legacy)
  interes_nombre?: string; // Nuevo formato backend
  interes_color?: string; // Color del nivel de interés
  interes_icon?: string; // Icono del nivel de interés
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
  id_trato?: string | null;
  is_private?: boolean; // Si es privada (no sigue permisos compartidos)
  
  // Campos derivados (JOINs en el backend)
  created_at_fmt?: string; // Fecha de creación formateada "12/12/2025 00:00"
  fecha_emision_fmt?: string; // Fecha de emisión formateada "12/12/2025"
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
  formatted_no_cotizacion?: string; // Número de cotización formateado (ej. 001, 002)
  access_level?: 'VIEW' | 'EDIT'; // Nivel de acceso calculado por backend
  created_by?: string; // ID del usuario creador
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