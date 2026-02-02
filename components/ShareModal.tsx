import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';

type PermissionLevel = 'VIEW' | 'EDIT' | 'BLOCKED';

interface ShareModalProps {
  entity: 'deal' | 'quotes' | 'company' | 'contact';
  id: string; // id_trato or id_cotizacion
  entityName?: string;
  creatorName?: string;
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
  currentCollaborators?: Array<{ id_user: string; name: string; permission_level: string; avatar?: string; rol_user?: string; is_owner?: boolean }>; // colaboradores actuales
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  entity, 
  id, 
  entityName,
  creatorName,
  isOpen, 
  onClose, 
  onShared, 
  currentCollaborators = []
}) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Array<{ id_user: string; name: string; permission_level: PermissionLevel; avatar?: string; rol_user?: string; isOwner?: boolean }>>([]);
  const [collaboratorPermissions, setCollaboratorPermissions] = useState<Record<string, PermissionLevel>>({});
  const [initialPermissions, setInitialPermissions] = useState<Record<string, PermissionLevel>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !user?.id_tenant || !user?.id_user) return;
      const fetchKey = `${entity}:${id}`;
      if (lastFetchKeyRef.current === fetchKey) return;
      lastFetchKeyRef.current = fetchKey;
      setLoading(true);
      try {
        const resolvedCollaborators = currentCollaborators.map(collab => {
          const level = (collab.permission_level || '').toString().toUpperCase();
          const isOwner = level === 'OWNER' || !!collab.is_owner;
          return {
            id_user: collab.id_user,
            name: collab.name,
            permission_level: (isOwner || level === 'EDIT'
              ? 'EDIT'
              : (level === 'BLOCKED' || level === 'NONE')
                ? 'BLOCKED'
                : 'VIEW') as PermissionLevel,
            avatar: collab.avatar,
            rol_user: collab.rol_user,
            isOwner
          };
        });

        let merged = [...resolvedCollaborators];
        try {
          const usersRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const activeUsers = Array.isArray(usersData)
              ? usersData.filter((u: any) => u.status_user !== 'Inactivo')
              : [];
            const existingIds = new Set(merged.map(c => c.id_user));
            activeUsers.forEach((u: any) => {
              if (existingIds.has(u.id_user)) return;
              merged.push({
                id_user: u.id_user,
                name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
                permission_level: 'BLOCKED',
                avatar: u.avatar_url || u.avatar || null,
                rol_user: u.rol_user,
                isOwner: false
              });
            });
          }
        } catch {}

        const permissionRank = (p: PermissionLevel) => (p === 'EDIT' ? 0 : p === 'VIEW' ? 1 : 2);
        merged = merged.sort((a, b) => {
          if (a.isOwner !== b.isOwner) return Number(b.isOwner) - Number(a.isOwner);
          return permissionRank(a.permission_level) - permissionRank(b.permission_level);
        });

        setCollaborators(merged);

        const perms: Record<string, PermissionLevel> = {};
        merged.forEach(collab => {
          const level = (collab.permission_level || '').toString().toUpperCase();
          perms[collab.id_user] = (collab.isOwner || level === 'EDIT'
            ? 'EDIT'
            : (level === 'BLOCKED' || level === 'NONE')
              ? 'BLOCKED'
              : 'VIEW') as PermissionLevel;
        });
        setCollaboratorPermissions(perms);
        setInitialPermissions(perms);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, user?.id_tenant, user?.id_user, entity, id, currentCollaborators]);

  useEffect(() => {
    if (!isOpen) {
      lastFetchKeyRef.current = null;
    }
  }, [isOpen]);

  const handleChangePermission = (userId: string, permission: PermissionLevel) => {
    setCollaboratorPermissions(prev => ({
      ...prev,
      [userId]: permission
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id_tenant) return;
    setSubmitting(true);

    try {
      if (entity === 'quotes' || entity === 'deal' || entity === 'company' || entity === 'contact') {
        const permissions = Object.entries(collaboratorPermissions).map(([userId, permission]) => ({
          id_user: userId,
          permission_level: permission === 'BLOCKED' ? 'NONE' : permission
        }));

        const endpoint = entity === 'deal'
          ? `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`
          : entity === 'quotes'
            ? `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share`
            : entity === 'company'
              ? `${import.meta.env.VITE_WEBHOOK_URL}/api/companies/share`
              : `${import.meta.env.VITE_WEBHOOK_URL}/api/contacts/share`;

        const payload = entity === 'deal'
          ? { id_trato: id, permissions }
          : entity === 'quotes'
            ? { id_cotizacion: id, permissions }
            : entity === 'company'
              ? { id_client_company: id, permissions }
              : { id_contact: id, permissions };

        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Error al actualizar permisos.');
      } else {
        const promises: Promise<Response>[] = [];

        // 1. Actualizar permisos de colaboradores existentes (solo si hubo cambios)
        Object.entries(collaboratorPermissions).forEach(([userId, permission]) => {
          const collab = collaborators.find(c => c.id_user === userId);
          if (collab?.isOwner) return;
          const initial = initialPermissions[userId];
          if (permission === initial) return;

          if (permission === 'BLOCKED') {
            const deleteUrl = entity === 'deal'
              ? `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share/delete`
              : `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share/delete`;
            const deletePayload = entity === 'deal'
              ? { id_tenant: user.id_tenant, id_trato: id, id_user: userId }
              : { id_tenant: user.id_tenant, id_cotizacion: id, id_user: userId };

            promises.push(apiFetch(deleteUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deletePayload),
            }));
            return;
          }

          const url = entity === 'deal'
            ? `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`
            : `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share`;
          const payload = entity === 'deal'
            ? { id_tenant: user.id_tenant, id_trato: id, id_user_target: userId, permission_level: permission }
            : { id_tenant: user.id_tenant, id_cotizacion: id, id_user_target: userId, permission_level: permission };

          promises.push(apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }));
        });

        if (promises.length > 0) {
          const results = await Promise.all(promises);
          const hasErrors = results.some(res => !res.ok);

          if (hasErrors) {
            throw new Error('Error al actualizar permisos.');
          }
        }
      }

      onShared && onShared();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const getEntityLabel = () => {
    if (entity === 'deal') return 'Trato';
    if (entity === 'quotes') return 'Cotización';
    if (entity === 'company') return 'Empresa';
    return 'Contacto';
  };

  const hasPermissionChanges = Object.keys(collaboratorPermissions).some((userId) => {
    const current = collaboratorPermissions[userId];
    const initial = initialPermissions[userId];
    return current !== initial;
  });

  const hasChanges = hasPermissionChanges;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-500 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-400 bg-white dark:bg-slate-500 flex justify-between items-start gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-share-nodes text-sm"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">Asignar {getEntityLabel()}</h2>
              {entityName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[300px] sm:max-w-[420px]">{entityName}</p>
              )}
              {creatorName && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Creado por: {creatorName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* COLABORADORES ACTUALES */}
            {Object.keys(collaboratorPermissions).length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-users text-indigo-600"></i>
                  Asignaciones
                </h3>
                {/* VISTA DESKTOP - TABLA */}
                <div className="hidden sm:block border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_100px_100px_100px] bg-slate-50 dark:bg-slate-400 text-[11px] font-bold text-slate-500 dark:text-slate-900 uppercase tracking-wider">
                    <div className="px-4 py-2">Colaborador</div>
                    <div className="px-2 py-2 text-center">Principal</div>
                    <div className="px-2 py-2 text-center">Secundario</div>
                    <div className="px-2 py-2 text-center">Sin asignación</div>
                  </div>
                  {Object.entries(collaboratorPermissions).map(([userId, permission]) => {
                    const collab = collaborators.find(c => c.id_user === userId);
                    const isAdmin = (collab?.rol_user || '').toLowerCase() === 'admin';
                    const isOwner = !!collab?.isOwner;
                    return (
                      <div key={userId} className="grid grid-cols-[1fr_100px_100px_100px] items-center border-t border-slate-100 dark:border-slate-700">
                        <div className="px-4 py-3 flex items-center gap-3 min-w-0">
                          {collab?.avatar ? (
                            <img src={collab.avatar} alt={collab.name} className="w-7 h-7 rounded-full border border-slate-200 object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {(collab?.name || 'U').charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex items-center gap-2">
                              {collab?.name || userId}
                              {isOwner && (
                                <span className="text-[10px] text-slate-400">(Creador)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="px-2 py-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'EDIT')}
                            disabled={isOwner}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                              permission === 'EDIT'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                        </div>
                        <div className="px-2 py-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'VIEW')}
                            disabled={isOwner}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                              permission === 'VIEW'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-slate-400 border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-900 hover:border-blue-200 dark:hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                        </div>
                        <div className="px-2 py-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'BLOCKED')}
                            disabled={isOwner}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                              permission === 'BLOCKED'
                                ? 'bg-red-600 text-white'
                                : 'bg-white dark:bg-slate-400 border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-900 hover:border-red-200 dark:hover:border-red-300 hover:text-red-600 dark:hover:text-red-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-lock"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* VISTA MÓVIL - TARJETAS */}
                <div className="sm:hidden space-y-3">
                  {Object.entries(collaboratorPermissions).map(([userId, permission]) => {
                    const collab = collaborators.find(c => c.id_user === userId);
                    const isOwner = !!collab?.isOwner;
                    return (
                      <div key={userId} className="border border-slate-200 dark:border-slate-400 rounded-lg p-4 space-y-3 bg-white dark:bg-slate-400">
                        <div className="flex items-center gap-3 min-w-0">
                          {collab?.avatar ? (
                            <img src={collab.avatar} alt={collab.name} className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {(collab?.name || 'U').charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {collab?.name || userId}
                            </p>
                            {isOwner && (
                              <p className="text-[10px] text-slate-400">Creador</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-between">
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'EDIT')}
                            disabled={isOwner}
                            className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              permission === 'EDIT'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'VIEW')}
                            disabled={isOwner}
                            className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              permission === 'VIEW'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-eye text-xs"></i>
                            <span>Ver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangePermission(userId, 'BLOCKED')}
                            disabled={isOwner}
                            className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              permission === 'BLOCKED'
                                ? 'bg-red-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600'
                            } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <i className="fa-solid fa-lock text-xs"></i>
                            <span>Bloquear</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Object.keys(collaboratorPermissions).length === 0 && (
              <div className="text-center py-8">
                <i className="fa-solid fa-users text-4xl text-slate-200 mb-2"></i>
                <p className="text-slate-400 text-sm">No hay usuarios asignados</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-400 bg-slate-50 dark:bg-slate-400 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !hasChanges}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span className="hidden sm:inline">Guardando...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i>
                  <span className="hidden sm:inline">Guardar Cambios</span>
                  <span className="sm:hidden">Guardar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareModal;
