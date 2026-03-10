import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useEmailSendPolicy } from '../../src/hooks/useEmailSendPolicy';
import { apiFetch } from '../../services/apiClient';
import ShareModal from '../../components/ShareModal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { Quote, QuoteStatus, QuoteItem, UserDecision, Product, ProductType } from '../../types';
import { BrandSpinner } from '../../components/AppLoaders';

// ==================== TIPOS EXTENDIDOS ====================
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

type QuoteExtended = Omit<
  Quote,
  'available_statuses' | 'status_detail' | 'owner_detail' | 'company_detail' | 'contact_detail' | 'deal_detail'
> & {
  url_cotizacion_manual?: string | null;
  archivos_adjuntos?: Attachment[];
  sent_history?: SentLog[];
  versions?: Array<{
    id_version: string;
    file_url: string;
    created_at: string;
    created_at_fmt: string;
    version_number: number;
    creator_name: string;
    sent_at: string | null;
    is_approved: boolean;
  }>;
  collaborators?: Array<{
    id_user: string;
    name: string;
    avatar?: string;
    is_owner: boolean;
    permission_level: string;
  }>;
  available_statuses?: Array<{
    id_status: string;
    name: string;
    color: string;
    icon: string;
    status_category: string;
  }>;
  company_detail?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    ruc?: string;
  };
  contact_detail?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    position?: string;
  };
  owner_detail?: {
    id_user: string;
    name: string;
    email: string;
    avatar?: string;
  };
  status_detail?: {
    id: string;
    name: string;
    color: string;
    icon: string;
    category: string;
  };
  deal_detail?: {
    id?: string;
    name?: string;
    value?: string;
    status_name?: string;
    status_color?: string;
  };
};

// ==================== HELPERS ====================
const getInitials = (name: string = '') => {
  const parts = name.trim().split(' ').filter(Boolean);
  const initials = parts.map(p => p[0]).join('').toUpperCase();
  return initials.substring(0, 2) || 'U';
};

const formatCurrency = (val: string | number | undefined) => {
  const num = parseNumericValue(val);
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const parseNumericValue = (value: string | number | undefined | null) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const commas = (cleaned.match(/,/g) || []).length;
    normalized = commas > 1 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemCode = (item: QuoteItem) => {
  const code =
    (item as any)?.formatted_product_code ||
    (item as any)?.codigo ||
    (item as any)?.codigo_producto ||
    (item as any)?.product_code ||
    (item as any)?.sku;
  return (code || '').toString().trim() || 'Sin código';
};

const normalizeQuoteItem = (item: any): QuoteItem => {
  const resolvedCode =
    item?.formatted_product_code ||
    item?.codigo ||
    item?.codigo_producto ||
    item?.product_code ||
    item?.sku ||
    item?.product?.codigo ||
    item?.product?.codigo_producto ||
    '';

  return {
    ...item,
    codigo: resolvedCode,
  } as QuoteItem;
};

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

const QUOTE_CATEGORY_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  SENT: '#0ea5e9',
  ACCEPTED: '#10b981',
  REJECTED: '#ef4444',
};

// ==================== COMPONENTE: STATUS SELECTOR ====================
const StatusSelector: React.FC<{
  currentStatusId: string;
  statuses: Array<{
    id_status: string;
    name: string;
    color: string;
    icon: string;
  }>;
  onSelect: (id: string) => void;
  disabled: boolean;
  compact?: boolean;
}> = ({ currentStatusId, statuses, onSelect, disabled, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = statuses.find(s => s.id_status === currentStatusId) || {
    name: 'Desconocido',
    color: '#94a3b8',
    icon: 'fa-circle',
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
        className={`w-full sm:w-auto inline-flex items-center gap-2 border transition-all ${
          compact
            ? 'px-2 py-0.5 min-h-[20px] rounded text-[10px] font-semibold'
            : 'px-3 py-2.5 rounded-lg font-bold text-xs'
        } ${
          disabled ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-95 active:scale-95'
        }`}
        style={{
          backgroundColor: compact ? (current.color || '#94a3b8') : `${current.color}15`,
          color: compact ? '#ffffff' : current.color,
          borderColor: compact ? (current.color || '#94a3b8') : `${current.color}40`,
        }}
      >
        <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
          <i className={`fa-solid ${current.icon} text-[9px] leading-none`} />
        </span>
        <span>{current.name || 'Desconocido'}</span>
        {!disabled && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-auto">
            <i className="fa-solid fa-chevron-down text-[7px] leading-none" />
          </span>
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full mt-1 left-0 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="max-h-64 overflow-y-auto py-1">
            {itemsAbove.map(item => (
              <button
                key={item.id_status}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.id_status);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center"
                  style={{ backgroundColor: item.color || '#94a3b8' }}
                >
                  <i className={`fa-solid ${item.icon} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
              </button>
            ))}

            <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
              <div className="flex items-center gap-2 text-slate-500 cursor-not-allowed">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center"
                  style={{ backgroundColor: current.color || '#94a3b8' }}
                >
                  <i className={`fa-solid ${current.icon} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{current.name}</span>
                <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" />
              </div>
            </div>

            {itemsBelow.map(item => (
              <button
                key={item.id_status}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.id_status);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center"
                  style={{ backgroundColor: item.color || '#94a3b8' }}
                >
                  <i className={`fa-solid ${item.icon} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SKELETON LOADER ====================
const QuotesDetailNewSkeleton = () => (
  <div className="min-h-screen bg-[#F9F9F8] p-8 animate-pulse space-y-8">
    <div className="h-20 bg-white rounded-xl border border-zinc-200"></div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-4 h-96 bg-white rounded-xl border border-zinc-200"></div>
      <div className="col-span-8 h-96 bg-white rounded-xl border border-zinc-200"></div>
    </div>
  </div>
);

// ==================== COMPONENTE PRINCIPAL ====================
const QuotesDetailNew: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { quoteStatuses: cachedQuoteStatuses } = useDataCache();
  const { policy: emailPolicy, isLoading: emailPolicyLoading } = useEmailSendPolicy(user);

  // --- DATA STATES ---
  const [quote, setQuote] = useState<QuoteExtended | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<Array<{
    id_status: string;
    name: string;
    color: string;
    icon: string;
    status_category?: string;
  }>>([]);

  // --- UI & LOADING STATES ---
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'articulos' | 'documentos' | 'historial'>('articulos');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [itemQtyDrafts, setItemQtyDrafts] = useState<Record<string, string>>({});
  const [syncingItemIds, setSyncingItemIds] = useState<Record<string, boolean>>({});
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // --- MODALS ---
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '' as React.ReactNode,
    onConfirm: () => {},
  });

  const updateQuoteTotalFromItems = useCallback((nextItems: QuoteItem[]) => {
    const nextTotal = nextItems.reduce(
      (sum, item) => sum + (parseNumericValue(item.precio_unitario) * Number(item.cantidad || 0)),
      0
    );

    setQuote(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        total: nextTotal as any,
      };
    });
  }, []);

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;

    setLoading(true);
    try {
      const response = await apiFetch(
        `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/detail?id_cotizacion=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`
      );

      if (!response.ok) {
        setToast({ message: 'Error al cargar la cotización.', type: 'error' });
        return;
      }

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;
      const q: any = Array.isArray(parsed) ? parsed[0] : parsed;

      if (q) {
        setQuote(q as QuoteExtended);
        setItems(Array.isArray(q.items) ? q.items.map(normalizeQuoteItem) : []);
        if (Array.isArray(q.available_statuses)) {
          setQuoteStatuses(q.available_statuses);
        }
      }
    } catch (e) {
      console.error('Error fetching quote:', e);
      setToast({ message: 'Error al cargar los datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };

    if (isActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionsOpen]);

  // --- HANDLERS ---
  const handleStatusChange = (newStatusId: string) => {
    if (!quote || newStatusId === quote.id_quote_status) return;

    const newStatus = quoteStatuses.find(s => s.id_status === newStatusId);
    setConfirmState({
      isOpen: true,
      title: 'Actualizar Estado',
      message: `¿Cambiar el estado a "${newStatus?.name}"?`,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cotizacion: quote.id_cotizacion,
              id_quote_status: newStatusId,
              id_tenant: user?.id_tenant,
              id_user: user?.id_user,
            }),
          });

          if (res.ok) {
            setQuote({
              ...quote,
              id_quote_status: newStatusId,
              status_detail: newStatus as any,
            });
            setToast({ message: 'Estado actualizado.', type: 'success' });
            fetchData();
          } else throw new Error();
        } catch {
          setToast({ message: 'Error al actualizar estado.', type: 'error' });
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const handleGeneratePDF = async () => {
    if (!quote || !user) return;
    setGeneratingPDF(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cotizacion: quote.id_cotizacion,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
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
        body: formData,
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Cotización manual subida exitosamente.', type: 'success' });
      await fetchData();
    } catch {
      setToast({ message: 'No se pudo subir la cotización.', type: 'error' });
    } finally {
      setProcessing(false);
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';
    }
  };

  const handleSendQuote = async (idVersion?: string) => {
    if (!quote || !user) return;
    if (emailPolicyLoading) {
      setToast({ message: 'Validando configuración de correo...', type: 'error' });
      return;
    }
    const destEmail = quote.contact_detail?.email || 'el cliente';
    setConfirmState({
      isOpen: true,
      title: 'Enviar Cotización',
      message: `¿Enviar ${idVersion ? 'esta versión' : 'la cotización'} a ${destEmail}?`,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        setSendingQuoteId(idVersion || 'manual');
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cotizacion: quote.id_cotizacion,
              id_user: user.id_user,
              id_tenant: user.id_tenant,
              id_version: idVersion || null,
              id_trato: quote.id_trato,
            }),
          });
          if (!res.ok) throw new Error();
          setToast({ message: 'Enviada correctamente.', type: 'success' });
          fetchData();
        } catch {
          setToast({ message: 'Error al enviar.', type: 'error' });
        } finally {
          setSendingQuoteId(null);
        }
      },
    });
  };

  const handleAddItem = async () => {
    if (!user?.id_tenant) return;
    setProcessing(true);
    try {
      const [pRes, tRes] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products_type?id_tenant=${user.id_tenant}`),
      ]);

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
      setSelectedProducts(new Map());
      setProductSearchQuery('');
      setProductTypeFilter('');
      setProductCategoryFilter('');
      setIsProductModalOpen(true);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      setAvailableProducts([]);
      setProductTypes([]);
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
    const now = Date.now();
    const newItems: Array<QuoteItem & { __tmpId?: string; __productId?: string }> = Array.from(selectedProducts.entries()).reduce((acc, [productId, quantity], index) => {
      const prod = availableProducts.find(p => p.id_product === productId);
      if (!prod) return acc;

      const precio = parseNumericValue(prod.precio_unitario);
      const tmpId = `tmp-${now}-${index}`;
      acc.push({
        id_quote_item: tmpId,
        descripcion: prod.descripcion || 'Producto',
        codigo: prod.codigo || prod.codigo_producto || prod.product_code || prod.sku || '',
        cantidad: quantity,
        precio_unitario: precio as any,
        subtotal: (quantity * precio) as any,
        __tmpId: tmpId,
        __productId: prod.id_product,
      } as QuoteItem & { __tmpId?: string; __productId?: string });
      return acc;
    }, [] as Array<QuoteItem & { __tmpId?: string; __productId?: string }>);

    if (newItems.length === 0) return;

    const tmpIdSet = new Set(newItems.map(i => i.__tmpId).filter(Boolean) as string[]);

    setItems(prev => {
      const next = [...prev, ...newItems];
      updateQuoteTotalFromItems(next);
      return next;
    });

    setSyncingItemIds(prev => {
      const next = { ...prev };
      newItems.forEach(item => {
        if (item.__tmpId) next[item.__tmpId] = true;
      });
      return next;
    });

    const count = newItems.length;
    setToast({ message: `${count} artículo${count > 1 ? 's' : ''} añadido${count > 1 ? 's' : ''}.`, type: 'success' });
    setIsProductModalOpen(false);
    setSelectedProducts(new Map());

    void (async () => {
      try {
        const responses = await Promise.all(newItems.map(async (item) => {
          const precio = parseNumericValue(item.precio_unitario);
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/products-selected`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cotizacion: quote.id_cotizacion,
              id_tenant: user.id_tenant,
              id_user: user.id_user,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precio_unitario: precio,
              subtotal: Number(item.cantidad || 0) * precio,
              id_producto: (item as any).__productId,
            }),
          });

          let payload: any = null;
          try {
            const text = await res.text();
            payload = text ? JSON.parse(text) : null;
          } catch {
            payload = null;
          }

          return {
            ok: res.ok,
            tmpId: (item as any).__tmpId as string,
            serverId: payload?.id_articulo_cot || payload?.id_quote_item || payload?.id,
          };
        }));

        const allOk = responses.every(r => r.ok);
        if (!allOk) throw new Error('Error al sincronizar artículos');

        setItems(prev => prev.map(item => {
          const currentId = item.id_articulo_cot || item.id_quote_item;
          const matched = responses.find(r => r.tmpId === currentId);
          if (!matched || !matched.serverId) return item;
          return {
            ...item,
            id_articulo_cot: matched.serverId,
            id_quote_item: matched.serverId,
          };
        }));
      } catch {
        setItems(prev => {
          const next = prev.filter(item => !tmpIdSet.has((item.id_articulo_cot || item.id_quote_item || '') as string));
          updateQuoteTotalFromItems(next);
          return next;
        });
        setToast({ message: 'Error al sincronizar artículos. Se revirtieron los cambios.', type: 'error' });
      } finally {
        setSyncingItemIds(prev => {
          const next = { ...prev };
          newItems.forEach(item => {
            if (item.__tmpId) delete next[item.__tmpId];
          });
          return next;
        });
      }
    })();
  };

  const handleUpdateItem = async (idItem: string, cant: number, precio: number, prevCant: number) => {
    if (!quote || !user) return;

    setItems(prev => {
      const next = prev.map(item => {
        const currentId = item.id_articulo_cot || item.id_quote_item;
        if (currentId !== idItem) return item;
        return {
          ...item,
          cantidad: cant,
          precio_unitario: precio as any,
          subtotal: (cant * precio) as any,
        };
      });
      updateQuoteTotalFromItems(next);
      return next;
    });

    setSyncingItemIds(prev => ({ ...prev, [idItem]: true }));

    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_articulo_cot: idItem,
          cantidad: cant,
          precio_unitario: precio,
          subtotal: cant * precio,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });

      if (!res.ok) throw new Error();
    } catch {
      setItems(prev => {
        const next = prev.map(item => {
          const currentId = item.id_articulo_cot || item.id_quote_item;
          if (currentId !== idItem) return item;
          return {
            ...item,
            cantidad: prevCant,
            subtotal: (prevCant * precio) as any,
          };
        });
        updateQuoteTotalFromItems(next);
        return next;
      });
      setToast({ message: 'Error al actualizar.', type: 'error' });
    } finally {
      setSyncingItemIds(prev => {
        const next = { ...prev };
        delete next[idItem];
        return next;
      });
    }
  };

  const commitItemQuantity = async (item: QuoteItem, idx: number) => {
    const itemId = item.id_articulo_cot || item.id_quote_item;
    if (!itemId) return;

    const key = itemId || `idx-${idx}`;
    const rawDraft = itemQtyDrafts[key];
    const currentQty = Number(item.cantidad || 0);
    const parsedDraft = parseInt((rawDraft ?? String(currentQty)).trim(), 10);
    const nextQty = Number.isFinite(parsedDraft) && parsedDraft > 0 ? parsedDraft : Math.max(1, currentQty || 1);

    setItemQtyDrafts(prev => ({ ...prev, [key]: String(nextQty) }));
    if (nextQty === currentQty) return;

    const precioUnitario = parseNumericValue(item.precio_unitario);
    void handleUpdateItem(itemId, nextQty, precioUnitario, currentQty);
  };

  const handleDeleteItem = (idItem: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Artículo',
      message: '¿Seguro que deseas eliminar este ítem?',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        if (!quote || !user) return;

        const prevItems = items;
        const removed = prevItems.find(i => (i.id_articulo_cot || i.id_quote_item) === idItem);
        if (!removed) return;

        setItems(prev => {
          const next = prev.filter(i => (i.id_articulo_cot || i.id_quote_item) !== idItem);
          updateQuoteTotalFromItems(next);
          return next;
        });

        setItemQtyDrafts(prev => {
          const next = { ...prev };
          delete next[idItem];
          return next;
        });

        setSyncingItemIds(prev => ({ ...prev, [idItem]: true }));

        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quote-items/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_articulo_cot: idItem,
              id_tenant: user.id_tenant,
              id_user: user.id_user,
            }),
          });

          if (!res.ok) throw new Error();

          setToast({ message: 'Artículo eliminado.', type: 'success' });
        } catch {
          setItems(prev => {
            const next = [...prev, removed];
            updateQuoteTotalFromItems(next);
            return next;
          });
          setItemQtyDrafts(prev => ({ ...prev, [idItem]: String(removed.cantidad || 1) }));
          setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
          setSyncingItemIds(prev => {
            const next = { ...prev };
            delete next[idItem];
            return next;
          });
        }
      },
    });
  };

  const openShareModal = async () => {
    if (!quote) return;
    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share?id_cotizacion=${quote.id_cotizacion}`
      );
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : data.users || [];
      const mapped = list.map((u: any) => ({
        id_user: u.id_user,
        name: u.name_user || u.name || 'Usuario',
        avatar: u.avatar_url || u.avatar || null,
        permission_level: (u.permission_level || '').toUpperCase() || 'VIEW',
        is_owner: Boolean(u.is_owner),
      }));
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
    setIsShareOpen(true);
  };

  const handleEditQuote = () => {
    if (!quote) return;
    navigate(`/app/quotes/edit?id=${quote.id_cotizacion}`);
  };

  // --- DERIVED HOOKS (must be before any return) ---
  const canEdit = quote && (quote.access_level === 'EDIT' || user?.rol_user === 'admin');
  const effectiveQuoteStatuses = (quoteStatuses && quoteStatuses.length > 0) ? quoteStatuses : (cachedQuoteStatuses || []);
  const statusFromCache = effectiveQuoteStatuses.find((s: any) =>
    String(s.id_status || '').trim() === String(quote?.id_quote_status || quote?.status_detail?.id || '').trim() ||
    String(s.name || '').toUpperCase() === String(quote?.status_detail?.name || '').toUpperCase()
  );
  const rawStatusCategory = String(statusFromCache?.status_category || quote?.status_detail?.category || '').toUpperCase();
  const effectiveStatusCategory =
    rawStatusCategory === 'DRAFT' || rawStatusCategory === 'SENT' || rawStatusCategory === 'ACCEPTED' || rawStatusCategory === 'REJECTED'
      ? rawStatusCategory
      : rawStatusCategory === 'PROGRESS'
        ? 'SENT'
        : rawStatusCategory === 'WON'
          ? 'ACCEPTED'
          : rawStatusCategory === 'LOST'
            ? 'REJECTED'
            : 'SENT';
  const effectiveQuoteStatus = {
    id: statusFromCache?.id_status || quote?.status_detail?.id || '',
    name: statusFromCache?.name || quote?.status_detail?.name || 'Desconocido',
    color: statusFromCache?.color || quote?.status_detail?.color || '#94a3b8',
    icon: statusFromCache?.icon || quote?.status_detail?.icon || 'fa-circle',
    category: effectiveStatusCategory,
  };
  const quotePipelineCats = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
  const currentQuoteCat = String(effectiveQuoteStatus.category || 'SENT').toUpperCase();
  const quoteCatIndex = quotePipelineCats.indexOf(currentQuoteCat);
  const quotePipelineLabel = (cat: string) => (
    cat === 'DRAFT' ? 'Borrador' :
    cat === 'SENT' ? 'Enviado' :
    cat === 'ACCEPTED' ? 'Aprobado' :
    'Rechazado'
  );
  const totalValue = items.reduce(
    (sum, item) => sum + (parseNumericValue(item.precio_unitario) * Number(item.cantidad || 0)),
    0
  );
  const totalFormatted = formatCurrency(totalValue);
  const [totalInteger, totalDecimals = '00'] = totalFormatted.split('.');
  const isManualQuoteActive = quote ? Boolean(quote.url_cotizacion_manual) : false;
  const versionsList = quote && quote.versions ? (quote.versions as Array<{
    id_version: string;
    file_url: string;
    created_at: string;
    created_at_fmt?: string;
    version_number: number;
    creator_name: string;
  }>) : [];
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    availableProducts.forEach((p: any) => {
      const cat = (p?.categoria || '').toString().trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [availableProducts]);

  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();
    return availableProducts.filter((p: any) => {
      const desc = (p?.descripcion || '').toString().toLowerCase();
      const code = (p?.codigo || '').toString().toLowerCase();
      const type = (p?.tipo || '').toString().toUpperCase();
      const cat = (p?.categoria || '').toString().trim();

      const matchQuery = !query || desc.includes(query) || code.includes(query);
      const matchType = !productTypeFilter || type === productTypeFilter;
      const matchCategory = !productCategoryFilter || cat === productCategoryFilter;

      return matchQuery && matchType && matchCategory;
    });
  }, [availableProducts, productSearchQuery, productTypeFilter, productCategoryFilter]);

  // --- RENDER ---
  if (loading) return <QuotesDetailNewSkeleton />;

  if (!quote) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500 font-medium">
        Cotización no encontrada.
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F9F9F8] pb-20 font-sans">
      {/* HEADER STICKY */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight truncate">
                  {quote.nombre_cotizacion}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border shadow-sm"
                  style={{
                    backgroundColor: effectiveQuoteStatus.color || '#94a3b8',
                    borderColor: effectiveQuoteStatus.color || '#94a3b8',
                    color: '#ffffff',
                  }}
                >
                  <i className={`fa-solid ${effectiveQuoteStatus.icon || 'fa-circle'} text-[9px]`} />
                  <span>{effectiveQuoteStatus.name || 'Desconocido'}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-500 uppercase tracking-wide border border-zinc-200 shadow-sm">
                  {quote.formatted_no_cotizacion || `COT-${quote.id_cotizacion?.substring(0, 4)}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
              <div className="text-left sm:text-right mr-2">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">
Valor                </div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {totalInteger}
                  <span className="text-zinc-400 text-lg">.{totalDecimals}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openShareModal}
                  className="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
                  title="Compartir"
                >
                  <i className="fa-solid fa-share-nodes text-[13px]"></i>
                </button>
                {canEdit && (
                  <button
                    onClick={handleEditQuote}
                    className="h-9 px-4 bg-zinc-900 text-white rounded-md font-medium text-[13px] hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <i className="fa-solid fa-pen text-[11px]"></i> Editar
                  </button>
                )}
                <div className="relative" ref={actionsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsActionsOpen(prev => !prev)}
                    className="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
                    title="Más acciones"
                  >
                    <i className="fa-solid fa-ellipsis-vertical text-[11px]"></i>
                  </button>

                  {isActionsOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setIsActionsOpen(false);
                          openShareModal();
                        }}
                        className="w-full px-3 py-2.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <i className="fa-solid fa-share-nodes text-[11px] text-zinc-500"></i>
                        Compartir
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setIsActionsOpen(false);
                            handleEditQuote();
                          }}
                          className="w-full px-3 py-2.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-pen text-[11px] text-zinc-500"></i>
                          Editar cotización
                        </button>
                      )}
                      {quote.id_trato && (
                        <button
                          onClick={() => {
                            setIsActionsOpen(false);
                            navigate(`/app/deals/${quote.id_trato}`);
                          }}
                          className="w-full px-3 py-2.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-briefcase text-[11px] text-zinc-500"></i>
                          Ver trato
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PIPELINE DE ESTADOS */}
          <div className="mt-8 overflow-x-auto scrollbar-hide">
            <div className="flex min-w-[700px] gap-2.5">
              {quotePipelineCats.map((cat, idx) => {
                const isActive = idx === quoteCatIndex;
                const isCompleted = idx < quoteCatIndex && currentQuoteCat !== 'REJECTED';
                const activeColor = QUOTE_CATEGORY_COLORS[currentQuoteCat] || '#0ea5e9';
                const completedColor = '#d4d4d8';

                return (
                  <div key={cat} className={`flex-${isActive ? '[1.5]' : '1'} group cursor-pointer`}>
                    <div
                      className="h-1.5 w-full rounded-full mb-2 relative"
                      style={{
                        backgroundColor: isCompleted ? completedColor : isActive ? activeColor : '#e4e4e7',
                      }}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: activeColor }}
                        ></div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${isActive ? 'font-bold text-zinc-900' : 'text-zinc-400'}`}>
                      {isCompleted && <i className="fa-solid fa-circle-check text-zinc-500"></i>}
                      {!isCompleted && !isActive && <i className="fa-regular fa-circle text-[10px]"></i>}
                      {isActive && (
                        <span
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
                          style={{
                            borderColor: activeColor,
                            backgroundColor: `${activeColor}22`,
                          }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeColor }}></span>
                        </span>
                      )}
                      <span style={isActive ? { color: activeColor } : undefined}>{quotePipelineLabel(cat)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* LEFT PANEL - DETALLES */}
        <aside className="lg:col-span-4 space-y-8">
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Detalles de Cotización</span>
              {canEdit && (
                <button className="hover:text-zinc-600">
                  <i className="fa-solid fa-pen text-[10px]"></i>
                </button>
              )}
            </h3>

            <div className="space-y-1">
              {/* EMPRESA */}
              <div className="relative group/popover">
                <div className="flex items-center py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                  <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                    <i className="fa-solid fa-building w-4 text-center"></i> Empresa
                  </div>
                  <div className="w-2/3 text-zinc-900 text-[13px] font-medium truncate">
                    {quote.company_detail?.name || '—'}
                  </div>
                </div>

                {/* POPOVER EMPRESA */}
                <div className="hidden sm:block absolute left-1/3 top-full mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover/popover:opacity-100 group-hover/popover:visible transition-all duration-200 z-50 transform translate-y-1 group-hover/popover:translate-y-0">
                  <div className="bg-gradient-to-br from-emerald-50 to-white border-b border-emerald-100 px-4 py-3">
                    <p className="text-[13px] font-bold text-zinc-900">{quote.company_detail?.name || 'Empresa'}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Cliente Principal</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-[12px]">
                    {quote.company_detail?.ruc && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">RUC:</span>
                        <span className="text-zinc-700 font-medium">{quote.company_detail.ruc}</span>
                      </div>
                    )}
                    {quote.company_detail?.address && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">Direc:</span>
                        <span className="text-zinc-700 font-medium">{quote.company_detail.address}</span>
                      </div>
                    )}
                    {quote.company_detail?.email && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">Email:</span>
                        <a href={`mailto:${quote.company_detail.email}`} className="text-blue-600 font-medium hover:underline break-all">
                          {quote.company_detail.email}
                        </a>
                      </div>
                    )}
                    {quote.company_detail?.phone && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">Tel:</span>
                        <a href={`tel:${quote.company_detail.phone}`} className="text-blue-600 font-medium hover:underline">
                          {quote.company_detail.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CONTACTO */}
              <div className="relative group/popover">
                <div className="flex items-center py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                  <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                    <i className="fa-solid fa-user w-4 text-center"></i> Contacto
                  </div>
                  <div className="w-2/3 text-zinc-900 text-[13px] font-medium truncate">
                    {quote.contact_detail?.full_name || '—'}
                  </div>
                </div>

                {/* POPOVER CONTACTO */}
                <div className="hidden sm:block absolute left-1/3 top-full mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover/popover:opacity-100 group-hover/popover:visible transition-all duration-200 z-50">
                  <div className="bg-white px-4 py-3 border-b border-zinc-100">
                    <p className="text-[13px] font-bold text-zinc-900">{quote.contact_detail?.full_name || 'Contacto'}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{quote.contact_detail?.position || 'Contacto Asociado'}</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-[12px]">
                    {quote.contact_detail?.email && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">Email:</span>
                        <a href={`mailto:${quote.contact_detail.email}`} className="text-blue-600 font-medium hover:underline break-all">
                          {quote.contact_detail.email}
                        </a>
                      </div>
                    )}
                    {quote.contact_detail?.phone && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase w-12 shrink-0">Tel:</span>
                        <a href={`tel:${quote.contact_detail.phone}`} className="text-blue-600 font-medium hover:underline">
                          {quote.contact_detail.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CREADOR */}
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors pt-2 border-t border-zinc-100 mt-2">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-solid fa-user-check w-4 text-center"></i> Creador
                </div>
                <div className="w-2/3 flex items-center gap-2 text-zinc-900 text-[13px] font-medium">
                  {quote.owner_detail?.name || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* CONDICIONES COMERCIALES */}
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Condiciones Comerciales
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-zinc-200 rounded-lg p-2.5 shadow-sm">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  <i className="fa-regular fa-clock"></i> Validez
                </p>
                <p className="text-[12px] font-semibold text-zinc-900">30 días</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-2.5 shadow-sm">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  <i className="fa-solid fa-shield-halved"></i> Garantía
                </p>
                <p className="text-[12px] font-semibold text-zinc-900">12 meses</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-2.5 shadow-sm">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  <i className="fa-solid fa-truck-fast"></i> Entrega
                </p>
                <p className="text-[12px] font-semibold text-zinc-900">2-5 días</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-2.5 shadow-sm">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                  <i className="fa-regular fa-credit-card"></i> Pago
                </p>
                <p className="text-[12px] font-semibold text-zinc-900">30 días</p>
              </div>
            </div>
          </div>

          {/* MENSAJE AL CLIENTE */}
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Mensaje en Correo</span>
              {canEdit && (
                <button className="hover:text-zinc-600">
                  <i className="fa-solid fa-pen text-[10px]"></i>
                </button>
              )}
            </h3>
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 relative overflow-hidden group">
              <div className="absolute left-0 top-0 w-1 h-full bg-blue-400"></div>
              <p className="text-[12px] text-blue-900 font-medium whitespace-pre-wrap leading-relaxed">
                {quote.mensaje || 'Sin mensaje'}
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL - TABS */}
        <section className="lg:col-span-8 relative">
          {/* TAB NAVIGATION */}
          <div className="flex gap-6 border-b border-zinc-200 mb-6 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('articulos')}
              className={`pb-3 text-[13px] font-medium text-zinc-500 border-b-2 border-transparent hover:text-zinc-800 transition-colors flex items-center gap-2 peer-checked/articulos:text-zinc-900 peer-checked/articulos:border-zinc-900 peer-checked/articulos:font-semibold whitespace-nowrap ${
                activeTab === 'articulos' ? 'text-zinc-900 border-zinc-900 font-semibold' : ''
              }`}
            >
              Artículos <span className="bg-zinc-100 text-zinc-600 px-1.5 rounded-full text-[10px] font-semibold">{items.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('documentos')}
              className={`pb-3 text-[13px] font-medium text-zinc-500 border-b-2 border-transparent hover:text-zinc-800 transition-colors whitespace-nowrap ${
                activeTab === 'documentos' ? 'text-zinc-900 border-zinc-900 font-semibold' : ''
              }`}
            >
              Documentos & Archivos
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`pb-3 text-[13px] font-medium text-zinc-500 border-b-2 border-transparent hover:text-zinc-800 transition-colors whitespace-nowrap ${
                activeTab === 'historial' ? 'text-zinc-900 border-zinc-900 font-semibold' : ''
              }`}
            >
              Historial de Envíos
            </button>
          </div>

          {/* TAB: ARTÍCULOS */}
          {activeTab === 'articulos' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-zinc-900">Listado de Productos</h3>
                {canEdit && (
                  <button
                    onClick={handleAddItem}
                    disabled={processing}
                    className="text-[12px] font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-plus text-[10px]"></i> Agregar Artículo
                  </button>
                )}
              </div>

              {items.length > 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-5">Descripción</div>
                    <div className="col-span-2 text-center">Cant.</div>
                    <div className="col-span-2 text-right">Precio Un.</div>
                    <div className="col-span-3 text-right pr-10">Total</div>
                  </div>

                  {items.map((item, idx) => {
                    const itemId = item.id_articulo_cot || item.id_quote_item;
                    const rowKey = itemId || `idx-${idx}`;
                    const quantityValue = itemQtyDrafts[rowKey] ?? String(item.cantidad || 0);
                    const unitPrice = parseNumericValue(item.precio_unitario);
                    const rowTotal = unitPrice * Number(item.cantidad || 0);

                    return (
                    <div
                      key={rowKey}
                      className="relative grid grid-cols-12 gap-4 px-4 py-4 items-center border-b border-zinc-100 hover:bg-zinc-50 transition-colors group last:border-0"
                    >
                      <div className="col-span-5 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-white border border-zinc-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                          <i className="fa-solid fa-box text-zinc-300 text-sm"></i>
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="text-[13px] font-semibold text-zinc-900 truncate">{item.descripcion || 'Producto'}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{getItemCode(item)}</p>
                        </div>
                      </div>

                      <div className="col-span-2 flex justify-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min={1}
                            value={quantityValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^\d*$/.test(value)) {
                                setItemQtyDrafts(prev => ({ ...prev, [rowKey]: value }));
                              }
                            }}
                            onBlur={() => commitItemQuantity(item, idx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            disabled={!itemId || Boolean(syncingItemIds[rowKey])}
                            className="w-16 text-center text-[13px] font-medium text-zinc-900 border border-zinc-200 rounded-md py-1 bg-white disabled:bg-zinc-50 disabled:text-zinc-400"
                          />
                        ) : (
                          <span className="text-[13px] font-medium text-zinc-900">{item.cantidad || 0}</span>
                        )}
                      </div>

                      <div className="col-span-2 flex justify-end">
                        <span className="text-[13px] font-semibold text-zinc-900">
                          {formatCurrency(unitPrice)}
                        </span>
                      </div>

                      <div className="col-span-3 text-right pr-10 text-[13px] font-bold text-zinc-900">
                        {formatCurrency(rowTotal)}
                      </div>

                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDeleteItem(itemId || '')}
                          disabled={!itemId || Boolean(syncingItemIds[rowKey])}
                          className="w-7 h-7 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center disabled:opacity-50"
                          title="Quitar Artículo"
                        >
                          <i className="fa-solid fa-trash text-[11px]"></i>
                        </button>
                      </div>
                    </div>
                  )})}

                  <div className="bg-zinc-50 border-t border-zinc-200 p-4">
                    <div className="flex justify-end items-center gap-6 text-[13px] pr-10">
                      <span className="font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">
                        Total General
                      </span>
                      <span className="font-bold text-xl tracking-tight text-zinc-900">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl p-12 text-center text-zinc-500">
                  <i className="fa-solid fa-inbox text-3xl text-zinc-300 mb-3"></i>
                  <p className="text-[13px] font-medium">No hay productos en esta cotización.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'documentos' && (
            <div className="animate-fade-in space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-zinc-900">Versiones de Cotización</h3>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <input type="file" ref={manualFileInputRef} className="hidden" accept=".pdf" onChange={handleUploadManualQuote} />
                      <button
                        onClick={() => manualFileInputRef.current?.click()}
                        disabled={processing}
                        className="text-[11px] bg-white border border-zinc-200 hover:border-emerald-300 hover:text-emerald-600 text-zinc-600 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center disabled:opacity-50 uppercase tracking-wide"
                      >
                        <i className="fa-solid fa-cloud-arrow-up mr-1.5"></i> Subir Manual
                      </button>
                      <button
                        onClick={handleGeneratePDF}
                        disabled={generatingPDF || processing}
                        className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center disabled:opacity-50 uppercase tracking-wide border border-indigo-100"
                      >
                        {generatingPDF ? <BrandSpinner size="xs" className="mr-1.5" /> : <i className="fa-solid fa-file-pdf mr-1.5"></i>}
                        {generatingPDF ? 'Generando...' : `Generar v${(quote.versions?.length || 0) + 1}`}
                      </button>
                    </div>
                  )}
                </div>

                {isManualQuoteActive && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-emerald-900">Cotización manual activa</p>
                      <p className="text-[11px] text-emerald-700">Este archivo se usa como principal para enviar.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={quote.url_cotizacion_manual || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-zinc-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-emerald-300 transition-all"
                      >
                        <i className="fa-solid fa-external-link-alt mr-1"></i> Abrir
                      </a>
                      <button
                        onClick={() => handleSendQuote()}
                        disabled={sendingQuoteId === 'manual' || processing}
                        className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center disabled:opacity-50"
                      >
                        {sendingQuoteId === 'manual' ? <BrandSpinner size="xs" /> : <><i className="fa-solid fa-paper-plane mr-1"></i>Enviar</>}
                      </button>
                    </div>
                  </div>
                )}

                {versionsList.length > 0 ? (
                  <div className="space-y-2">
                    {versionsList.map((version, idx) => (
                      <div key={version.id_version} className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-sm border border-red-200">
                              <i className="fa-solid fa-file-pdf text-red-500 text-2xl"></i>
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-zinc-900">v{version.version_number} - {version.created_at_fmt || new Date(version.created_at).toLocaleString()}</p>
                              <p className="text-[11px] text-zinc-500">Por {version.creator_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <a
                              href={version.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-md text-zinc-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center"
                            >
                              <i className="fa-solid fa-download text-sm"></i>
                            </a>
                            {canEdit && (
                              <button
                                onClick={() => handleSendQuote(version.id_version)}
                                disabled={sendingQuoteId === version.id_version || processing}
                                className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center disabled:opacity-50"
                              >
                                {sendingQuoteId === version.id_version ? <BrandSpinner size="xs" /> : <><i className="fa-solid fa-paper-plane mr-1"></i>Enviar</>}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl p-8 text-center text-zinc-500">
                    <i className="fa-solid fa-file-pdf text-3xl text-zinc-300 mb-3"></i>
                    <p className="text-[13px] font-medium">No hay versiones disponibles.</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[14px] font-semibold text-zinc-900">Archivos Adjuntos Extra</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Sube especificaciones, manuales u órdenes de compra (Máx 3).</p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-zinc-300 bg-zinc-50/50 rounded-xl p-8 text-center hover:bg-zinc-50 transition-colors hover:border-zinc-400 cursor-pointer">
                  <div className="w-10 h-10 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center mx-auto mb-3 text-zinc-400 group-hover:text-blue-500 transition-colors">
                    <i className="fa-solid fa-paperclip"></i>
                  </div>
                  <p className="text-[13px] font-semibold text-zinc-700">Haz clic para subir archivos adjuntos</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'historial' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[14px] font-semibold text-zinc-900">Registro de Comunicaciones</h3>
              </div>

              {quote.sent_history && quote.sent_history.length > 0 ? (
                <div className="relative before:absolute before:inset-0 before:ml-[15px] before:w-[1px] before:bg-zinc-200 space-y-6">
                  {(quote.sent_history as SentLog[]).map((log, idx) => (
                    <div key={log.id_sent} className="relative pl-10 group">
                      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-sm ${
                        log.method === 'EMAIL' 
                          ? 'border border-sky-200 bg-sky-50 text-sky-500'
                          : 'border border-amber-200 bg-amber-50 text-amber-500'
                      }`}>
                        <i className={`fa-solid ${log.method === 'EMAIL' ? 'fa-paper-plane' : 'fa-reply'} text-[11px]`}></i>
                      </div>

                      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:border-zinc-300 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2 border-b border-zinc-100 pb-3">
                          <div>
                            <p className="text-[13px] font-semibold text-zinc-900">{log.subject || 'Comunicación'}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{log.sent_at_fmt}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                            log.method === 'EMAIL'
                              ? 'text-sky-700 bg-sky-50 border border-sky-100'
                              : 'text-amber-700 bg-amber-50 border border-amber-100'
                          }`}>
                            {log.method === 'EMAIL' ? 'Email Enviado' : 'Respuesta'}
                          </span>
                        </div>

                        <div className="bg-zinc-50 rounded-lg p-3">
                          <p className="text-[11px] font-semibold text-zinc-600 mb-1">
                            {log.method === 'EMAIL' ? `Para: ${log.sent_to}` : `De: ${log.sent_from || log.operator_name}`}
                          </p>
                          <div className="text-[12px] text-zinc-700 leading-relaxed font-medium whitespace-pre-wrap">
                            {log.message_content || 'Sin contenido'}
                          </div>

                          {log.sent_file_url && (
                            <div className="mt-3 pt-3 border-t border-zinc-200/60 flex flex-wrap gap-2">
                              <a
                                href={log.sent_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 shadow-sm rounded text-[10px] font-bold uppercase tracking-wide text-zinc-600 hover:bg-zinc-50 hover:text-red-600 transition-colors"
                              >
                                <i className="fa-solid fa-file-pdf text-red-500 text-[12px]"></i> PDF Enviado
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl p-12 text-center text-zinc-500">
                  <i className="fa-solid fa-inbox text-3xl text-zinc-300 mb-3"></i>
                  <p className="text-[13px] font-medium">No hay historial de comunicaciones.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* MODALES */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {isShareOpen && (
        <ShareModal
          entity="quotes"
          id={quote.id_cotizacion}
          entityName={quote.nombre_cotizacion || `Cotización #${quote.formatted_no_cotizacion}`}
          creatorName={quote.owner_detail?.name || ''}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          onShared={() => {
            setToast({ message: 'Compartido.', type: 'success' });
            fetchData();
          }}
          currentCollaborators={shareCollaborators}
        />
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Agregar artículos</h3>
              <button
                onClick={() => {
                  setIsProductModalOpen(false);
                  setProductSearchQuery('');
                  setProductTypeFilter('');
                  setProductCategoryFilter('');
                }}
                className="w-8 h-8 rounded-md hover:bg-zinc-100 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-4 border-b border-zinc-200 space-y-3 bg-zinc-50/60">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Buscar por descripción o código..."
                  className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Tipo</span>
                <button
                  onClick={() => setProductTypeFilter('')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${productTypeFilter === '' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setProductTypeFilter('BIEN')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${productTypeFilter === 'BIEN' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200'}`}
                >
                  Bienes
                </button>
                <button
                  onClick={() => setProductTypeFilter('SERVICIO')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${productTypeFilter === 'SERVICIO' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-600 border-zinc-200'}`}
                >
                  Servicios
                </button>

                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 ml-2">Categoría</span>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-zinc-200 bg-white text-zinc-700"
                >
                  <option value="">Todas</option>
                  {productCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {(productSearchQuery || productTypeFilter || productCategoryFilter) && (
                  <button
                    onClick={() => {
                      setProductSearchQuery('');
                      setProductTypeFilter('');
                      setProductCategoryFilter('');
                    }}
                    className="ml-auto px-2.5 py-1 rounded-md text-[11px] font-semibold border border-zinc-200 bg-white text-zinc-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-4 space-y-2">
              {filteredProducts.length === 0 && (
                <div className="text-sm text-zinc-500 text-center py-8">No hay productos disponibles.</div>
              )}

              {filteredProducts.map((prod: any) => {
                const selectedQty = selectedProducts.get(prod.id_product) || 0;
                const checked = selectedQty > 0;
                return (
                  <div key={prod.id_product} className="border border-zinc-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedProducts(prev => {
                            const next = new Map(prev);
                            if (e.target.checked) next.set(prod.id_product, Math.max(1, selectedQty || 1));
                            else next.delete(prod.id_product);
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{prod.descripcion || 'Producto'}</p>
                        <p className="text-xs text-zinc-500">{formatCurrency(prod.precio_unitario)}</p>
                      </div>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!checked) return;
                          setSelectedProducts(prev => {
                            const next = new Map(prev);
                            const qty = Math.max(1, (next.get(prod.id_product) || 1) - 1);
                            next.set(prod.id_product, qty);
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded-md border border-zinc-200 text-zinc-600"
                      >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{selectedQty || 1}</span>
                      <button
                        onClick={() => {
                          if (!checked) return;
                          setSelectedProducts(prev => {
                            const next = new Map(prev);
                            const qty = (next.get(prod.id_product) || 1) + 1;
                            next.set(prod.id_product, qty);
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded-md border border-zinc-200 text-zinc-600"
                      >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Seleccionados: {selectedProducts.size}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setProductSearchQuery('');
                    setProductTypeFilter('');
                    setProductCategoryFilter('');
                  }}
                  className="px-3 py-2 rounded-md border border-zinc-200 text-zinc-700 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProductSelection}
                  disabled={processing || selectedProducts.size === 0}
                  className="px-3 py-2 rounded-md bg-zinc-900 text-white text-sm disabled:opacity-50"
                >
                  {processing ? 'Guardando...' : 'Agregar seleccionados'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotesDetailNew;
