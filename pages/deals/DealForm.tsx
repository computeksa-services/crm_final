import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { ClientCompany, ClientContact, Deal, User } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG } from '../../services/gatewayConfig';
import Toast from '../../components/Toast';
import { BrandSpinner } from '../../components/AppLoaders';
import CompanyForm from '../clients/CompanyForm';
import ContactForm from '../clients/ContactForm';
import ShareModal from '../../components/ShareModal';

type PermissionLevel = 'VIEW' | 'EDIT' | 'BLOCKED';

type ClassificationOption = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  notifyClient?: boolean;
};

type SearchOption = {
  id: string;
  label: string;
  subLabel?: string;
};

const normalizeText = (value: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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
    // Update internalQuery when currentId or current.label changes, but only if dropdown is closed
    if (!isOpen) {
      setInternalQuery(current?.label || '');
    }
  }, [current?.label, currentId, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset internal query to current label if closed by clicking outside
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
          className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg pl-9 pr-9 py-2 outline-none shadow-sm focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 placeholder:text-zinc-400"
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

const ClassificationSelector: React.FC<{
  currentId: string;
  options: ClassificationOption[];
  onSelect: (id: string) => void;
  disabled: boolean;
  widthClass?: string;
}> = ({ currentId, options, onSelect, disabled, widthClass = 'w-52' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = options.find(o => o.id === currentId) || {
    id: '',
    name: 'Sin valor',
    color: '#94a3b8',
    icon: 'fa-solid fa-circle',
    notifyClient: false,
  };

  const currentIndex = options.findIndex(o => o.id === currentId);
  const optionsAbove = currentIndex > 0 ? options.slice(0, currentIndex) : [];
  const optionsBelow = currentIndex >= 0 && currentIndex < options.length - 1 ? options.slice(currentIndex + 1) : [];

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition(window.innerHeight - rect.bottom < 200 && rect.top > 200 ? 'top' : 'bottom');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const renderNotifyBadge = () => (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">
      <i className="fa-solid fa-envelope text-[8px]" />
    </span>
  );

  const renderOption = (option: ClassificationOption, selected = false) => (
    <>
      <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: option.color || '#94a3b8' }}>
        <i className={`${option.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
      </div>
      <span className="text-[11px] font-medium text-slate-700">{option.name || 'Sin valor'}</span>
      {option.notifyClient ? renderNotifyBadge() : null}
      {selected ? <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" /> : null}
    </>
  );

  return (
    <div className="relative inline-flex max-w-full items-center align-middle" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 min-h-[20px] rounded text-[10px] font-semibold transition-all whitespace-nowrap ${
          disabled ? 'cursor-default' : 'hover:brightness-95 cursor-pointer'
        }`}
        style={{ backgroundColor: current.color || '#94a3b8', color: '#ffffff' }}
      >
        <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
          <i className={`${current.icon || 'fa-solid fa-circle'} text-[9px] leading-none`} />
        </span>
        <span>{current.name || 'Sin valor'}</span>
        {current.notifyClient ? (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none text-white">
            <i className="fa-solid fa-envelope text-[8px] leading-none" />
          </span>
        ) : null}
        {!disabled ? (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-0.5 text-white">
            <i className="fa-solid fa-chevron-down text-[7px] leading-none" />
          </span>
        ) : null}
      </button>

      {isOpen && !disabled ? (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 ${widthClass} bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {optionsAbove.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(option.id);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                {renderOption(option)}
              </button>
            ))}

            <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
              <div className="flex items-center gap-2 text-slate-500 cursor-not-allowed">
                {renderOption(current, true)}
              </div>
            </div>

            {optionsBelow.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(option.id);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
              >
                {renderOption(option)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DealForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const {
    companies: cachedCompanies,
    contacts: cachedContacts,
    dealStatuses: cachedDealStatuses,
    dealInterests: cachedDealInterests,
    dealChannels: cachedDealChannels,
    users: cachedUsers,
    loading: cacheLoading,
    invalidateContacts,
    invalidateCompanies,
  } = useDataCache();

  const [deal, setDeal] = useState<Partial<Deal>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isConversion, setIsConversion] = useState(false);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');

  const [collaboratorPermissions, setCollaboratorPermissions] = useState<Record<string, PermissionLevel>>({});
  const [isPreShareOpen, setIsPreShareOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  useEffect(() => {
    if (cacheLoading || !user) return;

    const queryParams = new URLSearchParams(location.search);
    const dealId = queryParams.get('id');
    setCurrentDealId(dealId);
    if (!dealId) {
      // Clear stale modal state when entering create mode.
      setIsShareOpen(false);
      setIsPreShareOpen(false);
    }

    if (dealId) {
      const loadDeal = async () => {
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${dealId}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
          if (!res.ok) return;

          const text = await res.text();
          const parsed = text ? JSON.parse(text) : null;
          const payload = Array.isArray(parsed) ? (parsed[0] || null) : parsed;

          if (!payload) return;

          setDeal({
            id_trato: payload.id_trato,
            nombre_trato: payload.nombre_trato,
            valor_trato: String(payload.valor_numeric || ''),
            descripcion: payload.deal_description,
            id_client_company: payload.company_details?.id || payload.id_client_company,
            id_contact: payload.contact_details?.id || payload.id_contact,
            id_deal_status: payload.estado_actual?.id || payload.id_deal_status,
            id_interest: payload.interes_actual?.id || payload.id_interest,
            channel: payload.channel,
            id_tenant: payload.id_tenant || user.id_tenant,
            id_user_owner: payload.owner_id,
            id_user: payload.owner_id,
          });
          
          // Convertir ISO date a YYYY-MM-DD para input type="date"
          let closeDate = payload.expected_close_date || '';
          if (closeDate && closeDate.includes('T')) {
            closeDate = closeDate.split('T')[0]; // "2027-10-01T00:00:00.000Z" -> "2027-10-01"
          }
          setExpectedCloseDate(closeDate);

          const initialCollaboratorPermissions: Record<string, PermissionLevel> = {};
          const mappedShareCollaborators = (payload.collaborators || []).map((c: any) => {
            if (String(c.id_user) !== String(user.id_user)) {
              initialCollaboratorPermissions[c.id_user] = (c.permission_level || '').toUpperCase() as PermissionLevel;
            }
            return {
              id_user: c.id_user,
              name: c.name || c.name_user || c.id_user,
              avatar: c.avatar || c.avatar_url || null,
              permission_level: (c.permission_level || '').toUpperCase() || 'VIEW',
              is_owner: Boolean(c.is_owner || (c.permission_level || '').toUpperCase() === 'OWNER'),
            };
          });
          setCollaboratorPermissions(initialCollaboratorPermissions);
          setShareCollaborators(mappedShareCollaborators);
        } catch {
          setToast({ message: 'Error al cargar el trato', type: 'error' });
        }
      };

      loadDeal();
      return;
    }

    const defaultStatus = cachedDealStatuses.find(s => s.is_default) || cachedDealStatuses[0];
    const defaultInterest = cachedDealInterests.find(i => i.is_default) || cachedDealInterests[0];
    const defaultChannel = cachedDealChannels.find(c => c.is_default) || cachedDealChannels[0];

    const stateData = location.state as any;
    const clientCompanyId = stateData?.companyId || queryParams.get('clientCompanyId');
    const contactId = stateData?.contactId || queryParams.get('contactId');
    const contactName = stateData?.contactName;
    const companyName = stateData?.companyName;
    const isConversionMode = stateData?.is_conversion || false;

    const initialState: Partial<Deal> = {
      nombre_trato: contactName ? `Trato - ${contactName}` : '',
      valor_trato: '',
      descripcion: companyName ? `Oportunidad de negocio con ${companyName}` : '',
      id_deal_status: defaultStatus?.id_status,
      id_interest: defaultInterest?.id_interest,
      channel: defaultChannel?.id_channel,
      id_tenant: user.id_tenant,
      id_user_owner: user.id_user,
      id_user: user.id_user,
    };

    if (clientCompanyId && contactId) {
      setIsConversion(isConversionMode);
      initialState.id_client_company = clientCompanyId;
      initialState.id_contact = contactId;
    }

    setDeal(initialState);
  }, [
    cacheLoading,
    user,
    location.search,
    location.state,
    cachedDealStatuses,
    cachedDealInterests,
    cachedDealChannels,
  ]);

  const filteredContacts = useMemo(() => {
    if (!deal.id_client_company) return [];
    return cachedContacts.filter(c => String(c.id_client_company) === String(deal.id_client_company));
  }, [deal.id_client_company, cachedContacts]);

  const companyOptions = useMemo(
    () => [...cachedCompanies]
      .sort((a, b) => (a.name_company || '').localeCompare(b.name_company || '', 'es', { sensitivity: 'base' }))
      .map(c => ({
        id: String(c.id_client_company),
        label: c.name_company,
        subLabel: [c.city, c.country_name || c.id_country].filter(Boolean).join(' - '),
      })),
    [cachedCompanies]
  );

  const contactOptions = useMemo(
    () => [...filteredContacts]
      .sort((a, b) => `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`, 'es', { sensitivity: 'base' }))
      .map(c => ({
        id: String(c.id_contact),
        label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre',
        subLabel: [c.position, c.email].filter(Boolean).join(' - '),
      })),
    [filteredContacts]
  );

  const statusOptions = useMemo(
    () => cachedDealStatuses.map((s: any) => ({
      id: String(s.id_status || s.id || ''),
      name: s.name || 'Sin valor',
      color: s.color || '#94a3b8',
      icon: s.icon || 'fa-solid fa-circle',
      notifyClient: Boolean(s.notify_client),
    })),
    [cachedDealStatuses]
  );

  const interestOptions = useMemo(
    () => cachedDealInterests.map((i: any) => ({
      id: String(i.id_interest || i.id || ''),
      name: i.name || 'Sin valor',
      color: i.color || '#94a3b8',
      icon: i.icon || 'fa-solid fa-circle',
      notifyClient: false,
    })),
    [cachedDealInterests]
  );

  const channelOptions = useMemo(
    () => cachedDealChannels.map((c: any) => ({
      id: String(c.id_channel || c.id || ''),
      name: c.name || c.channel_name || 'Sin valor',
      color: c.color || '#94a3b8',
      icon: c.icon || 'fa-solid fa-circle',
      notifyClient: false,
    })),
    [cachedDealChannels]
  );

  const selectedCompany = useMemo(
    () => cachedCompanies.find(c => String(c.id_client_company) === String(deal.id_client_company)),
    [cachedCompanies, deal.id_client_company]
  );

  const selectedContact = useMemo(
    () => cachedContacts.find(c => String(c.id_contact) === String(deal.id_contact)),
    [cachedContacts, deal.id_contact]
  );

  const availableUsers = useMemo(
    () => cachedUsers.filter((u: User) => u.id_user !== user?.id_user),
    [cachedUsers, user?.id_user]
  );

  useEffect(() => {
    if (!availableUsers.length) return;
    setCollaboratorPermissions(prev => {
      const next = { ...prev };
      availableUsers.forEach(u => {
        if (!next[u.id_user]) next[u.id_user] = 'BLOCKED';
      });
      return next;
    });
  }, [availableUsers]);

  const assignedCollaborators = useMemo(() => {
    const owner = {
      id_user: user?.id_user || '',
      name: user?.name_user || 'Usuario',
      avatar: user?.avatar_url,
      permission_level: 'OWNER',
      is_owner: true,
    };

    const mapped = availableUsers
      .filter(u => collaboratorPermissions[u.id_user] && collaboratorPermissions[u.id_user] !== 'BLOCKED')
      .map(u => ({
        id_user: u.id_user,
        name: u.name_user,
        avatar: u.avatar_url,
        permission_level: collaboratorPermissions[u.id_user] === 'EDIT' ? 'EDIT' : 'VIEW',
        is_owner: false,
      }));

    return [owner, ...mapped];
  }, [availableUsers, collaboratorPermissions, user]);

  const selectedCollaboratorsCount = useMemo(
    () => Object.values(collaboratorPermissions).filter(permission => permission !== 'BLOCKED').length,
    [collaboratorPermissions]
  );

  const displayedCollaborators = useMemo(() => {
    if (currentDealId && shareCollaborators.length > 0) return shareCollaborators;
    return assignedCollaborators;
  }, [currentDealId, shareCollaborators, assignedCollaborators]);

  const refreshShareCollaborators = useCallback(async (dealId?: string) => {
    const targetDealId = dealId || currentDealId;
    if (!targetDealId) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${targetDealId}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list.map((u: any) => {
        const cachedUser = cachedUsers?.find((cu: any) => String(cu.id_user) === String(u.id_user));
        return {
          id_user: u.id_user,
          name: u.name || u.name_user || cachedUser?.name_user || cachedUser?.email_user || u.id_user,
          avatar: u.avatar || u.avatar_url || cachedUser?.avatar_url || null,
          permission_level: (u.permission_level || '').toUpperCase() || 'VIEW',
          rol_user: u.rol_user || cachedUser?.rol_user,
          is_owner: Boolean(u.is_owner || (u.permission_level || '').toUpperCase() === 'OWNER'),
        };
      });
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
  }, [currentDealId, cachedUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'valor_trato' && value && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setDeal(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanyCreated = async (newCompany: ClientCompany) => {
    setDeal(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
    setIsCompanyModalOpen(false);
    await invalidateCompanies();
    setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
  };

  const handleContactCreated = async (newContact: ClientContact) => {
    setDeal(prev => ({ ...prev, id_contact: newContact.id_contact }));
    setIsContactModalOpen(false);
    await invalidateContacts();
    setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
  };

  const saveCollaborators = async (dealId: string) => {
    const permissions = Object.entries(collaboratorPermissions)
      .filter(([, permission]) => permission !== 'BLOCKED')
      .map(([idUser, permission]) => ({
        id_user: idUser,
        permission_level: permission,
      }));

    if (!permissions.length) return;

    const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_trato: dealId, permissions }),
    });

    if (!res.ok) throw new Error('Trato guardado, pero fallo la asignacion de colaboradores');
  };

  const handleSave = async () => {
    if (!deal.nombre_trato || !deal.id_client_company || !deal.id_contact || !deal.id_deal_status) {
      setToast({ message: 'Nombre, Empresa, Contacto y Estado son obligatorios.', type: 'error' });
      return;
    }

    const queryParams = new URLSearchParams(location.search);
    const dealId = queryParams.get('id');
    const isEditMode = !!dealId;

    // El creador siempre cuenta como colaborador, no es necesario asignar más
    
    setProcessing(true);
    try {
      const payload = {
        ...deal,
        expected_close_date: expectedCloseDate,
        ...(isEditMode ? {} : { created_at: new Date().toISOString(), is_conversion: isConversion }),
      };

      const endpoint = isEditMode
        ? GATEWAY_CONFIG.API.DEALS.UPDATE
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/deals`;

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = `Error al ${isEditMode ? 'actualizar' : 'crear'} el trato`;
        try {
          if (text) {
            const err = JSON.parse(text);
            errorMsg = err.message || errorMsg;
          }
        } catch {
          // Keep default message when payload is not JSON.
        }
        throw new Error(errorMsg);
      }

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const newId = dealId || data?.id_trato || data?.id || data?.data?.id_trato;

      if (!newId) throw new Error('No se obtuvo el ID del trato');

      // Doble llamada: primero persistir el trato, luego permisos de colaboradores.
      await saveCollaborators(newId);
      await invalidateContacts();

      // Defensive reset to avoid stale modal flashes from previous navigation.
      setIsShareOpen(false);
      setIsPreShareOpen(false);
      setCurrentDealId(newId);
      setToast({ message: `Trato ${isEditMode ? 'actualizado' : 'creado'} correctamente.`, type: 'success' });

      if (isEditMode) {
        setTimeout(() => navigate(`/app/deals/${newId}`, { state: { refresh: Date.now() } }), 900);
      } else {
        setTimeout(() => navigate(`/app/deals/${newId}`, { state: { refresh: Date.now() } }), 900);
      }
    } catch (e: any) {
      setToast({ message: e.message || 'Error en el proceso', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const queryParams = new URLSearchParams(location.search);
  const isEditing = !!queryParams.get('id');

  return (
    <div className="bg-[#F9F9F8] text-zinc-900 min-h-screen pb-5 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
              {isEditing ? 'Editar Trato' : 'Nuevo Trato'}
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500">
              {isEditing ? 'Actualiza los datos de la oportunidad.' : 'Registra un nuevo trato y clasificalo.'}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate(-1)}
              className="h-8 px-3 sm:px-4 bg-white border border-zinc-200 text-zinc-600 rounded-md text-[12px] font-medium hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={processing || cacheLoading}
              className="h-8 px-4 sm:px-5 bg-zinc-900 text-white rounded-md text-[12px] font-medium hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
            >
              {processing ? (
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
          <div className="w-full lg:w-[65%] px-4 sm:px-6 pt-3 pb-6 border-b lg:border-b-0 lg:border-r border-zinc-200">
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <i className="fa-solid fa-layer-group" /> Informacion
            </h3>

            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Nombre de la Oportunidad *</label>
                <input
                  name="nombre_trato"
                  value={deal.nombre_trato || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
                  placeholder="Ej. Venta de Servidores Cloud"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Valor Estimado</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm font-semibold text-zinc-400">$</span>
                    <input
                      name="valor_trato"
                      value={deal.valor_trato || ''}
                      onChange={handleInputChange}
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono font-medium text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all shadow-sm placeholder:text-zinc-400"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Cierre Estimado</label>
                  <input
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-medium text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all shadow-sm cursor-pointer"
                  />
                </div>
              </div>

            </div>

            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <i className="fa-regular fa-building" /> Cliente
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-zinc-700">Empresa *</label>
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(true)}
                    className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-zinc-200/50"
                  >
                    <i className="fa-solid fa-plus text-[8px]" /> Nueva
                  </button>
                </div>
                <SearchableClientSelector
                  currentId={String(deal.id_client_company || '')}
                  options={companyOptions}
                  disabled={cacheLoading || isConversion}
                  onClear={() => setDeal(prev => ({ ...prev, id_client_company: '', id_contact: '' }))}
                  placeholder="Seleccionar una empresa..."
                  searchPlaceholder="Escribe para buscar empresa..."
                  emptyText="No se encontraron empresas"
                  onSelect={(id) => setDeal(prev => ({ ...prev, id_client_company: id, id_contact: '' }))}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-zinc-700">Contacto principal *</label>
                  <button
                    type="button"
                    onClick={() => setIsContactModalOpen(true)}
                    className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-zinc-200/50"
                    disabled={!deal.id_client_company}
                  >
                    <i className="fa-solid fa-plus text-[8px]" /> Nuevo
                  </button>
                </div>
                <SearchableClientSelector
                  currentId={String(deal.id_contact || '')}
                  options={contactOptions}
                  disabled={cacheLoading || isConversion || !deal.id_client_company}
                  onClear={() => setDeal(prev => ({ ...prev, id_contact: '' }))}
                  placeholder={deal.id_client_company ? 'Seleccionar un contacto...' : 'Selecciona empresa primero'}
                  searchPlaceholder="Escribe para buscar contacto..."
                  emptyText="No se encontraron contactos"
                  onSelect={(id) => setDeal(prev => ({ ...prev, id_contact: id }))}
                />
              </div>
            </div>

            {(selectedCompany || selectedContact) && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedCompany && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-indigo-900 text-sm">{selectedCompany.name_company}</p>
                    <p className="text-indigo-700">{selectedCompany.city || '-'} • {selectedCompany.country_name || selectedCompany.id_country || '-'}</p>
                    {selectedCompany.email_company && <p className="text-indigo-700">{selectedCompany.email_company}</p>}
                  </div>
                )}
                {selectedContact && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-zinc-800 text-sm">{selectedContact.first_name} {selectedContact.last_name}</p>
                    <p className="text-zinc-600">{selectedContact.position || 'Sin cargo'}</p>
                    {selectedContact.email && <p className="text-zinc-600">{selectedContact.email}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Descripcion o Notas</label>
              <textarea
                name="descripcion"
                value={deal.descripcion || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm resize-none placeholder:text-zinc-400"
                placeholder="Anade contexto adicional o detalles clave..."
              />
            </div>
          </div>

          <div className="w-full lg:w-[35%] px-4 sm:px-6 pt-3 pb-6 flex flex-col">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">Acerca del trato</h3>

            <div className="space-y-1">
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-solid fa-bars-progress w-4 text-center"></i>
                  Estado
                </div>
                <div className="w-2/3 flex items-center gap-2 min-h-[24px]">
                  <ClassificationSelector
                    currentId={String(deal.id_deal_status || '')}
                    options={statusOptions}
                    disabled={cacheLoading}
                    onSelect={(id) => setDeal(prev => ({ ...prev, id_deal_status: id }))}
                  />
                </div>
              </div>

              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-regular fa-star w-4 text-center"></i>
                  Interés
                </div>
                <div className="w-2/3 flex items-center gap-2 min-h-[24px] text-zinc-700 text-[13px]">
                  <ClassificationSelector
                    currentId={String(deal.id_interest || '')}
                    options={interestOptions}
                    disabled={cacheLoading}
                    onSelect={(id) => setDeal(prev => ({ ...prev, id_interest: id }))}
                  />
                </div>
              </div>

              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-solid fa-bullhorn w-4 text-center"></i>
                  Origen
                </div>
                <div className="w-2/3 flex items-center gap-2 min-h-[24px] text-zinc-700 text-[13px]">
                  <ClassificationSelector
                    currentId={String(deal.channel || '')}
                    options={channelOptions}
                    disabled={cacheLoading}
                    onSelect={(id) => setDeal(prev => ({ ...prev, channel: id }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-4">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                Equipo asignado
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-bold">{displayedCollaborators.length}</span>
              </h3>
              <div className="space-y-2.5 text-left">
                {displayedCollaborators.map(collab => {
                  const level = String(collab.permission_level || '').toUpperCase();
                  const isOwner = level === 'OWNER' || collab.is_owner;
                  const roleText = isOwner ? 'Propietario' : level === 'EDIT' ? 'Principal' : 'Secundario';
                  const isCurrentUser = String(collab.id_user || '') === String(user?.id_user || '');

                  const handleRemove = async () => {
                    if (isEditing) {
                      try {
                        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id_trato: currentDealId, permissions: [{ id_user: collab.id_user, permission_level: 'BLOCKED' }] }),
                        });
                        setShareCollaborators(prev => prev.filter(c => c.id_user !== collab.id_user));
                      } catch {
                        setToast({ message: 'Error al eliminar colaborador.', type: 'error' });
                      }
                    } else {
                      setCollaboratorPermissions(prev => ({ ...prev, [collab.id_user]: 'BLOCKED' }));
                    }
                  };

                  return (
                    <div key={collab.id_user} className="flex items-center justify-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm">
                      <div className="shrink-0 w-9 h-9 flex items-center justify-center self-center">
                        {collab.avatar ? (
                          <img src={collab.avatar} alt={collab.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-700">
                            {collab.name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[13px] font-semibold text-zinc-900 truncate">
                          {collab.name || collab.id_user}
                          {isCurrentUser && <span className="text-zinc-400 font-medium"> (Tu)</span>}
                        </p>
                        <p className="text-[12px] text-zinc-500 leading-tight">{roleText}</p>
                      </div>
                      {!isOwner && (
                        <button
                          type="button"
                          onClick={handleRemove}
                          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Quitar colaborador"
                        >
                          <i className="fa-solid fa-xmark text-[10px]" />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    if (!isEditing) {
                      setIsPreShareOpen(true);
                      return;
                    }
                    refreshShareCollaborators();
                    setIsShareOpen(true);
                  }}
                  className="w-full rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors px-2 py-2 text-left"
                >
                  <span className="inline-flex items-center justify-start gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-600 inline-flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-plus text-[11px]" />
                    </span>
                    <span className="text-[12px] font-medium">
                      Añadir colaborador
                    </span>
                  </span>
                </button>

              </div>
            </div>
          </div>
        </div>
      </main>

      <CompanyForm
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        mode="create"
        onSuccess={handleCompanyCreated}
      />

      <ContactForm
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        mode="create"
        initialData={deal.id_client_company ? { id_client_company: deal.id_client_company } : undefined}
        onSuccess={handleContactCreated}
        companies={cachedCompanies}
      />

      {isPreShareOpen && (
        <ShareModal
          entity="deal"
          id="draft"
          entityName={deal.nombre_trato || 'Trato'}
          creatorName={user?.name_user || ''}
          isOpen={isPreShareOpen}
          localOnly
          onLocalApply={(permissions) => {
            const sanitized: Record<string, PermissionLevel> = {};
            Object.entries(permissions).forEach(([idUser, permission]) => {
              if (idUser === user?.id_user) return;
              sanitized[idUser] = permission;
            });
            setCollaboratorPermissions(prev => ({ ...prev, ...sanitized }));
          }}
          onClose={() => setIsPreShareOpen(false)}
          currentCollaborators={[
            {
              id_user: user?.id_user || '',
              name: user?.name_user || 'Usuario',
              permission_level: 'OWNER',
              avatar: user?.avatar_url,
              rol_user: user?.rol_user,
              is_owner: true,
            },
            ...availableUsers.map(u => ({
              id_user: u.id_user,
              name: u.name_user,
              permission_level: collaboratorPermissions[u.id_user] || 'BLOCKED',
              avatar: u.avatar_url,
              rol_user: u.rol_user,
              is_owner: false,
            })),
          ]}
        />
      )}

      {isShareOpen && currentDealId && (
        <ShareModal
          entity="deal"
          id={currentDealId}
          entityName={deal.nombre_trato || 'Trato'}
          creatorName={user?.name_user || ''}
          isOpen={isShareOpen}
          onClose={() => {
            setIsShareOpen(false);
            if (!isEditing) {
              navigate(`/app/deals/${currentDealId}`);
            }
          }}
          onShared={() => {
            setToast({ message: 'Colaboradores actualizados', type: 'success' });
            refreshShareCollaborators();
          }}
          currentCollaborators={shareCollaborators.length ? shareCollaborators : [{
            id_user: user?.id_user || '',
            name: user?.name_user || 'Usuario',
            permission_level: 'OWNER',
            avatar: user?.avatar_url,
            rol_user: user?.rol_user,
            is_owner: true,
          }]}
        />
      )}
    </div>
  );
};

export default DealForm;

