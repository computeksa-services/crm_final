import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { Quote, ClientCompany, ClientContact, CustomStatus, UserDecision } from '../types';
import Toast from '../components/Toast';

const QuoteCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [quote, setQuote] = useState<Partial<Quote>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);

  useEffect(() => {
    try {
      const queryParams = new URLSearchParams(location.search);
      Promise.all([
        MockApi.getClientCompanies(),
        MockApi.getClientContacts(),
        MockApi.getQuoteStatuses(),
        MockApi.getDeals(), // <-- Cargar tratos
      ]).then(([companiesData, contactsData, statusesData, dealsData]) => {
        setCompanies(companiesData);
        setContacts(contactsData);
        setDeals(dealsData); // <-- Guardar tratos en el estado
        const defaultStatus = statusesData.find(s => s.is_default) || statusesData[0];
        setQuote({
          // ... (resto del objeto quote sin cambios)
        });
      });
    } catch (error) {
      setToast({ message: 'Error al cargar datos iniciales.', type: 'error' });
    }
  }, [location.search]);

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
    if (!quote) return;
    setProcessing(true);
    try {
      const newQuote = await MockApi.addQuote(quote);
      setToast({ message: 'Cotización creada con éxito.', type: 'success' });
      navigate(`/quotes/${newQuote.id_cotizacion}`);
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar.', type: 'error' });
    } finally {
      setProcessing(false);
    }
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
                <label className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente</label>
                <select name="id_client_company" value={quote.id_client_company || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">-- Seleccionar --</option>
                  {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contacto Principal</label>
                <select name="id_contact" value={quote.id_contact || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg bg-white" disabled={!quote.id_client_company}>
                  <option value="">-- Seleccionar --</option>
                  {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                </select>
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
              <label className="block text-xs font-bold text-slate-500 mb-1">Nota Adicional</label>
              <textarea name="nota" value={quote.nota || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg" />
            </div>

          <div className="flex justify-end pt-4 space-x-2">
              <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSave} disabled={processing} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                  {processing && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar y Continuar
              </button>
          </div>
      </div>
    </div>
  );
};

export default QuoteCreate;
