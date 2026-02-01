import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { apiFetch } from '../services/apiClient';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

// Interfaz para las etiquetas del tenant
interface TenantLabel {
  id_label: string;
  name: string;
  color: string;
  total_empresas: number | string;
}

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
  '#28A745', // Green
  '#007BFF', // Light Blue
  '#FFC107', // Warning
  '#DC3545', // Danger
  '#CCCCCC', // Gray
];

const SettingsCompanyLabels: React.FC = () => {
  const { user } = useAuth();
  const { companyLabels, invalidateCompanyLabels } = useDataCache();
  
  // Edición
  const [editingLabel, setEditingLabel] = useState<Partial<TenantLabel> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // UI States
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {},
    isDestructive: false 
  });

  // --- CRUD ---
  const handleAddNew = () => {
    setEditingLabel({ 
      name: '', 
      color: PRESET_COLORS[0],
      total_empresas: 0
    });
    setIsModalOpen(true);
  };

  const handleEdit = (label: TenantLabel) => {
    setEditingLabel(label);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingLabel || !editingLabel.name || !user?.id_tenant) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }

    const payload = { 
      ...editingLabel, 
      id_tenant: user.id_tenant,
      id_user: user.id_user 
    };
    const isUpdating = 'id_label' in editingLabel;
    const url = isUpdating 
      ? `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels/update` 
      : `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels`;

    try {
      const response = await apiFetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });

      if (response.ok) {
        setToast({ 
          message: isUpdating ? 'Etiqueta actualizada.' : 'Etiqueta creada.', 
          type: 'success' 
        });
        setIsModalOpen(false);
        setEditingLabel(null);
        await invalidateCompanyLabels();
      } else {
        setToast({ message: 'Error al guardar etiqueta.', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Error al guardar etiqueta.', type: 'error' });
    }
  };

  const handleDelete = (label: TenantLabel) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Etiqueta',
      message: `¿Está seguro que desea eliminar la etiqueta "${label.name}"? Esta acción no se puede deshacer.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const payload = {
            id_label: label.id_label,
            id_tenant: user?.id_tenant,
            id_user: user?.id_user
          };
          const res = await apiFetch(
            `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/labels/delete`,
            { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }
          );
          
          if (res.ok) {
            setToast({ message: 'Etiqueta eliminada.', type: 'success' });
            await invalidateCompanyLabels();
          } else {
            setToast({ message: 'Error al eliminar etiqueta.', type: 'error' });
          }
        } catch (error) {
          setToast({ message: 'Error al eliminar etiqueta.', type: 'error' });
        }
        setConfirmState({ ...confirmState, isOpen: false });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Crea etiquetas personalizadas para clasificar y organizar tus empresas. Facilita la segmentación y búsqueda de clientes por categorías específicas.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-all flex items-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> Nuevo
        </button>
      </div>

      {/* Lista de Etiquetas */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {companyLabels.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
            <p>No hay etiquetas configuradas.</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
            {companyLabels.map((label) => (
              <div
                key={label.id_label}
                className="group p-4 rounded-xl border transition-all shadow-sm"
                style={{
                  borderColor: `${label.color}40`,
                  backgroundColor: `${label.color}08`
                }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm"
                    style={{ backgroundColor: `${label.color}15`, color: label.color }}
                  >
                    <i className="fa-solid fa-tag"></i>
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold text-base truncate" style={{ color: label.color }}>
                      {label.name}
                    </span>
                    {(user?.rol_user === 'admin' || user?.rol_user === 'superadmin') && (
                      <span className="text-xs text-slate-500">
                        {label.total_empresas} {label.total_empresas === 1 ? 'empresa' : 'empresas'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(label)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    title="Editar"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(label)}
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
      {isModalOpen && editingLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative m-4">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="font-bold text-lg text-slate-800">
                {'id_label' in editingLabel ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vista previa */}
              <div className="flex justify-center">
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50 transition-all"
                  style={{ borderColor: `${editingLabel.color}40`, backgroundColor: `${editingLabel.color}10` }}
                >
                  <div className="text-xl" style={{ color: editingLabel.color }}>
                    <i className="fa-solid fa-tag"></i>
                  </div>
                  <span className="font-bold text-lg" style={{ color: editingLabel.color }}>
                    {editingLabel.name || 'Nombre Etiqueta'}
                  </span>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                <input
                  type="text"
                  value={editingLabel.name || ''}
                  onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ej. Cliente VIP"
                  autoFocus
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Color</label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingLabel({ ...editingLabel, color })}
                      className={`w-8 h-8 rounded-full transition-all border-2 ${
                        editingLabel.color === color
                          ? 'border-slate-600 scale-110 shadow-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {(user?.rol_user === 'admin' || user?.rol_user === 'superadmin') && 'id_label' in editingLabel && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Empresas asignadas</label>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-2xl font-bold text-emerald-600">
                      {editingLabel.total_empresas}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {editingLabel.total_empresas === 1 ? 'empresa' : 'empresas'} con esta etiqueta
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingLabel(null);
                }}
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

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        isDestructive={confirmState.isDestructive}
      />
    </div>
  );
};

export default SettingsCompanyLabels;
