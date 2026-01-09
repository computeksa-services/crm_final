import React, { useState, useEffect, useCallback } from 'react';
import { MarketingList } from '../../types';
import { marketingApi } from '../../services/marketingApi';

// Imports de tus modales
import AudienceListModal from './audiences/AudienceListModal';
import AudienceMembersModal from './audiences/AudienceMembersModal';
import Toast from '../Toast';

interface Props {
  tenantId: string;
  userId: string;
}

const AudiencesView: React.FC<Props> = ({ tenantId, userId }) => {
  const [lists, setLists] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  // Lista seleccionada para editar o ver miembros
  const [selectedList, setSelectedList] = useState<any | null>(null);
  
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketingApi.getLists(tenantId, userId);
      setLists(data);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error cargando audiencias', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const handleListSuccess = (newList: MarketingList) => {
    loadLists(); 
    setIsListModalOpen(false);
    setSelectedList(null); // Limpiar selección
  };

  const handleDelete = async (id: string) => {
    if(!confirm("¿Eliminar audiencia?")) return;
    try {
      await marketingApi.deleteList(id, userId);
      setLists(prev => prev.filter(l => (l.id_list || l.list_id) !== id));
      setToast({ message: 'Audiencia eliminada', type: 'success' });
    } catch (e) {
      setToast({ message: 'Error al eliminar', type: 'error' });
    }
  };

  // --- ABRIR MODAL MIEMBROS (VIEW) ---
  const handleOpenMembers = (list: any) => {
    const validId = list.id_list || list.list_id;
    if (!validId) return;

    setSelectedList({ ...list, list_id: validId, id_list: validId });
    setShowMembersModal(true);
  };

  // --- ABRIR MODAL EDICIÓN (EDIT) ---
  const handleEdit = (list: any) => {
    const validId = list.id_list || list.list_id;
    if (!validId) return;

    setSelectedList({ ...list, list_id: validId, id_list: validId });
    setIsListModalOpen(true); // Abre el mismo modal de crear, pero con datos
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tus Audiencias</h2>
          <p className="text-sm text-slate-500">Gestiona tus listas de contactos.</p>
        </div>
        <button 
          onClick={() => { setSelectedList(null); setIsListModalOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Nueva Audiencia
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {lists.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <i className="fa-solid fa-users-slash text-4xl mb-3 text-slate-300"></i>
              <p>No hay audiencias creadas.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Visibilidad</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Miembros</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lists.map((list, index) => {
                  const currentId = list.id_list || list.list_id;
                  const isOwner = list.created_by === userId; // Validación visual básica

                  return (
                    <tr key={currentId || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{list.name}</p>
                        <p className="text-xs text-slate-500">{list.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${list.visibility === 'PRIVATE' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-green-100 text-green-600 border-green-200'}`}>
                          {list.visibility === 'PRIVATE' ? '🔒 Privada' : '🌍 Pública'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          {list.member_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        
                        {/* 1. Ver Miembros */}
                        <button 
                          onClick={() => handleOpenMembers(list)} 
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Gestionar Miembros"
                        >
                          <i className="fas fa-users-gear"></i>
                        </button>

                        {/* 2. Editar (Solo si es dueño) */}
                        {isOwner && (
                          <button 
                            onClick={() => handleEdit(list)} 
                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                            title="Editar Información"
                          >
                            <i className="fas fa-pen"></i>
                          </button>
                        )}

                        {/* 3. Eliminar (Solo si es dueño) */}
                        {isOwner && (
                          <button 
                            onClick={() => handleDelete(currentId)} 
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Eliminar"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}

                        {!isOwner && (
                          <span className="p-2 text-slate-300 cursor-not-allowed" title="Solo lectura">
                            <i className="fas fa-lock"></i>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL DE EDICIÓN / CREACIÓN */}
      <AudienceListModal 
        isOpen={isListModalOpen} 
        onClose={() => { setIsListModalOpen(false); setSelectedList(null); }} 
        onSuccess={handleListSuccess}
        initialData={selectedList || undefined} // Pasamos los datos para editar
        tenantId={tenantId}
        userId={userId}
      />
      
      {/* MODAL DE MIEMBROS */}
      {showMembersModal && selectedList && (
        <AudienceMembersModal
          isOpen={showMembersModal}
          onClose={() => { setShowMembersModal(false); setSelectedList(null); }}
          listId={selectedList.list_id || selectedList.id_list} 
          listName={selectedList.name}
          tenantId={tenantId}
          userId={userId}
        />
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AudiencesView;