import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Product, ProductType } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ProductsList: React.FC = () => {
  const { user } = useAuth();
  
  // Datos
  const [products, setProducts] = useState<Product[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  
  // UI & Filtros
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Nuevo: Alternar vista
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal & Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant) return;
    setLoading(true);
    const tenantId = user.id_tenant;

    try {
      const [productsRes, typesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/products?id_tenant=${tenantId}`),
        fetch(`https://service.computeksa.com/webhook/api/products_type?id_tenant=${tenantId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Error: ${res.status}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      setProducts(await parseResponse(productsRes));
      setProductTypes(await parseResponse(typesRes));

    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: 'Error al cargar el catálogo.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTROS ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        (p.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter ? p.tipo === typeFilter : true;

      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, typeFilter]);

  // --- HANDLERS ---
  const handleAddNew = () => {
    setEditingProduct({
      id_product: '',
      id_tenant: user?.id_tenant || '',
      codigo: '',
      descripcion: '',
      tipo: (productTypes[0]?.type as any) || 'BIEN',
      categoria: '',
      precio_unitario: 0,
      imagen_url: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    // Limpiar precio si viene con $
    const rawPrice = typeof product.precio_unitario === 'string' 
        ? parseFloat((product.precio_unitario as string).replace(/[^0-9.-]+/g, "")) 
        : product.precio_unitario;

    setEditingProduct({
        ...product,
        precio_unitario: rawPrice
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Artículo',
      message: '¿Estás seguro? Esta acción eliminará el artículo del catálogo.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/products/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          if (!response.ok) throw new Error('Error al eliminar');
          
          setToast({ message: 'Artículo eliminado.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
            setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !user?.id_tenant) return;
    
    if(!editingProduct.descripcion || !editingProduct.precio_unitario) {
        setToast({ message: 'Descripción y Precio son obligatorios.', type: 'error' });
        return;
    }

    setSubmitting(true);
    
    const payload = {
      ...editingProduct,
      id_tenant: user.id_tenant,
      // Asegurar números
      precio_unitario: Number(editingProduct.precio_unitario)
    };

    try {
      const url = isEditMode 
        ? 'https://service.computeksa.com/webhook/api/products/update' 
        : 'https://service.computeksa.com/webhook/api/products';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(isEditMode ? 'Error al actualizar.' : 'Error al crear.');
      
      setToast({ message: isEditMode ? 'Artículo actualizado.' : 'Artículo creado.', type: 'success' });
      setIsModalOpen(false);
      fetchData();

    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingProduct(prev => (prev ? { ...prev, [name]: value } : null));
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setToast({ message: 'Imagen muy pesada (Max 800KB).', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingProduct(prev => (prev ? { ...prev, imagen_url: reader.result as string } : null));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderContent = () => {
    if (loading) {
        return (
          <div className="p-12 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
              <p className="text-slate-500 font-medium">Cargando catálogo...</p>
          </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-boxes-stacked text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-700">Catálogo vacío</h3>
                <p className="text-slate-500 max-w-sm mt-1 mb-6">Agrega tus productos o servicios para empezar a cotizar.</p>
                <button onClick={handleAddNew} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                    Crear Primer Artículo
                </button>
            </div>
        );
    }

    if (filteredProducts.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron artículos con los filtros actuales.</p>
                <button onClick={() => { setSearchTerm(''); setTypeFilter(''); }} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    // VISTA DE LISTA (TABLA)
    if (viewMode === 'list') {
        return (
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                    <th className="px-6 py-4 border-b w-16">Img</th>
                    <th className="px-6 py-4 border-b">Descripción</th>
                    <th className="px-6 py-4 border-b">Código</th>
                    <th className="px-6 py-4 border-b">Tipo</th>
                    <th className="px-6 py-4 border-b text-right">Precio</th>
                    <th className="px-6 py-4 border-b text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredProducts.map((p) => (
                        <tr key={p.id_product} className="hover:bg-slate-50/80 transition-all cursor-pointer group" onClick={() => handleEdit(p)}>
                            <td className="px-6 py-3">
                                <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                                    {p.imagen_url ? (
                                        <img src={p.imagen_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <i className="fa-solid fa-image text-slate-300"></i>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="font-medium text-slate-800">{p.descripcion}</div>
                                {p.categoria && <div className="text-xs text-slate-500 mt-0.5">{p.categoria}</div>}
                            </td>
                            <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.codigo || '-'}</td>
                            <td className="px-6 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${p.tipo === 'BIEN' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                    {p.tipo}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right font-bold text-slate-700">
                                {typeof p.precio_unitario === 'number' ? `$${p.precio_unitario.toFixed(2)}` : p.precio_unitario}
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                        <i className="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id_product); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
    }

    // VISTA DE GALERÍA (GRID)
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
            {filteredProducts.map((p) => (
                <div 
                    key={p.id_product} 
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group cursor-pointer flex flex-col"
                    onClick={() => handleEdit(p)}
                >
                    <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden relative">
                        {p.imagen_url ? (
                            <img src={p.imagen_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <i className="fa-solid fa-box-open text-4xl text-slate-300"></i>
                        )}
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold shadow-sm uppercase text-slate-600">
                            {p.tipo}
                        </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-slate-400">{p.codigo}</span>
                            <span className="font-bold text-slate-800 text-lg">
                                {typeof p.precio_unitario === 'number' ? `$${p.precio_unitario.toFixed(2)}` : p.precio_unitario}
                            </span>
                        </div>
                        <h3 className="font-medium text-slate-700 line-clamp-2 mb-1 flex-1" title={p.descripcion}>
                            {p.descripcion}
                        </h3>
                        {p.categoria && <p className="text-xs text-slate-500 mb-4">{p.categoria}</p>}
                        
                        <div className="flex gap-2 pt-3 border-t border-slate-100 mt-auto">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(p); }} 
                                className="flex-1 bg-slate-50 hover:bg-brand-50 text-slate-600 hover:text-brand-600 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Editar
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(p.id_product); }} 
                                className="w-10 flex items-center justify-center bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Catálogo</h1>
           <p className="text-slate-500 text-sm mt-1">Gestiona productos y servicios.</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* View Toggler */}
            <div className="bg-white border border-slate-200 p-1 rounded-lg flex shadow-sm">
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Vista Lista"
                >
                    <i className="fa-solid fa-list"></i>
                </button>
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Vista Galería"
                >
                    <i className="fa-solid fa-border-all"></i>
                </button>
            </div>

            <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
                <i className="fa-solid fa-plus mr-2"></i> Nuevo Artículo
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por nombre, código o categoría..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="relative w-full md:w-48">
            <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
            >
                <option value="">Todos los Tipos</option>
                {productTypes.map(pt => <option key={pt.id_product_type} value={pt.type}>{pt.type}</option>)}
            </select>
            <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                <i className="fa-solid fa-chevron-down"></i>
            </div>
         </div>
      </div>

      {/* Content Area */}
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${viewMode === 'list' ? 'min-h-[400px]' : ''}`}>
        {renderContent()}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-5">
              
              {/* Image Upload */}
              <div className="flex gap-5 items-start">
                  <div 
                    className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group cursor-pointer hover:border-brand-400 transition-colors" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {editingProduct.imagen_url ? (
                        <img src={editingProduct.imagen_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center p-2">
                            <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300 mb-1"></i>
                            <p className="text-[10px] text-slate-400">Subir foto</p>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                        Cambiar
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  
                  <div className="flex-1 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Código (Opcional)</label>
                            <input 
                                name="codigo" 
                                value={editingProduct.codigo || ''} 
                                onChange={handleInputChange} 
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm" 
                                placeholder="PROD-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
                            <input 
                                name="categoria" 
                                value={editingProduct.categoria || ''} 
                                onChange={handleInputChange} 
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                                placeholder="Ej. Hardware"
                            />
                        </div>
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                <textarea 
                    name="descripcion" 
                    rows={3} 
                    required 
                    value={editingProduct.descripcion || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Detalles del producto o servicio..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo</label>
                    <div className="relative">
                        <select 
                            name="tipo" 
                            value={editingProduct.tipo || ''} 
                            onChange={handleInputChange} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                        >
                            {productTypes.map(pt => <option key={pt.id_product_type} value={pt.type}>{pt.type}</option>)}
                        </select>
                        <div className="absolute right-3 top-3 text-slate-400 pointer-events-none text-xs"><i className="fa-solid fa-chevron-down"></i></div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Precio Unitario</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <input 
                            type="number" 
                            name="precio_unitario" 
                            step="0.01" 
                            value={editingProduct.precio_unitario || 0} 
                            onChange={handleInputChange} 
                            required 
                            className="w-full pl-7 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                        />
                    </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsList;