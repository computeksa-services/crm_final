import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, QuoteItem, UserDecision, Product, QuoteStatus, PdfVersion, ProductType } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';
import QuoteFormModal from '../components/QuoteFormModal';

// --- HELPER: Selector de Estado (Estilo DealDetail) ---
const StatusSelector: React.FC<{
  currentStatusId: string;
  statuses: QuoteStatus[];
  onSelect: (id: string) => void;
  disabled: boolean;
}> = ({ currentStatusId, statuses, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Buscar estado actual
  const current = statuses.find(s => s.id_status === currentStatusId) || {
    name: 'Desconocido', color: '#94a3b8', icon: 'fa-circle'
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left w-full sm:w-auto" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 py-2.5 rounded-lg font-bold text-xs border transition-all ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-95 active:scale-95'}`}
        style={{
          backgroundColor: `${current.color}15`,
          color: current.color,
          borderColor: `${current.color}40`
        }}
      >
        <div className="flex items-center gap-2 truncate">
            <i className={`${current.icon || 'fa-solid fa-circle'} text-[10px]`}></i>
            <span className="uppercase tracking-wide truncate">{current.name}</span>
        </div>
        {!disabled && <i className="fa-solid fa-chevron-down text-[10px] ml-1 opacity-70"></i>}
      </button>

      {isOpen && !disabled && (
        <div className="absolute right-0 mt-1 w-full sm:w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="py-1 max-h-60 overflow-y-auto">
            {statuses.map((status) => (
              <button
                key={status.id_status}
                onClick={() => { onSelect(status.id_status); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors border-b border-slate-50 last:border-0"
              >
                <i className={`${status.icon || 'fa-solid fa-circle'} text-[10px]`} style={{ color: status.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{status.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // --- ESTADOS ---
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  
  // Data auxiliar para edición
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form States (Product Modal)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<any>({
    codigo: '', descripcion: '', tipo: 'BIEN', categoria: '', precio_unitario: 0, imagen_url: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false,
  });

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/detail?id_cotizacion=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      
      if (!response.ok) {
        if (response.status === 404) setQuote(null);
        else throw new Error('Error al cargar.');
        return;
      }

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;
      // La API devuelve un array [{...}], tomamos el primero
      const q: any = Array.isArray(parsed) ? parsed[0] : parsed;

      if (q) {
        // Normalizamos la data para asegurar que React tenga lo que espera
        // Mapeamos los campos anidados si es necesario, aunque TS ayuda, en runtime es mejor asegurar
        setQuote(q);
        setItems(q.items || []);
        setQuoteStatuses(q.available_statuses || []);

        // Actualizar breadcrumb
        navigate(location.pathname, { state: { breadcrumb: q.nombre_cotizacion }, replace: true });
      } else {
        setQuote(null);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Error al cargar los datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate, location.pathname]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- HANDLERS ---
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('images.weserv.nl')) return url;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      // Usamos weserv como proxy para caché y CORS de imágenes de Drive
      return `https://images.weserv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?id=${match[1]}&export=view`)}&n=-1`;
    }
    return url;
  };

  const getNextProductCode = () => {
    if (availableProducts.length === 0) return 'COD-001';
    const codes = availableProducts
      .map(p => p.codigo || '')
      .filter(c => c.startsWith('COD-'))
      .map(c => parseInt(c.replace('COD-', '')) || 0)
      .sort((a, b) => b - a);
    return `COD-${String((codes[0] || 0) + 1).padStart(3, '0')}`;
  };

  const handleStatusChange = (newStatusId: string) => {
    const newStatus = quoteStatuses.find(s => s.id_status === newStatusId);
    setConfirmState({
      isOpen: true,
      title: 'Actualizar Estado',
      message: `¿Cambiar el estado a "${newStatus?.name}"?`,
      isDestructive: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cotizacion: quote?.id_cotizacion,
              id_quote_status: newStatusId,
              id_tenant: user?.id_tenant,
              id_user: user?.id_user
            })
          });
          if (res.ok) {
            // Optimistic update
            if (quote) {
                setQuote({ 
                    ...quote, 
                    id_quote_status: newStatusId,
                    // Actualizamos status_detail localmente para reflejar el cambio en UI inmediato
                    status_detail: newStatus as any 
                });
            }
            setToast({ message: 'Estado actualizado.', type: 'success' });
            fetchData(); // Recargar para asegurar consistencia
          } else throw new Error();
        } catch {
          setToast({ message: 'Error al actualizar estado.', type: 'error' });
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  const handleAddItem = async () => {
    if (!user?.id_tenant) return;
    setProcessing(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type?id_tenant=${user.id_tenant}`)
      ]);
      
      if (pRes.ok) setAvailableProducts(JSON.parse(await pRes.text()) || []);
      if (tRes.ok) setProductTypes(JSON.parse(await tRes.text()) || []);
      
      setIsCreatingProduct(false);
      setSelectedProductId(null);
      setItemQuantity(1);
      setIsProductModalOpen(true);
    } catch {
      setToast({ message: 'Error al cargar productos.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleProductSelection = async () => {
    if (!selectedProductId || !quote || !user) return;
    const prod = availableProducts.find(p => p.id_product === selectedProductId);
    if (!prod) return;

    setProcessing(true);
    const precio = parseFloat((prod.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cotizacion: quote.id_cotizacion,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
          descripcion: prod.descripcion, 
          cantidad: itemQuantity,
          precio_unitario: precio,
          subtotal: itemQuantity * precio,
          id_producto: prod.id_product
        }),
      });
      if (!res.ok) throw new Error();
      
      setToast({ message: 'Artículo añadido.', type: 'success' });
      setIsProductModalOpen(false);
      fetchData();
    } catch {
      setToast({ message: 'Error al añadir artículo.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateAndAddProduct = async () => {
    if (!newProduct.descripcion || !user) return;
    setProcessing(true);
    try {
      const formData = new FormData();
      Object.keys(newProduct).forEach(key => formData.append(key, newProduct[key]));
      formData.append('id_tenant', user.id_tenant);
      formData.append('imagen_subida', String(!!imageFile));
      if (imageFile) formData.append('imagen', imageFile);

      const createRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products`, { method: 'POST', body: formData });
      if (!createRes.ok) throw new Error('Error al crear producto');

      // Recargar y añadir
      const pRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products?id_tenant=${user.id_tenant}`);
      const products = await pRes.json();
      const created = products.find((p: any) => p.descripcion === newProduct.descripcion);
      
      if (created) {
        setAvailableProducts(products);
        setSelectedProductId(created.id_product);
        
        const precio = parseFloat(newProduct.precio_unitario) || 0;
        await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products-selected`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cotizacion: quote?.id_cotizacion,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            descripcion: created.descripcion,
            cantidad: itemQuantity,
            precio_unitario: precio,
            subtotal: itemQuantity * precio,
            id_producto: created.id_product
          })
        });
        setToast({ message: 'Producto creado y añadido.', type: 'success' });
        setIsProductModalOpen(false);
        fetchData();
      }
    } catch (e: any) {
      setToast({ message: e.message || 'Error.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateItem = async (idItem: string, cant: number, precio: number) => {
    if (!quote || !user) return;
    setProcessing(true);
    try {
      await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_articulo_cot: idItem,
          cantidad: cant,
          precio_unitario: precio,
          subtotal: cant * precio,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        })
      });
      fetchData();
    } catch {
      setToast({ message: 'Error al actualizar.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteItem = (idItem: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Artículo',
      message: '¿Seguro que deseas eliminar este ítem?',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmState(prev => ({...prev, isOpen: false}));
        if (!quote || !user) return;
        setProcessing(true);
        try {
          await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_articulo_cot: idItem, id_tenant: user.id_tenant, id_user: user.id_user })
          });
          setItems(prev => prev.filter(i => (i.id_articulo_cot || i.id_quote_item) !== idItem));
          setTimeout(fetchData, 300);
          setToast({ message: 'Artículo eliminado.', type: 'success' });
        } catch {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  const handleGeneratePDF = async () => {
    if (!quote || !user) return;
    setProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cotizacion: quote.id_cotizacion, id_tenant: user.id_tenant, id_user: user.id_user })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const url = data.redirect_url || data.url_pdf || data.url;
      if (url) window.open(url, '_blank');
      setToast({ message: 'PDF Generado.', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Error al generar PDF.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendQuote = async (idVersion?: string) => {
    if (!quote || !user) return;
    const destEmail = quote.contact_detail?.email || 'el cliente';
    setConfirmState({
        isOpen: true,
        title: 'Enviar Cotización',
        message: `¿Enviar cotización a ${destEmail}?`,
        isDestructive: false,
        onConfirm: async () => {
            setConfirmState(prev => ({...prev, isOpen: false}));
            setProcessing(true);
            try {
            const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                id_cotizacion: quote.id_cotizacion,
                id_user: user.id_user,
                id_version: idVersion || null,
                id_trato: quote.id_trato
                })
            });
            if (!res.ok) throw new Error();
            setToast({ message: 'Enviada correctamente.', type: 'success' });
            fetchData();
            } catch {
            setToast({ message: 'Error al enviar.', type: 'error' });
            } finally {
            setProcessing(false);
            }
        }
    });
  };

  const handleDecisionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(!quote || !user) return;
    const newDecision = e.target.value as UserDecision;
    try {
      await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cotizacion: quote.id_cotizacion,
          estado_decision: newDecision,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });
      setQuote({...quote, estado_decision: newDecision});
      setToast({ message: 'Decisión actualizada.', type: 'success' });
    } catch {
      setToast({ message: 'Error al actualizar.', type: 'error' });
    }
  };

  // --- RENDER ---

  if (loading) return (
    <div className="flex h-[calc(100vh-200px)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-400 font-medium animate-pulse">Cargando cotización...</p>
      </div>
    </div>
  );

  if (!quote) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <h2 className="text-xl font-bold text-slate-800">Cotización no encontrada</h2>
        <button onClick={() => navigate('/app/quotes')} className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all">
            Volver
        </button>
    </div>
  );

  const canEdit = quote.access_level === 'EDIT' || user?.rol_user === 'admin';
  const isSent = quote.estado_decision !== UserDecision.PENDING;
  
  // Encontrar estado actual (usar status_detail de la API o buscar en available_statuses)
  const currentStatusObj = (quote as any).status_detail || quoteStatuses.find(s => s.id_status === quote.id_quote_status);
  const currentStatusCategory = currentStatusObj?.status_category || currentStatusObj?.category;
  const isItemsLocked = currentStatusCategory === 'ACCEPTED' || currentStatusCategory === 'REJECTED';

  return (
    <div className="w-full px-4 md:px-6 pb-20 animate-fade-in font-sans">
      
      {/* --- HEADER PRINCIPAL --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            
            {/* Lado Izquierdo: Info Principal */}
            <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex items-center gap-2">
                    {quote.is_private && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100 font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-lock mr-1"></i> Privado
                        </span>
                    )}
                </div>
                
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                    <span className="font-medium text-slate-600 truncate">{quote.nombre_cotizacion}</span>
                </h1>
                
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    Cotización #{quote.formatted_no_cotizacion}
                </div>
            </div>

            {/* Lado Derecho: Acciones y Totales */}
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
                <div className="text-left lg:text-right w-full lg:w-auto">
                    <div className="text-3xl font-mono font-bold text-slate-800 tracking-tight">
                        {quote.total}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    {/* Selector de Estado */}
                    <StatusSelector 
                        currentStatusId={quote.id_quote_status || ''} 
                        statuses={quoteStatuses} 
                        onSelect={handleStatusChange} 
                        disabled={!canEdit || processing}
                    />

                    {canEdit && (
                        <>
                            <button 
                                onClick={() => navigate(`/app/quotes/new?id=${quote.id_cotizacion}`)}
                                className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-pen"></i> Editar
                            </button>
                            <button 
                                onClick={() => setIsShareOpen(true)}
                                className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-share-nodes"></i> Compartir
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* --- GRID DE CONTENIDO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA (Info Meta - 1/3) */}
        <div className="space-y-6">
            
            {/* TARJETA: Cliente y Contacto */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Cliente</h3>
                        <p className="text-xs text-slate-500">Información del destinatario</p>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    {/* Empresa */}
                    <div className="flex items-start gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100">
                            <i className="fa-solid fa-building"></i>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</p>
                            <Link to={`/app/client-companies/${quote.id_client_company}`} className="font-bold text-slate-800 text-sm hover:text-blue-600 hover:underline block truncate">
                                {quote.company_detail?.name || 'Empresa desconocida'}
                            </Link>
                            {quote.company_detail?.ruc && (
                                <p className="text-xs text-slate-500 mt-0.5">RUC: {quote.company_detail.ruc}</p>
                            )}
                            {quote.company_detail?.address && (
                                <div className="flex items-start gap-1 mt-1 text-xs text-slate-500">
                                    <i className="fa-solid fa-location-dot mt-0.5 opacity-60"></i>
                                    <span className="line-clamp-2">{quote.company_detail.address}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-slate-50 w-full"></div>

                    {/* Contacto */}
                    {quote.id_contact && (
                        <div className="flex items-start gap-3 group">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                                <i className="fa-solid fa-user"></i>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contacto</p>
                                <Link to={`/app/client-contacts/${quote.id_contact}`} className="font-bold text-slate-800 text-sm hover:text-brand-600 hover:underline block truncate">
                                    {quote.contact_detail?.full_name || 'Sin nombre'}
                                </Link>
                                {quote.contact_detail?.position && (
                                    <p className="text-xs text-slate-500 italic truncate">{quote.contact_detail.position}</p>
                                )}
                                {quote.contact_detail?.email && (
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 truncate">
                                        <i className="fa-solid fa-envelope opacity-60"></i>
                                        <span className="truncate">{quote.contact_detail.email}</span>
                                    </div>
                                )}
                                {quote.contact_detail?.phone && (
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                                        <i className="fa-solid fa-phone opacity-60"></i>
                                        <span>{quote.contact_detail.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TARJETA: Condiciones Comerciales */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                    <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Condiciones</h3>
                        <p className="text-xs text-slate-500">Términos de la oferta</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Validez</p>
                            <p className="text-[13px] font-bold text-slate-700">{quote.validez_oferta || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Garantía</p>
                            <p className="text-[13px] font-bold text-slate-700">{quote.garantia || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Entrega</p>
                            <p className="text-[13px] font-bold text-slate-700">{quote.tiempo_entrega || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pago</p>
                            <p className="text-[13px] font-bold text-slate-700">{quote.condicion_pago || '-'}</p>
                        </div>
                    </div>
                    
                    {quote.nota && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nota Interna</p>
                             <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                                <p className="text-xs text-amber-900 italic">{quote.nota}</p>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TARJETA: Información Adicional (Vendedor y Trato) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                    <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Detalles</h3>
                        <p className="text-xs text-slate-500">Contexto y responsable</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {/* Vendedor */}
                    <div className="flex items-center gap-3">
                        <img 
                            src={quote.owner_detail?.avatar || `https://ui-avatars.com/api/?name=${quote.owner_detail?.name || 'U'}`} 
                            alt="Owner" 
                            className="w-8 h-8 rounded-full border border-slate-200"
                        />
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Elaborado por</p>
                            <p className="text-xs font-bold text-slate-700">{quote.owner_detail?.name || 'Desconocido'}</p>
                            <p className="text-[10px] text-slate-500">{quote.owner_detail?.email}</p>
                        </div>
                    </div>

                    {/* Trato Asociado */}
                    {quote.deal_detail && (
                        <div className="pt-3 border-t border-slate-100">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Trato Asociado</p>
                             <Link to={`/app/deals/${quote.deal_detail.id}`} className="flex items-center gap-3 group bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50 transition-all">
                                 <div className="w-8 h-8 rounded-lg bg-white text-brand-600 flex items-center justify-center text-sm shadow-sm border border-slate-100">
                                     <i className="fa-solid fa-handshake"></i>
                                 </div>
                                 <div className="min-w-0">
                                     <p className="text-xs font-bold text-slate-700 group-hover:text-brand-700 truncate">{quote.deal_detail.name}</p>
                                     <p className="text-[10px] text-slate-500 font-mono">{quote.deal_detail.value}</p>
                                 </div>
                             </Link>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Creado</p>
                            <p className="text-[11px] text-slate-600 font-mono">{quote.created_at_fmt || '-'}</p>
                        </div>
                        <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase">Emisión</p>
                             <p className="text-[11px] text-slate-600 font-mono">{quote.fecha_emision_fmt || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TARJETA: Decisión (Si ya fue enviada) */}
            {isSent && (
                 <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-purple-100 flex items-center gap-3">
                        <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
                        <div>
                            <h3 className="font-bold text-purple-900 text-sm">Decisión del Cliente</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                            Registra la respuesta oficial del cliente para actualizar el estado del trato automáticamente.
                        </p>
                        <select 
                            value={quote.estado_decision || ''}
                            onChange={handleDecisionChange}
                            disabled={!canEdit}
                            className="w-full px-4 py-2 bg-white border border-purple-200 rounded-lg text-sm font-bold text-purple-800 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm cursor-pointer"
                        >
                            <option value={UserDecision.PENDING}>⏳ Pendiente de Respuesta</option>
                            <option value={UserDecision.APPROVED}>✅ APROBADO (Ganado)</option>
                            <option value={UserDecision.REJECTED}>❌ RECHAZADO (Perdido)</option>
                            <option value={UserDecision.NEGOCIAR}>💬 En Negociación</option>
                        </select>
                    </div>
                 </div>
            )}

        </div>

        {/* COLUMNA DERECHA (Contenido Principal - 2/3) */}
        <div className="lg:col-span-2 space-y-6">

            {/* TARJETA: Artículos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-brand-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Artículos</h3>
                        <p className="text-xs text-slate-500">Detalle de productos y servicios</p>
                    </div>
                  </div>
                  {canEdit && !isItemsLocked && (
                    <button 
                        onClick={handleAddItem}
                        className="text-[13px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i> Agregar
                    </button>
                  )}
                </div>
                
                {items.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50/50">
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                            <i className="fa-solid fa-basket-shopping text-xl"></i>
                        </div>
                        <p className="text-slate-500 text-sm">Sin artículos agregados.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 font-bold uppercase bg-slate-50 border-b border-slate-100 tracking-wider">
                                <tr>
                                    <th className="px-6 py-3">Descripción</th>
                                    <th className="px-4 py-3 text-right">Cant.</th>
                                    <th className="px-4 py-3 text-right">Precio</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map((item, idx) => {
                                    const cant = parseFloat(item.cantidad as any) || 0;
                                    const precio = parseFloat((item.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
                                    return (
                                        <tr key={idx} className="group hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex gap-4">
                                                    {/* Imagen del Producto */}
                                                    <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                                                        {item.imagen_url ? (
                                                            <img 
                                                                src={convertGoogleDriveUrl(item.imagen_url)} 
                                                                alt="" 
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<i class="fa-solid fa-image text-slate-300"></i>';
                                                                }}
                                                            />
                                                        ) : (
                                                            <i className="fa-solid fa-box text-slate-300"></i>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col justify-center">
                                                        <span className="font-bold text-slate-700 text-[13px] line-clamp-2">{item.descripcion}</span>
                                                        {item.formatted_product_code && (
                                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{item.formatted_product_code}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right align-middle">
                                                <input 
                                                    type="number" min="1" disabled={!canEdit || isItemsLocked}
                                                    defaultValue={cant}
                                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || '', parseFloat(e.target.value)||1, precio)}
                                                    className="w-14 text-right bg-transparent hover:bg-white border border-transparent hover:border-slate-200 rounded px-1 py-1 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 font-medium transition-all"
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-right align-middle">
                                                <input 
                                                    type="number" step="0.01" disabled={!canEdit || isItemsLocked}
                                                    defaultValue={precio.toFixed(2)}
                                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || '', cant, parseFloat(e.target.value)||0)}
                                                    className="w-20 text-right bg-transparent hover:bg-white border border-transparent hover:border-slate-200 rounded px-1 py-1 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 font-medium transition-all"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-700 align-middle">
                                                {(cant * precio).toLocaleString('en-US', {style:'currency', currency:'USD'})}
                                            </td>
                                            <td className="px-2 text-center align-middle">
                                                {canEdit && !isItemsLocked && (
                                                    <button onClick={() => handleDeleteItem(item.id_articulo_cot || '')} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50">
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-slate-50 border-t border-slate-200">
                                    <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total General</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-800 text-xl font-mono tracking-tight">{quote.total}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* TARJETA: Mensaje al Cliente (Si existe) */}
            {quote.mensaje && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                        <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Mensaje para el Cliente</h3>
                            <p className="text-xs text-slate-500">Notas visibles en el PDF</p>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-50/50">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                            {quote.mensaje}
                        </div>
                    </div>
                </div>
            )}

            {/* TARJETA: Historial de PDFs (Versiones) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Versiones PDF</h3>
                        <p className="text-xs text-slate-500">Documentos generados</p>
                    </div>
                  </div>
                  {canEdit && items.length > 0 && (
                     <button 
                        onClick={handleGeneratePDF}
                        disabled={processing}
                        className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center disabled:opacity-50 uppercase tracking-wide border border-indigo-100"
                     >
                        {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-1.5"></i> : <i className="fa-solid fa-file-pdf mr-1.5"></i>}
                        Generar v{(quote.versions?.length || 0) + 1}
                     </button>
                  )}
                </div>
                <div className="p-0">
                    {(!quote.versions || quote.versions.length === 0) ? (
                        <div className="text-center py-6 text-slate-400 text-xs italic">No hay PDFs generados aún.</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {quote.versions.map(pdf => (
                                <div key={pdf.id_version} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm border border-indigo-100">
                                            <i className="fa-solid fa-file-pdf"></i>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Versión {pdf.version_number}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                {pdf.created_at ? new Date(pdf.created_at).toLocaleString() : '-'}
                                            </p>
                                            <p className="text-[10px] text-slate-400">Por {pdf.creator_name || 'Sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a 
                                            href={pdf.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-200 transition-all shadow-sm"
                                        >
                                            <i className="fa-solid fa-external-link-alt mr-1"></i> Abrir
                                        </a>
                                        {canEdit && (
                                            <button 
                                                onClick={() => handleSendQuote(pdf.id_version)} 
                                                className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors"
                                            >
                                                <i className="fa-solid fa-paper-plane mr-1"></i> Enviar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* TARJETA: Historial de Envíos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-slate-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Registro de Envíos</h3>
                        <p className="text-xs text-slate-500">Bitácora de comunicación</p>
                    </div>
                  </div>
                  {quote.sent_history?.length > 0 && (
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">
                          {quote.sent_history.length} envíos
                      </span>
                  )}
                </div>
                <div className="p-6">
                    {!quote.sent_history?.length ? (
                        <div className="text-center py-4 text-slate-400 text-xs italic">
                            <i className="fa-solid fa-inbox text-xl mb-2 opacity-50 block"></i>
                            Sin actividad de envíos.
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-100 ml-2 space-y-8 pl-6 py-2">
                            {quote.sent_history.map((log, idx) => (
                                <div key={idx} className="relative group">
                                    <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-200 border-2 border-white shadow-sm group-hover:bg-emerald-400 transition-colors"></div>
                                    
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[13px] font-bold text-slate-700 flex items-center gap-2">
                                                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-200 uppercase tracking-wide">
                                                        {log.method}
                                                    </span>
                                                    <span>Enviado a <span className="text-slate-900">{log.sent_to}</span></span>
                                                </p>
                                            </div>
                                            <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 font-mono">
                                                {log.sent_at_fmt}
                                            </span>
                                        </div>
                                        
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 space-y-1">
                                            <div className="flex gap-2">
                                                <span className="font-bold text-slate-400 w-12 text-right">Asunto:</span>
                                                <span className="font-medium italic text-slate-800">{log.subject}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-bold text-slate-400 w-12 text-right">Versión:</span>
                                                <span>PDF v{log.version_enviada}</span>
                                            </div>
                                            {log.sent_cc && (
                                                <div className="flex gap-2">
                                                    <span className="font-bold text-slate-400 w-12 text-right">CC:</span>
                                                    <span className="truncate">{log.sent_cc}</span>
                                                </div>
                                            )}
                                             <div className="flex gap-2">
                                                <span className="font-bold text-slate-400 w-12 text-right">Por:</span>
                                                <span>{log.sent_by_name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>

      {/* --- MODALES --- */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({...confirmState, isOpen: false})} />
      
      {isShareOpen && quote && (
        <ShareModal entity="quotes" id={quote.id_cotizacion} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setToast({ message: 'Compartido.', type: 'success' })} />
      )}

      {quote && (
        <QuoteFormModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            initialData={quote}
            onSuccess={(updated) => { setQuote(updated); setIsEditModalOpen(false); setToast({ message: 'Actualizado.', type: 'success' }); fetchData(); }}
        />
      )}

      {/* MODAL DE PRODUCTOS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm">
                    <i className={`fa-solid ${isCreatingProduct ? 'fa-plus' : 'fa-box-open'}`}></i>
                </span>
                {isCreatingProduct ? 'Crear Nuevo Producto' : 'Seleccionar Producto'}
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setIsCreatingProduct(false)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${!isCreatingProduct ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Existente
                </button>
                <button
                  onClick={() => setIsCreatingProduct(true)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${isCreatingProduct ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Nuevo
                </button>
              </div>

              {/* Content */}
              {!isCreatingProduct ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Buscar Producto</label>
                    <div className="relative">
                        <select 
                            value={selectedProductId || ''} 
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium text-sm"
                        >
                            <option value="">-- Seleccionar --</option>
                            {availableProducts.map(p => (
                                <option key={p.id_product} value={p.id_product}>{p.descripcion} ({p.codigo})</option>
                            ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-4 top-4 text-slate-400 text-xs pointer-events-none"></i>
                    </div>
                  </div>
                  {selectedProductId && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex gap-4">
                          {(() => {
                              const p = availableProducts.find(x => x.id_product === selectedProductId);
                              if(!p) return null;
                              return (
                                <>
                                    <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                        {p.imagen_url ? <img src={convertGoogleDriveUrl(p.imagen_url)} className="w-full h-full object-cover"/> : <i className="fa-solid fa-image text-slate-300"></i>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{p.descripcion}</p>
                                        <p className="text-xs text-slate-500 mt-1">Precio Ref: <span className="font-bold text-slate-700">${parseFloat(String(p.precio_unitario).replace(/[^0-9.-]+/g,"")).toFixed(2)}</span></p>
                                    </div>
                                </>
                              );
                          })()}
                      </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cantidad</label>
                    <input type="number" min="1" value={itemQuantity} onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="flex gap-4">
                        <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-white hover:border-brand-400 cursor-pointer flex items-center justify-center relative overflow-hidden shrink-0 transition-all">
                            {newProduct.imagen_url ? <img src={convertGoogleDriveUrl(newProduct.imagen_url)} className="w-full h-full object-cover"/> : <div className="text-center"><i className="fa-solid fa-camera text-slate-300 mb-1"></i><p className="text-[9px] text-slate-400 font-bold uppercase">Foto</p></div>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={(e) => {
                            const file = e.target.files?.[0];
                            if(file){
                                setImageFile(file);
                                const reader = new FileReader();
                                reader.onloadend = () => setNewProduct({...newProduct, imagen_url: reader.result});
                                reader.readAsDataURL(file);
                            }
                        }} className="hidden" />
                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Código</label>
                                <input value={newProduct.codigo} onChange={e => setNewProduct({...newProduct, codigo: e.target.value})} placeholder={getNextProductCode()} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Categoría</label>
                                <input value={newProduct.categoria} onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
                            </div>
                        </div>
                   </div>
                   <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción *</label>
                        <textarea rows={2} value={newProduct.descripcion} onChange={e => setNewProduct({...newProduct, descripcion: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                             <select value={newProduct.tipo} onChange={e => setNewProduct({...newProduct, tipo: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                                 {productTypes.map(pt => <option key={pt.id_product_type} value={pt.type}>{pt.type}</option>)}
                             </select>
                        </div>
                        <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase">Precio Unitario</label>
                             <div className="relative">
                                 <span className="absolute left-3 top-2 text-slate-400">$</span>
                                 <input type="number" step="0.01" value={newProduct.precio_unitario} onChange={e => setNewProduct({...newProduct, precio_unitario: e.target.value})} className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded-lg text-sm"/>
                             </div>
                        </div>
                   </div>
                   <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad a añadir</label>
                       <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
                   </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors">Cancelar</button>
               <button 
                  onClick={isCreatingProduct ? handleCreateAndAddProduct : handleProductSelection}
                  disabled={processing || (isCreatingProduct && !newProduct.descripcion) || (!isCreatingProduct && !selectedProductId)}
                  className="px-6 py-2 rounded-lg bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md shadow-brand-200 transition-all disabled:opacity-50"
               >
                  {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (isCreatingProduct ? 'Crear y Añadir' : 'Añadir')}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteDetail;