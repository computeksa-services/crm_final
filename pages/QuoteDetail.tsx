import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { Quote, QuoteItem, UserDecision, Product } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal'; // Importar ConfirmModal

const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1); // Estado para la cantidad en el modal

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Obtener los datos principales de la cotización
      const q = await MockApi.getQuoteById(id);
      
      if (q) {
        // 2. Guardar la cotización en el estado inmediatamente.
        // Así, si falla la carga de items, la página principal no se rompe.
        setQuote(q);

        // 3. Cargar los artículos en un bloque try/catch anidado.
        try {
          const itemsResponse = await fetch(`https://service.computeksa.com/webhook/api/quote-items?id_cotizacion=${q.id_cotizacion}`);
          
          if (!itemsResponse.ok) {
            // Si la API responde con 404, es una forma común de decir "no hay items".
            // Lo manejamos sin mostrar un error al usuario.
            if (itemsResponse.status === 404) {
              setItems([]);
            } else {
              // Para otros errores (ej. 500), sí queremos saberlo.
              throw new Error(`Error del servidor: ${itemsResponse.status}`);
            }
          } else {
            // Leemos la respuesta como texto para manejar el caso de que n8n devuelva un cuerpo vacío
            // en lugar de un array `[]` cuando no hay resultados.
            const responseText = await itemsResponse.text();
            const itemsData = responseText ? JSON.parse(responseText) : [];
            setItems(itemsData);
          }

        } catch (itemError) {
          console.error("Error al cargar o procesar los artículos:", itemError);
          setToast({ message: 'No se pudieron cargar los artículos.', type: 'error' });
          setItems([]); // En cualquier caso de error, dejamos la tabla vacía.
        }

      } else {
        setQuote(null);
      }
    } catch (e) {
      console.error("Error al cargar la cotización:", e);
      setToast({ message: 'Error fatal al cargar la cotización.', type: 'error' });
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    // Cargar productos disponibles cuando el componente se monta
    MockApi.getProducts().then(setAvailableProducts).catch(e => console.error("Error loading products:", e));
  }, [fetchData]);
  
    // Actions
  const handleAddItem = async () => {
    // Abre el modal para seleccionar productos
    setIsProductModalOpen(true);
  };

  const handleProductSelection = async () => {
    if (!selectedProductId || !quote) return;

    const selectedProduct = availableProducts.find(p => p.id_product === selectedProductId);
    if (!selectedProduct) {
      setToast({ message: 'Producto seleccionado no encontrado.', type: 'error' });
      return;
    }

    setProcessing(true);

    const apiEndpoint = 'https://service.computeksa.com/webhook/api/products-selected';
    
    // El id_tenant se obtiene de la cotización
    const tenantId = quote.id_tenant;

    const payload = {
      id_cotizacion: quote.id_cotizacion,
      id_tenant: tenantId,
      // Datos del producto seleccionado
      descripcion: selectedProduct.descripcion, 
      cantidad: itemQuantity,
      precio_unitario: selectedProduct.precio_unitario,
      subtotal: itemQuantity * selectedProduct.precio_unitario,
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
        // Si el servidor responde con un error, lo capturamos
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al conectar con el servidor.');
      }

      // Si todo va bien...
      setToast({ message: 'Artículo añadido con éxito.', type: 'success' });
      setIsProductModalOpen(false); // Cierra el modal
      setSelectedProductId(null); // Resetea el producto seleccionado
      setItemQuantity(1); // Resetea la cantidad
      fetchData(); // Vuelve a cargar los datos de la cotización

    } catch (e: any) {
      setToast({ message: e.message || 'Error al añadir el artículo.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateItem = async (itemId: string, newCantidad: number, newPrecioUnitario: number) => {
    if (!quote) return;
    setProcessing(true);
    try {
      const updatedSubtotal = newCantidad * newPrecioUnitario;
      await MockApi.updateQuoteItem(itemId, { cantidad: newCantidad, precio_unitario: newPrecioUnitario, subtotal: updatedSubtotal });
      setToast({ message: 'Artículo actualizado.', type: 'success' });
      fetchData(); // Recargar datos para ver los cambios
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
        if (!quote) return;
        setProcessing(true);
        try {
          await MockApi.deleteQuoteItem(itemId);
          setToast({ message: 'Artículo eliminado.', type: 'success' });
          fetchData(); // Recargar datos para ver los cambios
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
    if (!quote) return;
    setProcessing(true);
    // Call API (n8n trigger)
    const updatedQuote = await MockApi.generatePDF(quote.id_cotizacion);
    setQuote(updatedQuote);
    setProcessing(false);
  };

  const handleSendQuote = async () => {
    if (!quote) return;
    setProcessing(true);
    const updatedQuote = await MockApi.sendQuote(quote.id_cotizacion);
    setQuote(updatedQuote);
    setProcessing(false);
  };

  const handleDecisionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(!quote) return;
    const newDecision = e.target.value as UserDecision;
    await MockApi.updateDecision(quote.id_cotizacion, newDecision);
    // Optimistic update
    setQuote({...quote, estado_decision: newDecision});
  };


  if (loading) return <div className="p-8 text-center">Cargando detalles...</div>;
  if (!quote) return <div className="p-8 text-center text-red-500">Cotización no encontrada</div>;

  const hasItems = items.length > 0;
  const isPending = !['ENVIADO', 'APROBADO'].includes(quote.estado);
  const isReady = quote.estado === 'LISTO PARA ENVIAR';
  const isSent = quote.estado === 'ENVIADO';
  
  const showGenerateBtn = hasItems && (isPending || !quote.file_generado);
  const showSendBtn = isReady; 

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />

      {/* Product Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Seleccionar Artículo</h2>
              <button onClick={() => setIsProductModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Producto</label>
                <select 
                  value={selectedProductId || ''} 
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required 
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Producto --</option>
                  {availableProducts.map(p => (
                    <option key={p.id_product} value={p.id_product}>
                      {p.descripcion} ({p.codigo})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cantidad</label>
                <input 
                  type="number" 
                  value={itemQuantity} 
                  onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                  min="1" 
                  required 
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2 px-6 py-4 border-t bg-slate-50">
              <button 
                type="button" 
                onClick={() => setIsProductModalOpen(false)} 
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >Cancelar</button>
              <button 
                type="button" 
                onClick={handleProductSelection} 
                disabled={processing || !selectedProductId}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center"
              >
                {processing && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                Añadir al Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center space-x-3 mb-1">
             <button onClick={() => navigate('/quotes')} className="text-slate-400 hover:text-slate-600">
               <i className="fa-solid fa-arrow-left"></i>
             </button>
             <h1 className="text-2xl font-bold text-slate-800">Cotización #{quote.formatted_no_cotizacion}</h1>
           </div>
           <p className="text-slate-500 ml-7">{quote.nombre_cotizacion}</p>
        </div>
        
        <div className="flex items-center space-x-3">
           <div className="text-right mr-4">
             <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Estado</p>
             <span className="text-sm font-bold text-slate-600">
               {quote.estado}
             </span>
           </div>
           
           {showGenerateBtn && (
             <button 
               onClick={handleGeneratePDF}
               disabled={processing}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition-all">
               {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-file-pdf mr-2"></i>}
               Generar PDF v{quote.version + 1}
             </button>
           )}

           {showSendBtn && (
             <button 
               onClick={handleSendQuote}
               disabled={processing}
               className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition-all">
               {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
               Enviar al Cliente
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Items Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700">Artículos de la Cotización</h3>
              {isPending && (
                <button onClick={handleAddItem} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded transition-colors">
                  <i className="fa-solid fa-plus mr-1"></i> Agregar Artículo
                </button>
              )}
            </div>
            
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">No hay artículos agregados. Agrega uno para generar el PDF.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-6 py-3">Descripción</th>
                    <th className="px-6 py-3 text-right">Cant.</th>
                    <th className="px-6 py-3 text-right">Precio U.</th>
                    <th className="px-6 py-3 text-right">Subtotal</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, index) => {
                    // Convertir precios de string a número para los cálculos.
                    // Esto es clave porque la API devuelve los valores monetarios como texto.
                    const cantidad = parseFloat(item.cantidad as any) || 0;
                    const precioUnitario = parseFloat((item.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
                    const subtotal = cantidad * precioUnitario;

                    return (
                      <tr key={item.id_articulo_cot}>
                        <td className="px-4 py-3 text-slate-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.codigo}</td>
                        <td className="px-6 py-3 font-medium text-slate-700">{item.descripcion}</td>
                        <td className="px-6 py-3 text-right">
                          <input 
                              type="number"
                              defaultValue={cantidad}
                              onBlur={(e) => handleUpdateItem(item.id_articulo_cot, parseInt(e.target.value) || 1, precioUnitario)}
                              min="1"
                              className="w-20 px-2 py-1 border rounded-md text-right"
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <input 
                              type="number"
                              defaultValue={precioUnitario.toFixed(2)}
                              onBlur={(e) => handleUpdateItem(item.id_articulo_cot, cantidad, parseFloat(e.target.value) || 0)}
                              step="0.01"
                              className="w-28 px-2 py-1 border rounded-md text-right"
                          />
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-800">{subtotal.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteItem(item.id_articulo_cot)}
                            className="text-red-500 hover:text-red-700 p-2"
                            title="Eliminar artículo"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-6 py-3 text-right font-bold text-slate-600">Total</td>
                    <td className="px-6 py-3 text-right font-bold text-brand-700 text-lg">
                      {items.reduce((acc, curr) => {
                        const cantidad = parseFloat(curr.cantidad as any) || 0;
                        const precioUnitario = parseFloat((curr.precio_unitario as any).replace(/[^0-9.-]+/g,"")) || 0;
                        return acc + (cantidad * precioUnitario);
                      }, 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Files Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-700 mb-4">Documentos</h3>
            <div className="flex flex-wrap gap-4">
              {quote.file_generado ? (
                <a href={quote.file_generado} target="_blank" rel="noreferrer" className="flex items-center p-3 border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-all group">
                  <div className="w-10 h-10 bg-red-100 text-red-500 rounded flex items-center justify-center mr-3">
                    <i className="fa-solid fa-file-pdf text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-brand-700">Cotización Generada (v{quote.version})</p>
                    <p className="text-xs text-slate-400">Clic para ver</p>
                  </div>
                </a>
              ) : (
                <div className="text-sm text-slate-400 flex items-center">
                  <i className="fa-solid fa-info-circle mr-2"></i> El PDF aún no ha sido generado.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Meta Info & Decision */}
        <div className="space-y-6">
          
          {/* Client & Contact Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información Principal</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex items-start">
                <i className="fa-solid fa-building text-slate-400 w-5 text-center mr-3 mt-1"></i>
                <div>
                  <span className="text-slate-500 block">Cliente:</span>
                  <Link to={`/client-companies/${quote.id_client_company}`} className="text-brand-600 font-bold hover:underline">
                    {quote.client_company_name}
                  </Link>
                </div>
              </div>
              <div className="flex items-start">
                 <i className="fa-solid fa-user text-slate-400 w-5 text-center mr-3 mt-1"></i>
                 <div>
                   <span className="text-slate-500 block">Contacto:</span>
                   <Link to={`/client-contacts/${quote.id_contact}`} className="text-slate-700 font-medium hover:text-brand-600 hover:underline">
                     {quote.contact_name}
                   </Link>
                 </div>
              </div>
               <div className="flex items-start">
                <i className="fa-solid fa-user-tie text-slate-400 w-5 text-center mr-3 mt-1"></i>
                <div>
                  <span className="text-slate-500 block">Vendedor:</span>
                  <span className="text-slate-700 font-medium">{quote.owner_name}</span>
                </div>
              </div>
              <div className="flex items-start">
                <i className="fa-solid fa-calendar-day text-slate-400 w-5 text-center mr-3 mt-1"></i>
                <div>
                  <span className="text-slate-500 block">Fecha Emisión:</span>
                  <span className="text-slate-700 font-medium">{new Date(quote.fecha_emision).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Associated Deal Card */}
          {quote.id_trato && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Trato Asociado</h3>
              <div className="flex items-start">
                 <i className="fa-solid fa-handshake text-slate-400 w-5 text-center mr-3 mt-1"></i>
                 <div>
                    <Link to={`/deals/${quote.id_trato}`} className="text-brand-600 font-bold hover:underline">
                      {quote.nombre_trato}
                    </Link>
                    <p className="text-xs text-slate-400">Clic para ver detalles del trato</p>
                 </div>
              </div>
            </div>
          )}

          {/* Decision Card (Only visible if sent) */}
          {isSent && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-purple-500">
              <h3 className="font-bold text-slate-800 mb-2">Decisión del Cliente</h3>
              <p className="text-sm text-slate-500 mb-4">Registra la respuesta del cliente para actualizar el Trato automáticamente.</p>
              
              <label className="block text-xs font-semibold text-slate-500 mb-1">Estado Decisión</label>
              <select 
                value={quote.estado_decision || ''}
                onChange={handleDecisionChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
              >
                <option value={UserDecision.PENDING}>Pendiente de Respuesta</option>
                <option value={UserDecision.APPROVED}>APROBADO (Cerrado Ganado)</option>
                <option value={UserDecision.REJECTED}>RECHAZADO (Cerrado Perdido)</option>
                <option value={UserDecision.NEGOCIAR}>Negociación</option>
              </select>
            </div>
          )}

          {/* Commercial Conditions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Condiciones Comerciales</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Validez de la Oferta:</span>
                  <span className="text-slate-700 font-medium">{quote.validez_oferta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiempo de Entrega:</span>
                  <span className="text-slate-700 font-medium">{quote.tiempo_entrega}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Garantía:</span>
                  <span className="text-slate-700 font-medium">{quote.garantia}</span>
                </div>
              </div>
          </div>
          
          {/* Notes */}
          {quote.nota && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notas</h3>
               <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.nota}</p>
             </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default QuoteDetail;