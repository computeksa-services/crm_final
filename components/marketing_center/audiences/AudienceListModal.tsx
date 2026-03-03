import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MarketingList } from '../../../types';
import Toast from '../../Toast';
import { marketingApi } from '../../../services/marketingApi';

interface AudienceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (list: MarketingList) => void;
  // Usamos 'any' en initialData para flexibilidad total con id_list/list_id
  initialData?: any; 
  tenantId: string;
  userId: string;
}

const AudienceListModal: React.FC<AudienceListModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  tenantId,
  userId,
}) => {
  // Inicializamos el estado
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'PRIVATE' as 'PRIVATE' | 'PUBLIC_TENANT',
    type: 'STATIC' as 'STATIC' | 'DYNAMIC',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Detectamos el ID de forma segura (soporta list_id o id_list)
  const currentListId = initialData?.list_id || initialData?.id_list;
  const isEditing = !!currentListId;

  // Efecto para cargar datos si es edición
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          description: initialData.description || '',
          visibility: (initialData.visibility as 'PRIVATE' | 'PUBLIC_TENANT') || 'PRIVATE',
          type: (initialData.type as 'STATIC' | 'DYNAMIC') || 'STATIC',
        });
      } else {
        // Reset form al abrir si es nuevo
        setFormData({ name: '', description: '', visibility: 'PRIVATE', type: 'STATIC' });
      }
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setToast({ message: 'El nombre es obligatorio.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      let result: MarketingList;
      
      if (isEditing) {
        // --- MODO EDICIÓN ---
        result = await marketingApi.updateList(
          tenantId,
          userId,
          currentListId, // ID seguro
          {
            name: formData.name,
            description: formData.description,
            visibility: formData.visibility,
            type: formData.type,
          }
        );
        setToast({ message: '✅ Audiencia actualizada correctamente.', type: 'success' });
      } else {
        // --- MODO CREACIÓN ---
        result = await marketingApi.createList(
          tenantId,
          userId,
          {
            name: formData.name,
            description: formData.description,
            visibility: formData.visibility,
            type: formData.type,
          }
        );
        setToast({ message: '✅ Audiencia creada correctamente.', type: 'success' });
      }
      
      // Esperamos un poco para que el usuario vea el mensaje
      setTimeout(() => {
        onSuccess(result);
        onClose();
        setToast(null); 
      }, 1000);

    } catch (error) {
      console.error('Error saving list:', error);
      setToast({ message: 'Error al conectar con el servidor.', type: 'error' });
      setSubmitting(false); 
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className={`fa-solid ${isEditing ? 'fa-pen-to-square text-amber-500' : 'fa-plus-circle text-blue-600'}`}></i>
            {isEditing ? 'Editar Audiencia' : 'Nueva Audiencia'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 transition-colors text-2xl leading-none"
            type="button"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
              placeholder="Ej: Clientes VIP 2024"
              autoFocus
              disabled={submitting}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm resize-none"
              placeholder="¿A quiénes agrupa esta lista?"
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Visibilidad */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Visibilidad
              </label>
              <select
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                disabled={submitting}
              >
                <option value="PRIVATE">🔒 Privada</option>
                <option value="PUBLIC_TENANT">🌍 Pública</option>
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Tipo
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                disabled={submitting}
              >
                <option value="STATIC">🖐 Manual</option>
                <option value="DYNAMIC">⚙️ Dinámica</option>
              </select>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-6 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-800 transition-all text-sm"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2.5 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={submitting}
            >
              {submitting ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <>{isEditing ? 'Actualizar' : 'Crear Audiencia'}</>
              )}
            </button>
          </div>
        </form>

        {/* Toast Notification */}
        {toast && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-[60]">
             <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
              />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AudienceListModal;
