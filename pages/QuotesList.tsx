import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';

const QuotesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Partial<Quote> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Filters State (New)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; isDestructive?: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [quotesRes, companiesRes, contactsRes, statusesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/quotes?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`)
      ]);
      
      if (!quotesRes.ok) {
        if (quotesRes.status === 404) setQuotes([]);
        else throw new Error('Error al cargar cotizaciones');
        return;
      }
      const parse = async (res: Response) => { const t = await res.text(); return t ? JSON.parse(t) : []; };
      const quotesData = await parse(quotesRes);
      const companiesData = await parse(companiesRes);
      const contactsData = await parse(contactsRes);
      const statusesData = await parse(statusesRes);
      setQuotes(quotesData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setQuoteStatuses(statusesData);

    } catch (e) {
      setToast({ message: 'Error al cargar las cotizaciones.', type: 'error' });
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (editingQuote?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === editingQuote.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [editingQuote?.id_client_company, contacts]);

  // Logic for Client-Side Filtering
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (quote.formatted_no_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.client_company_name || '').toLowerCase().includes(searchLower) ||
        (quote.nombre_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.owner_name || '').toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter ? quote.id_quote_status?.toString() === statusFilter : true;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const handleRowClick = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    // No setIsEditMode needed as per simplified logic, just modal open
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isCompanyChange = name === 'id_client_company';
    setEditingQuote(prev => (prev ? { ...prev, [name]: value, ...(isCompanyChange && { id_contact: '' }) } : null));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote || !user?.id_tenant || !user?.id_user) return;
    if (!editingQuote.nombre_cotizacion || !editingQuote.id_client_company || !editingQuote.id_contact || !editingQuote.id_quote_status) {
      setToast({ message: 'Complete Nombre, Empresa, Contacto y Estado.', type: 'error' });
      return;
    }
    setSubmitting(true);
    const payload = {
      ...editingQuote,
      id_tenant: user.id_tenant,
      id_user: user.id_user,
      is_private: !!editingQuote.is_private,
    };
    try {
      const response = await fetch('/api/quotes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al actualizar cotización.' }));
        throw new Error(errorData.message || 'Error al actualizar cotización.');
      }
      setToast({ message: 'Cotización actualizada.', type: 'success' });
      setIsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar la cotización.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuote = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Cotización',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant || !user?.id_user) return;
        setSubmitting(true);
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/quotes/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_cotizacion: id, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar cotización.' }));
            throw new Error(errorData.message || 'Error al eliminar cotización.');
          }
          await fetchData();
          setToast({ message: 'Cotización eliminada.', type: 'success' });
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="p-12 text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
            <p className="text-slate-500 font-medium">Sincronizando cotizaciones...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-12 text-center">
             <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-4"></i>
            <p className="text-slate-600 font-medium">{error}</p>
        </div>
      );
    }
    if (quotes.length === 0) {
      return (
        <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <i className="fa-solid fa-file-invoice-dollar text-3xl text-slate-300"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-700">No hay cotizaciones aún</h3>
            <p className="text-slate-500 max-w-sm mt-1 mb-6">Crea tu primera cotización profesional para enviar a tus clientes y cerrar más tratos.</p>
            <Link to="/quotes/new" className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                Crear Primera Cotización
            </Link>
        </div>
      );
    }

    if (filteredQuotes.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron resultados para tu búsqueda.</p>
                <button onClick={() => { setSearchTerm(''); setStatusFilter(''); }} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Detalle</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredQuotes.map((quote) => (
              <tr 
                key={quote.id_cotizacion} 
                onClick={() => handleRowClick(quote.id_cotizacion)}
                className="hover:bg-slate-50/80 transition-all cursor-pointer group"
              >
                <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-brand-600 text-sm hover:underline">
                            #{quote.formatted_no_cotizacion || '---'}
                        </span>
                        <span className="text-slate-700 font-medium text-sm mt-0.5 truncate max-w-[200px]">
                            {quote.nombre_cotizacion || 'Sin Nombre'}
                            {quote.is_private && <i className="fa-solid fa-lock text-xs text-amber-500 ml-2" title="Privado"></i>}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mr-3 text-xs shrink-0">
                             <i className="fa-solid fa-building"></i>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{quote.client_company_name || 'N/A'}</span>
                            <span className="text-xs text-slate-400 truncate max-w-[180px]">{quote.contact_name}</span>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">
                    {quote.fecha_emision_fmt || new Date(quote.fecha_emision).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
                    style={{ 
                        backgroundColor: `${quote.estado_color || '#cccccc'}15`, 
                        color: quote.estado_color || '#333',
                        borderColor: `${quote.estado_color || '#cccccc'}40`
                    }}
                  >
                    {quote.estado_icon && <i className={`${quote.estado_icon} mr-1.5`}></i>}
                    {quote.estado_nombre || quote.estado || 'Desconocido'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                    <span className="font-bold text-slate-700">{quote.total}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(quote); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                      )}
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShareQuoteId(quote.id_cotizacion); setIsShareOpen(true); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Compartir"
                        >
                          <i className="fa-solid fa-user-plus"></i>
                        </button>
                      )}
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id_cotizacion); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/quotes/${quote.id_cotizacion}`); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <i className="fa-solid fa-chevron-right"></i>
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
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cotizaciones</h1>
            <p className="text-slate-500 text-sm mt-1">Gestiona, envía y monitorea tus propuestas comerciales.</p>
        </div>
        <Link to="/quotes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Cotización
        </Link>
      </div>

      {/* Filters & Actions Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por cliente, cotización..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative w-full md:w-48">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                    <option value="">Todos los Estados</option>
                    {quoteStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
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
      
      {/* Pagination (Visual Only for now as functionality fetches all) */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {filteredQuotes.length} de {quotes.length} registros</span>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">Editar Cotización</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de la Cotización</label>
                <input 
                    name="nombre_cotizacion" 
                    required 
                    value={editingQuote.nombre_cotizacion || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Ej. Renovación de Licencias 2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                    <select name="id_quote_status" required value={editingQuote.id_quote_status || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">-- Estado --</option>
                    {quoteStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Empresa</label>
                    <select name="id_client_company" required value={editingQuote.id_client_company || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">-- Empresa --</option>
                    {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                    </select>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contacto Principal</label>
                <select name="id_contact" required value={editingQuote.id_contact || ''} onChange={handleInputChange} disabled={!editingQuote.id_client_company} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">-- Seleccionar Contacto --</option>
                  {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                </select>
              </div>

              <div className="pt-2">
                 <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center"><i className="fa-solid fa-list-check mr-2 text-brand-500"></i> Condiciones</h3>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Tiempo Entrega</label>
                    <input name="tiempo_entrega" value={editingQuote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Garantía</label>
                    <input name="garantia" value={editingQuote.garantia || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Validez</label>
                    <input name="validez_oferta" value={editingQuote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mensaje (Opcional)</label>
                <textarea name="mensaje" value={editingQuote.mensaje || ''} onChange={handleInputChange} rows={2} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"></textarea>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <input type="checkbox" id="is_private_edit" name="is_private" checked={editingQuote.is_private || false} onChange={(e) => setEditingQuote({ ...(editingQuote || {}), is_private: e.target.checked })} className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
                <label htmlFor="is_private_edit" className="cursor-pointer">
                  <div className="text-sm font-bold text-amber-800">Cotización Privada</div>
                  <div className="text-xs text-amber-700/70 mt-0.5">
                    Solo visible para ti y administradores. No se comparte con el equipo.
                  </div>
                </label>
              </div>
              
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isDestructive={confirmState.isDestructive}
          onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
          onConfirm={confirmState.onConfirm || (() => setConfirmState({ ...confirmState, isOpen: false }))}
        />
      )}

      {isShareOpen && shareQuoteId && (
        <ShareModal 
          entity="quotes" 
          id={shareQuoteId} 
          isOpen={isShareOpen} 
          onClose={() => { setIsShareOpen(false); setShareQuoteId(null); }} 
          onShared={() => setToast({ message: 'Cotización compartida.', type: 'success' })}
          excludeUserIds={user ? [user.id_user] : []}
        />
      )}
    </div>
  );
};

export default QuotesList;