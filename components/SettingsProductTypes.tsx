import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProductType } from '../types';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';

const SettingsProductTypes: React.FC = () => {
  const { user } = useAuth();
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<Partial<ProductType> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant) return;
    setLoading(true);
    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/products_type?id_tenant=${user.id_tenant}`);
      if (!response.ok) {
        if(response.status === 404) {
          setProductTypes([]);
          return;
        }
        throw new Error('Failed to fetch product types');
      }
      const data = await response.json();
      setProductTypes(data);
    } catch (error) {
      setToast({ message: 'Error al cargar los tipos de producto.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      setToast({ message: 'El nombre del tipo no puede estar vacío.', type: 'error' });
      return;
    }

    const payload = {
      ...editingType,
      id_tenant: user.id_tenant,
    };
    
    const isUpdating = 'id_product_type' in editingType;
    const url = isUpdating ? 'https://service.computeksa.com/webhook/api/products_type/update' : 'https://service.computeksa.com/webhook/api/products_type';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(isUpdating ? 'Error al actualizar' : 'Error al crear');
      
      setToast({ message: `Tipo ${isUpdating ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
      setIsModalOpen(false);
      fetchData();

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
          const response = await fetch('https://service.computeksa.com/webhook/api/products_type/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_product_type: id, id_tenant: user?.id_tenant }),
          });
          if (!response.ok) throw new Error('Error al eliminar el tipo');
          setToast({ message: 'Tipo eliminado con éxito.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: (error as Error).message, type: 'error' });
        }
      }
    });
  };

  if (loading) return <div>Cargando tipos de producto...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        {...confirmState} 
        isDestructive={true}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })} 
      />

      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Gestionar Tipos de Producto</h3>
        <button onClick={handleAddNew} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded">
          <i className="fa-solid fa-plus mr-1"></i> Añadir Tipo
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3">Nombre del Tipo</th>
            <th className="px-6 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {productTypes.map((item) => (
            <tr key={item.id_product_type} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-800">{item.type}</td>
              <td className="px-6 py-4 text-right space-x-2">
                <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen-to-square"></i></button>
                <button onClick={() => handleDelete(item.id_product_type)} className="p-2 text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-lg">{editingType?.id_product_type ? 'Editar' : 'Nuevo'} Tipo</h2>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre del Tipo</span>
                <input
                  type="text"
                  value={editingType?.type || ''}
                  onChange={(e) => setEditingType({ ...editingType, type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm"
                  placeholder="Ej: Electrónico"
                />
              </label>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end space-x-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsProductTypes;
