import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi } from '../../services/marketingApi';
import { MarketingList } from '../../types';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';

const Lists: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- ESTADOS ---
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estado para el modal de confirmación de eliminación
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: async () => {}, 
    isDestructive: false 
  });

  // Estado para el formulario de creación
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'STATIC' as 'STATIC' | 'DYNAMIC',
    visibility: 'PRIVATE' as 'PRIVATE' | 'PUBLIC_TENANT'
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (user?.id_tenant && user?.id_user) {
      loadLists();
    }
  }, [user]);

  const loadLists = async () => {
    try {
      setLoading(true);
      const data = await marketingApi.getLists(user!.id_tenant, user!.id_user);
      setLists(data);
    } catch (error) {
      console.error('Error cargando listas:', error);
      setToast({ message: 'Error al cargar las listas', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- ACCIONES ---
  const handleOpenModal = () => {
    setFormData({
      name: '',
      description: '',
      type: 'STATIC',
      visibility: 'PRIVATE'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !user) return;

    try {
      await marketingApi.createList(user.id_tenant, user.id_user, {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        visibility: formData.visibility
      });
      
      setIsModalOpen(false);
      setToast({ message: 'Lista creada exitosamente', type: 'success' });
      await loadLists();
    } catch (error) {
      console.error('Error creando lista:', error);
      setToast({ message: 'Error al crear la lista', type: 'error' });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, list: MarketingList) => {
    e.stopPropagation(); // Evitar que se abra el detalle de la lista
    
    // Normalizamos el ID por si viene como id_list o list_id
    const listId = list.id_list ?? list.list_id;

    setConfirmState({
      isOpen: true,
      title: 'Eliminar Lista',
      message: `¿Estás seguro de eliminar la lista "${list.name}"? Esta acción no se puede deshacer.`,
      isDestructive: true,
      onConfirm: async () => {
        if (!user || !listId) return;
        try {
          // Asegúrate de que esta función llame a /api/marketing/lists/delete
          await marketingApi.deleteList(listId, user.id_tenant, user.id_user);
          
          setToast({ message: 'Lista eliminada correctamente', type: 'success' });
          // Actualizar UI localmente para que sea más rápido
          setLists(prev => prev.filter(l => (l.id_list ?? l.list_id) !== listId));
        } catch (error) {
          console.error('Error eliminando lista:', error);
          setToast({ message: 'Error al eliminar la lista', type: 'error' });
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <i className="fas fa-spinner fa-spin text-3xl mb-2"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative h-full">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Listas de Difusión</h2>
          <p className="text-slate-500">Segmenta tus contactos para envíos más efectivos.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Crear Lista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {lists.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <i className="fas fa-inbox text-5xl mb-4 text-slate-300"></i>
            <p className="text-slate-500 font-medium">No hay listas creadas aún</p>
            <p className="text-sm text-slate-400">Crea tu primera lista para comenzar</p>
          </div>
        ) : (
          lists.map((list) => (
            <div 
              key={list.id_list ?? list.list_id} 
              onClick={() => navigate(`/app/marketing/lists/${list.id_list ?? list.list_id}`)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all relative group cursor-pointer"
            >
             {/* Delete Button (Top Right) */}
             <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteClick(e, list)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Eliminar lista"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
             </div>

             <div className="flex items-center gap-3 mb-4 pr-8">
               <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${list.type === 'DYNAMIC' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                 <i className={`fa-solid ${list.type === 'DYNAMIC' ? 'fa-bolt' : 'fa-list-check'}`}></i>
               </div>
               <div className="min-w-0">
                 <h3 className="font-bold text-slate-800 truncate" title={list.name}>{list.name}</h3>
                 <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${list.visibility === 'PUBLIC_TENANT' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                   {list.visibility === 'PUBLIC_TENANT' ? 'Compartida' : 'Privada'}
                 </span>
               </div>
             </div>

             <p className="text-sm text-slate-600 mb-6 line-clamp-2 h-10">
               {list.description || 'Sin descripción'}
             </p>

             <div className="flex items-center justify-between pt-4 border-t border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 text-sm">
                 <i className="fa-solid fa-users"></i>
                 <span className="font-semibold text-slate-800">{parseInt(list.member_count?.toString() || '0')}</span>
                 <span>Miembros</span>
               </div>
               <span className="text-xs text-slate-400">
                 {new Date(list.created_at).toLocaleDateString()}
               </span>
             </div>
            </div>
          ))
        )}

        {/* Create New Placeholder Card (Optional, kept it as it's useful) */}
        {lists.length > 0 && (
            <button 
            onClick={handleOpenModal}
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all group h-full min-h-[200px]"
            >
            <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-white flex items-center justify-center mb-3 transition-colors">
                <i className="fa-solid fa-plus text-xl"></i>
            </div>
            <span className="font-medium">Crear Nueva Lista</span>
            </button>
        )}
      </div>

      {/* CREATE LIST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Nueva Lista de Difusión</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la lista <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="Ej: Clientes Potenciales 2024"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  placeholder="Propósito de esta lista..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="STATIC">Estática (Manual)</option>
                    <option value="DYNAMIC">Dinámica (Filtros)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Visibilidad</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    value={formData.visibility}
                    onChange={(e) => setFormData({...formData, visibility: e.target.value as any})}
                  >
                    <option value="PRIVATE">Privada</option>
                    <option value="PUBLIC_TENANT">Pública (Tenant)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                >
                  Crear Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componentes de notificación y confirmación */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
        isDestructive={confirmState.isDestructive}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default Lists;