import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DealStatus } from '../types';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';

const SettingsDealStatuses: React.FC = () => {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<DealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<Partial<DealStatus> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant) return;
    setLoading(true);
    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/statuses/deals?id_tenant=${user.id_tenant}`);
      if (!response.ok) {
        if(response.status === 404) setStatuses([]);
        else throw new Error('Failed to fetch deal statuses');
        return;
      }
      const data = await response.json();
      // Ordenar por status_order
      const sortedData = data.sort((a: DealStatus, b: DealStatus) => a.status_order - b.status_order);
      setStatuses(sortedData);
    } catch (error) {
      setToast({ message: 'Error al cargar los estados.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    setEditingStatus({ name: '', color: '#cccccc', icon: 'fa-solid fa-circle', status_order: statuses.length + 1, is_default: false });
    setIsModalOpen(true);
  };

  const handleEdit = (status: DealStatus) => {
    setEditingStatus(status);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingStatus || !editingStatus.name || !user?.id_tenant) {
      setToast({ message: 'El nombre del estado no puede estar vacío.', type: 'error' });
      return;
    }

    const payload = { ...editingStatus, id_tenant: user.id_tenant };
    const isUpdating = 'id_status' in editingStatus;
    const url = isUpdating ? 'https://service.computeksa.com/webhook/api/statuses/deals/update' : 'https://service.computeksa.com/webhook/api/statuses/deals';

    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      title: 'Eliminar Estado de Trato',
      message: '¿Estás seguro? Esto podría afectar a tratos existentes.',
      onConfirm: async () => {
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/statuses/deals/delete', {
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

  if (loading) return <div>Cargando estados de tratos...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isDestructive={true} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Gestionar Estados de Tratos</h3>
        <button onClick={handleAddNew} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded">
          <i className="fa-solid fa-plus mr-1"></i> Añadir Estado
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3 w-full">Nombre del Estado</th>
            <th className="px-6 py-3">Orden</th>
            <th className="px-6 py-3">Por Defecto</th>
            <th className="px-6 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {statuses.map((status) => (
            <tr key={status.id_status} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-800 flex items-center">
                <span className="h-4 w-4 rounded-full mr-3" style={{ backgroundColor: status.color }}></span>
                <i className={`${status.icon} mr-3 text-slate-500`}></i>
                {status.name}
              </td>
              <td className="px-6 py-4 text-center font-mono text-xs">{status.status_order}</td>
              <td className="px-6 py-4 text-center">
                {status.is_default && <span className="text-green-500"><i className="fa-solid fa-check-circle"></i></span>}
              </td>
              <td className="px-6 py-4 text-right space-x-2">
                <button onClick={() => handleEdit(status)} className="p-2 text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen-to-square"></i></button>
                <button onClick={() => handleDelete(status.id_status)} className="p-2 text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b"><h2 className="font-bold text-lg">{editingStatus?.id_status ? 'Editar' : 'Nuevo'} Estado</h2></div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <label className="block col-span-2">
                <span className="text-sm font-medium text-slate-700">Nombre</span>
                <input type="text" value={editingStatus?.name || ''} onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })} className="mt-1 block w-full input" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Color</span>
                <input type="color" value={editingStatus?.color || '#cccccc'} onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })} className="mt-1 block w-full h-10" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Icono (FontAwesome)</span>
                <input type="text" value={editingStatus?.icon || ''} onChange={(e) => setEditingStatus({ ...editingStatus, icon: e.target.value })} className="mt-1 block w-full input" placeholder="fa-solid fa-star" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Orden</span>
                <input type="number" value={editingStatus?.status_order || 0} onChange={(e) => setEditingStatus({ ...editingStatus, status_order: parseInt(e.target.value) })} className="mt-1 block w-full input" />
              </label>
               <div className="flex items-center pt-4">
                 <input type="checkbox" id="is_default" checked={editingStatus?.is_default || false} onChange={(e) => setEditingStatus({ ...editingStatus, is_default: e.target.checked })} className="h-4 w-4 rounded" />
                 <label htmlFor="is_default" className="ml-2 text-sm text-slate-600">Es estado por defecto</label>
               </div>
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

export default SettingsDealStatuses;
