import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { Quote, ClientCompany, ClientContact, QuoteStatus, Deal, UserDecision } from '../types';
import Toast from '../components/Toast';

const QuoteCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // Usar useAuth
  
  const [quote, setQuote] = useState<Partial<Quote>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]); // Nuevo estado para estados de cotización
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return; // Asegurar que user y tenant/user IDs existan

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
      
      // Inicializar el estado de la cotización, respetando los parámetros de la URL
      let initialState: Partial<Quote> = {
        nombre_cotizacion: dealName ? `Cotización para ${dealName}` : '',
        id_trato: dealId || '',
        id_client_company: clientCompanyId || '',
        id_contact: contactId || '',
        id_quote_status: defaultStatus?.id_status || '',
        tiempo_entrega: '5-7 días laborables',
        garantia: '12 meses',
        validez_oferta: '30 días',
        id_tenant: tenantId, // Asegurar id_tenant
        id_user: userId, // Asegurar id_user
        version: 0, // Iniciar en versión 0
        estado_decision: UserDecision.PENDING, // Estado inicial de decisión
        total: "$0.00", // Valor inicial del total
      };
      
      // Si la empresa viene pre-seleccionada, filtrar los contactos para esa empresa
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
    
    // Si se cambia el trato, actualizamos cliente y contacto
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
        id_user: user.id_user, // Asegurar id_user como creador
        fecha_emision: new Date().toISOString(), // Usar fecha actual
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/cotizaciones', {
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

  // Renderizado condicional del selector de tratos para cuando viene de un trato o no.
  const renderDealSelector = () => {
    if (quote.id_trato && location.search.includes('dealId')) {
      const selectedDeal = deals.find(d => d.id_trato === quote.id_trato);
      return (
        <input 
          type="text"
          value={selectedDeal?.nombre_trato || ''}
          disabled
          className="w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-500"
        />
      );
    } else if (deals.length === 0) {
      return (
        <div className="px-3 py-2 text-sm text-slate-500 bg-slate-50 border rounded-lg">
          No hay tratos disponibles. Cree un trato primero.
        </div>
      );
    } else {
      return (
        <select name="id_trato" value={quote.id_trato || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white">
          <option value="">-- Seleccionar Trato --</option>
          {deals.map(d => <option key={d.id_trato} value={d.id_trato}>{d.nombre_trato}</option>)}
        </select>
      );
    }
  };

  // Renderizado condicional del selector de empresa cliente
  const renderClientCompanySelector = () => {
    const isDisabled = !!location.search.includes('dealId');
    return (
      <select name="id_client_company" value={quote.id_client_company || ''} onChange={handleInputChange} required 
        className="w-full px-3 py-2 border rounded-lg bg-white"
        disabled={isDisabled}
      >
        <option value="">-- Seleccionar --</option>
        {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
      </select>
    );
  };

  // Renderizado condicional del selector de contacto principal
  const renderContactSelector = () => {
    const isDisabled = !quote.id_client_company || !!location.search.includes('dealId');
    return (
      <select name="id_contact" value={quote.id_contact || ''} onChange={handleInputChange} required 
        className="w-full px-3 py-2 border rounded-lg bg-white" 
        disabled={isDisabled}
      >
        <option value="">-- Seleccionar --</option>
        {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
      </select>
    );
  };


  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center space-x-3 mb-4">
         <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">
           <i className="fa-solid fa-arrow-left"></i>
         </button>
         <h1 className="text-2xl font-bold text-slate-800">Nueva Cotización</h1>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Detalles Principales</h2>
           <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de la Cotización</label>
              <input name="nombre_cotizacion" value={quote.nombre_cotizacion || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Trato Asociado</label>
                {renderDealSelector()}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Estado de Cotización</label>
                <select
                  name="id_quote_status"
                  value={quote.id_quote_status || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Estado --</option>
                  {quoteStatuses.map(status => (
                    <option key={status.id_status} value={status.id_status}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente</label>
                {renderClientCompanySelector()}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                {renderContactSelector()}
              </div>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 border-b pb-2 pt-4">Condiciones Comerciales</h2>
             <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tiempo de Entrega</label>
                <input name="tiempo_entrega" value={quote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
               <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Garantía</label>
                <input name="garantia" value={quote.garantia || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
               <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Validez de la Oferta</label>
                <input name="validez_oferta" value={quote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mensaje (Opcional)</label>
              <textarea name="mensaje" value={quote.mensaje || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg"></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Correos Adicionales (Separados por coma)</label>
              <input name="correos_adicionales" value={quote.correos_adicionales || ''} onChange={handleInputChange} placeholder="ejemplo@otro.com, ejemplo2@otro.com" className="w-full px-3 py-2 border rounded-lg" />
            </div>

            <div className="flex justify-end pt-4 space-x-2 border-t mt-6">
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >Cancelar</button>
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={processing}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center"
              >
                {processing && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                Crear Cotización
              </button>
            </div>
      </div>
    </div>
  );
};

export default QuoteCreate;
