import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Tenant } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { getImageUrl } from '../../utils/imageUtils';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';
import { handleApiResponse } from '../../utils/apiResponseHandler';

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

  const renderContent = () => {
    if (cacheLoading) {
      return (
        <div className="p-12 text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-slate-800 mb-4"></i>
          <p className="text-slate-500 font-medium">Cargando suscripciones...</p>
        </div>
      );
    }

    if (cachedTenants.length === 0) {
      return (
        <div className="p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <i className="fa-solid fa-building text-3xl text-slate-300"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-700">No hay suscripciones</h3>
          <p className="text-slate-500 max-w-sm mt-1 mb-6">Crea una nueva suscripción para empezar.</p>
          <button onClick={handleAddNew} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-md transition-all">
            Crear Primera Suscripción
          </button>
        </div>
      );
    }

    const filteredTenants = cachedTenants.filter(t => {
      const matchesSearch = (t.name_tenant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (t.ruc || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = countryFilter ? t.country === countryFilter : true;
      return matchesSearch && matchesCountry;
    });

    if (filteredTenants.length === 0) {
      return (
        <div className="p-12 text-center">
          <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
          <p className="text-slate-500">No se encontraron suscripciones con los filtros actuales.</p>
          <button onClick={() => { setSearchTerm(''); setCountryFilter(''); }} className="text-slate-800 font-medium mt-2 hover:underline">Limpiar filtros</button>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest sticky top-0">
            <tr>
              <th className="px-6 py-3 border-b w-[35%] min-w-[300px]">Empresa</th>
              <th className="px-6 py-3 border-b w-[30%] min-w-[250px]">Ubicación</th>
              <th className="px-6 py-3 border-b w-[20%] min-w-[200px]">Contacto</th>
              <th className="px-6 py-3 border-b w-[10%] min-w-[100px]">Website</th>
              <th className="px-6 py-3 border-b w-[5%] min-w-[80px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredTenants.map((tenant) => (
              <tr 
                key={tenant.id_tenant} 
                onClick={() => handleEdit(tenant)}
                className="hover:bg-slate-50/80 transition-all cursor-pointer group"
              >
                {/* Empresa Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200 overflow-hidden" style={{ borderRadius: 0 }}>
                      {tenant.logo_url ? (
                        <img 
                          src={getImageUrl(tenant.logo_url) || tenant.logo_url} 
                          alt={tenant.name_tenant} 
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                      ) : (
                        <span className="font-bold text-black text-lg">
                          {tenant.name_tenant ? tenant.name_tenant.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                        </span>
                      )}
                      <i className={`fa-solid fa-building text-sm text-slate-400 ${tenant.logo_url ? 'hidden' : ''}`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-black text-sm truncate">{tenant.name_tenant}</div>
                      <div className="text-xs text-slate-500 truncate">RUC: {tenant.ruc}</div>
                      {tenant.razon_social && <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 truncate">{tenant.razon_social}</div>}
                    </div>
                  </div>
                </td>
                
                {/* Ubicación */}
                <td className="px-6 py-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-slate-700">{tenant.city}</div>
                    <div className="text-xs text-slate-500">{tenant.country}</div>
                    {tenant.address && <div className="text-[10px] text-slate-400 truncate">{tenant.address}</div>}
                  </div>
                </td>
                
                {/* Email/Phone */}
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600">
                    <div className="text-xs text-slate-400">Email corporativo</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {tenant.corporate_email_address ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <i className="fa-solid fa-envelope text-[8px]"></i>
                          {tenant.corporate_email_address}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No configurado</span>
                      )}
                    </div>
                  </div>
                </td>
                
                {/* Website */}
                <td className="px-6 py-4">
                  {tenant.website ? (
                    <a 
                      href={tenant.website} 
                      onClick={(e) => e.stopPropagation()}
                      target="_blank" 
                      rel="noreferrer"
                      className="text-sm text-slate-800 hover:text-slate-900 hover:underline truncate flex items-center gap-1"
                    >
                      <i className="fa-solid fa-link text-xs"></i>
                      {tenant.website.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">—</span>
                  )}
                </td>
                
                {/* Acciones */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEdit(tenant); }} 
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(tenant.id_tenant); }} 
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="w-full space-y-6 animate-fade-in pb-12 px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Suscripciones (Tenants)</h1>
           <p className="text-slate-500 text-sm mt-1">Administra las empresas que usan la plataforma.</p>
        </div>
        <button onClick={handleAddNew} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all flex items-center justify-center">
          <i className="fa-solid fa-building mr-2"></i> Nueva Suscripción
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por nombre o RUC..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative w-full md:w-40">
                <select 
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-slate-800 outline-none appearance-none"
                >
                    <option value="">Todos los Países</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Perú">Perú</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Chile">Chile</option>
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
             </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {renderContent()}
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {cachedTenants.filter(t => {
            const matchesSearch = (t.name_tenant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (t.ruc || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCountry = countryFilter ? t.country === countryFilter : true;
            return matchesSearch && matchesCountry;
          }).length} de {cachedTenants.length} suscripciones</span>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
      />

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
