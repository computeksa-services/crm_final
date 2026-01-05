import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import type { ClientCompany, FinancialTransaction, Quote } from '../types';

type ContactOption = {
  id_contact?: string;
  id?: string;
  id_client_company?: string;
  id_company?: string;
  company_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email_contact?: string;
  email_user?: string;
  position?: string;
  is_main?: boolean;
  name_contact?: string;
  [key: string]: any; // Para propiedades dinámicas del API
};

type SelectedRecipient = {
  email: string;
  name: string;
  type: 'contact' | 'team' | 'external';
  id: string | null;
};

type FinancialCreateForm = Partial<FinancialTransaction> & {
    enable_automation?: boolean;
    automation_frequency?: number;
    status?: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO';
};

const FinancialCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transaction, setTransaction] = useState<FinancialCreateForm>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  
  // Contactos
  const [allCompanyContacts, setAllCompanyContacts] = useState<ContactOption[]>([]);
  const [companyContacts, setCompanyContacts] = useState<ContactOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<ContactOption[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Defaults
  const setDefaults = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE' as 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO',
      invoice_number: '',
      description: '',
      issue_date: today,
      credit_days: 0,
      due_date: today,
      subtotal: 0,
      tax_amount: 15,
      total_value: 0,
      paid_amount: 0,
      retention_value: 0,
      is_urgent: false,
      enable_automation: false,
      automation_frequency: 3
    });
    setSelectedRecipients([]);
    setExternalEmail('');
    setExternalName('');
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      const [companiesRes, quotesRes, contactsRes, teamRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const text = await res.text();
          throw new Error(text || 'Error al cargar datos');
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const [companiesData, quotesData, contactsData, teamData] = await Promise.all([
        parseResponse(companiesRes),
        parseResponse(quotesRes),
        parseResponse(contactsRes),
        parseResponse(teamRes)
      ]);

      setClientCompanies(Array.isArray(companiesData) ? companiesData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      
      const contactsList = Array.isArray(contactsData) ? contactsData : [];
      console.log('📋 Contactos cargados:', contactsList);
      setAllCompanyContacts(contactsList);
      
      const teamList = Array.isArray(teamData) ? teamData : [];
      console.log('👥 Equipo cargado:', teamList);
      
      const mappedTeam = teamList
        .filter(u => u.id_user !== user.id_user && u.id !== user.id_user) // Excluir usuario actual
        .map(u => ({
        id: u.id_user || u.id,
        name: u.name_user || u.name || 'Sin nombre',
        email: u.email || u.email_user || '',
        first_name: (u.name_user || u.name || '')?.split(' ')[0],
        last_name: (u.name_user || u.name || '')?.split(' ').slice(1).join(' ')
      }));
      console.log('👥 Equipo mapeado:', mappedTeam);
      setTeamMembers(mappedTeam);
      
      setDefaults();
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setToast({ message: error?.message || 'Error de conexión.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [setDefaults, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtrar contactos de la empresa cuando cambia la selección
  useEffect(() => {
    console.log('🔍 Filtrando contactos:', {
      id_client_company: transaction.id_client_company,
      totalContactos: allCompanyContacts.length,
      primerContacto: allCompanyContacts[0]
    });
    
    if (transaction.id_client_company) {
      // Intenta filtrar por id_client_company, id_company, company_id, etc
      const filtered = allCompanyContacts.filter(c => {
        const companyId = String(transaction.id_client_company);
        const contactCompanyId = String(c.id_client_company || c.id_company || c.company_id || c.id_contact);
        return contactCompanyId === companyId;
      });
      console.log('✅ Contactos filtrados:', filtered);
      setCompanyContacts(filtered);
    } else {
      setCompanyContacts([]);
    }
  }, [transaction.id_client_company, allCompanyContacts]);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setTransaction(prev => {
      const updated: Partial<FinancialTransaction> = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      // Cálculos automáticos
      if (name === 'subtotal' || name === 'tax_amount') {
        const subtotal = parseFloat(name === 'subtotal' ? value : (prev.subtotal as any)) || 0;
        const taxPercent = parseFloat(name === 'tax_amount' ? value : (prev.tax_amount as any)) || 0;
        const taxAmount = subtotal * (taxPercent / 100);
        updated.total_value = subtotal + taxAmount;
      }

      if (name === 'issue_date' || name === 'credit_days') {
        const issueDate = name === 'issue_date' ? value : (prev.issue_date || '');
        const creditDays = parseInt(name === 'credit_days' ? value : (prev.credit_days as any)) || 0;
        if (issueDate) {
          const date = new Date(issueDate);
          date.setDate(date.getDate() + creditDays);
          updated.due_date = date.toISOString().split('T')[0];
        }
      }

      if (name === 'status' && value === 'PAGADO') {
        updated.paid_amount = updated.total_value;
        updated.payment_date = new Date().toISOString().split('T')[0];
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!transaction || !user) return;

    if (!transaction.transaction_type || !transaction.status || !transaction.invoice_number?.trim()) {
      setToast({ message: 'Complete los campos obligatorios.', type: 'error' });
      return;
    }

    // Validar automatización
    if (transaction.enable_automation && selectedRecipients.length === 0) {
      setToast({ message: 'Si activas la automatización, debes seleccionar al menos un contacto.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const finalPaidAmount = transaction.status === 'PAGADO' 
        ? parseFloat(transaction.paid_amount as any) || parseFloat(transaction.total_value as any) || 0
        : parseFloat(transaction.paid_amount as any) || 0;

      const payload: any = {
        id_tenant: user.id_tenant,
        created_by: user.id_user,
        ...transaction,
        
        credit_days: parseInt(transaction.credit_days as any) || 0,
        subtotal: parseFloat(transaction.subtotal as any) || 0,
        tax_amount: transaction.status === 'PAGADO' ? 0 : parseFloat(transaction.tax_amount as any) || 0,
        total_value: parseFloat(transaction.total_value as any) || 0,
        retention_value: parseFloat(transaction.retention_value as any) || 0,
        paid_amount: finalPaidAmount,
        payment_date: transaction.payment_date || null,
        payment_method: transaction.payment_method || null,
        payment_reference: transaction.payment_reference || null,
        enable_automation: transaction.enable_automation || false,
        automation_frequency: parseInt(transaction.automation_frequency as any) || 3,
        automation_recipients: transaction.enable_automation ? selectedRecipients : []
      };

      console.log('Payload a enviar:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al crear la transacción.');

      setToast({ message: 'Transacción creada correctamente.', type: 'success' });
      setTimeout(() => navigate('/app/financials'), 800);
    } catch (error: any) {
      setToast({ message: error?.message || 'Error al guardar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleRecipient = (recipient: SelectedRecipient) => {
    setSelectedRecipients(prev => {
      // Crear una clave única que combine email, tipo e id
      const recipientKey = `${recipient.type}-${recipient.id}-${recipient.email}`;
      const exists = prev.some(r => `${r.type}-${r.id}-${r.email}` === recipientKey);
      return exists ? prev.filter(r => `${r.type}-${r.id}-${r.email}` !== recipientKey) : [...prev, recipient];
    });
  };

  const addExternalRecipient = () => {
    if (!externalEmail || !externalName) {
      setToast({ message: 'Ingresa email y nombre para el contacto externo.', type: 'error' });
      return;
    }
    const newRecipient: SelectedRecipient = {
      email: externalEmail,
      name: externalName,
      type: 'external',
      id: null
    };
    toggleRecipient(newRecipient);
    setExternalEmail('');
    setExternalName('');
  };

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return null;
  if (loading) return <div className="p-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500"></i></div>;

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-20 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header compacto */}
            <div className="px-4 py-2 flex items-center justify-between bg-transparent border-b-0 md:py-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">Nueva Transacción</h1>
                        <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">Registro financiero.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/app/financials')} className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-white transition-colors text-xs bg-white">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || ((transaction.enable_automation || false) && selectedRecipients.length === 0)} className="px-5 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-md flex items-center gap-2 transition-all text-xs disabled:opacity-60">
                        {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                        <span className="hidden sm:inline">Guardar</span>
                    </button>
                </div>
            </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="px-4 md:px-8 max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            
            {/* COLUMNA IZQUIERDA (DATOS PRINCIPALES) */}
            <div className="lg:col-span-1 xl:col-span-2 flex flex-col gap-6">
                
                {/* 1. Información Básica */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Información Básica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo *</label>
                            <div className="relative">
                                <select name="transaction_type" value={transaction.transaction_type || ''} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer bg-white">
                                    <option value="VENTA">Ingreso (Venta)</option>
                                    <option value="GASTO">Egreso (Gasto)</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-3.5 text-xs text-slate-400 pointer-events-none"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Estado *</label>
                            <div className="relative">
                                <select name="status" value={transaction.status || ''} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer bg-white">
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="PAGADO">Pagado</option>
                                    <option value="ANULADO">Anulado</option>
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-3.5 text-xs text-slate-400 pointer-events-none"></i>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Número de Documento / Factura *</label>
                            <input name="invoice_number" value={transaction.invoice_number || ''} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg" placeholder="001-001-000000001" required />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Descripción / Concepto</label>
                            <textarea name="description" value={transaction.description || ''} onChange={handleInputChange} rows={3} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none" placeholder="Detalle de la transacción..." />
                        </div>
                    </div>
                </div>

                {/* 2. Valores y Plazos - Hidden when status is PAGADO */}
                {transaction.status !== 'PAGADO' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Valores y Plazos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* Fechas */}
                        <div className="space-y-4 border-r border-slate-100 pr-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Emisión</label>
                                <input type="date" name="issue_date" value={transaction.issue_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Días Crédito</label>
                                <input type="number" name="credit_days" value={transaction.credit_days || 0} onChange={handleInputChange} min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Vencimiento</label>
                                <input type="date" name="due_date" value={transaction.due_date || ''} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
                            </div>
                        </div>

                        {/* Valores */}
                        <div className="md:col-span-2 space-y-4 pl-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Subtotal</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input type="number" name="subtotal" value={transaction.subtotal || 0} onChange={handleInputChange} step="0.01" className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">IVA (%)</label>
                                    <input type="number" name="tax_amount" value={transaction.tax_amount || 0} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Total a Pagar</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-700 font-bold">$</span>
                                    <input type="number" name="total_value" value={transaction.total_value || 0} readOnly className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-xl font-extrabold bg-slate-50 text-slate-800" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Detalle del Pago - Show only when status is PAGADO */}
                {(transaction.status as string) === 'PAGADO' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Detalle del Pago</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Pago</label>
                                <input type="date" name="payment_date" value={transaction.payment_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Monto</label>
                                <input type="number" name="paid_amount" value={transaction.paid_amount || 0} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Método</label>
                                <input name="payment_method" value={transaction.payment_method || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Transferencia" />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Referencia de Pago (Recibo/Comprobante)</label>
                                <input name="payment_reference" value={transaction.payment_reference || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Número de recibo, voucher, etc." />
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* COLUMNA DERECHA (RELACIONES & EXTRAS) */}
            <div className="col-span-12 lg:col-span-1 flex flex-col gap-6">
                
                {/* Relaciones */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Relaciones</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Cliente / Proveedor</label>
                            <div className="relative">
                                <select name="id_client_company" value={transaction.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none appearance-none cursor-pointer">
                                    <option value="">-- Seleccionar --</option>
                                    {clientCompanies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-xs text-slate-400 pointer-events-none"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Vincular Cotización</label>
                            <div className="relative">
                                <select name="id_related_quote" value={transaction.id_related_quote || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none appearance-none cursor-pointer">
                                    <option value="">-- Ninguna --</option>
                                    {quotes.map(q => <option key={q.id_cotizacion} value={q.id_cotizacion}>{q.nombre_cotizacion || q.no_cotizacion}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-xs text-slate-400 pointer-events-none"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Retenciones */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2 flex justify-between">
                        <span>Retenciones</span>
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Nro. Retención</label>
                            <input name="retention_number" value={transaction.retention_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Valor Retenido</label>
                            <input type="number" name="retention_value" value={transaction.retention_value || 0} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" />
                        </div>
                    </div>
                </div>

                {/* Automatización - Hidden when status is PAGADO */}
                {transaction.status !== 'PAGADO' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <i className="fa-solid fa-robot text-indigo-500"></i>
                        <h3 className="font-bold text-slate-700 text-sm">Cobranza Automática</h3>
                    </div>
                    
                    <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                        <span className="text-sm font-bold text-slate-700">Activar Recordatorios</span>
                        <input type="checkbox" name="enable_automation" checked={transaction.enable_automation || false} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    </label>

                    {transaction.enable_automation && (
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600 p-3 bg-white rounded-lg border border-slate-200">
                                <span>Cada</span>
                                <input type="number" name="automation_frequency" value={transaction.automation_frequency || 3} onChange={handleInputChange} min="1" className="w-14 px-1 py-1 text-center border border-slate-300 rounded-md font-bold" />
                                <span>días tras vencimiento.</span>
                            </div>

                            {/* Destinatarios de Alertas */}
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Destinatarios de Alertas</h4>
                                
                                {/* Company Contacts */}
                                {transaction.id_client_company && companyContacts.length > 0 && (
                                    <div className="mb-4 pb-4 border-b border-slate-200">
                                        <p className="text-xs font-bold text-slate-600 mb-2">📋 Contactos de Empresa ({companyContacts.length})</p>
                                        <div className="space-y-2">
                                            {companyContacts.map((contact, idx) => {
                                              const contactId = contact.id_contact || contact.id || `contact-${idx}`;
                                              const contactEmail = contact.email || contact.email_contact || '';
                                              const firstName = contact.name || contact.first_name || contact.name_contact || '';
                                              const lastName = contact.last_name || '';
                                              const contactName = [firstName, lastName].filter(Boolean).join(' ') || 'Sin nombre';
                                              
                                              return (
                                                <label key={`comp-contact-${contactId}-${idx}`} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedRecipients.some(r => String(r.id) === String(contactId) && r.type === 'contact')}
                                                        onChange={() => toggleRecipient({
                                                            email: contactEmail,
                                                            name: contactName,
                                                            type: 'contact',
                                                            id: contactId || null
                                                        })}
                                                        className="w-4 h-4 text-indigo-600 rounded"
                                                    />
                                                    <span className="text-sm text-slate-700">
                                                        {contactName} {contactEmail ? `(${contactEmail})` : '(sin email)'}
                                                    </span>
                                                </label>
                                              );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Team Members */}
                                {teamMembers.length > 0 && (
                                    <div className="mb-4 pb-4 border-b border-slate-200">
                                        <p className="text-xs font-bold text-slate-600 mb-2">👥 Mi Equipo ({teamMembers.length})</p>
                                        <div className="space-y-2">
                                            {teamMembers.map((member, idx) => {
                                              const memberId = member.id;
                                              const memberEmail = member.email || '';
                                              const memberName = member.name || 'Sin nombre';
                                              
                                              return (
                                                <label key={`team-member-${memberId}-${idx}`} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedRecipients.some(r => String(r.id) === String(memberId) && r.type === 'team')}
                                                        onChange={() => toggleRecipient({
                                                            email: memberEmail,
                                                            name: memberName,
                                                            type: 'team',
                                                            id: memberId || null
                                                        })}
                                                        className="w-4 h-4 text-indigo-600 rounded"
                                                    />
                                                    <span className="text-sm text-slate-700">
                                                        {memberName} {memberEmail ? `(${memberEmail})` : '(sin email)'}
                                                    </span>
                                                </label>
                                              );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* External Email Form */}
                                <div className="mb-3">
                                    <p className="text-xs font-bold text-slate-600 mb-2">🔗 Destinatarios Externos</p>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="email"
                                                value={externalEmail}
                                                onChange={(e) => setExternalEmail(e.target.value)}
                                                placeholder="correo@ejemplo.com"
                                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={externalName}
                                                onChange={(e) => setExternalName(e.target.value)}
                                                placeholder="Nombre"
                                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={addExternalRecipient}
                                                className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-bold text-sm hover:bg-indigo-600 transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Selected Recipients Display */}
                                {selectedRecipients.length > 0 && (
                                    <div className="pt-3 border-t border-slate-200">
                                        <p className="text-xs font-bold text-slate-600 mb-2">✓ Seleccionados ({selectedRecipients.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRecipients.map((recipient, idx) => (
                                                <span key={idx} title={recipient.email} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold cursor-help hover:bg-indigo-100 transition-colors">
                                                    {recipient.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRecipient(recipient)}
                                                        className="text-indigo-500 hover:text-indigo-700 font-bold text-sm leading-none"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRecipients.length === 0 && (
                                    <p className="text-xs text-slate-400 italic p-2 text-center bg-slate-100 rounded">
                                        Selecciona al menos un destinatario para enviar recordatorios automáticos
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                )}

                {/* Urgente */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="is_urgent" checked={transaction.is_urgent || false} onChange={handleInputChange} className="w-4 h-4 text-red-600 rounded focus:ring-red-500" />
                        <span className="text-sm font-bold text-red-600 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> Marcar como Urgente</span>
                    </label>
                </div>

                {/* Notas */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Notas Internas</label>
                    <textarea name="notes" value={transaction.notes || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none bg-slate-50" placeholder="Comentarios..." />
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialCreate;