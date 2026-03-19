import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Quote, QuoteItem, UserDecision, Product, QuoteStatus, PdfVersion, ProductType } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { useEmailSendPolicy } from '../../src/hooks/useEmailSendPolicy';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import AppModalViewport from '../../components/AppModalViewport';

// --- TIPOS EXTENDIDOS ---
interface Attachment {
  nombre: string;
  url: string;
  tipo: string;
  fecha: string;
}

interface SentLog {
  id_sent: string;
  sent_at_fmt: string;
  sent_by_name?: string;
  sent_to: string;
  sent_cc?: string;
  sent_from?: string;
  subject: string;
  method: string;
  email_policy?: string;
  version_enviada?: number | null;
  sent_file_url?: string;
  attachments?: Attachment[];
  message_snapshot?: string;
  message_content?: string;
  operator_name?: string;
  operator_avatar?: string;
  creator_name?: string;
}

interface QuoteExtended extends Quote {
  url_cotizacion_manual?: string | null;
  archivos_adjuntos?: Attachment[];
  sent_history?: SentLog[];
  creator_name?: string;
  deal_detail?: {
    id?: string;
    name?: string;
    value?: string;
    owner_id?: string;
    status_name?: string;
    status_color?: string;
  };
}

const getAvatarColor = (name: string = '') => {
  const colors = [
    { bg: '#F0E6E6', text: '#A67C7C' },
    { bg: '#F5EAF0', text: '#B397AA' },
    { bg: '#EDE4F5', text: '#9B7DB0' },
    { bg: '#E8E0F0', text: '#8B7BA3' },
    { bg: '#E1E8F5', text: '#7A8FB5' },
    { bg: '#DFF0ED', text: '#7BA89C' },
    { bg: '#E9F0E8', text: '#7FA08A' },
    { bg: '#EEF2E7', text: '#92A680' },
    { bg: '#F5F2E1', text: '#B8AC5B' },
    { bg: '#F7EFEA', text: '#B88263' },
    { bg: '#EFE8E4', text: '#8B7B6F' },
    { bg: '#E8E8E8', text: '#707070' },
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string = '', max = 2) => {
  const parts = name.trim().split(' ').filter(Boolean);
  const initials = parts.map(p => p[0]).join('').toUpperCase();
  return initials.substring(0, max) || 'U';
};

// --- HELPER: Selector de Estado ---
const StatusSelector: React.FC<{
  currentStatusId: string;
  statuses: QuoteStatus[];
  onSelect: (id: string) => void;
  disabled: boolean;
}> = ({ currentStatusId, statuses, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const current = statuses.find(s => s.id_status === currentStatusId) || {
    name: 'Desconocido', color: '#94a3b8', icon: 'fa-circle'
  };

  const currentIndex = statuses.findIndex(s => s.id_status === currentStatusId);
  const itemsAbove = currentIndex > 0 ? statuses.slice(0, currentIndex) : [];
  const itemsBelow = currentIndex >= 0 && currentIndex < statuses.length - 1
    ? statuses.slice(currentIndex + 1)
    : currentIndex === -1
      ? statuses
      : [];

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
            {itemsAbove.map((status) => (
              <button
                key={status.id_status}
                onClick={() => { onSelect(status.id_status); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors border-b border-slate-50 last:border-0"
              >
                <i className={`${status.icon || 'fa-solid fa-circle'} text-[10px]`} style={{ color: status.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{status.name}</span>
              </button>
            ))}

            {currentIndex >= 0 && (
              <div className="w-full text-left px-4 py-2.5 bg-slate-50 border-y border-slate-200 flex items-center gap-2 opacity-60 cursor-not-allowed">
                <i className={`${current.icon || 'fa-solid fa-circle'} text-[10px]`} style={{ color: current.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{current.name}</span>
                <i className="fa-solid fa-check text-[9px] text-slate-400 ml-auto"></i>
              </div>
            )}

            {itemsBelow.map((status) => (
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

// --- HELPER: Fila de artículo con estado local para edición reactiva ---
const ItemRow: React.FC<{
  item: QuoteItem;
  canEdit: boolean;
  isItemsLocked: boolean;
  isManualQuoteActive: boolean;
  onUpdate: (id: string, cant: number, precio: number) => void;
  onDelete: (id: string) => void;
  convertDriveUrl: (url: string) => string;
}> = ({ item, canEdit, isItemsLocked, isManualQuoteActive, onUpdate, onDelete, convertDriveUrl }) => {
  const parsePrecio = (val: number | string) =>
    parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;

  const [localCant, setLocalCant] = useState<number>(parseFloat(item.cantidad as any) || 0);
  const [localPrecio, setLocalPrecio] = useState<number>(parsePrecio(item.precio_unitario));

  // Sincronizar si los datos del servidor cambian
  useEffect(() => {
    setLocalCant(parseFloat(item.cantidad as any) || 0);
    setLocalPrecio(parsePrecio(item.precio_unitario));
  }, [item.cantidad, item.precio_unitario]);

  const itemId = item.id_articulo_cot || item.id_quote_item || '';

  return (
    <tr className="group hover:bg-slate-50/60 transition-colors">
      <td className="px-6 py-4">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
            {item.imagen_url
              ? <img src={convertDriveUrl(item.imagen_url)} className="w-full h-full object-cover" alt={item.descripcion} />
              : <i className="fa-solid fa-box text-slate-300"></i>}
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-bold text-slate-700 text-[13px] line-clamp-2">{item.descripcion}</span>
            {(item.formatted_product_code || item.codigo) && <span className="text-[10px] text-slate-400 font-mono mt-0.5">{item.formatted_product_code || item.codigo}</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-right align-middle">
        <input
          type="number"
          min="1"
          disabled={!canEdit || isItemsLocked}
          value={localCant}
          onChange={(e) => setLocalCant(parseFloat(e.target.value) || 0)}
          onBlur={(e) => {
            const val = Math.max(1, parseFloat(e.target.value) || 1);
            setLocalCant(val);
            onUpdate(itemId, val, localPrecio);
          }}
          className="w-14 text-right bg-transparent hover:bg-white border border-transparent hover:border-slate-200 rounded px-1 py-1 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 font-medium transition-all"
        />
      </td>
      <td className="px-4 py-4 text-right align-middle">
        <input
          type="number"
          step="0.01"
          min="0"
          disabled={!canEdit || isItemsLocked}
          value={localPrecio}
          onChange={(e) => setLocalPrecio(parseFloat(e.target.value) || 0)}
          onBlur={(e) => {
            const val = parseFloat(e.target.value) || 0;
            setLocalPrecio(val);
            onUpdate(itemId, localCant, val);
          }}
          className="w-20 text-right bg-transparent hover:bg-white border border-transparent hover:border-slate-200 rounded px-1 py-1 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 font-medium transition-all"
        />
      </td>
      <td className="px-6 py-4 text-right font-bold text-slate-700 align-middle tabular-nums">
        {(localCant * localPrecio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </td>
      <td className="px-2 text-center align-middle">
        {canEdit && !isItemsLocked && !isManualQuoteActive && (
          <button
            onClick={() => onDelete(itemId)}
            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50"
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
        )}
      </td>
    </tr>
  );
};

// --- COMPONENTE PRINCIPAL ---
const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { policy: emailPolicy, isLoading: emailPolicyLoading } = useEmailSendPolicy(user);

  // --- ESTADOS DE DATOS ---
  const [quote, setQuote] = useState<QuoteExtended | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  
  // Data auxiliar
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  // --- ESTADOS UI & LOADING ---
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); // Procesos generales (Enviar correo, generar PDF)
  const [generatingPDF, setGeneratingPDF] = useState(false); // Específico para generar
  const [sendingQuoteId, setSendingQuoteId] = useState<string | undefined | null>(null); // Específico para enviar (ID de versión o undefined para manual)
  
  // Estados específicos de carga para adjuntos
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingAttachmentUrl, setDeletingAttachmentUrl] = useState<string | null>(null);

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Historial: vista rápida/detallada
  const [historyCondensed, setHistoryCondensed] = useState(false);
  const historyDefaultSetRef = useRef(false);
  const [expandedSentIds, setExpandedSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!historyDefaultSetRef.current && quote?.sent_history) {
      if (quote.sent_history.length > 5) {
        setHistoryCondensed(true);
      }
      historyDefaultSetRef.current = true;
    }
  }, [quote?.sent_history]);

  // Inputs de Archivos (Refs)
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  // Form States (Product Modal) - Improved multi-selection
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map()); // Map<id_product, quantity>
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>(''); // '', 'BIEN', 'SERVICIO'
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<any>({
    codigo: '', descripcion: '', tipo: 'BIEN', categoria: '', precio_unitario: 0, imagen_url: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // --- HELPER FUNCTIONS ---
  const getColorFromName = (name: string) => {
    const colors = [
      'from-red-500 to-pink-600',
      'from-orange-500 to-amber-600',
      'from-yellow-500 to-orange-600',
      'from-green-500 to-emerald-600',
      'from-blue-500 to-cyan-600',
      'from-indigo-500 to-purple-600',
      'from-violet-500 to-purple-600',
      'from-pink-500 to-rose-600',
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // --- HELPER: Filtrar productos disponibles ---
  const getFilteredProducts = useCallback(() => {
    if (!availableProducts || availableProducts.length === 0) return [];
    
    return availableProducts.filter(p => {
      // Búsqueda por código o descripción
      const matchesSearch = !productSearchQuery || 
        p.codigo?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(productSearchQuery.toLowerCase());
      
      // Filtro por tipo
      const matchesType = !productTypeFilter || p.tipo === productTypeFilter;
      
      // Filtro por categoría
      const matchesCategory = !productCategoryFilter || p.categoria === productCategoryFilter;
      
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [availableProducts, productSearchQuery, productTypeFilter, productCategoryFilter]);

  // --- HELPER: Obtener categorías únicas ---
  const getUniqueCategories = useCallback(() => {
    if (!availableProducts || availableProducts.length === 0) return [];
    const categories = availableProducts
      .map(p => p.categoria)
      .filter((cat): cat is string => !!cat && cat.trim() !== '');
    return Array.from(new Set(categories)).sort();
  }, [availableProducts]);

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    
    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/detail?id_cotizacion=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      
      if (!response.ok) {
        if (response.status === 404) setQuote(null);
        else throw new Error('Error al cargar.');
        return;
      }

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;
      const q: any = Array.isArray(parsed) ? parsed[0] : parsed;

      if (q) {
        setQuote(q);
        
        // Load collaborators from response
        if (q?.collaborators && Array.isArray(q.collaborators)) {
          const mapped = q.collaborators.map((u: any) => ({
            id_user: u.id_user,
            name: u.name || u.name_user || u.full_name || u.email || 'Usuario',
            avatar: u.avatar || u.avatar_url || null,
            permission_level: (u.permission_level || '').toUpperCase() === 'NONE' ? 'BLOCKED' : u.permission_level,
            rol_user: u.rol_user,
            is_owner: u.is_owner
          }));
          setShareCollaborators(mapped);
        }
        
        // Mantener el orden original de los items, solo actualizar datos
        setItems(prevItems => {
          if (!q.items || q.items.length === 0) return q.items || [];
          if (prevItems.length === 0) return q.items;
          
          // Crear un mapa de los nuevos items por ID para lookup rápido
          const newItemsMap = new Map<string | undefined, QuoteItem>(
            q.items.map((item: any) => [
              item.id_articulo_cot || item.id_quote_item,
              item as QuoteItem
            ])
          );
          
          // Mantener el orden de prevItems, actualizando solo los datos
          const orderedItems = prevItems
            .map(oldItem => {
              const id = oldItem.id_articulo_cot || oldItem.id_quote_item;
              return newItemsMap.get(id) || oldItem;
            })
            .filter(item => {
              const id = item.id_articulo_cot || item.id_quote_item;
              return newItemsMap.has(id);
            });
          
          // Agregar items nuevos que no existían antes al final
          q.items.forEach((newItem: any) => {
            const id = newItem.id_articulo_cot || newItem.id_quote_item;
            const existsInOld = prevItems.some(
              oldItem => (oldItem.id_articulo_cot || oldItem.id_quote_item) === id
            );
            if (!existsInOld) {
              orderedItems.push(newItem);
            }
          });
          
          return orderedItems;
        });
        setQuoteStatuses(q.available_statuses || []);
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

  // --- HANDLERS AUXILIARES ---
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('images.weserv.nl')) return url;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?id=${match[1]}&export=view`)}&n=-1`;
    }
    return url;
  };

  const getGoogleDrivePdfUrl = (url: string): string => {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?id=${match[1]}&export=view`;
    }
    return url;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'fa-file-pdf text-red-500';
    if (mimeType.includes('image')) return 'fa-file-image text-purple-500';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'fa-file-excel text-green-500';
    if (mimeType.includes('word')) return 'fa-file-word text-blue-500';
    return 'fa-file-lines text-slate-400';
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

  // --- HANDLERS: ESTADO ---
  const handleStatusChange = (newStatusId: string) => {
    if (!quote) return;

    // Prevenir cambio al mismo estado
    if (newStatusId === quote.id_quote_status) {
      return;
    }

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
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/quotes`, {
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
            if (quote) {
                setQuote({ 
                    ...quote, 
                    id_quote_status: newStatusId,
                    status_detail: newStatus as any 
                });
            }
            setToast({ message: 'Estado actualizado.', type: 'success' });
            fetchData();
          } else throw new Error();
        } catch {
          setToast({ message: 'Error al actualizar estado.', type: 'error' });
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  // --- HANDLERS: COTIZACIÓN MANUAL ---
  const handleUploadManualQuote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quote || !user) return;
    
    if (file.type !== 'application/pdf') {
        setToast({ message: 'Solo se permiten archivos PDF.', type: 'error' });
        return;
    }

    setProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('id_cotizacion', quote.id_cotizacion);
    formData.append('id_tenant', user.id_tenant);
    formData.append('id_user', user.id_user);

    try {
        const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/upload-manual`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error('Error al subir archivo');
        
        setToast({ message: 'Cotización manual subida exitosamente.', type: 'success' });
        await fetchData();
    } catch (err) {
        setToast({ message: 'No se pudo subir la cotización.', type: 'error' });
    } finally {
        setProcessing(false);
        if (manualFileInputRef.current) manualFileInputRef.current.value = '';
    }
  };

  const handleDeleteManualQuote = () => {
    if (!quote || !user) return;

    setConfirmState({
        isOpen: true,
        title: 'Eliminar Cotización Manual',
        message: '¿Estás seguro? Al eliminarla, el sistema volverá a mostrar las versiones generadas automáticamente.',
        isDestructive: true,
        onConfirm: async () => {
            setConfirmState(prev => ({ ...prev, isOpen: false }));
            setProcessing(true);
            try {
                const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/manual/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_cotizacion: quote.id_cotizacion,
                        id_tenant: user.id_tenant,
                        id_user: user.id_user
                    })
                });

                if (!res.ok) throw new Error();
                setToast({ message: 'Cotización manual eliminada.', type: 'success' });
                await fetchData();
            } catch {
                setToast({ message: 'Error al eliminar.', type: 'error' });
            } finally {
                setProcessing(false);
            }
        }
    });
  };

  // --- HANDLERS: ARCHIVOS ADJUNTOS (CON INDICADORES) ---
  const handleUploadAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !quote || !user) return;

    const currentAttachments = quote.archivos_adjuntos || [];
    if (currentAttachments.length + files.length > 3) {
        setToast({ message: 'Límite alcanzado: Máximo 3 adjuntos.', type: 'error' });
        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        return;
    }

    setUploadingAttachments(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    formData.append('id_cotizacion', quote.id_cotizacion);
    formData.append('id_tenant', user.id_tenant);
    formData.append('id_user', user.id_user);

    try {
        const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/attachments/add`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error();
        setToast({ message: 'Adjuntos subidos correctamente.', type: 'success' });
        await fetchData();
    } catch (err) {
        setToast({ message: 'Error al subir archivos.', type: 'error' });
    } finally {
        setUploadingAttachments(false);
        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = (fileUrl: string) => {
    if (!quote || !user) return;

    setConfirmState({
        isOpen: true,
        title: 'Eliminar Adjunto',
        message: '¿Seguro que deseas eliminar este archivo?',
        isDestructive: true,
        onConfirm: async () => {
            setConfirmState(prev => ({ ...prev, isOpen: false }));
            setDeletingAttachmentUrl(fileUrl);
            try {
                const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/attachments/remove`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_cotizacion: quote.id_cotizacion,
                        id_tenant: user.id_tenant,
                        url_a_eliminar: fileUrl
                    })
                });

                if (!res.ok) throw new Error();
                setToast({ message: 'Adjunto eliminado.', type: 'success' });
                await fetchData();
            } catch {
                setToast({ message: 'Error al eliminar adjunto.', type: 'error' });
            } finally {
                setDeletingAttachmentUrl(null);
            }
        }
    });
  };

  // --- HANDLERS: PRODUCTOS E ITEMS ---
  const handleAddItem = async () => {
    if (!user?.id_tenant) return;
    setProcessing(true);
    try {
      const [pRes, tRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type?id_tenant=${user.id_tenant}`)
      ]);
      
      // Parsear respuestas validando que no estén vacías
      let products = [];
      let types = [];
      
      if (pRes.ok) {
        const pText = await pRes.text();
        if (pText && pText.trim() !== '' && pText !== 'null') {
          try {
            products = JSON.parse(pText) || [];
          } catch (e) {
            console.error('Error parsing products:', e);
          }
        }
      }
      
      if (tRes.ok) {
        const tText = await tRes.text();
        if (tText && tText.trim() !== '' && tText !== 'null') {
          try {
            types = JSON.parse(tText) || [];
          } catch (e) {
            console.error('Error parsing product types:', e);
          }
        }
      }
      
      setAvailableProducts(Array.isArray(products) ? products : []);
      setProductTypes(Array.isArray(types) ? types : []);
      
      setIsCreatingProduct(false);
      setSelectedProducts(new Map());
      setProductSearchQuery('');
      setProductTypeFilter('');
      setProductCategoryFilter('');
      setIsProductModalOpen(true);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      // Abrir el modal de todos modos, aunque haya error
      setAvailableProducts([]);
      setProductTypes([]);
      setIsCreatingProduct(false);
      setSelectedProducts(new Map());
      setProductSearchQuery('');
      setProductTypeFilter('');
      setProductCategoryFilter('');
      setIsProductModalOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleProductSelection = async () => {
    if (selectedProducts.size === 0 || !quote || !user) return;

    setProcessing(true);
    try {
      // Procesar todos los productos seleccionados en paralelo
      const addPromises = Array.from(selectedProducts.entries()).map(async ([productId, quantity]) => {
        const prod = availableProducts.find(p => p.id_product === productId);
        if (!prod) return null;

        const precio = parseFloat(String(prod.precio_unitario).replace(/[^0-9.-]+/g,"")) || 0;
        
        return apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products-selected`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cotizacion: quote.id_cotizacion,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            descripcion: prod.descripcion, 
            cantidad: quantity,
            precio_unitario: precio,
            subtotal: quantity * precio,
            id_producto: prod.id_product
          }),
        });
      });

      const results = await Promise.all(addPromises);
      const allSuccess = results.every(res => res && res.ok);
      
      if (allSuccess) {
        const count = selectedProducts.size;
        setToast({ message: `${count} artículo${count > 1 ? 's' : ''} añadido${count > 1 ? 's' : ''}.`, type: 'success' });
        setIsProductModalOpen(false);
        setSelectedProducts(new Map());
        fetchData();
      } else {
        throw new Error('Algunos productos no pudieron agregarse');
      }
    } catch {
      setToast({ message: 'Error al añadir artículos.', type: 'error' });
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

      const createRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products`, { method: 'POST', body: formData });
      if (!createRes.ok) throw new Error('Error al crear producto');

      const pRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products?id_tenant=${user.id_tenant}`);
      const products = await pRes.json();
      const created = products.find((p: any) => p.descripcion === newProduct.descripcion);
      
      if (created) {
        setAvailableProducts(products);
        // Add the newly created product to selectedProducts with its temporary quantity
        const newSelectedProducts = new Map(selectedProducts);
        newSelectedProducts.set(created.id_product, newProduct.tempQuantity || 1);
        setSelectedProducts(newSelectedProducts);
        
        const precio = parseFloat(newProduct.precio_unitario) || 0;
        
        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products-selected`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cotizacion: quote?.id_cotizacion,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            descripcion: created.descripcion,
            cantidad: newProduct.tempQuantity || 1, // Use tempQuantity for new product
            precio_unitario: precio,
            subtotal: (newProduct.tempQuantity || 1) * precio, // Use tempQuantity for new product
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
      await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/update`, {
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
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/delete`, {
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

  // --- HANDLERS: PDF Y ENVIO ---
  const handleGeneratePDF = async () => {
    if (!quote || !user) return;
    setGeneratingPDF(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/generate-pdf`, {
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
      setGeneratingPDF(false);
    }
  };

  const handleSendQuote = async (idVersion?: string) => {
    if (!quote || !user) return;
    if (emailPolicyLoading) {
      setToast({ message: 'Validando configuracion de correo...', type: 'error' });
      return;
    }
    if (emailPolicy.status === 'blocked') {
      setConfirmState({
        isOpen: true,
        title: 'Configura el envio de correos',
        message: emailPolicy.reason,
        confirmText: 'Ir a Configuracion',
        cancelText: 'Cerrar',
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          if (emailPolicy.ctaPath) navigate(emailPolicy.ctaPath);
        }
      });
      return;
    }
    const destEmail = quote.contact_detail?.email || 'el cliente';
    const isManual = idVersion === undefined && quote.url_cotizacion_manual;
    const senderLabel = emailPolicy.senderLabel || 'Cuenta';
    const senderBadgeClass = emailPolicy.status === 'corporate'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    const configPath = emailPolicy.status === 'corporate'
      ? '/app/workspace-settings'
      : '/app/integrations';

    setConfirmState({
        isOpen: true,
        title: 'Enviar Cotización',
        message: (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ¿Enviar {isManual ? 'la cotizacion manual' : 'la version seleccionada'} a {destEmail}?
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${senderBadgeClass}`}>
              <i className="fa-solid fa-paper-plane text-[9px]"></i>
              Enviado desde: {senderLabel}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="relative group">
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
                  <i className="fa-solid fa-circle-info text-slate-400"></i>
                  Info de envio
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                  <div className="bg-slate-900 text-white text-[11px] px-3 py-2 rounded-lg shadow-lg">
                    Si deseas cambiar esta configuracion puedes hacerlo en {configPath}.
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        ),
        isDestructive: false,
        onConfirm: async () => {
            setConfirmState(prev => ({...prev, isOpen: false}));
            setSendingQuoteId(idVersion ?? undefined);
            try {
            const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                id_cotizacion: quote.id_cotizacion,
                id_user: user.id_user,
                id_tenant: user.id_tenant,
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
            setSendingQuoteId(null);
            }
        }
    });
  };

  const openShareModal = async () => {
    if (!quote) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share?id_cotizacion=${quote.id_cotizacion}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list
        .map((u: any) => {
          const level = (u.permission_level || '').toUpperCase();
          return {
          id_user: u.id_user,
          name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
          avatar: u.avatar_url || u.avatar || null,
          permission_level: level === 'NONE' ? 'BLOCKED' : level,
          rol_user: u.rol_user
        };
      });
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
    setIsShareOpen(true);
  };

  const handleDecisionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if(!quote || !user) return;
    const newDecision = e.target.value as UserDecision;
    try {
      await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/decision`, {
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
    <div className="flex h-full items-center justify-center">
      <BrandSpinner size="xl" />
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
  const canSendEmail = emailPolicy.status === 'corporate' || emailPolicy.status === 'personal';
  const sendDisabled = !canSendEmail || emailPolicyLoading;
  const sendBlockedReason = !canSendEmail ? emailPolicy.reason : '';
  const isSent = quote.estado_decision !== UserDecision.PENDING;
  
  const currentStatusObj = (quote as any).status_detail || quoteStatuses.find(s => s.id_status === quote.id_quote_status);
  const currentStatusCategory = currentStatusObj?.status_category || currentStatusObj?.category;
  const isItemsLocked = currentStatusCategory === 'ACCEPTED' || currentStatusCategory === 'REJECTED';
  
  const isManualQuoteActive = !!quote.url_cotizacion_manual;

  return (
    <div className="w-full px-4 md:px-6 pb-20 animate-fade-in font-sans">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
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
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
                <div className="text-left lg:text-right w-full lg:w-auto">
                    <div className="text-3xl font-mono font-bold text-slate-800 tracking-tight">
                        {quote.total}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    <StatusSelector 
                        currentStatusId={quote.id_quote_status || ''} 
                        statuses={quoteStatuses} 
                        onSelect={handleStatusChange} 
                        disabled={!canEdit || processing}
                    />
                    {canEdit && (
                        <>
                            <button onClick={() => navigate(`/app/quotes/edit?id=${quote.id_cotizacion}`)} className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-all shadow-sm"><i className="fa-solid fa-pen"></i> Editar</button>
                            <button onClick={openShareModal} className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"><i className="fa-solid fa-share-nodes"></i> Compartir</button>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA (Info Meta) */}
        <div className="space-y-6">
            
            {/* Cliente */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    <div><h3 className="font-bold text-slate-800 text-sm">Cliente</h3></div>
                </div>
                <div className="p-6 space-y-5">
                    <div className="flex items-start gap-3 group">
                        {(() => {
                          const companyName = quote.company_detail?.name || 'Empresa';
                          const color = getAvatarColor(companyName);
                          return (
                            <div className="w-10 h-10 rounded-none flex items-center justify-center shrink-0 border" style={{ backgroundColor: color.bg, color: color.text, borderColor: color.text }}>
                              {getInitials(companyName)}
                            </div>
                          );
                        })()}
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</p>
                            <Link to={`/app/client-companies/${quote.id_client_company}`} className="font-bold text-slate-800 text-sm hover:text-blue-600 hover:underline block truncate">{quote.company_detail?.name || 'Empresa desconocida'}</Link>
                            {quote.company_detail?.ruc && (<p className="text-xs text-slate-500 mt-0.5">RUC: {quote.company_detail.ruc}</p>)}
                            {quote.company_detail?.address && (<div className="flex items-start gap-1 mt-1 text-xs text-slate-500"><i className="fa-solid fa-location-dot mt-0.5 opacity-60"></i><span className="line-clamp-2">{quote.company_detail.address}</span></div>)}
                        </div>
                    </div>
                    <div className="h-px bg-slate-50 w-full"></div>
                    {quote.id_contact && (
                        <div className="flex items-start gap-3 group">
                            {(() => {
                              const contactName = quote.contact_detail?.full_name || 'Contacto';
                              const color = getAvatarColor(contactName);
                              return (
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border" style={{ backgroundColor: color.bg, color: color.text, borderColor: color.text }}>
                                  {getInitials(contactName)}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contacto</p>
                                <Link to={`/app/client-contacts/${quote.id_contact}`} className="font-bold text-slate-800 text-sm hover:text-brand-600 hover:underline block truncate">{quote.contact_detail?.full_name || 'Sin nombre'}</Link>
                                {quote.contact_detail?.position && (<p className="text-xs text-slate-500 italic truncate">{quote.contact_detail.position}</p>)}
                                {quote.contact_detail?.email && (<div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 truncate"><i className="fa-solid fa-envelope opacity-60"></i><span className="truncate">{quote.contact_detail.email}</span></div>)}
                                {quote.correos_adicionales && (<div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 truncate"><i className="fa-solid fa-envelope opacity-60"></i><span className="font-semibold">CC:</span><span className="truncate" title={quote.correos_adicionales}>{quote.correos_adicionales}</span></div>)}
                                {quote.contact_detail?.phone && (<div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500"><i className="fa-solid fa-phone opacity-60"></i><span>{quote.contact_detail.phone}</span></div>)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Archivos Adjuntos (Con Loaders) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Archivos Adjuntos</h3>
                        </div>
                    </div>
                    {canEdit && (
                        <>
                            <input 
                                type="file" 
                                multiple 
                                ref={attachmentInputRef} 
                                className="hidden" 
                                onChange={handleUploadAttachments} 
                            />
                            <button 
                                onClick={() => attachmentInputRef.current?.click()}
                                disabled={processing || uploadingAttachments}
                                className="w-7 h-7 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 flex items-center justify-center transition-colors disabled:opacity-50"
                            >
                                {uploadingAttachments ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-paperclip text-xs"></i>}
                            </button>
                        </>
                    )}
                </div>
                <div className="p-0">
                    {(!quote.archivos_adjuntos || quote.archivos_adjuntos.length === 0) ? (
                        <div className="text-center py-6 text-slate-400 text-xs italic">No hay archivos adjuntos.</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {quote.archivos_adjuntos.map((file, idx) => (
                                <div key={idx} className="px-6 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                            <i className={`fa-solid ${getFileIcon(file.tipo || 'file')} text-sm`}></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-700 truncate">{file.nombre}</p>
                                            <p className="text-[10px] text-slate-400">{file.fecha ? new Date(file.fecha).toLocaleDateString() : 'Reciente'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                            <i className="fa-solid fa-eye"></i>
                                        </a>
                                        {canEdit && (
                                            <button 
                                                onClick={() => handleDeleteAttachment(file.url)}
                                                disabled={deletingAttachmentUrl === file.url}
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100"
                                            >
                                                {deletingAttachmentUrl === file.url ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-trash-can"></i>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Trato Relacionado */}
            {quote.id_trato && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                  <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                  <div><h3 className="font-bold text-slate-800 text-sm">Trato Relacionado</h3></div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 break-words">
                      {quote.deal_detail?.name || 'Trato vinculado'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor</p>
                      <p className="text-xs font-bold text-slate-700 mt-1">
                        {quote.deal_detail?.value || quote.total || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</p>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold mt-1 border"
                        style={{
                          color: quote.deal_detail?.status_color || '#64748b',
                          borderColor: `${quote.deal_detail?.status_color || '#cbd5e1'}40`,
                          backgroundColor: `${quote.deal_detail?.status_color || '#64748b'}15`
                        }}
                      >
                        <i className="fa-solid fa-circle text-[8px]"></i>
                        {quote.deal_detail?.status_name || 'Sin estado'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      to={`/app/deals/${quote.id_trato}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-bold"
                    >
                      <i className="fa-solid fa-handshake"></i>
                      Ir al trato
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Condiciones Comerciales */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                    <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                    <div><h3 className="font-bold text-slate-800 text-sm">Condiciones</h3></div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Validez</p><p className="text-[13px] font-bold text-slate-700">{quote.validez_oferta || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Garantía</p><p className="text-[13px] font-bold text-slate-700">{quote.garantia || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Entrega</p><p className="text-[13px] font-bold text-slate-700">{quote.tiempo_entrega || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pago</p><p className="text-[13px] font-bold text-slate-700">{quote.condicion_pago || '-'}</p></div>
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

             {/* Decisión */}
            {isSent && (
                 <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-purple-100 flex items-center gap-3">
                        <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
                        <div><h3 className="font-bold text-purple-900 text-sm">Decisión del Cliente</h3></div>
                    </div>
                    <div className="p-6">
                        <select value={quote.estado_decision || ''} onChange={handleDecisionChange} disabled={!canEdit} className="w-full px-4 py-2 bg-white border border-purple-200 rounded-lg text-sm font-bold text-purple-800 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm cursor-pointer">
                            <option value={UserDecision.PENDING}>⏳ Pendiente de Respuesta</option>
                            <option value={UserDecision.APPROVED}>✅ APROBADO (Ganado)</option>
                            <option value={UserDecision.REJECTED}>❌ RECHAZADO (Perdido)</option>
                            <option value={UserDecision.NEGOCIAR}>💬 En Negociación</option>
                        </select>
                    </div>
                 </div>
            )}

            {/* Asignaciones */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Asignaciones</h3>
                </div>
                <button
                  onClick={openShareModal}
                  disabled={!canEdit}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                    canEdit
                    ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <i className="fa-solid fa-gear"></i>Gestionar
                </button>
              </div>
              <div className="p-4">
                {(quote as any).collaborators && (quote as any).collaborators.length > 0 ? (
                  <div className="space-y-2">
                    {[...(quote as any).collaborators].sort((a: any, b: any) => {
                      const getOrder = (collab: any) => {
                        const level = (collab.permission_level || '').toUpperCase();
                        if (level === 'OWNER' || collab.is_owner) return 0; // Creador primero
                        if (level === 'EDIT') return 1; // Principal segundo
                        if (level === 'VIEW') return 2; // Secundaria tercero
                        return 3; // Sin asignación al final
                      };
                      return getOrder(a) - getOrder(b);
                    }).map((collaborator: any) => (
                      <div key={collaborator.id_user} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {collaborator.avatar ? (
                            <img src={collaborator.avatar} alt={collaborator.name} className="w-6 h-6 rounded-full border border-slate-200" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {(collaborator.name || 'U').charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-700 truncate flex items-center gap-2">
                              {collaborator.name}
                              {(collaborator.rol_user || '').toLowerCase() === 'admin' && (
                                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] text-amber-500 leading-none align-middle" title="Control total por admin">
                                  <i className="fa-solid fa-star"></i>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                          {(() => {
                            const level = (collaborator.permission_level || '').toUpperCase();
                            if (level === 'OWNER') {
                              return (
                                <>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                    <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                    <i className="fa-solid fa-star text-[9px]"></i>Creador
                                  </span>
                                </>
                              );
                            }
                            if (collaborator.is_owner) {
                              return (
                                <>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                    <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                    <i className="fa-solid fa-star text-[9px]"></i>Creador
                                  </span>
                                </>
                              );
                            }
                            if (level === 'EDIT') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                </span>
                              );
                            }
                            if (level === 'VIEW') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-user text-[9px]"></i>Secundaria
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200 inline-flex items-center gap-1">
                                <i className="fa-regular fa-circle text-[9px]"></i>Sin asignación
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">Sin asignaciones</p>
                )}
              </div>
            </div>
        </div>

        {/* COLUMNA DERECHA (Contenido Principal) */}
        <div className="lg:col-span-2 space-y-6">

            {/* Artículos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-brand-500 rounded-full"></span>
                    <div><h3 className="font-bold text-slate-800 text-sm">Artículos</h3></div>
                  </div>
                  {canEdit && !isItemsLocked && !isManualQuoteActive && (
                    <button onClick={handleAddItem} className="text-[13px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-2"><i className="fa-solid fa-plus text-[10px]"></i> Agregar</button>
                  )}
                </div>
                <div className="overflow-x-auto">
                    {items.length === 0 ? (
                        <div className="p-12 text-center bg-slate-50/50"><p className="text-slate-500 text-sm">Sin artículos agregados.</p></div>
                    ) : (
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
                                {items.map((item, idx) => (
                                    <ItemRow
                                        key={item.id_articulo_cot || item.id_quote_item || idx}
                                        item={item}
                                        canEdit={canEdit}
                                        isItemsLocked={isItemsLocked}
                                        isManualQuoteActive={isManualQuoteActive}
                                        onUpdate={handleUpdateItem}
                                        onDelete={handleDeleteItem}
                                        convertDriveUrl={convertGoogleDriveUrl}
                                    />
                                ))}
                                <tr className="bg-slate-50 border-t border-slate-200">
                                    <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total General</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-800 text-xl font-mono tracking-tight">{quote.total}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Mensaje al Cliente */}
            {quote.mensaje && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                        <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                        <div><h3 className="font-bold text-slate-800 text-sm">Mensaje para el Cliente</h3></div>
                    </div>
                    <div className="p-6 bg-slate-50/50">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{quote.mensaje}</div>
                    </div>
                </div>
            )}

            {/* SECCIÓN DOCUMENTO PRINCIPAL */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-6 ${isManualQuoteActive ? 'bg-emerald-500' : 'bg-indigo-500'} rounded-full`}></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Documento de Cotización</h3>
                        <p className="text-xs text-slate-500">{isManualQuoteActive ? 'Archivo subido manualmente' : 'Versiones generadas por sistema'}</p>
                    </div>
                  </div>
                  
                  {canEdit && !isManualQuoteActive && (
                     <>
                        <input type="file" ref={manualFileInputRef} className="hidden" accept=".pdf" onChange={handleUploadManualQuote} />
                        <div className="flex gap-2">
                             <button onClick={() => manualFileInputRef.current?.click()} disabled={processing} className="text-[11px] bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center disabled:opacity-50 uppercase tracking-wide">
                                <i className="fa-solid fa-cloud-arrow-up mr-1.5"></i> Subir Manual
                             </button>
                             {items.length > 0 && (
                                <button onClick={handleGeneratePDF} disabled={generatingPDF} className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center disabled:opacity-50 uppercase tracking-wide border border-indigo-100">
                                    {generatingPDF ? <BrandSpinner size="xs" className="mr-1.5" /> : <i className="fa-solid fa-file-pdf mr-1.5"></i>}
                                    {generatingPDF ? 'Generando...' : `Generar v${(quote.versions?.length || 0) + 1}`}
                                </button>
                             )}
                        </div>
                     </>
                  )}
                </div>

                <div className="divide-y divide-slate-50">
                    {/* CASO 1: COTIZACIÓN MANUAL ACTIVA (RENDERIZADA COMO UNA VERSIÓN MÁS) */}
                    {isManualQuoteActive && (
                        <div className="px-6 py-4 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors flex items-center justify-between group border-l-4 border-emerald-500">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm border border-emerald-200 shadow-sm">
                                    <i className="fa-solid fa-file-upload"></i>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        Cotización Manual
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Activa</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Archivo externo subido por usuario</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={quote.url_cotizacion_manual!} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-xs font-bold text-slate-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-external-link-alt mr-1"></i> Abrir
                                </a>
                                {canEdit && (
                                    <>
                                        <button 
                                          onClick={() => handleSendQuote(undefined)} 
                                          disabled={sendingQuoteId === undefined || sendDisabled}
                                          title={sendDisabled ? sendBlockedReason : ''}
                                          className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center disabled:opacity-50"
                                        >
                                          {sendingQuoteId === undefined ? <BrandSpinner size="xs" /> : <><i className="fa-solid fa-paper-plane mr-1"></i>Enviar</>}
                                        </button>
                                        <button 
                                            onClick={handleDeleteManualQuote} 
                                            className="text-xs font-bold text-red-500 bg-white border border-transparent hover:border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                            title="Eliminar manual y volver a automáticas"
                                        >
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CASO 2: LISTA DE VERSIONES SISTEMA (RENDERIZADAS SIEMPRE DEBAJO) */}
                    {quote.versions?.map(pdf => (
                        <div key={pdf.id_version} className={`px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between group ${isManualQuoteActive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm border border-indigo-100 shrink-0">
                                    <i className="fa-solid fa-file-pdf"></i>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-700 mb-1">Versión {pdf.version_number}</p>
                                    <p className="text-[11px] text-slate-500 mb-2">
                                        {pdf.created_at ? new Date(pdf.created_at).toLocaleString() : '-'}
                                    </p>
                                    {(pdf.creator_name || pdf.generado_por) && (
                                        <p className="text-xs text-slate-500">
                                            <span className="text-slate-400">Creado por: </span>
                                            <span className="text-slate-700 font-medium">{pdf.creator_name || pdf.generado_por}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a href={pdf.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-200 transition-all shadow-sm">
                                    <i className="fa-solid fa-external-link-alt mr-1"></i> Abrir
                                </a>
                                {canEdit && !isManualQuoteActive && (
                                  <button onClick={() => handleSendQuote(pdf.id_version)} disabled={sendingQuoteId === pdf.id_version || sendDisabled} title={sendDisabled ? sendBlockedReason : ''} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center disabled:opacity-50">
                                        {sendingQuoteId === pdf.id_version ? <BrandSpinner size="xs" /> : <><i className="fa-solid fa-paper-plane mr-1"></i>Enviar</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {(!isManualQuoteActive && (!quote.versions || quote.versions.length === 0)) && (
                        <div className="text-center py-8 text-slate-400 text-xs italic">
                            <i className="fa-regular fa-file-pdf text-2xl mb-2 opacity-50 block"></i>
                            No hay documento generado ni subido.
                        </div>
                    )}
                </div>
            </div>

            {/* HISTORIAL DE ENVÍOS (DISEÑO MEJORADO) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-slate-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Historial de Envíos</h3>
                        <p className="text-xs text-slate-500">Registro de cotizaciones enviadas por email.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(quote.sent_history?.length ?? 0) > 0 && (
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs font-bold">{quote.sent_history!.length}</span>
                    )}
                    {quote.sent_history && quote.sent_history.length > 5 && (
                      <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                        <button
                          className={`${historyCondensed ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'} px-2 py-0.5 text-[10px] font-bold rounded`}
                          onClick={() => { setHistoryCondensed(true); setExpandedSentIds(new Set()); }}
                          title="Vista rápida"
                        >
                          Rápida
                        </button>
                        <button
                          className={`${!historyCondensed ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'} px-2 py-0.5 text-[10px] font-bold rounded`}
                          onClick={() => { setHistoryCondensed(false); setExpandedSentIds(new Set()); }}
                          title="Vista detallada"
                        >
                          Detallada
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6">
                    {(!quote.sent_history || quote.sent_history.length === 0) ? (
                        <div className="text-center py-4 text-slate-400 text-xs italic">Sin actividad de envíos.</div>
                    ) : (
                        <div className={historyCondensed ? 'space-y-1' : 'space-y-2'}>
                            {quote.sent_history.map((log, idx) => {
                                const isReply = log.method === 'REPLY';
                                const messageToShow = log.message_content || log.message_snapshot;
                                // Para REPLY: usar contact_detail.full_name si operator_name está vacío
                                const senderName = isReply 
                                    ? (log.operator_name || quote.contact_detail?.full_name || 'Usuario')
                                    : (log.operator_name || log.sent_by_name || log.creator_name || 'Usuario');
                                const senderAvatar = log.operator_avatar;
                              const contactName = quote.contact_detail?.full_name;
                              const contactEmail = quote.contact_detail?.email;
                              const toMatchesContact = !!(contactEmail && log.sent_to && log.sent_to.includes(contactEmail));
                                
                                if (historyCondensed) {
                                  const isExpanded = expandedSentIds.has(log.id_sent);
                                  return (
                                    <div key={idx} className={`rounded-md border ${isReply ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                      <div
                                        className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/50"
                                        onClick={() => {
                                          setExpandedSentIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(log.id_sent)) next.delete(log.id_sent); else next.add(log.id_sent);
                                            return next;
                                          });
                                        }}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <i className={`fa-solid ${isReply ? 'fa-reply text-blue-600' : 'fa-paper-plane text-slate-500'}`}></i>
                                          <div className="min-w-0">
                                            <div className={`text-xs ${isReply ? 'text-blue-800' : 'text-slate-700'} whitespace-normal break-words`}>
                                              {isReply ? (
                                                <>{log.sent_from || senderName}</>
                                              ) : (
                                                <>Cotización #{quote.formatted_no_cotizacion || quote.id_cotizacion}{log.version_enviada ? ` v${log.version_enviada}` : ''} por {senderName}</>
                                              )}
                                            </div>
                                            {!isReply && log.email_policy && (
                                              <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${log.email_policy === 'CORPORATE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {log.email_policy === 'CORPORATE' ? 'Email Corporativo' : 'Email Personal'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {!isReply && log.sent_file_url && (
                                            <a
                                              href={log.sent_file_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold hover:bg-emerald-200"
                                              title="Ver PDF"
                                            >
                                              <i className="fa-solid fa-file-pdf"></i> PDF
                                            </a>
                                          )}
                                          <span className={`text-[10px] ${isReply ? 'text-blue-500' : 'text-slate-400'}`}>{log.sent_at_fmt}</span>
                                          <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs`}></i>
                                        </div>
                                      </div>
                                      {isExpanded && (
                                        <div className={`px-3 pb-3 ${isReply ? 'text-blue-900' : 'text-slate-700'}`}>
                                          {!isReply && (
                                            <div className="text-[11px] mb-2 flex items-center gap-2">
                                              {senderAvatar && (
                                                <img src={senderAvatar} alt={senderName} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                                              )}
                                              <span className="text-slate-500">Enviado por:</span>
                                              <span className="font-medium text-slate-800">{senderName}</span>
                                            </div>
                                          )}
                                          {!isReply && log.subject && (
                                            <div className="text-[11px] mb-2">
                                              <span className="text-slate-500">Asunto:</span> <span className="font-medium whitespace-normal break-words">{log.subject}</span>
                                            </div>
                                          )}
                                          {!isReply && (
                                            <div className="space-y-1.5 text-[11px] mb-2">
                                              <div className="flex items-start gap-2">
                                                <i className="fa-solid fa-envelope text-slate-400 w-4 mt-0.5"></i>
                                                <div className="min-w-0 flex-1">
                                                  <span className="text-slate-500">Para:</span>{' '}
                                                  <span className="font-medium whitespace-normal break-words">
                                                    {toMatchesContact && contactEmail ? (
                                                      <>
                                                        {contactName || contactEmail} <span className="text-slate-500">&lt;</span>{contactEmail}<span className="text-slate-500">&gt;</span>
                                                      </>
                                                    ) : (
                                                      log.sent_to
                                                    )}
                                                  </span>
                                                </div>
                                              </div>
                                              {log.sent_cc && (
                                                <div className="flex items-start gap-2">
                                                  <i className="fa-solid fa-copy text-slate-400 w-4 mt-0.5"></i>
                                                  <div className="min-w-0 flex-1">
                                                    <span className="text-slate-500">Copia:</span>{' '}
                                                    <span className="font-medium whitespace-normal break-words">{log.sent_cc}</span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {isReply && log.sent_cc && (
                                            <div className="space-y-1.5 text-[11px] mb-2">
                                              <div className="flex items-start gap-2">
                                                <i className="fa-solid fa-copy text-blue-400 w-4 mt-0.5"></i>
                                                <div className="min-w-0 flex-1">
                                                  <span className="text-blue-500">Copia:</span>{' '}
                                                  <span className="font-medium whitespace-normal break-words text-slate-800">{log.sent_cc}</span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          {messageToShow && (
                                            <div className={`mt-2 rounded-lg ${isReply ? 'p-2 bg-white border border-blue-100' : 'p-2 border border-slate-100'}`}>
                                              {isReply && (
                                                <p className="text-[10px] text-blue-500 font-bold mb-1 flex items-center gap-1">
                                                  <i className="fa-solid fa-quote-left"></i> Resumen del correo del cliente
                                                </p>
                                              )}
                                              <p className={`text-[11px] leading-relaxed whitespace-pre-wrap ${isReply ? 'text-blue-900' : 'text-slate-700'}`}>{messageToShow}</p>
                                            </div>
                                          )}
                                          {!isReply && log.attachments && log.attachments.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                              {log.attachments?.map((att, i) => (
                                                <a
                                                  key={i}
                                                  href={att.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-700 rounded text-[9px] hover:bg-slate-300 transition-colors"
                                                  title={att.nombre}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <i className={`fa-solid ${getFileIcon(att.tipo || 'file')}`}></i> {att.nombre.length > 12 ? att.nombre.substring(0, 10) + '...' : att.nombre}
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                <div key={idx} className={`rounded-lg ${isReply ? 'p-3' : 'p-4'} border transition-all ${
                                    isReply 
                                        ? 'bg-blue-50 border-blue-200 hover:border-blue-300' 
                                        : 'bg-gradient-to-r from-slate-50 to-transparent border-slate-200 hover:border-slate-300'
                                }`}>
                                    {/* Cabecera */}
                                    <div className="flex sm:flex-row flex-col sm:items-center sm:justify-between items-start gap-2 mb-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {isReply ? (
                                          <span className="text-sm font-bold text-blue-700 flex items-center gap-1">
                                            <i className="fa-solid fa-reply"></i>
                                            <span className="font-medium text-blue-800 whitespace-normal break-words" title={log.sent_from || senderName}>{log.sent_from || senderName}</span>
                                          </span>
                                        ) : (
                                          <>
                                            {log.sent_file_url && (
                                              <a 
                                                href={log.sent_file_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold hover:bg-emerald-200 transition-colors"
                                                title="Ver PDF"
                                              >
                                                <i className="fa-solid fa-file-pdf"></i> Ver PDF
                                              </a>
                                            )}
                                            <span className="text-sm text-slate-700">
                                              Cotización #{quote.formatted_no_cotizacion || quote.id_cotizacion}
                                              {log.version_enviada ? ` v${log.version_enviada}` : ''} enviado por:
                                            </span>
                                            {senderAvatar && (
                                              <img src={senderAvatar} alt={senderName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                                            )}
                                            <span className="text-sm font-medium text-slate-800">{senderName}</span>
                                            {log.email_policy && (
                                              <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${log.email_policy === 'CORPORATE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {log.email_policy === 'CORPORATE' ? 'Email Corporativo' : 'Email Personal'}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <span className={`text-[10px] ${isReply ? 'text-blue-500' : 'text-slate-400'}`}>{log.sent_at_fmt}</span>
                                    </div>

                                    {/* Quién envió / Quién respondió */}
                                    {/* Enviado por ya se muestra en la cabecera para EMAIL */}

                                    {/* sent_from para REPLY (nombre + email) mostrado en cabecera */}

                                    {/* Destinatarios / Correo respondiente */}
                                    {!isReply && (
                                        <div className="space-y-1.5 text-xs mb-3">
                                          <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-envelope text-slate-400 w-4"></i>
                                                <span className="text-slate-500">Para:</span>
                                            <div className="min-w-0 flex-1">
                                              <span className="font-medium text-slate-800 block whitespace-normal break-words" title={toMatchesContact && contactEmail ? `${contactName || contactEmail} <${contactEmail}>` : (log.sent_to || '')}>
                                                {toMatchesContact && contactEmail ? (
                                                  <>
                                                    {contactName || contactEmail} <span className="text-slate-500">&lt;</span>{contactEmail}<span className="text-slate-500">&gt;</span>
                                                  </>
                                                ) : (
                                                  log.sent_to
                                                )}
                                              </span>
                                            </div>
                                            </div>
                                          {log.sent_cc ? (
                                            <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-copy text-slate-400 w-4"></i>
                                                    <span className="text-slate-500">Copia:</span>
                                              <div className="min-w-0 flex-1">
                                                <span className="font-medium text-slate-800 block whitespace-normal break-words" title={log.sent_cc}>{log.sent_cc}</span>
                                              </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-copy text-slate-400 w-4"></i>
                                                    <span className="text-slate-500">Copia:</span>
                                                    <span className="italic text-slate-400">sin copia</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isReply && (
                                      <div className="space-y-1.5 text-xs mb-3">
                                        {log.sent_cc ? (
                                          <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-copy text-blue-400 w-4"></i>
                                            <span className="text-blue-500">Copia:</span>
                                            <div className="min-w-0 flex-1">
                                              <span className="font-medium text-slate-800 block whitespace-normal break-words" title={log.sent_cc}>{log.sent_cc}</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-copy text-blue-400 w-4"></i>
                                            <span className="text-blue-500">Copia:</span>
                                            <span className="italic text-slate-400">sin copia</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Asunto */}
                                    {log.subject && !isReply && (
                                        <p className={`text-xs italic border-t pt-2 ${
                                            isReply 
                                                ? 'text-blue-600 border-blue-200' 
                                                : 'text-slate-600 border-slate-100'
                                        }`}>
                                            <span className={isReply ? 'text-blue-500' : 'text-slate-400'}>Asunto: </span>
                                            {log.subject}
                                        </p>
                                    )}

                                    {/* MENSAJE DE RESPUESTA DEL CLIENTE O CONTENIDO */}
                                    {messageToShow && (
                                        <div className={`mt-3 rounded-lg ${isReply ? 'p-2' : 'p-3'} border ${
                                            isReply 
                                                ? 'bg-white border-blue-100' 
                                                : ''
                                        }`}>
                                            {isReply && (
                                                <p className="text-[10px] text-blue-500 font-bold mb-2 flex items-center gap-1">
                                                    <i className="fa-solid fa-quote-left"></i> Resumen del correo del cliente
                                                </p>
                                            )}
                                            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${
                                                isReply ? 'text-blue-900' : 'text-slate-700'
                                            }`}>
                                                {messageToShow}
                                            </p>
                                        </div>
                                    )}

                                    {/* Adjuntos (si existen) */}
                                    {!isReply && log.attachments && log.attachments.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                            {log.attachments?.map((att, i) => (
                                                <a 
                                                    key={i}
                                                    href={att.url} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-700 rounded text-[9px] hover:bg-slate-300 transition-colors"
                                                    title={att.nombre}
                                                >
                                                    <i className={`fa-solid ${getFileIcon(att.tipo || 'file')}`}></i> {att.nombre.length > 12 ? att.nombre.substring(0, 10) + '...' : att.nombre}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
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
        <ShareModal 
          entity="quotes" 
          id={quote.id_cotizacion} 
          entityName={quote.nombre_cotizacion || `Cotización #${quote.formatted_no_cotizacion || quote.id_cotizacion}`}
          creatorName={quote.creator_name || (quote as any).created_by_name || ''}
          isOpen={isShareOpen} 
          onClose={() => { setIsShareOpen(false); }} 
          onShared={() => { setToast({ message: 'Compartido.', type: 'success' }); fetchData(); }}
          currentCollaborators={shareCollaborators}
        />
      )}

      {/* MODAL DE PRODUCTOS - IMPROVED */}
      {isProductModalOpen && (
        <AppModalViewport className="z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm">
                    <i className={`fa-solid ${isCreatingProduct ? 'fa-plus' : 'fa-box-open'}`}></i>
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-800">
                      {isCreatingProduct ? 'Crear Nuevo Producto' : 'Seleccionar Productos'}
                    </h2>
                    {!isCreatingProduct && selectedProducts.size > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedProducts.size} producto{selectedProducts.size > 1 ? 's' : ''} seleccionado{selectedProducts.size > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setSelectedProducts(new Map());
                    setProductSearchQuery('');
                    setProductTypeFilter('');
                    setProductCategoryFilter('');
                  }} 
                  className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
             </div>
             
             <div className="flex bg-slate-100 p-1 mx-6 mt-4 rounded-xl shrink-0">
                <button 
                  onClick={() => setIsCreatingProduct(false)} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${!isCreatingProduct ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Catálogo
                </button>
                <button 
                  onClick={() => setIsCreatingProduct(true)} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${isCreatingProduct ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Crear Nuevo
                </button>
             </div>

             <div className="flex-1 overflow-y-auto min-h-0">
                {!isCreatingProduct ? (
                  <div className="p-6 space-y-4">
                    {/* BÚSQUEDA Y FILTROS */}
                    <div className="space-y-3">
                      {/* Búsqueda */}
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input
                          type="text"
                          placeholder="Buscar por código o descripción..."
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm transition-all"
                        />
                      </div>

                      {/* Filtros */}
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 uppercase">Tipo:</span>
                          <button
                            onClick={() => setProductTypeFilter('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!productTypeFilter ? 'bg-brand-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => setProductTypeFilter('BIEN')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productTypeFilter === 'BIEN' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            <i className="fa-solid fa-box mr-1"></i> Bienes
                          </button>
                          <button
                            onClick={() => setProductTypeFilter('SERVICIO')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productTypeFilter === 'SERVICIO' ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            <i className="fa-solid fa-briefcase mr-1"></i> Servicios
                          </button>
                        </div>

                        {getUniqueCategories().length > 0 && (
                          <div className="flex items-center gap-2 pl-4 border-l border-slate-300">
                            <span className="text-xs font-bold text-slate-500 uppercase">Categoría:</span>
                            <select
                              value={productCategoryFilter}
                              onChange={(e) => setProductCategoryFilter(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all outline-none"
                            >
                              <option value="">Todas</option>
                              {getUniqueCategories().map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {(productSearchQuery || productTypeFilter || productCategoryFilter) && (
                          <button
                            onClick={() => {
                              setProductSearchQuery('');
                              setProductTypeFilter('');
                              setProductCategoryFilter('');
                            }}
                            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-all"
                          >
                            <i className="fa-solid fa-filter-circle-xmark mr-1"></i> Limpiar filtros
                          </button>
                        )}
                      </div>
                    </div>

                    {/* GRID DE PRODUCTOS */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      {(() => {
                        const filteredProducts = getFilteredProducts();
                        
                        if (filteredProducts.length === 0) {
                          return (
                            <div className="text-center py-12 px-4">
                              <i className="fa-solid fa-inbox text-4xl text-slate-300 mb-3"></i>
                              <p className="text-slate-500 font-medium">
                                {productSearchQuery || productTypeFilter || productCategoryFilter 
                                  ? 'No se encontraron productos con estos filtros' 
                                  : 'No hay productos disponibles'}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                            {filteredProducts.map((product) => {
                                const isSelected = selectedProducts.has(product.id_product);
                                const quantity = selectedProducts.get(product.id_product) || 1;
                                const precio = parseFloat(String(product.precio_unitario).replace(/[^0-9.-]+/g,"")) || 0;

                                return (
                                  <div
                                    key={product.id_product}
                                    className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                      isSelected 
                                        ? 'border-brand-500 shadow-sm ring-2 ring-brand-100' 
                                        : 'border-slate-200 hover:border-brand-300'
                                    }`}
                                    onClick={() => {
                                      const newMap = new Map(selectedProducts);
                                      if (isSelected) {
                                        newMap.delete(product.id_product);
                                      } else {
                                        newMap.set(product.id_product, 1);
                                      }
                                      setSelectedProducts(newMap);
                                    }}
                                  >
                                    <div className="p-4 flex gap-4">
                                      {/* Checkbox */}
                                      <div className="flex items-center shrink-0">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                          isSelected 
                                            ? 'bg-brand-500 border-brand-500' 
                                            : 'border-slate-300'
                                        }`}>
                                          {isSelected && (
                                            <i className="fa-solid fa-check text-white text-xs"></i>
                                          )}
                                        </div>
                                      </div>

                                      {/* Imagen */}
                                      <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                        {product.imagen_url ? (
                                          <img 
                                            src={convertGoogleDriveUrl(product.imagen_url)} 
                                            alt={product.descripcion}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <i className="fa-solid fa-image text-slate-300 text-xl"></i>
                                        )}
                                      </div>

                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">
                                            {product.descripcion}
                                          </h4>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                                            <i className="fa-solid fa-barcode"></i>
                                            {product.codigo}
                                          </span>
                                          
                                          {product.tipo === 'BIEN' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
                                              <i className="fa-solid fa-box"></i>
                                              Bien
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 uppercase">
                                              <i className="fa-solid fa-briefcase"></i>
                                              Servicio
                                            </span>
                                          )}
                                          
                                          {product.categoria && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600">
                                              <i className="fa-solid fa-tag"></i>
                                              {product.categoria}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                          <div className="text-sm font-mono font-bold text-brand-600">
                                            ${precio.toFixed(2)}
                                          </div>

                                          {isSelected && (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                              <label className="text-xs font-bold text-slate-500">Cant:</label>
                                              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newMap = new Map(selectedProducts);
                                                    const newQty = Math.max(1, quantity - 1);
                                                    newMap.set(product.id_product, newQty);
                                                    setSelectedProducts(newMap);
                                                  }}
                                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                                                >
                                                  <i className="fa-solid fa-minus text-xs"></i>
                                                </button>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={quantity}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    const val = parseInt(e.target.value) || 1;
                                                    const newMap = new Map(selectedProducts);
                                                    newMap.set(product.id_product, Math.max(1, val));
                                                    setSelectedProducts(newMap);
                                                  }}
                                                  className="w-14 px-2 py-1 text-center text-sm font-bold border-x border-slate-200 outline-none"
                                                />
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newMap = new Map(selectedProducts);
                                                    newMap.set(product.id_product, quantity + 1);
                                                    setSelectedProducts(newMap);
                                                  }}
                                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                                                >
                                                  <i className="fa-solid fa-plus text-xs"></i>
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                      <div 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-white hover:border-brand-400 cursor-pointer flex items-center justify-center relative overflow-hidden shrink-0 transition-all"
                      >
                        {newProduct.imagen_url ? (
                          <img src={convertGoogleDriveUrl(newProduct.imagen_url)} className="w-full h-full object-cover"/>
                        ) : (
                          <div className="text-center">
                            <i className="fa-solid fa-camera text-slate-300 mb-1"></i>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Foto</p>
                          </div>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => { 
                          const file = e.target.files?.[0]; 
                          if(file){ 
                            setImageFile(file); 
                            const reader = new FileReader(); 
                            reader.onloadend = () => setNewProduct({...newProduct, imagen_url: reader.result}); 
                            reader.readAsDataURL(file); 
                          } 
                        }} 
                        className="hidden" 
                      />
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Código</label>
                          <input 
                            value={newProduct.codigo} 
                            onChange={e => setNewProduct({...newProduct, codigo: e.target.value})} 
                            placeholder={getNextProductCode()} 
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Categoría</label>
                          <input 
                            value={newProduct.categoria} 
                            onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} 
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción *</label>
                      <textarea 
                        rows={2} 
                        value={newProduct.descripcion} 
                        onChange={e => setNewProduct({...newProduct, descripcion: e.target.value})} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"
                      ></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                        <select 
                          value={newProduct.tipo} 
                          onChange={e => setNewProduct({...newProduct, tipo: e.target.value})} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                        >
                          <option value="">-- Seleccionar --</option>
                          {productTypes.map(pt => (
                            <option key={pt.id_product_type} value={pt.type}>{pt.type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Precio Unitario</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400">$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={newProduct.precio_unitario} 
                            onChange={e => setNewProduct({...newProduct, precio_unitario: e.target.value})} 
                            className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad a añadir</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={selectedProducts.size > 0 ? Array.from(selectedProducts.values())[0] : 1} 
                        onChange={e => {
                          const qty = parseInt(e.target.value) || 1;
                          // For new products, we'll store temp quantity
                          setNewProduct({...newProduct, tempQuantity: qty});
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
             </div>

             {/* FOOTER con resumen */}
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4 shrink-0">
                {!isCreatingProduct && selectedProducts.size > 0 && (
                  <div className="text-sm">
                    <div className="font-bold text-slate-800">
                      {selectedProducts.size} producto{selectedProducts.size > 1 ? 's' : ''} • {' '}
                      {Array.from(selectedProducts.values()).reduce((sum, qty) => sum + qty, 0)} unidad{Array.from(selectedProducts.values()).reduce((sum, qty) => sum + qty, 0) > 1 ? 'es' : ''}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Total estimado: ${(() => {
                        let total = 0;
                        selectedProducts.forEach((qty, prodId) => {
                          const prod = availableProducts.find(p => p.id_product === prodId);
                          if (prod) {
                            const precio = parseFloat(String(prod.precio_unitario).replace(/[^0-9.-]+/g,"")) || 0;
                            total += precio * qty;
                          }
                        });
                        return total.toFixed(2);
                      })()}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 ml-auto">
                  <button 
                    onClick={() => {
                      setIsProductModalOpen(false);
                      setSelectedProducts(new Map());
                      setProductSearchQuery('');
                      setProductTypeFilter('');
                      setProductCategoryFilter('');
                    }} 
                    className="px-4 py-2 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={isCreatingProduct ? handleCreateAndAddProduct : handleProductSelection} 
                    disabled={processing || (isCreatingProduct && !newProduct.descripcion) || (!isCreatingProduct && selectedProducts.size === 0)} 
                    className="px-6 py-2 rounded-lg bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md shadow-brand-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <BrandSpinner size="lg" />
                    ) : (
                      <>
                        {isCreatingProduct ? 'Crear y Añadir' : `Añadir ${selectedProducts.size > 0 ? `(${selectedProducts.size})` : ''}`}
                      </>
                    )}
                  </button>
                </div>
             </div>
          </div>
        </AppModalViewport>
      )}
    </div>
  );
};

export default QuoteDetail;
