import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus, Deal, UserDecision, CustomStatus, DealChannel } from '../types';
import Toast from '../components/Toast';

const QuoteCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // --- ESTADOS DE DATOS ---
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  // Aunque ya no seleccionamos estado manualmente, cargamos los status por si necesitamos lógica interna
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]); 
  const [dealStatuses, setDealStatuses] = useState<CustomStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<CustomStatus[]>([]);
  const [dealChannels, setDealChannels] = useState<DealChannel[]>([]);
  
  // --- ESTADOS DEL FORMULARIO ---
  const [quote, setQuote] = useState<Partial<Quote>>({});
  const [newDeal, setNewDeal] = useState<any>({}); 
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  
  // --- ESTADOS DE UI ---
  const [createNewDeal, setCreateNewDeal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- CARGA INICIAL ---
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
      setIsLoading(true);
      const endpoints = [
        `clients/companies?id_tenant=${tenantId}&id_user=${userId}`,
        `clients/contacts?id_tenant=${tenantId}&id_user=${userId}`,
        `statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`,
        `deals?id_tenant=${tenantId}&id_user=${userId}`,
        `statuses/deals?id_tenant=${tenantId}&id_user=${userId}`,
        `statuses/interests?id_tenant=${tenantId}&id_user=${userId}`,
        `channel?id_tenant=${tenantId}&id_user=${userId}`
      ];

      const responses = await Promise.all(
        endpoints.map(ep => fetch(`https://service.computeksa.com/webhook/api/${ep}`))
      );

      const data = await Promise.all(responses.map(async (res, index) => {
        try {
          if (!res.ok) {
            // Si es 404 o cualquier error, devolver array vacío
            console.warn(`Endpoint ${endpoints[index]} returned ${res.status}`);
            return [];
          }
          const text = await res.text();
          if (!text || text.trim() === '' || text === 'null') {
            return [];
          }
          return JSON.parse(text);
        } catch (e) {
          console.error(`Error parsing response from ${endpoints[index]}:`, e);
          return [];
        }
      }));

      const [
        companiesData, contactsData, statusesData, dealsData, 
        dealStatusesData, interestStatusesData, channelsData
      ] = data;

      setCompanies(companiesData);
      setContacts(contactsData);
      setQuoteStatuses(statusesData);
      setDeals(dealsData);
      setDealStatuses(dealStatusesData);
      setInterestStatuses(interestStatusesData);
      setDealChannels(channelsData);

      // Valores por defecto
      const defaultInterest = interestStatusesData.find((s: CustomStatus) => s.is_default) || interestStatusesData[0];
      const defaultChannel = channelsData.find((c: DealChannel) => c.is_default) || channelsData[0];

      // Inicializar Quote (Todos los campos de la BD)
      const initialQuote: Partial<Quote> = {
        nombre_cotizacion: dealName ? `Cotización para ${dealName}` : '',
        id_trato: dealId || '',
        id_client_company: clientCompanyId || '',
        id_contact: contactId || '',
        // id_quote_status se manejará automáticamente como DRAFT en el backend o payload
        tiempo_entrega: '5-7 días laborables',
        garantia: '12 meses',
        validez_oferta: '30 días',
        nota: '',
        mensaje: '',
        correos_adicionales: '',
        id_tenant: tenantId,
        id_user: userId,
        version: 0,
        estado_decision: UserDecision.PENDING,
        total: "$0.00",
        is_private: false
      };

      // Inicializar Nuevo Trato
      setNewDeal({
        nombre_trato: dealName ? `Trato - ${dealName}` : '',
        id_client_company: clientCompanyId || '',
        id_contact: contactId || '',
        id_interest: (defaultInterest as any)?.id_status || (defaultInterest as any)?.id_interest || '',
        id_channel: defaultChannel?.id_channel || '',
        id_tenant: tenantId,
        id_user_owner: userId,
        id_user: userId,
        descripcion: ''
      });

      if (initialQuote.id_client_company) {
        setFilteredContacts(contactsData.filter((c: ClientContact) => c.id_client_company === initialQuote.id_client_company));
      }

      setQuote(initialQuote);
      
      // Si no hay trato en URL y no hay tratos disponibles, forzar creación
      if (!dealId && dealsData.length === 0) {
        setCreateNewDeal(true);
      }

    } catch (error: any) {
      console.error("Error loading data:", error);
      setToast({ message: 'Error al cargar datos del sistema.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [user, location.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtrar contactos al cambiar empresa
  useEffect(() => {
    if (quote?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === quote.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [quote?.id_client_company, contacts]);

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'nombre_cotizacion') {
      setQuote(prev => ({ ...prev, nombre_cotizacion: value }));
      // Lógica: Si estamos creando un trato nuevo, actualizar su nombre automáticamente con el prefijo
      if (createNewDeal) {
        setNewDeal(prev => ({ ...prev, nombre_trato: `Trato - ${value}` }));
      }
    }
    else if (name === 'id_trato') {
      const selectedDeal = deals.find(d => d.id_trato === value);
      setQuote(prev => ({ 
        ...prev, 
        id_trato: value,
        id_client_company: selectedDeal?.id_client_company || '',
        id_contact: selectedDeal?.id_contact || '',
      }));
      setNewDeal(prev => ({ 
        ...prev, 
        id_client_company: selectedDeal?.id_client_company || '', 
        id_contact: selectedDeal?.id_contact || '' 
      }));
    } else {
      setQuote(prev => ({ ...prev, [name]: value }));
      if (['id_client_company', 'id_contact'].includes(name)) {
        setNewDeal(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleNewDealChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewDeal(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    // Validaciones
    if (!quote.nombre_cotizacion) {
        setToast({ message: 'El nombre de la cotización es obligatorio.', type: 'error' });
        return;
    }
    if (!quote.id_client_company || !quote.id_contact) {
      setToast({ message: 'Seleccione empresa y contacto.', type: 'error' });
      return;
    }

    if (!createNewDeal && !quote.id_trato) {
      setToast({ message: 'Seleccione un trato existente o cree uno nuevo.', type: 'error' });
      return;
    }

    if (createNewDeal) {
      if (!newDeal.nombre_trato || !newDeal.id_interest || !newDeal.id_channel) {
        setToast({ message: 'Para el nuevo trato: Nombre, Interés y Canal son obligatorios.', type: 'error' });
        return;
      }
    }

    setProcessing(true);
    setToast({ message: 'Guardando registro...', type: 'success' });

    try {
      let associatedDealId = quote.id_trato;

      // 1. Crear Trato si es necesario
      if (createNewDeal) {
        const dealPayload = {
          ...newDeal,
          id_client_company: quote.id_client_company,
          id_contact: quote.id_contact,
          status_category_deals: 'DRAFT', // <-- CAMBIO SOLICITADO
          id_tenant: user?.id_tenant,
          id_user_owner: user?.id_user,
          id_user: user?.id_user,
          created_at: new Date().toISOString(),
          // Limpieza de campos opcionales
          valor_trato: undefined 
        };

        const dealRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dealPayload),
        });

        if (!dealRes.ok) {
            let errorMessage = 'Error al crear el trato asociado.';
            try {
              const text = await dealRes.text();
              if (text) {
                const err = JSON.parse(text);
                errorMessage = err.message || errorMessage;
              }
            } catch (e) {}
            throw new Error(errorMessage);
        }
        
        const dealText = await dealRes.text();
        const dealData = dealText ? JSON.parse(dealText) : {};
        associatedDealId = dealData?.id_trato || dealData?.id;
      }

      // 2. Crear Cotización
      const quotePayload = { 
        ...quote,
        id_trato: associatedDealId,
        id_tenant: user?.id_tenant,
        id_user: user?.id_user,
        fecha_emision: new Date().toISOString(),
        status_category_quotes: 'DRAFT', // <-- CAMBIO SOLICITADO
        
        // Aseguramos valores por defecto de la BD
        total: quote.total || 0,
        estado_decision: 'PENDIENTE',
        version: 0
      };

      console.log('Quote payload to send:', quotePayload);

      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotePayload),
      });

      if (!res.ok) {
          let errorMessage = 'Error al crear la cotización.';
          try {
            const text = await res.text();
            if (text) {
              const err = JSON.parse(text);
              errorMessage = err.message || errorMessage;
            }
          } catch (e) {
            console.error('Error parsing response:', e);
          }
          throw new Error(errorMessage);
      }

      setToast({ message: '¡Cotización creada correctamente!', type: 'success' });
      
      setTimeout(() => {
        const dealIdParam = new URLSearchParams(location.search).get('dealId');
        navigate(dealIdParam ? `/app/deals/${dealIdParam}` : '/app/quotes');
      }, 1000);

    } catch (error: any) {
      console.error(error);
      setToast({ message: error.message || 'Error desconocido al guardar.', type: 'error' });
    } finally {
      setProcessing(false);
    } 
  };

  // --- RENDER ---

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-500 font-medium">Cargando configuración...</p>
      </div>
    );
  }

  const isLocked = !!location.search.includes('dealId');

  return (
    <div className="w-full px-4 md:px-8 py-6 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nueva Cotización</h1>
            <p className="text-sm text-slate-500">Complete los datos para generar un nuevo registro.</p>
         </div>
         <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => navigate(-1)} 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all text-sm"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={processing}
              className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-70 text-sm"
            >
              {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              Guardar Registro
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA PRINCIPAL (Izquierda) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. NOMBRE (PRIORIDAD ALTA) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre de la Cotización <span className="text-red-500">*</span></label>
                <input 
                    name="nombre_cotizacion" 
                    value={quote.nombre_cotizacion || ''} 
                    onChange={handleInputChange} 
                    autoFocus
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-lg font-medium placeholder:text-slate-300 transition-all"
                    placeholder="Ej. Propuesta Comercial - Implementación ERP"
                />
            </div>

            {/* 1. DATOS DEL CLIENTE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Datos del Cliente
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select 
                                name="id_client_company" 
                                value={quote.id_client_company || ''} 
                                onChange={handleInputChange} 
                                disabled={isLocked}
                                className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none appearance-none ${isLocked ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-white border-slate-300 focus:ring-2 focus:ring-brand-500'}`}
                            >
                                <option value="">-- Seleccionar Empresa --</option>
                                {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                            </select>
                            <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                                {isLocked ? <i className="fa-solid fa-lock text-xs"></i> : <i className="fa-solid fa-chevron-down text-xs"></i>}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Contacto <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select 
                                name="id_contact" 
                                value={quote.id_contact || ''} 
                                onChange={handleInputChange} 
                                disabled={isLocked || !quote.id_client_company}
                                className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none appearance-none ${isLocked || !quote.id_client_company ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-white border-slate-300 focus:ring-2 focus:ring-brand-500'}`}
                            >
                                <option value="">-- Seleccionar Contacto --</option>
                                {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                            </select>
                            <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                                {isLocked ? <i className="fa-solid fa-lock text-xs"></i> : <i className="fa-solid fa-chevron-down text-xs"></i>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 2. CONDICIONES COMERCIALES */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Condiciones Comerciales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Tiempo de Entrega', name: 'tiempo_entrega', ph: 'Ej. 5-7 días laborables' },
                        { label: 'Garantía', name: 'garantia', ph: 'Ej. 12 meses por defectos' },
                        { label: 'Validez de Oferta', name: 'validez_oferta', ph: 'Ej. 15 días' },
                    ].map(field => (
                        <div key={field.name}>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">{field.label}</label>
                            <input 
                                name={field.name} 
                                value={(quote as any)[field.name] || ''} 
                                onChange={handleInputChange} 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all"
                                placeholder={field.ph}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. CONDICIONES DEL SERVICIO */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Condiciones del Servicio
                </h2>
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">
                        Este apartado se enviará por correo adjunto a la cotización
                    </label>
                    <textarea 
                        name="mensaje" 
                        value={quote.mensaje || ''} 
                        onChange={handleInputChange} 
                        rows={12} 
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                        placeholder="Condiciones del servicio, términos, mensaje de saludo, etc..."
                    />
                </div>
            </div>

        </div>

        {/* COLUMNA DERECHA (Sidebar) */}
        <div className="space-y-6">
            
            {/* NOTAS Y CORREOS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Información Adicional</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Nota Interna (Opcional)</label>
                        <textarea 
                            name="nota" 
                            value={quote.nota || ''} 
                            onChange={handleInputChange} 
                            rows={2} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                            placeholder="Notas para el equipo..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Correos en copia (CC)</label>
                        <input 
                            name="correos_adicionales" 
                            value={quote.correos_adicionales || ''} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                            placeholder="email1@ejemplo.com, email2@..." 
                        />
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="flex items-center h-5">
                                <input
                                type="checkbox"
                                name="is_private"
                                checked={quote.is_private || false}
                                onChange={(e) => setQuote({ ...quote, is_private: e.target.checked })}
                                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                />
                            </div>
                            <div>
                                <span className="block text-sm font-semibold text-slate-700 group-hover:text-brand-700">Cotización Privada</span>
                                <span className="block text-xs text-slate-400 mt-1">Visible solo para administradores.</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* RESUMEN VISUAL (Opcional, ayuda a llenar el espacio) */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Estado Inicial</p>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                    <span className="font-bold text-slate-700">Borrador (Draft)</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">La cotización se creará en estado borrador. Podrá agregar ítems y cambiar el estado en el siguiente paso.</p>
            </div>

            {/* VINCULACIÓN DE TRATO (OPCIONAL) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-link text-xs"></i>
                    Vinculación de Trato (Opcional)
                </h2>

                {isLocked ? (
                   <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Trato Vinculado</p>
                        <p className="text-slate-700 font-semibold">{deals.find(d => d.id_trato === quote.id_trato)?.nombre_trato || 'Trato Actual'}</p>
                      </div>
                      <i className="fa-solid fa-lock text-slate-300 text-xl"></i>
                   </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex bg-slate-100 p-1 rounded-lg w-full">
                            <button
                                onClick={() => { setCreateNewDeal(false); setQuote(p => ({...p, id_trato: ''})); }}
                                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all ${!createNewDeal ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Existente
                            </button>
                            <button
                                onClick={() => { setCreateNewDeal(true); setQuote(p => ({...p, id_trato: ''})); }}
                                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all ${createNewDeal ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Nuevo
                            </button>
                        </div>

                        {!createNewDeal ? (
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Trato Abierto</label>
                                <select 
                                    name="id_trato" 
                                    value={quote.id_trato || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none text-sm"
                                >
                                    <option value="">-- Ninguno --</option>
                                    {deals.map(d => <option key={d.id_trato} value={d.id_trato}>{d.nombre_trato}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-9 text-slate-400 text-xs pointer-events-none"></i>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre <span className="text-red-500">*</span></label>
                                    <input
                                        name="nombre_trato"
                                        value={newDeal.nombre_trato || ''}
                                        onChange={handleNewDealChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Auto-generado..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Interés <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            name="id_interest"
                                            value={newDeal.id_interest || ''}
                                            onChange={handleNewDealChange}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {interestStatuses.map((opt: any) => (
                                                <option key={opt.id_status || opt.id_interest} value={opt.id_status || opt.id_interest}>
                                                    {opt.name}
                                                </option>
                                            ))}
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-slate-400 text-xs pointer-events-none"></i>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Canal <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            name="id_channel"
                                            value={newDeal.id_channel || ''}
                                            onChange={handleNewDealChange}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {dealChannels.map((opt: any) => (
                                                <option key={opt.id_channel} value={opt.id_channel}>{opt.name}</option>
                                            ))}
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-slate-400 text-xs pointer-events-none"></i>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default QuoteCreate;