import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { ProductType } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { apiFetch } from '../services/apiClient';

const SettingsProductTypes: React.FC = () => {
  const { user } = useAuth();
  const { productTypes: cachedTypes, loading: cacheLoading, invalidateProductTypes } = useDataCache();
  
  // No necesitamos state local, usamos directamente cachedTypes
  
  // Edición
  const [editingType, setEditingType] = useState<Partial<ProductType> | null>(null);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleAddNew = () => {
    setEditingType({ type: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (type: ProductType) => {
    setEditingType(type);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingType || !editingType.type || !user?.id_tenant) {
      setToast({ message: 'El nombre del tipo es obligatorio.', type: 'error' });
      return;
    }

    const payload = {
      ...editingType,
      id_tenant: user.id_tenant,
    };
    
    const isUpdating = 'id_product_type' in editingType;
    const url = isUpdating 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/products_type/update` 
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/products_type`;

    try {
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      
      setToast({ message: `Tipo ${isUpdating ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
      setIsModalOpen(false);
      await invalidateProductTypes();

    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Tipo de Producto',
      message: '¿Estás seguro? Eliminar este tipo podría afectar a productos existentes.',
      onConfirm: async () => {
        try {
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_product_type: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar el tipo');
          setToast({ message: 'Tipo eliminado con éxito.', type: 'success' });
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await invalidateProductTypes();
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
      <ConfirmModal 
        {...confirmState} 
        isDestructive={true}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })} 
      />

      <div className="flex justify-between items-center mb-6">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Tipos de Producto</h3>
            <p className="text-sm text-slate-500">Categoriza tu inventario.</p>
        </div>
        <button 
            onClick={handleAddNew} 
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-all flex items-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> Nuevo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {cachedTypes.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
                <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                <p>No hay tipos de producto configurados.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
            {cachedTypes.map((item) => (
                <div key={item.id_product_type} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                        {/* Icono Genérico para mantener consistencia visual */}
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg shadow-sm">
                            <i className="fa-solid fa-box-open"></i>
                        </div>
                        <div>
                            <span className="block font-bold text-base text-slate-700">
                                {item.type}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleEdit(item)} 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                            onClick={() => handleDelete(item.id_product_type)} 
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
      {isModalOpen && editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="font-bold text-lg text-slate-800">
                  {editingType.id_product_type ? 'Editar Tipo' : 'Nuevo Tipo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Vista Previa Simple */}
              <div className="flex justify-center">
                  <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 bg-slate-50 transition-all">
                     <div className="text-xl text-slate-500">
                        <i className="fa-solid fa-box-open"></i>
                     </div>
                     <span className="font-bold text-lg text-slate-700">
                        {editingType.type || 'Nombre Tipo'}
                     </span>
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Tipo</label>
                <input
                  type="text"
                  value={editingType.type || ''}
                  onChange={(e) => setEditingType({ ...editingType, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ej: Servicios"
                  autoFocus
                />
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
                className="px-6 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-200 transition-all text-sm font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsProductTypes;
