import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientCompany, User } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientCompaniesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Datos
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // UI & Filtros
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal & Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<ClientCompany> | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const [companiesRes, usersRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const errorText = await res.text();
          throw new Error(`Error: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      setCompanies(await parseResponse(companiesRes));
      setUsers(await parseResponse(usersRes));

    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: 'Error al cargar empresas.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTROS ---
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (c.name_company || '').toLowerCase().includes(searchLower) ||
        (c.id_number || '').includes(searchLower) ||
        (c.industry || '').toLowerCase().includes(searchLower)
      );
    });
  }, [companies, searchTerm]);

  const getUserName = (id: string | undefined) => {
    if (!id) return '-';
    const creator = users.find(u => u.id_user === id);
    return creator ? creator.name_user : 'Desconocido';
  };

  // --- HANDLERS ---
  const handleRowClick = (id: string) => navigate(`/client-companies/${id}`);

  const handleAddNew = () => {
    if (!user?.id_tenant) return;
    setEditingCompany({
      id_type: 'RUC',
      id_number: '',
      name_company: '',
      industry: '',
      address: '',
      city: '',
      website: '',
      phone_company: '',
      email_company: '',
      id_tenant: user.id_tenant,
      created_by: user.id_user,
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (comp: ClientCompany) => {
    setEditingCompany(comp);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Empresa',
      message: '¿Estás seguro? Se eliminarán también todos los contactos asociados a esta empresa.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id_client_company: id, 
              id_tenant: user.id_tenant, 
              id_user: user.id_user
            }),
          });
          if (!response.ok) throw new Error('Error al eliminar empresa.');
          
          setToast({ message: 'Empresa eliminada.', type: 'success' });
          await fetchData(); 
        } catch (error: any) {
          setToast({ message: error.message, type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !user?.id_tenant) return;
    
    // Validación
    if(!editingCompany.name_company || !editingCompany.id_number) {
        setToast({ message: 'Razón Social y Número de ID son obligatorios.', type: 'error' });
        return;
    }

    setSubmitting(true);
    
    const payload = {
        ...editingCompany,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        created_by: editingCompany.created_by || user.id_user,
    };

    try {
      const url = isEditMode 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/update`
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(isEditMode ? 'Error al actualizar.' : 'Error al crear.');
      
      setToast({ message: isEditMode ? 'Empresa actualizada.' : 'Empresa creada.', type: 'success' });
      setIsModalOpen(false); 
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false); 
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingCompany(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // Renderizado condicional
  const renderContent = () => {
    if (loading) {
        return (
          <div className="p-12 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
              <p className="text-slate-500 font-medium">Cargando clientes...</p>
          </div>
        );
    }

    if (companies.length === 0) {
        return (
            <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-building text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-700">No hay empresas</h3>
                <p className="text-slate-500 max-w-sm mt-1 mb-6">Registra tus clientes corporativos para gestionar contactos y tratos.</p>
                <button onClick={handleAddNew} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                    Crear Primera Empresa
                </button>
            </div>
        );
    }

    if (filteredCompanies.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron empresas con los filtros actuales.</p>
                <button onClick={() => setSearchTerm('')} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar búsqueda</button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Empresa</th>
                  <th className="px-6 py-4 border-b">Identificación</th>
                  <th className="px-6 py-4 border-b">Industria</th>
                  <th className="px-6 py-4 border-b">Ubicación</th>
                  <th className="px-6 py-4 border-b">Creado Por</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCompanies.map((comp) => (
                    <tr 
                      key={comp.id_client_company} 
                      onClick={() => handleRowClick(comp.id_client_company)}
                      className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-100">
                                <i className="fa-solid fa-building"></i>
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{comp.name_company}</div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    {comp.website && (
                                        <a href={comp.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                            <i className="fa-solid fa-link text-[10px]"></i> Web
                                        </a>
                                    )}
                                    {comp.email_company && (
                                        <a href={`mailto:${comp.email_company}`} onClick={(e) => e.stopPropagation()} className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1">
                                            <i className="fa-regular fa-envelope text-[10px]"></i> Email
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{comp.id_type || 'ID'}</span>
                            <span className="text-slate-700 font-mono text-sm">{comp.id_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {comp.industry ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {comp.industry}
                            </span>
                        ) : (
                            <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {comp.city || comp.address ? (
                            <div className="flex items-center gap-1" title={comp.address}>
                                <i className="fa-solid fa-location-dot text-slate-400 text-xs"></i>
                                {comp.city || 'Sin ciudad'}
                            </div>
                        ) : (
                            <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-bold border border-slate-200">
                                {getUserName(comp.created_by).charAt(0)}
                            </div>
                            <span className="text-xs text-slate-600 truncate max-w-[100px]">{getUserName(comp.created_by)}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(comp); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(comp.id_client_company); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
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
    <>
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Empresas (B2B)</h1>
           <p className="text-slate-500 text-sm mt-1">Cartera de clientes corporativos.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
            <i className="fa-solid fa-plus mr-2"></i> Nueva Empresa
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
                placeholder="Buscar por nombre, RUC o industria..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {renderContent()}
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {filteredCompanies.length} de {companies.length} empresas</span>
      </div>
    </div>

    {/* Create/Edit Modal */}
    {isModalOpen && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-5">
              
              {/* Sección Identificación */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo ID</label>
                    <select
                        name="id_type"
                        required
                        value={editingCompany.id_type || 'RUC'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    >
                        <option value="RUC">RUC</option>
                        <option value="CI">Cédula</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Número ID</label>
                    <input
                        type="text"
                        name="id_number"
                        required
                        value={editingCompany.id_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                        placeholder="17900..."
                    />
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Razón Social</label>
                <input type="text" name="name_company" required value={editingCompany.name_company || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all" placeholder="Ej. Corporación Favorita C.A." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industria</label>
                    <input type="text" name="industry" value={editingCompany.industry || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Ej. Tecnología" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ciudad</label>
                    <input type="text" name="city" value={editingCompany.city || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Quito" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección</label>
                <input type="text" name="address" value={editingCompany.address || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Av. Amazonas y..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                    <input type="email" name="email_company" value={editingCompany.email_company || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="contacto@empresa.com" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                    <input type="text" name="phone_company" value={editingCompany.phone_company || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="022..." />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sitio Web</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-400"><i className="fa-solid fa-globe"></i></span>
                    <input type="url" name="website" value={editingCompany.website || ''} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="https://..." />
                </div>
              </div>
              
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                  Guardar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </>
  );
};

export default ClientCompaniesList;