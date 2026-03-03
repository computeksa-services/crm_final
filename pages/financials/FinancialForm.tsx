import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { financialService } from '../../services/financials.service';
import Toast from '../../components/Toast';
import { apiFetch } from '../../services/apiClient';
import type { ClientCompany, FinancialTransaction, Quote } from '../../types';

// --- HELPERS ---
const formatCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

type SelectedRecipient = {
  email: string;
  name: string;
  type: 'contact' | 'team' | 'external';
  id: string | null;
};

// Modificamos el tipo para permitir strings en los inputs numéricos durante la edición
type FinancialFormData = Partial<Omit<FinancialTransaction, 'subtotal' | 'tax_amount' | 'total_value' | 'retention_value' | 'credit_days' | 'automation_frequency'>> & {
    subtotal?: number | string;
    tax_amount?: number | string;
    total_value?: number | string;
    retention_value?: number | string;
    credit_days?: number | string;
    enable_automation?: boolean;
    automation_frequency?: number | string;
    status?: 'PENDIENTE' | 'PAGADO' | 'ANULADO';
};

const FinancialForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtener el ID de los query params
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  const { user } = useAuth();
  const { companies: cachedCompanies, contacts: cachedContacts, users: cachedUsers, loading: cacheLoading } = useDataCache();
  
  // Modo edición si el id existe
  const isEditMode = !!id;

  // --- ESTADOS DE DATOS ---
  const [transaction, setTransaction] = useState<FinancialFormData>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allCompanyContacts, setAllCompanyContacts] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // --- ESTADOS DE UI ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');


  // --- FILTRADO DINÁMICO ---
  const filteredQuotes = useMemo(() => {
    if (!transaction.id_client_company) return [];
    return quotes.filter(q => String(q.id_client_company) === String(transaction.id_client_company));
  }, [transaction.id_client_company, quotes]);

  const filteredContacts = useMemo(() => {
    if (!transaction.id_client_company) return [];
    return allCompanyContacts.filter(c => 
      String(c.id_client_company || c.id_company || c.company_id) === String(transaction.id_client_company)
    );
  }, [transaction.id_client_company, allCompanyContacts]);

  // --- PRESELECCIÓN DE DESTINATARIOS ---
  useEffect(() => {
    // Si NO se activa automación o no hay empresa seleccionada, no hacer nada
    if (!transaction.enable_automation || !transaction.id_client_company) return;

    // IMPORTANTE: Si ya hay recipientes cargados desde la API (edición),
    // no sobrescribir. Pero si fueron preseleccionados por este efecto antes,
    // sí podemos actualizar.
    const hasLoadedFromApi = transaction.automation_recipients && transaction.automation_recipients.length > 0;
    
    // Si estamos en modo edición y ya hay datos cargados, no sobrescribir
    if (hasLoadedFromApi && selectedRecipients.length > 0) return;

    // Si ya tenemos recipientes y no es edición, verificar si son los que preseleccionamos
    if (selectedRecipients.length > 0 && !hasLoadedFromApi) return;

    const recipientsToSelect: SelectedRecipient[] = [];

    // 1. Preseleccionar al usuario actual
    if (user?.email_user && user?.name_user) {
      recipientsToSelect.push({
        email: user.email_user,
        name: user.name_user,
        type: 'team',
        id: user.id_user || null
      });
    }

    // 2. Preseleccionar el contacto principal de la empresa
    const companyContacts = filteredContacts;
    
    if (companyContacts.length > 0) {
      // Buscar contacto marcado como principal
      const mainContact = companyContacts.find((c: any) => c.es_principal || c.is_main);
      const contactToSelect = mainContact || companyContacts[0];
      
      recipientsToSelect.push({
        email: contactToSelect.email || contactToSelect.email_contact,
        name: contactToSelect.first_name + (contactToSelect.last_name ? ' ' + contactToSelect.last_name : ''),
        type: 'contact',
        id: contactToSelect.id_contact || null
      });
    }

    // Aplicar preselección
    if (recipientsToSelect.length > 0) {
      setSelectedRecipients(recipientsToSelect);
    }
  }, [transaction.enable_automation, transaction.id_client_company, filteredContacts, user]);

  // --- LÓGICA DE CÁLCULO ---
  // Calcula el total visualmente basado en el estado actual de los inputs
  const calculatedTotal = useMemo(() => {
    const sub = parseFloat(String(transaction.subtotal)) || 0;
    const tax = parseFloat(String(transaction.tax_amount)) || 0;
    const ret = parseFloat(String(transaction.retention_value)) || 0;
    
    // Fórmula: (Subtotal + Impuestos) - Retención
    const total = (sub + (sub * (tax / 100))) - ret;
    return total > 0 ? total : 0;
  }, [transaction.subtotal, transaction.tax_amount, transaction.retention_value]);

  // --- CARGA DE DATOS ---
  // Sync local lists from cache for instant rendering
  useEffect(() => {
    setClientCompanies(cachedCompanies as unknown as ClientCompany[]);
  }, [cachedCompanies]);

  useEffect(() => {
    setAllCompanyContacts(cachedContacts);
  }, [cachedContacts]);

  useEffect(() => {
    const mappedTeam = (cachedUsers || [])
      .map((u: any) => ({
        id: u.id_user || u.id,
        name: u.name_user || u.name || 'Sin nombre',
        email: u.email || u.email_user || ''
      }))
      .filter((u: any) => u.email);
    setTeamMembers(mappedTeam);
  }, [cachedUsers]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    const queryParams = new URLSearchParams(location.search);
    const transactionId = queryParams.get('id');
    const isEditingMode = !!transactionId;
    
    try {
      // Fetch only quotes; companies/contacts/users come from cache effects above
      const quotesRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`);
      const qData = quotesRes.ok ? await quotesRes.json() : [];
      setQuotes(qData);

      // Si es modo edición, cargar los datos de la transacción
      if (isEditingMode && transactionId) {

        const detailRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${transactionId}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          const tx = Array.isArray(data) ? data[0] : data;
          
          if (tx) {
            // Mapear los datos desde el formato de la API al formato del formulario
            // NOTA: Convertimos los números a String para que funcionen bien en los inputs de texto
            const normalized: FinancialFormData = {
              id_transaction: tx.id_transaccion || tx.id_transaction,
              invoice_number: tx.numero_factura || tx.invoice_number,
              description: tx.descripcion_concepto || tx.description,
              transaction_type: tx.tipo_transaccion || tx.transaction_type,
              status: tx.estado_registro || tx.status,
              issue_date: tx.v_input_fecha_emision || tx.issue_date || tx.fecha_emision?.split('T')[0],
              due_date: tx.v_input_fecha_vencimiento || tx.due_date || tx.fecha_vencimiento?.split('T')[0],
              id_client_company: tx.id_empresa_cliente || tx.id_client_company,
              
              // Valores convertidos a string o vacíos si son 0/null para evitar "0" en el input
              subtotal: tx.subtotal ? String(tx.subtotal) : '',
              tax_amount: tx.impuestos !== undefined ? String(tx.impuestos) : '',
              total_value: tx.total_factura || tx.total_value || 0, // Este es solo referencia inicial
              retention_value: tx.valor_retencion ? String(tx.valor_retencion) : '',
              credit_days: tx.dias_credito ? String(tx.dias_credito) : '',
              
              retention_number: tx.retention_number,
              is_urgent: tx.es_urgente || tx.is_urgent,
              notes: tx.notas_internas || tx.notes,
              enable_automation: tx.enable_automation === true,
              automation_frequency: tx.automation_frequency ? String(tx.automation_frequency) : '3',
              automation_recipients: Array.isArray(tx.automation_recipients) ? tx.automation_recipients : []
            };
            
            setTransaction(normalized);
            
            // Actualizar el breadcrumb
            navigate(location.pathname + location.search, { state: { breadcrumb: normalized.invoice_number }, replace: true });

            // Cargar recipientes
            if (Array.isArray(tx.automation_recipients)) {
              const recipients: SelectedRecipient[] = tx.automation_recipients.map((r: any) => ({
                email: r.email,
                name: r.name,
                type: r.type || 'external',
                id: r.id || null
              }));
              setSelectedRecipients(recipients);
            }
          }
        } else {
          setToast({ message: 'Error al cargar la transacción.', type: 'error' });
        }
      } else {
        setDefaults();
      }
    } catch (error) {
      setToast({ message: 'Error al cargar recursos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, location.search, navigate]);

  const setDefaults = () => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE',
      issue_date: today,
      due_date: today,
      credit_days: '', // Vacío para permitir placeholder
      subtotal: '',
      tax_amount: '15',
      total_value: 0,
      enable_automation: false,
      automation_frequency: '3',
      retention_value: ''
    });
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // 1. Checkbox
    if (type === 'checkbox') {
        setTransaction(prev => ({ ...prev, [name]: checked }));
        return;
    }

    // 2. Inputs Numéricos (tratados como texto para mejor UX)
    const numericFields = ['subtotal', 'tax_amount', 'retention_value', 'credit_days', 'automation_frequency'];
    
    if (numericFields.includes(name)) {
        // Validar que sea número válido o vacío (Regex: dígitos, opcionalmente un punto, más dígitos)
        if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;

        setTransaction(prev => {
            const updated = { ...prev, [name]: value };

            // Cálculo de fechas solo si cambia credit_days
            if (name === 'credit_days') {
                const days = parseInt(value || '0', 10);
                const date = new Date(prev.issue_date || new Date());
                date.setDate(date.getDate() + days);
                updated.due_date = date.toISOString().split('T')[0];
            }
            return updated;
        });
        return;
    }

    // 3. Fechas
    if (name === 'issue_date') {
        setTransaction(prev => {
            const updated = { ...prev, issue_date: value };
            const days = parseInt(String(prev.credit_days || 0), 10);
            const date = new Date(value);
            date.setDate(date.getDate() + days);
            updated.due_date = date.toISOString().split('T')[0];
            return updated;
        });
        return;
    }

    // 4. Textos normales
    setTransaction(prev => {
      const updated: any = { ...prev, [name]: value };
      if (name === 'id_client_company') updated.id_related_quote = '';
      return updated;
    });
  };

  const toggleRecipient = (recipient: SelectedRecipient) => {
    setSelectedRecipients(prev => {
      const exists = prev.some(r => r.email === recipient.email);
      return exists ? prev.filter(r => r.email !== recipient.email) : [...prev, recipient];
    });
  };

  const addExternalRecipient = () => {
    if (!externalEmail || !externalName) {
      setToast({ message: 'Complete nombre y email.', type: 'error' });
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(externalEmail)) {
      setToast({ message: 'El email no es válido.', type: 'error' });
      return;
    }
    
    toggleRecipient({ email: externalEmail, name: externalName, type: 'external', id: null });
    setExternalEmail(''); 
    setExternalName('');
  };

  const handleSave = async () => {
    if (!transaction.invoice_number?.trim() || !transaction.id_client_company || !transaction.description?.trim()) {
      setToast({ message: 'Factura, Cliente y Descripción son obligatorios.', type: 'error' });
      return;
    }
    
    // Convertir strings a números antes de validar
    const finalSubtotal = parseFloat(String(transaction.subtotal)) || 0;
    
    // Validar que el subtotal sea mayor a 0
    if (finalSubtotal <= 0) {
      setToast({ message: 'El subtotal debe ser mayor a cero.', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      const finalTax = parseFloat(String(transaction.tax_amount)) || 0;
      const finalRetention = parseFloat(String(transaction.retention_value)) || 0;
      
      // Calcular total final para el backend
      const finalTotal = (finalSubtotal + (finalSubtotal * (finalTax / 100))) - finalRetention;

      const payload = {
        ...transaction,
        subtotal: finalSubtotal,
        tax_amount: finalTax,
        retention_value: finalRetention,
        total_value: finalTotal, // Asegurar que el backend reciba el cálculo correcto
        credit_days: parseInt(String(transaction.credit_days)) || 0,
        automation_frequency: parseInt(String(transaction.automation_frequency)) || 3,
        id_tenant: user?.id_tenant,
        id_user: user?.id_user,
        automation_recipients: transaction.enable_automation ? selectedRecipients : []
      };

      let res;
      if (isEditMode) {
        // Actualizar - usar financialService.update()
        await financialService.update(payload);
        res = { ok: true }; 
      } else {
        // Crear nuevo

        res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (res && !res.ok) throw new Error('Error en respuesta del servidor');
      setToast({ message: isEditMode ? 'Registro actualizado.' : 'Registro creado.', type: 'success' });
      setTimeout(() => navigate('/app/financials'), 1000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar. ' + (error instanceof Error ? error.message : ''), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Etiqueta dinámica para el total
  const getActionLabel = () => {
    if (transaction.transaction_type === 'VENTA') return 'A Cobrar';
    if (transaction.transaction_type === 'COMPRA' || transaction.transaction_type === 'GASTO') return 'A Pagar';
    return 'Total';
  };

  if (loading) return <div className="p-20 text-center flex flex-col items-center"><BrandSpinner size="lg" className="mb-3" /><p className="text-slate-400 text-sm">Cargando formulario...</p></div>;

  const pageTitle = isEditMode ? 'Editar Transacción' : 'Nueva Transacción';
  const pageSubtitle = isEditMode ? 'Modifique los datos de la transacción.' : 'Registre un nuevo ingreso o egreso financiero.';

  return (
    <div className="w-full px-4 md:px-8 py-6 animate-fade-in pb-20 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-all text-sm bg-white">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-70">
            {saving ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-save"></i>}
            {isEditMode ? 'Actualizar' : 'Guardar'} Registro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA PRINCIPAL */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECCIÓN 1: DOCUMENTO */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Información del Documento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Número de Factura <span className="text-red-500">*</span></label>
                <input name="invoice_number" value={transaction.invoice_number || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg" placeholder="001-001-000000001" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Categoría</label>
                  <select name="transaction_type" value={transaction.transaction_type} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                      <option value="VENTA">Venta (Ingreso)</option>
                      <option value="COMPRA">Compra (Egreso)</option>
                      <option value="OTROS">Otros</option>
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Estado</label>
                  <select name="status" value={transaction.status} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="PAGADO">Pagado</option>
                      <option value="ANULADO">Anulado</option>
                  </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Descripción / Concepto <span className="text-red-500">*</span></label>
                <textarea name="description" value={transaction.description || ''} onChange={handleInputChange} rows={2} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Detalle de la transacción..." />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: VALORES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="bg-brand-100 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Valores y Plazos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-4 border-r border-slate-100 pr-4">
                  <div><label className="text-xs font-bold text-slate-600 mb-1 block">Emisión</label><input type="date" name="issue_date" value={transaction.issue_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Días Crédito</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      name="credit_days" 
                      value={transaction.credit_days} 
                      onChange={handleInputChange} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500" 
                      placeholder="0"
                    />
                  </div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase block tracking-tighter">Vencimiento Calculado</label><input type="date" value={transaction.due_date || ''} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400" /></div>
              </div>
              <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Subtotal ($)</label>
                        <input 
                            type="text"
                            inputMode="decimal"
                            name="subtotal" 
                            value={transaction.subtotal} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-200"
                            placeholder="0.00" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">IVA (%)</label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            name="tax_amount" 
                            value={transaction.tax_amount} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500"
                            placeholder="0" 
                        />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        {getActionLabel()} (Menos Retención)
                    </label>
                    <p className="text-4xl font-black text-slate-800 font-mono tracking-tighter">
                        {formatCurrency(calculatedTotal)}
                    </p>
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
          {/* RELACIONES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-link text-[10px]"></i> Relaciones</h2>
            <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-600 mb-1.5 block">Cliente/Proveedor <span className="text-red-500">*</span></label><select name="id_client_company" value={transaction.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none appearance-none cursor-pointer"><option value="">-- Seleccionar --</option>{clientCompanies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}</select></div>
                <div><label className="text-xs font-bold text-slate-600 mb-1.5 block">Vincular Cotización</label><select name="id_related_quote" value={transaction.id_related_quote || ''} onChange={handleInputChange} disabled={!transaction.id_client_company} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-50"><option value="">-- {transaction.id_client_company ? 'Opcional (Ninguna)' : 'Seleccione cliente'} --</option>{filteredQuotes.map(q => <option key={q.id_cotizacion} value={q.id_cotizacion}>{q.formatted_no_cotizacion || q.no_cotizacion}</option>)}</select></div>
            </div>
          </div>

          {/* RETENCIONES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-file-invoice-dollar text-[10px]"></i> Retenciones</h2>
            <div className="space-y-3">
                <div><label className="text-xs font-bold text-slate-600 mb-1.5 block">Nro. Comprobante</label><input name="retention_number" value={transaction.retention_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: 001-001-..." /></div>
                <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Valor Retenido ($)</label>
                    <input 
                        type="text" 
                        inputMode="decimal"
                        name="retention_value" 
                        value={transaction.retention_value} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-rose-600 outline-none focus:border-rose-500" 
                        placeholder="0.00"
                    />
                     <p className="text-[10px] text-slate-400 mt-1">* Se restará del total a {transaction.transaction_type === 'VENTA' ? 'cobrar' : 'pagar'}.</p>
                </div>
            </div>
          </div>

          {/* AUTOMATIZACIÓN */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <i className="fa-solid fa-robot text-blue-600"></i>
              <h2 className="text-sm font-bold text-slate-800">Cobranza Automática</h2>
            </div>
            <label className="flex items-center justify-between p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow mb-4">
              <span className="text-xs font-bold text-slate-700">Activar Recordatorios</span>
              <input type="checkbox" name="enable_automation" checked={transaction.enable_automation || false} onChange={handleInputChange} className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400" />
            </label>

            {transaction.enable_automation && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-blue-200 flex items-center gap-2 shadow-sm">
                  <span className="text-slate-600">Recordatorio cada</span>
                  <input type="text" inputMode="numeric" name="automation_frequency" value={transaction.automation_frequency} onChange={handleInputChange} className="w-12 text-center font-bold bg-blue-50 border-b-2 border-blue-400 outline-none rounded px-1" placeholder="3" />
                  <span className="text-slate-600">días</span>
                </div>
                
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-[11px] text-blue-900 flex items-start gap-2.5 leading-relaxed">
                  <i className="fa-solid fa-info-circle mt-0.5 text-blue-600 flex-shrink-0"></i>
                  <div className="space-y-1.5">
                    <p><strong>Horario:</strong> Envío automático desde las 9:00 AM en días laborales (Lun-Vie).</p>
                    <p><strong>Canal:</strong> Notificaciones vía correo electrónico a destinatarios seleccionados.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Destinatarios de Alertas</p>
                  
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Contactos Empresa</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredContacts.length > 0 ? filteredContacts.map(c => (
                        <label key={c.id_contact} className="flex items-center gap-2 p-1.5 hover:bg-white rounded text-[11px] cursor-pointer transition-colors"><input type="checkbox" checked={selectedRecipients.some(r => r.email === (c.email || c.email_contact))} onChange={() => toggleRecipient({ email: c.email || c.email_contact, name: c.first_name, type: 'contact', id: c.id_contact })} className="w-3.5 h-3.5 rounded text-blue-600" /><span>{c.first_name} {c.last_name}</span></label>
                      )) : <p className="text-[10px] text-slate-400">Sin contactos.</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Mi Equipo</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {teamMembers && teamMembers.length > 0 ? (
                        teamMembers.map(m => (
                          <label key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded text-[11px] cursor-pointer transition-colors"><input type="checkbox" checked={selectedRecipients.some(r => r.email === m.email)} onChange={() => toggleRecipient({ email: m.email, name: m.name, type: 'team', id: m.id })} className="w-3.5 h-3.5 rounded text-blue-600" /><span>{m.name}</span></label>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400">Sin miembros del equipo.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">Externos</p>
                    <div className="grid grid-cols-1 gap-1.5">
                        <input value={externalName} onChange={e => setExternalName(e.target.value)} className="w-full px-2 py-1.5 border border-blue-200 rounded text-[10px] outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nombre" />
                        <input value={externalEmail} onChange={e => setExternalEmail(e.target.value)} className="w-full px-2 py-1.5 border border-blue-200 rounded text-[10px] outline-none focus:ring-2 focus:ring-blue-400" placeholder="Email" />
                        <button onClick={addExternalRecipient} className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors">Agregar</button>
                    </div>
                  </div>

                  {selectedRecipients.length > 0 && (
                    <div className="pt-2 border-t border-blue-200">
                      <div className="flex flex-wrap gap-1.5 max-w-full">
                        {selectedRecipients.map((r, i) => (
                            <span key={i} className="px-2.5 py-1 bg-white text-blue-700 border border-blue-300 rounded-full text-[9px] font-bold flex items-center gap-1.5 shadow-sm break-all max-w-full">
                              <span className="truncate max-w-[150px]" title={r.name}>{r.name}</span>
                              <button onClick={() => toggleRecipient(r)} className="text-rose-500 hover:text-rose-700 font-bold text-xs flex-shrink-0">×</button>
                            </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <label className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-lg cursor-pointer group transition-colors hover:bg-rose-100"><input type="checkbox" name="is_urgent" checked={transaction.is_urgent || false} onChange={handleInputChange} className="w-4 h-4 text-rose-600 rounded" /><span className="text-xs font-bold text-rose-700 uppercase flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation group-hover:animate-pulse"></i> Marcar Urgente</span></label>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Notas Internas</label><textarea name="notes" value={transaction.notes || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none bg-slate-50 outline-none" placeholder="Comentarios privados..." /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialForm;
