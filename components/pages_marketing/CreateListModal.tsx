import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi } from '../../services/marketingApi';

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateListModal: React.FC<CreateListModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'STATIC' as 'STATIC' | 'DYNAMIC',
    visibility: 'PRIVATE' as 'PRIVATE' | 'PUBLIC_TENANT'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !user) return;

    try {
      setIsSubmitting(true);
      await marketingApi.createList(user.id_tenant, user.id_user, {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        visibility: formData.visibility
      });
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'STATIC',
        visibility: 'PRIVATE'
      });
      
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error creando lista:', error);
      alert('Error al crear la lista');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Nueva Lista de Difusión</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la lista <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required
              autoFocus
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              placeholder="Ej: Clientes Potenciales 2024"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Propósito de esta lista..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
              <select 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                disabled={isSubmitting}
              >
                <option value="STATIC">Estática (Manual)</option>
                <option value="DYNAMIC">Dinámica (Filtros)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Visibilidad</label>
              <select 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                value={formData.visibility}
                onChange={(e) => setFormData({...formData, visibility: e.target.value as any})}
                disabled={isSubmitting}
              >
                <option value="PRIVATE">Privada</option>
                <option value="PUBLIC_TENANT">Pública (Tenant)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creando...' : 'Crear Lista'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateListModal;
