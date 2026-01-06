import React, { useState, useEffect } from 'react';
import { Quote, QuoteStatus } from '../types';
import Toast from './Toast';

interface QuoteEditModalProps {
  isOpen: boolean;
  quote: Quote | null;
  quoteStatuses: QuoteStatus[];
  onClose: () => void;
  onSave: (updatedQuote: Partial<Quote>) => Promise<void>;
  processing: boolean;
}

const QuoteEditModal: React.FC<QuoteEditModalProps> = ({ 
  isOpen, 
  quote, 
  quoteStatuses,
  onClose, 
  onSave, 
  processing 
}) => {
  const [formData, setFormData] = useState<Partial<Quote>>(quote || {});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (quote) {
      setFormData(quote);
    }
  }, [quote]);

  if (!isOpen || !quote) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await onSave(formData);
      onClose();
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mr-3 text-sm">
              <i className="fa-solid fa-pencil"></i>
            </span>
            Editar Cotización
          </h2>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Información Básica */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mr-2"></span>
              Información Básica
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Nombre de la Cotización <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nombre_cotizacion"
                  value={formData.nombre_cotizacion || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ej. Cotización Q1 2026"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Estado</label>
                <div className="relative">
                  <select
                    name="id_quote_status"
                    value={formData.id_quote_status || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 bg-white appearance-none"
                  >
                    <option value="">-- Seleccionar estado --</option>
                    {quoteStatuses.map(status => (
                      <option key={status.id_status} value={status.id_status}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-3.5 text-xs text-slate-400 pointer-events-none"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Condiciones Comerciales */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
              Condiciones Comerciales
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Tiempo de Entrega</label>
                <input
                  type="text"
                  name="tiempo_entrega"
                  value={formData.tiempo_entrega || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ej. 5-7 días"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Garantía</label>
                <input
                  type="text"
                  name="garantia"
                  value={formData.garantia || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ej. 12 meses"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Validez de Oferta</label>
                <input
                  type="text"
                  name="validez_oferta"
                  value={formData.validez_oferta || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ej. 30 días"
                />
              </div>
            </div>
          </div>

          {/* Notas y Mensajes */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2"></span>
              Notas y Comunicación
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Nota Interna</label>
              <textarea
                name="nota"
                value={formData.nota || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                placeholder="Notas internas para tu equipo (no visible para el cliente)..."
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Mensaje para el Cliente</label>
              <textarea
                name="mensaje"
                value={formData.mensaje || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                placeholder="Mensaje personalizado que verá el cliente..."
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Correos en Copia (CC)</label>
              <input
                type="text"
                name="correos_adicionales"
                value={formData.correos_adicionales || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Ej. admin@empresa.com, director@empresa.com"
              />
              <p className="text-xs text-slate-500 mt-1">Separa múltiples correos con comas</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white hover:border-slate-400 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={processing}
            className="px-5 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-200 disabled:opacity-70 disabled:shadow-none flex items-center transition-all"
          >
            {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
            Guardar Cambios
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default QuoteEditModal;
