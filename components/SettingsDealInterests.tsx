import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DealInterest } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';

const SettingsDealInterests: React.FC = () => {
  const { user } = useAuth();
  
  // Datos
  const [interests, setInterests] = useState<DealInterest[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  // Carga inicial
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant) return;
    setLoading(true);
    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/statuses/interests?id_tenant=${user.id_tenant}`);
      if (!response.ok) {
        if(response.status === 404) setInterests([]);
        else throw new Error('Failed to fetch deal interests');
        return;
      }
      const data = await response.json();
      // Ordenamos por status_order
      const sortedData = data.sort((a: DealInterest, b: DealInterest) => a.status_order - b.status_order);
      setInterests(sortedData);
      setOrderChanged(false); // Reseteamos el estado de cambio
    } catch (error) {
      setToast({ message: 'Error al cargar los niveles de interés.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- LÓGICA DE DRAG AND DROP ---
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necesario para permitir el drop
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    // Reordenar el array en tiempo real visualmente
    const updatedInterests = [...interests];
    const draggedItem = updatedInterests[draggedItemIndex];
    
    // Eliminar del viejo sitio y poner en el nuevo
    updatedInterests.splice(draggedItemIndex, 1);
    updatedInterests.splice(index, 0, draggedItem);

    setInterests(updatedInterests);
    setDraggedItemIndex(index); // Actualizar el índice arrastrado
    setOrderChanged(true); // Marcar que hay cambios pendientes de guardar
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- GUARDAR EL NUEVO ORDEN ---
  const saveNewOrder = async () => {
    if (!user?.id_tenant) return;
    setSavingOrder(true);

    try {
      // Creamos un array de promesas. Recorremos la lista visual actual.
      // El índice del array (0, 1, 2) + 1 se convierte en el nuevo status_order.
      const updatePromises = interests.map((item, index) => {
        const newOrder = index + 1;
        
        // Solo enviamos actualización si el orden es diferente al que tenía (opcional, pero optimiza)
        // O para asegurar consistencia, mandamos actualizar todos.
        // Usamos el endpoint existente de update.
        const payload = { 
            ...item, 
            status_order: newOrder, 
            id_tenant: user.id_tenant 
        };

        return fetch(`https://service.computeksa.com/webhook/api/statuses/interests/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      // Esperamos a que TODAS las actualizaciones terminen
      await Promise.all(updatePromises);

      setToast({ message: 'Orden actualizado correctamente.', type: 'success' });
      setOrderChanged(false);
      // Opcional: recargar datos para asegurar sincronía
      // fetchData(); 

    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al guardar el orden. Intente nuevamente.', type: 'error' });
    } finally {
      setSavingOrder(false);
    }
  };

  // --- LÓGICA CRUD EXISTENTE ---
  const handleAddNew = () => {
    // El nuevo orden será el último + 1
    const newOrder = interests.length > 0 ? interests.length + 1 : 1;
    setEditingInterest({ name: '', color: '#6366f1', icon: 'fa-solid fa-star', status_order: newOrder, is_default: false });
    setIsModalOpen(true);
  };

  const handleEdit = (interest: DealInterest) => {
    setEditingInterest(interest);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingInterest || !editingInterest.name || !user?.id_tenant) {
      setToast({ message: 'El nombre del interés no puede estar vacío.', type: 'error' });
      return;
    }

    const payload = { ...editingInterest, id_tenant: user.id_tenant };
    const isUpdating = 'id_interest' in editingInterest;
    const url = isUpdating ? `https://service.computeksa.com/webhook/api/statuses/interests/update` : `https://service.computeksa.com/webhook/api/statuses/interests`;

    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      setToast({ message: `Interés ${isUpdating ? 'actualizado' : 'creado'}.`, type: 'success' });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Interés',
      message: '¿Estás seguro? Esto eliminará la etiqueta de los tratos que la tengan asignada.',
      onConfirm: async () => {
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/statuses/interests/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_interest: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar');
          setToast({ message: 'Interés eliminado.', type: 'success' });
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
            <h3 className="text-lg font-bold text-slate-800">Niveles de Interés</h3>
            <p className="text-sm text-slate-500">Arrastra los elementos para cambiar su prioridad.</p>
        </div>
        <div className="flex items-center gap-3">
             {/* BOTÓN DE GUARDAR ORDEN (Solo aparece si se movió algo) */}
            {orderChanged && (
                <button 
                    onClick={saveNewOrder} 
                    disabled={savingOrder}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-200 font-medium transition-all flex items-center animate-pulse"
                >
                    {savingOrder ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
                    Guardar Nuevo Orden
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
                    
                    {/* Visualización Principal */}
                    <div className="flex items-center gap-4">
                        {/* Icono de Agarre (Handle) */}
                        <div className="text-slate-300 group-hover:text-slate-500 cursor-grab">
                            <i className="fa-solid fa-grip-vertical"></i>
                        </div>

                        <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm"
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
                            <div className="flex items-center gap-2">
                                {interest.is_default && (
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 inline-block">
                                        Por defecto
                                    </span>
                                )}
                                {/* Mostramos el orden visualmente para referencia */}
                                <span className="text-[10px] text-slate-400">
                                    Posición: {index + 1}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Acciones */}
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

      {/* Modal de Edición/Creación */}
      {isModalOpen && editingInterest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all relative">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-800">
                    {editingInterest.id_interest ? 'Editar Interés' : 'Nuevo Interés'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>
            
            <div className="p-6 space-y-5">
              
              {/* Vista Previa */}
              <div className="flex justify-center mb-2">
                  <div className="flex items-center gap-3 px-6 py-3 rounded-xl border border-slate-200 bg-slate-50">
                     <span className="text-xs text-slate-400 uppercase font-bold mr-2">Vista Previa:</span>
                     <div className="flex items-center gap-2" style={{ color: editingInterest.color }}>
                        <i className={editingInterest.icon}></i>
                        <span className="font-bold">{editingInterest.name || 'Nombre Etiqueta'}</span>
                     </div>
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                <input 
                    type="text" 
                    value={editingInterest.name || ''} 
                    onChange={(e) => setEditingInterest({ ...editingInterest, name: e.target.value })} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="Ej. Muy Interesado"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Color</label>
                    <div className="flex items-center gap-3 h-10">
                        <input 
                            type="color" 
                            value={editingInterest.color || '#cccccc'} 
                            onChange={(e) => setEditingInterest({ ...editingInterest, color: e.target.value })} 
                            className="h-10 w-full p-0 border-0 rounded-lg cursor-pointer shadow-sm" 
                        />
                    </div>
                </div>
                {/* Ocultamos el campo ORDEN en el modal porque ahora se maneja visualmente, 
                    pero lo mantenemos en el estado */}
                <div>
                     <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 cursor-not-allowed">Orden (Automático)</label>
                     <input 
                        type="text" 
                        disabled
                        value={editingInterest.status_order || '-'}
                        className="w-full px-4 py-2 border border-slate-100 bg-slate-50 text-slate-400 rounded-xl outline-none"
                    />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Icono</label>
                <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
                >
                   <div className="flex items-center gap-3">
                       <div 
                         className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all"
                         style={{ color: editingInterest.color }}
                        >
                           <i className={editingInterest.icon || 'fa-solid fa-icons'}></i>
                       </div>
                       <span className="text-sm text-slate-600 font-medium">
                           {editingInterest.icon || 'Seleccionar un icono...'}
                       </span>
                   </div>
                   <i className="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                </button>
              </div>

              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <input 
                    type="checkbox" 
                    id="is_default_interest" 
                    checked={editingInterest.is_default || false} 
                    onChange={(e) => setEditingInterest({ ...editingInterest, is_default: e.target.checked })} 
                    className="h-4 w-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500" 
                 />
                 <label htmlFor="is_default_interest" className="ml-3 text-sm text-slate-700 cursor-pointer select-none">
                    Establecer como valor por defecto
                 </label>
              </div>

            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-200 transition-all text-sm font-medium"
              >
                Guardar Cambios
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