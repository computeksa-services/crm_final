import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Quote } from '../types';

// Helper para formatear moneda
const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(numValue)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(numValue);
};

interface SelectWinningQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedQuoteId: string, createInCartera: boolean) => void;
  quotes: Quote[];
  dealName: string;
  hasCarteraAccess?: boolean;
}

const SelectWinningQuoteModal: React.FC<SelectWinningQuoteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  quotes,
  dealName,
  hasCarteraAccess = false,
}) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [createInCartera, setCreateInCartera] = useState(false);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedQuoteId(null);
      setCreateInCartera(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedQuoteId) return;
    onConfirm(selectedQuoteId, createInCartera);
  };

  const backdrop = (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 99999, 
        backgroundColor: 'rgba(0, 0, 0, 0.7)', 
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start mb-4">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
              <i className="fa-solid fa-trophy text-green-600 text-xl"></i>
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-bold text-slate-900">
                ¡Trato Ganado!
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                El trato <span className="font-semibold text-slate-900">"{dealName}"</span> pasará a estado ganado. 
                Selecciona qué cotización fue aprobada por el cliente:
              </p>
            </div>
          </div>

          {/* Lista de cotizaciones */}
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {quotes.map((quote) => (
              <div
                key={quote.id_cotizacion}
                onClick={() => setSelectedQuoteId(quote.id_cotizacion)}
                className={`
                  relative p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${selectedQuoteId === quote.id_cotizacion 
                    ? 'border-brand-500 bg-brand-50' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }
                `}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${selectedQuoteId === quote.id_cotizacion
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-slate-300'
                      }
                    `}>
                      {selectedQuoteId === quote.id_cotizacion && (
                        <i className="fa-solid fa-check text-white text-xs"></i>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900">
                        Cotización #{quote.formatted_no_cotizacion || quote.no_cotizacion}
                      </h4>
                      <span className="text-lg font-bold text-slate-900">
                        {formatCurrency(quote.total)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {quote.nombre_cotizacion}
                    </p>
                    {quote.fecha_emision_fmt && (
                      <p className="text-xs text-slate-500 mt-1">
                        Emitida: {quote.fecha_emision_fmt}
                      </p>
                    )}
                    {quote.estado && (
                      <span 
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2"
                        style={{ 
                          backgroundColor: `${quote.estado_color}20`,
                          color: quote.estado_color || '#64748b'
                        }}
                      >
                        {quote.estado}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Checkbox para crear en cartera (solo si tiene acceso) */}
          {hasCarteraAccess && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={createInCartera}
                  onChange={(e) => setCreateInCartera(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-slate-900">
                    Crear transacción en cartera automáticamente
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Se creará un borrador en el módulo de cartera con los datos de la cotización
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Información adicional */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <i className="fa-solid fa-info-circle text-amber-600 mt-0.5"></i>
              <p className="ml-2 text-xs text-amber-800">
                Las demás cotizaciones de este trato se marcarán automáticamente como rechazadas.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            disabled={!selectedQuoteId}
            className={`
              w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 
              text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 
              sm:ml-3 sm:w-auto sm:text-sm transition-colors
              ${selectedQuoteId 
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                : 'bg-slate-300 cursor-not-allowed'
              }
            `}
            onClick={handleConfirm}
          >
            <i className="fa-solid fa-check mr-2"></i>
            Confirmar Ganadora
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
};

export default SelectWinningQuoteModal;
