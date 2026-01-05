import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact, ClientCompany } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientContactsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Datos
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  
  // UI & Filtros
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string[]}>({});
    const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal & Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | null>(null);
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
      const [contactsRes, companiesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`)
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

      const contactsData = await parseResponse(contactsRes);
      const companiesData = await parseResponse(companiesRes);

      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);

    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: 'Error al cargar contactos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter Functions
  const toggleColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: newValues };
    });
  };

  const getUniqueValues = (column: string) => {
    const valueCounts = new Map<string, number>();
    contacts.forEach(contact => {
      let val = '';
      if (column === 'company_name') {
        const companyName = getCompanyName(contact.id_client_company);
        val = companyName || '';
      } else if (column === 'position') {
        val = contact.position || '';
      }
      if (val) {
        valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
      }
    });
    return Array.from(valueCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const adjustDropdownPosition = (el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.position = 'absolute';
    el.style.top = '100%';
    el.style.left = '0';
    el.style.marginTop = '8px';
    el.style.zIndex = '50';
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setCompanyFilter('');
    setColumnFilters({});
  };

  const hasActiveFilters = useMemo(() => {
    const hasColumnFilters = Object.values(columnFilters).some(v => (v || []).length > 0);
    return Boolean(searchTerm || companyFilter || hasColumnFilters);
  }, [searchTerm, companyFilter, columnFilters]);

  // --- FILTROS ---
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const fullName = `${c.first_name} ${c.last_name || ''}`.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        fullName.includes(searchLower) ||
        (c.email || '').toLowerCase().includes(searchLower) ||
        (c.position || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      const matchesCompany = companyFilter ? c.id_client_company === companyFilter : true;
      if (!matchesCompany) return false;

      const matchesColumnFilters = Object.entries(columnFilters).every(([col, values]) => {
        if (values.length === 0) return true;
        if (col === 'company_name') {
          const companyName = getCompanyName(c.id_client_company);
          return values.includes(companyName || '');
        }
        if (col === 'position') {
          return values.includes(c.position || '');
        }
        return true;
      });
      if (!matchesColumnFilters) return false;

      return true;
    });
  }, [contacts, searchTerm, companyFilter, columnFilters]);

  const getCompanyName = (id: string | undefined) => {
    if (!id) return null;
    const comp = companies.find(c => c.id_client_company === id);
    return comp ? comp.name_company : null;
  };

  // --- HANDLERS ---
  const handleRowClick = (id: string) => navigate(`/client-contacts/${id}`);

  const handleAddNew = () => {
    if (companies.length === 0) {
      setToast({ message: 'Primero crea una Empresa Cliente.', type: 'error' });
      return;
    }
    setEditingContact({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      id_client_company: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (contact: ClientContact) => {
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_contact: id, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!response.ok) throw new Error('Error al eliminar contacto.');
          
          setToast({ message: 'Contacto eliminado.', type: 'success' });
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
    if (!editingContact || !user?.id_tenant) return;
    
    if (!editingContact.id_client_company || !editingContact.first_name) {
        setToast({ message: 'Empresa y Nombre son obligatorios.', type: 'error' });
        return;
    }

    setSubmitting(true);
    
    const payload = {
        ...editingContact,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
    };

    try {
      const url = isEditMode 
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/update`
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(isEditMode ? 'Error al actualizar.' : 'Error al crear.');
      
      setToast({ message: isEditMode ? 'Contacto actualizado.' : 'Contacto creado.', type: 'success' });
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
    setEditingContact(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // Renderizado condicional
  const renderContent = () => {
    if (loading) {
        return (
          <div className="p-12 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
              <p className="text-slate-500 font-medium">Cargando contactos...</p>
          </div>
        );
    }

    if (contacts.length === 0) {
        return (
            <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-address-book text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-700">No hay contactos</h3>
                <p className="text-slate-500 max-w-sm mt-1 mb-6">Añade personas clave de tus empresas clientes.</p>
                <button onClick={handleAddNew} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                    Crear Primer Contacto
                </button>
            </div>
        );
    }

    if (filteredContacts.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron contactos con los filtros actuales.</p>
                <button onClick={clearAllFilters} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Contacto</th>
                  <th className="px-6 py-4 border-b relative overflow-visible">
                    <div className="flex items-center justify-between">
                      <span>Empresa</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'company_name' ? null : 'company_name'); }}
                        className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                          (columnFilters.company_name || []).length > 0 ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                        }`}
                      >
                        <i className="fa-solid fa-filter text-[10px]"></i>
                      </button>
                    </div>
                    {openFilterColumn === 'company_name' && (
                      <div
                        ref={(el) => adjustDropdownPosition(el)}
                        className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[220px] max-h-[280px] overflow-y-auto"
                        onMouseLeave={() => setOpenFilterColumn(null)}
                      >
                        {getUniqueValues('company_name').map((val) => (
                          <label key={val.value} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(columnFilters.company_name || []).includes(val.value)}
                              onChange={() => toggleColumnFilter('company_name', val.value)}
                              className="mr-3 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                            />
                                     {hasActiveFilters && (
                                       <button
                                         onClick={clearAllFilters}
                                         className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all flex items-center"
                                       >
                                         <i className="fa-solid fa-rotate-left mr-2 text-xs"></i>
                                         Restablecer
                                       </button>
                                     )}

                            <span className="text-sm text-slate-700 flex-1">{val.label}</span>
                            <span className="text-xs text-slate-400">({val.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </th>
                  <th className="px-6 py-4 border-b relative overflow-visible">
                    <div className="flex items-center justify-between">
                      <span>Cargo</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'position' ? null : 'position'); }}
                        className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                          (columnFilters.position || []).length > 0 ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                        }`}
                      >
                        <i className="fa-solid fa-filter text-[10px]"></i>
                      </button>
                    </div>
                    {openFilterColumn === 'position' && (
                      <div
                        ref={(el) => adjustDropdownPosition(el)}
                        className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[220px] max-h-[280px] overflow-y-auto"
                        onMouseLeave={() => setOpenFilterColumn(null)}
                      >
                        {getUniqueValues('position').map((val) => (
                          <label key={val.value} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(columnFilters.position || []).includes(val.value)}
                              onChange={() => toggleColumnFilter('position', val.value)}
                              className="mr-3 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                            />
                            <span className="text-sm text-slate-700 flex-1">{val.label}</span>
                            <span className="text-xs text-slate-400">({val.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </th>
                  <th className="px-6 py-4 border-b">Datos de Contacto</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredContacts.map((contact) => {
                    const companyName = getCompanyName(contact.id_client_company);
                    return (
                    <tr 
                      key={contact.id_contact} 
                      onClick={() => handleRowClick(contact.id_contact)}
                      className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm border border-slate-200">
                                {contact.first_name?.charAt(0)}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{contact.first_name} {contact.last_name}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {companyName ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <i className="fa-solid fa-building mr-1.5 text-[10px]"></i>
                                {companyName}
                            </span>
                        ) : (
                            <span className="text-slate-400 text-xs italic">Sin empresa</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {contact.position || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col gap-1">
                            {contact.email && (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <i className="fa-regular fa-envelope text-slate-400 w-4"></i>
                                    {contact.email}
                                </div>
                            )}
                            {contact.phone && (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <i className="fa-solid fa-phone text-slate-400 w-4"></i>
                                    {contact.phone}
                                </div>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(contact); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(contact.id_contact); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Contactos (B2B)</h1>
           <p className="text-slate-500 text-sm mt-1">Personas clave de tus cuentas corporativas.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
            <i className="fa-solid fa-user-plus mr-2"></i> Nuevo Contacto
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
                placeholder="Buscar por nombre, email o cargo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="relative w-full md:w-64">
            <select 
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
            >
                <option value="">Todas las Empresas</option>
                {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
            </select>
            <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                <i className="fa-solid fa-chevron-down"></i>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {renderContent()}
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {filteredContacts.length} de {contacts.length} contactos</span>
      </div>
    </div>

    {/* Create/Edit Modal */}
    {isModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Empresa Cliente</label>
                <div className="relative">
                    <select
                        name="id_client_company"
                        required
                        value={editingContact.id_client_company || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                    >
                        <option value="">-- Seleccionar --</option>
                        {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                    </select>
                    <div className="absolute right-4 top-3 text-slate-400 pointer-events-none text-xs"><i className="fa-solid fa-chevron-down"></i></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                  <input name="first_name" value={editingContact.first_name || ''} onChange={handleInputChange} required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apellido</label>
                  <input name="last_name" value={editingContact.last_name || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Pérez" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cargo / Puesto</label>
                <input name="position" value={editingContact.position || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Gerente de Compras" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-400"><i className="fa-regular fa-envelope"></i></span>
                    <input type="email" name="email" value={editingContact.email || ''} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="juan@empresa.com" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-400"><i className="fa-solid fa-phone"></i></span>
                    <input name="phone" value={editingContact.phone || ''} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="+593 99..." />
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                    {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                    Guardar
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

export default ClientContactsList;