import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { financialService } from '../../services/financials.service';
import CompanyForm from '../clients/CompanyForm';
import Toast from '../../components/Toast';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';
import type { ClientCompany, FinancialTransaction, Quote } from '../../types';

// --- HELPERS ---
const formatCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    include_open: true,
  };
};

const normalizeTransactionType = (value: any): FinancialTransaction['transaction_type'] => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'VENTA') return 'VENTA';
  if (raw === 'COMPRA' || raw === 'GASTO') return 'GASTO';
  return 'OTRO';
};

const normalizeBooleanValue = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const normalizeNumericValue = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const calculateDueDate = (issueDate: string | undefined, creditDays: number) => {
  const baseDate = issueDate ? new Date(issueDate) : new Date();
  if (Number.isNaN(baseDate.getTime())) return issueDate || '';
  baseDate.setDate(baseDate.getDate() + creditDays);
  return baseDate.toISOString().split('T')[0];
};

const suggestInvoiceNumber = (dealId?: string | null) => {
  const baseDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = (dealId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'DRAFT';
  return `BORR-${baseDate}-${suffix}`;
};

const normalizeQuotesResponse = (raw: any): Quote[] => {
  const list = Array.isArray(raw)
    ? (raw[0]?.response?.quotes || raw)
    : Array.isArray(raw?.response?.quotes)
      ? raw.response.quotes
    : Array.isArray(raw?.response)
      ? raw.response
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.quotes)
          ? raw.quotes
          : [];

  return list.map((q: any) => ({
    ...(q || {}),
    id_cotizacion: q?.id_cotizacion || q?.id || '',
    id_client_company: q?.id_client_company || q?.id_empresa_cliente || q?.company_id || q?.id_company || q?.id_cliente || q?.id_client || '',
    no_cotizacion: q?.no_cotizacion || q?.numero || 0,
    formatted_no_cotizacion: q?.formatted_no_cotizacion || q?.numero || '',
    total: q?.total ?? q?.total_amount ?? q?.valor_total ?? '0',
  }));
};

const getQuoteClientId = (q: any) =>
  String(
    q?.id_client_company || q?.id_empresa_cliente || q?.company_id || q?.id_company || q?.id_cliente || q?.id_client || ''
  ).trim();

const normalizeText = (value: any) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const getQuoteCompanyName = (q: any) =>
  String(
    q?.client_company_name || q?.company_name || q?.nombre_empresa || q?.empresa || ''
  ).trim();

const getQuoteLabel = (q: any) => {
  const quoteNumber = q?.formatted_no_cotizacion || q?.no_cotizacion || q?.numero || '';
  const quoteName = q?.nombre_cotizacion || q?.name || '';

  if (quoteNumber && quoteName) return `${quoteNumber} - ${quoteName}`;
  if (quoteNumber) return String(quoteNumber);
  if (quoteName) return quoteName;
  return `Cotización ${String(q?.id_cotizacion || q?.id || '').slice(0, 8)}`;
};

type SelectedRecipient = {
  email: string;
  name: string;
  type: 'contact' | 'team' | 'external';
  id: string | null;
};

type SearchOption = {
  id: string;
  label: string;
  subLabel?: string;
};

type TenantEmailConfig = {
  email_policy?: 'INDIVIDUAL' | 'CORPORATE';
  corporate_email_address?: string;
  corporate_send_emails?: boolean;
};

// Modificamos el tipo para permitir strings en los inputs numéricos durante la edición
type FinancialFormData = Partial<Omit<FinancialTransaction, 'subtotal' | 'tax_amount' | 'total_value' | 'retention_value' | 'credit_days' | 'automation_frequency'>> & {
    subtotal?: number | string;
    tax_amount?: number | string;
    total_value?: number | string;
    retention_value?: number | string;
    credit_days?: number | string;
    enable_automation?: boolean;
    automation_frequency?: number | string;
    status?: 'PENDIENTE' | 'PAGADO' | 'ANULADO';
};

const SearchableClientSelector: React.FC<{
  currentId: string;
  options: SearchOption[];
  onSelect: (id: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}> = ({
  currentId,
  options,
  onSelect,
  onClear,
  disabled = false,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Escribe para buscar...',
  emptyText = 'Sin resultados',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = useMemo(() => options.find(o => o.id === currentId), [options, currentId]);

  useEffect(() => {
    if (!isOpen) {
      setInternalQuery(current?.label || '');
    }
  }, [current?.label, currentId, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setInternalQuery(current?.label || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [current?.label]);

  const filteredOptions = useMemo(() => {
    const needle = normalizeText(internalQuery);
    if (!needle) return options;
    return options.filter(option => {
      const label = normalizeText(option.label);
      const subLabel = normalizeText(option.subLabel || '');
      return label.includes(needle) || subLabel.includes(needle);
    });
  }, [options, internalQuery]);

  const currentIsInResults = useMemo(
    () => filteredOptions.some(option => option.id === currentId),
    [filteredOptions, currentId]
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <i className="fa-solid fa-magnifying-glass text-[11px]" />
        </span>
        {currentId && onClear && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setInternalQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Quitar selección"
            aria-label="Quitar selección"
          >
            <i className="fa-solid fa-xmark text-[10px] leading-none" />
          </button>
        ) : null}
        {!currentId ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[10px]`} />
          </span>
        ) : null}
        <input
          type="text"
          value={isOpen ? internalQuery : (current?.label || '')}
          onChange={(e) => {
            setInternalQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Escape') {
              setIsOpen(false);
              setInternalQuery(current?.label || '');
            }
            if (e.key === 'ArrowDown') {
              setIsOpen(true);
            }
            if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
              e.preventDefault();
              const first = filteredOptions[0];
              onSelect(first.id);
              setInternalQuery(first.label);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
          className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg pl-9 pr-9 py-2 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 disabled:text-zinc-500 placeholder:text-zinc-400"
          placeholder={placeholder}
        />
      </div>

      {isOpen && !disabled ? (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-[0_12px_32px_rgba(24,24,27,0.14)] z-[140] overflow-hidden">
          <div className="max-h-36 overflow-y-auto py-1.5">
            {filteredOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onSelect(option.id);
                  setInternalQuery(option.label);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left transition-colors ${
                  option.id === currentId ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-800 truncate">{option.label}</p>
                    {option.subLabel ? <p className="text-[11px] text-zinc-500 truncate">{option.subLabel}</p> : null}
                  </div>
                  {option.id === currentId ? <i className="fa-solid fa-check text-[11px] text-zinc-400 mt-0.5" /> : null}
                </div>
              </button>
            ))}
            {!filteredOptions.length ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-zinc-500">{emptyText}</p>
                <p className="text-[11px] text-zinc-400 mt-1">{searchPlaceholder}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isOpen && internalQuery && !currentIsInResults && !disabled ? (
        <p className="mt-1 text-[11px] text-zinc-500">{searchPlaceholder}</p>
      ) : null}
    </div>
  );
};

const FinancialForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtener el ID de los query params
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  const fromDealId = queryParams.get('from_deal');
  const fromQuoteId = queryParams.get('quote_id');
  const fromClientId = queryParams.get('client_id');
  const { user } = useAuth();
  const {
    companies: cachedCompanies,
    contacts: cachedContacts,
    users: cachedUsers,
    loading: cacheLoading,
    invalidateFinancials,
    invalidateCompanies,
  } = useDataCache();
  
  // Modo edición si el id existe
  const isEditMode = !!id;

  // --- ESTADOS DE DATOS ---
  const [transaction, setTransaction] = useState<FinancialFormData>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allCompanyContacts, setAllCompanyContacts] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // --- ESTADOS DE UI ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalName, setExternalName] = useState('');
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [showRetentionSection, setShowRetentionSection] = useState(false);
  const [tenantEmailConfig, setTenantEmailConfig] = useState<TenantEmailConfig | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [emailPolicyLoading, setEmailPolicyLoading] = useState(false);
  const dealPrefillAppliedRef = useRef(false);
  const skippedInitialEditCompanyPrefillRef = useRef(false);
  const retentionToggleInitializedRef = useRef(false);
  const quotesFetchedRef = useRef(false);


  // --- FILTRADO DINÁMICO ---
  const filteredQuotes = useMemo(() => {
    if (!transaction.id_client_company) return [];
    const selectedClientId = String(transaction.id_client_company).trim();
    const selectedCompany = clientCompanies.find((c: any) => String(c.id_client_company) === selectedClientId);
    const selectedCompanyName = normalizeText(selectedCompany?.name_company);

    return quotes.filter(q => {
      const byId = getQuoteClientId(q) === selectedClientId;
      if (byId) return true;
      if (!selectedCompanyName) return false;
      const quoteCompanyName = normalizeText(getQuoteCompanyName(q));
      return quoteCompanyName === selectedCompanyName;
    });
  }, [transaction.id_client_company, quotes, clientCompanies]);

  const filteredContacts = useMemo(() => {
    if (!transaction.id_client_company) return [];
    return allCompanyContacts.filter(c => 
      String(c.id_client_company || c.id_company || c.company_id) === String(transaction.id_client_company)
    );
  }, [transaction.id_client_company, allCompanyContacts]);

  const companyOptions = useMemo<SearchOption[]>(() => {
    return clientCompanies.map(company => ({
      id: String(company.id_client_company),
      label: company.name_company,
      subLabel: [company.id_number, company.city, company.email_company].filter(Boolean).join(' · '),
    }));
  }, [clientCompanies]);

  const quoteOptions = useMemo<SearchOption[]>(() => {
    return filteredQuotes.map(quote => ({
      id: String(quote.id_cotizacion),
      label: getQuoteLabel(quote),
      subLabel: quote.total !== undefined ? `Total ${formatCurrency(quote.total)}` : undefined,
    }));
  }, [filteredQuotes]);

  const selectedCompany = useMemo(
    () => clientCompanies.find(company => String(company.id_client_company) === String(transaction.id_client_company || '')),
    [clientCompanies, transaction.id_client_company]
  );

  useEffect(() => {
    if (!selectedCompany) return;

    if (isEditMode && !skippedInitialEditCompanyPrefillRef.current) {
      skippedInitialEditCompanyPrefillRef.current = true;
      return;
    }

    const companyCreditDays = normalizeNumericValue(
      selectedCompany.payment_terms_days ?? selectedCompany.billing_details?.payment_terms_days
    );
    const companyAppliesIva = normalizeBooleanValue(
      selectedCompany.applies_iva ?? selectedCompany.billing_details?.applies_iva
    );
    const companyIvaPercentage = normalizeNumericValue(
      selectedCompany.iva_percentage ?? selectedCompany.billing_details?.iva_percentage
    );

    setTransaction(prev => {
      const next: FinancialFormData = { ...prev };
      let changed = false;

      if (companyCreditDays !== undefined && (prev.credit_days === undefined || prev.credit_days === null || String(prev.credit_days).trim() === '')) {
        next.credit_days = String(companyCreditDays);
        changed = true;
      }

      if (companyAppliesIva !== undefined) {
        next.tax_amount = companyAppliesIva ? String(companyIvaPercentage ?? 0) : '0';
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [selectedCompany, isEditMode]);

  useEffect(() => {
    if (!transaction.issue_date) return;
    const creditDays = parseInt(String(transaction.credit_days || '0'), 10);
    const normalizedCreditDays = Number.isFinite(creditDays) ? creditDays : 0;
    const calculatedDueDate = calculateDueDate(transaction.issue_date, normalizedCreditDays);

    setTransaction(prev => {
      if (!prev.issue_date) return prev;
      return prev.due_date === calculatedDueDate ? prev : { ...prev, due_date: calculatedDueDate };
    });
  }, [transaction.issue_date, transaction.credit_days]);

  useEffect(() => {
    if (loading || retentionToggleInitializedRef.current) return;
    const hasRetention = (parseFloat(String(transaction.retention_value)) || 0) > 0 || Boolean(String(transaction.retention_number || '').trim());
    setShowRetentionSection(hasRetention);
    retentionToggleInitializedRef.current = true;
  }, [loading, transaction.retention_value, transaction.retention_number]);

  // --- PRESELECCIÓN DE DESTINATARIOS ---
  useEffect(() => {
    // Si NO se activa automación o no hay empresa seleccionada, no hacer nada
    if (!transaction.enable_automation || !transaction.id_client_company) return;

    // IMPORTANTE: Si ya hay recipientes cargados desde la API (edición),
    // no sobrescribir. Pero si fueron preseleccionados por este efecto antes,
    // sí podemos actualizar.
    const hasLoadedFromApi = transaction.automation_recipients && transaction.automation_recipients.length > 0;
    
    // Si estamos en modo edición y ya hay datos cargados, no sobrescribir
    if (hasLoadedFromApi && selectedRecipients.length > 0) return;

    // Si ya tenemos recipientes y no es edición, verificar si son los que preseleccionamos
    if (selectedRecipients.length > 0 && !hasLoadedFromApi) return;

    const recipientsToSelect: SelectedRecipient[] = [];

    // 1. Preseleccionar al usuario actual
    if (user?.email_user && user?.name_user) {
      recipientsToSelect.push({
        email: user.email_user,
        name: user.name_user,
        type: 'team',
        id: user.id_user || null
      });
    }

    // 2. Preseleccionar el contacto principal de la empresa
    const companyContacts = filteredContacts;
    
    if (companyContacts.length > 0) {
      // Buscar contacto marcado como principal
      const mainContact = companyContacts.find((c: any) => c.es_principal || c.is_main);
      const contactToSelect = mainContact || companyContacts[0];
      
      recipientsToSelect.push({
        email: contactToSelect.email || contactToSelect.email_contact,
        name: contactToSelect.first_name + (contactToSelect.last_name ? ' ' + contactToSelect.last_name : ''),
        type: 'contact',
        id: contactToSelect.id_contact || null
      });
    }

    // Aplicar preselección
    if (recipientsToSelect.length > 0) {
      setSelectedRecipients(recipientsToSelect);
    }
  }, [transaction.enable_automation, transaction.id_client_company, filteredContacts, user]);

  // --- LÓGICA DE CÁLCULO ---
  // Calcula el total visualmente basado en el estado actual de los inputs
  const calculatedTotal = useMemo(() => {
    const sub = parseFloat(String(transaction.subtotal)) || 0;
    const tax = parseFloat(String(transaction.tax_amount)) || 0;
    const ret = parseFloat(String(transaction.retention_value)) || 0;
    
    // Fórmula: (Subtotal + Impuestos) - Retención
    const total = (sub + (sub * (tax / 100))) - ret;
    return total > 0 ? total : 0;
  }, [transaction.subtotal, transaction.tax_amount, transaction.retention_value]);

  const grossTotalBeforeRetention = useMemo(() => {
    const sub = parseFloat(String(transaction.subtotal)) || 0;
    const tax = parseFloat(String(transaction.tax_amount)) || 0;
    return sub + (sub * (tax / 100));
  }, [transaction.subtotal, transaction.tax_amount]);

  const retentionExceedsTotal = useMemo(() => {
    const retention = parseFloat(String(transaction.retention_value)) || 0;
    return retention > grossTotalBeforeRetention;
  }, [transaction.retention_value, grossTotalBeforeRetention]);

  const personalEmailReady = useMemo(
    () => Boolean(user?.provider && user?.send_emails && user?.email_connected),
    [user?.provider, user?.send_emails, user?.email_connected]
  );

  const corporateEmailReady = useMemo(
    () => Boolean(tenantEmailConfig?.corporate_email_address && tenantEmailConfig?.corporate_send_emails),
    [tenantEmailConfig?.corporate_email_address, tenantEmailConfig?.corporate_send_emails]
  );

  const hasEmailIntegration = personalEmailReady || corporateEmailReady;

  const emailSourceInfo = useMemo(() => {
    if (corporateEmailReady) {
      return {
        icon: 'fa-building',
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        text: `Envio habilitado desde cuenta corporativa: ${tenantEmailConfig?.corporate_email_address}`
      };
    }

    if (personalEmailReady) {
      const providerName = user?.provider === 'google' ? 'Gmail' : 'Outlook';
      return {
        icon: user?.provider === 'google' ? 'fa-brands fa-google' : 'fa-brands fa-microsoft',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        text: `Envio habilitado desde cuenta personal (${providerName}): ${user?.email_connected || user?.email_user}`
      };
    }

    return {
      icon: 'fa-triangle-exclamation',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      text: 'Sin integracion de correo activa. Activa integracion personal o correo corporativo para enviar recordatorios.'
    };
  }, [corporateEmailReady, personalEmailReady, tenantEmailConfig?.corporate_email_address, user?.provider, user?.email_connected, user?.email_user]);

  // --- CARGA DE DATOS ---
  // Sync local lists from cache for instant rendering
  useEffect(() => {
    setClientCompanies(cachedCompanies as unknown as ClientCompany[]);
  }, [cachedCompanies]);

  useEffect(() => {
    setAllCompanyContacts(cachedContacts);
  }, [cachedContacts]);

  useEffect(() => {
    const mappedTeam = (cachedUsers || [])
      .map((u: any) => ({
        id: u.id_user || u.id,
        name: u.name_user || u.name || 'Sin nombre',
        email: u.email || u.email_user || ''
      }))
      .filter((u: any) => u.email);
    setTeamMembers(mappedTeam);
  }, [cachedUsers]);

  const fetchTenantEmailConfig = useCallback(async () => {
    if (!user?.id_tenant) return null;
    if (tenantEmailConfig) return tenantEmailConfig;

    setEmailPolicyLoading(true);
    try {
      const tenantRes = await apiFetch(buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant }));
      if (!tenantRes.ok) return null;

      const tenantRaw = await tenantRes.json();
      const tenantData = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
      const config: TenantEmailConfig = {
        email_policy: tenantData?.email_policy,
        corporate_email_address: tenantData?.corporate_email_address,
        corporate_send_emails: Boolean(tenantData?.corporate_send_emails),
      };
      setTenantEmailConfig(config);
      return config;
    } catch {
      return null;
    } finally {
      setEmailPolicyLoading(false);
    }
  }, [user?.id_tenant, tenantEmailConfig]);

  const fetchQuotesCatalog = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user || quotesLoading || quotesFetchedRef.current) return;

    setQuotesLoading(true);
    try {
      const quotesResScoped = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`);
      const quotesRawScoped = quotesResScoped.ok ? await quotesResScoped.json() : [];
      let qData = normalizeQuotesResponse(quotesRawScoped);

      if (!qData.length) {
        const quotesResGlobal = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes`);
        const quotesRawGlobal = quotesResGlobal.ok ? await quotesResGlobal.json() : [];
        qData = normalizeQuotesResponse(quotesRawGlobal);
      }

      setQuotes(qData);
      quotesFetchedRef.current = true;
    } catch {
      setToast({ message: 'No se pudieron cargar las cotizaciones.', type: 'error' });
    } finally {
      setQuotesLoading(false);
    }
  }, [user?.id_tenant, user?.id_user, quotesLoading]);

  const applyDealPrefill = useCallback(async (allQuotes?: Quote[]) => {
    if (isEditMode || dealPrefillAppliedRef.current || !fromDealId) return;

    const quotePool = allQuotes || quotes;

    const selectedQuote = fromQuoteId
      ? quotePool.find((q: any) => String(q.id_cotizacion) === String(fromQuoteId))
      : undefined;

    let dealName = '';
    try {
      if (user?.id_tenant && user?.id_user) {
        const dealRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${fromDealId}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (dealRes.ok) {
          const dealText = await dealRes.text();
          const parsedDeal = dealText ? JSON.parse(dealText) : null;
          const payload = Array.isArray(parsedDeal) ? (parsedDeal[0] || null) : parsedDeal;
          dealName = payload?.nombre_trato || payload?.title || '';
        }
      }
    } catch {
      // continuar sin bloquear el formulario
    }

    setTransaction(prev => {
      const subtotalValue = selectedQuote?.total ? String(selectedQuote.total) : (prev.subtotal || '');
      const quoteLabel = selectedQuote
        ? getQuoteLabel(selectedQuote)
        : 'cotización seleccionada';
      const sourceNote = dealName
        ? `Registro generado desde trato ganado (${dealName}) y ${quoteLabel}.`
        : `Registro generado desde trato/cotización ganada (${quoteLabel}).`;

      return {
        ...prev,
        invoice_number: prev.invoice_number || suggestInvoiceNumber(fromDealId),
        id_client_company: fromClientId || prev.id_client_company,
        id_related_quote: fromQuoteId || prev.id_related_quote,
        subtotal: subtotalValue,
        total_value: selectedQuote?.total ? Number(selectedQuote.total) : prev.total_value,
        description: prev.description || `Registro desde trato ganado${dealName ? `: ${dealName}` : ''}`,
        notes: prev.notes || sourceNote,
      };
    });

    // Si viene quote_id pero aun no hay catálogo, esperamos al siguiente ciclo.
    if (fromQuoteId && !selectedQuote && !quotePool.length) return;

    dealPrefillAppliedRef.current = true;

    if (fromQuoteId && !selectedQuote) {
      setToast({ message: 'No se encontró la cotización en catálogo. Se cargó borrador parcial.', type: 'success' });
    }
  }, [isEditMode, fromDealId, fromQuoteId, fromClientId, user?.id_tenant, user?.id_user, quotes]);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    const queryParams = new URLSearchParams(location.search);
    const transactionId = queryParams.get('id');
    const isEditingMode = !!transactionId;
    
    try {
      // Si es modo edición, cargar los datos de la transacción
      if (isEditingMode && transactionId) {
        const detailRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${transactionId}`);
        if (detailRes?.ok) {
          const data = await detailRes.json();
          const tx = Array.isArray(data) ? data[0] : data;
          
          if (tx) {
            // Mapear los datos desde el formato de la API al formato del formulario
            // NOTA: Convertimos los números a String para que funcionen bien en los inputs de texto
            const normalized: FinancialFormData = {
              id_transaction: tx.id_transaccion || tx.id_transaction,
              invoice_number: tx.numero_factura || tx.invoice_number,
              description: tx.descripcion_concepto || tx.description,
              transaction_type: normalizeTransactionType(tx.tipo_transaccion || tx.transaction_type),
              status: tx.estado_registro || tx.status,
              issue_date: tx.v_input_fecha_emision || tx.issue_date || tx.fecha_emision?.split('T')[0],
              due_date: tx.v_input_fecha_vencimiento || tx.due_date || tx.fecha_vencimiento?.split('T')[0],
              id_client_company: tx.id_empresa_cliente || tx.id_client_company,
              
              // Valores convertidos a string o vacíos si son 0/null para evitar "0" en el input
              subtotal: tx.subtotal ? String(tx.subtotal) : '',
              tax_amount: tx.impuestos !== undefined ? String(tx.impuestos) : '',
              total_value: tx.total_factura || tx.total_value || 0, // Este es solo referencia inicial
              retention_value: tx.valor_retencion ? String(tx.valor_retencion) : '',
              credit_days: tx.dias_credito ? String(tx.dias_credito) : '',
              
              retention_number: tx.retention_number,
              is_urgent: tx.es_urgente || tx.is_urgent,
              notes: tx.notas_internas || tx.notes,
              enable_automation: tx.enable_automation === true,
              automation_frequency: tx.automation_frequency ? String(tx.automation_frequency) : '3',
              automation_recipients: Array.isArray(tx.automation_recipients) ? tx.automation_recipients : []
            };
            
            setTransaction(normalized);
            
            // Actualizar el breadcrumb
            navigate(location.pathname + location.search, { state: { breadcrumb: normalized.invoice_number }, replace: true });

            // Cargar recipientes
            if (Array.isArray(tx.automation_recipients)) {
              const recipients: SelectedRecipient[] = tx.automation_recipients.map((r: any) => ({
                email: r.email,
                name: r.name,
                type: r.type || 'external',
                id: r.id || null
              }));
              setSelectedRecipients(recipients);
            }
          }
        } else {
          setToast({ message: 'Error al cargar la transacción.', type: 'error' });
        }
      } else {
        setDefaults();
        setLoading(false);
        return;
      }
    } catch (error) {
      setToast({ message: 'Error al cargar recursos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, location.search, navigate]);

  const setDefaults = () => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE',
      issue_date: today,
      due_date: today,
      credit_days: '', // Vacío para permitir placeholder
      subtotal: '',
      tax_amount: '15',
      total_value: 0,
      enable_automation: false,
      automation_frequency: '3',
      retention_value: ''
    });
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!transaction.id_client_company) return;
    if (quotesFetchedRef.current || quotesLoading) return;
    void fetchQuotesCatalog();
  }, [transaction.id_client_company, quotesLoading, fetchQuotesCatalog]);

  useEffect(() => {
    if (!fromDealId || isEditMode || dealPrefillAppliedRef.current) return;
    if (!quotes.length) return;
    void applyDealPrefill(quotes);
  }, [fromDealId, isEditMode, quotes, applyDealPrefill]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // 1. Checkbox
    if (type === 'checkbox') {
        setTransaction(prev => ({ ...prev, [name]: checked }));
        return;
    }

    // 2. Inputs Numéricos (tratados como texto para mejor UX)
    const numericFields = ['subtotal', 'tax_amount', 'retention_value', 'credit_days', 'automation_frequency'];
    
    if (numericFields.includes(name)) {
        // Validar que sea número válido o vacío (Regex: dígitos, opcionalmente un punto, más dígitos)
        if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;

      setTransaction(prev => ({ ...prev, [name]: value }));
        return;
    }

    // 3. Fechas
    if (name === 'issue_date') {
      setTransaction(prev => ({ ...prev, issue_date: value }));
        return;
    }

    // 4. Textos normales
    setTransaction(prev => {
      const updated: any = { ...prev, [name]: value };
      if (name === 'id_client_company') updated.id_related_quote = '';
      return updated;
    });
  };

  const toggleRecipient = (recipient: SelectedRecipient) => {
    setSelectedRecipients(prev => {
      const exists = prev.some(r => r.email === recipient.email);
      return exists ? prev.filter(r => r.email !== recipient.email) : [...prev, recipient];
    });
  };

  const addExternalRecipient = () => {
    if (!externalEmail || !externalName) {
      setToast({ message: 'Complete nombre y email.', type: 'error' });
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(externalEmail)) {
      setToast({ message: 'El email no es válido.', type: 'error' });
      return;
    }
    
    toggleRecipient({ email: externalEmail, name: externalName, type: 'external', id: null });
    setExternalEmail(''); 
    setExternalName('');
  };

  const handleCompanyCreated = async (newCompany: ClientCompany) => {
    await invalidateCompanies();
    setTransaction(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_related_quote: '' }));
    setIsCompanyModalOpen(false);
    setToast({ message: 'Empresa creada.', type: 'success' });
  };

  const handleQuoteSelect = (quoteId: string) => {
    const selectedQuote = filteredQuotes.find(quote => String(quote.id_cotizacion) === String(quoteId));
    const quoteTotal = selectedQuote ? Number(selectedQuote.total || 0) : undefined;

    setTransaction(prev => ({
      ...prev,
      id_related_quote: quoteId,
      subtotal: quoteTotal !== undefined && Number.isFinite(quoteTotal) ? String(quoteTotal) : prev.subtotal,
      total_value: quoteTotal !== undefined && Number.isFinite(quoteTotal) ? quoteTotal : prev.total_value,
    }));
  };

  const handleSave = async () => {
    if (!transaction.invoice_number?.trim() || !transaction.id_client_company || !transaction.description?.trim()) {
      setToast({ message: 'Factura, Cliente y Descripción son obligatorios.', type: 'error' });
      return;
    }
    
    // Convertir strings a números antes de validar
    const finalSubtotal = parseFloat(String(transaction.subtotal)) || 0;
    
    // Validar que el subtotal sea mayor a 0
    if (finalSubtotal <= 0) {
      setToast({ message: 'El subtotal debe ser mayor a cero.', type: 'error' });
      return;
    }

    if (transaction.enable_automation) {
      const cfg = await fetchTenantEmailConfig();
      const canSend = personalEmailReady || Boolean(cfg?.corporate_email_address && cfg?.corporate_send_emails);
      if (!canSend) {
        setToast({ message: 'Recordatorios por correo requieren una integracion activa (personal o corporativa).', type: 'error' });
        return;
      }
    }

    if (transaction.enable_automation && selectedRecipients.length === 0) {
      setToast({ message: 'Selecciona al menos un destinatario para activar recordatorios.', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      const finalTax = parseFloat(String(transaction.tax_amount)) || 0;
      const finalRetention = parseFloat(String(transaction.retention_value)) || 0;
      const grossTotal = finalSubtotal + (finalSubtotal * (finalTax / 100));

      if (finalRetention > grossTotal) {
        setToast({ message: 'El valor retenido no puede ser mayor al total del documento.', type: 'error' });
        return;
      }
      
      // Calcular total final para el backend
      const finalTotal = grossTotal - finalRetention;

      const payload = {
        ...transaction,
        transaction_type: normalizeTransactionType(transaction.transaction_type),
        subtotal: finalSubtotal,
        tax_amount: finalTax,
        retention_value: finalRetention,
        total_value: finalTotal, // Asegurar que el backend reciba el cálculo correcto
        credit_days: parseInt(String(transaction.credit_days)) || 0,
        automation_frequency: parseInt(String(transaction.automation_frequency)) || 3,
        id_tenant: user?.id_tenant,
        id_user: user?.id_user,
        automation_recipients: transaction.enable_automation ? selectedRecipients : []
      };

      let res;
      if (isEditMode) {
        await financialService.update(payload);
        res = { ok: true };
      } else {
        await financialService.create(payload);
        res = { ok: true };
      }

      if (res && !res.ok) throw new Error('Error en respuesta del servidor');
      await invalidateFinancials(getCurrentMonthRange());
      setToast({ message: isEditMode ? 'Registro actualizado.' : 'Registro creado.', type: 'success' });
      setTimeout(() => navigate('/app/financials'), 1000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar. ' + (error instanceof Error ? error.message : ''), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Etiqueta dinámica para el total
  const getActionLabel = () => {
    if (transaction.transaction_type === 'VENTA') return 'A Cobrar';
    if (transaction.transaction_type === 'GASTO') return 'A Pagar';
    return 'Total';
  };

  if (loading) return <div className="p-20 text-center flex flex-col items-center"><BrandSpinner size="lg" className="mb-3" /><p className="text-slate-400 text-sm">Cargando formulario...</p></div>;

  const pageTitle = isEditMode ? 'Editar Transaccion' : 'Nueva Transaccion';
  const pageSubtitle = isEditMode ? 'Actualiza la informacion de la transaccion.' : 'Registra una nueva transaccion financiera.';

  return (
    <div className="bg-[#F9F9F8] text-zinc-900 min-h-screen pb-8 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
              {pageTitle}
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500">
              {pageSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-8 px-3 sm:px-4 bg-white border border-zinc-200 text-zinc-600 rounded-md text-[12px] font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 sm:px-5 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white rounded-md text-[12px] font-semibold hover:from-zinc-800 hover:to-zinc-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
            >
              {saving ? (
                <BrandSpinner size="xs" />
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" />
                  <span className="hidden sm:inline">Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-4 mt-5 pb-6">
      <div className="flex flex-col lg:flex-row items-stretch overflow-visible">
        <div className="w-full lg:w-[65%] px-4 sm:px-6 pt-3 pb-6 border-b lg:border-b-0 lg:border-r border-zinc-200 space-y-6">
          <div className="bg-transparent p-0">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
              <i className="fa-solid fa-file-lines text-[10px]" /> Información del documento
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Número de factura *</label>
                <input
                  name="invoice_number"
                  value={transaction.invoice_number || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                  placeholder="001-001-000000001"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Categoría</label>
                <select
                  name="transaction_type"
                  value={transaction.transaction_type || 'VENTA'}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="VENTA">Venta (Ingreso)</option>
                  <option value="GASTO">Gasto (Egreso)</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Estado</label>
                <select
                  name="status"
                  value={transaction.status || 'PENDIENTE'}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="ANULADO">Anulado</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Descripción / Concepto *</label>
                <textarea
                  name="description"
                  value={transaction.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                  placeholder="Detalle de la transacción..."
                />
              </div>
            </div>
          </div>

          <div className="bg-transparent p-0">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
              <i className="fa-regular fa-building text-[10px]" /> Cliente y documento relacionado
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="flex justify-between items-center mb-1.5 gap-3">
                  <label className="block text-xs font-medium text-zinc-700">Empresa *</label>
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(true)}
                    className="text-[10px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-sky-200"
                  >
                    <i className="fa-solid fa-plus text-[8px]" /> Nueva
                  </button>
                </div>

                {selectedCompany ? (
                  <div className="relative bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1 min-h-[88px]">
                    <button
                      type="button"
                      onClick={() => setTransaction(prev => ({ ...prev, id_client_company: '', id_related_quote: '' }))}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full text-indigo-400 hover:text-rose-500 hover:bg-white/80 transition-colors inline-flex items-center justify-center"
                      title="Quitar empresa"
                    >
                      <i className="fa-solid fa-xmark text-[10px]" />
                    </button>
                    <p className="font-bold text-indigo-900 text-sm pr-6">{selectedCompany.name_company}</p>
                    <p className="text-indigo-700">{selectedCompany.city || '-'} - {selectedCompany.country_name || selectedCompany.id_country || '-'}</p>
                    {selectedCompany.email_company ? <p className="text-indigo-700">{selectedCompany.email_company}</p> : null}
                    {selectedCompany.id_number ? <p className="text-indigo-600 font-mono">{selectedCompany.id_number}</p> : null}
                  </div>
                ) : (
                  <SearchableClientSelector
                    currentId={String(transaction.id_client_company || '')}
                    options={companyOptions}
                    disabled={cacheLoading || saving}
                    onClear={() => setTransaction(prev => ({ ...prev, id_client_company: '', id_related_quote: '' }))}
                    placeholder="Seleccionar una empresa..."
                    searchPlaceholder="Escribe para buscar empresa..."
                    emptyText="No se encontraron empresas"
                    onSelect={(companyId) => setTransaction(prev => ({ ...prev, id_client_company: companyId, id_related_quote: '' }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Vincular cotización</label>
                <SearchableClientSelector
                  currentId={String(transaction.id_related_quote || '')}
                  options={quoteOptions}
                  disabled={!transaction.id_client_company || quotesLoading}
                  onClear={() => setTransaction(prev => ({ ...prev, id_related_quote: '' }))}
                  placeholder={
                    !transaction.id_client_company
                      ? 'Seleccione primero una empresa'
                      : quotesLoading
                        ? 'Cargando cotizaciones...'
                        : 'Seleccionar una cotización...'
                  }
                  searchPlaceholder="Escribe para buscar cotización..."
                  emptyText={quotesLoading ? 'Cargando cotizaciones...' : 'No se encontraron cotizaciones'}
                  onSelect={handleQuoteSelect}
                />
                <p className="mt-2 text-[11px] text-zinc-500">
                  {!transaction.id_client_company
                    ? 'La búsqueda se habilita al seleccionar una empresa.'
                    : quotesLoading
                      ? 'Cargando catálogo de cotizaciones para esta empresa...'
                      : 'Opcional. Puedes dejar este campo vacío.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-transparent p-0">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
              <i className="fa-solid fa-calculator text-[10px]" /> Valores y plazos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Emisión</label>
                <input
                  type="date"
                  name="issue_date"
                  value={transaction.issue_date || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Días crédito</label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="credit_days"
                  value={transaction.credit_days || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Vencimiento</label>
                <input
                  type="date"
                  value={transaction.due_date || ''}
                  readOnly
                  className="w-full text-sm text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">IVA (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="tax_amount"
                  value={transaction.tax_amount || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Subtotal ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="subtotal"
                  value={transaction.subtotal || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  placeholder="0.00"
                />
              </div>

              {!showRetentionSection ? (
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    {getActionLabel()} (menos retención)
                  </p>
                  <p className="text-2xl font-black text-zinc-900 font-mono tracking-tight tabular-nums">
                    {formatCurrency(calculatedTotal)}
                  </p>
                </div>
              ) : null}
            </div>

            {showRetentionSection ? (
              <div className="mt-4 bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <i className="fa-solid fa-file-invoice-dollar text-[10px]" /> Retenciones
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Nro. comprobante</label>
                    <input
                      name="retention_number"
                      value={transaction.retention_number || ''}
                      onChange={handleInputChange}
                      className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2.5 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Ej: 001-001-..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Valor retenido ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      name="retention_value"
                      value={transaction.retention_value || ''}
                      onChange={handleInputChange}
                      className={`w-full text-sm text-rose-600 bg-white border rounded-lg px-3 py-2.5 outline-none shadow-sm font-semibold ${retentionExceedsTotal ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' : 'border-zinc-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'}`}
                      placeholder="0.00"
                    />
                    <p className={`text-[11px] mt-2 ${retentionExceedsTotal ? 'text-rose-600' : 'text-zinc-500'}`}>
                      {retentionExceedsTotal
                        ? `El valor retenido no puede superar ${formatCurrency(grossTotalBeforeRetention)}.`
                        : `Se restará del total a ${transaction.transaction_type === 'VENTA' ? 'cobrar' : 'pagar'}.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 bg-zinc-50 p-6 rounded-xl border border-zinc-200">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                {getActionLabel()} (menos retención)
              </p>
              <p className="text-4xl font-black text-zinc-900 font-mono tracking-tight tabular-nums">
                {formatCurrency(calculatedTotal)}
              </p>
            </div>

            {transaction.enable_automation ? (
              <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
                <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <i className="fa-solid fa-sliders text-[10px]" /> Configuración de recordatorios
                </h2>

                <div className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-lg border border-zinc-200 flex items-center gap-2 shadow-sm">
                  <span className="text-zinc-600">Recordatorio cada</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="automation_frequency"
                    value={transaction.automation_frequency || ''}
                    onChange={handleInputChange}
                    className="w-12 text-center font-bold bg-white border border-zinc-300 outline-none rounded px-1.5 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="3"
                  />
                  <span className="text-zinc-600">días</span>
                </div>

                <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${emailSourceInfo.color}`}>
                  <p className="flex items-start gap-2">
                    <i className={`fa-solid ${emailSourceInfo.icon} mt-0.5 flex-shrink-0`} />
                    <span>{emailSourceInfo.text}</span>
                  </p>
                  <p className="mt-1.5">
                    Los recordatorios de este formulario se envian unicamente por correo electronico.
                  </p>
                </div>

                <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[11px] text-sky-900 flex items-start gap-2.5 leading-relaxed">
                  <i className="fa-solid fa-info-circle mt-0.5 text-sky-600 flex-shrink-0"></i>
                  <div className="space-y-1.5">
                    <p><strong>Horario:</strong> Envío automático desde las 9:00 AM en días laborales.</p>
                    <p><strong>Canal:</strong> Notificaciones por correo a destinatarios seleccionados en este bloque.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Destinatarios de alertas</p>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Contactos empresa</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredContacts.length > 0 ? filteredContacts.map(c => (
                        <label key={c.id_contact} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded text-[11px] cursor-pointer transition-colors border border-transparent hover:border-zinc-100">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.some(r => r.email === (c.email || c.email_contact))}
                            onChange={() => toggleRecipient({ email: c.email || c.email_contact, name: c.first_name + (c.last_name ? ` ${c.last_name}` : ''), type: 'contact', id: c.id_contact })}
                            className="w-3.5 h-3.5 rounded text-blue-600"
                          />
                          <span className="text-zinc-700">{c.first_name} {c.last_name}</span>
                        </label>
                      )) : <p className="text-[11px] text-zinc-400">Sin contactos.</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Mi equipo</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {teamMembers.length > 0 ? teamMembers.map(member => (
                        <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded text-[11px] cursor-pointer transition-colors border border-transparent hover:border-zinc-100">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.some(r => r.email === member.email)}
                            onChange={() => toggleRecipient({ email: member.email, name: member.name, type: 'team', id: member.id })}
                            className="w-3.5 h-3.5 rounded text-blue-600"
                          />
                          <span className="text-zinc-700">{member.name}</span>
                        </label>
                      )) : <p className="text-[11px] text-zinc-400">Sin miembros del equipo.</p>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Externos</p>
                    <div className="grid grid-cols-1 gap-2">
                      <input value={externalName} onChange={e => setExternalName(e.target.value)} className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Nombre" />
                      <input value={externalEmail} onChange={e => setExternalEmail(e.target.value)} className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Email" />
                      <button type="button" onClick={addExternalRecipient} className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition-colors">Agregar</button>
                    </div>
                  </div>

                  {selectedRecipients.length > 0 ? (
                    <div className="pt-3 border-t border-zinc-100">
                      <div className="flex flex-wrap gap-2 max-w-full">
                        {selectedRecipients.map((recipient, index) => (
                          <span key={`${recipient.email}-${index}`} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[11px] font-medium flex items-center gap-1.5 shadow-sm break-all max-w-full">
                            <span className="truncate max-w-[180px]" title={recipient.name}>{recipient.name}</span>
                            <button type="button" onClick={() => toggleRecipient(recipient)} className="text-rose-500 hover:text-rose-700 font-bold text-xs flex-shrink-0">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-full lg:w-[35%] px-4 sm:px-6 pt-3 pb-6 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
              <i className="fa-solid fa-circle-info text-[10px]" /> Control
            </h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg bg-zinc-50/70">
                <span className="text-xs font-medium text-zinc-700 inline-flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px]"></i>
                  Marcar urgente
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={transaction.is_urgent || false}
                  onClick={() => setTransaction(prev => ({ ...prev, is_urgent: !prev.is_urgent }))}
                  className="inline-flex items-center justify-center"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${transaction.is_urgent ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${transaction.is_urgent ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </span>
                </button>
              </label>

              <label className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg bg-zinc-50/70">
                <span className="text-xs font-medium text-zinc-700 inline-flex items-center gap-2">
                  <i className="fa-solid fa-file-invoice-dollar text-zinc-500 text-[10px]"></i>
                  Retención
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showRetentionSection}
                  onClick={() => {
                    const enabled = !showRetentionSection;
                    setShowRetentionSection(enabled);
                    if (!enabled) {
                      setTransaction(prev => ({ ...prev, retention_number: '', retention_value: '' }));
                    }
                  }}
                  className="inline-flex items-center justify-center"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showRetentionSection ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${showRetentionSection ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </span>
                </button>
              </label>

              <label className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg bg-zinc-50/70">
                <span className="text-xs font-medium text-zinc-700 inline-flex items-center gap-2">
                  <i className="fa-regular fa-bell text-zinc-500 text-[10px]"></i>
                  Recordatorio
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={transaction.enable_automation || false}
                  disabled={emailPolicyLoading}
                  onClick={async () => {
                    const enabled = !(transaction.enable_automation || false);
                    if (enabled) {
                      const cfg = await fetchTenantEmailConfig();
                      const canSend = personalEmailReady || Boolean(cfg?.corporate_email_address && cfg?.corporate_send_emails);
                      if (!canSend) {
                        setToast({ message: 'No puedes activar recordatorios sin integracion de correo (personal o corporativa).', type: 'error' });
                        return;
                      }
                    }
                    setTransaction(prev => ({ ...prev, enable_automation: enabled }));
                  }}
                  className="inline-flex items-center justify-center disabled:cursor-not-allowed"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${transaction.enable_automation ? 'bg-emerald-500' : 'bg-slate-300'} ${emailPolicyLoading ? 'opacity-70' : ''}`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${transaction.enable_automation ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </span>
                </button>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-zinc-100">
              <i className="fa-regular fa-note-sticky text-[10px]" /> Notas internas
            </h2>
            <textarea
              name="notes"
              value={transaction.notes || ''}
              onChange={handleInputChange}
              rows={5}
              className="w-full text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Comentarios privados para el equipo..."
            />
          </div>
        </div>
      </div>
      </main>

      <CompanyForm
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        mode="create"
        onSuccess={handleCompanyCreated}
        redirectOnCreate={false}
      />
    </div>
  );
};

export default FinancialForm;
