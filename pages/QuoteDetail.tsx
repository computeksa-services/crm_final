import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, QuoteItem, UserDecision, Product, QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';

const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const quoteResponse = await fetch(`https://service.computeksa.com/webhook/api/quotes/detail?id_cotizacion=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!quoteResponse.ok) {
        if (quoteResponse.status === 404) {
          setQuote(null);
        } else {
          const errorText = await quoteResponse.text();
          throw new Error(`Error del servidor al cargar la cotización: ${quoteResponse.status} - ${errorText}`);
        }
        setLoading(false);
        return;
      }
      const quoteResponseText = await quoteResponse.text();
      let q: Quote | null = null;
      if (quoteResponseText) {
        const parsedResponse = JSON.parse(quoteResponseText);
        q = Array.isArray(parsedResponse) ? parsedResponse[0] : parsedResponse;
      }
      setQuote(q || null);

      if (!q) {
        setLoading(false);
        return;
      }

      try {
        const statusesResponse = await fetch(`/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`);
        if (statusesResponse.ok) {
          const statuses = await statusesResponse.json();
          setQuoteStatuses(statuses);
        }
      } catch {}

      try {
        const itemsResponse = await fetch(`https://service.computeksa.com/webhook/api/quote-items?id_cotizacion=${q.id_cotizacion}&id_tenant=${tenantId}&id_user=${userId}`);
        if (!itemsResponse.ok) {
          if (itemsResponse.status === 404) {
            setItems([]);
          } else {
            const errorText = await itemsResponse.text();
            throw new Error(`Error del servidor al cargar los artículos: ${itemsResponse.status} - ${errorText}`);
          }
        } else {
          const responseText = await itemsResponse.text();
          const itemsData = responseText ? JSON.parse(responseText) : [];
          setItems(itemsData);
        }

      } catch (itemError) {
        console.error("Error al cargar o procesar los artículos:", itemError);
        setToast({ message: 'No se pudieron cargar los artículos.', type: 'error' });
        setItems([]);
      }

      try {
        const productsResponse = await fetch(`https://service.computeksa.com/webhook/api/products?id_tenant=${tenantId}&id_user=${userId}`);
        if (!productsResponse.ok) {
          const errorText = await productsResponse.text();
          throw new Error(`Error del servidor al cargar productos disponibles: ${productsResponse.status} - ${errorText}`);
        }
        const productsText = await productsResponse.text();
        const productsData = productsText ? JSON.parse(productsText) : [];
        setAvailableProducts(productsData);
      } catch (productsError) {
        console.error("Error loading available products:", productsError);
        setToast({ message: 'Error al cargar productos disponibles.', type: 'error' });
      }

    } catch (e: any) {
      console.error("Error al cargar la cotización o productos:", e);
      setToast({ message: e.message || 'Error fatal al cargar la cotización.', type: 'error' });
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === '1') setIsEditing(true);
    } catch {}
  }, []);
  
  const handleAddItem = async () => {
    setIsProductModalOpen(true);
  };

  const handleProductSelection = async () => {
    if (!selectedProductId || !quote || !user?.id_tenant || !user?.id_user) return;

    const selectedProduct = availableProducts.find(p => p.id_product === selectedProductId);
    if (!selectedProduct) {
      setToast({ message: 'Producto seleccionado no encontrado.', type: 'error' });
      return;
    }

    setProcessing(true);

    const apiEndpoint = 'https://service.computeksa.com/webhook/api/products-selected';
    
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    const payload = {
      id_cotizacion: quote.id_cotizacion,
      id_tenant: tenantId,
      id_user: userId,
      descripcion: selectedProduct.descripcion, 
      cantidad: itemQuantity,
      precio_unitario: parseFloat((selectedProduct.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0,
      subtotal: itemQuantity * (parseFloat((selectedProduct.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0),
      id_producto: selectedProduct.id_product
    };

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al conectar con el servidor.' }));
        throw new Error(errorData.message || 'Error al conectar con el servidor.');
      }

      setToast({ message: 'Artículo añadido con éxito.', type: 'success' });
      setIsProductModalOpen(false);
      setSelectedProductId(null);
      setItemQuantity(1);
      fetchData();

    } catch (e: any) {
      setToast({ message: e.message || 'Error al añadir el artículo.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateItem = async (itemId: string, newCantidad: number, newPrecioUnitario: number) => {
    if (!quote || !user?.id_tenant || !user?.id_user || !itemId) return;
    
    const currentItem = items.find(i => (i.id_articulo_cot || i.id_quote_item) === itemId);
    const cantidad = parseFloat(currentItem?.cantidad as any) || 0;
    const precioUnitario = parseFloat((currentItem?.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;

    if (newCantidad === cantidad && newPrecioUnitario === precioUnitario) {
      return;
    }

    setProcessing(true);
    
    const apiEndpoint = 'https://service.computeksa.com/webhook/api/quote-items/update';
    const updatedSubtotal = newCantidad * newPrecioUnitario;

    const payload = {
      id_articulo_cot: itemId,
      cantidad: newCantidad,
      precio_unitario: newPrecioUnitario,
      subtotal: updatedSubtotal,
      id_tenant: user.id_tenant,
      id_user: user.id_user,
    };

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error del servidor al actualizar.' }));
        throw new Error(errorData.message || 'Error del servidor al actualizar.');
      }

      setToast({ message: 'Artículo actualizado.', type: 'success' });
      fetchData(); 

    } catch (e: any) {
      setToast({ message: e.message || 'Error al actualizar el artículo.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Artículo',
      message: '¿Está seguro que desea eliminar este artículo de la cotización? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        if (!quote || !user?.id_tenant || !user?.id_user) return;
        setProcessing(true);
        
        const apiEndpoint = 'https://service.computeksa.com/webhook/api/quote-items/delete';
        const payload = { 
          id_articulo_cot: itemId,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        };

        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error del servidor al eliminar.' }));
            throw new Error(errorData.message || 'Error del servidor al eliminar.');
          }

          setToast({ message: 'Artículo eliminado.', type: 'success' });
          fetchData(); 

        } catch (e: any) {
          setToast({ message: e.message || 'Error al eliminar el artículo.', type: 'error' });
        } finally {
          setProcessing(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleGeneratePDF = async () => {
    if (!quote || !user?.id_tenant || !user?.id_user) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id_cotizacion}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_tenant: user.id_tenant, id_user: user.id_user }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al generar PDF.' }));
        throw new Error(errorData.message || 'Error al generar PDF.');
      }
      const updatedQuote = await response.json();
      setQuote(updatedQuote);
      setToast({ message: 'PDF generado con éxito.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Error al generar el PDF.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendQuote = async () => {
    if (!quote || !user?.id_tenant || !user?.id_user) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id_cotizacion}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_tenant: user.id_tenant, id_user: user.id_user }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al enviar cotización.' }));
        throw new Error(errorData.message || 'Error al enviar cotización.');
      }
      const updatedQuote = await response.json();
      setQuote(updatedQuote);
      setToast({ message: 'Cotización enviada con éxito.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Error al enviar la cotización.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecisionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(!quote || !user?.id_tenant || !user?.id_user) return;
    const newDecision = e.target.value as UserDecision;
    
    try {
      const response = await fetch(`/api/quotes/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cotizacion: quote.id_cotizacion,
          estado_decision: newDecision,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al actualizar decisión.' }));
        throw new Error(errorData.message || 'Error al actualizar decisión.');
      }
      setQuote({...quote, estado_decision: newDecision});
      setToast({ message: 'Decisión actualizada.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Error al actualizar la decisión.', type: 'error' });
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-500 font-medium animate-pulse">Cargando detalles...</p>
      </div>
    </div>
  );
  
  if (!quote) return (
    <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
            <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-3"></i>
            <h3 className="text-lg font-bold text-red-700">Cotización no encontrada</h3>
            <p className="text-red-500 mt-2">No se pudo acceder a los datos de la cotización solicitada.</p>
            <button onClick={() => navigate('/quotes')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                Volver al listado
            </button>
        </div>
    </div>
  );

  const hasItems = items.length > 0;
  const isPending = !['ENVIADO', 'APROBADO', 'NEGOCIACION'].includes(quote.estado || '');
  const isReady = quote.estado === 'LISTO PARA ENVIAR';
  const isSent = quote.estado_decision !== UserDecision.PENDING;
  
  const showGenerateBtn = hasItems && (isPending || !quote.file_generado);
  const showSendBtn = isReady; 

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      {/* Product Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mr-3 text-sm">
                    <i className="fa-solid fa-box-open"></i>
                </span>
                Seleccionar Artículo
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Producto</label>
                <div className="relative">
                    <select 
                    value={selectedProductId || ''} 
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    required 
                    className="w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none appearance-none transition-all"
                    >
                    <option value="">-- Buscar Producto --</option>
                    {availableProducts.map(p => (
                        <option key={p.id_product} value={p.id_product}>
                        {p.descripcion} ({p.codigo})
                        </option>
                    ))}
                    </select>
                    <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                        <i className="fa-solid fa-chevron-down text-xs"></i>
                    </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad</label>
                <input 
                  type="number" 
                  value={itemQuantity} 
                  onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                  min="1" 
                  required 
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50 gap-3">
              <button 
                type="button" 
                onClick={() => setIsProductModalOpen(false)} 
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-white hover:border-slate-400 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleProductSelection} 
                disabled={processing || !selectedProductId}
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-200 disabled:opacity-70 disabled:shadow-none flex items-center transition-all"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                Añadir al Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
           <div className="flex items-center gap-3 mb-2">
             <button onClick={() => navigate('/quotes')} className="text-slate-400 hover:text-brand-600 transition-colors p-1">
               <i className="fa-solid fa-arrow-left text-lg"></i>
             </button>
             
             {/* Status Badge */}
             <span 
               className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border"
               style={{ 
                   backgroundColor: `${quote.estado_color || '#cccccc'}15`, 
                   color: quote.estado_color || '#333',
                   borderColor: `${quote.estado_color || '#cccccc'}40`
                }}
             >
               {quote.estado_icon && <i className={`${quote.estado_icon} mr-1.5`}></i>}
               {quote.estado_nombre || quote.estado}
             </span>
             {quote.is_private && (
                 <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex items-center">
                     <i className="fa-solid fa-lock mr-1 text-[10px]"></i> Privado
                 </span>
             )}
           </div>

           {!isEditing ? (
             <div className="ml-8">
                 <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Cotización #{quote.formatted_no_cotizacion}</h1>
                 <p className="text-slate-500 mt-1 font-medium">{quote.nombre_cotizacion}</p>
             </div>
           ) : (
             <div className="ml-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
               <div className="flex-1 w-full sm:w-auto">
                    <label className="text-xs font-bold text-slate-400 block mb-1">Nombre</label>
                    <input 
                        className="px-3 py-2 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        value={quote.nombre_cotizacion || ''}
                        onChange={(e) => setQuote({ ...quote, nombre_cotizacion: e.target.value })}
                    />
               </div>
               <div className="w-full sm:w-auto">
                    <label className="text-xs font-bold text-slate-400 block mb-1">Etapa</label>
                    <select 
                        className="px-3 py-2 border border-slate-300 rounded-lg w-full bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        value={quote.id_quote_status || ''}
                        onChange={(e) => setQuote({ ...quote, id_quote_status: e.target.value })}
                    >
                        {quoteStatuses.map(s => (
                        <option key={s.id_status} value={s.id_status}>{s.name}</option>
                        ))}
                    </select>
               </div>
               <div className="sm:mt-5">
                   <button onClick={handleGeneratePDF} className="hidden" />
                   <button 
                        onClick={async () => {
                        if (!quote) return;
                        setProcessing(true);
                        try {
                            const response = await fetch('/api/quotes/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id_cotizacion: quote.id_cotizacion,
                                nombre_cotizacion: quote.nombre_cotizacion,
                                id_quote_status: quote.id_quote_status,
                                id_tenant: user?.id_tenant,
                                id_user: user?.id_user,
                            }),
                            });
                            if (!response.ok) {
                            const errorData = await response.json().catch(() => ({ message: 'Error al actualizar cotización.' }));
                            throw new Error(errorData.message || 'Error al actualizar cotización.');
                            }
                            const updated = await response.json();
                            setQuote(updated);
                            setIsEditing(false);
                            setToast({ message: 'Cotización actualizada.', type: 'success' });
                        } catch (e: any) {
                            setToast({ message: e.message || 'Error al guardar cambios.', type: 'error' });
                        } finally {
                            setProcessing(false);
                        }
                        }}
                        disabled={processing}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg shadow-md font-medium transition-all flex items-center whitespace-nowrap"
                    >
                        {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
                        Guardar
                    </button>
               </div>
             </div>
           )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-end">
           
           {showGenerateBtn && (
             <button 
               onClick={handleGeneratePDF}
               disabled={processing}
               className="bg-white border border-slate-200 hover:border-indigo-500 text-slate-700 hover:text-indigo-600 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md font-medium transition-all flex items-center group">
               {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-500"></i> : <i className="fa-solid fa-file-pdf mr-2 text-slate-400 group-hover:text-indigo-500"></i>}
               Generar PDF v{quote.version + 1}
             </button>
           )}

           {showSendBtn && (
             <button 
               onClick={handleSendQuote}
               disabled={processing}
               className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-200 font-medium transition-all flex items-center">
               {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
               Enviar al Cliente
             </button>
           )}

            <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

          {(quote.access_level === 'EDIT' || user?.rol_user === 'admin') && (
            <button 
              onClick={() => setIsShareOpen(true)}
              className="text-slate-500 hover:text-brand-600 hover:bg-brand-50 p-2.5 rounded-lg transition-all"
              title="Compartir"
            >
              <i className="fa-solid fa-share-nodes text-lg"></i>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Items */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Items Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 flex items-center">
                <span className="w-2 h-6 bg-brand-500 rounded-full mr-3"></span>
                Artículos
              </h3>
              {isPending && (
                <button 
                    onClick={handleAddItem} 
                    className="text-sm bg-brand-50 hover:bg-brand-100 text-brand-700 px-4 py-2 rounded-lg transition-colors font-medium flex items-center"
                >
                  <i className="fa-solid fa-plus mr-2"></i> Agregar
                </button>
              )}
            </div>
            
            {items.length === 0 ? (
              <div className="p-12 text-center">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-basket-shopping text-slate-300 text-2xl"></i>
                  </div>
                  <h4 className="text-slate-600 font-medium">Sin artículos aún</h4>
                  <p className="text-slate-400 text-sm mt-1">Agrega productos para comenzar a armar el presupuesto.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 font-semibold uppercase bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">Descripción</th>
                        <th className="px-4 py-4 text-right w-24">Cant.</th>
                        <th className="px-4 py-4 text-right w-32">Precio U.</th>
                        <th className="px-6 py-4 text-right w-32">Total</th>
                        <th className="px-4 py-4 text-center w-16"></th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {items.map((item, index) => {
                        const cantidad = parseFloat(item.cantidad as any) || 0;
                        const precioUnitario = parseFloat((item.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
                        const subtotal = cantidad * precioUnitario;

                        return (
                        <tr key={item.id_articulo_cot || item.id_quote_item} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-start">
                                    <span className="text-slate-300 text-xs font-mono mr-3 mt-1 w-4">{index + 1}</span>
                                    <div>
                                        <p className="font-medium text-slate-700 text-sm">{item.descripcion}</p>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{item.codigo || ''}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                                <input 
                                    type="number"
                                    defaultValue={cantidad}
                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || item.id_quote_item || '', parseInt(e.target.value) || 1, precioUnitario)}
                                    min="1" 
                                    className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded text-right font-medium text-slate-700 outline-none transition-all"
                                />
                            </td>
                            <td className="px-4 py-4 text-right">
                                <input 
                                    type="number"
                                    defaultValue={precioUnitario.toFixed(2)}
                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || item.id_quote_item || '', cantidad, parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded text-right font-medium text-slate-700 outline-none transition-all"
                                />
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">
                                {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-4 text-center">
                                <button 
                                onClick={() => handleDeleteItem(item.id_articulo_cot || item.id_quote_item || '')}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Eliminar artículo"
                                >
                                <i className="fa-solid fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>
                        )
                    })}
                    <tr className="bg-slate-50/80 border-t-2 border-slate-100">
                        <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total General</td>
                        <td className="px-6 py-4 text-right font-black text-slate-800 text-xl font-mono">
                            {quote.total}
                        </td>
                        <td></td>
                    </tr>
                    </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Files Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-5 flex items-center">
                <i className="fa-solid fa-paperclip text-slate-400 mr-2"></i> Documentos
            </h3>
            <div className="flex flex-wrap gap-4">
              {quote.file_generado ? (
                <a href={quote.file_generado} target="_blank" rel="noreferrer" className="flex items-center p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50/30 transition-all group w-full sm:w-auto">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-file-pdf text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Cotización PDF (v{quote.version})</p>
                    <p className="text-xs text-slate-500 mt-1">Clic para visualizar</p>
                  </div>
                  <i className="fa-solid fa-external-link-alt ml-4 text-slate-300 group-hover:text-indigo-400 text-xs"></i>
                </a>
              ) : (
                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 flex items-center w-full">
                  <i className="fa-solid fa-info-circle mr-3 text-slate-400"></i> El documento PDF aún no ha sido generado.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Meta Info & Decision */}
        <div className="space-y-6">
          
          {/* Decision Card (Only visible if sent) */}
          {isSent && (
            <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center">
                <i className="fa-solid fa-gavel text-purple-500 mr-2"></i>
                Decisión del Cliente
              </h3>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">Registra la respuesta oficial para actualizar el estado del trato automáticamente.</p>
              
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                <label className="block text-xs font-bold text-purple-800 uppercase tracking-wider mb-2">Respuesta Actual</label>
                <select 
                    value={quote.estado_decision || ''}
                    onChange={handleDecisionChange}
                    className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none shadow-sm transition-all"
                >
                    <option value={UserDecision.PENDING}>⏳ Pendiente de Respuesta</option>
                    <option value={UserDecision.APPROVED}>✅ APROBADO (Ganado)</option>
                    <option value={UserDecision.REJECTED}>❌ RECHAZADO (Perdido)</option>
                    <option value={UserDecision.NEGOCIAR}>💬 En Negociación</option>
                </select>
              </div>
            </div>
          )}

          {/* Client & Contact Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 pb-2 border-b border-slate-50">Información del Cliente</h3>
            
            <div className="space-y-5">
              <div className="flex items-start group">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                    <i className="fa-solid fa-building"></i>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold block uppercase">Empresa</span>
                  <Link to={`/client-companies/${quote.id_client_company}`} className="text-slate-800 font-bold hover:text-blue-600 transition-colors text-base">
                    {quote.client_company_name}
                  </Link>
                </div>
              </div>

              <div className="flex items-start group">
                 <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                    <i className="fa-solid fa-user"></i>
                 </div>
                 <div>
                   <span className="text-xs text-slate-400 font-semibold block uppercase">Contacto</span>
                   <Link to={`/client-contacts/${quote.id_contact}`} className="text-slate-700 font-medium hover:text-brand-600 transition-colors">
                     {quote.contact_name}
                   </Link>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div>
                    <span className="text-xs text-slate-400 block mb-1">Vendedor</span>
                    <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs mr-2">
                            <i className="fa-solid fa-user-tie"></i>
                        </div>
                        <span className="text-slate-700 text-sm font-medium truncate">{quote.owner_name}</span>
                    </div>
                 </div>
                 <div>
                    <span className="text-xs text-slate-400 block mb-1">Fecha</span>
                    <span className="text-slate-700 text-sm font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100 block text-center">
                        {new Date(quote.fecha_emision).toLocaleDateString()}
                    </span>
                 </div>
              </div>
            </div>
          </div>

          {/* Associated Deal Card */}
          {quote.id_trato && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-50">Contexto</h3>
              <div className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-200 transition-colors">
                 <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-brand-600 mr-3 text-lg">
                    <i className="fa-solid fa-handshake"></i>
                 </div>
                 <div className="overflow-hidden">
                    <p className="text-xs text-slate-500 mb-0.5">Trato Asociado</p>
                    <Link to={`/deals/${quote.id_trato}`} className="text-brand-700 font-bold hover:underline truncate block">
                      {quote.nombre_trato}
                    </Link>
                 </div>
              </div>
            </div>
          )}

          {/* Commercial Conditions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-50">Condiciones</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                  <span className="text-slate-500"><i className="fa-regular fa-clock mr-2 w-4"></i>Validez</span>
                  <span className="text-slate-700 font-semibold">{quote.validez_oferta}</span>
                </div>
                <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                  <span className="text-slate-500"><i className="fa-solid fa-truck-fast mr-2 w-4"></i>Entrega</span>
                  <span className="text-slate-700 font-semibold">{quote.tiempo_entrega}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500"><i className="fa-solid fa-shield-halved mr-2 w-4"></i>Garantía</span>
                  <span className="text-slate-700 font-semibold">{quote.garantia}</span>
                </div>
              </div>
          </div>
          
          {/* Notes */}
          {quote.nota && (
             <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-100 p-6">
               <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center">
                   <i className="fa-solid fa-sticky-note mr-2"></i> Notas
               </h3>
               <p className="text-sm text-amber-900/80 whitespace-pre-wrap leading-relaxed italic">"{quote.nota}"</p>
             </div>
          )}

        </div>
      </div>
      
      {isShareOpen && quote && (
        <ShareModal 
          entity="quotes" 
          id={quote.id_cotizacion} 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          onShared={() => setToast({ message: 'Cotización compartida.', type: 'success' })}
        />
      )}
    </div>
  );
};

export default QuoteDetail;