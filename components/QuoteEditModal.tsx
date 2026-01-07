import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact } from '../types';
import Toast from './Toast';
import CompanyFormModal from './CompanyFormModal';
import ContactFormModal from './ContactFormModal';
import { createPortal } from 'react-dom';

interface QuoteEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Quote;
  onSuccess: (quote: Quote) => void;
}

const QuoteEditModal: React.FC<QuoteEditModalProps> = ({ isOpen, onClose, initialData, onSuccess }) => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<Partial<Quote>>(initialData || {});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const didLoadDataRef = useRef(false);

  useEffect(() => { if (initialData) setQuote(initialData); }, [initialData]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user || didLoadDataRef.current) return;
    didLoadDataRef.current = true;
    try {
      setLoading(true);
      const [companiesRes, contactsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`)
      ]);
      const parseData = async (res: Response) => {
        if (!res.ok) return [];
        const text = await res.text();
        if (!text || text.trim() === '') return [];
        try { const json = JSON.parse(text); return Array.isArray(json) ? json : (json.data || []); } catch { return []; }
      };
      const [companiesData, contactsData] = await Promise.all([parseData(companiesRes), parseData(contactsRes)]);
      setCompanies(companiesData);
      setContacts(contactsData);
      setFilteredContacts(contactsData.filter((c: ClientContact) => String(c.id_client_company) === String(quote.id_client_company)));
    } catch {
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, quote.id_client_company]);

  useEffect(() => { if (isOpen) { didLoadDataRef.current = false; fetchData(); } }, [isOpen, fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (name === 'id_client_company') {
      if (value === '__ADD_NEW_COMPANY__') { setIsCompanyModalOpen(true); return; }
      setQuote(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
      setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(value)));
    } else if (name === 'id_contact') {
      if (value === '__ADD_NEW_CONTACT__') { setIsContactModalOpen(true); return; }
      setQuote(prev => ({ ...prev, id_contact: value }));
    } else if (type === 'checkbox') {
      setQuote(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setQuote(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCompanyCreated = (newCompany: ClientCompany) => {
    setCompanies(prev => [...prev, newCompany]);
    setQuote(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
    setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(newCompany.id_client_company)));
    setIsCompanyModalOpen(false);
    setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
  };

  const handleContactCreated = (newContact: ClientContact) => {
    setContacts(prev => [...prev, newContact]);
    if (newContact.id_client_company && String(newContact.id_client_company) === String(quote.id_client_company)) {
      setFilteredContacts(prev => [...prev, newContact]);
    }
    setQuote(prev => ({ ...prev, id_contact: newContact.id_contact }));
    setIsContactModalOpen(false);
    setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
  };

  const handleSave = async () => {
    if (!quote.nombre_cotizacion || !quote.id_client_company || !quote.id_contact) {
      setToast({ message: 'Nombre, Empresa y Contacto son obligatorios.', type: 'error' });
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...quote, id_tenant: user?.id_tenant, id_user: user?.id_user })
      });
      if (!res.ok) throw new Error('Error al actualizar la cotización');
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const updatedQuote = Array.isArray(data) ? data[0] : data;
      setToast({ message: 'Cotización actualizada correctamente.', type: 'success' });
      onSuccess(updatedQuote);
      setTimeout(() => onClose(), 300);
    } catch (e: any) {
      setToast({ message: e.message || 'Error en el proceso', type: 'error' });
      setProcessing(false);
    }
  };

  const selectedCompany = useMemo(() => companies.find(c => String(c.id_client_company) === String(quote.id_client_company)), [companies, quote.id_client_company]);
  const selectedContact = useMemo(() => contacts.find(c => String(c.id_contact) === String(quote.id_contact)), [contacts, quote.id_contact]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-pen-to-square text-brand-600"></i> Editar Cotización</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400"><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2"><i className="fa-solid fa-file-invoice-dollar text-brand-600"></i> Información</h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre de Cotización *</label>
                <input name="nombre_cotizacion" value={quote.nombre_cotizacion || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ej. Cotización Software 2025" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Total</label>
                <div className="relative"><span className="absolute left-3 top-2 text-slate-400 font-bold">$</span><input name="total" type="number" value={quote.total || ''} onChange={handleInputChange} className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono" placeholder="0.00" step="0.01" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha Emisión</label>
                <input name="fecha_emision" type="date" value={(quote.fecha_emision as string)?.split('T')[0] || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2"><i className="fa-solid fa-building-user text-brand-600"></i> Cliente</h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa *</label>
                <select name="id_client_company" value={quote.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                  <option value="">-- Seleccionar Empresa --</option>
                  <option value="__ADD_NEW_COMPANY__" className="font-bold text-emerald-600">+ Nueva Empresa</option>
                  {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                </select>
              </div>
              {selectedCompany && (
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start justify-between"><div className="flex-1"><p className="font-bold text-brand-900 text-sm mb-1">{selectedCompany.name_company}</p><p className="text-brand-600 font-mono text-xs">{selectedCompany.id_number}</p></div><div className="bg-brand-200 text-brand-800 px-2 py-1 rounded text-[10px] font-bold">{selectedCompany.label_name}</div></div>
                  <div className="space-y-1 text-brand-700"><p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-location-dot opacity-50 w-3"></i> {selectedCompany.city}</p>{selectedCompany.phone_company && <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedCompany.phone_company}</p>}</div>
                </div>
              )}
              {quote.id_client_company && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto *</label>
                  <select name="id_contact" value={quote.id_contact || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">-- Seleccionar Contacto --</option>
                    <option value="__ADD_NEW_CONTACT__" className="font-bold text-emerald-600">+ Nuevo Contacto</option>
                    {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                  </select>
                  {selectedContact && (
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs space-y-2 mt-3">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-xs">{selectedContact.first_name?.charAt(0)}{selectedContact.last_name?.charAt(0)}</div><div className="flex-1"><p className="font-bold text-slate-800">{selectedContact.first_name} {selectedContact.last_name}</p>{selectedContact.position && <p className="text-slate-500 text-[10px]">{selectedContact.position}</p>}</div></div>
                      <div className="space-y-1 text-slate-600"><p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-envelope opacity-50 w-3"></i> {selectedContact.email}</p>{selectedContact.phone && <p className="flex items-center gap-2 text-[11px]"><i className="fa-solid fa-phone opacity-50 w-3"></i> {selectedContact.phone}</p>}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2"><i className="fa-solid fa-file-contract text-brand-600"></i> Condiciones</h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Validez de Oferta (días)</label>
                <input name="validez_oferta" value={quote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tiempo de Entrega</label>
                <input name="tiempo_entrega" value={quote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="15 días" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Garantía</label>
                <input name="garantia" value={quote.garantia || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="1 año" />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={processing || loading} className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2">{processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>} Guardar Cambios</button>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>

      <CompanyFormModal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} mode="create" onSuccess={handleCompanyCreated} />
      <ContactFormModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} mode="create" initialData={quote.id_client_company ? { id_client_company: quote.id_client_company } : undefined} onSuccess={handleContactCreated} companies={companies} />
    </div>,
    document.body
  );
};

export default QuoteEditModal;

