import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, User, DealStatus, DealInterest } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';

const DealsList: React.FC = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<DealInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareDealId, setShareDealId] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [dealsRes, companiesRes, contactsRes, usersRes, dealStatusesRes, interestStatusesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/interests?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const errorText = await res.text();
          throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const dealsData = await parseResponse(dealsRes);
      const companiesData = await parseResponse(companiesRes);
      const contactsData = await parseResponse(contactsRes);
      const usersData = await parseResponse(usersRes);
      const dealStatusesData = await parseResponse(dealStatusesRes);
      const interestStatusesData = await parseResponse(interestStatusesRes);

      // El backend ya envía datos enriquecidos (estado_nombre, interes_nombre, client_company_name, etc.)
      setDeals(dealsData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setUsers(usersData);
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);

    } catch (e: any) {
      console.error("Error al cargar datos:", e);
      setToast({ message: e.message || 'Error al cargar los datos del trato.', type: 'error' });
      setDeals([]);
      setCompanies([]);
      setContacts([]);
      setUsers([]);
      setDealStatuses([]);
      setInterestStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
    if (!user?.id_tenant || !user?.id_user) {
      setToast({ message: 'Error de sesión. Vuelve a iniciar sesión.', type: 'error' });
      return;
    }
    if (companies.length === 0) {
      setToast({ message: 'Primero debe crear una Empresa Cliente.', type: 'error' });
      return;
    }
    const defaultStatus = dealStatuses.find(s => s.is_default) || dealStatuses[0];
    const defaultInterestStatus = interestStatuses.find(s => s.is_default) || interestStatuses[0];

    setEditingDeal({
      nombre_trato: '',
      valor_trato: 0,
      id_client_company: '',
      id_contact: '',
      id_user_owner: user.id_user, // Propietario por defecto es el usuario logueado
      id_deal_status: defaultStatus?.id_status || '',
      id_interest: defaultInterestStatus?.id_interest || '',
      id_tenant: user.id_tenant, // Asegurar id_tenant para nuevo trato
      fecha_creacion: new Date().toISOString(), // Fecha de creación actual
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
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant || !user?.id_user) return;
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/deals/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: id, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar trato.' }));
            throw new Error(errorData.message || 'Error al eliminar trato.');
          }
          setToast({ message: 'Trato eliminado.', type: 'success' });
          fetchData();
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal || !user?.id_tenant || !user?.id_user) return;
    
    // Validaciones
    if (!editingDeal.nombre_trato || !editingDeal.id_client_company || !editingDeal.id_deal_status || !editingDeal.id_interest) {
      setToast({ message: 'Por favor, complete los campos obligatorios: Nombre, Empresa, Estado e Interés.', type: 'error' });
      return;
    }

    setSubmitting(true);
    
    const payload = {
        ...editingDeal,
        id_tenant: user.id_tenant, // Asegura que el tenant ID sea el del usuario logueado
        id_user: user.id_user, // Para auditoría en la API
        id_user_owner: editingDeal.id_user_owner || user.id_user, // Asegura propietario
    };

    try {
      if (isEditMode && payload.id_trato) {
        // --- LÓGICA DE ACTUALIZACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/deals/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al actualizar trato.' }));
            throw new Error(errorData.message || 'Error al actualizar trato.');
        }
        setToast({ message: 'Trato actualizado.', type: 'success' });
      } else {
        // --- LÓGICA DE CREACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/deals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al crear trato.' }));
            throw new Error(errorData.message || 'Error al crear trato.');
        }
        setToast({ message: 'Trato creado.', type: 'success' });
      }
      setIsModalOpen(false); 
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar el trato.', type: 'error' });
    } finally {
      setSubmitting(false); 
      setConfirmState({ ...confirmState, isOpen: false });
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
                {deals.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">No hay tratos registrados.</td></tr>
                ) : (
                  deals.map((deal) => {
                    const canDelete = deal.created_by === user?.id_user;
                    const canEdit = deal.access_level === 'EDIT' || user?.rol_user === 'admin';
                    return (
                    <tr 
                      key={deal.id_trato} 
                      onClick={() => handleRowClick(deal.id_trato)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">{deal.nombre_trato}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{deal.client_company_name}</td>
                      <td className="px-6 py-4 text-slate-700">{deal.valor_trato}</td>
                      <td className="px-6 py-4 text-sm">
                         <span 
                           className="px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                           style={{ backgroundColor: `${deal.interes_color || '#cccccc'}20`, color: deal.interes_color }}
                         >
                           {deal.interes_icon && <i className={`${deal.interes_icon} mr-1.5`}></i>}
                           {deal.interes_nombre || 'N/A'}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                         <span 
                           className="px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                           style={{ backgroundColor: `${deal.estado_color || '#cccccc'}20`, color: deal.estado_color }}
                         >
                           {deal.estado_icon && <i className={`${deal.estado_icon} mr-1.5`}></i>}
                           {deal.estado_nombre}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{deal.owner_name}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          disabled={deal.access_level !== 'EDIT' && user?.rol_user !== 'admin'} 
                          onClick={(e) => { e.stopPropagation(); if(deal.access_level === 'EDIT' || user?.rol_user === 'admin') handleEdit(deal); }} 
                          className={`p-2 ${deal.access_level === 'EDIT' || user?.rol_user === 'admin' ? 'text-slate-400 hover:text-brand-600' : 'text-slate-300 cursor-not-allowed'}`}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          disabled={deal.access_level !== 'EDIT' && user?.rol_user !== 'admin'}
                          onClick={(e) => { e.stopPropagation(); if(deal.access_level === 'EDIT' || user?.rol_user === 'admin') { setShareDealId(deal.id_trato); setIsShareOpen(true); } }}
                          className={`p-2 ${deal.access_level === 'EDIT' || user?.rol_user === 'admin' ? 'text-slate-400 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
                          title="Compartir Trato"
                        >
                          <i className="fa-solid fa-user-plus"></i>
                        </button>
                        <button 
                          disabled={deal.created_by !== user?.id_user} 
                          onClick={(e) => { e.stopPropagation(); if(deal.created_by === user?.id_user) handleDelete(deal.id_trato); }} 
                          className={`p-2 ${deal.created_by === user?.id_user ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deal Create/Edit Modal */}
      {isModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Trato' : 'Nuevo Trato'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="nombre_trato" className="block text-xs font-bold text-slate-500 mb-1">Nombre del Trato</label>
                <input type="text" id="nombre_trato" name="nombre_trato" required value={editingDeal.nombre_trato || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label htmlFor="valor_trato" className="block text-xs font-bold text-slate-500 mb-1">Valor del Trato (USD)</label>
                <input type="number" id="valor_trato" name="valor_trato" required value={editingDeal.valor_trato || 0} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" step="0.01" />
              </div>
              <div>
                <label htmlFor="id_client_company" className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente</label>
                <select
                  id="id_client_company"
                  name="id_client_company"
                  required
                  value={editingDeal.id_client_company || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Empresa --</option>
                  {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="id_contact" className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                <select
                  id="id_contact"
                  name="id_contact"
                  value={editingDeal.id_contact || ''}
                  onChange={handleInputChange}
                  disabled={!editingDeal.id_client_company}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Contacto --</option>
                  {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="id_user_owner" className="block text-xs font-bold text-slate-500 mb-1">Propietario del Trato</label>
                <select
                  id="id_user_owner"
                  name="id_user_owner"
                  required
                  value={editingDeal.id_user_owner || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Propietario --</option>
                  {users.map(u => <option key={u.id_user} value={u.id_user}>{u.name_user}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="id_deal_status" className="block text-xs font-bold text-slate-500 mb-1">Estado del Trato</label>
                <select
                  id="id_deal_status"
                  name="id_deal_status"
                  required
                  value={editingDeal.id_deal_status || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Estado --</option>
                  {dealStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="id_interest" className="block text-xs font-bold text-slate-500 mb-1">Nivel de Interés</label>
                <select
                  id="id_interest"
                  name="id_interest"
                  required
                  value={editingDeal.id_interest || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Interés --</option>
                  {interestStatuses.map(i => <option key={i.id_interest} value={i.id_interest}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fecha_cierre_esperada" className="block text-xs font-bold text-slate-500 mb-1">Fecha Cierre Esperada</label>
                <input type="date" id="fecha_cierre_esperada" name="fecha_cierre_esperada" value={editingDeal.fecha_cierre_esperada?.split('T')[0] || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="col-span-full">
                <label htmlFor="descripcion" className="block text-xs font-bold text-slate-500 mb-1">Descripción (Opcional)</label>
                <textarea id="descripcion" name="descripcion" value={editingDeal.descripcion || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
              <div className="flex justify-end pt-4 space-x-2 border-t mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >Cancelar</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center"
                >
                  {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar Trato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareOpen && shareDealId && (
        <ShareModal 
          entity="deal" 
          id={shareDealId} 
          isOpen={isShareOpen} 
          onClose={() => { setIsShareOpen(false); setShareDealId(null); }} 
          onShared={() => setToast({ message: 'Trato compartido.', type: 'success' })}
        />
      )}
    </div>
  );
};

export default DealsList;