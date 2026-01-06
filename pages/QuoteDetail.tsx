import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, QuoteItem, UserDecision, Product, QuoteStatus, PdfVersion, ProductType } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';
import QuoteEditModal from '../components/QuoteEditModal';

const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- ESTADOS ---
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [pdfVersions, setPdfVersions] = useState<PdfVersion[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estados de Formulario Modal
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  
  // Estados para crear productos desde el modal
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<any>({
    codigo: '',
    descripcion: '',
    tipo: 'BIEN',
    categoria: '',
    precio_unitario: 0,
    imagen_url: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Estado de Confirmación
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // --- CARGA DE DATOS (OPTIMIZADA: UNA SOLA LLAMADA) ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // UNA SOLA LLAMADA: Obtiene todo (quote, items, versions, access, detalles, etc.)
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

      // Los items vienen en q.items (no necesita llamada separada)
      if (q.items && Array.isArray(q.items)) {
        setItems(q.items);
      }

      // Los PDFs vienen en q.versions (no necesita llamada separada)
      if (q.versions && Array.isArray(q.versions)) {
        const validVersions = q.versions.filter((v: any) => v && v.file_url && v.version_number !== undefined && v.version_number !== null);
        setPdfVersions(validVersions);
      }

      // Los estados disponibles vienen en q.available_statuses (no necesita llamada separada)
      if (q.available_statuses && Array.isArray(q.available_statuses)) {
        setQuoteStatuses(q.available_statuses);
      }

      // Nota: Las llamadas a /api/products y /api/products_type se harán solo cuando el usuario
      // haga clic en "Agregar" (handleAddItem), no durante la carga inicial

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
  
  // Activar modo edición si viene por URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      // Ya no usamos isEditing, ahora usamos isConditionsModalOpen
    } catch {}
  }, []);
  
  // --- HANDLERS (LOGICA SIMPLIFICADA) ---

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    
    // Si ya es una URL de proxy, devolverla
    if (url.includes('images.weserv.nl')) return url;
    
    // Extraer el ID del archivo de URL de Google Drive
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const directUrl = `https://drive.google.com/uc?id=${match[1]}&export=view`;
      // Usar un proxy para evitar problemas de CORS
      return `https://images.weserv.nl/?url=${encodeURIComponent(directUrl)}&n=-1`;
    }
    
    // Si no se puede extraer, devolver la URL original
    return url;
  };
  
  const getNextProductCode = () => {
    if (availableProducts.length === 0) return 'COD-001';
    
    const codes = availableProducts
      .map(p => p.codigo || '')
      .filter(c => c.startsWith('COD-'))
      .map(c => parseInt(c.replace('COD-', '')) || 0)
      .sort((a, b) => b - a);
    
    const nextNum = (codes[0] || 0) + 1;
    return `COD-${String(nextNum).padStart(3, '0')}`;
  };

  const handleAddItem = async () => {
    if (!quote || (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin')) {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }
    
    setProcessing(true);
    try {
      // Cargar productos y tipos de productos solo cuando se abre el modal
      const tenantId = user?.id_tenant;
      const userId = user?.id_user;
      
      const [productsRes, typesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/products?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/products_type?id_tenant=${tenantId}`)
      ]);
      
      if (productsRes.ok) {
        const productsText = await productsRes.text();
        const products = productsText ? JSON.parse(productsText) : [];
        setAvailableProducts(products);
      }
      
      if (typesRes.ok) {
        const typesText = await typesRes.text();
        const types = typesText ? JSON.parse(typesText) : [];
        setProductTypes(types);
      }
      
      setIsCreatingProduct(false);
      setSelectedProductId(null);
      setItemQuantity(1);
      setIsProductModalOpen(true);
    } catch (e) {
      setToast({ message: 'Error al cargar productos.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };
  
  const handleToggleCreateProduct = () => {
    setIsCreatingProduct(!isCreatingProduct);
    if (!isCreatingProduct) {
      // Inicializar nuevo producto con valores por defecto
      setNewProduct({
        codigo: '',
        descripcion: '',
        tipo: productTypes.length > 0 ? productTypes[0].type : 'BIEN',
        categoria: '',
        precio_unitario: 0,
        imagen_url: ''
      });
      setImageFile(null);
    }
  };
  
  const handleProductInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProduct((prev: any) => ({ ...prev, [name]: value }));
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setToast({ message: 'Imagen muy pesada (Max 800KB).', type: 'error' });
        return;
      }
      
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct((prev: any) => ({ ...prev, imagen_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCreateAndAddProduct = async () => {
    if (!newProduct.descripcion || !newProduct.tipo || !user?.id_tenant) {
      setToast({ message: 'Descripción y Tipo son obligatorios.', type: 'error' });
      return;
    }
    
    setProcessing(true);
    
    try {
      // 1. Crear el producto
      const formData = new FormData();
      formData.append('id_product', '');
      formData.append('id_tenant', user.id_tenant);
      formData.append('codigo', newProduct.codigo || '');
      formData.append('descripcion', newProduct.descripcion);
      formData.append('tipo', newProduct.tipo);
      formData.append('categoria', newProduct.categoria || '');
      formData.append('precio_unitario', String(Number(newProduct.precio_unitario)));
      formData.append('imagen_subida', String(!!imageFile));
      
      if (imageFile) {
        formData.append('imagen', imageFile);
      }
      
      const createResponse = await fetch('https://service.computeksa.com/webhook/api/products', {
        method: 'POST',
        body: formData,
      });
      
      if (!createResponse.ok) throw new Error('Error al crear el producto.');
      
      // 2. Recargar la lista de productos para obtener el recién creado
      const productsResponse = await fetch(`https://service.computeksa.com/webhook/api/products?id_tenant=${user.id_tenant}`);
      if (!productsResponse.ok) throw new Error('Producto creado pero no se pudo recargar la lista.');
      
      const productsText = await productsResponse.text();
      const updatedProducts = productsText ? JSON.parse(productsText) : [];
      
      // 3. Buscar el producto recién creado por descripción
      const createdProduct = updatedProducts.find((p: any) => 
        p.descripcion === newProduct.descripcion && 
        p.tipo === newProduct.tipo &&
        p.categoria === (newProduct.categoria || '')
      );
      
      if (!createdProduct || !createdProduct.id_product) {
        // El producto se creó pero no lo encontramos, actualizar lista y cerrar
        setAvailableProducts(updatedProducts);
        setToast({ message: 'Producto creado. Selecciónalo de la lista para añadirlo.', type: 'success' });
        setIsCreatingProduct(false);
        setNewProduct({
          codigo: '',
          descripcion: '',
          tipo: 'BIEN',
          categoria: '',
          precio_unitario: 0,
          imagen_url: ''
        });
        setImageFile(null);
        setProcessing(false);
        return;
      }
      
      // 4. Actualizar la lista de productos disponibles
      setAvailableProducts(updatedProducts);
      
      // 5. Añadir el producto a la cotización
      const precioUnitario = parseFloat(newProduct.precio_unitario) || 0;
      const subtotalItem = itemQuantity * precioUnitario;
      
      const addItemPayload = {
        id_cotizacion: quote?.id_cotizacion,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        descripcion: newProduct.descripcion,
        cantidad: itemQuantity,
        precio_unitario: precioUnitario,
        subtotal: subtotalItem,
        id_producto: createdProduct.id_product
      };
      
      const addResponse = await fetch('https://service.computeksa.com/webhook/api/products-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addItemPayload),
      });
      
      if (!addResponse.ok) throw new Error('Producto creado pero no se pudo añadir a la cotización.');
      
      setToast({ message: 'Producto creado y añadido correctamente.', type: 'success' });
      
      // Limpiar modal y estados
      setIsProductModalOpen(false);
      setIsCreatingProduct(false);
      setNewProduct({
        codigo: '',
        descripcion: '',
        tipo: 'BIEN',
        categoria: '',
        precio_unitario: 0,
        imagen_url: ''
      });
      setImageFile(null);
      setItemQuantity(1);
      
      // Recargar datos
      fetchData();
      
    } catch (e: any) {
      setToast({ message: e.message || 'Error al crear el producto.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleProductSelection = async () => {
    if (!selectedProductId || !quote || !user?.id_tenant || !user?.id_user) return;
    
    if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }

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
    
    if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }
    
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
    if (!quote || (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin')) {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }
    
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

  const handleSaveEdit = async (updatedData: Partial<Quote>) => {
    if (!quote || !user) return;
    
    if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }
    
    setProcessing(true);
    try {
        const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_cotizacion: quote.id_cotizacion,
            nombre_cotizacion: updatedData.nombre_cotizacion || quote.nombre_cotizacion,
            id_quote_status: updatedData.id_quote_status || quote.id_quote_status,
            tiempo_entrega: updatedData.tiempo_entrega || quote.tiempo_entrega || '',
            garantia: updatedData.garantia || quote.garantia || '',
            validez_oferta: updatedData.validez_oferta || quote.validez_oferta || '',
            nota: updatedData.nota || quote.nota || '',
            mensaje: updatedData.mensaje || quote.mensaje || '',
            correos_adicionales: updatedData.correos_adicionales || quote.correos_adicionales || '',
            is_private: quote.is_private || false,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
        }),
        });
        if (!response.ok) throw new Error('Error al actualizar cotización.');
        
        const updated = await response.json();
        setQuote(updated);
        setToast({ message: 'Cotización actualizada correctamente.', type: 'success' });
    } catch (e: any) {
        setToast({ message: e.message || 'Error al guardar.', type: 'error' });
        throw e;
    } finally {
        setProcessing(false);
    }
  };

const handleGeneratePDF = async () => {
    if (!quote || !user?.id_user || !user?.id_tenant) {
      setToast({ message: 'Faltan datos de usuario o cotización.', type: 'error' });
      return;
    }
    
    if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        id_cotizacion: quote.id_cotizacion,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
      };

      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/generate-pdf`, {
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
      await fetchData();

      setToast({ message: 'PDF generado con éxito.', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Error al generar el PDF.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendQuote = async (id_version?: string) => {
    if (!quote || !user?.id_user) return;
    
    if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
      setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/send`, {
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
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/decision`, {
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
            <button onClick={() => navigate('/app/quotes')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                Volver al listado
            </button>
        </div>
    </div>
  );

  const hasItems = items.length > 0;
  
  // Encontrar el status actual
  const currentStatus = quoteStatuses.find(s => s.id_status === quote.id_quote_status);
  const currentStatusCategory = currentStatus?.status_category;
  
  // Estados finales que bloquean modificaciones basados en la categoría del sistema
  const canEditItems = currentStatusCategory !== 'ACCEPTED' && currentStatusCategory !== 'REJECTED';
  const isReady = currentStatusCategory === 'SENT';
  const isSent = quote.estado_decision !== UserDecision.PENDING;
  
  const showGenerateBtn = hasItems;
  const showSendBtn = isReady; 

  return (
    <div className="w-full space-y-6 pb-12 animate-fade-in px-6 lg:px-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      {/* Product Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mr-3 text-sm">
                    <i className={`fa-solid ${isCreatingProduct ? 'fa-plus' : 'fa-box-open'}`}></i>
                </span>
                {isCreatingProduct ? 'Crear Nuevo Producto' : 'Seleccionar Artículo'}
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Toggle entre seleccionar y crear */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProduct(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${!isCreatingProduct ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <i className="fa-solid fa-list mr-2"></i>
                  Seleccionar Existente
                </button>
                <button
                  type="button"
                  onClick={handleToggleCreateProduct}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${isCreatingProduct ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  Crear Nuevo
                </button>
              </div>
              
              {!isCreatingProduct ? (
                /* MODO SELECCIÓN */
                <>
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

                  {/* Preview del producto seleccionado con imagen */}
                  {selectedProductId && selectedProductId.length > 0 && (() => {
                    const selectedProduct = availableProducts.find(p => p.id_product.toString() === selectedProductId);
                    return selectedProduct ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-4">
                          {selectedProduct.imagen_url && (
                            <div className="flex-shrink-0">
                              <img
                                src={convertGoogleDriveUrl(selectedProduct.imagen_url)}
                                alt={selectedProduct.descripcion}
                                className="h-16 w-16 object-cover rounded-lg border border-slate-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TaW4gaW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
                                }}
                              />
                            </div>
                          )}
                          <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-900">
                              {selectedProduct.descripcion}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Código: {selectedProduct.codigo}
                            </p>
                            {selectedProduct.precio_unitario && (
                              <p className="text-xs text-slate-600 mt-1">
                                Precio: ${selectedProduct.precio_unitario.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

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
                </>
              ) : (
                /* MODO CREACIÓN */
                <>
                  {/* Image Upload */}
                  <div className="flex gap-6 items-start">
                      <div 
                        className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group cursor-pointer hover:border-brand-400 transition-colors flex-shrink-0" 
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {newProduct.imagen_url ? (
                            <img src={convertGoogleDriveUrl(newProduct.imagen_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-2">
                                <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-300 mb-1"></i>
                                <p className="text-[11px] text-slate-400 font-medium">Subir foto</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                            Cambiar
                        </div>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                      
                      <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  Código <span className="text-slate-400 font-normal">(Opcional)</span>
                                </label>
                                <div className="space-y-2">
                                  <input 
                                      name="codigo" 
                                      value={newProduct.codigo || ''} 
                                      onChange={handleProductInputChange} 
                                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm" 
                                      placeholder="Dejar vacío para autogenerar"
                                  />
                                  {!newProduct.codigo && (
                                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                      💡 Se generará: <span className="font-mono font-bold text-brand-600">{getNextProductCode()}</span>
                                    </p>
                                  )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
                                <input 
                                    name="categoria" 
                                    value={newProduct.categoria || ''} 
                                    onChange={handleProductInputChange} 
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                                    placeholder="Ej. Hardware"
                                />
                            </div>
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción <span className="text-red-500">*</span></label>
                    <textarea 
                        name="descripcion" 
                        rows={4} 
                        required 
                        value={newProduct.descripcion || ''} 
                        onChange={handleProductInputChange} 
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        placeholder="Detalles del producto o servicio..."
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select 
                                name="tipo" 
                                value={newProduct.tipo || ''} 
                                onChange={handleProductInputChange} 
                                required
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                            >
                                {productTypes.map((pt: any) => <option key={pt.id_product_type} value={pt.type}>{pt.type}</option>)}
                            </select>
                            <div className="absolute right-3 top-3 text-slate-400 pointer-events-none text-xs"><i className="fa-solid fa-chevron-down"></i></div>
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Precio Unitario</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                            <input 
                                type="number" 
                                name="precio_unitario" 
                                step="0.01" 
                                value={newProduct.precio_unitario || ''} 
                                onChange={handleProductInputChange} 
                                className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" 
                            />
                        </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad a Añadir</label>
                    <input 
                      type="number" 
                      value={itemQuantity} 
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                      min="1" 
                      required 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </>
              )}
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
                onClick={isCreatingProduct ? handleCreateAndAddProduct : handleProductSelection} 
                disabled={processing || (!isCreatingProduct && !selectedProductId) || (isCreatingProduct && !newProduct.descripcion)}
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-200 disabled:opacity-70 disabled:shadow-none flex items-center transition-all"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                {isCreatingProduct ? 'Crear y Añadir' : 'Añadir al Presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
           <div className="flex items-center gap-3 mb-1">
             {quote.is_private && (
                 <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex items-center">
                     <i className="fa-solid fa-lock mr-1 text-[10px]"></i> Privado
                 </span>
             )}
           </div>

           <div className="ml-8">
               <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cotización #{quote.formatted_no_cotizacion}</h1>
               <p className="text-sm text-slate-500 mt-0.5 font-medium">{quote.nombre_cotizacion}</p>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-end">
           
           {/* Status Dropdown */}
           {quoteStatuses.length > 0 && (() => {
             const currentStatus = quoteStatuses.find(s => s.id_status === quote.id_quote_status);
             return (
               <select 
                 disabled={!(quote.access_level === 'EDIT' || user?.rol_user === 'admin')}
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
                 className="px-4 py-2.5 rounded-xl border font-medium transition-all outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Commercial Conditions & Details Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 flex items-center">
                <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
                Detalles de la Cotización
              </h3>
              {(quote.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center"
                >
                  <i className="fa-solid fa-pencil mr-1.5"></i> Editar Todo
                </button>
              )}
            </div>
            
            <div className="px-6 py-4 space-y-3">
              {/* Row 1: Condiciones Comerciales */}
              <div className="grid grid-cols-3 gap-4 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entrega</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{quote.tiempo_entrega || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Garantía</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{quote.garantia || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Validez</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{quote.validez_oferta || '-'}</p>
                </div>
              </div>

              {/* Row 2: Nota Interna (si existe) */}
              {quote.nota && (
                <div className="py-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nota Interna</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{quote.nota}</p>
                </div>
              )}

              {/* Row 3: Mensaje para Cliente (si existe) */}
              {quote.mensaje && (
                <div className="py-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mensaje al Cliente</p>
                  <p className="text-sm text-slate-700 bg-blue-50 p-2 rounded border border-blue-100 whitespace-pre-wrap">{quote.mensaje}</p>
                </div>
              )}

              {/* Row 4: Correos CC (si existen) */}
              {quote.correos_adicionales && (
                <div className="py-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Copia a</p>
                  <p className="text-sm text-slate-700">{quote.correos_adicionales}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Items Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 flex items-center">
                <span className="w-2 h-6 bg-brand-500 rounded-full mr-3"></span>
                Artículos
              </h3>
              {canEditItems && (quote.access_level === 'EDIT' || user?.rol_user === 'admin') && (
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
                                    disabled={!(quote.access_level === 'EDIT' || user?.rol_user === 'admin')}
                                    defaultValue={cantidad}
                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || item.id_quote_item || '', parseInt(e.target.value) || 1, precioUnitario)}
                                    min="1" 
                                    className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded text-right font-medium text-slate-700 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </td>
                            <td className="px-4 py-4 text-right">
                                <input 
                                    type="number"
                                    disabled={!(quote.access_level === 'EDIT' || user?.rol_user === 'admin')}
                                    defaultValue={precioUnitario.toFixed(2)}
                                    onBlur={(e) => handleUpdateItem(item.id_articulo_cot || item.id_quote_item || '', cantidad, parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded text-right font-medium text-slate-700 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">
                                {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-4 text-center">
                                {(quote.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                                  <button 
                                  onClick={() => handleDeleteItem(item.id_articulo_cot || item.id_quote_item || '')}
                                  className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  title="Eliminar artículo"
                                  >
                                  <i className="fa-solid fa-trash-alt"></i>
                                  </button>
                                )}
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
                    disabled={processing || !(quote.access_level === 'EDIT' || user?.rol_user === 'admin')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-pdf"></i>}
                    Generar PDF v{quote.version + 1}
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchData}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-2"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  Actualizar
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {pdfVersions.length === 0 && (
                <div className="text-sm text-slate-500">Aún no se han generado PDFs para esta cotización.</div>
              )}

              {pdfVersions.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {pdfVersions.map((pdf) => {
                    // Validar que el PDF tenga datos válidos
                    if (!pdf.file_url || pdf.version_number === undefined) return null;
                    
                    // Validar y formatear la fecha
                    const fecha = pdf.created_at ? new Date(pdf.created_at) : null;
                    const fechaValida = fecha && !isNaN(fecha.getTime());
                    const fechaFormato = fechaValida ? fecha.toLocaleString() : 'Fecha desconocida';
                    
                    return (
                      <div key={pdf.id_version} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <i className="fa-solid fa-file-pdf"></i>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              v{pdf.version_number}
                              <span className="text-xs text-slate-400">{fechaFormato}</span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              Generado por {pdf.generado_por || 'Sistema'}
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
                    );
                  })}
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
                  <Link to={`/app/client-companies/${quote.id_client_company}`} className="text-slate-800 font-bold hover:text-blue-600 transition-colors text-base">
                    {(quote.company_detail as any)?.name || quote.client_company_name || '-'}
                  </Link>
                </div>
              </div>

              <div className="flex items-start group">
                 <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                    <i className="fa-solid fa-user"></i>
                 </div>
                 <div>
                   <span className="text-xs text-slate-400 font-semibold block uppercase">Contacto</span>
                   <Link to={`/app/client-contacts/${quote.id_contact}`} className="text-slate-700 font-medium hover:text-brand-600 transition-colors">
                     {quote.contact_detail?.full_name || quote.contact_name || '-'}
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
                        <span className="text-slate-700 text-sm font-medium truncate">{quote.owner_detail?.name || quote.owner_name || '-'}</span>
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
          {quote.id_trato && quote.deal_detail && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-50">Contexto</h3>
              <div className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-200 transition-colors">
                 <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-brand-600 mr-3 text-lg">
                    <i className="fa-solid fa-handshake"></i>
                 </div>
                 <div className="overflow-hidden">
                    <p className="text-xs text-slate-500 mb-0.5">Trato Asociado</p>
                    <Link to={`/app/deals/${quote.id_trato}`} className="text-brand-700 font-bold hover:underline truncate block">
                      {quote.deal_detail.name}
                    </Link>
                 </div>
              </div>
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

      {/* Quote Edit Modal */}
      <QuoteEditModal 
        isOpen={isEditModalOpen}
        quote={quote}
        quoteStatuses={quoteStatuses}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEdit}
        processing={processing}
      />
    </div>
  );
};

export default QuoteDetail;