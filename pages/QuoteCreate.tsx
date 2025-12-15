import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus, Deal, UserDecision } from '../types';
import Toast from '../components/Toast';

const QuoteCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [quote, setQuote] = useState<Partial<Quote>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;

    const tenantId = user.id_tenant;
    const userId = user.id_user;

    const queryParams = new URLSearchParams(location.search);
    const dealId = queryParams.get('dealId');
    const clientCompanyId = queryParams.get('clientCompanyId');
    const contactId = queryParams.get('contactId');
    const dealName = queryParams.get('dealName');

    try {
      const [companiesRes, contactsRes, statusesRes, dealsRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/deals?id_tenant=${tenantId}&id_user=${userId}`),
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

      const companiesData = await parseResponse(companiesRes);
      const contactsData = await parseResponse(contactsRes);
      const statusesData = await parseResponse(statusesRes);
      const dealsData = await parseResponse(dealsRes);

      setCompanies(companiesData);
      setContacts(contactsData);
      setQuoteStatuses(statusesData);
      setDeals(dealsData);
      
      const defaultStatus = statusesData.find((s: QuoteStatus) => s.is_default) || statusesData[0];
      
      let initialState: Partial<Quote> = {
        nombre_cotizacion: dealName ? `Cotización para ${dealName}` : '',
        id_trato: dealId || '',
        id_client_company: clientCompanyId || '',
        id_contact: contactId || '',
        id_quote_status: defaultStatus?.id_status || '',
        tiempo_entrega: '5-7 días laborables',
        garantia: '12 meses',
        validez_oferta: '30 días',
        id_tenant: tenantId,
        id_user: userId,
        version: 0,
        estado_decision: UserDecision.PENDING,
        total: "$0.00",
      };
      
      if (initialState.id_client_company) {
        setFilteredContacts(contactsData.filter((c: ClientContact) => c.id_client_company === initialState.id_client_company));
      }

      setQuote(initialState);
    } catch (error: any) {
      console.error("Error loading initial data for QuoteCreate:", error);
      setToast({ message: error.message || 'Error al cargar datos iniciales para la cotización.', type: 'error' });
    }
  }, [user, location.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (quote?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === quote.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [quote?.id_client_company, contacts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'id_trato') {
      const selectedDeal = deals.find(d => d.id_trato === value);
      setQuote(prev => ({ 
        ...prev, 
        id_trato: value,
        id_client_company: selectedDeal?.id_client_company || '',
        id_contact: selectedDeal?.id_contact || '',
      }));
    } else {
      setQuote(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!quote || !quote.nombre_cotizacion || !quote.id_client_company || !quote.id_contact || !quote.id_trato || !user?.id_tenant || !user?.id_user) {
      setToast({ message: 'Por favor, complete todos los campos requeridos, incluyendo el Trato Asociado y asegúrate de iniciar sesión.', type: 'error' });
      return;
    }

    setProcessing(true);
    setToast({ message: 'Guardando cotización...', type: 'success' });

    try {
      const payload = { 
        ...quote,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        fecha_emision: new Date().toISOString(),
      };

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al crear cotización.' }));
        throw new Error(errorData.message || 'Error al crear cotización.');
      }

      setToast({ message: 'Cotización creada con éxito. Redirigiendo...', type: 'success' });
      
      setTimeout(() => {
        const queryParams = new URLSearchParams(location.search);
        const dealId = queryParams.get('dealId');

        if (dealId) {
          navigate(`/deals/${dealId}`);
        } else {
          navigate('/quotes');
        }
      }, 1500);

    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar la cotización.', type: 'error' });
      setProcessing(false);
    } 
  };

  const renderDealSelector = () => {
    if (quote.id_trato && location.search.includes('dealId')) {
      const selectedDeal = deals.find(d => d.id_trato === quote.id_trato);
      return (
        <div className="relative">
            <input 
            type="text"
            value={selectedDeal?.nombre_trato || ''}
            disabled
            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-medium"
            />
            <div className="absolute right-4 top-3.5 text-slate-400">
                <i className="fa-solid fa-lock"></i>
            </div>
        </div>
      );
    } else if (deals.length === 0) {
      return (
        <div className="px-4 py-3 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl flex items-center">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>
          No hay tratos disponibles. Cree un trato primero.
        </div>
      );
    } else {
      return (
        <div className="relative">
            <select name="id_trato" value={quote.id_trato || ''} onChange={handleInputChange} required className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none">
                <option value="">-- Seleccionar Trato --</option>
                {deals.map(d => <option key={d.id_trato} value={d.id_trato}>{d.nombre_trato}</option>)}
            </select>
            <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                <i className="fa-solid fa-chevron-down text-xs"></i>
            </div>
        </div>
      );
    }
  };

  const renderClientCompanySelector = () => {
    const isDisabled = !!location.search.includes('dealId');
    return (
      <div className="relative">
        <select name="id_client_company" value={quote.id_client_company || ''} onChange={handleInputChange} required 
            className={`w-full px-4 py-3 border border-slate-200 rounded-xl outline-none appearance-none ${isDisabled ? 'bg-slate-50 text-slate-500' : 'bg-white focus:ring-2 focus:ring-brand-500'}`}
            disabled={isDisabled}
        >
            <option value="">-- Seleccionar Empresa --</option>
            {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
        </select>
        <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
            {isDisabled ? <i className="fa-solid fa-lock text-xs"></i> : <i className="fa-solid fa-chevron-down text-xs"></i>}
        </div>
      </div>
    );
  };

  const renderContactSelector = () => {
    const isDisabled = !quote.id_client_company || !!location.search.includes('dealId');
    return (
      <div className="relative">
        <select name="id_contact" value={quote.id_contact || ''} onChange={handleInputChange} required 
            className={`w-full px-4 py-3 border border-slate-200 rounded-xl outline-none appearance-none ${isDisabled ? 'bg-slate-50 text-slate-500' : 'bg-white focus:ring-2 focus:ring-brand-500'}`}
            disabled={isDisabled}
        >
            <option value="">-- Seleccionar Contacto --</option>
            {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
        </select>
        <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
             {isDisabled && !quote.id_client_company ? <i className="fa-solid fa-ban text-xs"></i> : <i className="fa-solid fa-chevron-down text-xs"></i>}
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="flex items-center gap-4">
         <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-all shadow-sm"
         >
           <i className="fa-solid fa-arrow-left"></i>
         </button>
         <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nueva Cotización</h1>
            <p className="text-sm text-slate-500">Complete la información para generar un nuevo presupuesto comercial.</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          <div className="p-8 space-y-8">
            {/* Section 1: General Info */}
            <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                    Detalles Principales
                </h2>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de la Cotización</label>
                        <input 
                            name="nombre_cotizacion" 
                            value={quote.nombre_cotizacion || ''} 
                            onChange={handleInputChange} 
                            required 
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
                            placeholder="Ej. Propuesta de Servicios IT - Q4"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trato Asociado</label>
                            {renderDealSelector()}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Inicial</label>
                            <div className="relative">
                                <select
                                name="id_quote_status"
                                value={quote.id_quote_status || ''}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                                >
                                <option value="">-- Seleccionar Estado --</option>
                                {quoteStatuses.map(status => (
                                    <option key={status.id_status} value={status.id_status}>
                                    {status.name}
                                    </option>
                                ))}
                                </select>
                                <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                                    <i className="fa-solid fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Client Info */}
            <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                    Información del Cliente
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Empresa Cliente</label>
                        {renderClientCompanySelector()}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contacto Principal</label>
                        {renderContactSelector()}
                    </div>
                </div>
            </div>

            {/* Section 3: Commercial Conditions */}
            <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">3</span>
                    Condiciones Comerciales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tiempo de Entrega</label>
                        <input name="tiempo_entrega" value={quote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Garantía</label>
                        <input name="garantia" value={quote.garantia || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Validez Oferta</label>
                        <input name="validez_oferta" value={quote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                    </div>
                </div>
            </div>

            {/* Section 4: Extra Details */}
            <div>
                 <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">4</span>
                    Detalles Adicionales
                </h2>
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mensaje (Opcional)</label>
                        <textarea 
                            name="mensaje" 
                            value={quote.mensaje || ''} 
                            onChange={handleInputChange} 
                            rows={3} 
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none resize-none transition-all"
                            placeholder="Mensaje personalizado para el cliente..."
                        ></textarea>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correos en copia (CC)</label>
                        <input 
                            name="correos_adicionales" 
                            value={quote.correos_adicionales || ''} 
                            onChange={handleInputChange} 
                            placeholder="ejemplo@otro.com, gerente@empresa.com" 
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                        />
                        <p className="text-xs text-slate-400 mt-1">Separe múltiples correos con comas.</p>
                    </div>
                </div>
            </div>

            {/* Privacy Section */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex items-start space-x-4">
                <div className="flex-shrink-0 mt-0.5">
                    <input
                        type="checkbox"
                        id="is_private"
                        name="is_private"
                        checked={quote.is_private || false}
                        onChange={(e) => setQuote({ ...quote, is_private: e.target.checked })}
                        className="w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500 cursor-pointer"
                    />
                </div>
                <label htmlFor="is_private" className="flex-1 cursor-pointer">
                    <div className="font-bold text-amber-900 flex items-center">
                        <i className="fa-solid fa-lock mr-2 text-amber-600"></i>
                        Marcar como Cotización Privada
                    </div>
                    <div className="text-sm text-amber-800/70 mt-1">
                        Esta cotización solo será visible para usted y los administradores. No aparecerá en los listados generales del equipo.
                    </div>
                </label>
            </div>

          </div>

          <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-white hover:shadow-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={processing}
                className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center transition-all disabled:opacity-70 disabled:shadow-none"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
                Crear Cotización
              </button>
          </div>
      </div>
    </div>
  );
};

export default QuoteCreate;