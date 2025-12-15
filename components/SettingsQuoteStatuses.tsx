import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';

// Paleta de colores estándar
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

const SettingsQuoteStatuses: React.FC = () => {
  const { user } = useAuth();
  
  // Datos
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edición
  const [editingStatus, setEditingStatus] = useState<Partial<QuoteStatus> | null>(null);
  
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
      const response = await fetch(`https://service.computeksa.com/webhook/api/statuses/quotes?id_tenant=${user.id_tenant}`);
      if (!response.ok) {
        if(response.status === 404) setStatuses([]);
        else throw new Error('Failed to fetch quote statuses');
        return;
      }
      const data = await response.json();
      const sortedData = data.sort((a: QuoteStatus, b: QuoteStatus) => a.status_order - b.status_order);
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
        return fetch(`https://service.computeksa.com/webhook/api/statuses/quotes/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      await Promise.all(updatePromises);
      setToast({ message: 'Orden de estados actualizado.', type: 'success' });
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
        icon: 'fa-solid fa-file-invoice', 
        status_order: newOrder, 
        is_default: false 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (status: QuoteStatus) => {
    setEditingStatus(status);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingStatus || !editingStatus.name || !user?.id_tenant) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }

    const payload = { ...editingStatus, id_tenant: user.id_tenant };
    const isUpdating = 'id_status' in editingStatus;
    const url = isUpdating 
        ? 'https://service.computeksa.com/webhook/api/statuses/quotes/update' 
        : 'https://service.computeksa.com/webhook/api/statuses/quotes';

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
      message: '¿Estás seguro? Las cotizaciones en este estado podrían quedar sin clasificar.',
      onConfirm: async () => {
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/statuses/quotes/delete', {
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

  return (
    <div className="max-w-4xl mx-auto mt-6 animate-fade-in pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Estados de Cotización</h3>
            <p className="text-sm text-slate-500">Configura el flujo de vida de tus cotizaciones.</p>
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
        {statuses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
                <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                <p>No hay estados configurados.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
            {statuses.map((status, index) => (
                <div 
                    key={status.id_status} 
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
                                backgroundColor: `${status.color}15`, 
                                color: status.color 
                            }}
                        >
                            <i className={status.icon}></i>
                        </div>
                        <div>
                            <span 
                                className="block font-bold text-base"
                                style={{ color: status.color }}
                            >
                                {status.name}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleEdit(status)} 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                            onClick={() => handleDelete(status.id_status)} 
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
                    placeholder="Ej. Aprobado"
                    autoFocus
                />
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

              {/* Opciones Avanzadas (Default) */}
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

export default SettingsQuoteStatuses;