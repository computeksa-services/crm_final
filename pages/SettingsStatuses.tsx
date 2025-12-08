import React, { useEffect, useState, useCallback } from 'react';
import { MockApi } from '../services/mockApi';
import { CustomStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import IconPicker from '../components/IconPicker';

type StatusType = 'deal' | 'quote' | 'interest';

const SettingsStatuses: React.FC = () => {
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deals, quotes, interests] = await Promise.all([
        MockApi.getDealStatuses(),
        MockApi.getQuoteStatuses(),
        MockApi.getInterestStatuses()
      ]);
      setDealStatuses(deals);
      setQuoteStatuses(quotes);
      setInterestStatuses(interests);
    } catch (e) {
      setToast({ message: 'Error al cargar estados.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // A generic component to render a list and handle its state
  const StatusManager: React.FC<{ title: string, statuses: CustomStatus[], type: StatusType, refreshData: () => void }> = ({ title, statuses, type, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingStatus, setEditingStatus] = useState<Partial<CustomStatus> | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    const [confirmState, setConfirmState] = useState({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {},
      isDestructive: false,
    });
    
    const handleAdd = () => {
        setEditingStatus({ name: '', color: '#cccccc', icon: 'fa-solid fa-circle' });
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    const handleEdit = (status: CustomStatus) => {
        setEditingStatus(status);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string, name: string) => {
        setConfirmState({
            isOpen: true,
            title: `Eliminar Estado "${name}"`,
            message: '¿Está seguro? Esta acción no se puede deshacer.',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    if (type === 'deal') await MockApi.deleteDealStatus(id);
                    else if (type === 'quote') await MockApi.deleteQuoteStatus(id);
                    else await MockApi.deleteInterestStatus(id);
                    setToast({ message: 'Estado eliminado.', type: 'success' });
                    refreshData();
                } catch (error) {
                    setToast({ message: 'Error al eliminar.', type: 'error' });
                }
            },
        });
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStatus) return;
        setSubmitting(true);
        
        const payload = { ...editingStatus };

        try {
            if (isEditMode && payload.id_status) {
                if (type === 'deal') {
                    await MockApi.updateDealStatus(payload.id_status, payload);
                } else if (type === 'quote') {
                    await MockApi.updateQuoteStatus(payload.id_status, payload);
                } else {
                    await MockApi.updateInterestStatus(payload.id_status, payload);
                }
                setToast({ message: 'Estado actualizado.', type: 'success' });
            } else {
                if (type === 'deal') {
                    await MockApi.addDealStatus(payload);
                } else if (type === 'quote') {
                    await MockApi.addQuoteStatus(payload);
                } else {
                    await MockApi.addInterestStatus(payload);
                }
                setToast({ message: 'Estado creado.', type: 'success' });
            }
            setIsModalOpen(false);
            refreshData();
        } catch (error) {
            setToast({ message: 'Error al guardar.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditingStatus(prev => (prev ? { ...prev, [name]: value } : null));
    };

    const handleIconSelect = (icon: string) => {
        setEditingStatus(prev => (prev ? { ...prev, icon } : null));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <ConfirmModal 
              {...confirmState}
              onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
            />

            {isIconPickerOpen && (
                <IconPicker 
                    onSelect={handleIconSelect}
                    onClose={() => setIsIconPickerOpen(false)}
                />
            )}
            
            {isModalOpen && editingStatus && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                      <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar' : 'Nuevo'} Estado</h2>
                      <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
                    </div>
                    <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                        <input name="name" value={editingStatus.name || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" placeholder="Ej: EN NEGOCIACIÓN" />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Icono</label>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => setIsIconPickerOpen(true)}
                            className="flex items-center justify-center w-10 h-10 text-xl text-slate-700 bg-slate-100 rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
                          >
                            <i className={editingStatus.icon || 'fa-solid fa-image'}></i>
                          </button>
                          <input
                            type="text"
                            readOnly
                            value={editingStatus.icon || ''}
                            onClick={() => setIsIconPickerOpen(true)}
                            className="w-full px-3 py-2 border rounded-lg bg-slate-50 font-mono text-sm cursor-pointer"
                            placeholder="Seleccionar un icono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Color</label>
                        <div className="flex items-center space-x-2">
                           <input type="color" name="color" value={editingStatus.color || '#cccccc'} onChange={handleInputChange} className="h-10 w-10 p-1 border rounded-lg" />
                           <input type="text" value={editingStatus.color || '#cccccc'} onChange={handleInputChange} name="color" className="w-full px-3 py-2 border rounded-lg font-mono" />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4 space-x-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                           {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                           Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
            )}

            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700">{title}</h3>
              <button onClick={handleAdd} className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded shadow-sm font-medium">
                <i className="fa-solid fa-plus mr-1"></i> Nuevo Estado
              </button>
            </div>
            <ul className="divide-y divide-slate-100 p-4 min-h-[150px]">
                {statuses.map(status => (
                    <li key={status.id_status} className="py-2 flex justify-between items-center group">
                        <div 
                          className="flex items-center pl-3 border-l-4 rounded-sm" 
                          style={{ borderColor: status.color }}
                        >
                           <i className={`${status.icon || 'fa-solid fa-genderless'} w-8 text-center text-slate-400`}></i>
                           <span className="font-medium text-slate-800 text-sm">{status.name}</span>
                        </div>
                        <div className="space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(status)} className="p-2 text-slate-400 hover:text-brand-600 text-xs"><i className="fa-solid fa-pen"></i></button>
                            <button onClick={() => handleDelete(status.id_status, status.name)} className="p-2 text-slate-400 hover:text-red-600 text-xs"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Ajustes del Tenant</h1>
        <p className="text-slate-500 text-sm">Personaliza los flujos de trabajo para tu equipo.</p>
      </div>

      {loading ? (
        <div className="text-center p-8 text-slate-500">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatusManager title="Estados de Tratos (Pipeline)" statuses={dealStatuses} type="deal" refreshData={fetchData} />
            <StatusManager title="Estados de Cotizaciones" statuses={quoteStatuses} type="quote" refreshData={fetchData} />
            <StatusManager title="Niveles de Interés" statuses={interestStatuses} type="interest" refreshData={fetchData} />
        </div>
      )}
    </div>
  );
};

export default SettingsStatuses;