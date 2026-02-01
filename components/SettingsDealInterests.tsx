import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { DealInterest } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';
import { apiFetch } from '../services/apiClient';

// Paleta de colores moderna y profesional para CRM
const PRESET_COLORS = [
  '#6366f1', // Indigo (Brand)
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
];

const SettingsDealInterests: React.FC = () => {
  const { user } = useAuth();
  const { dealInterests: cachedInterests, loading: cacheLoading, invalidateDealInterests } = useDataCache();
  
  // Datos locales para drag & drop
  const [interests, setInterests] = useState<DealInterest[]>([]);
  
  // Edición
  const [editingInterest, setEditingInterest] = useState<Partial<DealInterest> | null>(null);
  
  // Modales y UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Estado para el Drag & Drop
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Sincronizar cache con estado local para drag & drop
  useEffect(() => {
    const sortedData = [...cachedInterests].sort((a, b) => a.status_order - b.status_order);
    setInterests(sortedData);
    setOrderChanged(false);
  }, [cachedInterests]);

  // --- LÓGICA DE DRAG AND DROP ---
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const updatedInterests = [...interests];
    const draggedItem = updatedInterests[draggedItemIndex];
    
    updatedInterests.splice(draggedItemIndex, 1);
    updatedInterests.splice(index, 0, draggedItem);

    setInterests(updatedInterests);
    setDraggedItemIndex(index);
    setOrderChanged(true);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- GUARDAR EL NUEVO ORDEN ---
  const saveNewOrder = async () => {
    if (!user?.id_tenant) return;
    setSavingOrder(true);

    try {
      const updatePromises = interests.map((item, index) => {
        const newOrder = index + 1;
        const payload = { ...item, status_order: newOrder, id_tenant: user.id_tenant };
        return fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/interests/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      await Promise.all(updatePromises);
      setToast({ message: 'Orden actualizado correctamente.', type: 'success' });
      setOrderChanged(false);
    } catch (error) {
      setToast({ message: 'Error al guardar el orden.', type: 'error' });
    } finally {
      setSavingOrder(false);
    }
  };

  // --- LÓGICA CRUD ---
  const handleAddNew = () => {
    const newOrder = interests.length > 0 ? interests.length + 1 : 1;
    setEditingInterest({ 
        name: '', 
        color: PRESET_COLORS[0], // Color por defecto de la paleta
        icon: 'fa-solid fa-star', 
        status_order: newOrder, 
        is_default: false 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (interest: DealInterest) => {
    setEditingInterest(interest);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingInterest || !editingInterest.name || !user?.id_tenant) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }

    const payload = { ...editingInterest, id_tenant: user.id_tenant };
    const isUpdating = 'id_interest' in editingInterest;
    const url = isUpdating 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/interests/update` 
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/interests`;

    try {
      const response = await apiFetch(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
      });
      
      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      
      setToast({ message: `Interés ${isUpdating ? 'actualizado' : 'creado'}.`, type: 'success' });
      setIsModalOpen(false);
      await invalidateDealInterests();
    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Interés',
      message: '¿Estás seguro? Esto podría afectar a tratos existentes.',
      onConfirm: async () => {
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/interests/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_interest: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar');
          setToast({ message: 'Interés eliminado.', type: 'success' });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await invalidateDealInterests();
        } catch (error) {
          setToast({ message: (error as Error).message, type: 'error' });
        }
      }
    });
  };

  if (cacheLoading) return (
      <div className="flex justify-center p-8">
          <i className="fa-solid fa-circle-notch fa-spin text-brand-500"></i>
      </div>
  );

  return (
    <div className="w-full animate-fade-in pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
            <p className="text-sm text-slate-500">Clasifica tus tratos según la probabilidad de cierre (frío, tibio, caliente). El orden determina la prioridad visual en listados y reportes.</p>
        </div>
        <div className="flex items-center gap-3">
            {orderChanged && (
                <button 
                    onClick={saveNewOrder} 
                    disabled={savingOrder}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-200 font-medium transition-all flex items-center animate-pulse"
                >
                    {savingOrder ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
                    Guardar Orden
                </button>
            )}

            <button 
                onClick={handleAddNew} 
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-all flex items-center"
            >
            <i className="fa-solid fa-plus mr-2"></i> Nuevo
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {interests.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
                <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                <p>No hay niveles de interés configurados.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
            {interests.map((interest, index) => (
                <div 
                    key={interest.id_interest} 
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center justify-between p-4 transition-colors cursor-grab active:cursor-grabbing ${draggedItemIndex === index ? 'bg-slate-50 opacity-50 border-2 border-dashed border-slate-300' : 'hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="text-slate-300 group-hover:text-slate-500 cursor-grab">
                            <i className="fa-solid fa-grip-vertical"></i>
                        </div>

                        <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-colors"
                            style={{ 
                                backgroundColor: `${interest.color}15`, 
                                color: interest.color 
                            }}
                        >
                            <i className={interest.icon}></i>
                        </div>
                        <div>
                            <span 
                                className="block font-bold text-base"
                                style={{ color: interest.color }}
                            >
                                {interest.name}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleEdit(interest)} 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                            onClick={() => handleDelete(interest.id_interest)} 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                        >
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            ))}
            </div>
        )}
      </div>

      {/* Modal de Edición/Creación SIMPLIFICADO */}
      {isModalOpen && editingInterest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-800">
                    {editingInterest.id_interest ? 'Editar Interés' : 'Nuevo Interés'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* VISTA PREVIA (Compacta) */}
              <div className="flex justify-center">
                  <div 
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50 transition-all"
                    style={{ borderColor: `${editingInterest.color}40`, backgroundColor: `${editingInterest.color}10` }}
                  >
                     <div className="text-xl" style={{ color: editingInterest.color }}>
                        <i className={editingInterest.icon}></i>
                     </div>
                     <span className="font-bold text-lg" style={{ color: editingInterest.color }}>
                        {editingInterest.name || 'Nombre Etiqueta'}
                     </span>
                  </div>
              </div>

              {/* NOMBRE */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                <input 
                    type="text" 
                    value={editingInterest.name || ''} 
                    onChange={(e) => setEditingInterest({ ...editingInterest, name: e.target.value })} 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej. Muy Interesado"
                    autoFocus
                />
              </div>

              {/* COLOR PICKER (Paleta de Círculos) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Color</label>
                <div className="flex flex-wrap gap-3">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setEditingInterest({ ...editingInterest, color })}
                            className={`w-8 h-8 rounded-full transition-all border-2 ${
                                editingInterest.color === color 
                                ? 'border-slate-600 scale-110 shadow-sm' 
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
              </div>

              {/* ICON PICKER */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Icono</label>
                <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
                >
                   <div className="flex items-center gap-3">
                       <div 
                         className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all"
                         style={{ color: editingInterest.color }} // Feedback visual del color
                        >
                           <i className={editingInterest.icon || 'fa-solid fa-icons'}></i>
                       </div>
                       <span className="text-sm text-slate-600 font-medium">
                           Cambiar icono...
                       </span>
                   </div>
                   <i className="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                </button>
              </div>

            </div>
            
            {/* FOOTER */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="px-6 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-200 transition-all text-sm font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showIconPicker && (
          <IconPicker 
            onSelect={(icon) => setEditingInterest(prev => ({ ...prev, icon: icon }))}
            onClose={() => setShowIconPicker(false)}
          />
      )}
    </div>
  );
};

export default SettingsDealInterests;
