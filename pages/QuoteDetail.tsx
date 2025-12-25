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

  type PdfVersion = {
    id_version: string;
    file_url: string;
    version_number: number;
    created_at: string;
    generado_por: string;
    avatar_url?: string;
  };

  // --- ESTADOS ---
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [pdfVersions, setPdfVersions] = useState<PdfVersion[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estados de Formulario Modal
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  // Estado de Confirmación
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // 1. Obtener Cotización
      const quoteResponse = await fetch(`https://service.computeksa.com/webhook/api/quotes/detail?id_cotizacion=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      
      if (!quoteResponse.ok) {
        if (quoteResponse.status === 404) {
          setQuote(null);
        } else {
          throw new Error('Error al cargar la cotización.');
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

      // 2. Obtener Artículos (Usando la variable local 'q')
      try {
        const itemsResponse = await fetch(`https://service.computeksa.com/webhook/api/quote-items?id_cotizacion=${q.id_cotizacion}&id_tenant=${tenantId}&id_user=${userId}`);
        if (itemsResponse.ok) {
          const responseText = await itemsResponse.text();
          const itemsData = responseText ? JSON.parse(responseText) : [];
          setItems(itemsData);
        }
      } catch (itemError) {
        console.error("Error items:", itemError);
      }

      // 3. Cargas secundarias (Paralelo para velocidad)
      const promises = [];

      // Estados
      promises.push(
        fetch(`/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`)
          .then(res => res.ok ? res.json() : [])
          .then(data => setQuoteStatuses(data))
          .catch(() => {})
      );

      // Productos
      promises.push(
        fetch(`https://service.computeksa.com/webhook/api/products?id_tenant=${tenantId}&id_user=${userId}`)
          .then(res => res.ok ? res.text() : null)
          .then(text => text ? JSON.parse(text) : [])
          .then(data => setAvailableProducts(data))
          .catch(() => {})
      );

      await Promise.all(promises);

    } catch (e: any) {
      console.error("Error fatal:", e);
      setToast({ message: 'Error al cargar los datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, user]); // <--- CORREGIDO: Dependencias mínimas para evitar bucle

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
    const fetchPdfVersions = useCallback(async () => {
      if (!quote?.id_cotizacion || !user?.id_tenant || !user?.id_user) return;
      setPdfLoading(true);
      setPdfError(null);
      try {
        const res = await fetch(`/api/quotes/files?id_cotizacion=${quote.id_cotizacion}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (!res.ok) throw new Error('Error al obtener PDFs');
        const data = await res.json();
        setPdfVersions(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setPdfError(e?.message || 'Error al obtener PDFs');
        setPdfVersions([]);
      } finally {
        setPdfLoading(false);
      }
    }, [quote?.id_cotizacion, user?.id_tenant, user?.id_user]);

    useEffect(() => {
      fetchPdfVersions();
    }, [fetchPdfVersions]);
  // Activar modo edición si viene por URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === '1') setIsEditing(true);
    } catch {}
  }, []);
  
  // --- HANDLERS (LOGICA SIMPLIFICADA) ---

  const handleAddItem = () => {
    setIsProductModalOpen(true);
  };

  const handleProductSelection = async () => {
    if (!selectedProductId || !quote || !user?.id_tenant || !user?.id_user) return;

    const selectedProduct = availableProducts.find(p => p.id_product === selectedProductId);
    if (!selectedProduct) {
      setToast({ message: 'Producto no encontrado.', type: 'error' });
      return;
    }

    setProcessing(true);

    // Solo calculamos el subtotal del ITEM
    const precioUnitario = parseFloat((selectedProduct.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
    const subtotalItem = itemQuantity * precioUnitario;

    const payload = {
      id_cotizacion: quote.id_cotizacion,
      id_tenant: user.id_tenant,
      id_user: user.id_user,
      descripcion: selectedProduct.descripcion, 
      cantidad: itemQuantity,
      precio_unitario: precioUnitario,
      subtotal: subtotalItem,
      id_producto: selectedProduct.id_product
    };

    try {
      // 1. Guardar Item
      const response = await fetch('https://service.computeksa.com/webhook/api/products-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al conectar con el servidor.');

      setToast({ message: 'Artículo añadido.', type: 'success' });
      
      // Limpiar modal
      setIsProductModalOpen(false);
      setSelectedProductId(null);
      setItemQuantity(1);
      
      // 2. Recargar (La BD ya calculó el nuevo total global)
      fetchData();

    } catch (e: any) {
      setToast({ message: e.message || 'Error al añadir.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateItem = async (itemId: string, newCantidad: number, newPrecioUnitario: number) => {
    if (!quote || !user?.id_tenant || !user?.id_user || !itemId) return;
    
    // Evitar llamadas innecesarias
    const currentItem = items.find(i => (i.id_articulo_cot || i.id_quote_item) === itemId);
    const cantidadAnt = parseFloat(currentItem?.cantidad as any) || 0;
    const precioAnt = parseFloat((currentItem?.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;

    if (newCantidad === cantidadAnt && newPrecioUnitario === precioAnt) return;

    setProcessing(true);
    
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
      // 1. Actualizar Item
      const response = await fetch('https://service.computeksa.com/webhook/api/quote-items/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error del servidor al actualizar.');

      setToast({ message: 'Artículo actualizado.', type: 'success' });
      
      // 2. Recargar (La BD ya calculó el nuevo total global)
      fetchData(); 

    } catch (e: any) {
      setToast({ message: e.message || 'Error al actualizar.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Artículo',
      message: '¿Está seguro que desea eliminar este artículo?',
      isDestructive: true,
      onConfirm: async () => {
        if (!quote || !user?.id_tenant || !user?.id_user) return;
        setProcessing(true);
        
        const payload = { 
          id_articulo_cot: itemId,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        };

        try {
          // 1. Eliminar Item
          const response = await fetch('https://service.computeksa.com/webhook/api/quote-items/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) throw new Error('Error al eliminar.');

          setToast({ message: 'Artículo eliminado.', type: 'success' });
          
          // 2. Recargar (La BD ya calculó el nuevo total global)
          fetchData(); 

        } catch (e: any) {
          setToast({ message: e.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setProcessing(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleSaveHeader = async () => {
    if (!quote || !user) return;
    setProcessing(true);
    try {
        const response = await fetch('/api/quotes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_cotizacion: quote.id_cotizacion,
            nombre_cotizacion: quote.nombre_cotizacion,
            id_quote_status: quote.id_quote_status,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            // NOTA: NO enviamos 'total' aquí, la BD se encarga de eso.
            // Solo actualizamos cabeceras.
        }),
        });
        if (!response.ok) throw new Error('Error al actualizar cotización.');
        
        const updated = await response.json();
        setQuote(updated);
        setIsEditing(false);
        setToast({ message: 'Cotización actualizada.', type: 'success' });
    } catch (e: any) {
        setToast({ message: e.message || 'Error al guardar.', type: 'error' });
    } finally {
        setProcessing(false);
    }
  };

const handleGeneratePDF = async () => {
    if (!quote || !user?.id_user || !user?.id_tenant) {
      setToast({ message: 'Faltan datos de usuario o cotización.', type: 'error' });
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        id_cotizacion: quote.id_cotizacion,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
      };

      const response = await fetch('/api/quotes/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al generar PDF.');

      const data = await response.json();

      const redirectUrl = data?.redirect_url || data?.redirect;
      const pdfUrl = data?.url_pdf || data?.pdf_url || data?.url || data?.link;

      if (redirectUrl) {
        window.location.assign(redirectUrl);
      } else if (pdfUrl) {
        window.open(pdfUrl, '_blank');
      }

      // Refrescar datos locales (cotización y versiones) después de generar
      await Promise.all([
        fetchData(),
        fetchPdfVersions(),
      ]);

      setToast({ message: 'PDF generado con éxito.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Error al generar el PDF.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendQuote = async (id_version?: string) => {
    if (!quote || !user?.id_user) return;
    setProcessing(true);
    try {
      const response = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cotizacion: quote.id_cotizacion,
          id_user: user.id_user,
          id_version: id_version || null,
          id_trato: quote.id_trato || null,
        }),
      });
      if (!response.ok) throw new Error('Error al enviar cotización.');
      
      const updatedQuote = await response.json();
      setQuote(updatedQuote);
      setToast({ message: 'Cotización enviada con éxito.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Error al enviar.', type: 'error' });
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
      if (!response.ok) throw new Error('Error al actualizar decisión.');
      
      setQuote({...quote, estado_decision: newDecision});
      setToast({ message: 'Decisión actualizada.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message || 'Error al actualizar.', type: 'error' });
    }
  };

  // --- RENDERIZADO ---

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
  
  const showGenerateBtn = hasItems;
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
                        onClick={handleSaveHeader}
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
           
           {/* Status Dropdown */}
           {quoteStatuses.length > 0 && (() => {
             const currentStatus = quoteStatuses.find(s => s.id_status === quote.id_quote_status);
             return (
               <select 
                 value={quote.id_quote_status || ''}
                 onChange={async (e) => {
                   const newStatusId = e.target.value;
                   if (newStatusId === quote.id_quote_status) return;
                   try {
                     setProcessing(true);
                     const response = await fetch('https://service.computeksa.com/webhook/api/quotes/update-status', {
                       method: 'PUT',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                         id_cotizacion: quote.id_cotizacion,
                         id_quote_status: newStatusId,
                         id_tenant: user?.id_tenant,
                         id_user: user?.id_user
                       })
                     });
                     if (response.ok) {
                       setQuote({ ...quote, id_quote_status: newStatusId });
                       setToast({ message: 'Estado actualizado correctamente', type: 'success' });
                       await fetchData();
                     }
                   } catch (err) {
                     setToast({ message: 'Error al actualizar estado', type: 'error' });
                   } finally {
                     setProcessing(false);
                   }
                 }}
                 className="px-4 py-2.5 rounded-xl border font-medium transition-all outline-none focus:ring-2 focus:ring-offset-2"
                 style={{
                   backgroundColor: `${currentStatus?.color || '#cccccc'}15`,
                   borderColor: `${currentStatus?.color || '#cccccc'}40`,
                   color: currentStatus?.color || '#333'
                 }}
               >
                 {quoteStatuses.map(s => (
                   <option key={s.id_status} value={s.id_status}>{s.name}</option>
                 ))}
               </select>
             );
           })()}

           {showSendBtn && (
             <button 
              onClick={() => handleSendQuote(pdfVersions.length ? pdfVersions[0]?.id_version : undefined)}
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

          {/* Historial de PDFs (en lugar de Documentos) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                <div>
                  <h3 className="font-bold text-slate-800">Historial de PDFs</h3>
                  <p className="text-xs text-slate-500">Versiones generadas y quién las creó.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showGenerateBtn && (
                  <button 
                    onClick={handleGeneratePDF}
                    disabled={processing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2">
                    {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-pdf"></i>}
                    Generar PDF v{quote.version + 1}
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchPdfVersions}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-2"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  Actualizar
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {pdfLoading && (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Cargando historial...
                </div>
              )}

              {!pdfLoading && pdfError && (
                <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">
                  <span>{pdfError}</span>
                  <button
                    type="button"
                    onClick={fetchPdfVersions}
                    className="px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!pdfLoading && !pdfError && pdfVersions.length === 0 && (
                <div className="text-sm text-slate-500">Aún no se han generado PDFs para esta cotización.</div>
              )}

              {!pdfLoading && !pdfError && pdfVersions.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {pdfVersions.map((pdf) => (
                    <div key={pdf.id_version} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <i className="fa-solid fa-file-pdf"></i>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            v{pdf.version_number}
                            <span className="text-xs text-slate-400">{new Date(pdf.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            Generado por {pdf.generado_por}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pdf.avatar_url && (
                          <img
                            src={pdf.avatar_url}
                            alt={pdf.generado_por}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                        )}
                        <a
                          href={pdf.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-2"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleSendQuote(pdf.id_version); }}
                          disabled={processing}
                          className="px-3 py-2 text-sm rounded-lg border border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:text-emerald-800 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                          Enviar
                        </button>
                      </div>
                    </div>
                  ))}
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