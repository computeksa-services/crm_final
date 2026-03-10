import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { ClientCompany, ClientContact, Deal, Quote, UserDecision } from '../../types';
import { apiFetch } from '../../services/apiClient';
import Toast from '../../components/Toast';
import { BrandSpinner } from '../../components/AppLoaders';
import CompanyForm from '../clients/CompanyForm';
import ContactForm from '../clients/ContactForm';

const PAYMENT_PRESETS = ['Contado', '15 dias', '30 dias', '60 dias', '90 dias'];
const normalizeCondition = (value?: string) =>
	(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase();
const isPresetCondition = (value?: string) => PAYMENT_PRESETS.some((option) => normalizeCondition(option) === normalizeCondition(value));

type SearchOption = {
	id: string;
	label: string;
	subLabel?: string;
};

type ClassificationOption = {
	id: string;
	name: string;
	color?: string;
	icon?: string;
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
	placeholder?: string;
	widthClass?: string;
}> = ({ currentId, options, onSelect, disabled, placeholder = 'Sin valor', widthClass = 'w-full' }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const current = options.find(o => o.id === currentId) || {
		id: '',
		name: placeholder,
		color: '#94a3b8',
		icon: 'fa-solid fa-circle',
	};

	const currentIndex = options.findIndex(o => o.id === currentId);
	const optionsAbove = currentIndex > 0 ? options.slice(0, currentIndex) : [];
	const optionsBelow = currentIndex >= 0 && currentIndex < options.length - 1 ? options.slice(currentIndex + 1) : currentIndex === -1 ? options : [];

	useEffect(() => {
		if (isOpen && buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			setDropdownPosition(window.innerHeight - rect.bottom < 220 && rect.top > 220 ? 'top' : 'bottom');
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

	const renderOption = (option: ClassificationOption, selected = false) => (
		<>
			<div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: option.color || '#94a3b8' }}>
				<i className={`${option.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
			</div>
			<span className="text-[11px] font-medium text-slate-700">{option.name || placeholder}</span>
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
				className={`inline-flex ${widthClass} items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-all ${
					disabled ? 'cursor-default bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
				}`}
			>
				<div className="inline-flex items-center gap-2 min-w-0">
					<div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: current.color || '#94a3b8' }}>
						<i className={`${current.icon || 'fa-solid fa-circle'} text-[9px] text-white`} />
					</div>
					<div className="min-w-0">
						<p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Selección</p>
						<p className="text-[13px] font-semibold text-zinc-800 truncate">{current.name || placeholder}</p>
					</div>
				</div>
				<i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[10px] ${disabled ? 'text-zinc-300' : 'text-zinc-400'}`} />
			</button>

			{isOpen && !disabled ? (
				<div className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 ${widthClass} bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}>
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
								className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
							>
								{renderOption(option)}
							</button>
						))}

						<div className="bg-slate-50 border-y border-slate-100 px-3 py-2">
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
								className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
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

const QuoteForm: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();
	const {
		companies,
		contacts,
		dealInterests,
		dealChannels,
		loading: cacheLoading,
		invalidateCompanies,
		invalidateContacts,
	} = useDataCache();

	const [deals, setDeals] = useState<Deal[]>([]);

	const [quote, setQuote] = useState<Partial<Quote>>({});
	const [newDeal, setNewDeal] = useState<any>({});
	const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
	const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
	const [ccError, setCcError] = useState<string | null>(null);
	const [ccInput, setCcInput] = useState('');

	const [createNewDeal, setCreateNewDeal] = useState(false);
	const [isLinkingDeal, setIsLinkingDeal] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

	const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
	const [isContactModalOpen, setIsContactModalOpen] = useState(false);
	const [condicionOption, setCondicionOption] = useState<string>('');

	const invalidateQuotesListCache = useCallback(() => {
		if (!user?.id_user) return;
		localStorage.removeItem(`quotes_list_cache_${user.id_user}_active`);
		localStorage.removeItem(`quotes_list_cache_${user.id_user}_archived`);
	}, [user?.id_user]);

	const fetchData = useCallback(async () => {
		if (!user?.id_tenant || !user?.id_user) return;

		const tenantId = user.id_tenant;
		const userId = user.id_user;
		const queryParams = new URLSearchParams(location.search);

		const dealId = queryParams.get('dealId');
		const clientCompanyId = queryParams.get('clientCompanyId');
		const contactId = queryParams.get('contactId');
		const dealName = queryParams.get('dealName');
		const quoteId = queryParams.get('id');

		try {
			setIsLoading(true);

			if (dealId) {
				const dealsRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals?id_tenant=${tenantId}&id_user=${userId}`);
				let dealsData: Deal[] = [];

				if (dealsRes.ok) {
					const text = await dealsRes.text();
					if (text && text.trim() !== '' && text !== 'null') {
						dealsData = JSON.parse(text);
					}
				}
				setDeals(dealsData);
			}

			if (quoteId) {
				const quoteRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/detail?id_cotizacion=${quoteId}&id_tenant=${tenantId}&id_user=${userId}`);
				if (!quoteRes.ok) throw new Error('No se pudo cargar la cotizacion');
				const quoteText = await quoteRes.text();
				const quoteData = quoteText ? JSON.parse(quoteText) : null;
				const q = Array.isArray(quoteData) ? quoteData[0] : quoteData;
				if (q) {
					setQuote(q);
					setCondicionOption(q.condicion_pago && isPresetCondition(q.condicion_pago)
						? PAYMENT_PRESETS.find((option) => normalizeCondition(option) === normalizeCondition(q.condicion_pago)) || ''
						: (q.condicion_pago ? 'OTRO' : ''));
					if (q.id_trato) {
						setIsLinkingDeal(true);
					}
					if (q.id_client_company) {
						setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(q.id_client_company)));
					}
				}
			} else {
				const defaultInterest = dealInterests.find((s) => s.is_default) || dealInterests[0];
				const defaultChannel = dealChannels.find((c) => c.is_default) || dealChannels[0];
				const initialQuote: Partial<Quote> = {
					nombre_cotizacion: dealName ? `Cotizacion para ${dealName}` : '',
					id_trato: dealId || '',
					id_client_company: clientCompanyId || '',
					id_contact: contactId || '',
					tiempo_entrega: '5-7 dias laborables',
					garantia: '12 meses',
					validez_oferta: '30 dias',
					condicion_pago: '',
					nota: '',
					mensaje: '',
					correos_adicionales: '',
					id_tenant: tenantId,
					id_user: userId,
					version: 0,
					estado_decision: UserDecision.PENDING,
					total: '$0.00',
					is_private: false,
				};
				setQuote(initialQuote);
				setCondicionOption(
					initialQuote.condicion_pago && isPresetCondition(initialQuote.condicion_pago)
						? PAYMENT_PRESETS.find((option) => normalizeCondition(option) === normalizeCondition(initialQuote.condicion_pago)) || ''
						: (initialQuote.condicion_pago ? 'OTRO' : '')
				);
				if (initialQuote.id_client_company) {
					setFilteredContacts(contacts.filter((c: ClientContact) => String(c.id_client_company) === String(initialQuote.id_client_company)));
					setFilteredDeals(deals.filter((d: Deal) => String(d.id_client_company) === String(initialQuote.id_client_company)));
				}
				setNewDeal({
					nombre_trato: dealName ? `Trato - ${dealName}` : '',
					id_client_company: clientCompanyId || '',
					id_contact: contactId || '',
					id_interest: (defaultInterest as any)?.id_status || (defaultInterest as any)?.id_interest || '',
					id_channel: defaultChannel?.id_channel || '',
					id_tenant: tenantId,
					id_user_owner: userId,
					id_user: userId,
					descripcion: '',
				});
			}
		} catch (error) {
			console.error('Error loading data:', error);
			setToast({ message: 'Error al cargar datos del sistema.', type: 'error' });
		} finally {
			setIsLoading(false);
		}
	}, [user, location.search, contacts, dealInterests, dealChannels, deals]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	useEffect(() => {
		if (quote?.nombre_cotizacion && location.pathname.includes('/edit')) {
			navigate(location.pathname + location.search, {
				state: { breadcrumb: quote.nombre_cotizacion },
				replace: true,
			});
		}
	}, [quote?.nombre_cotizacion, location.pathname, location.search, navigate]);

	useEffect(() => {
		if (quote?.id_client_company) {
			setFilteredContacts(contacts.filter(c => String(c.id_client_company).trim() === String(quote.id_client_company).trim()));
		} else {
			setFilteredContacts([]);
		}
	}, [quote?.id_client_company, contacts]);

	useEffect(() => {
		const fetchDealsByCompany = async () => {
			if (!quote?.id_client_company || !user?.id_tenant || !user?.id_user) {
				setFilteredDeals([]);
				return;
			}
			try {
				const params = new URLSearchParams({
					id_tenant: user.id_tenant,
					id_user: user.id_user,
					id_client_company: String(quote.id_client_company),
				}).toString();

				const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/by_company?${params}`);
				if (!res.ok) throw new Error('No se pudieron cargar los tratos de la empresa');

				const data = await res.json();
				let tratos = data?.data?.tratos || data?.tratos || data || [];
				if (!Array.isArray(tratos)) tratos = [];
				setFilteredDeals(tratos);
			} catch (e) {
				console.error('Error al llamar a /api/deals/by_company:', e);
				setFilteredDeals([]);
			}
		};
		fetchDealsByCompany();
	}, [quote?.id_client_company, user?.id_tenant, user?.id_user]);

	const selectedCompany = useMemo(
		() => companies.find(c => String(c.id_client_company) === String(quote.id_client_company)),
		[companies, quote.id_client_company]
	);

	const selectedContact = useMemo(
		() => contacts.find(c => String(c.id_contact) === String(quote.id_contact)),
		[contacts, quote.id_contact]
	);

	const companyOptions = useMemo(
		() => [...companies]
			.sort((a, b) => (a.name_company || '').localeCompare(b.name_company || '', 'es', { sensitivity: 'base' }))
			.map(c => ({
				id: String(c.id_client_company),
				label: c.name_company,
				subLabel: [c.city, c.country_name || c.id_country].filter(Boolean).join(' - '),
			})),
		[companies]
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

	const interestOptions = useMemo(
		() => dealInterests.map((option: any) => ({
			id: String(option.id_status || option.id_interest || option.id || ''),
			name: option.name || 'Sin valor',
			color: option.color || '#3b82f6',
			icon: option.icon || 'fa-solid fa-star',
		})),
		[dealInterests]
	);

	const channelOptions = useMemo(
		() => dealChannels.map((option: any) => ({
			id: String(option.id_channel || option.id || ''),
			name: option.name || option.channel_name || 'Sin valor',
			color: option.color || '#10b981',
			icon: option.icon || 'fa-solid fa-bullhorn',
		})),
		[dealChannels]
	);

	const handleDealDropdownOpen = async () => {
		if (deals.length === 0 && user?.id_tenant && user?.id_user) {
			try {
				const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
				if (res.ok) {
					const text = await res.text();
					if (text && text.trim() !== '' && text !== 'null') {
						const dealsData = JSON.parse(text);
						setDeals(dealsData);
					}
				}
			} catch (e) {
				console.error('Error loading deals:', e);
			}
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
		const { name, value } = e.target;
		if (name === 'correos_adicionales') {
			setCcInput(value);
			return;
		}
		if (name === 'id_client_company') {
			if (value === '__ADD_NEW_COMPANY__') {
				setIsCompanyModalOpen(true);
				return;
			}
			setQuote(prev => ({ ...prev, id_client_company: value, id_contact: '', id_trato: '' }));
			setNewDeal((prev: any) => ({ ...prev, id_client_company: value, id_contact: '' }));
			setFilteredContacts(contacts.filter(c => String(c.id_client_company) === String(value)));
			setFilteredDeals(deals.filter(d => String(d.id_client_company) === String(value)));
			return;
		}
		if (name === 'id_contact') {
			if (value === '__ADD_NEW_CONTACT__') {
				setIsContactModalOpen(true);
				return;
			}
			setQuote(prev => ({ ...prev, id_contact: value }));
			setNewDeal((prev: any) => ({ ...prev, id_contact: value }));
			return;
		}
		if (name === 'id_trato') {
			setQuote(prev => ({ ...prev, id_trato: value }));
			return;
		}
		setQuote(prev => ({ ...prev, [name]: value }));
	};

	const handleCcInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			const value = ccInput;
			if (value.includes(',')) {
				const regexCorreo = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
				const matches = value.match(regexCorreo) || [];
				const arrobas = (value.match(/@/g) || []).length;
				if (matches.length < arrobas) {
					setCcError('Parece que hay correos pegados sin coma. Revisa y separa cada correo con una coma.');
					return;
				}
				const invalids = matches.filter(email => !/^([a-zA-Z0-9_.+-]+)@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email));
				if (invalids.length > 0) {
					setCcError('Uno o mas correos no son validos');
					return;
				}
				setCcError(null);
				const current = (quote.correos_adicionales || '').split(',').map(v => v.trim()).filter(Boolean);
				const nuevos = matches.filter(email => !current.includes(email));
				setQuote(prev => ({ ...prev, correos_adicionales: [...current, ...nuevos].join(',') }));
				setCcInput('');
				return;
			}

			const email = ccInput.trim();
			if (!email) return;
			if (!/^([a-zA-Z0-9_.+-]+)@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email)) {
				setCcError('Correo invalido');
				return;
			}
			setCcError(null);
			const current = (quote.correos_adicionales || '').split(',').map(v => v.trim()).filter(Boolean);
			if (current.includes(email)) {
				setCcError('Correo ya agregado');
				return;
			}
			setQuote(prev => ({ ...prev, correos_adicionales: [...current, email].join(',') }));
			setCcInput('');
		}
	};

	const handleRemoveCc = (email: string) => {
		const current = (quote.correos_adicionales || '').split(',').map(v => v.trim()).filter(Boolean);
		setQuote(prev => ({ ...prev, correos_adicionales: current.filter(e => e !== email).join(',') }));
		setCcError(null);
	};

	const handleNewDealChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
		const { name, value } = e.target;
		setNewDeal((prev: any) => ({ ...prev, [name]: value }));
	};

	const handleCompanyCreated = async (newCompany: ClientCompany) => {
		await invalidateCompanies();
		setQuote(prev => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
		setNewDeal((prev: any) => ({ ...prev, id_client_company: newCompany.id_client_company, id_contact: '' }));
		setFilteredContacts(contacts.filter(c => String(c.id_client_company) === String(newCompany.id_client_company)));
		setIsCompanyModalOpen(false);
		setToast({ message: 'Empresa creada exitosamente.', type: 'success' });
	};

	const handleContactCreated = async (newContact: ClientContact) => {
		await invalidateContacts();
		if (newContact.id_client_company && String(newContact.id_client_company) === String(quote.id_client_company)) {
			setFilteredContacts(contacts.filter(c => String(c.id_client_company) === String(quote.id_client_company)));
		}
		setQuote(prev => ({ ...prev, id_contact: newContact.id_contact }));
		setNewDeal((prev: any) => ({ ...prev, id_contact: newContact.id_contact }));
		setIsContactModalOpen(false);
		setToast({ message: 'Contacto creado exitosamente.', type: 'success' });
	};

	const handleSave = async () => {
		if (!quote.nombre_cotizacion) {
			setToast({ message: 'El nombre de la cotizacion es obligatorio.', type: 'error' });
			return;
		}
		if (!quote.id_client_company || !quote.id_contact) {
			setToast({ message: 'Seleccione empresa y contacto.', type: 'error' });
			return;
		}

		if (isLinkingDeal && createNewDeal) {
			if (!newDeal.nombre_trato || !newDeal.id_interest || !newDeal.id_channel) {
				setToast({ message: 'Para el nuevo trato: Nombre, Interes y Canal son obligatorios.', type: 'error' });
				return;
			}
		}

		setProcessing(true);
		setToast({ message: 'Guardando registro...', type: 'success' });

		try {
			let associatedDealId = quote.id_trato;

			if (isLinkingDeal && createNewDeal) {
				const dealPayload = {
					...newDeal,
					id_client_company: quote.id_client_company,
					id_contact: quote.id_contact,
					status_category_deals: 'DRAFT',
					id_tenant: user?.id_tenant,
					id_user_owner: user?.id_user,
					id_user: user?.id_user,
					created_at: new Date().toISOString(),
					valor_trato: undefined,
				};

				const dealRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(dealPayload),
				});

				if (!dealRes.ok) {
					let errorMessage = 'Error al crear el trato asociado.';
					try {
						const text = await dealRes.text();
						if (text) {
							const err = JSON.parse(text);
							errorMessage = err.message || errorMessage;
						}
					} catch {
						// ignore parse error
					}
					throw new Error(errorMessage);
				}

				const dealText = await dealRes.text();
				const dealData = dealText ? JSON.parse(dealText) : {};
				associatedDealId = dealData?.id_trato || dealData?.id;
			}

			const queryParams = new URLSearchParams(location.search);
			const quoteId = queryParams.get('id');
			const quotePayload = {
				...quote,
				id_trato: associatedDealId,
				id_tenant: user?.id_tenant,
				id_user: user?.id_user,
				fecha_emision: new Date().toISOString(),
				status_category_quotes: 'DRAFT',
				total: quote.total || 0,
				estado_decision: 'PENDIENTE',
				version: 0,
			};

			let res;
			if (quoteId) {
				const updatePayload: Record<string, unknown> = {
					id_cotizacion: quoteId,
					id_tenant: user?.id_tenant,
					id_user: user?.id_user,
					id_client_company: String(quote.id_client_company || ''),
					id_contact: String(quote.id_contact || ''),
					nombre_cotizacion: String(quote.nombre_cotizacion || ''),
					mensaje: String(quote.mensaje || ''),
					correos_adicionales: String(quote.correos_adicionales || ''),
					id_quote_status: String(quote.id_quote_status || ''),
					tiempo_entrega: String(quote.tiempo_entrega || ''),
					garantia: String(quote.garantia || ''),
					validez_oferta: String(quote.validez_oferta || ''),
					nota: String(quote.nota || ''),
					id_trato: String(associatedDealId || ''),
					is_private: Boolean(quote.is_private),
					condicion_pago: String(quote.condicion_pago || ''),
				};

				res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/update`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(updatePayload),
				});
			} else {
				res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(quotePayload),
				});
			}

			if (!res.ok) {
				let errorMessage = quoteId ? 'Error al actualizar la cotizacion.' : 'Error al crear la cotizacion.';
				try {
					const text = await res.text();
					if (text) {
						const err = JSON.parse(text);
						errorMessage = err.message || errorMessage;
					}
				} catch (e) {
					console.error('Error parsing response:', e);
				}
				throw new Error(errorMessage);
			}

			const responseData = await res.json();
			const createdQuoteId = Array.isArray(responseData) ? responseData[0]?.id_cotizacion : responseData?.id_cotizacion;
			invalidateQuotesListCache();

			setToast({ message: quoteId ? 'Cotizacion actualizada correctamente.' : 'Cotizacion creada correctamente.', type: 'success' });

			setTimeout(() => {
				if (quoteId) {
					navigate(-1);
				} else if (createdQuoteId) {
					navigate(`/app/quotes/${createdQuoteId}`);
				} else {
					const dealIdParam = new URLSearchParams(location.search).get('dealId');
					navigate(dealIdParam ? `/app/deals/${dealIdParam}` : '/app/quotes');
				}
			}, 900);
		} catch (error: any) {
			console.error(error);
			setToast({ message: error.message || 'Error desconocido al guardar.', type: 'error' });
		} finally {
			setProcessing(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-[80vh] items-center justify-center flex-col gap-4">
				<BrandSpinner size="xl" />
				<p className="text-zinc-500 font-medium">Cargando configuracion...</p>
			</div>
		);
	}

	const isLocked = location.search.includes('dealId');
	const queryParams = new URLSearchParams(location.search);
	const quoteId = queryParams.get('id');
	const isEditing = !!quoteId;
	const canLinkDeal = Boolean(quote.id_client_company);

	return (
		<div className="bg-[#F9F9F8] text-zinc-900 min-h-screen pb-5 animate-fade-in">
			{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

			<header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40">
				<div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
					<div>
						<h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
							{isEditing ? 'Editar Cotizacion' : 'Nueva Cotizacion'}
						</h1>
						<p className="text-[11px] sm:text-xs text-zinc-500">
							{isEditing ? 'Actualiza la informacion de la cotizacion.' : 'Registra una nueva cotizacion en borrador.'}
						</p>
					</div>
					<div className="flex items-center gap-2 sm:gap-3">
						<button
							onClick={() => navigate(-1)}
							className="h-8 px-3 sm:px-4 bg-white border border-zinc-200 text-zinc-600 rounded-md text-[12px] font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
						>
							Cancelar
						</button>
						<button
							onClick={handleSave}
							disabled={processing || cacheLoading}
							className="h-8 px-4 sm:px-5 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white rounded-md text-[12px] font-semibold hover:from-zinc-800 hover:to-zinc-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
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
								<label className="block text-xs font-medium text-zinc-700 mb-1.5">Nombre de la Cotizacion *</label>
								<input
									name="nombre_cotizacion"
									value={quote.nombre_cotizacion || ''}
									onChange={handleInputChange}
									autoFocus
									className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
									placeholder="Ej. Propuesta Comercial - Implementacion ERP"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
								<div>
									<label className="block text-xs font-medium text-zinc-700 mb-1.5">Entrega</label>
									<input
										name="tiempo_entrega"
										value={quote.tiempo_entrega || ''}
										onChange={handleInputChange}
										className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
										placeholder="5-7 dias"
									/>
								</div>
								<div>
									<label className="block text-xs font-medium text-zinc-700 mb-1.5">Garantia</label>
									<input
										name="garantia"
										value={quote.garantia || ''}
										onChange={handleInputChange}
										className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
										placeholder="12 meses"
									/>
								</div>
								<div>
									<label className="block text-xs font-medium text-zinc-700 mb-1.5">Validez</label>
									<input
										name="validez_oferta"
										value={quote.validez_oferta || ''}
										onChange={handleInputChange}
										className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
										placeholder="30 dias"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<div>
									<label className="block text-xs font-medium text-zinc-700 mb-1.5">Condicion de pago</label>
									<select
										value={condicionOption}
										onChange={(e) => {
											const v = e.target.value;
											setCondicionOption(v);
											if (v && v !== 'OTRO') {
												setQuote(prev => ({ ...prev, condicion_pago: v }));
											} else {
												setQuote(prev => ({ ...prev, condicion_pago: '' }));
											}
										}}
										className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm"
									>
										<option value="">Seleccione</option>
									<option value="Contado">Contado</option>
										<option value="15 dias">15 dias</option>
										<option value="30 dias">30 dias</option>
										<option value="60 dias">60 dias</option>
										<option value="90 dias">90 dias</option>
										<option value="OTRO">Otro</option>
									</select>
								</div>

								{condicionOption === 'OTRO' ? (
									<div>
										<label className="block text-xs font-medium text-zinc-700 mb-1.5">Especificar</label>
										<input
											name="condicion_pago"
											value={quote.condicion_pago || ''}
											onChange={handleInputChange}
											className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400"
											placeholder="Ej. 45 dias, contraentrega"
										/>
									</div>
								) : null}
							</div>
						</div>

						<h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
							<i className="fa-regular fa-building" /> Cliente
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
							<div>
								<div className="flex justify-between items-center mb-1.5">
									<label className="block text-xs font-medium text-zinc-700 inline-flex items-center gap-1.5">Empresa * {isLocked ? <i className="fa-solid fa-lock text-[10px] text-zinc-400" /> : null}</label>
									<button
										type="button"
										onClick={() => setIsCompanyModalOpen(true)}
										className="text-[10px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-sky-200"
										disabled={isLocked}
									>
										<i className="fa-solid fa-plus text-[8px]" /> Nueva
									</button>
								</div>
								{selectedCompany ? (
									<div className="relative bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
										{!isLocked ? (
											<button
												type="button"
												onClick={() => {
													setQuote(prev => ({ ...prev, id_client_company: '', id_contact: '', id_trato: '' }));
													setNewDeal((prev: any) => ({ ...prev, id_client_company: '', id_contact: '' }));
													setFilteredContacts([]);
													setFilteredDeals([]);
												}}
												className="absolute top-2 right-2 w-5 h-5 rounded-full text-indigo-400 hover:text-red-500 hover:bg-white/80 transition-colors inline-flex items-center justify-center"
												title="Quitar empresa"
											>
												<i className="fa-solid fa-xmark text-[10px]"></i>
											</button>
										) : null}
										<p className="font-bold text-indigo-900 text-sm pr-6">{selectedCompany.name_company}</p>
										<p className="text-indigo-700">{selectedCompany.city || '-'} - {selectedCompany.country_name || selectedCompany.id_country || '-'}</p>
										{selectedCompany.email_company && <p className="text-indigo-700">{selectedCompany.email_company}</p>}
									</div>
								) : (
									<SearchableClientSelector
										currentId={String(quote.id_client_company || '')}
										options={companyOptions}
										disabled={cacheLoading || isLocked}
										onClear={() => {
											setQuote(prev => ({ ...prev, id_client_company: '', id_contact: '', id_trato: '' }));
											setNewDeal((prev: any) => ({ ...prev, id_client_company: '', id_contact: '' }));
											setFilteredContacts([]);
											setFilteredDeals([]);
										}}
										placeholder="Seleccionar una empresa..."
										searchPlaceholder="Escribe para buscar empresa..."
										emptyText="No se encontraron empresas"
										onSelect={(id) => {
											setQuote(prev => ({ ...prev, id_client_company: id, id_contact: '', id_trato: '' }));
											setNewDeal((prev: any) => ({ ...prev, id_client_company: id, id_contact: '' }));
											setFilteredContacts(contacts.filter(c => String(c.id_client_company) === String(id)));
											setFilteredDeals(deals.filter(d => String(d.id_client_company) === String(id)));
										}}
									/>
								)}
							</div>

							<div>
								<div className="flex justify-between items-center mb-1.5">
									<label className="block text-xs font-medium text-zinc-700 inline-flex items-center gap-1.5">Contacto * {isLocked ? <i className="fa-solid fa-lock text-[10px] text-zinc-400" /> : null}</label>
									<button
										type="button"
										onClick={() => setIsContactModalOpen(true)}
										className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-emerald-200"
										disabled={isLocked || !quote.id_client_company}
									>
										<i className="fa-solid fa-plus text-[8px]" /> Nuevo
									</button>
								</div>
								{selectedContact ? (
									<div className="relative bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs space-y-1">
										{!isLocked ? (
											<button
												type="button"
												onClick={() => {
													setQuote(prev => ({ ...prev, id_contact: '' }));
													setNewDeal((prev: any) => ({ ...prev, id_contact: '' }));
												}}
												className="absolute top-2 right-2 w-5 h-5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-white transition-colors inline-flex items-center justify-center"
												title="Quitar contacto"
											>
												<i className="fa-solid fa-xmark text-[10px]"></i>
											</button>
										) : null}
										<p className="font-bold text-zinc-800 text-sm pr-6">{selectedContact.first_name} {selectedContact.last_name}</p>
										<p className="text-zinc-600">{selectedContact.position || 'Sin cargo'}</p>
										{selectedContact.email && <p className="text-zinc-600">{selectedContact.email}</p>}
									</div>
								) : (
									<SearchableClientSelector
										currentId={String(quote.id_contact || '')}
										options={contactOptions}
										disabled={cacheLoading || isLocked || !quote.id_client_company}
										onClear={() => {
											setQuote(prev => ({ ...prev, id_contact: '' }));
											setNewDeal((prev: any) => ({ ...prev, id_contact: '' }));
										}}
										placeholder={quote.id_client_company ? 'Seleccionar un contacto...' : 'Selecciona empresa primero'}
										searchPlaceholder="Escribe para buscar contacto..."
										emptyText="No se encontraron contactos"
										onSelect={(id) => {
											setQuote(prev => ({ ...prev, id_contact: id }));
											setNewDeal((prev: any) => ({ ...prev, id_contact: id }));
										}}
									/>
								)}
							</div>
						</div>

						<div className="mt-6">
							<label className="block text-xs font-medium text-zinc-700 mb-1.5">Mensaje al cliente</label>
							<textarea
								name="mensaje"
								value={quote.mensaje || ''}
								onChange={handleInputChange}
								rows={7}
								className="w-full min-h-[180px] text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm resize-y placeholder:text-zinc-400"
								placeholder="Condiciones del servicio, terminos y mensaje de saludo..."
							/>
							<p className="text-[11px] text-zinc-500 mt-1">Puedes expandir este campo con el mouse si necesitas revisar o escribir más contenido.</p>
						</div>

						<div className="mt-6 border-t border-zinc-200 pt-5">
							<div className="flex items-start justify-between gap-3 mb-3">
								<div>
									<h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Vinculación de trato (opcional)</h3>
									<p className="text-[12px] text-zinc-500 mt-1 max-w-2xl">Puedes asociar esta cotización a un trato ahora, o dejarlo para después. En muchos flujos, el trato se genera automáticamente cuando la cotización avanza.</p>
								</div>
							</div>

							{isLocked ? (
								<div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 shadow-sm text-sm text-emerald-900">
									<p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-1">Trato vinculado</p>
									<p className="font-semibold inline-flex items-center gap-2">
										<i className="fa-solid fa-link text-emerald-500 text-[11px]"></i>
										{deals.find(d => d.id_trato === quote.id_trato)?.nombre_trato || 'Trato actual'}
									</p>
								</div>
							) : (
								<div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="text-[13px] font-semibold text-zinc-800 inline-flex items-center gap-2">
												<i className="fa-solid fa-link text-[11px] text-sky-600"></i>
												Asociar trato
											</p>
											<p className="text-[11px] text-zinc-500 mt-1">
												{canLinkDeal
													? 'Puedes asociar esta cotización a un trato existente o crear uno nuevo.'
													: 'Selecciona una empresa para habilitar la vinculación de trato.'}
											</p>
										</div>
										<button
											type="button"
											onClick={() => {
												if (!canLinkDeal) return;
												setIsLinkingDeal(prev => {
													const next = !prev;
													if (!next) {
														setQuote(p => ({ ...p, id_trato: '' }));
														setCreateNewDeal(false);
													}
													return next;
												});
											}}
											aria-pressed={isLinkingDeal}
											disabled={!canLinkDeal}
											className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border shadow-sm transition-all ${
												!canLinkDeal
													? 'bg-zinc-100 border-zinc-200 cursor-not-allowed opacity-70'
													: isLinkingDeal
														? 'bg-gradient-to-r from-sky-600 to-cyan-500 border-sky-500'
														: 'bg-zinc-200 border-zinc-300 hover:bg-zinc-300'
											}`}
										>
											<span className={`pointer-events-none absolute left-1.5 inline-flex items-center justify-center text-[8px] transition-opacity ${isLinkingDeal ? 'opacity-0' : 'opacity-100 text-zinc-500'}`}>
												<i className="fa-solid fa-link-slash"></i>
											</span>
											<span className={`pointer-events-none absolute right-1.5 inline-flex items-center justify-center text-[8px] transition-opacity ${isLinkingDeal ? 'opacity-100 text-white' : 'opacity-0'}`}>
												<i className="fa-solid fa-link"></i>
											</span>
											<span className={`absolute left-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-md transition-transform ${isLinkingDeal ? 'translate-x-5' : 'translate-x-0'}`}>
												<i className={`fa-solid ${isLinkingDeal ? 'fa-check text-sky-600' : 'fa-minus text-zinc-400'} text-[9px]`}></i>
											</span>
										</button>
									</div>

									<div className="pt-2 border-t border-zinc-100">
										<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${!canLinkDeal ? 'bg-amber-50 text-amber-700 border border-amber-200' : isLinkingDeal ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
											<i className={`fa-solid ${!canLinkDeal ? 'fa-building-circle-exclamation' : isLinkingDeal ? 'fa-link' : 'fa-link-slash'} text-[9px]`}></i>
											{!canLinkDeal ? 'Selecciona empresa primero' : isLinkingDeal ? 'Asociación activa' : 'Sin asociación'}
										</span>
									</div>

									{isLinkingDeal && (
										<>
											<div className="flex bg-zinc-100 p-1 rounded-lg w-full">
												<button
													type="button"
													onClick={() => {
														setCreateNewDeal(false);
														setQuote(p => ({ ...p, id_trato: '' }));
													}}
													className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all ${!createNewDeal ? 'bg-white text-sky-700 shadow-sm border border-sky-100' : 'text-zinc-500 hover:text-zinc-700'}`}
												>
													Trato existente
												</button>
												<button
													type="button"
													onClick={() => {
														setCreateNewDeal(true);
														setQuote(p => ({ ...p, id_trato: '' }));
													}}
													className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all ${createNewDeal ? 'bg-white text-sky-700 shadow-sm border border-sky-100' : 'text-zinc-500 hover:text-zinc-700'}`}
												>
													Nuevo trato
												</button>
											</div>

											{!createNewDeal ? (
												(!filteredDeals || filteredDeals.length === 0) ? (
													<div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-500">
														No hay tratos para esta empresa.
													</div>
												) : (
													<div>
														<label className="block text-xs font-medium text-zinc-700 mb-1.5">Trato</label>
														<select
															name="id_trato"
															value={quote.id_trato || ''}
															onChange={handleInputChange}
															onFocus={handleDealDropdownOpen}
															className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm"
														>
															<option value="">Seleccionar trato...</option>
															{filteredDeals.map((d, idx) => (
																<option key={`${d.id_trato}-${idx}`} value={d.id_trato}>{d.nombre_trato}</option>
															))}
														</select>
													</div>
												)
											) : (
												<div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
													<div className="flex items-center justify-between gap-3 pb-2 border-b border-sky-100">
														<div>
															<p className="text-[10px] uppercase tracking-wider font-bold text-sky-600">Nuevo trato</p>
															<p className="text-[12px] text-zinc-600 mt-1">Configura un trato base para asociarlo desde esta cotización.</p>
														</div>
														<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sky-200 bg-white text-sky-700 text-[10px] font-semibold">
															<i className="fa-solid fa-sparkles text-[9px]"></i>
															Se crea al guardar
														</span>
													</div>

													<div>
														<label className="block text-xs font-medium text-zinc-700 mb-1.5">Nombre *</label>
														<input
															name="nombre_trato"
															value={newDeal.nombre_trato || ''}
															onChange={handleNewDealChange}
															className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm"
															placeholder="Nombre del nuevo trato"
														/>
														<p className="text-[11px] text-zinc-500 mt-1">Usa un nombre claro para identificar este trato rápidamente.</p>
													</div>

													<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
														<div>
															<label className="block text-xs font-medium text-zinc-700 mb-1.5">Interés *</label>
															<ClassificationSelector
																currentId={String(newDeal.id_interest || '')}
																options={interestOptions}
																disabled={false}
																placeholder="Seleccionar interés"
																onSelect={(id) => setNewDeal((prev: any) => ({ ...prev, id_interest: id }))}
															/>
														</div>

														<div>
															<label className="block text-xs font-medium text-zinc-700 mb-1.5">Canal *</label>
															<ClassificationSelector
																currentId={String(newDeal.id_channel || '')}
																options={channelOptions}
																disabled={false}
																placeholder="Seleccionar canal"
																onSelect={(id) => setNewDeal((prev: any) => ({ ...prev, id_channel: id }))}
															/>
														</div>
													</div>

													<div>
														<label className="block text-xs font-medium text-zinc-700 mb-1.5">Descripción</label>
														<textarea
															name="descripcion"
															value={newDeal.descripcion || ''}
															onChange={handleNewDealChange}
															rows={3}
															className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm resize-none"
															placeholder="Contexto breve del trato, objetivo o necesidad del cliente..."
														/>
													</div>
												</div>
											)}
										</>
									)}
								</div>
							)}
						</div>
					</div>

					<div className="w-full lg:w-[35%] px-4 sm:px-6 pt-3 pb-6 flex flex-col">
						<h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">Acerca de la cotizacion</h3>

						<div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm mb-4">
							<p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Estado inicial</p>
							<div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wide">
								<i className="fa-solid fa-pen-to-square text-[8px] text-sky-600"></i>
								Borrador
							</div>
							<p className="text-[11px] text-zinc-500 mt-1.5">Este estado se asigna por defecto al crear la cotizacion.</p>
						</div>

						<div className="space-y-1">
							<div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-zinc-800 inline-flex items-center gap-2">
											<i className="fa-solid fa-lock text-[11px] text-zinc-500"></i>
											Privacidad
										</p>
										<p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">Define quién puede ver esta cotización.</p>
									</div>
									<div className="mt-0.5 inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-[11px] font-semibold">
										<button
											type="button"
											onClick={() => setQuote(prev => ({ ...prev, is_private: false }))}
											className={`px-2.5 py-1 rounded-md transition-colors ${!quote.is_private ? 'bg-white text-zinc-800 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-700'}`}
										>
											<span className="inline-flex items-center gap-1.5">
												<i className={`fa-solid fa-earth-americas text-[10px] ${!quote.is_private ? 'text-emerald-600' : 'text-zinc-400'}`}></i>
												Pública
											</span>
										</button>
										<button
											type="button"
											onClick={() => setQuote(prev => ({ ...prev, is_private: true }))}
											className={`px-2.5 py-1 rounded-md transition-colors ${quote.is_private ? 'bg-white text-zinc-800 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-700'}`}
										>
											<span className="inline-flex items-center gap-1.5">
												<i className={`fa-solid fa-lock text-[10px] ${quote.is_private ? 'text-amber-600' : 'text-zinc-400'}`}></i>
												Privada
											</span>
										</button>
									</div>
								</div>
								<div className="mt-2 pt-2 border-t border-zinc-100">
									<p className="text-[11px] text-zinc-600 leading-relaxed">
										{quote.is_private
											? 'Solo el creador puede ver esta cotización.'
											: 'Cualquiera que tenga permiso al trato de esta cotización podrá verla.'}
									</p>
								</div>
							</div>
						</div>

						<div className="mt-4 border-t border-zinc-200 pt-4 space-y-4">
							<div>
								<label className="block text-xs font-medium text-zinc-700 mb-1.5">Nota interna</label>
								<textarea
									name="nota"
									value={quote.nota || ''}
									onChange={handleInputChange}
									rows={3}
									className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm resize-none placeholder:text-zinc-400"
									placeholder="Notas para el equipo..."
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-zinc-700 mb-1.5">Correos en copia (CC)</label>
								<div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 text-[10px] font-semibold">
									<i className="fa-solid fa-users text-[9px]"></i>
									Sugerencias de la misma empresa
								</div>
								{quote.id_client_company && filteredContacts.length > 0 && (() => {
									const currentEmails = (quote.correos_adicionales || '').split(',').map(v => v.trim()).filter(Boolean);
									const availableContacts = filteredContacts.filter(c =>
										c.email &&
										(!quote.id_contact || String(c.id_contact) !== String(quote.id_contact)) &&
										!currentEmails.includes(c.email)
									);

									if (availableContacts.length === 0) return null;

									return (
										<div className="mb-2 flex flex-wrap gap-2">
											{availableContacts.map(contact => (
												<button
													key={contact.id_contact}
													type="button"
													onClick={() => {
														if (contact.email) {
															const current = (quote.correos_adicionales || '').split(',').map(v => v.trim()).filter(Boolean);
															setQuote(prev => ({ ...prev, correos_adicionales: [...current, contact.email as string].join(',') }));
														}
													}}
													className="text-[10px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-sky-200"
												>
													<i className="fa-solid fa-user-plus text-[8px]" /> {contact.first_name} {contact.last_name}
												</button>
											))}
										</div>
									);
								})()}

								<div className="flex flex-wrap gap-2 mb-2">
									{(quote.correos_adicionales || '').split(',').map((email, idx) => {
										const trimmed = email.trim();
										if (!trimmed) return null;
										return (
											<span key={trimmed + idx} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-1 text-xs font-medium mr-1 shadow-sm">
												<i className="fa-solid fa-envelope text-[9px] text-indigo-500"></i>
												{trimmed}
												<button type="button" className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full text-indigo-400 hover:text-red-500 hover:bg-white transition-colors" onClick={() => handleRemoveCc(trimmed)}>
													<i className="fa-solid fa-xmark text-[10px]"></i>
												</button>
											</span>
										);
									})}
								</div>
								<input
									name="correos_adicionales"
									value={ccInput}
									onChange={handleInputChange}
									onKeyDown={handleCcInputKeyDown}
									className={`w-full text-sm text-zinc-900 bg-white border ${ccError ? 'border-red-400' : 'border-zinc-300'} focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 outline-none transition-all shadow-sm placeholder:text-zinc-400`}
									placeholder="Agrega un correo y presiona Enter"
								/>
								{ccError && <div className="text-xs text-red-500 mt-1">{ccError}</div>}
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
				initialData={quote.id_client_company ? { id_client_company: quote.id_client_company } : undefined}
				onSuccess={handleContactCreated}
				companies={companies}
			/>
		</div>
	);
};

export default QuoteForm;
