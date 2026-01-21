import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { DealChannel } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';
import { apiFetch } from '../services/apiClient';

const PRESET_COLORS = [
  '#6366f1',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

const SettingsDealChannels: React.FC = () => {
  const { user } = useAuth();
  const { dealChannels: cachedChannels, loading: cacheLoading, invalidateDealChannels } = useDataCache();

  const [channels, setChannels] = useState<DealChannel[]>([]);
  const [editingChannel, setEditingChannel] = useState<Partial<DealChannel> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Sincronizar cache con estado local para drag & drop
  useEffect(() => {
    const sortedData = [...cachedChannels].sort((a, b) => a.status_order - b.status_order);
    setChannels(sortedData);
    setOrderChanged(false);
  }, [cachedChannels]);

  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const updated = [...channels];
    const dragged = updated[draggedItemIndex];
    updated.splice(draggedItemIndex, 1);
    updated.splice(index, 0, dragged);
    setChannels(updated);
    setDraggedItemIndex(index);
    setOrderChanged(true);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);

  const saveNewOrder = async () => {
    if (!user?.id_tenant) return;
    setSavingOrder(true);
    try {
      await Promise.all(
        channels.map((item, index) => {
          const payload = { ...item, status_order: index + 1, id_tenant: user.id_tenant };
          return apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/channel/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        })
      );
      setToast({ message: 'Orden de canales actualizado.', type: 'success' });
      setOrderChanged(false);
    } catch (error) {
      setToast({ message: 'Error al guardar el orden.', type: 'error' });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAddNew = () => {
    const newOrder = channels.length > 0 ? channels.length + 1 : 1;
    setEditingChannel({
      name: '',
      color: PRESET_COLORS[0],
      icon: 'fa-solid fa-bullhorn',
      status_order: newOrder,
      is_default: false,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (ch: DealChannel) => {
    setEditingChannel(ch);
    setIsModalOpen(true);
  };

  // Cerrar modal con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isModalOpen]);

  const handleSave = async () => {
    if (!editingChannel || !editingChannel.name || !user?.id_tenant) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }
    const payload = { ...editingChannel, id_tenant: user.id_tenant } as Partial<DealChannel>;
    const isUpdating = 'id_channel' in (editingChannel as any);
    const url = isUpdating
      ? `${import.meta.env.VITE_WEBHOOK_URL}/api/channel/update`
      : `${import.meta.env.VITE_WEBHOOK_URL}/api/channel`;
    try {
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      setToast({ message: `Canal ${isUpdating ? 'actualizado' : 'creado'}.`, type: 'success' });
      setIsModalOpen(false);
      await invalidateDealChannels();
    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Canal',
      message: '¿Estás seguro? Los tratos asociados podrían quedar huérfanos.',
      onConfirm: async () => {
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/channel/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_channel: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar');
          setToast({ message: 'Canal eliminado.', type: 'success' });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await invalidateDealChannels();
        } catch (error) {
          setToast({ message: (error as Error).message, type: 'error' });
        }
      },
    });
  };

  if (cacheLoading) {
    return (
      <div className="flex justify-center p-8">
        <i className="fa-solid fa-circle-notch fa-spin text-brand-500"></i>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Canales</h3>
          <p className="text-sm text-slate-500">Define los canales de origen para tus tratos.</p>
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
        {channels.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
            <p>No hay canales configurados.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {channels.map((ch, index) => (
              <div
                key={ch.id_channel}
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
                    style={{ backgroundColor: `${ch.color}15`, color: ch.color }}
                  >
                    <i className={ch.icon}></i>
                  </div>
                  <div>
                    <span className="block font-bold text-base" style={{ color: ch.color }}>
                      {ch.name}
                    </span>
                    {ch.is_default && <span className="text-xs text-emerald-600 font-semibold">Default</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(ch)}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(ch.id_channel)}
                    className="w-9 h-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edición/Creación SIMPLIFICADO */}
      {isModalOpen && editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-800">
                    {editingChannel.id_channel ? 'Editar Canal' : 'Nuevo Canal'}
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
                    style={{ borderColor: `${editingChannel.color}40`, backgroundColor: `${editingChannel.color}10` }}
                  >
                     <div className="text-xl" style={{ color: editingChannel.color }}>
                        <i className={editingChannel.icon}></i>
                     </div>
                     <span className="font-bold text-lg" style={{ color: editingChannel.color }}>
                        {editingChannel.name || 'Nombre Etiqueta'}
                     </span>
                  </div>
              </div>

              {/* NOMBRE */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                <input 
                    type="text" 
                    value={editingChannel.name || ''} 
                    onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })} 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej. WhatsApp, Facebook, Referido"
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
                            onClick={() => setEditingChannel({ ...editingChannel, color })}
                            className={`w-8 h-8 rounded-full transition-all border-2 ${
                                editingChannel.color === color 
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
                         style={{ color: editingChannel.color }}
                        >
                           <i className={editingChannel.icon || 'fa-solid fa-bullhorn'}></i>
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
          socialOnly
          onSelect={(icon) => {
            setEditingChannel(prev => ({ ...prev, icon }));
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </div>
  );
};

export default SettingsDealChannels;
