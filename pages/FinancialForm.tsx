import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { financialService } from '../services/financials.service';
import type { ClientCompany, FinancialTransaction, Quote } from '../types';

type ContactOption = { id_contact?: string; id?: string; name?: string; email?: string; [key: string]: any; };
type SelectedRecipient = { email: string; name: string; type: 'contact' | 'team' | 'external'; id: string | null; };

const FinancialForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [transaction, setTransaction] = useState<Partial<FinancialTransaction>>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  
  // Contactos
  const [allCompanyContacts, setAllCompanyContacts] = useState<ContactOption[]>([]);
  const [companyContacts, setCompanyContacts] = useState<ContactOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<ContactOption[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  
  // UI Inputs extras
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- 1. CARGA DE DATOS ---
  const setDefaults = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE',
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
  }, []);

  useEffect(() => {
    const init = async () => {
        if (!user?.id_tenant) return;
        setLoading(true);
        try {
            // Cargar Catálogos
            const API = import.meta.env.VITE_WEBHOOK_URL;
            const [companiesRes, quotesRes, contactsRes, teamRes] = await Promise.all([
                fetch(`${API}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
                fetch(`${API}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
                fetch(`${API}/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
                fetch(`${API}/api/users?id_tenant=${user.id_tenant}`)
            ]);

            const parse = async (r: Response) => r.ok ? r.json() : [];
            setClientCompanies(await parse(companiesRes));
            setQuotes(await parse(quotesRes));
            setAllCompanyContacts(await parse(contactsRes));
            const team = await parse(teamRes);
            setTeamMembers(team.map((u: any) => ({
                id: u.id_user || u.id,
                name: u.name_user || u.name,
                email: u.email || u.email_user
            })));

            // Si es edición, cargar datos
            if (isEditing && id) {
                const data = await financialService.getById(id, user.id_tenant);
                const tx = Array.isArray(data) ? data[0] : data;
                if (!tx) throw new Error("Transacción no encontrada");

                // Parsear destinatarios
                let recipients = [];
                try {
                    if (typeof tx.automation_recipients === 'string') recipients = JSON.parse(tx.automation_recipients);
                    else recipients = tx.automation_recipients || [];
                } catch { recipients = []; }

                setTransaction({
                    ...tx,
                    // Asegurar fechas YYYY-MM-DD para inputs date
                    issue_date: tx.v_input_fecha_emision ? tx.v_input_fecha_emision.split('/').reverse().join('-') : (tx.issue_date || '').split('T')[0],
                    due_date: tx.v_input_fecha_vencimiento ? tx.v_input_fecha_vencimiento.split('/').reverse().join('-') : (tx.due_date || '').split('T')[0],
                    payment_date: tx.v_input_fecha_pago ? tx.v_input_fecha_pago.split('/').reverse().join('-') : (tx.payment_date || '').split('T')[0],
                    retention_date: tx.v_input_fecha_retencion ? tx.v_input_fecha_retencion.split('/').reverse().join('-') : (tx.retention_date || '').split('T')[0],
                    
                    // Mapeos de nombres de DB
                    id_client_company: tx.id_empresa_cliente || tx.id_client_company,
                    invoice_number: tx.numero_factura || tx.invoice_number,
                    description: tx.descripcion_concepto || tx.description,
                    credit_days: Number(tx.credit_days || 0),
                    subtotal: Number(tx.subtotal || 0),
                    total_value: Number(tx.total_factura || tx.total_value || 0),
                    paid_amount: Number(tx.monto_pagado_caja || tx.paid_amount || 0),
                    retention_value: Number(tx.valor_retencion || tx.retention_value || 0),
                });
                setSelectedRecipients(recipients);
            } else {
                setDefaults();
            }
        } catch (e) {
            console.error(e);
            setToast({ message: 'Error cargando datos', type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [user, id, isEditing, setDefaults]);

  // Filtrar contactos de empresa al cambiar cliente
  useEffect(() => {
    if (transaction.id_client_company) {
        const filtered = allCompanyContacts.filter(c => 
            String(c.id_client_company || c.company_id || c.id_company) === String(transaction.id_client_company)
        );
        setCompanyContacts(filtered);
    } else {
        setCompanyContacts([]);
    }
  }, [transaction.id_client_company, allCompanyContacts]);

  // --- 2. LOGICA DEL FORMULARIO ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setTransaction(prev => {
      const updated: any = { ...prev, [name]: type === 'checkbox' ? checked : value };

      // Autocalcular total
      if (name === 'subtotal' || name === 'tax_amount') {
        const sub = parseFloat(name === 'subtotal' ? value : String(prev.subtotal || 0)) || 0;
        const tax = parseFloat(name === 'tax_amount' ? value : String(prev.tax_amount || 0)) || 0;
        updated.total_value = sub + (sub * (tax / 100));
      }
      
      // Autocalcular vencimiento
      if (name === 'issue_date' || name === 'credit_days') {
         const issue = name === 'issue_date' ? value : prev.issue_date;
         const days = parseInt(name === 'credit_days' ? value : String(prev.credit_days || 0));
         if (issue) {
             const d = new Date(issue);
             d.setDate(d.getDate() + days + 1);
             updated.due_date = d.toISOString().split('T')[0];
         }
      }
      
      // Si cambia a pagado, rellenar monto
      if (name === 'status' && value === 'PAGADO') {
          updated.paid_amount = updated.total_value;
          updated.payment_date = new Date().toISOString().split('T')[0];
      }

      return updated;
    });
  };

  const toggleRecipient = (r: SelectedRecipient) => {
     setSelectedRecipients(prev => {
        const key = `${r.type}-${r.id}-${r.email}`;
        const exists = prev.some(x => `${x.type}-${x.id}-${x.email}` === key);
        return exists ? prev.filter(x => `${x.type}-${x.id}-${x.email}` !== key) : [...prev, r];
     });
  };

  const addExternalRecipient = () => {
      if(!externalEmail || !externalName) return;
      toggleRecipient({ email: externalEmail, name: externalName, type: 'external', id: null });
      setExternalEmail(''); setExternalName('');
  };

  // --- 3. GUARDADO SEGURO (FIX DE FECHAS) ---
  const handleSave = async () => {
    if (!transaction.invoice_number) return setToast({message:'Falta número factura', type:'error'});
    
    setSaving(true);
    try {
        // Función Helper para limpiar fechas vacías "" -> null
        const cleanDate = (d: string | undefined) => (!d || d.trim() === '') ? null : d;
        const cleanId = (id: string | undefined) => (!id || id === '') ? null : id;

        const payload = {
            ...transaction,
            id_tenant: user?.id_tenant,
            created_by: user?.id_user,
            
            // LIMPIEZA DE FECHAS CLAVE
            issue_date: cleanDate(transaction.issue_date),
            due_date: cleanDate(transaction.due_date),
            payment_date: cleanDate(transaction.payment_date),
            retention_date: cleanDate(transaction.retention_date),
            
            // LIMPIEZA DE IDs
            id_client_company: cleanId(transaction.id_client_company),
            id_related_quote: cleanId(transaction.id_related_quote),

            // NUMERICOS SEGUROS
            subtotal: Number(transaction.subtotal || 0),
            total_value: Number(transaction.total_value || 0),
            paid_amount: Number(transaction.paid_amount || 0),
            tax_amount: Number(transaction.tax_amount || 0),
            credit_days: Number(transaction.credit_days || 0),
            retention_value: Number(transaction.retention_value || 0),
            automation_frequency: Number(transaction.automation_frequency || 3),

            automation_recipients: selectedRecipients,
            id_transaction: isEditing ? id : undefined
        };

        if (isEditing) {
            await financialService.update(payload);
            setToast({ message: 'Actualizado correctamente', type: 'success' });
        } else {
            await financialService.create(payload);
            setToast({ message: 'Creado correctamente', type: 'success' });
        }

        setTimeout(() => navigate('/app/financials'), 800);

    } catch (e: any) {
        setToast({ message: e.message || 'Error al guardar', type: 'error' });
    } finally {
        setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500"></i></div>;

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-20 animate-fade-in">
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        
        {/* Header Compacto */}
        <div className="px-4 py-3 flex items-center justify-between bg-white border-b sticky top-0 z-20 shadow-sm">
            <div>
                <h1 className="text-xl font-extrabold text-slate-800">{isEditing ? 'Editar Transacción' : 'Nueva Transacción'}</h1>
                <p className="text-xs text-slate-500">{isEditing ? `Editando #${transaction.invoice_number}` : 'Registro financiero'}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => navigate('/app/financials')} className="px-4 py-2 text-xs font-bold text-slate-600 border rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-md flex items-center gap-2 transition-all">
                    {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                    Guardar
                </button>
            </div>
        </div>

        {/* Layout Grid */}
        <div className="px-4 md:px-8 max-w-[1920px] mx-auto mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMNA PRINCIPAL */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tarjeta: Información Básica */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase border-b pb-2 mb-4">Datos Generales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo</label>
                                <select name="transaction_type" value={transaction.transaction_type} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                                    <option value="VENTA">Venta (Ingreso)</option>
                                    <option value="GASTO">Gasto (Egreso)</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                                <select name="status" value={transaction.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="PAGADO">Pagado</option>
                                    <option value="ANULADO">Anulado</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Número Factura / Documento *</label>
                                <input name="invoice_number" value={transaction.invoice_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-mono tracking-wide focus:ring-2 focus:ring-brand-500 outline-none" placeholder="001-001-000000001" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                                <textarea name="description" value={transaction.description || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none" rows={2} placeholder="Concepto..." />
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta: Valores Económicos */}
                    {transaction.status !== 'PAGADO' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h3 className="text-xs font-bold text-slate-400 uppercase border-b pb-2 mb-4">Valores y Plazos</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                             <div className="border-r border-slate-100 pr-4 space-y-4">
                                 <div>
                                     <label className="block text-xs font-bold text-slate-500 mb-1">Emisión</label>
                                     <input type="date" name="issue_date" value={transaction.issue_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-500 mb-1">Días Crédito</label>
                                     <input type="number" name="credit_days" value={transaction.credit_days || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-500 mb-1">Vencimiento</label>
                                     <input type="date" value={transaction.due_date || ''} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-400" />
                                 </div>
                             </div>
                             <div className="md:col-span-2 pl-2 space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <label className="block text-xs font-bold text-slate-500 mb-1">Subtotal ($)</label>
                                         <input type="number" name="subtotal" value={transaction.subtotal || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" step="0.01" />
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-slate-500 mb-1">IVA (%)</label>
                                         <input type="number" name="tax_amount" value={transaction.tax_amount || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                     </div>
                                 </div>
                                 <div>
                                     <label className="block text-sm font-bold text-slate-700 mb-1">Total a Pagar</label>
                                     <input type="number" value={transaction.total_value || 0} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xl font-bold bg-slate-50 text-slate-800" />
                                 </div>
                             </div>
                         </div>
                    </div>
                    )}

                    {/* Tarjeta: Detalles de Pago (Solo si PAGADO) */}
                    {transaction.status === 'PAGADO' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-emerald-600 uppercase border-b pb-2 mb-4">Detalles del Pago</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Pago</label>
                                    <input type="date" name="payment_date" value={transaction.payment_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Monto Pagado</label>
                                    <input type="number" name="paid_amount" value={transaction.paid_amount || 0} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" step="0.01" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Método</label>
                                    <select name="payment_method" value={transaction.payment_method || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                                        <option value="">Seleccionar...</option>
                                        <option value="TRANSFERENCIA">Transferencia</option>
                                        <option value="EFECTIVO">Efectivo</option>
                                        <option value="TARJETA">Tarjeta</option>
                                        <option value="CHEQUE">Cheque</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Referencia / Comprobante</label>
                                    <input name="payment_reference" value={transaction.payment_reference || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: Recibo #123456" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMNA LATERAL */}
                <div className="space-y-6">
                    {/* Relaciones */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h3 className="text-xs font-bold text-slate-400 uppercase border-b pb-2 mb-4">Cliente y Origen</h3>
                         <div className="space-y-4">
                             <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Cliente / Proveedor</label>
                                 <select name="id_client_company" value={transaction.id_client_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                                     <option value="">-- Seleccionar --</option>
                                     {clientCompanies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Cotización Relacionada</label>
                                 <select name="id_related_quote" value={transaction.id_related_quote || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                                     <option value="">-- Ninguna --</option>
                                     {quotes.map(q => <option key={q.id_cotizacion} value={q.id_cotizacion}>{q.nombre_cotizacion || q.no_cotizacion}</option>)}
                                 </select>
                             </div>
                         </div>
                    </div>

                    {/* Retenciones */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase border-b pb-2 mb-4">Retenciones</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Nro. Retención</label>
                                <input name="retention_number" value={transaction.retention_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Valor Retenido ($)</label>
                                <input type="number" name="retention_value" value={transaction.retention_value || 0} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Emisión Retención</label>
                                <input type="date" name="retention_date" value={transaction.retention_date || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Automatización */}
                    {transaction.status !== 'PAGADO' && (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input type="checkbox" name="enable_automation" checked={transaction.enable_automation || false} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 rounded" />
                            <span className="font-bold text-slate-700 text-sm">Cobranza Automática</span>
                        </label>
                        
                        {transaction.enable_automation && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>Cada</span>
                                    <input type="number" name="automation_frequency" value={transaction.automation_frequency || 3} onChange={handleInputChange} className="w-12 px-1 py-1 text-center border rounded font-bold" min="1" />
                                    <span>días tras vencimiento.</span>
                                </div>

                                <div className="bg-white p-3 rounded border border-slate-200">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Destinatarios</p>
                                    
                                    {/* Lista Contactos Empresa */}
                                    {companyContacts.length > 0 && (
                                        <div className="mb-3 pb-3 border-b border-slate-100">
                                            {companyContacts.map(c => (
                                                <label key={c.id || c.id_contact} className="flex gap-2 items-center text-xs py-1 cursor-pointer hover:bg-slate-50">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedRecipients.some(r => r.email === (c.email || c.email_contact))}
                                                        onChange={() => toggleRecipient({
                                                            email: c.email || c.email_contact || '',
                                                            name: c.name || c.first_name || '',
                                                            type: 'contact',
                                                            id: c.id || c.id_contact || null
                                                        })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span className="truncate">{c.name || c.first_name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* Externo */}
                                    <div className="flex gap-1 mt-2">
                                        <input value={externalEmail} onChange={e => setExternalEmail(e.target.value)} placeholder="Email externo..." className="w-full text-xs px-2 py-1 border rounded" />
                                        <button onClick={addExternalRecipient} className="bg-indigo-100 text-indigo-600 px-2 rounded font-bold hover:bg-indigo-200">+</button>
                                    </div>
                                    
                                    {/* Seleccionados */}
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {selectedRecipients.map((r, i) => (
                                            <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100">
                                                {r.email} <button onClick={() => toggleRecipient(r)}>×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Otros */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input type="checkbox" name="is_urgent" checked={transaction.is_urgent || false} onChange={handleInputChange} className="w-4 h-4 text-red-600 rounded" />
                            <span className="font-bold text-red-600 text-sm flex gap-2"><i className="fa-solid fa-triangle-exclamation"></i> Marcar como Urgente</span>
                        </label>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notas Internas</label>
                            <textarea name="notes" value={transaction.notes || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" rows={2} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};

export default FinancialForm;