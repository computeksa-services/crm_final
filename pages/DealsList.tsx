import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { Deal, ClientCompany, ClientContact, User, CustomStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const DealsList: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealsData, companiesData, contactsData, usersData, statusesData, interestStatusesData] = await Promise.all([
        MockApi.getDeals(),
        MockApi.getClientCompanies(),
        MockApi.getClientContacts(),
        MockApi.getUsers(),
        MockApi.getDealStatuses(),
        MockApi.getInterestStatuses(),
      ]);
      setDeals(dealsData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setUsers(usersData);
      setDealStatuses(statusesData);
      setInterestStatuses(interestStatusesData);
    } catch (e) {
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (editingDeal?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === editingDeal.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [editingDeal?.id_client_company, contacts]);
  
  const handleRowClick = (id: string) => navigate(`/deals/${id}`);

  const handleAddNew = () => {
    if (companies.length === 0) {
      setToast({ message: 'Primero debe crear una Empresa Cliente.', type: 'error' });
      return;
    }
    const defaultStatus = dealStatuses.find(s => s.is_default) || dealStatuses[0];
    setEditingDeal({
      nombre_trato: '',
      valor_trato: 0,
      id_client_company: '',
      id_contact: '',
      id_deal_status: defaultStatus?.id_status || '',
      id_interest_status: 'is_2', // Default to 'Medio'
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };
  
  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Trato',
      message: '¿Está seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await MockApi.deleteDeal(id);
          setToast({ message: 'Trato eliminado.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    setSubmitting(true);
    try {
      if (isEditMode && editingDeal.id_trato) {
        await MockApi.updateDeal(editingDeal.id_trato, editingDeal);
        setToast({ message: 'Trato actualizado.', type: 'success' });
      } else {
        await MockApi.addDeal(editingDeal);
        setToast({ message: 'Trato creado.', type: 'success' });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isCompanyChange = name === 'id_client_company';
    setEditingDeal(prev => (prev ? { ...prev, [name]: value, ...(isCompanyChange && { id_contact: '' }) } : null));
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tratos</h1>
          <p className="text-slate-500 text-sm">Gestiona tus oportunidades de venta.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nuevo Trato
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando tratos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Nombre del Trato</th>
                  <th className="px-6 py-4 border-b">Empresa Cliente</th>
                  <th className="px-6 py-4 border-b">Valor</th>
                  <th className="px-6 py-4 border-b">Interés</th>
                  <th className="px-6 py-4 border-b">Estado</th>
                  <th className="px-6 py-4 border-b">Propietario</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals.map((deal) => (
                  <tr key={deal.id_trato} onClick={() => handleRowClick(deal.id_trato)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-6 py-4 font-medium text-slate-800">{deal.nombre_trato}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{deal.client_company_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">${deal.valor_trato.toLocaleString('es-EC')}</td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                        style={{ backgroundColor: `${deal.interes_color}20`, color: deal.interes_color }}
                      >
                        {deal.interes_icon && <i className={`${deal.interes_icon} mr-1.5`}></i>}
                        {deal.interes}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                        style={{ backgroundColor: `${deal.estado_color}20`, color: deal.estado_color }}
                      >
                        {deal.estado_icon && <i className={`${deal.estado_icon} mr-1.5`}></i>}
                        {deal.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{deal.owner_name}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(deal); }} className="p-2 text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen-to-square"></i></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(deal.id_trato); }} className="p-2 text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Trato' : 'Nuevo Trato'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Trato</label>
                <input name="nombre_trato" value={editingDeal.nombre_trato || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente</label>
                  <select name="id_client_company" value={editingDeal.id_client_company || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="">-- Seleccionar --</option>
                    {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                  <select name="id_contact" value={editingDeal.id_contact || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white" disabled={!editingDeal.id_client_company}>
                    <option value="">-- Seleccionar --</option>
                    {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Valor del Trato (USD)</label>
                  <input type="number" name="valor_trato" value={editingDeal.valor_trato || 0} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Interés</label>
                  <select name="id_interest_status" value={editingDeal.id_interest_status || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white">
                    {interestStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                <select name="id_deal_status" value={editingDeal.id_deal_status || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white">
                  {dealStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                  {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar Trato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsList;