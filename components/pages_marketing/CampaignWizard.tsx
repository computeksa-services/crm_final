import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import { MarketingList } from '../../types';
import JoditEditor from 'jodit-react';
import Toast from '../Toast';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';

// --- CONFIGURACIÓN ---
const STEPS = [
  { id: 1, label: 'Detalles' },
  { id: 2, label: 'Audiencia' },
  { id: 3, label: 'Diseño' },
  { id: 4, label: 'Revisión' }
];

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface Attachment {
  name: string;
  size: string;
  type: string;
  file?: File;
}

const CampaignWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(id || null);
  const isEditing = !!currentCampaignId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  // --- ESTADOS ---
  const [currentStep, setCurrentStep] = useState(1);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<{ corporate_email_address?: string; name_tenant?: string } | null>(null);
  const [searchLists, setSearchLists] = useState('');
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Estado para controlar si hay cambios pendientes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal States
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email_user || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    previewText: '',
    senderName: user?.name_user || '',
    senderEmail: user?.email_user || '',
    senderType: 'USER' as 'USER' | 'TENANT',
    selectedLists: [] as string[],
    htmlContent: '<div style="font-family: Arial, sans-serif; padding: 20px;">\n<h1>Hola {{first_name}},</h1>\n<p>Escribe tu mensaje aquí...</p>\n</div>',
    attachments: [] as Attachment[],
    scheduledAt: null as string | null,
    scheduledTimezone: null as string | null
  });

  // --- CONFIGURACIÓN DE JODIT ---
  const joditConfig = useMemo(() => ({
    readonly: false,
    height: 500,
    language: 'es',
    toolbarAdaptive: false,
    uploader: {
      insertImageAsBase64URI: true
    },
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'fontsize', 'brush', 'paragraph', '|',
      'ul', 'ol', '|',
      'image', 'link', 'table', '|',
      'align', 'undo', 'redo', '|',
      {
        name: 'Variables',
        text: 'Variables',
        icon: 'plus',
        tooltip: 'Insertar datos del contacto',
        list: {
          '{{first_name}}': 'Nombre',
          '{{last_name}}': 'Apellido',
          '{{email}}': 'Email',
          '{{company_name}}': 'Empresa',
          '{{position}}': 'Cargo',
          '{{city}}': 'Ciudad',
          '{{website}}': 'Sitio Web',
          '{{unsubscribe_url}}': 'Link Desuscripción'
        },
        exec: (editor: any, _this: any, { control }: any) => {
           const key = control.args?.[0];
           if (key) editor.s.insertHTML(key);
        }
      },
      '|',
      'source'
    ],
    removeButtons: ['about', 'print', 'file']
  }), []);

  // --- EFECTOS ---
  useEffect(() => {
    loadLists();
    loadTenantData();
  }, []);

  useEffect(() => {
    if (currentCampaignId) loadCampaignData(currentCampaignId);
  }, [currentCampaignId]);

  // --- HELPER PARA ACTUALIZAR FORM Y MARCAR COMO SUCIO ---
  const updateForm = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // --- CARGAS DE DATOS ---
  const loadLists = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      setIsLoadingLists(true);
      const data = await marketingApi.getLists(user.id_tenant, user.id_user);
      setLists(data);
    } catch (error) { console.error(error); }
    finally { setIsLoadingLists(false); }
  };

  const loadTenantData = async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant }));
      if (res.ok) {
        const data = await res.json();
        const tenant = Array.isArray(data) ? data[0] : data;
        setTenantData({
          corporate_email_address: tenant?.corporate_email_address,
          name_tenant: tenant?.name_tenant
        });
      }
    } catch (error) { console.error(error); }
  };

  const loadCampaignData = async (campId: string) => {
    try {
      const response = await marketingApi.getCampaignDetail(campId);
      const campaign = Array.isArray(response) ? response[0] : response;
      if (!campaign) return;
      
      const normalizedLists = Array.isArray(campaign.target_lists) 
        ? campaign.target_lists.map((listId: any) => String(listId))
        : [];
      
      setFormData(prev => ({
        ...prev,
        name: campaign.name,
        subject: campaign.subject,
        previewText: campaign.preview_text || '',
        htmlContent: campaign.html_content || prev.htmlContent,
        senderType: campaign.sender_type,
        senderName: campaign.sender_name || prev.senderName,
        senderEmail: campaign.sender_email || prev.senderEmail,
        selectedLists: normalizedLists,
        scheduledAt: campaign.scheduled_at || null,
        scheduledTimezone: campaign.schedule_timezone || null,
        attachments: Array.isArray(campaign.attachments) ? campaign.attachments : []
      }));
      
      // Al cargar datos iniciales, no hay cambios sin guardar
      setHasUnsavedChanges(false);
    } catch (error) { console.error(error); }
  };

  // --- MANEJADORES DE PASOS ---
  const handleNext = () => {
    if (currentStep === 1) {
        if (!formData.name) {
            setToast({ message: 'El nombre interno es obligatorio.', type: 'error' });
            return;
        }
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // --- FILES & ATTACHMENTS (MEJORADO) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const validFiles: Attachment[] = [];
      let errorMsg = '';

      filesArray.forEach(file => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            errorMsg = `El archivo "${file.name}" supera el límite de ${MAX_FILE_SIZE_MB}MB.`;
        } else {
            validFiles.push({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                type: file.type,
                file: file
            });
        }
      });

      if (errorMsg) {
          setToast({ message: errorMsg, type: 'error' });
      }

      if (validFiles.length > 0) {
          // Reemplaza o agrega según tu lógica. Aquí agrego.
          // Si solo permites 1, sería: setFormData... attachments: validFiles
          // Si permites múltiples: [...prev.attachments, ...validFiles]
          // Dado que tu backend bloquea si hay > 1, mejor reemplacemos o validemos longitud.
          
          if (formData.attachments.length + validFiles.length > 1) {
             setToast({ message: 'Solo se permite 1 archivo adjunto por campaña.', type: 'error' });
             return; 
          }

          setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...validFiles]
          }));
          setHasUnsavedChanges(true);
      }
    }
    // Limpiamos el input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
    setHasUnsavedChanges(true);
  };

  const handleSenderTypeChange = (type: 'USER' | 'TENANT') => {
    let senderEmail = type === 'USER' ? (user?.email_user || '') : (tenantData?.corporate_email_address || '');
    let senderName = type === 'USER' ? (user?.name_user || '') : (tenantData?.name_tenant || 'Empresa');
    updateForm({ senderType: type, senderEmail, senderName });
  };

  const toggleList = (listId: string) => {
    const normId = String(listId);
    setFormData(prev => {
        const isSelected = prev.selectedLists.includes(normId);
        const newLists = isSelected 
            ? prev.selectedLists.filter(id => id !== normId)
            : [...prev.selectedLists, normId];
        setHasUnsavedChanges(true);
        return { ...prev, selectedLists: newLists };
    });
  };

  // --- VALIDACIÓN PARA ENVIAR ---
  const isValidForSending = useMemo(() => {
      return (
          formData.name.trim() !== '' &&
          formData.subject.trim() !== '' &&
          formData.selectedLists.length > 0 &&
          formData.htmlContent.trim() !== '' &&
          formData.htmlContent !== '<p><br></p>' // Jodit empty state sometimes
      );
  }, [formData]);

  // --- GUARDADO ---
// --- GUARDADO Y ENVÍO ---
  const saveCampaign = async (scheduleData?: { at: string, tz: string }, isDraft = false) => {
      if (!user?.id_tenant || !user?.id_user) return;
      if (!formData.name) {
          setToast({ message: 'El nombre interno es obligatorio.', type: 'error' });
          return;
      }

      try {
        setIsSaving(true);

        // --- PASO 1: GUARDAR DATOS (Create / Update) ---
        // Primero aseguramos que el contenido, adjuntos y listas estén guardados en la BD
        const saveAction = currentCampaignId ? 'update' : 'create';
        
        console.log(`💾 Paso 1: Guardando datos... (${saveAction})`);

        const dataToSend = new FormData();
        dataToSend.append('action', saveAction);
        dataToSend.append('id_tenant', user.id_tenant);
        dataToSend.append('id_user', user.id_user);
        
        if (currentCampaignId) {
            dataToSend.append('id_campaign', currentCampaignId);
        }

        // Datos del formulario
        dataToSend.append('name', formData.name);
        dataToSend.append('subject', formData.subject);
        dataToSend.append('preview_text', formData.preview_text || '');
        dataToSend.append('html_content', formData.htmlContent);
        dataToSend.append('sender_type', formData.senderType);
        dataToSend.append('sender_name', formData.senderName);
        dataToSend.append('sender_email', formData.senderEmail);
        dataToSend.append('target_lists', JSON.stringify(formData.selectedLists));

        // Programación (Si aplica)
        if (scheduleData) {
            dataToSend.append('schedule_at', scheduleData.at);
            dataToSend.append('schedule_timezone', scheduleData.tz);
        } else if (formData.scheduledAt) {
            dataToSend.append('schedule_at', formData.scheduledAt);
            if (formData.scheduledTimezone) dataToSend.append('schedule_timezone', formData.scheduledTimezone);
        }

        // Adjuntos
        if (formData.attachments.length === 0) {
            dataToSend.append('attachments', '[]'); 
        } else {
            formData.attachments.forEach((att) => {
                if (att.file) {
                    dataToSend.append('attachments', att.file);
                } else {
                    dataToSend.append('existing_attachments', JSON.stringify(att));
                }
            });
        }

        // Ejecutar guardado
        const saveResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/campaigns/manage`, {
            method: 'POST',
            body: dataToSend
        });

        if (!saveResponse.ok) throw new Error('Error al guardar la campaña');

        const rawSaveResponse = await saveResponse.json();
        const savedData = Array.isArray(rawSaveResponse) ? rawSaveResponse[0] : rawSaveResponse;
        
        // Obtenemos el ID final (ya sea el que teníamos o uno nuevo si se creó)
        const finalCampaignId = savedData?.id_campaign || currentCampaignId;

        // Actualizamos estado local si era nuevo
        if (saveAction === 'create' && finalCampaignId) {
            setCurrentCampaignId(finalCampaignId);
            window.history.replaceState(null, '', `/app/marketing/campaigns/edit/${finalCampaignId}`);
        }

        // --- PASO 2: DISPARAR ENVÍO (Si corresponde) ---
        // Si NO es borrador Y NO es programado (es decir, es "Enviar Ahora")
        if (!isDraft && !scheduleData && !formData.scheduledAt) {
            
            console.log(`🚀 Paso 2: Lanzando campaña... (${finalCampaignId})`);
            
            const sendData = new FormData();
            sendData.append('action', 'send'); // <--- Acción específica para activar el envío
            sendData.append('id_campaign', finalCampaignId);
            sendData.append('id_tenant', user.id_tenant);
            sendData.append('id_user', user.id_user);

            const sendResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/campaigns/manage`, {
                method: 'POST',
                body: sendData
            });

            if (!sendResponse.ok) throw new Error('Se guardó, pero falló al iniciar el envío.');
            
            setToast({ message: '¡Campaña lanzada con éxito!', type: 'success' });
        } else {
            // Mensaje solo de guardado
            setToast({ message: isDraft ? 'Borrador guardado' : 'Campaña programada/guardada', type: 'success' });
        }

        setHasUnsavedChanges(false);
        
        // Salir si no es borrador
        if (!isDraft) {
            setTimeout(() => navigate('/app/marketing/campaigns'), 1500);
        }

    } catch (error) {
        console.error("Error en el proceso:", error);
        setToast({ message: 'Error al procesar la solicitud.', type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleScheduleSave = async () => {
    if (!scheduleDate || !scheduleTime) return;
    const dt = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (isNaN(dt.getTime())) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await saveCampaign({ at: dt.toISOString(), tz: timeZone });
    setIsScheduleModalOpen(false);
  };

  const handleSendTest = async () => {
      if (!testEmailAddress) return;
      if (!user?.id_tenant || !user?.id_user) return;
      try {
          setIsSendingTest(true);
          const formDataToSend = new FormData();
          formDataToSend.append('id_tenant', user.id_tenant);
          formDataToSend.append('id_user', user.id_user);
          formDataToSend.append('name', formData.name);
          formDataToSend.append('subject', formData.subject);
          formDataToSend.append('preview_text', formData.preview_text);
          formDataToSend.append('html_content', formData.htmlContent);
          formDataToSend.append('sender_type', formData.senderType);
          formDataToSend.append('sender_name', formData.senderName);
          formDataToSend.append('sender_email', formData.senderEmail);
          formDataToSend.append('test_email', testEmailAddress);
          
          formData.attachments.forEach(att => {
            if (att.file) {
                formDataToSend.append('attachments', att.file);
            }
          });
          
          const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/campaigns/test`, {
              method: 'POST',
              body: formDataToSend
          });

          if (res.ok) {
              setToast({ message: `Prueba enviada a ${testEmailAddress}`, type: 'success' });
              setIsTestEmailModalOpen(false);
          } else {
              setToast({ message: 'Error enviando prueba', type: 'error' });
          }
      } catch (e) {
          setToast({ message: 'Error enviando prueba', type: 'error' });
      } finally {
          setIsSendingTest(false);
      }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      
      {/* 1. HEADER */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/app/marketing/campaigns')} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h1 className="text-base font-bold text-slate-800 leading-tight">
                            {isEditing ? 'Editar Campaña' : 'Nueva Campaña'}
                        </h1>
                        <p className="text-xs text-slate-500">
                            {formData.name || 'Sin nombre'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate('/app/marketing/campaigns')}
                        className="text-slate-500 hover:text-red-600 font-medium text-xs px-3 py-2 rounded-lg hover:bg-red-50 transition-all"
                    >
                        Cancelar
                    </button>
                    
                    {/* BOTÓN DE GUARDADO INTELIGENTE */}
                    <button 
                        onClick={() => saveCampaign(undefined, true)}
                        disabled={isSaving}
                        className={`text-xs flex items-center gap-2 px-4 py-2 rounded-lg border transition-all font-bold ${
                            hasUnsavedChanges 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                        }`}
                        title={hasUnsavedChanges ? "Tienes cambios sin guardar" : "Todos los cambios guardados"}
                    >
                        {isSaving ? (
                            <i className="fa-solid fa-spinner fa-spin"></i> 
                        ) : hasUnsavedChanges ? (
                            <i className="fa-solid fa-floppy-disk"></i> 
                        ) : (
                            <i className="fa-solid fa-check"></i>
                        )}
                        <span className="hidden sm:inline">
                            {isSaving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar Cambios' : 'Guardado'}
                        </span>
                    </button>
                </div>
            </div>

            {/* TABS STEPPER */}
            <div className="flex gap-8 mt-2 overflow-x-auto no-scrollbar">
                {STEPS.map((step) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = step.id < currentStep;
                    return (
                        <button 
                            key={step.id} 
                            onClick={() => setCurrentStep(step.id)}
                            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                                isActive 
                                    ? 'border-brand-600 text-brand-600' 
                                    : isCompleted 
                                        ? 'border-transparent text-emerald-600 hover:text-emerald-700' 
                                        : 'border-transparent text-slate-400 hover:text-slate-500'
                            }`}
                        >
                            {isCompleted && <i className="fa-solid fa-check text-xs"></i>}
                            <span className={isCompleted ? 'text-slate-700' : ''}>{step.label}</span>
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT SCROLLABLE */}
      <div className="flex-1 overflow-y-auto w-full bg-slate-50">
        <div className="max-w-5xl mx-auto p-4 sm:p-8 min-h-full">
            
            {/* STEP 1: DETALLES */}
            {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Interno <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                placeholder="Ej: Newsletter Octubre"
                                value={formData.name}
                                onChange={e => updateForm({ name: e.target.value })}
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asunto del Correo</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="¡No te lo pierdas!"
                                    value={formData.subject}
                                    onChange={e => updateForm({ subject: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Previsualización</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="Texto secundario..."
                                    value={formData.previewText}
                                    onChange={e => updateForm({ previewText: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 uppercase mb-4">Configuración de Envío</h3>
                        <div className="grid md:grid-cols-2 gap-4 mb-5">
                            <div 
                                onClick={() => handleSenderTypeChange('USER')}
                                className={`cursor-pointer p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${formData.senderType === 'USER' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border shadow-sm text-brand-600"><i className="fa-solid fa-user"></i></div>
                                <div>
                                    <p className="font-bold text-sm text-slate-800">Cuenta Personal</p>
                                    <p className="text-xs text-slate-500">{user?.email_user}</p>
                                </div>
                            </div>
                            <div 
                                onClick={() => tenantData?.corporate_email_address && handleSenderTypeChange('TENANT')}
                                className={`cursor-pointer p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                                    !tenantData?.corporate_email_address ? 'opacity-50 cursor-not-allowed' :
                                    formData.senderType === 'TENANT' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border shadow-sm text-indigo-600"><i className="fa-solid fa-building"></i></div>
                                <div>
                                    <p className="font-bold text-sm text-slate-800">Cuenta Corporativa</p>
                                    <p className="text-xs text-slate-500">{tenantData?.corporate_email_address || 'No configurado'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Remitente</label>
                                <input type="text" value={formData.senderName} onChange={e => updateForm({ senderName: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Remitente</label>
                                <input type="text" value={formData.senderEmail} readOnly className="w-full px-3 py-2 border bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: AUDIENCIA */}
            {currentStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Selecciona tu Audiencia</h3>
                            <p className="text-sm text-slate-500">¿A quién va dirigido este mensaje?</p>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar lista..." 
                            className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-brand-500 text-sm shadow-sm"
                            value={searchLists}
                            onChange={e => setSearchLists(e.target.value)}
                        />
                    </div>

                    {isLoadingLists ? (
                        <div className="py-20 text-center text-slate-400">
                            <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i>
                            <p>Cargando listas...</p>
                        </div>
                    ) : lists.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
                            <i className="fa-solid fa-users-slash text-4xl text-slate-300 mb-3"></i>
                            <p className="text-slate-500 font-medium">No tienes listas creadas aún.</p>
                            <button onClick={() => navigate('/app/marketing/lists/new')} className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold">Crear Lista</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lists.filter(l => l.name.toLowerCase().includes(searchLists.toLowerCase())).map(list => {
                                const idList = String(list.id_list ?? list.list_id);
                                const isSelected = formData.selectedLists.includes(idList);
                                const count = Number(list.member_count) || 0;
                                return (
                                    <div 
                                        key={idList}
                                        onClick={() => toggleList(idList)}
                                        className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-full ${
                                            isSelected 
                                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 shadow-md' 
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-600 border-brand-600' : 'bg-white border-slate-300'}`}>
                                                {isSelected && <i className="fa-solid fa-check text-xs text-white"></i>}
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${list.visibility === 'PRIVATE' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                                                {list.visibility}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-1">{list.name}</h4>
                                            <p className="text-xs text-slate-500 line-clamp-2">{list.description || 'Sin descripción'}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-xs">
                                            <i className="fa-solid fa-user-group text-slate-400 mr-2"></i>
                                            <span className={`font-bold ${count === 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                                {count} Contactos
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* STEP 3: DISEÑO Y CONTENIDO */}
            {currentStep === 3 && (
                <div className="space-y-6 animate-fadeIn h-full flex flex-col">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
                        <div className="flex gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-50 border text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100 flex gap-2 items-center transition-colors">
                                <i className="fa-solid fa-paperclip"></i> Adjuntar
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setUseRichEditor(true)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${useRichEditor ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>Visual</button>
                                <button onClick={() => setUseRichEditor(false)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!useRichEditor ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>HTML</button>
                            </div>
                            <button onClick={() => setIsTestEmailModalOpen(true)} className="px-4 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100 transition-colors">
                                <i className="fa-regular fa-paper-plane mr-2"></i> Prueba
                            </button>
                        </div>
                    </div>

                    {/* Editor & Preview Stack */}
                    <div className="space-y-4">
                        
                        {/* 2. BARRA DE ADJUNTOS (NUEVA UBICACIÓN VISIBLE) */}
                        {formData.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 animate-fadeIn">
                                {formData.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg border border-blue-200 shadow-sm transition-all hover:bg-blue-100">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center text-blue-500 border border-blue-100">
                                                <i className="fa-solid fa-file-lines"></i>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold leading-tight">{file.name}</p>
                                                <p className="text-[10px] opacity-70">{file.size}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeAttachment(idx)} 
                                            className="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white hover:text-red-500 transition-colors"
                                            title="Eliminar archivo"
                                        >
                                            <i className="fa-solid fa-times"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 1. EDITOR JODIT */}
                        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                            {useRichEditor ? (
                                <JoditEditor
                                    ref={editorRef}
                                    value={formData.htmlContent}
                                    config={joditConfig}
                                    onBlur={newContent => {
                                        if(newContent !== formData.htmlContent) updateForm({ htmlContent: newContent });
                                    }} 
                                />
                            ) : (
                                <textarea 
                                    className="flex-1 w-full p-6 bg-slate-900 text-emerald-400 font-mono text-sm resize-none outline-none min-h-[500px]"
                                    value={formData.htmlContent}
                                    onChange={e => updateForm({ htmlContent: e.target.value })}
                                    spellCheck={false}
                                    placeholder="Escribe tu código HTML aquí..."
                                />
                            )}
                        </div>

                        {/* 3. VISTA PREVIA (PC MODE) */}
                        <div className="space-y-2 mt-4">
                            <div className="flex items-center gap-2 px-2">
                                <i className="fa-solid fa-desktop text-slate-400"></i>
                                <span className="text-xs font-bold text-slate-500 uppercase">Vista Previa (Escritorio)</span>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-300 shadow-lg overflow-hidden">
                                {/* Browser Toolbar Fake */}
                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                </div>
                                <iframe 
                                    srcDoc={`
                                        <html>
                                        <head>
                                            <meta charset="utf-8">
                                            <style>
                                                body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; word-wrap: break-word; }
                                                img { max-width: 100%; height: auto; }
                                                a { color: #2563eb; text-decoration: none; }
                                                a:hover { text-decoration: underline; }
                                            </style>
                                        </head>
                                        <body>${formData.htmlContent}</body>
                                        </html>
                                    `} 
                                    className="w-full h-[600px] border-none bg-white" 
                                    title="Desktop Preview"
                                />
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* STEP 4: REVIEW */}
            {currentStep === 4 && (
                <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex gap-5 shadow-sm">
                        <div className="w-12 h-12 rounded-full bg-white text-emerald-600 flex items-center justify-center shrink-0 shadow-sm text-xl border border-emerald-100">
                            <i className="fa-solid fa-rocket"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900 text-lg">¡Todo listo para el lanzamiento!</h3>
                            <p className="text-emerald-700 text-sm mt-1">Revisa cuidadosamente los detalles. Una vez enviada, no podrás editar el contenido.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 font-bold text-slate-700">Resumen</div>
                        <div className="p-6 grid gap-6 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <span className="text-slate-500 font-medium">Asunto</span>
                                <span className="col-span-2 text-slate-800 font-bold">{formData.subject}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <span className="text-slate-500 font-medium">Remitente</span>
                                <div className="col-span-2">
                                    <p className="text-slate-800 font-bold">{formData.senderName}</p>
                                    <p className="text-slate-500 text-xs">{formData.senderEmail}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <span className="text-slate-500 font-medium">Destinatarios</span>
                                <div className="col-span-2">
                                    <p className="text-slate-800 font-bold">{formData.selectedLists.length} Listas seleccionadas</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {lists.filter(l => formData.selectedLists.includes(String(l.id_list ?? l.list_id))).map(l => (
                                            <span key={l.id_list} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">
                                                {l.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t pt-4 mt-2">
                                <span className="text-slate-500 font-medium">Adjuntos</span>
                                <div className="col-span-2">
                                    {formData.attachments.length > 0 ? (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <i className="fa-solid fa-paperclip text-slate-400"></i>
                                            <span className="font-bold">{formData.attachments[0].name}</span>
                                            <span className="text-xs text-slate-400">({formData.attachments[0].size})</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 italic">Sin archivos adjuntos</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* 3. FOOTER */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 z-20">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <button 
                onClick={handleBack} 
                disabled={currentStep === 1} 
                className="px-6 py-2.5 rounded-lg font-bold text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
                Atrás
            </button>
            
            {currentStep < 4 ? (
                <button 
                    onClick={handleNext} 
                    className="px-8 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                    Siguiente <i className="fa-solid fa-arrow-right"></i>
                </button>
            ) : (
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsScheduleModalOpen(true)} 
                        disabled={!isValidForSending}
                        className="px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-regular fa-clock mr-2"></i> Programar
                    </button>
                    <button 
                        onClick={() => saveCampaign()} 
                        disabled={isSaving || !isValidForSending} 
                        className={`px-8 py-2.5 text-white rounded-lg font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${
                            !isValidForSending 
                            ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                            : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200'
                        }`}
                        title={!isValidForSending ? 'Completa todos los campos obligatorios para enviar' : ''}
                    >
                        {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>} 
                        Enviar Ahora
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* MODALS */}
      {isTestEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Enviar Prueba</h3>
                <input 
                    type="email" 
                    value={testEmailAddress} 
                    onChange={e => setTestEmailAddress(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-brand-500 mb-4"
                    placeholder="tucorreo@ejemplo.com"
                />
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setIsTestEmailModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                    <button onClick={handleSendTest} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md hover:bg-brand-700">Enviar</button>
                </div>
            </div>
        </div>
      )}

      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Programar Envío</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full border rounded p-2" />
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full border rounded p-2" />
                </div>
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                    <button onClick={handleScheduleSave} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold">Confirmar</button>
                </div>
            </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type as any} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CampaignWizard;