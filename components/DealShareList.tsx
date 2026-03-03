import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import Toast from './Toast';
import ConfirmModal from '../components/ConfirmModal';

interface SharedUser {
  id_user: string;
  name_user: string;
  email: string;
  permission_level: string;
}

interface DealShareListProps {
  id_trato: string;
  refreshTrigger?: number;
  compact?: boolean;
  onEmptyAction?: () => void;
}

const DealShareList: React.FC<DealShareListProps> = ({ id_trato, refreshTrigger = 0 }) => {
  const { user } = useAuth();
  
  // Estados de datos
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null); // Para saber qué usuario se está editando
  
  // Estados de UI
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // Cargar usuarios
  useEffect(() => {
    const fetchSharedUsers = async () => {
      if (!user?.id_tenant || !id_trato) return;

      setLoading(true);
      try {
        const response = await apiFetch(
          `${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${id_trato}&id_tenant=${user.id_tenant}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) throw new Error(`Error: ${response.status}`);

        const text = await response.text();
        const data = text ? JSON.parse(text) : [];
        const list = Array.isArray(data) ? data : (data.users || []);
        setSharedUsers(list);

      } catch (error) {
        console.error('Error fetching shared users:', error);
        setToast({ message: 'Error al cargar permisos.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchSharedUsers();
  }, [id_trato, user?.id_tenant, refreshTrigger]);

  // --- MANEJO DE ACTUALIZACIÓN DE PERMISOS ---
  const handlePermissionChange = async (id_user_target: string, newLevel: string) => {
    if (!user?.id_tenant) return;
    setProcessing(id_user_target); // Bloquear UI para este usuario

    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_trato: id_trato,
          id_user: id_user_target,
          permission_level: newLevel,
          id_tenant: user.id_tenant
        })
      });

      if (!response.ok) throw new Error("Error al actualizar");

      // Actualizar estado local (Optimistic Update)
      setSharedUsers(prev => prev.map(u => 
        u.id_user === id_user_target ? { ...u, permission_level: newLevel } : u
      ));

      setToast({ message: 'Nivel de permiso actualizado.', type: 'success' });

    } catch (error) {
      setToast({ message: 'No se pudo actualizar el permiso.', type: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  // --- MANEJO DE ELIMINACIÓN ---
  const handleDeleteClick = (id_user_to_delete: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Revocar Acceso',
      message: '¿Estás seguro de que deseas eliminar el acceso a este usuario? Ya no podrá ver este trato.',
      isDestructive: true,
      onConfirm: async () => {
        setProcessing(id_user_to_delete);
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_trato: id_trato,
                id_user: id_user_to_delete,
                id_tenant: user?.id_tenant
            })
          });
    
          if (!response.ok) throw new Error("Error al eliminar");
    
          setSharedUsers(prev => prev.filter(u => u.id_user !== id_user_to_delete));
          setToast({ message: 'Acceso revocado.', type: 'success' });
        } catch (error) {
          setToast({ message: 'No se pudo eliminar el permiso.', type: 'error' });
        } finally {
          setProcessing(null);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return (
        <div className="flex justify-center p-6 text-slate-400">
            <BrandSpinner size="lg" />
        </div>
    );
  }

  return (
    <div className="space-y-3">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
      />

      {sharedUsers.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
             <i className="fa-solid fa-user-lock"></i>
          </div>
          <p className="text-slate-500 text-sm font-medium">Este trato es privado</p>
          <p className="text-slate-400 text-xs">Añade usuarios para colaborar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sharedUsers.map((u) => {
            const isEdit = u.permission_level.toUpperCase() === 'EDIT' || u.permission_level.toUpperCase() === 'WRITE';
            const isProcessing = processing === u.id_user;

            return (
              <div 
                  key={u.id_user} 
                  className={`flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-brand-300 transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200 shrink-0">
                      {(u.name_user || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{u.name_user || 'Usuario'}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-2">
                  {/* SELECTOR DE PERMISOS */}
                  <div className="relative">
                    <select
                        value={isEdit ? 'EDIT' : 'READ'}
                        onChange={(e) => handlePermissionChange(u.id_user, e.target.value)}
                        className={`appearance-none pl-8 pr-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors ${
                            isEdit 
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                        disabled={isProcessing}
                    >
                        <option value="READ">Lectura</option>
                        <option value="EDIT">Edición</option>
                    </select>
                    {/* Icono absoluto sobre el select */}
                    <div className={`absolute left-2.5 top-1.5 pointer-events-none text-xs ${isEdit ? 'text-green-600' : 'text-blue-600'}`}>
                        <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-eye'}`}></i>
                    </div>
                  </div>
                  
                  {/* BOTÓN ELIMINAR */}
                  <button
                    onClick={() => handleDeleteClick(u.id_user)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Revocar acceso"
                    disabled={isProcessing}
                  >
                    {isProcessing ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-trash-can"></i>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealShareList;
