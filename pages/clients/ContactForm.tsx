import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BrandSpinner } from '../../components/AppLoaders';
import { ClientContact, ClientCompany } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import CompanyForm from './CompanyForm';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { apiFetch } from '../../services/apiClient';

interface ContactFormProps {
	isOpen: boolean;
	onClose: () => void;
	mode: 'create' | 'edit';
	initialData?: Partial<ClientContact>;
	onSuccess?: (contact: ClientContact) => void;
	preselectedCompanyId?: string;
	companies?: ClientCompany[];
}

interface ContactFormData extends Partial<ClientContact> {
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	position: string;
	id_client_company: string;
}

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
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
}> = ({
	currentId,
	options,
	onSelect,
	onClear,
	onOpenChange,
	disabled = false,
	placeholder = 'Seleccionar...',
	searchPlaceholder = 'Escribe para buscar...',
	emptyText = 'Sin resultados',
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [internalQuery, setInternalQuery] = useState('');
	const wrapperRef = useRef<HTMLDivElement>(null);

	const setOpen = useCallback((open: boolean) => {
		setIsOpen(open);
		onOpenChange?.(open);
	}, [onOpenChange]);

	const current = useMemo(() => options.find(o => o.id === currentId), [options, currentId]);

	useEffect(() => {
		if (!isOpen) {
			setInternalQuery(current?.label || '');
		}
	}, [current?.label, currentId, isOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
				setOpen(false);
				setInternalQuery(current?.label || '');
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [current?.label, setOpen]);

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
							setOpen(false);
						}}
						className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
						title="Quitar seleccion"
						aria-label="Quitar seleccion"
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
						setOpen(true);
					}}
					onKeyDown={(e) => {
						if (disabled) return;
						if (e.key === 'Escape') {
							setOpen(false);
							setInternalQuery(current?.label || '');
						}
						if (e.key === 'ArrowDown') {
							setOpen(true);
						}
						if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
							e.preventDefault();
							const first = filteredOptions[0];
							onSelect(first.id);
							setInternalQuery(first.label);
							setOpen(false);
						}
					}}
					onFocus={() => {
						if (!disabled) setOpen(true);
					}}
					disabled={disabled}
					className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg pl-9 pr-9 py-2 outline-none shadow-sm focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 placeholder:text-zinc-400"
					placeholder={placeholder}
				/>
			</div>

			{isOpen && !disabled ? (
				<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-[0_12px_32px_rgba(24,24,27,0.14)] z-[140] overflow-hidden">
					<div className="max-h-[200px] overflow-y-auto py-1.5">
						{filteredOptions.map(option => (
							<button
								key={option.id}
								type="button"
								onClick={() => {
									onSelect(option.id);
									setInternalQuery(option.label);
									setOpen(false);
								}}
								className={`w-full px-3 py-2.5 text-left transition-colors ${
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

const fieldClass =
	'w-full text-[13px] text-zinc-900 bg-white border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md px-3 py-2 outline-none transition-shadow shadow-sm placeholder:text-zinc-400';

const ContactForm: React.FC<ContactFormProps> = ({
	isOpen,
	onClose,
	mode,
	initialData,
	onSuccess,
	preselectedCompanyId,
	companies = [],
}) => {
	const { user } = useAuth();
	const { invalidateContacts } = useDataCache();

	const [formData, setFormData] = useState<ContactFormData>({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		position: '',
		id_client_company: preselectedCompanyId || '',
	});

	const [submitting, setSubmitting] = useState(false);
	const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
	const [companiesList, setCompaniesList] = useState<ClientCompany[]>(companies || []);
	const [loadingCompanies, setLoadingCompanies] = useState(false);
	const [companySearchOpen, setCompanySearchOpen] = useState(false);
	const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
	const didRequestCompaniesRef = useRef(false);

	// Unsaved changes state
	const [initialFormData, setInitialFormData] = useState<ContactFormData | null>(null);
	const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

	const normalize = useCallback((data: ContactFormData) => ({
		first_name: data.first_name || '',
		last_name: data.last_name || '',
		email: data.email || '',
		phone: data.phone || '',
		position: data.position || '',
		id_client_company: data.id_client_company || '',
	}), []);

	// Initialize form only when opening modal.
	useEffect(() => {
		if (!isOpen) return;

		if (mode === 'edit' && initialData) {
			const next: ContactFormData = {
				id_contact: initialData.id_contact,
				first_name: initialData.first_name || '',
				last_name: initialData.last_name || '',
				email: initialData.email || '',
				phone: initialData.phone || '',
				position: initialData.position || '',
				id_client_company: initialData.id_client_company || '',
			};
			setFormData(next);
			setInitialFormData(next);
		} else {
			const next: ContactFormData = {
				first_name: '',
				last_name: '',
				email: '',
				phone: '',
				position: '',
				id_client_company: initialData?.id_client_company || preselectedCompanyId || '',
			};
			setFormData(next);
			setInitialFormData(next);
		}
	}, [isOpen]);

	const ensureCompaniesLoaded = useCallback(async () => {
		if ((companiesList && companiesList.length > 0) || loadingCompanies || !user?.id_tenant || !user?.id_user) return;
		if (didRequestCompaniesRef.current) return;
		didRequestCompaniesRef.current = true;

		try {
			setLoadingCompanies(true);
			const res = await apiFetch(
				`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`
			);
			if (!res.ok) throw new Error('Error al cargar empresas');

			const text = await res.text();
			const data = text ? JSON.parse(text) : [];

			let companiesArray: any[] = [];
			if (Array.isArray(data)) {
				const unified = data.find(item => item && typeof item === 'object' && 'unified_response' in item);
				if (unified?.unified_response?.rows && Array.isArray(unified.unified_response.rows)) {
					companiesArray = unified.unified_response.rows;
				} else {
					companiesArray = data;
				}
			} else if (data?.unified_response?.rows && Array.isArray(data.unified_response.rows)) {
				companiesArray = data.unified_response.rows;
			}

			const valid = companiesArray.filter((c: any) => c && c.id_client_company);
			setCompaniesList(valid);
		} catch {
			setToast({ message: 'No se pudieron cargar las empresas.', type: 'error' });
		} finally {
			setLoadingCompanies(false);
		}
	}, [companiesList, loadingCompanies, user?.id_tenant, user?.id_user]);

	useEffect(() => {
		if (!isOpen) return;
		didRequestCompaniesRef.current = false;

		if (companies && companies.length > 0) {
			setCompaniesList(companies);
			return;
		}

		ensureCompaniesLoaded();
	}, [isOpen, companies, ensureCompaniesLoaded]);

	const hasUnsavedChanges = useMemo(() => {
		if (!initialFormData || !isOpen) return false;
		const current = normalize(formData);
		const initial = normalize(initialFormData);
		return Object.keys(initial).some((k) => {
			const key = k as keyof typeof initial;
			return current[key] !== initial[key];
		});
	}, [formData, initialFormData, isOpen, normalize]);

	const handleAttemptClose = useCallback(() => {
		if (hasUnsavedChanges) {
			setShowDiscardConfirm(true);
			return;
		}
		onClose();
	}, [hasUnsavedChanges, onClose]);

	const handleConfirmDiscard = useCallback(() => {
		setShowDiscardConfirm(false);
		setInitialFormData(null);
		onClose();
	}, [onClose]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || !isOpen) return;
			if (isCompanyModalOpen) {
				return;
			}
			if (companySearchOpen) {
				setCompanySearchOpen(false);
			} else if (showDiscardConfirm) {
				setShowDiscardConfirm(false);
			} else {
				handleAttemptClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, showDiscardConfirm, companySearchOpen, isCompanyModalOpen, handleAttemptClose]);

	const companyOptions: SearchOption[] = useMemo(() => {
		return companiesList.map((c) => ({
			id: String(c.id_client_company),
			label: c.name_company || 'Empresa sin nombre',
			subLabel: [c.city, c.country_name || c.id_country].filter(Boolean).join(' - '),
		}));
	}, [companiesList]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);

		try {
			if (!formData.first_name?.trim()) {
				setToast({ message: 'El nombre es requerido.', type: 'error' });
				setSubmitting(false);
				return;
			}

			if (!formData.id_client_company) {
				setToast({ message: 'Selecciona una empresa.', type: 'error' });
				setSubmitting(false);
				return;
			}

			if (!user?.id_tenant || !user?.id_user) {
				setToast({ message: 'Usuario no autenticado.', type: 'error' });
				setSubmitting(false);
				return;
			}

			const endpoint = mode === 'edit' ? 'update' : '';
			const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/${endpoint}`;

			const response = await apiFetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					id_tenant: user.id_tenant,
					id_user: user.id_user,
				}),
			});

			if (!response.ok) throw new Error('Error al guardar contacto');

			const result = await response.json();
			const savedContact = Array.isArray(result) ? result[0] : result;

			setToast({
				message: mode === 'create' ? 'Contacto creado exitosamente.' : 'Contacto actualizado exitosamente.',
				type: 'success',
			});

			await invalidateContacts(savedContact);
			onSuccess?.(savedContact);
			setInitialFormData(null);
			onClose();
		} catch (error: any) {
			setToast({ message: error.message || 'Error al procesar el contacto.', type: 'error' });
		} finally {
			setSubmitting(false);
		}
	};

	const handleCompanyCreated = (newCompany: ClientCompany) => {
		setCompaniesList((prev) => {
			const exists = prev.some((c) => String(c.id_client_company) === String(newCompany.id_client_company));
			if (exists) return prev;
			return [...prev, newCompany];
		});
		setFormData((prev) => ({
			...prev,
			id_client_company: String(newCompany.id_client_company || ''),
		}));
		setCompanySearchOpen(false);
		setIsCompanyModalOpen(false);
	};

	if (!isOpen) return null;

	return createPortal(
		<div>
			{!isCompanyModalOpen ? (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/30 backdrop-blur-sm p-4 sm:p-6 animate-fade-in"
					onClick={(e) => {
						if (e.target === e.currentTarget) handleAttemptClose();
					}}
				>
					<div className="w-full max-w-[480px] bg-white rounded-xl shadow-2xl border border-zinc-200/60 flex flex-col overflow-hidden">
				<div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
					<h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
						{mode === 'create' ? 'Nuevo Contacto' : 'Editar Contacto'}
					</h2>
					<button
						type="button"
						onClick={handleAttemptClose}
						className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
					>
						<i className="fa-solid fa-xmark text-[13px]"></i>
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col">
					<div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
						<div>
							<div className="flex items-center justify-between mb-1.5">
								<label className="block text-[12px] font-medium text-zinc-700">
									Empresa <span className="text-red-500">*</span>
								</label>
								<button
									type="button"
									onClick={() => setIsCompanyModalOpen(true)}
									className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-zinc-200/50"
								>
									<i className="fa-solid fa-plus text-[8px]"></i> Nueva
								</button>
							</div>
							<SearchableClientSelector
								currentId={String(formData.id_client_company || '')}
								options={companyOptions}
								disabled={!!(preselectedCompanyId && mode === 'create')}
								onOpenChange={(open) => {
									setCompanySearchOpen(open);
									if (open) ensureCompaniesLoaded();
								}}
								onClear={() => setFormData(prev => ({ ...prev, id_client_company: '' }))}
								onSelect={(id) => setFormData(prev => ({ ...prev, id_client_company: id }))}
								placeholder={loadingCompanies ? 'Cargando empresas...' : 'Selecciona una empresa...'}
								searchPlaceholder="Escribe para buscar empresa..."
								emptyText={loadingCompanies ? 'Cargando empresas...' : 'No se encontraron empresas'}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
									Nombre <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									name="first_name"
									required
									value={formData.first_name || ''}
									onChange={handleInputChange}
									className={fieldClass}
									placeholder="Ej. Juan"
								/>
							</div>

							<div>
								<label className="block text-[12px] font-medium text-zinc-700 mb-1.5">Apellido</label>
								<input
									type="text"
									name="last_name"
									value={formData.last_name || ''}
									onChange={handleInputChange}
									className={fieldClass}
									placeholder="Ej. Perez"
								/>
							</div>
						</div>

						<div>
							<label className="block text-[12px] font-medium text-zinc-700 mb-1.5">Cargo o Posicion</label>
							<input
								type="text"
								name="position"
								value={formData.position || ''}
								onChange={handleInputChange}
								className={fieldClass}
								placeholder="Ej. Gerente de TI, CTO..."
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-[12px] font-medium text-zinc-700 mb-1.5">Email</label>
								<input
									type="email"
									name="email"
									value={formData.email || ''}
									onChange={handleInputChange}
									className={fieldClass}
									placeholder="correo@empresa.com"
								/>
							</div>

							<div>
								<label className="block text-[12px] font-medium text-zinc-700 mb-1.5">Telefono</label>
								<input
									type="tel"
									name="phone"
									value={formData.phone || ''}
									onChange={handleInputChange}
									className={fieldClass}
									placeholder="+593 99 999 9999"
								/>
							</div>
						</div>
					</div>

					<div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2">
						<button
							type="button"
							onClick={handleAttemptClose}
							className="h-8 px-4 bg-white border border-zinc-200 text-zinc-600 rounded-md text-[12px] font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-sm"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={submitting}
							className="h-8 px-4 bg-zinc-900 text-white rounded-md text-[12px] font-medium hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
						>
							{submitting ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-check text-[10px]"></i>}
							{mode === 'create' ? 'Crear Contacto' : 'Guardar Cambios'}
						</button>
					</div>
				</form>

					{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
					</div>
				</div>
			) : null}

			<ConfirmModal
				isOpen={showDiscardConfirm}
				onClose={() => setShowDiscardConfirm(false)}
				onConfirm={handleConfirmDiscard}
				title="¿Salir sin guardar?"
				message="Tienes cambios sin guardar. Si sales ahora se perderan."
				confirmText="Salir sin guardar"
				cancelText="Continuar editando"
				isDestructive={true}
			/>

			<CompanyForm
				isOpen={isCompanyModalOpen}
				onClose={() => setIsCompanyModalOpen(false)}
				mode="create"
				redirectOnCreate={false}
				onSuccess={handleCompanyCreated}
			/>
		</div>,
		document.body
	);
};

export default ContactForm;
