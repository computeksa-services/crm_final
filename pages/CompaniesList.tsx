import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Importar
import { Tenant } from '../types'; // Updated Type
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const CompaniesList: React.FC = () => {
  const { user } = useAuth(); // Usar para validación de rol
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modal
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    // Solo un superadmin puede ver esta lista
    if (user?.rol_user !== 'superadmin') {
      setTenants([]);
      setLoading(false);
      return;
    }
    if (!user?.id_user) return; // Comprobar que hay id_user

    setLoading(true);
    const userId = user.id_user;

    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/tenants?id_user=${userId}`);
      if (!response.ok) {
        if (response.status === 404) setTenants([]);
        else throw new Error('Error al cargar tenants');
        return;
      }
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      setTenants(data);
    } catch (e) {
      setToast({ message: 'Error al cargar los tenants.', type: 'error' });
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    setEditingTenant({ ruc: '', name_tenant: '', country: 'Ecuador', city: '', address: '', website: '', logo_url: '' });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Tenant',
      message: '¿Estás seguro? Se eliminarán todos los usuarios y datos asociados a esta empresa suscrita.',
      isDestructive: true,
      onConfirm: async () => {
        const original = [...tenants];
        setTenants(prev => prev.filter(t => t.id_tenant !== id));
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/tenants/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
          });
          if (!response.ok) throw new Error('Error al eliminar tenant');
          setToast({ message: 'Tenant eliminado.', type: 'success' });
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
          setTenants(original);
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
    setSubmitting(true);
    
    try {
      if (isEditMode && editingTenant.id_tenant) {
        const response = await fetch('https://service.computeksa.com/webhook/api/tenants/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTenant.id_tenant, ...editingTenant })
        });
        if (!response.ok) throw new Error('Error al actualizar tenant');
        const apiResponse = await response.json();
        // FORCE LOCAL IMAGE PRIORITY: If we have a local Base64 image, use it.
        // API responses might truncate long Base64 strings, breaking the image.
        const logoToUse = editingTenant.logo_url && editingTenant.logo_url.startsWith('data:') 
          ? editingTenant.logo_url 
          : apiResponse.logo_url;

        const updated = { ...editingTenant, ...apiResponse, logo_url: logoToUse } as Tenant;
        setTenants(prev => prev.map(t => t.id_tenant === updated.id_tenant ? updated : t));
        setToast({ message: 'Tenant actualizado.', type: 'success' });
      } else {
        const response = await fetch('https://service.computeksa.com/webhook/api/tenants/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingTenant)
        });
        if (!response.ok) throw new Error('Error al crear tenant');
        const apiResponse = await response.json();
        // FORCE LOCAL IMAGE PRIORITY here too
        const logoToUse = editingTenant.logo_url && editingTenant.logo_url.startsWith('data:') 
          ? editingTenant.logo_url 
          : apiResponse.logo_url;

        const newT = { ...editingTenant, ...apiResponse, logo_url: logoToUse } as Tenant;
        setTenants(prev => [newT, ...prev]);
        setToast({ message: 'Tenant creado.', type: 'success' });
        setIsModalOpen(false);
      }
    } catch (error) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingTenant(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // Logic to convert Image to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check size (Max 800KB to prevent DB bloat)
      if (file.size > 800 * 1024) {
        setToast({ message: 'La imagen es muy pesada. Máximo 800KB.', type: 'error' });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Optional: Log length to debug if needed
        // console.log("Base64 Length:", base64String.length);
        setEditingTenant(prev => (prev ? { ...prev, logo_url: base64String } : null));
      };
      reader.readAsDataURL(file);
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

      {loading ? (
        <div className="p-8 text-center text-slate-500">Cargando suscripciones...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
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
                    <img src={tenant.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <i className="fa-solid fa-image text-slate-300 text-xl"></i>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{tenant.name_tenant}</h3>
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
                      <img src={editingTenant.logo_url} alt="Preview" className="w-full h-full object-contain p-2" />
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

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">RUC</label>
                    <input name="ruc" value={editingTenant.ruc || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nombre (Razón Social)</label>
                    <input name="name_tenant" value={editingTenant.name_tenant || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
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
