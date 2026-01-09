import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import { MarketingList } from '../../types';

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

  const [currentStep, setCurrentStep] = useState(1);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email_user || '');
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<{ corporate_email_address?: string; name_tenant?: string } | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  
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
      const campaign = await marketingApi.getCampaignDetail(id);
      setFormData(prev => ({
        ...prev,
        name: campaign.name,
        subject: campaign.subject,
        previewText: campaign.preview_text || '',
        htmlContent: campaign.html_content || prev.htmlContent,
        senderType: campaign.sender_type,
        selectedLists: Array.isArray(campaign.target_lists) ? campaign.target_lists : [],
      }));
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
    setFormData(prev => ({
      ...prev,
      selectedLists: prev.selectedLists.includes(listId) 
        ? prev.selectedLists.filter(id => id !== listId)
        : [...prev.selectedLists, listId]
    }));
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

  // --- Editor Logic ---
  const insertImage = () => {
    const url = prompt("Ingresa la URL de la imagen:", "https://picsum.photos/600/300");
    if (url) {
      const imgTag = `\n<img src="${url}" alt="Imagen insertada" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />\n`;
      setFormData(prev => ({
        ...prev,
        htmlContent: prev.htmlContent + imgTag
      }));
    }
  };

  const handleSendTest = () => {
    // Simulate API call
    alert(`✅ Correo de prueba enviado exitosamente a: ${testEmailAddress}`);
    setIsTestEmailModalOpen(false);
  };

  const saveCampaign = async () => {
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
          target_lists: formData.selectedLists,
          attachments: formData.attachments,
        });

        alert(`✅ Campaña ${isEditing ? 'actualizada' : 'creada'} correctamente`);
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditing ? 'Editar Campaña' : 'Nueva Campaña'}</h2>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-50 px-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    isActive ? 'bg-brand-600 text-white shadow-lg scale-110' : 
                    isCompleted ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <i className="fa-solid fa-check"></i> : step.id}
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
        
        {/* STEP 1: DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn">
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
            
            {/* Sender Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">¿De dónde deseas enviar este correo?</label>
              <div className="space-y-2">
                {/* Personal Email Option */}
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-brand-300" style={{
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
                  <div>
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      <i className="fa-solid fa-user"></i> Mi correo personal
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{user?.email_user}</p>
                    <p className="text-xs text-slate-500 mt-1">Los destinatarios verán tu correo personal como remitente</p>
                  </div>
                </label>

                {/* Corporate Email Option (only if available) */}
                {tenantData?.corporate_email_address ? (
                  <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-brand-300" style={{
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
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-building"></i> Correo corporativo
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{tenantData.corporate_email_address}</p>
                      <p className="text-xs text-slate-500 mt-1">Los destinatarios verán el correo de la empresa</p>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-start gap-3 p-4 border-2 border-slate-200 rounded-lg bg-slate-50">
                    <i className="fa-solid fa-circle-info text-slate-400 mt-1"></i>
                    <div>
                      <p className="font-semibold text-slate-700 flex items-center gap-2">
                        <i className="fa-solid fa-building"></i> Correo corporativo
                      </p>
                      <p className="text-sm text-slate-500 mt-1">No hay un correo corporativo configurado. Configúralo en la sección de Perfil.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Remitente</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                    value={formData.senderName}
                    readOnly
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email del Remitente</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                    value={formData.senderEmail}
                    readOnly
                  />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lists.map(list => {
                const idList = (list.id_list ?? list.list_id) as string | undefined;
                if (!idList) return null;
                const isSelected = formData.selectedLists.includes(idList);
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
                    onClick={insertImage}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <i className="fa-regular fa-image"></i> Insertar Imagen
                  </button>
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
                
                <button 
                  onClick={() => setIsTestEmailModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded text-sm text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  <i className="fa-regular fa-paper-plane"></i> Enviar Prueba
                </button>
             </div>

             {/* Main Editor Area */}
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
                      <div className="absolute top-0 left-0 w-full bg-white border-b border-slate-200 px-4 py-2 flex gap-2">
                         <div className="w-2 h-2 rounded-full bg-red-400"></div>
                         <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                         <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      </div>
                      <div className="mt-8 h-[calc(100%-32px)] overflow-y-auto bg-white m-4 shadow-sm rounded">
                         <iframe 
                           title="preview"
                           srcDoc={formData.htmlContent.replace('%nombre%', 'Juan Pérez')}
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
            </div>
            
            <div className="flex justify-center mt-6">
              <button 
                onClick={() => { setCurrentStep(3); setIsTestEmailModalOpen(true); }}
                className="text-brand-600 font-medium hover:underline text-sm flex items-center gap-1"
              >
                <i className="fa-regular fa-paper-plane"></i> Enviar una última prueba a mí mismo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="mt-6 flex justify-between">
        <button 
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            currentStep === 1 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Atrás
        </button>

        {currentStep < 4 ? (
          <button 
            onClick={handleNext}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors shadow-sm"
          >
            Siguiente
          </button>
        ) : (
           <div className="flex gap-3">
             <button className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50">
               Programar para después
             </button>
             <button 
                onClick={handleFinish}
                disabled={isSaving}
                className={`px-6 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save"></i>
                    {isEditing ? 'Guardar Cambios' : 'Crear Campaña'}
                  </>
                )}
              </button>
           </div>
        )}
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
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <i className="fa-solid fa-paper-plane"></i> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignWizard;