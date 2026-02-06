import { User } from '../types';

/**
 * Tipo de acciones sobre registros
 */
export type RecordAction = 'edit' | 'delete' | 'share' | 'view';

/**
 * Tipo de acceso a un registro
 */
export type AccessLevel = 'EDIT' | 'VIEW' | 'NONE' | 'OWNER';

/**
 * Interfaz base para un registro con permisos
 */
export interface RecordWithPermissions {
  access_level?: AccessLevel | string;
  created_by?: string;
  id_user_owner?: string;
  is_owner?: boolean;
  collaborators?: Array<{
    id: string;
    is_owner?: boolean;
    access_level?: string;
  }>;
}

/**
 * Determina si un usuario puede realizar una acción sobre un registro
 * 
 * Jerarquía de permisos:
 * 1. Superadmin: puede todo
 * 2. Admin: puede todo dentro de su tenant
 * 3. Owner (tenant): puede todo dentro de su tenant
 * 4. Usuario regular: depende de access_level del registro
 * 
 * @param user - Usuario actual (AuthContext)
 * @param record - Registro con información de permisos
 * @param action - Acción que se quiere realizar
 * @returns true si el usuario puede realizar la acción
 */
export function canUserAction(
  user: User | null | undefined,
  record: RecordWithPermissions | null | undefined,
  action: RecordAction
): boolean {
  // Sin usuario o sin registro, no hay permiso
  if (!user || !record) return false;

  // Superadmin puede todo
  if (user.rol_user === 'superadmin') return true;

  // Admin puede todo dentro de su tenant
  if (user.rol_user === 'admin') return true;

  // Owner del tenant puede todo
  if (user.is_owner === true) return true;

  // Si el usuario es el creador del registro, puede todo
  const isCreator = record.created_by === user.id_user || 
                    record.id_user_owner === user.id_user ||
                    record.collaborators?.some(c => c.id === user.id_user && c.is_owner === true);
  
  if (isCreator) return true;

  // Para usuarios regulares, depende del access_level y la acción
  const accessLevel = record.access_level?.toUpperCase();

  switch (action) {
    case 'view':
      // Puede ver si tiene EDIT o VIEW
      return accessLevel === 'EDIT' || accessLevel === 'VIEW' || accessLevel === 'OWNER';

    case 'edit':
      // Solo puede editar con EDIT o OWNER
      return accessLevel === 'EDIT' || accessLevel === 'OWNER';

    case 'delete':
      // Solo puede eliminar si es creador (ya validado arriba) o tiene EDIT
      return accessLevel === 'EDIT' || accessLevel === 'OWNER';

    case 'share':
      // Solo puede compartir si es creador (ya validado arriba) o tiene EDIT
      return accessLevel === 'EDIT' || accessLevel === 'OWNER';

    default:
      return false;
  }
}

/**
 * Determina si un usuario puede editar campos inline (status, interest, etc)
 * 
 * @param user - Usuario actual
 * @param record - Registro con permisos
 * @returns true si puede editar inline
 */
export function canEditInline(
  user: User | null | undefined,
  record: RecordWithPermissions | null | undefined
): boolean {
  return canUserAction(user, record, 'edit');
}

/**
 * Obtiene un mensaje descriptivo del nivel de acceso
 * 
 * @param accessLevel - Nivel de acceso del registro
 * @returns Mensaje legible
 */
export function getAccessLevelLabel(accessLevel?: AccessLevel | string): string {
  switch (accessLevel?.toUpperCase()) {
    case 'OWNER':
      return 'Propietario';
    case 'EDIT':
      return 'Puede Editar';
    case 'VIEW':
      return 'Solo Ver';
    case 'NONE':
    case 'BLOCKED':
      return 'Sin Acceso';
    default:
      return 'Desconocido';
  }
}

/**
 * Obtiene el color del badge según el nivel de acceso
 * 
 * @param accessLevel - Nivel de acceso
 * @returns Clases de Tailwind para el badge
 */
export function getAccessLevelBadgeClasses(accessLevel?: AccessLevel | string): string {
  switch (accessLevel?.toUpperCase()) {
    case 'OWNER':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'EDIT':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'VIEW':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'NONE':
    case 'BLOCKED':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}
