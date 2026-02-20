import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';
import { apiFetch } from '../services/apiClient';

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

// Normaliza categorías para la UI y el API
const mapCategoryToUi = (category?: string | null): QuoteStatus['status_category'] => {
  if (category === 'WON') return 'ACCEPTED';
  if (category === 'LOST') return 'REJECTED';
  return (category as QuoteStatus['status_category']) || 'DRAFT';
};

const mapCategoryToApi = (category: QuoteStatus['status_category']): string => {
  if (category === 'ACCEPTED') return 'WON';
  if (category === 'REJECTED') return 'LOST';
  return category;
};

const SettingsQuoteStatuses: React.FC = () => {
  const { user } = useAuth();
  const { quoteStatuses: cachedStatuses, loading: cacheLoading, invalidateQuoteStatuses } = useDataCache();
  
  // Datos locales para drag & drop
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);
  
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

  // Sincronizar cache con estado local para drag & drop
  useEffect(() => {
    const normalized = cachedStatuses.map(s => ({
      ...s,
      status_category: mapCategoryToUi(s.status_category)
    }));
    const sortedData = [...normalized].sort((a, b) => a.status_order - b.status_order);
    setStatuses(sortedData);
    setOrderChanged(false);
  }, [cachedStatuses]);

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
        return fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes/update`, {
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
        is_default: false,
        status_category: 'DRAFT' 
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
    
    if (!editingStatus.status_category) {
      setToast({ message: 'El comportamiento del sistema es obligatorio.', type: 'error' });
      return;
    }

    const payload = { ...editingStatus, id_tenant: user.id_tenant };
    const isUpdating = 'id_status' in editingStatus;
    const url = isUpdating 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes/update` 
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes`;

    try {
      const response = await apiFetch(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
      });
      
      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      
      setToast({ message: `Estado ${isUpdating ? 'actualizado' : 'creado'}.`, type: 'success' });
      setIsModalOpen(false);
      await invalidateQuoteStatuses();
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
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_status: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar');
          setToast({ message: 'Estado eliminado.', type: 'success' });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await invalidateQuoteStatuses();
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

  // Agrupar estados por categoría normalizada
  const draftStatuses = statuses.filter(s => mapCategoryToUi(s.status_category) === 'DRAFT');
  const sentStatuses = statuses.filter(s => mapCategoryToUi(s.status_category) === 'SENT');
  const acceptedStatuses = statuses.filter(s => mapCategoryToUi(s.status_category) === 'ACCEPTED');
  const rejectedStatuses = statuses.filter(s => mapCategoryToUi(s.status_category) === 'REJECTED');

  const handleDragOverCategory = (e: React.DragEvent, category: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED') => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropOnCategory = async (e: React.DragEvent, category: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED') => {
    e.preventDefault();
    if (draggedItemIndex === null) return;

    const draggedStatus = statuses[draggedItemIndex];
    if (draggedStatus.status_category === category) return; // Ya está en esta categoría

    // Actualizar categoría
    const updatedStatus = { ...draggedStatus, status_category: mapCategoryToApi(category), id_tenant: user?.id_tenant };
    
    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStatus)
      });

      if (!response.ok) throw new Error('Error al actualizar');
      
      const categoryNames = {
        DRAFT: 'Borrador',
        SENT: 'Enviado',
        ACCEPTED: 'Ganada',
        REJECTED: 'Perdida'
      } as const;
      
      setToast({ message: `Estado movido a ${categoryNames[category]}`, type: 'success' });
      await invalidateQuoteStatuses();
    } catch (error) {
      setToast({ message: 'Error al cambiar categoría', type: 'error' });
    } finally {
      setDraggedItemIndex(null);
    }
  };

  const renderStatusCard = (status: QuoteStatus) => {
    const globalIndex = statuses.findIndex(s => s.id_status === status.id_status);
    const isDragging = draggedItemIndex === globalIndex;

    return (
    <div 
      key={status.id_status} 
      draggable
      onDragStart={() => handleDragStart(globalIndex)}
      onDragOver={(e) => handleDragOver(e, globalIndex)}
      onDragEnd={handleDragEnd}
      className={`group flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 scale-95' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-slate-300 group-hover:text-slate-500">
          <i className="fa-solid fa-grip-vertical text-sm"></i>
        </div>

        <div 
          className="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg flex items-center justify-center shadow-sm"
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
  };

  return (
    <div className="w-full animate-fade-in pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
            <button
              type="button"
              title="Gestiona el ciclo de vida de tus cotizaciones (borrador, enviada, aprobada, rechazada). Arrastra estados entre categorías para cambiar su comportamiento en el sistema."
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <i className="fa-solid fa-circle-info text-lg"></i>
            </button>
        </div>
        <div className="flex items-center gap-2">
          {orderChanged && (
            <button
              onClick={saveNewOrder}
              disabled={savingOrder}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-all flex items-center"
            >
              {savingOrder ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
              Guardar orden
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

      {statuses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
          <p>No hay estados configurados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          
          {/* BORRADOR */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'DRAFT')}
            onDrop={(e) => handleDropOnCategory(e, 'DRAFT')}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200" style={{ backgroundColor: '#6b728015', borderLeftColor: '#6b7280', borderLeftWidth: '4px' }}>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-pencil text-sm" style={{ color: '#6b7280' }}></i>
                <h4 className="font-bold text-sm" style={{ color: '#6b7280' }}>Borrador</h4>
                <span className="text-xs text-slate-500 ml-auto">({draftStatuses.length})</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {draftStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-3">
                  Sin elementos en esta categoría
                </div>
              ) : (
                draftStatuses.map((status) => renderStatusCard(status))
              )}
            </div>
          </div>

          {/* ENVIADO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'SENT')}
            onDrop={(e) => handleDropOnCategory(e, 'SENT')}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200" style={{ backgroundColor: '#4f46e515', borderLeftColor: '#4f46e5', borderLeftWidth: '4px' }}>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-sm" style={{ color: '#4f46e5' }}></i>
                <h4 className="font-bold text-sm" style={{ color: '#4f46e5' }}>Enviado</h4>
                <span className="text-xs text-slate-500 ml-auto">({sentStatuses.length})</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {sentStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-3">
                  Sin elementos en esta categoría
                </div>
              ) : (
                sentStatuses.map((status) => renderStatusCard(status))
              )}
            </div>
          </div>

          {/* ACEPTADO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'ACCEPTED')}
            onDrop={(e) => handleDropOnCategory(e, 'ACCEPTED')}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200" style={{ backgroundColor: '#10b98115', borderLeftColor: '#10b981', borderLeftWidth: '4px' }}>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-check-circle text-sm" style={{ color: '#10b981' }}></i>
                <h4 className="font-bold text-sm" style={{ color: '#10b981' }}>Aceptado</h4>
                <span className="text-xs text-slate-500 ml-auto">({acceptedStatuses.length})</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {acceptedStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-3">
                  Sin elementos en esta categoría
                </div>
              ) : (
                acceptedStatuses.map((status) => renderStatusCard(status))
              )}
            </div>
          </div>

          {/* RECHAZADO */}
          <div 
            onDragOver={(e) => handleDragOverCategory(e, 'REJECTED')}
            onDrop={(e) => handleDropOnCategory(e, 'REJECTED')}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200" style={{ backgroundColor: '#ef444415', borderLeftColor: '#ef4444', borderLeftWidth: '4px' }}>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-times-circle text-sm" style={{ color: '#ef4444' }}></i>
                <h4 className="font-bold text-sm" style={{ color: '#ef4444' }}>Rechazado</h4>
                <span className="text-xs text-slate-500 ml-auto">({rejectedStatuses.length})</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {rejectedStatuses.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-3">
                  Sin elementos en esta categoría
                </div>
              ) : (
                rejectedStatuses.map((status) => renderStatusCard(status))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal Simplificado */}
      {isModalOpen && editingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <h2 className="font-bold text-base md:text-lg text-slate-800">
                    {editingStatus.id_status ? 'Editar Estado' : 'Nuevo Estado'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>
            
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              
              {/* Vista Previa */}
              <div className="flex justify-center">
                  <div 
                    className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl border border-slate-100 bg-slate-50 transition-all"
                    style={{ borderColor: `${editingStatus.color}40`, backgroundColor: `${editingStatus.color}10` }}
                  >
                     <div className="text-lg md:text-xl" style={{ color: editingStatus.color }}>
                        <i className={editingStatus.icon}></i>
                     </div>
                     <span className="font-bold text-base md:text-lg" style={{ color: editingStatus.color }}>
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
                    className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                    placeholder="Ej. Aprobado"
                    autoFocus
                />
              </div>

              {/* Comportamiento del Sistema */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Comportamiento del Sistema <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingStatus.status_category || 'DRAFT'}
                  onChange={(e) => setEditingStatus({ ...editingStatus, status_category: e.target.value as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' })}
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-white text-sm"
                >
                  <option value="DRAFT">📝 Borrador - Edición inicial</option>
                  <option value="SENT">📤 Enviado - Esperando respuesta</option>
                  <option value="ACCEPTED">✅ Aceptado - Cliente aprobó</option>
                  <option value="REJECTED">🚫 Rechazado - Cliente rechazó</option>
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
            <div className="px-4 md:px-6 py-3 md:py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 md:gap-3">
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
