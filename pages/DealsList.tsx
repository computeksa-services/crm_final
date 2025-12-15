import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, User, DealStatus, DealInterest } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';

const DealsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- ESTADOS DE DATOS ---
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<DealInterest[]>([]);
  
  // --- ESTADOS DE UI Y FILTROS ---
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState('');
  
  // --- ESTADOS DE MODALES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareDealId, setShareDealId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // --- CARGA DE DATOS ---
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
            const text = await res.text();
            throw new Error(`Error: ${res.status} - ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const [dealsData, companiesData, contactsData, usersData, statusesData, interestsData] = await Promise.all([
        parseResponse(dealsRes),
        parseResponse(companiesRes),
        parseResponse(contactsRes),
        parseResponse(usersRes),
        parseResponse(dealStatusesRes),
        parseResponse(interestStatusesRes)
      ]);

      setDeals(dealsData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setUsers(usersData);
      setDealStatuses(statusesData);
      setInterestStatuses(interestsData);

    } catch (e: any) {
      console.error("Error cargando datos:", e);
      setToast({ message: 'Error al cargar los tratos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTROS DE CONTACTOS EN MODAL ---
  useEffect(() => {
    if (editingDeal?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === editingDeal.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [editingDeal?.id_client_company, contacts]);

  // --- LÓGICA DE FILTRADO (Buscador) ---
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        (deal.nombre_trato || '').toLowerCase().includes(searchLower) ||
        (deal.client_company_name || '').toLowerCase().includes(searchLower) ||
        (deal.contact_full_name || '').toLowerCase().includes(searchLower) ||
        (deal.owner_name || '').toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter ? deal.id_deal_status === statusFilter : true;
      const matchesInterest = interestFilter ? deal.id_interest === interestFilter : true;

      return matchesSearch && matchesStatus && matchesInterest;
    });
  }, [deals, searchTerm, statusFilter, interestFilter]);

  // --- HANDLERS ---
  const handleRowClick = (id: string) => navigate(`/deals/${id}`);

  const handleAddNew = () => {
    if (!user?.id_tenant) return;
    if (companies.length === 0) {
      setToast({ message: 'Primero debe crear una Empresa Cliente.', type: 'error' });
      return;
    }
    const defaultStatus = dealStatuses.find(s => s.is_default) || dealStatuses[0];
    const defaultInterest = interestStatuses.find(s => s.is_default) || interestStatuses[0];

    setEditingDeal({
      nombre_trato: '',
      valor_trato: 0,
      id_client_company: '',
      id_contact: '',
      id_user_owner: user.id_user,
      id_deal_status: defaultStatus?.id_status || '',
      id_interest: defaultInterest?.id_interest || '',
      id_tenant: user.id_tenant,
      fecha_creacion: new Date().toISOString(),
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };
  
  const handleEdit = (deal: Deal) => {
    // Limpiamos el valor monetario para que sea un número editable (quitamos $)
    const rawValue = typeof deal.valor_trato === 'string' 
        ? parseFloat((deal.valor_trato as string).replace(/[^0-9.-]+/g,"")) 
        : deal.valor_trato;

    setEditingDeal({
        ...deal,
        valor_trato: rawValue
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Trato',
      message: '¿Estás seguro? Esta acción eliminará el trato y sus historiales.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/deals/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: id, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!response.ok) throw new Error('Error al eliminar trato.');
          
          setToast({ message: 'Trato eliminado.', type: 'success' });
          fetchData();
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal || !user?.id_tenant) return;
    
    if (!editingDeal.nombre_trato || !editingDeal.id_client_company || !editingDeal.id_deal_status) {
      setToast({ message: 'Complete los campos obligatorios.', type: 'error' });
      return;
    }

    setSubmitting(true);
    const payload = {
        ...editingDeal,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        // Asegurar que valor sea número
        valor_trato: parseFloat(editingDeal.valor_trato as any) || 0
    };

    const endpoint = isEditMode ? 'update' : 'create';
    // Nota: Ajusta la URL de create si es diferente a 'deals' base
    const url = isEditMode 
        ? `https://service.computeksa.com/webhook/api/deals/update`
        : `https://service.computeksa.com/webhook/api/deals`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar el trato.');

      setToast({ message: isEditMode ? 'Trato actualizado.' : 'Trato creado.', type: 'success' });
      setIsModalOpen(false); 
      fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false); 
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingDeal(prev => {
        if (!prev) return null;
        if (name === 'id_client_company') {
            return { ...prev, [name]: value, id_contact: '' }; // Reset contact on company change
        }
        return { ...prev, [name]: value };
    });
  };

  // --- RENDERIZADO ---
  const renderContent = () => {
    if (loading) {
        return (
          <div className="p-12 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
              <p className="text-slate-500 font-medium">Cargando tratos...</p>
          </div>
        );
    }

    if (deals.length === 0) {
        return (
            <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-handshake text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-700">No hay tratos registrados</h3>
                <p className="text-slate-500 max-w-sm mt-1 mb-6">Comienza a registrar tus oportunidades de venta para hacer seguimiento.</p>
                <button onClick={handleAddNew} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                    Crear Primer Trato
                </button>
            </div>
        );
    }

    if (filteredDeals.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron resultados con los filtros actuales.</p>
                <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setInterestFilter(''); }} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trato</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Interés</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Propietario</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredDeals.map((deal) => (
                        <tr 
                            key={deal.id_trato} 
                            onClick={() => handleRowClick(deal.id_trato)}
                            className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                        >
                            <td className="px-6 py-4">
                                <span className="font-bold text-brand-600 text-sm hover:underline block mb-0.5">
                                    {deal.nombre_trato}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {deal.created_at_fmt}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-700">{deal.client_company_name}</span>
                                    <span className="text-xs text-slate-500">{deal.contact_full_name}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="font-bold text-slate-700 font-mono bg-slate-100 px-2 py-1 rounded">
                                    {deal.valor_trato}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span 
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
                                    style={{ 
                                        backgroundColor: `${deal.estado_color || '#cccccc'}15`, 
                                        color: deal.estado_color || '#333',
                                        borderColor: `${deal.estado_color || '#cccccc'}40`
                                    }}
                                >
                                    {deal.estado_icon && <i className={`${deal.estado_icon} mr-1.5`}></i>}
                                    {deal.estado_nombre}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5" title={deal.interes_nombre}>
                                    <i className={`${deal.interes_icon || 'fa-solid fa-circle'} text-xs`} style={{ color: deal.interes_color }}></i>
                                    <span className="text-xs font-medium text-slate-600">{deal.interes_nombre}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <img 
                                        src={deal.owner_avatar || `https://ui-avatars.com/api/?name=${deal.owner_name}&background=random`} 
                                        alt="Owner" 
                                        className="w-6 h-6 rounded-full border border-slate-200"
                                    />
                                    <span className="text-xs text-slate-600 truncate max-w-[100px]">{deal.owner_name}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Botones de acción solo si tiene permisos */}
                                    {(deal.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEdit(deal); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                                title="Editar"
                                            >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShareDealId(deal.id_trato); setIsShareOpen(true); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                title="Compartir"
                                            >
                                                <i className="fa-solid fa-user-plus"></i>
                                            </button>
                                        </>
                                    )}
                                    
                                    {(deal.created_by === user?.id_user || user?.rol_user === 'admin') && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(deal.id_trato); }}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tratos</h1>
            <p className="text-slate-500 text-sm mt-1">Gestiona y monitorea tus oportunidades de venta.</p>
        </div>
        <button 
            onClick={handleAddNew} 
            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> Nuevo Trato
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por trato, cliente o encargado..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             {/* Filtro Estado */}
             <div className="relative w-full md:w-48">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                    <option value="">Todos los Estados</option>
                    {dealStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
             </div>

             {/* Filtro Interés */}
             <div className="relative w-full md:w-48">
                <select 
                    value={interestFilter}
                    onChange={(e) => setInterestFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                    <option value="">Cualquier Interés</option>
                    {interestStatuses.map(i => <option key={i.id_interest} value={i.id_interest}>{i.name}</option>)}
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
             </div>
         </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {renderContent()}
      </div>

      {/* Pagination Footer (Visual) */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {filteredDeals.length} de {deals.length} registros</span>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">
                  {isEditMode ? 'Editar Trato' : 'Nuevo Trato'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-6">
              
              {/* Sección 1: Info Básica */}
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Información General</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-full">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Trato</label>
                        <input 
                            type="text" 
                            name="nombre_trato" 
                            required 
                            value={editingDeal.nombre_trato || ''} 
                            onChange={handleInputChange} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                            placeholder="Ej. Venta de Licencias Q4"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Valor (USD)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <input 
                                type="number" 
                                name="valor_trato" 
                                required 
                                value={editingDeal.valor_trato || ''} 
                                onChange={handleInputChange} 
                                className="w-full pl-7 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                                step="0.01" 
                                min="0"
                            />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Cierre Esperada</label>
                        <input 
                            type="date" 
                            name="fecha_cierre_esperada" 
                            value={editingDeal.fecha_cierre_esperada?.split('T')[0] || ''} 
                            onChange={handleInputChange} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                        />
                      </div>
                  </div>
              </div>

              {/* Sección 2: Cliente */}
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cliente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Empresa</label>
                        <select
                          name="id_client_company"
                          required
                          value={editingDeal.id_client_company || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">-- Seleccionar Empresa --</option>
                          {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                        <select
                          name="id_contact"
                          value={editingDeal.id_contact || ''}
                          onChange={handleInputChange}
                          disabled={!editingDeal.id_client_company}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">-- Seleccionar Contacto --</option>
                          {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                        </select>
                      </div>
                  </div>
              </div>

              {/* Sección 3: Estado y Clasificación */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Clasificación</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                        <select
                          name="id_deal_status"
                          required
                          value={editingDeal.id_deal_status || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">-- Estado --</option>
                          {dealStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Interés</label>
                        <select
                          name="id_interest"
                          required
                          value={editingDeal.id_interest || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">-- Interés --</option>
                          {interestStatuses.map(i => <option key={i.id_interest} value={i.id_interest}>{i.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Propietario</label>
                        <select
                          name="id_user_owner"
                          required
                          value={editingDeal.id_user_owner || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {users.map(u => <option key={u.id_user} value={u.id_user}>{u.name_user}</option>)}
                        </select>
                      </div>
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                <textarea 
                    name="descripcion" 
                    value={editingDeal.descripcion || ''} 
                    onChange={handleInputChange} 
                    rows={3} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Detalles adicionales sobre el trato..."
                ></textarea>
              </div>

              {/* Footer Modal */}
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all"
                >Cancelar</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70"
                >
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
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