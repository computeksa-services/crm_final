import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, CustomStatus } from '../types';
import Toast from '../components/Toast';

const DealCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [deal, setDeal] = useState<Partial<Deal>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;

    const tenantId = user.id_tenant;
    const userId = user.id_user;

    const queryParams = new URLSearchParams(location.search);
    const clientCompanyId = queryParams.get('clientCompanyId');
    const contactId = queryParams.get('contactId');

    try {
      const [companiesRes, contactsRes, dealStatusesRes, interestStatusesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/interests?id_tenant=${tenantId}&id_user=${userId}`),
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
      const dealStatusesData = await parseResponse(dealStatusesRes);
      const interestStatusesData = await parseResponse(interestStatusesRes);

      setCompanies(companiesData);
      setContacts(contactsData);
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);

      const defaultDealStatus = dealStatusesData.find((s: CustomStatus) => s.is_default) || dealStatusesData[0];
      const defaultInterest = interestStatusesData.find((s: CustomStatus) => s.is_default) || interestStatusesData[0];
      const defaultInterestId = (defaultInterest?.id_status as string | undefined) || (defaultInterest as any)?.id_interest || '';

      let initialState: Partial<Deal> = {
        nombre_trato: '',
        valor_trato: '',
        id_client_company: clientCompanyId || '',
        id_contact: contactId || '',
        id_deal_status: defaultDealStatus?.id_status || '',
        id_interest: defaultInterestId,
        id_tenant: tenantId,
        id_user_owner: userId,
        id_user: userId,
        descripcion: '',
        fecha_cierre_esperada: '',
      };

      if (initialState.id_client_company) {
        setFilteredContacts(contactsData.filter((c: ClientContact) => c.id_client_company === initialState.id_client_company));
      }

      setDeal(initialState);
    } catch (error: any) {
      console.error('Error loading initial data for DealCreate:', error);
      setToast({ message: error.message || 'Error al cargar datos iniciales para el trato.', type: 'error' });
    }
  }, [user, location.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (deal?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === deal.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [deal?.id_client_company, contacts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'id_client_company') {
      setDeal(prev => ({ ...prev, id_client_company: value, id_contact: '' }));
      setFilteredContacts(contacts.filter(c => c.id_client_company === value));
    } else {
      setDeal(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!deal || !deal.nombre_trato || !deal.id_client_company || !deal.id_contact || !deal.id_deal_status || !deal.id_interest || !user?.id_tenant || !user?.id_user) {
      setToast({ message: 'Por favor, complete todos los campos requeridos y asegúrese de iniciar sesión.', type: 'error' });
      return;
    }

    setProcessing(true);
    setToast({ message: 'Guardando trato...', type: 'success' });

    try {
      const payload = {
        ...deal,
        id_tenant: user.id_tenant,
        id_user_owner: user.id_user,
        id_user: user.id_user,
        created_at: new Date().toISOString(),
      };

      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al crear trato.' }));
        throw new Error(errorData.message || 'Error al crear trato.');
      }

      setToast({ message: 'Trato creado con éxito. Redirigiendo...', type: 'success' });

      setTimeout(() => {
        navigate('/deals');
      }, 1200);

    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar el trato.', type: 'error' });
      setProcessing(false);
    }
  };

  const renderStatusSelector = () => (
    <div className="relative">
      <select
        name="id_deal_status"
        value={deal.id_deal_status || ''}
        onChange={handleInputChange}
        required
        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
      >
        <option value="">-- Seleccionar Estado --</option>
        {dealStatuses.map(status => (
          <option key={status.id_status} value={status.id_status}>{status.name}</option>
        ))}
      </select>
      <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  );

  const renderInterestSelector = () => (
    <div className="relative">
      <select
        name="id_interest"
        value={deal.id_interest || ''}
        onChange={handleInputChange}
        required
        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
      >
        <option value="">-- Seleccionar Interés --</option>
        {interestStatuses.map(int => {
          const valueId = (int as any).id_status || (int as any).id_interest || (int as any).id;
          return (
            <option key={valueId} value={valueId}>{int.name}</option>
          );
        })}
      </select>
      <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  );

  const renderClientCompanySelector = () => (
    <div className="relative">
      <select
        name="id_client_company"
        value={deal.id_client_company || ''}
        onChange={handleInputChange}
        required
        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
      >
        <option value="">-- Seleccionar Empresa --</option>
        {companies.map(c => (
          <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>
        ))}
      </select>
      <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  );

  const renderContactSelector = () => {
    const isDisabled = !deal.id_client_company;
    return (
      <div className="relative">
        <select
          name="id_contact"
          value={deal.id_contact || ''}
          onChange={handleInputChange}
          required
          disabled={isDisabled}
          className={`w-full px-4 py-3 border border-slate-200 rounded-xl outline-none appearance-none ${isDisabled ? 'bg-slate-50 text-slate-500' : 'bg-white focus:ring-2 focus:ring-brand-500'}`}
        >
          <option value="">-- Seleccionar Contacto --</option>
          {filteredContacts.map(c => (
            <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>
          ))}
        </select>
        <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
          {isDisabled ? <i className="fa-solid fa-ban text-xs"></i> : <i className="fa-solid fa-chevron-down text-xs"></i>}
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nuevo Trato</h1>
          <p className="text-sm text-slate-500">Complete la información para crear un nuevo trato comercial.</p>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Trato</label>
                <input
                  name="nombre_trato"
                  value={deal.nombre_trato || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ej. Implementación CRM para Cliente"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valor Estimado</label>
                  <input
                    name="valor_trato"
                    value={deal.valor_trato || ''}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="Ej. 15000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Cierre Esperada</label>
                  <input
                    type="date"
                    name="fecha_cierre_esperada"
                    value={deal.fecha_cierre_esperada || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Inicial</label>
                  {renderStatusSelector()}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nivel de Interés</label>
                  {renderInterestSelector()}
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

          {/* Section 3: Description */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
              <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">3</span>
              Descripción
            </h2>
            <textarea
              name="descripcion"
              value={deal.descripcion || ''}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none resize-none transition-all"
              placeholder="Notas y detalles adicionales del trato..."
            ></textarea>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-5 py-3 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-800 hover:border-slate-300 bg-white transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={processing}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 shadow-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              {processing ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  Crear Trato
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealCreate;
