import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quote, ClientCompany, ClientContact } from '../types';
import Toast from './Toast';

interface QuoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<Quote>;
  onSuccess?: (quote: Quote) => void;
  preselectedCompanyId?: string;
  preselectedContactId?: string;
  companies?: ClientCompany[];
  contacts?: ClientContact[];
}

const QuoteFormModal: React.FC<QuoteFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialData,
  onSuccess,
  preselectedCompanyId,
  preselectedContactId,
  companies = [],
  contacts = [],
}) => {
  const [formData, setFormData] = useState<Partial<Quote>>({
    nombre_cotizacion: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    id_client_company: preselectedCompanyId || '',
    id_contact: preselectedContactId || '',
    id_quote_status: '',
    total: '',
    tiempo_entrega: '',
    garantia: '',
    validez_oferta: '',
    nota: '',
    mensaje: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'edit' && initialData) {
      setFormData({
        id_cotizacion: initialData.id_cotizacion,
        nombre_cotizacion: initialData.nombre_cotizacion || '',
        fecha_emision: initialData.fecha_emision?.split('T')[0] || '',
        id_client_company: initialData.id_client_company || '',
        id_contact: initialData.id_contact || '',
        id_quote_status: initialData.id_quote_status || '',
        total: initialData.total || '',
        tiempo_entrega: initialData.tiempo_entrega || '',
        garantia: initialData.garantia || '',
        validez_oferta: initialData.validez_oferta || '',
        nota: initialData.nota || '',
        mensaje: initialData.mensaje || '',
        is_private: initialData.is_private || false,
      });
    } else if (isOpen && mode === 'create') {
      setFormData({
        nombre_cotizacion: '',
        fecha_emision: new Date().toISOString().split('T')[0],
        id_client_company: preselectedCompanyId || '',
        id_contact: preselectedContactId || '',
        id_quote_status: '',
        total: '',
        tiempo_entrega: '',
        garantia: '',
        validez_oferta: '',
        nota: '',
        mensaje: '',
        is_private: false,
      });
    }
  }, [isOpen, mode, initialData, preselectedCompanyId, preselectedContactId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validaciones básicas
      if (!formData.nombre_cotizacion?.trim()) {
        setToast({ message: 'El nombre de la cotización es requerido.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_client_company) {
        setToast({ message: 'Selecciona una empresa.', type: 'error' });
        setSubmitting(false);
        return;
      }

      if (!formData.id_contact) {
        setToast({ message: 'Selecciona un contacto.', type: 'error' });
        setSubmitting(false);
        return;
      }

      // TODO: Conectar al backend
      console.log('Quote form data to submit:', formData);
      setToast({ message: mode === 'create' ? 'Cotización creada exitosamente.' : 'Cotización actualizada exitosamente.', type: 'success' });
      
      onSuccess?.(formData as Quote);
      onClose();
    } catch (error: any) {
      setToast({ message: 'Error al procesar la cotización.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'create' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'}`}>
              <i className={`fa-solid ${mode === 'create' ? 'fa-file-invoice-dollar' : 'fa-pen-to-square'}`}></i>
            </div>
            {mode === 'create' ? 'Nueva Cotización' : 'Editar Cotización'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Empresa <span className="text-red-500">*</span>
              </label>
              <select
                name="id_client_company"
                required
                value={formData.id_client_company || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              >
                <option value="">Selecciona empresa</option>
                {companies.map(c => (
                  <option key={c.id_client_company} value={c.id_client_company}>
                    {c.name_company}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Contacto <span className="text-red-500">*</span>
              </label>
              <select
                name="id_contact"
                required
                value={formData.id_contact || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              >
                <option value="">Selecciona contacto</option>
                {contacts.map(c => (
                  <option key={c.id_contact} value={c.id_contact}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nombre de Cotización <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre_cotizacion"
              required
              value={formData.nombre_cotizacion || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
              placeholder="Ej. Cotización Software 2025"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Fecha Emisión
              </label>
              <input
                type="date"
                name="fecha_emision"
                value={formData.fecha_emision || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Total
              </label>
              <input
                type="number"
                name="total"
                value={formData.total || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Validez Oferta (días)
              </label>
              <input
                type="text"
                name="validez_oferta"
                value={formData.validez_oferta || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Tiempo Entrega
              </label>
              <input
                type="text"
                name="tiempo_entrega"
                value={formData.tiempo_entrega || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="15 días"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Garantía
              </label>
              <input
                type="text"
                name="garantia"
                value={formData.garantia || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="1 año"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nota
            </label>
            <textarea
              name="nota"
              value={formData.nota || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Mensaje
            </label>
            <textarea
              name="mensaje"
              value={formData.mensaje || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              placeholder="Mensaje para el cliente..."
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_private"
              id="is_private"
              checked={(formData.is_private as boolean) || false}
              onChange={handleInputChange}
              className="w-4 h-4 rounded border-slate-200"
            />
            <label htmlFor="is_private" className="text-sm text-slate-700 font-medium">
              Cotización privada (no sigue permisos compartidos)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              {mode === 'create' ? 'Crear Cotización' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuoteFormModal;
