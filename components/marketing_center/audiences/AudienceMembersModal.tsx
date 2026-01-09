import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { marketingApi } from '../../../services/marketingApi';

// Definición de tipos
interface Contact {
  id_contact: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position?: string;
  company_name?: string;
  city?: string;
}

interface CompanyOption {
  id_client_company: string;
  name_company: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
  tenantId: string;
  userId: string;
  isNewList?: boolean;
}

const AudienceMembersModal: React.FC<Props> = ({ isOpen, onClose, listId, listName, tenantId, userId, isNewList }) => {
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'ADD'>(isNewList ? 'ADD' : 'MEMBERS');
  
  // Datos
  const [members, setMembers] = useState<Contact[]>([]);
  const [candidates, setCandidates] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  
  // Selección y Estado
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros Avanzados
  const [filters, setFilters] = useState({
    search: '',
    id_company: '',
    position: '',
    location: ''
  });

// Carga inicial
useEffect(() => {
  if (isOpen && listId && listId !== 'undefined') { // <--- VALIDACIÓN AGREGADA
    if (activeTab === 'MEMBERS') fetchMembers();
    if (activeTab === 'ADD') {
      fetchCandidates();
      fetchCompanies();
    }
    setSelectedIds(new Set());
  } else if (isOpen) {
    console.error("ID de lista inválido al abrir modal:", listId);
  }
}, [isOpen, activeTab, listId]);

  // Debounce para filtros
  useEffect(() => {
    if (isOpen && activeTab === 'ADD') {
      const timer = setTimeout(() => {
        fetchCandidates();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filters]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/tools/companies?id_tenant=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading companies", error);
    }
  };

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const data = await marketingApi.getListMembers(listId, userId);
      setMembers(data as any);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const data = await marketingApi.searchCrmContacts(tenantId, userId, {
        search: filters.search,
        company_id: filters.id_company,
        position: filters.position,
        location: filters.location
      });

      const currentMemberIds = new Set(members.map(m => m.id_contact));
      const available = data.filter((c: any) => !currentMemberIds.has(c.id_contact));
      
      setCandidates(available);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id_contact)));
    }
  };

  const executeAction = async (action: 'add' | 'remove') => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      await marketingApi.manageListMembers(listId, Array.from(selectedIds), action);
      
      if (action === 'add') {
        setActiveTab('MEMBERS');
        fetchMembers(); 
      } else {
        fetchMembers();
      }
      setSelectedIds(new Set());
    } catch (error) {
      alert('Error al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper seguro para mostrar nombres
  const renderName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.email || 'Sin Email';
  };

  // Helper seguro para obtener inicial (EVITA EL CRASH)
  const getInitial = (contact: Contact) => {
    const source = contact.first_name || contact.last_name || contact.email || '?';
    return source.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Gestionar Audiencia</h2>
            <p className="text-sm text-slate-500">Lista: <span className="font-semibold text-blue-600">{listName}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('MEMBERS')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'MEMBERS' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fa-solid fa-users mr-2"></i> Miembros ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('ADD')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'ADD' ? 'border-b-2 border-green-500 text-green-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fa-solid fa-user-plus mr-2"></i> Agregar Contactos
          </button>
        </div>

        {/* BARRA DE FILTROS (Solo en ADD) */}
        {activeTab === 'ADD' && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <input 
                type="text" 
                placeholder="🔍 Buscar nombre o email..." 
                value={filters.search}
                onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div className="md:col-span-3">
              <select 
                value={filters.id_company}
                onChange={(e) => setFilters(prev => ({...prev, id_company: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
              >
                <option value="">🏢 Todas las Empresas</option>
                {companies.map(c => (
                  <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <input 
                type="text" 
                placeholder="💼 Cargo" 
                value={filters.position}
                onChange={(e) => setFilters(prev => ({...prev, position: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div className="md:col-span-3">
               <input 
                type="text" 
                placeholder="📍 Ciudad / País" 
                value={filters.location}
                onChange={(e) => setFilters(prev => ({...prev, location: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
            </div>
          )}

          {/* === VISTA: MIEMBROS === */}
          {activeTab === 'MEMBERS' && (
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <i className="fas fa-folder-open text-4xl mb-3 opacity-50"></i>
                  <p>La lista está vacía.</p>
                </div>
              ) : (
                members.map((member, idx) => (
                  <div key={member.id_contact || idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">
                        {getInitial(member)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{renderName(member)}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                       <div className="hidden md:block">
                         <p className="text-xs font-semibold text-slate-700">{member.company_name || 'Particular'}</p>
                         {member.position && <p className="text-[10px] text-slate-400">{member.position}</p>}
                       </div>
                       <button 
                         onClick={() => {
                           setSelectedIds(new Set([member.id_contact]));
                           executeAction('remove');
                         }}
                         className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                         title="Quitar de la lista"
                       >
                         <i className="fas fa-times"></i>
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* === VISTA: AGREGAR (SEARCH) === */}
          {activeTab === 'ADD' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2 px-1">
                 <p className="text-xs font-bold text-slate-500 uppercase">{candidates.length} resultados</p>
                 {candidates.length > 0 && (
                   <button onClick={handleSelectAll} className="text-xs text-blue-600 font-semibold hover:underline">
                      {selectedIds.size === candidates.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                   </button>
                 )}
              </div>
              
              {candidates.length === 0 && !isLoading ? (
                 <div className="text-center py-10 text-slate-400 border border-dashed rounded-lg">
                    <p>No se encontraron contactos con estos filtros.</p>
                 </div>
              ) : (
                candidates.map((contact, idx) => (
                  <label 
                    key={contact.id_contact || idx} 
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${selectedIds.has(contact.id_contact) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        checked={selectedIds.has(contact.id_contact)}
                        onChange={() => handleToggleSelect(contact.id_contact)}
                      />
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold uppercase">
                        {getInitial(contact)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{renderName(contact)}</p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                       <p className="text-xs font-bold text-slate-600">{contact.company_name || 'Sin Empresa'}</p>
                       <p className="text-xs text-slate-400">
                         {contact.position && <span>{contact.position}</span>}
                         {contact.city && <span> • {contact.city}</span>}
                       </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center z-20">
          <span className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{selectedIds.size}</span> seleccionados
          </span>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold border border-slate-200">
              Cerrar
            </button>
            
            {activeTab === 'ADD' && (
              <button 
                onClick={() => executeAction('add')}
                disabled={selectedIds.size === 0 || isSaving}
                className="px-6 py-2 text-sm bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                {isSaving ? 'Agregando...' : 'Agregar a la Lista'}
              </button>
            )}
            
            {activeTab === 'MEMBERS' && selectedIds.size > 0 && (
                <button 
                onClick={() => executeAction('remove')}
                className="px-4 py-2 text-sm bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200"
              >
                Quitar Seleccionados
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AudienceMembersModal;