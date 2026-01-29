import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Tenant } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { getImageUrl } from '../utils/imageUtils';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';
import { handleApiResponse } from '../utils/apiResponseHandler';

const CompaniesList: React.FC = () => {
  const { user } = useAuth();
  const { tenants: cachedTenants, loading: cacheLoading, invalidateTenants } = useDataCache();
    const [searchTerm, setSearchTerm] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modal
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const handleAddNew = () => {
    setEditingTenant({ ruc: '', name_tenant: '', razon_social: '', country: 'Ecuador', city: '', address: '', website: '', logo_url: '' });
    setIsEditMode(false);
    setLogoFile(null);
    setLogoPreview('');
    setIsModalOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsEditMode(true);
    setLogoFile(null);
    setLogoPreview(tenant.logo_url || '');
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Tenant',
      message: 'Esta acción eliminará permanentemente el Tenant y TODOS los datos relacionados (usuarios, contactos, tratos, cotizaciones, finanzas). Esta operación es irreversible y SOLO debe realizarse en casos excepcionales. ¿Deseas continuar?',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.DELETE, {
            method: 'POST',
            body: JSON.stringify({ id_tenant: id })
          });
          const result = await handleApiResponse(
            response,
            'Tenant eliminado.',
            'Error al eliminar tenant.'
          );
          if (!result.success) throw new Error(result.message);

          setToast({ message: result.message, type: 'success' });
          await invalidateTenants();
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          // Cerrar el modal de confirmación tras completar la acción
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      setIsModalOpen(false); // Close edit modal first
      setConfirmState({
        isOpen: true,
        title: 'Guardar Cambios',
        message: '¿Guardar cambios en la suscripción de este Tenant?',
        isDestructive: false,
        onConfirm: () => performSubmit(),
      });
    } else {
      performSubmit();
    }
  };
  
  const performSubmit = async () => {
    if (!editingTenant) return;
    if (!isEditMode && !logoFile) {
      setToast({ message: 'Debes subir un logo en formato de archivo (PNG/JPG).', type: 'error' });
      return;
    }
    setSubmitting(true);
    
    try {
      // ✅ CORRECCIÓN: Enviar estructura correcta esperada por Gateway
      // El Gateway espera: id_tenant, name_tenant, country, city, address, website, ruc
      // NOTA: Si hay logo, usar FormData. Si no, usar JSON directamente
      
      if (isEditMode) {
        if (!editingTenant.id_tenant) {
          setToast({ message: 'Falta id_tenant para actualizar.', type: 'error' });
          return;
        }
        let response;
        
        if (logoFile) {
          // Si hay archivo de logo, usar FormData
          const formData = new FormData();
          formData.append('id_tenant', editingTenant.id_tenant || '');
          formData.append('ruc', editingTenant.ruc || '');
          formData.append('name_tenant', editingTenant.name_tenant || '');
          formData.append('razon_social', editingTenant.razon_social || '');
          formData.append('country', editingTenant.country || '');
          formData.append('city', editingTenant.city || '');
          formData.append('address', editingTenant.address || '');
          formData.append('website', editingTenant.website || '');
          formData.append('logo', logoFile);
          
          response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.UPDATE, {
            method: 'POST',
            body: formData  // ✅ FormData con multipart/form-data
          });
        } else {
          // Si NO hay logo, enviar JSON limpio
          const jsonPayload = {
            id_tenant: editingTenant.id_tenant,
            ruc: editingTenant.ruc || undefined,
            name_tenant: editingTenant.name_tenant || undefined,
            razon_social: editingTenant.razon_social || undefined,
            country: editingTenant.country || undefined,
            city: editingTenant.city || undefined,
            address: editingTenant.address || undefined,
            website: editingTenant.website || undefined,
            logo_url: editingTenant.logo_url || undefined
          };
          
          response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.UPDATE, {
            method: 'POST',
            body: JSON.stringify(jsonPayload)  // ✅ JSON con application/json
          });
        }
        
        const result = await handleApiResponse(
          response,
          'Tenant actualizado.',
          'Error al actualizar tenant.'
        );
        if (!result.success) throw new Error(result.message);

        setToast({ message: result.message, type: 'success' });
        await invalidateTenants();
      } else {
        let response;
        
        if (logoFile) {
          // Si hay archivo de logo, usar FormData
          const formData = new FormData();
          formData.append('ruc', editingTenant.ruc || '');
          formData.append('name_tenant', editingTenant.name_tenant || '');
          formData.append('razon_social', editingTenant.razon_social || '');
          formData.append('country', editingTenant.country || '');
          formData.append('city', editingTenant.city || '');
          formData.append('address', editingTenant.address || '');
          formData.append('website', editingTenant.website || '');
          formData.append('logo', logoFile);
          
          response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.CREATE, {
            method: 'POST',
            body: formData
          });
        } else {
          // Si NO hay logo, enviar JSON limpio
          const jsonPayload = {
            ruc: editingTenant.ruc || undefined,
            name_tenant: editingTenant.name_tenant || undefined,
            razon_social: editingTenant.razon_social || undefined,
            country: editingTenant.country || undefined,
            city: editingTenant.city || undefined,
            address: editingTenant.address || undefined,
            website: editingTenant.website || undefined
          };
          
          response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.CREATE, {
            method: 'POST',
            body: JSON.stringify(jsonPayload)
          });
        }
        
        const result = await handleApiResponse(
          response,
          'Tenant creado.',
          'Error al crear tenant.'
        );
        if (!result.success) throw new Error(result.message);

        setToast({ message: result.message, type: 'success' });
        setIsModalOpen(false);
        await invalidateTenants();
      }
    } catch (error: any) {
      console.error('❌ Error en operación de tenant:', error);
      setToast({ message: error.message || 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
      // Cerrar modal de confirmación después de completar la operación
      setConfirmState({ ...confirmState, isOpen: false });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingTenant(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // Manejo de carga de imagen (archivo real, no base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setToast({ message: 'La imagen es muy pesada. Máximo 800KB.', type: 'error' });
        return;
      }
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      const previewUrl = URL.createObjectURL(file);
      setLogoFile(file);
      setLogoPreview(previewUrl);
      setEditingTenant(prev => (prev ? { ...prev, logo_url: previewUrl } : null));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Tenants (Suscripciones)</h1>
           <p className="text-slate-500 text-sm">Administración de empresas que usan la plataforma (Multi-tenant).</p>
        </div>
        <button onClick={handleAddNew} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-server mr-2"></i> Nuevo Tenant
        </button>
      </div>

      {cacheLoading ? (
        <div className="p-8 text-center text-slate-500">Cargando suscripciones...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cachedTenants.filter(t => {
            const matchesSearch = (t.name_tenant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (t.ruc || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCountry = countryFilter ? t.country === countryFilter : true;
            return matchesSearch && matchesCountry;
          }).map((tenant) => (
            <div 
              key={tenant.id_tenant} 
              onClick={() => handleEdit(tenant)}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <i className="fa-solid fa-building text-6xl text-slate-800"></i>
              </div>

              <div className="flex items-center mb-4 z-10">
                {/* 
                  UPDATED LOGO CONTAINER:
                  - w-24 h-16: Wider rectangle to fit logos.
                  - object-contain: Ensures the whole image is visible (no cropping).
                  - bg-white: Better for PNGs with transparency.
                */}
                <div className="w-24 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden mr-4 border border-slate-200 shadow-sm p-1">
                  {tenant.logo_url ? (
                    <img 
                      src={getImageUrl(tenant.logo_url) || tenant.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <i className={`fa-solid fa-image text-slate-300 text-xl ${tenant.logo_url ? 'hidden' : ''}`}></i>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{tenant.name_tenant}</h3>
                  {tenant.razon_social && <p className="text-xs text-slate-500">{tenant.razon_social}</p>}
                  <p className="text-xs text-slate-500">RUC: {tenant.ruc}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600 mb-4 flex-1 z-10">
                 <div className="flex items-start">
                   <i className="fa-solid fa-map-pin mt-1 w-5 text-slate-400"></i>
                   <span>{tenant.city}, {tenant.country}</span>
                 </div>
                 {tenant.website && (
                   <div className="flex items-center">
                     <i className="fa-solid fa-link w-5 text-slate-400"></i>
                     <a href={tenant.website} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline truncate">{tenant.website}</a>
                   </div>
                 )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2 z-10">
                 <button onClick={(e) => { e.stopPropagation(); handleEdit(tenant); }} className="p-2 text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen"></i></button>
                 <button onClick={(e) => { e.stopPropagation(); handleDelete(tenant.id_tenant); }} className="p-2 text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Tenant' : 'Nuevo Tenant'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
               
               {/* Logo Upload Section - Updated to Rectangle Preview */}
               <div className="flex flex-col items-center justify-center mb-6">
                 <div className="w-48 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden mb-2 bg-slate-50 relative group">
                    {editingTenant.logo_url ? (
                      <img 
                        src={getImageUrl(editingTenant.logo_url) || editingTenant.logo_url} 
                        alt="Preview" 
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <i className="fa-solid fa-cloud-upload-alt text-2xl"></i>
                        <span className="block text-[10px] mt-1">Subir Logo</span>
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={triggerFileInput}
                      className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center text-transparent group-hover:text-white font-bold text-xs"
                    >
                      Cambiar
                    </button>
                 </div>
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   onChange={handleImageUpload} 
                   accept="image/png, image/jpeg, image/jpg"
                   className="hidden" 
                 />
                 <button type="button" onClick={triggerFileInput} className="text-brand-600 text-xs font-bold hover:underline">
                   {editingTenant.logo_url ? 'Cambiar Logo' : 'Seleccionar Imagen'}
                 </button>
                 <p className="text-[10px] text-slate-400 mt-1">Max 800KB (PNG/JPG)</p>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">RUC</label>
                  <input name="ruc" value={editingTenant.ruc || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg text-sm" />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Empresa</label>
                  <input name="name_tenant" value={editingTenant.name_tenant || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg text-sm" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Razón Social (Opcional)</label>
                  <input name="razon_social" value={editingTenant.razon_social || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Dirección</label>
                  <input name="address" value={editingTenant.address || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Ciudad</label>
                    <input name="city" value={editingTenant.city || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">País</label>
                    <input name="country" value={editingTenant.country || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sitio Web</label>
                  <input name="website" value={editingTenant.website || ''} onChange={handleInputChange} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg text-sm" />
               </div>

               <div className="flex justify-end pt-4 space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-sm shadow-sm flex items-center">
                   {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                   {isEditMode ? 'Guardar Cambios' : 'Crear Tenant'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompaniesList;
