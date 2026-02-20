import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';

// --- TIPOS ---
type ContactOption = {
  id_contact: string;
  name: string;
  email: string;
  position?: string;
  is_main?: boolean;
};

type UserOption = {
  id_user: string;
  name_user: string;
  email: string;
  rol_user?: string;
};

type TenantEmailConfig = {
  email_policy?: 'INDIVIDUAL' | 'CORPORATE';
  corporate_email_address?: string;
};

type CollectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: {
    recipients: Recipient[];
    update_automation: { enabled: boolean; frequency: number };
  }) => void;
  transactionData: {
    id_transaction?: string;
    invoice_number?: string;
    id_client_company?: string; // <--- ESTE ES EL DATO CLAVE
    automation_enabled?: boolean;
    automation_frequency?: number;
    automation_recipients?: Recipient[]; 
  };
};

export type Recipient = {
  email: string;
  name: string;
  type: 'contact' | 'team' | 'external';
  id: string | null;
};

const CollectionModal: React.FC<CollectionModalProps> = ({ isOpen, onClose, onSend, transactionData }) => {
  const { user } = useAuth();
  const hasPreselectRef = useRef(false);
  
  // Estados
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tenantEmailConfig, setTenantEmailConfig] = useState<TenantEmailConfig | null>(null);
  const [loadingTenantConfig, setLoadingTenantConfig] = useState(false);
  
  // Formulario
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');
  const [autoEnabled, setAutoEnabled] = useState<boolean>(!!transactionData.automation_enabled);
  const [frequency, setFrequency] = useState<number>(transactionData.automation_frequency || 3);

  // --- EFECTO DE CARGA ---
  useEffect(() => {
    if (!isOpen || !user?.id_tenant) return;

    const loadData = async () => {
      const tenantId = user.id_tenant;
      const userId = user.id_user;
      const companyId = transactionData.id_client_company;

      // 0. CARGAR CONFIGURACIÓN DE EMAIL DEL TENANT
      setLoadingTenantConfig(true);
      try {
        const tenantRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants/detail?id_tenant=${tenantId}&id_user=${userId}`);
        if (tenantRes.ok) {
          const tenantDataRaw = await tenantRes.json();
          const tenantData = Array.isArray(tenantDataRaw) ? tenantDataRaw[0] : tenantDataRaw;
          setTenantEmailConfig({
            email_policy: tenantData?.email_policy,
            corporate_email_address: tenantData?.corporate_email_address
          });
        }
      } catch (err) {
        console.error("Error cargando configuración de email del tenant:", err);
      } finally {
        setLoadingTenantConfig(false);
      }

      // 1. CARGAR USUARIOS INTERNOS (EQUIPO)
      setLoadingUsers(true);
      apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${tenantId}&id_user=${userId}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
            const cleanUsers = (Array.isArray(data) ? data : []).map((u: any) => ({
                id_user: u.id_user,
                name_user: u.name_user || u.name || 'Usuario',
                email: u.email_user || u.email || '',
                rol_user: u.rol_user
            })).filter((u: UserOption) => u.email);
            setUsers(cleanUsers);
        })
        .catch(err => console.error("Error cargando usuarios:", err))
        .finally(() => setLoadingUsers(false));

      // 2. CARGAR CONTACTOS DE LA EMPRESA
      if (companyId) {
          setLoadingContacts(true);
          // Llamada a la API de contactos filtrando por la empresa
          const urlContacts = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies_contacts/detail?id_tenant=${tenantId}&id_user=${userId}&id_client_company=${companyId}`;


          apiFetch(urlContacts)
            .then(r => {
                if (!r.ok) throw new Error("Error API Contactos");
                return r.json();
            })
            .then(data => {

                
                const cleanContacts = (Array.isArray(data) ? data : []).map((c: any) => ({
                    id_contact: c.id_contact,
                    // Mapeo robusto de nombres y emails
                    name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || 'Contacto',
                    email: c.email || c.contact_email || c.email_contact || '', 
                    position: c.position,
                    is_main: !!c.es_principal
                })).filter((c: ContactOption) => c.email && c.email.includes('@')); // Filtro básico de email válido

                setContacts(cleanContacts);

                // Lógica de preselección (si no hay nada seleccionado aún)
                if (selectedRecipients.length === 0 && !transactionData.automation_recipients) {
                    const recipientsToSelect = [];
                    
                    // 1. Preseleccionar el usuario actual (quien abre el modal)
                    if (user?.email_user && user?.name_user) {
                        recipientsToSelect.push({
                            email: user.email_user,
                            name: user.name_user,
                            type: 'team' as const,
                            id: user.id_user
                        });
                    }
                    
                    // 2. Preseleccionar el contacto principal de la empresa
                    if (cleanContacts.length > 0) {
                        const main = cleanContacts.find((c: ContactOption) => c.is_main) || cleanContacts[0];
                        recipientsToSelect.push({
                            email: main.email,
                            name: main.name,
                            type: 'contact',
                            id: main.id_contact
                        });
                    }
                    
                    // Aplicar todas las preselecciones de una sola vez
                    if (recipientsToSelect.length > 0) {
                        setSelectedRecipients(recipientsToSelect);
                        hasPreselectRef.current = true;
                    }
                }
            })
            .catch(err => console.error("Error cargando contactos:", err))
            .finally(() => setLoadingContacts(false));
      } else {
          console.warn("⚠️ No se encontró ID de empresa, no se cargarán contactos.");
          setContacts([]);
      }

      // Cargar configuración previa si existe (edición)
      if (transactionData.automation_recipients && transactionData.automation_recipients.length > 0) {
          // Parseamos si viene como string, o usamos directo si es objeto
          let savedRecipients = transactionData.automation_recipients;
          if (typeof savedRecipients === 'string') {
              try { savedRecipients = JSON.parse(savedRecipients); } catch(e) {}
          }
          setSelectedRecipients(savedRecipients);
          hasPreselectRef.current = true;
      }
    };

    if (isOpen && !hasPreselectRef.current) {
      loadData();
    }
  }, [isOpen]);

  // Handlers
  const toggleRecipient = (recipient: Recipient) => {
    setSelectedRecipients(prev => {
      const exists = prev.find(r => r.email === recipient.email);
      if (exists) {
        return prev.filter(r => r.email !== recipient.email);
      } else {
        return [...prev, recipient];
      }
    });
  };

  const addExternalRecipient = () => {
    if (!externalEmail || !externalName) return;
    toggleRecipient({ 
        email: externalEmail, 
        name: externalName, 
        type: 'external', 
        id: null 
    });
    setExternalEmail('');
    setExternalName('');
  };

  // Determinar si hay integración de correo activa
  const hasEmailIntegration = (): boolean => {
    // 1. Política corporativa con email corporativo configurado
    if (tenantEmailConfig?.email_policy === 'CORPORATE' && tenantEmailConfig.corporate_email_address) {
      return true;
    }
    
    // 2. Política individual: verificar integración del usuario actual
    if (tenantEmailConfig?.email_policy === 'INDIVIDUAL' || !tenantEmailConfig?.email_policy) {
      return !!(user?.provider && user?.send_emails && user?.email_connected);
    }
    
    return false;
  };

  // Obtener mensaje de configuración de correo
  const getEmailSourceMessage = (): { icon: string; text: string; color: string } => {
    if (tenantEmailConfig?.email_policy === 'CORPORATE' && tenantEmailConfig.corporate_email_address) {
      return {
        icon: 'fa-building',
        text: `Los correos se enviarán desde: ${tenantEmailConfig.corporate_email_address} (cuenta corporativa)`,
        color: 'text-blue-600 bg-blue-50 border-blue-200'
      };
    }
    
    if (user?.provider && user?.send_emails && user?.email_connected) {
      const providerName = user.provider === 'google' ? 'Gmail' : 'Outlook';
      return {
        icon: user.provider === 'google' ? 'fa-brands fa-google' : 'fa-brands fa-microsoft',
        text: `Los correos se enviarán desde: ${user.email_connected} (${providerName})`,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
      };
    }
    
    return {
      icon: 'fa-triangle-exclamation',
      text: 'No hay integración de correo configurada. Configura una integración para enviar notificaciones.',
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    };
  };

  const handleConfirm = () => {
    if (!hasEmailIntegration()) {
      alert('No puedes enviar correos sin una integración activa. Por favor, configura una integración primero.');
      return;
    }
    
    onSend({
      recipients: selectedRecipients,
      update_automation: {
        enabled: autoEnabled,
        frequency: Number(frequency) || 3
      }
    });
  };

  const emailSourceInfo = getEmailSourceMessage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-brand-600"></i> Notificar y Cobrar
            </h2>
            <p className="text-xs text-slate-500">Factura #{transactionData.invoice_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
            
            {/* MENSAJE DE CONFIGURACIÓN DE CORREO */}
            {loadingTenantConfig ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Verificando configuración de correo...</span>
              </div>
            ) : (
              <div className={`flex items-start gap-3 p-3 border rounded-lg ${emailSourceInfo.color}`}>
                <i className={`${emailSourceInfo.icon} text-lg mt-0.5`}></i>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{emailSourceInfo.text}</p>
                  {!hasEmailIntegration() && (
                    <p className="text-[10px] mt-1 opacity-80">
                      Ve a <strong>Configuración</strong> → <strong>Integraciones</strong> para conectar Gmail o Outlook.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* 1. Destinatarios del Cliente */}
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Destinatarios (Cliente)</h3>
                
                {loadingContacts ? (
                    <div className="text-center py-4 text-slate-400 text-xs"><i className="fa-solid fa-spinner fa-spin mr-2"></i> Cargando contactos...</div>
                ) : contacts.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <p className="text-xs text-slate-500">No se encontraron contactos con email para esta empresa.</p>
                        {!transactionData.id_client_company && <p className="text-[10px] text-red-400 mt-1">Error: La transacción no tiene una empresa asociada.</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {contacts.map(c => {
                            const isSelected = selectedRecipients.some(r => r.email === c.email);
                            return (
                                <label key={c.id_contact} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={() => toggleRecipient({ email: c.email, name: c.name, type: 'contact', id: c.id_contact })}
                                        className="mt-1 w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                    />
                                    <div className="overflow-hidden">
                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-brand-900' : 'text-slate-700'}`}>{c.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{c.email}</p>
                                        {c.position && <p className="text-[10px] text-slate-400 mt-0.5">{c.position}</p>}
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2. Copia Interna (Equipo) */}
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Copia a Equipo (CC)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {users.map(u => {
                        const isSelected = selectedRecipients.some(r => r.email === u.email);
                        return (
                            <label key={u.id_user} className={`flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => toggleRecipient({ email: u.email, name: u.name_user, type: 'team', id: u.id_user })}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-slate-700 truncate">{u.name_user}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* 3. Externos */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 mb-2">Agregar Externo</label>
                <div className="flex gap-2 mb-3">
                    <input 
                        placeholder="Nombre" 
                        value={externalName} 
                        onChange={e => setExternalName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500"
                    />
                    <input 
                        type="email" 
                        placeholder="correo@ejemplo.com" 
                        value={externalEmail} 
                        onChange={e => setExternalEmail(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500"
                    />
                    <button 
                        onClick={addExternalRecipient}
                        disabled={!externalEmail || !externalName}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50"
                    >
                        Agregar
                    </button>
                </div>
                
                {/* Chips de Externos y Seleccionados */}
                <div className="flex flex-wrap gap-2">
                    {selectedRecipients.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-300 text-xs text-slate-600 shadow-sm">
                            {r.type === 'external' && <i className="fa-solid fa-globe text-slate-400"></i>}
                            {r.name}
                            <button onClick={() => toggleRecipient(r)} className="hover:text-red-500 transition-colors ml-1"><i className="fa-solid fa-times"></i></button>
                        </span>
                    ))}
                </div>
            </div>

            {/* 4. Automatización */}
            <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Automatizar Recordatorios</p>
                        <p className="text-xs text-slate-500">El sistema enviará correos automáticamente si la factura vence.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={autoEnabled} onChange={e => setAutoEnabled(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                    </label>
                </div>
                
                {autoEnabled && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <i className="fa-solid fa-clock text-blue-500"></i>
                        <span>Enviar recordatorio cada</span>
                        <input 
                            type="number" 
                            min={1} 
                            value={frequency} 
                            onChange={e => setFrequency(Number(e.target.value) || 1)}
                            className="w-12 text-center border-b border-blue-300 bg-transparent font-bold focus:outline-none"
                        />
                        <span>días tras vencimiento.</span>
                    </div>
                )}
            </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
            <button 
                onClick={onClose} 
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-white transition-colors text-sm"
            >
                Cancelar
            </button>
            <button
                onClick={handleConfirm}
                disabled={selectedRecipients.length === 0}
                className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
                <i className="fa-regular fa-paper-plane"></i>
                Enviar y Guardar
            </button>
        </div>

      </div>
    </div>
  );
};

export default CollectionModal;
