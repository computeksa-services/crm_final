import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MockApi } from '../services/mockApi';
import { Product } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ProductsList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MockApi.getProducts();
      setProducts(data);
    } catch (e) {
      setToast({ message: 'Error al cargar productos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    setEditingProduct({
      codigo: '',
      descripcion: '',
      tipo: 'BIEN',
      categoria: '',
      precio_unitario: 0,
      imagen_url: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Producto',
      message: '¿Está seguro? Este producto será eliminado del catálogo permanentemente.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await MockApi.deleteProduct(id);
          setToast({ message: 'Producto eliminado.', type: 'success' });
          fetchData();
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSubmitting(true);
    try {
      if (isEditMode && editingProduct.id_product) {
        await MockApi.updateProduct(editingProduct.id_product, editingProduct);
        setToast({ message: 'Producto actualizado.', type: 'success' });
      } else {
        await MockApi.addProduct(editingProduct);
        setToast({ message: 'Producto creado.', type: 'success' });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      // Ahora el 'catch' recibirá el error con el mensaje de n8n
      const errorMessage = error?.message || 'Ocurrió un error desconocido al guardar.';
      setToast({ message: errorMessage, type: 'error' });
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
        setToast({ message: 'La imagen es muy pesada. Máximo 800KB.', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingProduct(prev => (prev ? { ...prev, imagen_url: reader.result as string } : null));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Catálogo de Productos y Servicios</h1>
           <p className="text-slate-500 text-sm">Gestiona los artículos que puedes añadir a tus cotizaciones.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nuevo Artículo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando catálogo...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Artículo</th>
                  <th className="px-6 py-4 border-b">Código</th>
                  <th className="px-6 py-4 border-b">Tipo</th>
                  <th className="px-6 py-4 border-b text-right">Precio Unitario (USD)</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id_product} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-16 h-12 bg-white rounded-md flex items-center justify-center overflow-hidden mr-4 border border-slate-200 p-1">
                          {product.imagen_url ? (
                            <img src={product.imagen_url} alt={product.descripcion} className="w-full h-full object-contain" />
                          ) : (
                            <i className="fa-solid fa-box-archive text-slate-300 text-xl"></i>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{product.descripcion}</div>
                          <div className="text-xs text-slate-500">{product.categoria || 'Sin categoría'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{product.codigo}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${product.tipo === 'BIEN' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{product.tipo}</span></td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">
  ${typeof product.precio_unitario === 'number' ? product.precio_unitario.toFixed(2) : '0.00'}
</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen-to-square"></i></button>
                      <button onClick={() => handleDelete(product.id_product)} className="p-2 text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group cursor-pointer" onClick={triggerFileInput}>
                  {editingProduct.imagen_url ? <img src={editingProduct.imagen_url} alt="Preview" className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-image text-3xl text-slate-300"></i>}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center text-transparent group-hover:text-white text-xs font-bold">Cambiar</div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                  <textarea name="descripcion" value={editingProduct.descripcion || ''} onChange={handleInputChange} required rows={4} className="w-full px-3 py-2 border rounded-lg"></textarea>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Código</label>
                  <input name="codigo" value={editingProduct.codigo || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                  <select name="tipo" value={editingProduct.tipo || 'BIEN'} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="BIEN">Bien</option>
                    <option value="SERVICIO">Servicio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                  <input name="categoria" value={editingProduct.categoria || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Precio Unitario (USD)</label>
                  <input type="number" step="0.01" name="precio_unitario" value={editingProduct.precio_unitario || 0} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              
              <div className="flex justify-end pt-4 space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                    {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                    Guardar Artículo
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
