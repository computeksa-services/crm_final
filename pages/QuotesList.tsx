import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../types';
import Toast from '../components/Toast';

const QuotesList: React.FC = () => {
  const { user } = useAuth(); // Usar
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Partial<Quote> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return; // Comprobar también id_user
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BORRADOR': return 'bg-gray-100 text-gray-700';
      case 'ENVIADO': return 'bg-blue-100 text-blue-700';
      case 'APROBADO': return 'bg-green-100 text-green-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    setIsEditMode(true);
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

  const renderContent = () => {
    if (loading) {
      return <div className="p-8 text-center text-slate-500">Cargando cotizaciones...</div>;
    }
    if (error) {
      return <div className="p-8 text-center text-red-500">{error}</div>;
    }
    if (quotes.length === 0) {
      return <div className="p-8 text-center text-slate-500">No se encontraron cotizaciones. ¡Crea una nueva!</div>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4 border-b"># Cotización</th>
              <th className="px-6 py-4 border-b">Cliente</th>
              <th className="px-6 py-4 border-b">Nombre</th>
              <th className="px-6 py-4 border-b">Fecha</th>
              <th className="px-6 py-4 border-b">Estado</th>
              <th className="px-6 py-4 border-b">Total</th>
              <th className="px-6 py-4 border-b">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote, index) => {
              try {
                // INTENTAMOS RENDERIZAR LA FILA
                return (
                  <tr 
                    key={quote.id_cotizacion || index} 
                    onClick={() => handleRowClick(quote.id_cotizacion)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">#{quote.formatted_no_cotizacion || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{quote.client_company_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {quote.nombre_cotizacion || 'Sin Nombre'}
                      {quote.is_private && <span className="ml-2 text-xs text-amber-600" title="Cotización privada"><i className="fa-solid fa-lock"></i></span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{quote.fecha_emision_fmt || new Date(quote.fecha_emision).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                        style={{ backgroundColor: `${quote.estado_color || '#cccccc'}20`, color: quote.estado_color || '#333' }}
                      >
                        {quote.estado_icon && <i className={`${quote.estado_icon} mr-1.5`}></i>}
                        {quote.estado_nombre || quote.estado || 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{quote.total}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/quotes/${quote.id_cotizacion}`); }}
                          className="text-brand-600 font-medium text-sm hover:underline"
                        >
                          Ver Detalles <i className="fa-solid fa-arrow-right ml-1 text-xs"></i>
                        </button>
                        {quote.access_level === 'EDIT' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEdit(quote); }}
                            className="text-slate-700 font-medium text-sm hover:underline"
                          >
                            Editar <i className="fa-solid fa-pen ml-1 text-xs"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              } catch (e) {
                // SI FALLA, LO REPORTAMOS EN CONSOLA Y CONTINUAMOS
                console.error("Error al renderizar la fila de cotización. Datos problemáticos:", quote, e);
                return null; // No renderizar esta fila para evitar que la página se rompa
              }
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
        <Link to="/quotes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Cotización
        </Link>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {renderContent()}
      </div>

      {isModalOpen && editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Editar Cotización</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de la Cotización</label>
                <input name="nombre_cotizacion" required value={editingQuote.nombre_cotizacion || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Estado de Cotización</label>
                <select name="id_quote_status" required value={editingQuote.id_quote_status || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">-- Seleccionar Estado --</option>
                  {quoteStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Empresa</label>
                <select name="id_client_company" required value={editingQuote.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">-- Seleccionar Empresa --</option>
                  {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.client_company_name || c.name_company}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                <select name="id_contact" required value={editingQuote.id_contact || ''} onChange={handleInputChange} disabled={!editingQuote.id_client_company} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">-- Seleccionar Contacto --</option>
                  {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                </select>
              </div>
              <h3 className="text-md font-semibold text-slate-700">Condiciones Comerciales</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tiempo de Entrega</label>
                  <input name="tiempo_entrega" value={editingQuote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Garantía</label>
                  <input name="garantia" value={editingQuote.garantia || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Validez de la Oferta</label>
                  <input name="validez_oferta" value={editingQuote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Mensaje (Opcional)</label>
                <textarea name="mensaje" value={editingQuote.mensaje || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Correos Adicionales (Separados por coma)</label>
                <input name="correos_adicionales" value={editingQuote.correos_adicionales || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-lg">
                <input type="checkbox" id="is_private_edit" name="is_private" checked={editingQuote.is_private || false} onChange={(e) => setEditingQuote({ ...(editingQuote || {}), is_private: e.target.checked })} className="w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
                <label htmlFor="is_private_edit" className="flex-1 cursor-pointer">
                  <div className="font-semibold text-slate-700 flex items-center">
                    <i className="fa-solid fa-lock mr-2 text-slate-600"></i>
                    Cotización Privada
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Las cotizaciones privadas solo son visibles para ti y no se comparten con otros usuarios del equipo
                  </div>
                </label>
              </div>
              <div className="flex justify-end pt-4 space-x-2 border-t mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                  {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotesList;