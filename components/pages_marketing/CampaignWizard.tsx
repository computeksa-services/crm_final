import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import { MarketingList } from '../../types';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const STEPS = [
  { id: 1, label: 'Detalles' },
  { id: 2, label: 'Audiencia' },
  { id: 3, label: 'Diseño y Contenido' },
  { id: 4, label: 'Revisión' }
];

interface Attachment {
  name: string;
  size: string;
  type: string;
}

const CampaignWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email_user || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<{ corporate_email_address?: string; name_tenant?: string } | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  const [searchLists, setSearchLists] = useState('');
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduledTimezone, setScheduledTimezone] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    previewText: '',
    senderName: user?.name_user || '',
    senderEmail: user?.email_user || '',
    senderType: 'USER' as 'USER' | 'TENANT',
    selectedLists: [] as string[],
    htmlContent: '<div style="font-family: sans-serif; padding: 20px;">\n  <h1>Hola %nombre%,</h1>\n  <p>Escribe tu mensaje aquí...</p>\n  <br>\n  <p>Saludos,<br>El equipo</p>\n</div>',
    attachments: [] as Attachment[]
  });

  // Cargar listas disponibles
  useEffect(() => {
    loadLists();
    loadTenantData();
  }, []);

  // Cargar datos si está editando
  useEffect(() => {
    if (isEditing && id) {
      loadCampaignData();
    }
  }, [id, isEditing]);

  // Detectar si la selección actual es una imagen para habilitar controles de tamaño
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleSelectionChange = (range: any) => {
      if (!range) {
        setIsImageSelected(false);
        return;
      }
      const [leaf] = quill.getLeaf(range.index);
      const node = leaf?.domNode as HTMLElement | undefined;
      setIsImageSelected(!!node && node.tagName === 'IMG');
    };

    quill.on('selection-change', handleSelectionChange);
    return () => {
      quill.off('selection-change', handleSelectionChange);
    };
  }, []);

  // Al hacer clic dentro del editor, si el target es una imagen, forzar selección y habilitar controles
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'IMG') {
        try {
          const blot = Quill.find(target);
          const index = quill.getIndex(blot);
          quill.setSelection(index, 1, 'user');
        } catch (err) {
          console.warn('No se pudo seleccionar la imagen en Quill:', err);
        }
        setIsImageSelected(true);
      } else {
        setIsImageSelected(false);
      }
    };

    quill.root.addEventListener('click', handleClick);
    return () => {
      quill.root.removeEventListener('click', handleClick);
    };
  }, []);

  const loadLists = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    try {
      setIsLoadingLists(true);
      const data = await marketingApi.getLists(user.id_tenant, user.id_user);
      setLists(data);
    } catch (error) {
      console.error('Error al cargar listas:', error);
    } finally {
      setIsLoadingLists(false);
    }
  };

  const loadTenantData = async () => {
    if (!user?.id_tenant) return;

    try {
      setIsLoadingTenant(true);
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/tenants/detail?id_tenant=${user.id_tenant}`);
      if (res.ok) {
        const data = await res.json();
        const tenant = Array.isArray(data) ? data[0] : data;
        setTenantData({
          corporate_email_address: tenant?.corporate_email_address,
          name_tenant: tenant?.name_tenant
        });
      }
    } catch (error) {
      console.error('Error al cargar datos del tenant:', error);
    } finally {
      setIsLoadingTenant(false);
    }
  };

  const loadCampaignData = async () => {
    if (!id) return;
    
    try {
      const response = await marketingApi.getCampaignDetail(id);
      // El backend devuelve un array, tomar el primer elemento
      const campaign = Array.isArray(response) ? response[0] : response;
      
      if (!campaign) {
        console.error('No se encontró la campaña');
        return;
      }
      
      // Normalizar los IDs de listas - ya vienen como strings desde el backend
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
      }));
      
      console.log('📋 Campaña cargada');
      console.log('  → Listas seleccionadas:', normalizedLists);
      console.log('  → Tipo de datos:', normalizedLists.map((id: string) => `${id} (${typeof id})`));
    } catch (error) {
      console.error('Error al cargar campaña:', error);
    }
  };

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleSenderTypeChange = (type: 'USER' | 'TENANT') => {
    let senderEmail = '';
    let senderName = '';

    if (type === 'USER') {
      senderEmail = user?.email_user || '';
      senderName = user?.name_user || '';
    } else if (type === 'TENANT' && tenantData?.corporate_email_address) {
      senderEmail = tenantData.corporate_email_address;
      senderName = tenantData.name_tenant || 'Empresa';
    }

    setFormData(prev => ({
      ...prev,
      senderType: type,
      senderEmail,
      senderName
    }));
  };
  
  const toggleList = (listId: string) => {
    const normalizedId = String(listId);
    setFormData(prev => ({
      ...prev,
      selectedLists: prev.selectedLists.map(String).includes(normalizedId) 
        ? prev.selectedLists.filter(id => String(id) !== normalizedId)
        : [...prev.selectedLists, normalizedId]
    }));
  };

  // Ajustar ancho de imagen seleccionada en el editor visual
  const setImageWidth = (percent: number) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();
    if (!range) {
      alert('Selecciona una imagen en el editor para redimensionarla');
      return;
    }
    const [leaf] = editor.getLeaf(range.index);
    const domNode: HTMLElement | null = leaf?.domNode || null;
    if (domNode && domNode.tagName === 'IMG') {
      const img = domNode as HTMLImageElement;
      img.style.width = `${percent}%`;
      img.style.maxWidth = `${percent}%`;
      img.style.height = 'auto';
      img.removeAttribute('height');
      img.setAttribute('width', `${percent}%`);
      // Sync HTML so el contenido guardado conserve el tamaño elegido
      const html = editor.root.innerHTML;
      setFormData(prev => ({ ...prev, htmlContent: html }));
    } else {
      alert('Primero haz clic en la imagen para seleccionarla');
    }
  };

  // --- File Attachment Logic ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type
      }));
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSendTest = async () => {
    if (!user?.id_tenant || !user?.id_user) {
      alert('Error: No se pudo identificar el usuario');
      return;
    }

    if (!testEmailAddress) {
      alert('Por favor ingresa un email para la prueba');
      return;
    }

    try {
      setIsSendingTest(true);
      
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/campaigns/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_tenant: user.id_tenant,
          id_user: user.id_user,
          id_campaign: isEditing ? id : undefined,
          name: formData.name,
          subject: formData.subject,
          preview_text: formData.previewText,
          html_content: formData.htmlContent,
          sender_type: formData.senderType,
          sender_name: formData.senderName,
          sender_email: formData.senderEmail,
          target_lists: formData.selectedLists,
          attachments: formData.attachments,
          test_email: testEmailAddress,
        }),
      });

      if (!res.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      alert(`✅ Correo de prueba enviado exitosamente a: ${testEmailAddress}`);
      setIsTestEmailModalOpen(false);
    } catch (error) {
      console.error('Error al enviar correo de prueba:', error);
      alert('❌ Error al enviar el correo de prueba. Por favor intenta de nuevo.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const saveCampaign = async (scheduleAt?: string, scheduleTimezone?: string) => {
      if (!user?.id_tenant || !user?.id_user) {
        alert('Error: No se pudo identificar el usuario');
        return;
      }

      if (!formData.name || !formData.subject) {
        alert('Por favor completa los campos obligatorios: Nombre y Asunto');
        return;
      }

      try {
        setIsSaving(true);
        const action = isEditing ? 'update' : 'create';
      
        await marketingApi.manageCampaign(action, {
          id_tenant: user.id_tenant,
          id_user: user.id_user,
          id_campaign: isEditing ? id : undefined,
          name: formData.name,
          subject: formData.subject,
          preview_text: formData.previewText,
          html_content: formData.htmlContent,
          sender_type: formData.senderType,
          sender_name: formData.senderName,
          sender_email: formData.senderEmail,
          target_lists: formData.selectedLists,
          attachments: formData.attachments,
          schedule_at: scheduleAt,
          schedule_timezone: scheduleTimezone,
        });

        alert(`✅ Campaña ${isEditing ? 'actualizada' : 'creada'} correctamente${scheduleAt ? ' y programada' : ''}`);
        navigate('/app/marketing/campaigns');
      } catch (error) {
        console.error('Error al guardar campaña:', error);
        alert('❌ Error al guardar la campaña. Por favor intenta de nuevo.');
      } finally {
        setIsSaving(false);
      }
  };

  const handleFinish = () => {
    saveCampaign();
  };

  const handleScheduleSave = async () => {
    setScheduleError('');
    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Selecciona fecha y hora');
      return;
    }
    const dt = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (isNaN(dt.getTime())) {
      setScheduleError('Fecha u hora no válida');
      return;
    }
    const now = new Date();
    if (dt.getTime() <= now.getTime()) {
      setScheduleError('La fecha y hora deben ser futuras');
      return;
    }
    
    // Obtener zona horaria local del sistema
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    setScheduledAt(dt.toISOString());
    setScheduledTimezone(timeZone);
    
    await saveCampaign(dt.toISOString(), timeZone);
    setIsScheduleModalOpen(false);
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left Sidebar - Stepper Vertical */}
      <div className="w-40 bg-white border-r border-slate-200 p-4">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{isEditing ? 'Editar' : 'Nueva'}</h2>
        <div className="space-y-3 relative">
          {/* Vertical Line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200"></div>
          
          {STEPS.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isLast = idx === STEPS.length - 1;
            
            return (
              <div key={step.id} className="relative">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className="w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all hover:bg-slate-50"
                >
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${
                      isActive ? 'bg-brand-600 text-white shadow-lg' : 
                      isCompleted ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <i className="fa-solid fa-check text-xs"></i> : step.id}
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-sm font-medium ${isActive ? 'text-brand-600' : 'text-slate-600'}`}>
                      {step.label}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Content - Main Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Navigation Controls */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <button 
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              currentStep === 1 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            ← Atrás
          </button>

          <span className="text-sm font-medium text-slate-600">
            Paso {currentStep} de {STEPS.length}
          </span>

          {currentStep < 4 ? (
            <button 
              onClick={handleNext}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm"
            >
              Siguiente →
            </button>
          ) : (
             <div className="flex gap-2">
               <button 
                 className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50"
                 onClick={() => setIsScheduleModalOpen(true)}
               >
                 Programar
               </button>
               <button 
                  onClick={handleFinish}
                  disabled={isSaving}
                  className={`px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      Guardando
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save text-xs"></i>
                      {isEditing ? 'Guardar' : 'Crear'}
                    </>
                  )}
                </button>
             </div>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-white p-6">
        
        {/* STEP 1: DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Campaña (Interno)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Ej: Newsletter Octubre 2023"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Asunto del Correo</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="¡No te pierdas estas ofertas!"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Texto de Previsualización</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Este texto aparece junto al asunto en la bandeja de entrada..."
                value={formData.previewText}
                onChange={(e) => setFormData({...formData, previewText: e.target.value})}
              />
            </div>
            
            {/* Grid: Datos del Remitente (izquierda) + Seleccionar de dónde enviar (derecha) */}
            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200">
              {/* Columnas 1-2: Datos del Remitente */}
              <div className="col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Datos del Remitente</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Remitente</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="Ej: Juan García"
                    value={formData.senderName}
                    onChange={(e) => setFormData({...formData, senderName: e.target.value})}
                  />
                  <p className="text-xs text-slate-500 mt-1">Este es el nombre que verán los destinatarios</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email del Remitente</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                    value={formData.senderEmail}
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">Se selecciona según la opción de envío elegida</p>
                </div>
              </div>

              {/* Columna 3: Selección de dónde enviar */}
              <div className="col-span-1">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">¿De dónde enviar?</h3>
                <div className="space-y-2">
                  {/* Personal Email Option */}
                  <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:border-brand-300" style={{
                    borderColor: formData.senderType === 'USER' ? '#3B82F6' : '#E2E8F0',
                    backgroundColor: formData.senderType === 'USER' ? '#EFF6FF' : '#F8FAFC'
                  }}>
                    <input
                      type="radio"
                      name="senderType"
                      value="USER"
                      checked={formData.senderType === 'USER'}
                      onChange={(e) => handleSenderTypeChange(e.target.value as 'USER')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 text-sm flex items-center gap-1">
                        <i className="fa-solid fa-user text-xs"></i> Personal
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{user?.email_user}</p>
                    </div>
                  </label>

                  {/* Corporate Email Option (only if available) */}
                  {tenantData?.corporate_email_address ? (
                    <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:border-brand-300" style={{
                      borderColor: formData.senderType === 'TENANT' ? '#3B82F6' : '#E2E8F0',
                      backgroundColor: formData.senderType === 'TENANT' ? '#EFF6FF' : '#F8FAFC'
                    }}>
                      <input
                        type="radio"
                        name="senderType"
                        value="TENANT"
                        checked={formData.senderType === 'TENANT'}
                        onChange={(e) => handleSenderTypeChange(e.target.value as 'TENANT')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm flex items-center gap-1">
                          <i className="fa-solid fa-building text-xs"></i> Corporativo
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tenantData.corporate_email_address}</p>
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg bg-slate-50">
                      <i className="fa-solid fa-circle-info text-slate-300 text-sm mt-0.5"></i>
                      <div>
                        <p className="font-semibold text-slate-600 text-sm flex items-center gap-1">
                          <i className="fa-solid fa-building text-xs"></i> Corporativo
                        </p>
                        <p className="text-xs text-slate-400 mt-1">No configurado</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: AUDIENCE */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-800">Selecciona las listas de destinatarios</h3>
            <p className="text-sm text-slate-500 mb-4">El correo se enviará a todos los contactos activos en las listas seleccionadas.</p>
            
            {isLoadingLists ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-spinner fa-spin text-3xl text-brand-600 mb-2"></i>
                <p className="text-slate-500">Cargando listas...</p>
              </div>
            ) : lists.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <i className="fa-solid fa-inbox text-4xl text-slate-300 mb-2"></i>
                <p className="text-slate-500">No hay listas de difusión disponibles</p>
                <p className="text-sm text-slate-400 mt-1">Crea una lista primero en la sección de Audiencias</p>
              </div>
            ) : (
              <>
                {/* Search Filter */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="🔍 Buscar listas por nombre o descripción..."
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={searchLists}
                    onChange={(e) => setSearchLists(e.target.value)}
                  />
                  {searchLists && (
                    <p className="text-xs text-slate-500 mt-1">
                      Se encontraron {lists.filter(l => 
                        l.name.toLowerCase().includes(searchLists.toLowerCase()) ||
                        (l.description && l.description.toLowerCase().includes(searchLists.toLowerCase()))
                      ).length} de {lists.length} listas
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lists
                    .filter(l => 
                      l.name.toLowerCase().includes(searchLists.toLowerCase()) ||
                      (l.description && l.description.toLowerCase().includes(searchLists.toLowerCase()))
                    )
                    .map(list => {
                    const idList = String(list.id_list ?? list.list_id);
                    if (!idList || idList === 'undefined') return null;
                    const isSelected = formData.selectedLists.map(String).includes(idList);
                    
                    // Debug log
                    if (isSelected) {
                      console.log(`✅ Lista "${list.name}" marcada (ID: ${idList})`);
                    }
                    
                    return (
                      <div 
                        key={idList}
                        onClick={() => toggleList(idList)}
                        className={`cursor-pointer border rounded-xl p-4 flex items-start gap-4 transition-all ${
                          isSelected 
                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' 
                            : 'border-slate-200 hover:border-brand-300 hover:shadow-md'
                        }`}
                      >
                        <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{list.name}</h4>
                          <p className="text-sm text-slate-600 line-clamp-1">{list.description}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                            <span><i className="fa-solid fa-users mr-1"></i> {list.member_count} miembros</span>
                            <span className={`px-2 py-0.5 rounded ${list.visibility === 'PRIVATE' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                              <i className={`fa-solid ${list.visibility === 'PRIVATE' ? 'fa-lock' : 'fa-users'} mr-1`}></i>
                              {list.visibility === 'PRIVATE' ? 'Privada' : 'Pública'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: DESIGN */}
        {currentStep === 3 && (
          <div className="animate-fadeIn space-y-4">
             {/* Toolbar */}
             <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <i className="fa-solid fa-paperclip"></i> Adjuntar Archivo
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    onChange={handleFileChange} 
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Controles de tamaño de imagen */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300">
                    <span className="text-xs font-medium text-slate-700">Imagen:</span>
                    {[25, 50, 75, 100].map(size => (
                      <button
                        key={size}
                        onClick={() => setImageWidth(size)}
                        disabled={!isImageSelected}
                        className={`text-xs px-2 py-1 rounded border ${
                          isImageSelected
                            ? 'border-slate-200 hover:border-brand-300 hover:text-brand-700'
                            : 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                        }`}
                      >
                        {size}%
                      </button>
                    ))}
                  </div>

                  {/* Toggle Editor Type */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300">
                    <span className="text-xs font-medium text-slate-700">Editor:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useRichEditor} 
                        onChange={(e) => setUseRichEditor(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-slate-600">{useRichEditor ? 'Visual' : 'HTML'}</span>
                    </label>
                  </div>

                  <button 
                    onClick={() => setIsTestEmailModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded text-sm text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    <i className="fa-regular fa-paper-plane"></i> Enviar Prueba
                  </button>
                </div>
             </div>

             {useRichEditor ? (
               /* Rich Editor (React Quill) */
               <div className="space-y-4">
                 <div className="flex flex-col lg:flex-row h-[500px] gap-6">
                   {/* Quill Editor Side */}
                   <div className="w-full lg:w-1/2 flex flex-col">
                     <label className="text-sm font-semibold text-slate-700 mb-2">Editor Visual</label>
                     <div className="flex-1 border border-slate-300 rounded-lg overflow-hidden bg-white">
                       <style>{`
                         .ql-editor img {
                           max-width: 100%;
                           height: auto;
                           display: block;
                           margin: 10px 0;
                           cursor: pointer;
                           border: 1px solid #e5e7eb;
                           border-radius: 4px;
                           padding: 2px;
                           transition: all 0.2s ease;
                         }
                         .ql-editor img:hover {
                           border-color: #3b82f6;
                           box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                         }
                         .ql-editor {
                           min-height: 400px;
                           padding: 15px;
                         }
                       `}</style>
                       <ReactQuill 
                         ref={quillRef}
                         value={formData.htmlContent}
                         onChange={(content) => setFormData({...formData, htmlContent: content})}
                         theme="snow"
                         modules={{
                           toolbar: [
                             [{ header: [1, 2, 3, false] }],
                             ['bold', 'italic', 'underline', 'strike'],
                             ['blockquote', 'code-block'],
                             [{ list: 'ordered' }, { list: 'bullet' }],
                             ['link', 'image'],
                             [{ color: [] }, { background: [] }],
                             [{ align: [] }],
                             ['clean']
                           ]
                         }}
                         className="h-full"
                       />
                     </div>
                     <p className="text-xs text-slate-500 mt-2">Variables disponibles: <code className="bg-slate-100 px-1 rounded">%nombre%</code>, <code className="bg-slate-100 px-1 rounded">%empresa%</code>.</p>
                   </div>

                   {/* Preview Side */}
                   <div className="w-full lg:w-1/2 flex flex-col">
                     <label className="text-sm font-semibold text-slate-700 mb-2">Previsualización en Vivo</label>
                     <div className="flex-1 border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-100 relative">
                       <div className="absolute top-0 left-0 w-full bg-white border-b border-slate-200 px-4 py-2 flex gap-2 z-10">
                         <div className="w-2 h-2 rounded-full bg-red-400"></div>
                         <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                         <div className="w-2 h-2 rounded-full bg-green-400"></div>
                       </div>
                       <div className="mt-8 h-[calc(100%-32px)] overflow-y-auto bg-white m-4 shadow-sm rounded">
                         <iframe 
                           title="preview"
                           srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 16px; }
    img { max-width: 100%; height: auto; }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; }
    blockquote { border-left: 4px solid #e5e7eb; padding-left: 12px; margin-left: 0; color: #6b7280; }
  </style>
</head>
<body>
${formData.htmlContent.replace(/%nombre%/g, 'Juan Pérez').replace(/%empresa%/g, 'Mi Empresa')}
</body>
</html>`}
                           className="w-full h-full pointer-events-none"
                         />
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Attachments List */}
                 {formData.attachments.length > 0 && (
                   <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-paperclip"></i> Archivos Adjuntos ({formData.attachments.length})
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {formData.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">
                              {file.type.split('/')[1] || 'FILE'}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{file.name}</p>
                              <p className="text-[10px] text-slate-400">{file.size}</p>
                            </div>
                            <button 
                              onClick={() => removeAttachment(idx)}
                              className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <i className="fa-solid fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                   </div>
                 )}
               </div>
             ) : (
               /* HTML Code Editor */
               <div className="flex flex-col lg:flex-row h-[500px] gap-6">
                  {/* Code/Input Side */}
                  <div className="w-full lg:w-1/2 flex flex-col">
                     <label className="text-sm font-semibold text-slate-700 mb-2 flex justify-between">
                       <span>Editor HTML</span>
                       <span className="text-xs text-brand-600 cursor-pointer hover:underline">Usar plantilla</span>
                     </label>
                     <textarea 
                       className="flex-1 w-full p-4 font-mono text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none bg-slate-900 text-slate-200"
                       value={formData.htmlContent}
                       onChange={(e) => setFormData({...formData, htmlContent: e.target.value})}
                       spellCheck={false}
                     />
                     <p className="text-xs text-slate-500 mt-2">Variables disponibles: <code className="bg-slate-100 px-1 rounded">%nombre%</code>, <code className="bg-slate-100 px-1 rounded">%empresa%</code>.</p>
                  </div>

                  {/* Preview Side */}
                  <div className="w-full lg:w-1/2 flex flex-col">
                     <label className="text-sm font-semibold text-slate-700 mb-2">Previsualización en Vivo</label>
                     <div className="flex-1 border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-100 relative">
                        <div className="absolute top-0 left-0 w-full bg-white border-b border-slate-200 px-4 py-2 flex gap-2 z-10">
                           <div className="w-2 h-2 rounded-full bg-red-400"></div>
                           <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                           <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                        <div className="mt-8 h-[calc(100%-32px)] overflow-y-auto bg-white m-4 shadow-sm rounded">
                           <iframe 
                             title="preview"
                             srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 16px; }
    img { max-width: 100%; height: auto; }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; }
    blockquote { border-left: 4px solid #e5e7eb; padding-left: 12px; margin-left: 0; color: #6b7280; }
  </style>
</head>
<body>
${formData.htmlContent.replace(/%nombre%/g, 'Juan Pérez').replace(/%empresa%/g, 'Mi Empresa')}
</body>
</html>`}
                             className="w-full h-full pointer-events-none"
                           />
                        </div>
                     </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800">
               <i className="fa-solid fa-check-circle text-xl"></i>
               <div>
                 <p className="font-bold">¡Todo listo para enviar!</p>
                 <p className="text-sm">Revisa los detalles antes de confirmar el envío.</p>
               </div>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-4">
               <div className="flex justify-between">
                  <span className="text-slate-500">Campaña:</span>
                  <span className="font-bold text-slate-800">{formData.name}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-slate-500">Asunto:</span>
                  <span className="font-bold text-slate-800">{formData.subject}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-slate-500">Remitente:</span>
                  <span className="font-bold text-slate-800">{formData.senderName} ({formData.senderEmail})</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-slate-500">Adjuntos:</span>
                  <span className="font-bold text-slate-800">
                    {formData.attachments.length > 0 ? `${formData.attachments.length} archivos` : 'Ninguno'}
                  </span>
               </div>
               <div className="flex justify-between">
                  <span className="text-slate-500">Destinatarios:</span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">{formData.selectedLists.length} Listas seleccionadas</span>
                    <p className="text-xs text-slate-500">Aprox. {lists
                      .filter(l => {
                        const idL = (l.id_list ?? l.list_id) as string | undefined;
                        return !!idL && formData.selectedLists.includes(idL);
                      })
                      .reduce((acc, l) => acc + (Number(l.member_count) || 0), 0)} contactos</p>
                  </div>
               </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Programación:</span>
                <span className="font-bold text-slate-800">
                  {scheduledAt && scheduledTimezone 
                    ? new Date(scheduledAt).toLocaleString('es-ES', { 
                        timeZone: scheduledTimezone,
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) + ` (${scheduledTimezone})`
                    : 'No programada'
                  }
                </span>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-700 mb-3">
                <i className="fa-solid fa-info-circle text-blue-600 mr-2"></i>
                ¿Quieres revisar cómo se ve el correo antes de enviarlo?
              </p>
              <button 
                onClick={() => setIsTestEmailModalOpen(true)}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <i className="fa-regular fa-paper-plane"></i> Enviar Correo de Prueba
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Test Email Modal */}
      {isTestEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Enviar Correo de Prueba</h3>
            <p className="text-sm text-slate-500 mb-4">
              Envía una versión de prueba de esta campaña para verificar cómo se visualiza en la bandeja de entrada.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Destinatario</label>
              <input 
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsTestEmailModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendTest}
                disabled={isSendingTest}
                className={`px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2 ${isSendingTest ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSendingTest ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Programar envío</h3>
            <p className="text-sm text-slate-500 mb-4">Elige fecha y hora futura para dejarla programada. No se enviará antes de esa fecha.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input 
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <input 
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            {scheduleError && <p className="text-sm text-red-600 mb-2">{scheduleError}</p>}

            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleScheduleSave}
                disabled={isSaving}
                className={`px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    Programando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-clock"></i> Programar y guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignWizard;