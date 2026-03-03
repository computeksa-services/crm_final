import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DealFollowUpItem } from '../types';
import { Mail, Briefcase, ChevronRight, DollarSign, Phone, MessageSquare, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDataCache } from '../contexts/DataCacheContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG } from '../services/gatewayConfig';

interface DealFollowUpCardProps {
  deal: DealFollowUpItem;
  onManageClick: (deal: DealFollowUpItem) => void;
  onSuccess: () => void;
}

const DealFollowUpCard: React.FC<DealFollowUpCardProps> = ({ deal, onManageClick, onSuccess }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { dealStatuses, users: cachedUsers } = useDataCache();
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

    const dealId = deal.id_entity || deal.id_trato;
    const dealName = deal.title || deal.nombre_trato;
    const companyName = deal.subtitle || deal.client_company_name;
    const cleanPhoneNumber = (phone: string | undefined) => phone ? phone.replace(/[^0-9]/g, '') : '';
    
    const dealValue = typeof deal.valor_trato === 'number' 
        ? deal.valor_trato.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        : deal.valor_trato;
    
    const getBorderColor = () => {
        switch (deal.status_category) {
            case 'DRAFT': return 'border-slate-400';
            case 'PROGRESS': return 'border-blue-500';
            case 'WON': return 'border-emerald-500';
            case 'LOST': return 'border-red-500';
            default: return 'border-slate-300';
        }
    };

    const handleStatusChange = async (newStatusId: string) => {
        setIsStatusDropdownOpen(false);
        try {
            await apiFetch(GATEWAY_CONFIG.API.DEALS.UPDATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_trato: dealId,
                    id_deal_status: newStatusId,
                    id_user: user?.id_user,
                }),
            });
            onSuccess();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow-md border-l-4 ${getBorderColor()} flex flex-col`}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/app/deals/${dealId}`)}>
                        <Briefcase className="text-indigo-500" size={16} />
                        <h3 className="font-bold text-slate-800 truncate hover:text-brand-600">{dealName}</h3>
                    </div>
                    {deal.id_client_company && (
                        <p 
                            className="text-xs text-slate-500 truncate mt-1 cursor-pointer hover:text-brand-600" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/companies/${deal.id_client_company}`); }}
                        >
                            {companyName || 'Sin empresa'}
                        </p>
                    )}
                </div>
                {/* Colaboradores con badges */}
                <div className="flex items-center -space-x-2">
                    {(() => {
                        const collaborators = deal.collaborators || [];
                        if (collaborators.length === 0) return null;
                        
                        // Ordenar: Owner primero, luego EDIT, luego VIEW
                        const sorted = [...collaborators].sort((a, b) => {
                            const levelOrder = { OWNER: 1, EDIT: 2, VIEW: 3, BLOCKED: 4 };
                            return (levelOrder[a.access_level as keyof typeof levelOrder] || 4) - (levelOrder[b.access_level as keyof typeof levelOrder] || 4);
                        });
                        
                        // Invertir para que el Owner (primero en la lista) aparezca a la derecha con -space-x
                        return sorted.slice(0, 3).reverse().map((collab: any, idx: number) => {
                            const collabUser = cachedUsers.find(u => u.id_user === collab.id);
                            const avatarUrl = collabUser?.avatar_url || `https://ui-avatars.com/api/?name=${collabUser?.name_user || 'U'}&background=random`;
                            const userName = collabUser?.name_user || 'Usuario';
                            const isOwner = collab.access_level === 'OWNER';
                            const isPrincipal = collab.access_level === 'EDIT';
                            const isSecondary = collab.access_level === 'VIEW';
                            
                            let borderColor = 'border-white';
                            let badgeIcon = null;
                            let tooltipText = userName;
                            
                            if (isOwner) {
                                borderColor = 'border-amber-400';
                                badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center shadow-sm"><i className="fa-solid fa-star text-white text-[6px]"></i></div>;
                                tooltipText = `${userName} (Creador)`;
                            } else if (isPrincipal) {
                                borderColor = 'border-indigo-400';
                                badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm"><i className="fa-solid fa-crown text-white text-[6px]"></i></div>;
                                tooltipText = `${userName} (Principal)`;
                            } else if (isSecondary) {
                                borderColor = 'border-slate-300';
                                badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-slate-400 rounded-full flex items-center justify-center shadow-sm"><i className="fa-solid fa-eye text-white text-[6px]"></i></div>;
                                tooltipText = `${userName} (Secundario)`;
                            }
                            
                            return (
                                <div key={collab.id || idx} className="relative group/collab" title={tooltipText}>
                                    <div className="relative transition-all group-hover/collab:scale-125 group-hover/collab:z-30">
                                        <img 
                                            src={avatarUrl} 
                                            alt={userName}
                                            className={`w-8 h-8 rounded-full border-2 shadow-sm ${borderColor} bg-white relative`}
                                        />
                                        {badgeIcon}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                    {(() => {
                        const collaborators = deal.collaborators || [];
                        if (collaborators.length > 3) {
                            return (
                                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shadow-sm hover:scale-110 transition-all hover:z-20" title={`+${collaborators.length - 3} más`}>
                                    <span className="text-[8px] font-black text-slate-500">+{collaborators.length - 3}</span>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>

            <div className="p-4 space-y-3 flex-grow">
                {deal.last_note && (
                    <div className="text-xs text-slate-500">
                        <p className="italic line-clamp-2">"{deal.last_note}"</p>
                    </div>
                )}
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-bold uppercase">Siguiente Acción:</p>
                    <p className="font-bold text-slate-700 mt-0.5 truncate">{deal.next_action_desc || 'No definida'}</p>
                </div>
            </div>

            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-col gap-3">
                 <div className="flex justify-between items-center relative">
                    <div className="flex items-center gap-2">
                        <div 
                            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white cursor-pointer hover:opacity-90"
                            style={{ backgroundColor: deal.current_status_color }}
                            onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                        >
                            {deal.current_status_name}
                        </div>
                        {deal.next_contact_date && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold" title={`Próximo contacto: ${format(parseISO(deal.next_contact_date), 'dd MMM yyyy')}`}>
                                <Calendar size={12} />
                                <span>{format(parseISO(deal.next_contact_date), 'dd MMM')}</span>
                            </div>
                        )}
                    </div>
                    
                    {isStatusDropdownOpen && (
                        <div className="absolute bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border z-10 p-1 animate-fade-in-fast">
                            {dealStatuses.filter(s => s.id_status !== deal.id_status).map(status => (
                                <button
                                    key={status.id_status}
                                    onClick={() => handleStatusChange(status.id_status)}
                                    className="block w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-slate-100 font-semibold"
                                >
                                    {status.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {deal.phone && <>
                            <a href={`tel:${deal.phone}`} title="Llamar" className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-brand-600 transition-all"><Phone size={14} /></a>
                            <a href={`https://wa.me/${cleanPhoneNumber(deal.phone)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-brand-600 transition-all"><MessageSquare size={14} /></a>
                        </>
                        }
                        {deal.email && <a href={`mailto:${deal.email}`} title="Enviar Email" className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-brand-600 transition-all"><Mail size={14} /></a>}
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onManageClick(deal); }} className="w-full text-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-sm border border-brand-700 transition-all flex items-center justify-center gap-2">
                    Gestionar <ChevronRight size={16}/>
                </button>
            </div>
        </div>
    );
};

export default DealFollowUpCard;
