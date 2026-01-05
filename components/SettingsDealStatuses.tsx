import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DealStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';

// Paleta de colores estándar (puedes centralizarla en un archivo constants.ts)
const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
];

const SettingsDealStatuses: React.FC = () => {
  const { user } = useAuth();
  
  // Datos
  const [statuses, setStatuses] = useState<DealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edición
  const [editingStatus, setEditingStatus] = useState<Partial<DealStatus> | null>(null);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Drag & Drop States
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Carga inicial
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant) return;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${user.id_tenant}`);
      if (!response.ok) {
        if(response.status === 404) setStatuses([]);
        else throw new Error('Failed to fetch deal statuses');
        return;
      }
      const data = await response.json();
      const sortedData = data.sort((a: DealStatus, b: DealStatus) => a.status_order - b.status_order);
      setStatuses(sortedData);
      setOrderChanged(false);
    } catch (error) {
      setToast({ message: 'Error al cargar los estados.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- DRAG AND DROP ---
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const updatedStatuses = [...statuses];
    const draggedItem = updatedStatuses[draggedItemIndex];
    
    updatedStatuses.splice(draggedItemIndex, 1);
    updatedStatuses.splice(index, 0, draggedItem);

    setStatuses(updatedStatuses);
    setDraggedItemIndex(index);
    setOrderChanged(true);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- GUARDAR ORDEN ---
  const saveNewOrder = async () => {
    if (!user?.id_tenant) return;
    setSavingOrder(true);

    try {
      const updatePromises = statuses.map((item, index) => {
        const newOrder = index + 1;
        const payload = { ...item, status_order: newOrder, id_tenant: user.id_tenant };
        // Nota: Asegúrate de que tu API de update soporte actualizar solo el orden sin borrar otros campos
        return fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      await Promise.all(updatePromises);
      setToast({ message: 'Orden de etapas actualizado.', type: 'success' });
      setOrderChanged(false);
    } catch (error) {
      setToast({ message: 'Error al guardar el orden.', type: 'error' });
    } finally {
      setSavingOrder(false);
    }
  };

  // --- CRUD ---
  const handleAddNew = () => {
    const newOrder = statuses.length > 0 ? statuses.length + 1 : 1;
    setEditingStatus({ 
        name: '', 
        color: PRESET_COLORS[0], 
        icon: 'fa-solid fa-layer-group', 
        status_order: newOrder, 
        is_default: false,
        status_category: 'OPEN' 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (status: DealStatus) => {
    setEditingStatus(status);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingStatus || !editingStatus.name || !user?.id_tenant) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }
    
    if (!editingStatus.status_category) {
      setToast({ message: 'El comportamiento del sistema es obligatorio.', type: 'error' });
      return;
    }

    const payload = { ...editingStatus, id_tenant: user.id_tenant };
    const isUpdating = 'id_status' in editingStatus;
    const url = isUpdating 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals/update` 
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals`;

    try {
      const response = await fetch(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
      });
      
      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      
      setToast({ message: `Estado ${isUpdating ? 'actualizado' : 'creado'}.`, type: 'success' });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Estado',
      message: '¿Estás seguro? Los tratos en este estado podrían quedar huérfanos.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_status: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar');
          setToast({ message: 'Estado eliminado.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: (error as Error).message, type: 'error' });
        }
      }
    });
  };

  if (loading) return (
      <div className="flex justify-center p-8">
          <i className="fa-solid fa-circle-notch fa-spin text-brand-500"></i>
      </div>
  );

  // Agrupar estados por categoría
  const openStatuses = statuses.filter(s => s.status_category === 'OPEN' || !s.status_category);
  const wonStatuses = statuses.filter(s => s.status_category === 'WON');
  const lostStatuses = statuses.filter(s => s.status_category === 'LOST');

  const handleDragOverCategory = (e: React.DragEvent, category: 'OPEN' | 'WON' | 'LOST') => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropOnCategory = async (e: React.DragEvent, category: 'OPEN' | 'WON' | 'LOST') => {
    e.preventDefault();
    if (draggedItemIndex === null) return;

    const draggedStatus = statuses[draggedItemIndex];
    if (draggedStatus.status_category === category) return; // Ya está en esta categoría

    // Actualizar categoría
    const updatedStatus = { ...draggedStatus, status_category: category, id_tenant: user?.id_tenant };
    
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStatus)
      });

      if (!response.ok) throw new Error('Error al actualizar');
      
      setToast({ message: `Estado movido a ${category === 'OPEN' ? 'Abierto' : category === 'WON' ? 'Ganado' : 'Perdido'}`, type: 'success' });
      fetchData();
    } catch (error) {
      setToast({ message: 'Error al cambiar categoría', type: 'error' });
    } finally {
      setDraggedItemIndex(null);
    }
  };

  const renderStatusCard = (status: DealStatus, index: number) => (
    <div 
      key={status.id_status} 
      draggable
      onDragStart={() => handleDragStart(statuses.findIndex(s => s.id_status === status.id_status))}
      onDragEnd={handleDragEnd}
      className={`group flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${draggedItemIndex === statuses.findIndex(s => s.id_status === status.id_status) ? 'opacity-50 scale-95' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-slate-300 group-hover:text-slate-500">
          <i className="fa-solid fa-grip-vertical text-sm"></i>
        </div>

        <div 
          className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm"
          style={{ 
            backgroundColor: `${status.color}15`, 
            color: status.color 
          }}
        >
          <i className={status.icon}></i>
        </div>
        <div>
          <span 
            className="block font-bold text-sm"
            style={{ color: status.color }}
          >
            {status.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => handleEdit(status)} 
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          title="Editar"
        >
          <i className="fa-solid fa-pen-to-square text-xs"></i>
        </button>
        <button 
          onClick={() => handleDelete(status.id_status)} 
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Eliminar"
        >
          <i className="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto mt-6 animate-fade-in pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Estados del Pipeline</h3>
            <p className="text-sm text-slate-500">Arrastra los estados entre categorías para cambiar su comportamiento.</p>
        </div>
        <button 
            onClick={handleAddNew} 
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-all flex items-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> Nuevo
        </button>
      </div>

      {statuses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
          <p>No hay estados configurados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* ABIERTO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'OPEN')}
            onDrop={(e) => handleDropOnCategory(e, 'OPEN')}
            className="bg-white rounded-2xl shadow-sm border-2 border-emerald-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-circle-dot"></i>
                <h4 className="font-bold text-sm uppercase tracking-wide">Abierto</h4>
              </div>
              <p className="text-xs text-emerald-100">En proceso</p>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {openStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8">
                  <i className="fa-solid fa-inbox text-2xl mb-2 opacity-30"></i>
                  <p>Arrastra estados aquí</p>
                </div>
              ) : (
                openStatuses.map((status, idx) => renderStatusCard(status, idx))
              )}
            </div>
          </div>

          {/* GANADO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'WON')}
            onDrop={(e) => handleDropOnCategory(e, 'WON')}
            className="bg-white rounded-2xl shadow-sm border-2 border-blue-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-trophy"></i>
                <h4 className="font-bold text-sm uppercase tracking-wide">Ganado</h4>
              </div>
              <p className="text-xs text-blue-100">Venta cerrada</p>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {wonStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8">
                  <i className="fa-solid fa-inbox text-2xl mb-2 opacity-30"></i>
                  <p>Arrastra estados aquí</p>
                </div>
              ) : (
                wonStatuses.map((status, idx) => renderStatusCard(status, idx))
              )}
            </div>
          </div>

          {/* PERDIDO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'LOST')}
            onDrop={(e) => handleDropOnCategory(e, 'LOST')}
            className="bg-white rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-circle-xmark"></i>
                <h4 className="font-bold text-sm uppercase tracking-wide">Perdido</h4>
              </div>
              <p className="text-xs text-red-100">Venta fallida</p>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {lostStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8">
                  <i className="fa-solid fa-inbox text-2xl mb-2 opacity-30"></i>
                  <p>Arrastra estados aquí</p>
                </div>
              ) : (
                lostStatuses.map((status, idx) => renderStatusCard(status, idx))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal Simplificado */}
      {isModalOpen && editingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-800">
                    {editingStatus.id_status ? 'Editar Estado' : 'Nuevo Estado'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Vista Previa */}
              <div className="flex justify-center">
                  <div 
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50 transition-all"
                    style={{ borderColor: `${editingStatus.color}40`, backgroundColor: `${editingStatus.color}10` }}
                  >
                     <div className="text-xl" style={{ color: editingStatus.color }}>
                        <i className={editingStatus.icon}></i>
                     </div>
                     <span className="font-bold text-lg" style={{ color: editingStatus.color }}>
                        {editingStatus.name || 'Nombre Estado'}
                     </span>
                  </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                <input 
                    type="text" 
                    value={editingStatus.name || ''} 
                    onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })} 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej. En Negociación"
                    autoFocus
                />
              </div>

              {/* Comportamiento del Sistema */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Comportamiento del Sistema <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingStatus.status_category || 'OPEN'}
                  onChange={(e) => setEditingStatus({ ...editingStatus, status_category: e.target.value as 'OPEN' | 'WON' | 'LOST' })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-white"
                >
                  <option value="OPEN">🟢 Abierto - El trato sigue en curso</option>
                  <option value="WON">🎉 Ganado - Éxito, venta cerrada</option>
                  <option value="LOST">❌ Perdido - Venta fallida</option>
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                  Define cómo se comporta este estado en la lógica del sistema
                </p>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Color</label>
                <div className="flex flex-wrap gap-3">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setEditingStatus({ ...editingStatus, color })}
                            className={`w-8 h-8 rounded-full transition-all border-2 ${
                                editingStatus.color === color 
                                ? 'border-slate-600 scale-110 shadow-sm' 
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
              </div>

              {/* Icon Picker */}
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
                         style={{ color: editingStatus.color }} 
                        >
                           <i className={editingStatus.icon || 'fa-solid fa-icons'}></i>
                       </div>
                       <span className="text-sm text-slate-600 font-medium">
                           Cambiar icono...
                       </span>
                   </div>
                   <i className="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                </button>
              </div>

              {/* Opciones Avanzadas (Opcional - Checkbox para Default) */}
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <input 
                    type="checkbox" 
                    id="is_default" 
                    checked={editingStatus.is_default || false} 
                    onChange={(e) => setEditingStatus({ ...editingStatus, is_default: e.target.checked })} 
                    className="h-4 w-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500" 
                 />
                 <label htmlFor="is_default" className="ml-3 text-sm text-slate-700 cursor-pointer select-none">
                    Marcar como estado inicial por defecto
                 </label>
              </div>

            </div>
            
            {/* Footer */}
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
            onSelect={(icon) => setEditingStatus(prev => ({ ...prev, icon: icon }))}
            onClose={() => setShowIconPicker(false)}
          />
      )}
    </div>
  );
};

export default SettingsDealStatuses;