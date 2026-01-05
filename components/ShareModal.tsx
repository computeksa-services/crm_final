import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type PermissionLevel = 'VIEW' | 'EDIT';

interface ShareModalProps {
  entity: 'deal' | 'quotes';
  id: string; // id_trato or id_cotizacion
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
  excludeUserIds?: string[]; // usuarios que ya tienen permisos o no deben mostrarse
}

const ShareModal: React.FC<ShareModalProps> = ({ entity, id, isOpen, onClose, onShared, excludeUserIds = [] }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<Array<{ id_user: string; name_user: string }>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [level, setLevel] = useState<PermissionLevel>('VIEW');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isOpen || !user?.id_tenant || !user?.id_user) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];
        // Filtrar: no mostrar al propio usuario ni los excluidos
        const filtered = Array.isArray(data)
          ? data.filter((u: { id_user: string }) => u.id_user !== user.id_user && !excludeUserIds.includes(u.id_user))
          : [];
        setUsers(filtered);
        setSelectedUserIds([]);
      } catch {
        setUsers([]);
      }
    };
    loadUsers();
  }, [isOpen, user]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id_tenant || selectedUserIds.length === 0) return;
    setSubmitting(true);
    
    try {
      // Compartir con todos los usuarios seleccionados
      const sharePromises = selectedUserIds.map(targetUserId => {
        const url = entity === 'deal'
          ? `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`
          : `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share`;
        const payload = entity === 'deal'
          ? { id_tenant: user.id_tenant, id_trato: id, id_user_target: targetUserId, permission_level: level }
          : { id_tenant: user.id_tenant, id_cotizacion: id, id_user_target: targetUserId, permission_level: level };
        
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      });

      const results = await Promise.all(sharePromises);
      const hasErrors = results.some(res => !res.ok);
      
      if (hasErrors) {
        throw new Error('Error al compartir con algunos usuarios.');
      }

      onShared && onShared();
      onClose();
    } catch (e) {
      console.error(e);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const getEntityLabel = () => {
    return entity === 'deal' ? 'Trato' : 'Cotización';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">COMPARTIR {getEntityLabel().toUpperCase()}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Multi-select para usuarios */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Usuario</label>
            <div className="border rounded-lg bg-white p-3 min-h-24 max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No hay usuarios disponibles</p>
              ) : (
                <div className="space-y-2">
                  {users.map(u => (
                    <label key={u.id_user} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id_user)}
                        onChange={() => toggleUserSelection(u.id_user)}
                        className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                      />
                      <span className="ml-3 text-sm text-slate-700">{u.name_user}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedUserIds.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Puedes elegir varios usuarios (Ctrl/Cmd + clic).
              </p>
            )}
          </div>

          {/* Selección de permisos */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-3 uppercase">Permiso</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLevel('VIEW')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  level === 'VIEW'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Solo ver
              </button>
              <button
                type="button"
                onClick={() => setLevel('EDIT')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  level === 'EDIT'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Puede editar
              </button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || selectedUserIds.length === 0}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
              Compartir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareModal;
