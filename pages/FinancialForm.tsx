import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { financialService } from '../services/financials.service';
import Toast from '../components/Toast';
import type { ClientCompany, FinancialTransaction, Quote } from '../types';

// --- HELPERS ---
const formatCurrency = (val: number) => 
  val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type SelectedRecipient = {
  email: string;
  name: string;
  type: 'contact' | 'team' | 'external';
  id: string | null;
};

type FinancialFormData = Partial<FinancialTransaction> & {
    enable_automation?: boolean;
    automation_frequency?: number;
    status?: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO';
};

const FinancialForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtener el ID de los query params
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  const { user } = useAuth();
  
  // Modo edición si el id existe
  const isEditMode = !!id;
  
  // DEBUG
  console.log('📝 FinancialForm renderizado');
  console.log('   location.search:', location.search);
  console.log('   id:', id);
  console.log('   isEditMode:', isEditMode);

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

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    console.log('🔄 fetchData ejecutándose...');
    console.log('   location.search:', location.search);
    
    if (!user?.id_tenant || !user?.id_user) {
      console.log('❌ Sin usuario');
      return;
    }
    
    // Obtener el ID de los query params dentro del callback
    const queryParams = new URLSearchParams(location.search);
    const transactionId = queryParams.get('id');
    const isEditingMode = !!transactionId;
    
    console.log('   transactionId:', transactionId);
    console.log('   isEditingMode:', isEditingMode);
    
    try {
      const [companiesRes, quotesRes, contactsRes, teamRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}`)
      ]);

      const parse = async (r: Response) => (r.ok ? await r.json() : []);
      const [cData, qData, conData, tData] = await Promise.all([parse(companiesRes), parse(quotesRes), parse(contactsRes), parse(teamRes)]);

      setClientCompanies(cData);
      setQuotes(qData);
      setAllCompanyContacts(conData);
      setTeamMembers(tData.filter((u: any) => u.id_user !== user.id_user).map((u: any) => ({
        id: u.id_user || u.id,
        name: u.name_user || u.name || 'Sin nombre',
        email: u.email || u.email_user || ''
      })));

      // Si es modo edición, cargar los datos de la transacción
      if (isEditingMode && transactionId) {
        console.log('🔄 Cargando transacción para editar:', transactionId);
        const detailRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${transactionId}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          const tx = Array.isArray(data) ? data[0] : data;
          console.log('📦 Datos de transacción cargados:', tx);
          if (tx) {
            // Mapear los datos desde el formato de la API al formato del formulario
            const normalized: FinancialFormData = {
              id_transaction: tx.id_transaccion || tx.id_transaction,
              invoice_number: tx.numero_factura || tx.invoice_number,
              description: tx.descripcion_concepto || tx.description,
              transaction_type: tx.tipo_transaccion || tx.transaction_type,
              status: tx.estado_registro || tx.status,
              issue_date: tx.v_input_fecha_emision || tx.issue_date || tx.fecha_emision?.split('T')[0],
              due_date: tx.v_input_fecha_vencimiento || tx.due_date || tx.fecha_vencimiento?.split('T')[0],
              id_client_company: tx.id_empresa_cliente || tx.id_client_company,
              subtotal: parseFloat(tx.subtotal || 0),
              tax_amount: parseFloat(tx.impuestos || 0),
              total_value: parseFloat(tx.total_factura || tx.total_value || 0),
              retention_value: parseFloat(tx.valor_retencion || 0),
              retention_number: tx.retention_number,
              is_urgent: tx.es_urgente || tx.is_urgent,
              notes: tx.notas_internas || tx.notes,
              enable_automation: tx.enable_automation === true,
              automation_frequency: tx.automation_frequency || 3,
              automation_recipients: Array.isArray(tx.automation_recipients) ? tx.automation_recipients : []
            };
            console.log('✅ Transacción mapeada:', normalized);
            setTransaction(normalized);
            
            // Actualizar el breadcrumb con el número de factura (preservar los search params)
            navigate(location.pathname + location.search, { state: { breadcrumb: normalized.invoice_number }, replace: true });

            // Cargar recipientes si existen
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
          console.error('❌ Error al cargar transacción:', detailRes.status);
          setToast({ message: 'Error al cargar la transacción.', type: 'error' });
        }
      } else {
        console.log('➕ Creando nueva transacción');
        setDefaults();
      }
    } catch (error) {
      console.error('❌ Error en fetchData:', error);
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
      credit_days: 0,
      subtotal: 0,
      tax_amount: 15,
      total_value: 0,
      enable_automation: false,
      automation_frequency: 3,
      retention_value: 0
    });
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setTransaction(prev => {
      const updated: any = { ...prev, [name]: type === 'checkbox' ? checked : value };

      if (name === 'subtotal' || name === 'tax_amount') {
        const sub = parseFloat(name === 'subtotal' ? value : (prev.subtotal || 0) as any);
        const tax = parseFloat(name === 'tax_amount' ? value : (prev.tax_amount || 0) as any);
        updated.total_value = sub + (sub * (tax / 100));
      }

      if (name === 'issue_date' || name === 'credit_days') {
        const date = new Date(name === 'issue_date' ? value : (prev.issue_date || ''));
        const days = parseInt(name === 'credit_days' ? value : (prev.credit_days || 0) as any);
        date.setDate(date.getDate() + days);
        updated.due_date = date.toISOString().split('T')[0];
      }

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
    if (!externalEmail || !externalName) return;
    toggleRecipient({ email: externalEmail, name: externalName, type: 'external', id: null });
    setExternalEmail(''); setExternalName('');
  };

  const handleSave = async () => {
    if (!transaction.invoice_number?.trim() || !transaction.id_client_company || !transaction.description?.trim()) {
      setToast({ message: 'Factura, Cliente y Descripción son obligatorios.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...transaction,
        id_tenant: user?.id_tenant,
        id_user: user?.id_user,
        automation_recipients: transaction.enable_automation ? selectedRecipients : []
      };

      let res;
      if (isEditMode) {
        // Actualizar - usar financialService.update()
        console.log('Editando con payload:', payload);
        await financialService.update(payload);
        res = { ok: true }; // Asumir que financialService.update lanza error si falla
      } else {
        // Crear nuevo
        console.log('Creando con payload:', payload);
        res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Error en respuesta del servidor');
      setToast({ message: isEditMode ? 'Registro actualizado.' : 'Registro creado.', type: 'success' });
      setTimeout(() => navigate('/app/financials'), 1000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar. ' + (error instanceof Error ? error.message : ''), type: 'error' });
    } finally {
      setSaving(false);
    }
  };;

  if (loading) return <div className="p-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500"></i></div>;

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
            {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Tipo</label>
                  <select name="transaction_type" value={transaction.transaction_type} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                      <option value="VENTA">Ingreso (Venta)</option>
                      <option value="GASTO">Egreso (Gasto)</option>
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Estado</label>
                  <select name="status" value={transaction.status} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="PAGADO">Pagado</option>
                      <option value="VENCIDO">Vencido</option>
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
                  <div><label className="text-xs font-bold text-slate-600 mb-1 block">Días Crédito</label><input type="number" name="credit_days" value={transaction.credit_days || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase block tracking-tighter">Vencimiento Calculado</label><input type="date" value={transaction.due_date || ''} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400" /></div>
              </div>
              <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Subtotal</label><input type="number" name="subtotal" value={transaction.subtotal || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">IVA (%)</label><input type="number" name="tax_amount" value={transaction.tax_amount || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Total a Pagar / Cobrar</label>
                    <p className="text-4xl font-black text-slate-800 font-mono tracking-tighter">{formatCurrency(transaction.total_value || 0)}</p>
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
                <div><label className="text-xs font-bold text-slate-600 mb-1.5 block">Valor Retenido</label><input type="number" name="retention_value" value={transaction.retention_value || 0} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-brand-600" /></div>
            </div>
          </div>

          {/* AUTOMATIZACIÓN */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4"><i className="fa-solid fa-robot text-indigo-500"></i><h2 className="text-sm font-bold text-indigo-900">Cobranza Automática</h2></div>
            <label className="flex items-center justify-between p-3 bg-white border border-indigo-200 rounded-lg cursor-pointer hover:shadow-sm mb-4"><span className="text-xs font-bold text-slate-700">Activar Recordatorios</span><input type="checkbox" name="enable_automation" checked={transaction.enable_automation || false} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 rounded" /></label>

            {transaction.enable_automation && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="text-[11px] text-indigo-700 bg-white p-2.5 rounded border border-indigo-100 flex items-center gap-2"><span>Cada</span><input type="number" name="automation_frequency" value={transaction.automation_frequency} onChange={handleInputChange} className="w-10 text-center font-bold bg-transparent border-b border-indigo-300 outline-none" /><span>días.</span></div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Destinatarios de Alertas</p>
                  
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Contactos Empresa</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredContacts.length > 0 ? filteredContacts.map(c => (
                        <label key={c.id_contact} className="flex items-center gap-2 p-1.5 hover:bg-white rounded text-[11px] cursor-pointer"><input type="checkbox" checked={selectedRecipients.some(r => r.email === (c.email || c.email_contact))} onChange={() => toggleRecipient({ email: c.email || c.email_contact, name: c.first_name, type: 'contact', id: c.id_contact })} className="w-3.5 h-3.5 rounded text-indigo-600" /><span>{c.first_name} {c.last_name}</span></label>
                      )) : <p className="text-[10px] text-slate-300">Sin contactos.</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Mi Equipo</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {teamMembers.map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded text-[11px] cursor-pointer"><input type="checkbox" checked={selectedRecipients.some(r => r.email === m.email)} onChange={() => toggleRecipient({ email: m.email, name: m.name, type: 'team', id: m.id })} className="w-3.5 h-3.5 rounded text-indigo-600" /><span>{m.name}</span></label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Externos</p>
                    <div className="flex gap-1">
                        <input value={externalEmail} onChange={e => setExternalEmail(e.target.value)} className="flex-1 px-2 py-1.5 border border-indigo-200 rounded text-[10px] outline-none focus:ring-1 focus:ring-indigo-400" placeholder="Email" />
                        <input value={externalName} onChange={e => setExternalName(e.target.value)} className="flex-1 px-2 py-1.5 border border-indigo-200 rounded text-[10px] outline-none focus:ring-1 focus:ring-indigo-400" placeholder="Nombre" />
                        <button onClick={addExternalRecipient} className="px-2.5 bg-indigo-500 text-white rounded text-xs">+</button>
                    </div>
                  </div>

                  {selectedRecipients.length > 0 && (
                    <div className="pt-2 border-t border-indigo-200 flex flex-wrap gap-1">
                        {selectedRecipients.map((r, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white text-indigo-600 border border-indigo-200 rounded-full text-[9px] font-bold flex items-center gap-1">{r.name} <button onClick={() => toggleRecipient(r)} className="text-rose-400 hover:text-rose-600 font-bold">×</button></span>
                        ))}
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
