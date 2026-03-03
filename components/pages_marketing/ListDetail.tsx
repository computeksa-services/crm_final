import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi } from '../../services/marketingApi';
import { MarketingList, ListMember } from '../../types';
import { apiFetch } from '../../services/apiClient';
import AudienceMembersModal from '../marketing_center/audiences/AudienceMembersModal';
import ConfirmModal from '../ConfirmModal';
import { BrandSpinner } from '../AppLoaders';

interface SharedUser {
  id_user: string;
  name: string;
  email: string;
  role: string;
  has_access?: boolean;
}

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [list, setList] = useState<MarketingList | undefined>(undefined);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'SETTINGS'>('MEMBERS');

  // Member View State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'UNSUBSCRIBED' | 'SUBSCRIBED'>('ALL');
  const [groupBy, setGroupBy] = useState<'NONE' | 'STATUS' | 'COMPANY'>('NONE');

  // Settings State
  const [editForm, setEditForm] = useState({ name: '', description: '', visibility: 'PRIVATE' });
  const [originalForm, setOriginalForm] = useState({ name: '', description: '', visibility: 'PRIVATE' });
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Add Member Modal State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Confirmation Modal State
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'remove' | 'unsubscribe' | 'resubscribe';
    memberId: string;
    memberName: string;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (id && user?.id_user) {
      loadListData();
    }
  }, [id, user]);

  const loadListData = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);
      
      // Cargar detalles de la lista y miembros en paralelo
      const [listData, membersData] = await Promise.all([
        marketingApi.getListDetail(id, user.id_user, user.id_tenant),
        marketingApi.getListMembers(id, user.id_user)
      ]);

      const normalizedList = {
        ...listData,
        list_id: listData.list_id || (listData as any).id_list,
        id_list: (listData as any).id_list || listData.list_id,
        tenant_id: listData.tenant_id || (listData as any).id_tenant,
      } as MarketingList;

      setList(normalizedList);
      setMembers(membersData);
      
      const initialForm = {
        name: normalizedList.name,
        description: normalizedList.description || '',
        visibility: normalizedList.visibility as string
      };
      setEditForm(initialForm);
      setOriginalForm(initialForm);
      
    } catch (error) {
      console.error('Error cargando lista:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dirty Check Effect
  useEffect(() => {
    const isFormDirty = JSON.stringify(editForm) !== JSON.stringify(originalForm);
    // In a real app, you would also check sharedUsers deep equality
    setHasUnsavedChanges(isFormDirty);
  }, [editForm, originalForm]);

  // --- Logic for Filtering & Grouping ---
  const processedMembers: Record<string, ListMember[]> = useMemo(() => {
    // 1. Filter
    let result = members.filter(m => {
      const fullName = m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
      const matchesSearch = fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (m.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    // 2. Group
    if (groupBy === 'NONE') {
      return { 'Todos': result };
    }

    return result.reduce((groups, member) => {
      let key = '';
      if (groupBy === 'STATUS') key = member.status || 'Sin Estado';
      else if (groupBy === 'COMPANY') key = member.company_name || 'Sin Empresa';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(member);
      return groups;
    }, {} as Record<string, ListMember[]>);

  }, [members, searchQuery, filterStatus, groupBy]);

  const totalFilteredMembers = useMemo(() => {
    return Object.values(processedMembers).reduce((sum, group) => sum + group.length, 0);
  }, [processedMembers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <BrandSpinner size="xl" />
      </div>
    );
  }

  if (!list) {
    return <div className="p-8 text-center text-slate-500">Lista no encontrada</div>;
  }

  // Verificar si el usuario actual es el creador de la lista
  const isCreator = list.created_by === user?.id_user;

  // --- Handlers ---

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;



    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/lists/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_list: id,
          id_user: user.id_user,
          id_tenant: user.id_tenant,
          name: editForm.name,
          description: editForm.description,
          visibility: editForm.visibility
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Error ${response.status}: ${error}`);
      }

      const updatedList = await response.json();

      
      // Actualizar el estado local
      setList(prev => prev ? { 
        ...prev, 
        name: editForm.name, 
        description: editForm.description, 
        visibility: editForm.visibility as any 
      } : undefined);
      setOriginalForm(editForm);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('❌ Error al guardar lista:', error);
    }
  };

  const handleToggleShare = (userId: string) => {
    setSharedUsers(prev => prev.map(u => {
      if (u.id_user === userId) {
        return { ...u, has_access: !u.has_access };
      }
      return u;
    }));
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!memberId || memberId.trim() === '') return;
    setPendingAction({ type: 'remove', memberId, memberName });
    setShowConfirm(true);
  };

  const handleStatusChange = (memberId: string, memberName: string, newStatus: 'SUBSCRIBED' | 'UNSUBSCRIBED') => {
    if (!memberId || memberId.trim() === '') return;
    const actionType = newStatus === 'UNSUBSCRIBED' ? 'unsubscribe' : 'resubscribe';
    setPendingAction({ type: actionType, memberId, memberName });
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    if (!pendingAction || !id || !user) return;

    setIsActionLoading(true);
    try {
      const contactIds = [pendingAction.memberId];
      
      if (pendingAction.type === 'remove') {
        await marketingApi.manageListMembers(id, contactIds, 'remove');
      } else if (pendingAction.type === 'unsubscribe') {
        await marketingApi.manageListMembers(id, contactIds, 'unsubscribe');
      } else if (pendingAction.type === 'resubscribe') {
        await marketingApi.manageListMembers(id, contactIds, 'add');
      }
      
      await refreshMembers();
      setShowConfirm(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Error al ejecutar acción:', error);
      setShowConfirm(false);
      setPendingAction(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  const refreshMembers = async () => {
    if (!id || !user) return;
    try {
      const updated = await marketingApi.getListMembers(id, user.id_user);
      setMembers(updated);
    } catch (error) {
      console.error('Error refrescando miembros', error);
    }
  };

  const handleTabChange = (tab: 'MEMBERS' | 'SETTINGS') => {
    if (activeTab === 'SETTINGS' && hasUnsavedChanges && tab !== 'SETTINGS') {
      return;
    }
    setActiveTab(tab);
  };

  // --- Render Helpers ---

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'SUBSCRIBED': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Activo</span>;
      case 'UNSUBSCRIBED': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Desuscrito</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">{status}</span>;
    }
  };

  const getGroupTitle = (key: string) => {
    if (groupBy === 'STATUS') {
      if (key === 'SUBSCRIBED') return 'Suscritos';
      if (key === 'UNSUBSCRIBED') return 'Desuscritos';
      if (key === 'BOUNCED') return 'Rebotados';
    }
    return key;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            {list.name}
            <span className={`text-xs px-2 py-0.5 rounded border uppercase tracking-wide ${ list.visibility === 'SHARED' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :  list.visibility === 'PUBLIC' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100' }`}>
              {list.visibility}
            </span>
          </h2>
          <p className="text-slate-500 mt-1">{list.description || 'Sin descripción'}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right px-4 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
            <p className="text-xs text-slate-500 font-bold uppercase">Miembros</p>
            <p className="text-xl font-bold text-slate-800">{members.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button 
            onClick={() => handleTabChange('MEMBERS')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'MEMBERS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fa-solid fa-users mr-2"></i> Miembros
          </button>
          {isCreator && (
            <button 
              onClick={() => handleTabChange('SETTINGS')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'SETTINGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <i className="fa-solid fa-gear mr-2"></i> Configuración
              {hasUnsavedChanges && <span className="ml-2 w-2 h-2 bg-amber-500 rounded-full inline-block mb-0.5"></span>}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="animate-fadeIn">
        {activeTab === 'MEMBERS' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50">
               <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                 <div className="relative flex-1 md:w-64">
                   <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                   <input 
                     type="text" 
                     placeholder="Buscar miembro..." 
                     className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                 </div>
                 
                 {/* Filters & Grouping */}
                 <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-600"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                    >
                      <option value="ALL">Todos los estados</option>
                      <option value="ACTIVE">Activos</option>
                      <option value="SUBSCRIBED">Suscritos</option>
                      <option value="UNSUBSCRIBED">Desuscritos</option>
                    </select>

                    <select 
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-600"
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as any)}
                    >
                      <option value="NONE">Sin agrupar</option>
                      <option value="STATUS">Agrupar por Estado</option>
                      <option value="COMPANY">Agrupar por Empresa</option>
                    </select>
                 </div>
               </div>

               <button 
                 onClick={() => setIsAddMemberModalOpen(true)}
                 disabled={!isCreator}
                 className={`w-full xl:w-auto px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm ${
                   isCreator 
                     ? 'bg-blue-600 text-white hover:bg-blue-700' 
                     : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                 }`}
                 title={!isCreator ? 'Solo el creador de la lista puede gestionar miembros' : ''}
               >
                 <i className="fa-solid fa-users-gear"></i> Gestionar Miembros
               </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4 font-semibold">Nombre / Email</th>
                    <th className="px-6 py-4 font-semibold">Empresa</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 font-semibold">Fecha de Unión</th>
                    <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {totalFilteredMembers === 0 ? (
                     <tr key="empty-state">
                       <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                         Sin miembros en la lista.
                       </td>
                     </tr>
                   ) : (
                     Object.entries(processedMembers).map(([groupKey, groupMembers], groupIndex) => (
                       <React.Fragment key={`group-${groupKey}-${groupIndex}`}>
                         {groupBy !== 'NONE' && (
                           <tr className="bg-slate-50 border-b border-slate-200">
                             <td colSpan={5} className="px-6 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                               {getGroupTitle(groupKey)} ({(groupMembers as ListMember[]).length})
                             </td>
                           </tr>
                         )}
                         {(groupMembers as ListMember[]).map(member => (
                           <tr key={member.id_contact} className="hover:bg-slate-50 transition-colors group">
                             <td className="px-6 py-4">
                               <div>
                                 <p className="font-semibold text-slate-800 text-sm">{member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre'}</p>
                                 <p className="text-xs text-slate-500">{member.email}</p>
                               </div>
                             </td>
                             <td className="px-6 py-4 text-sm text-slate-600">
                               {member.company_name || '-'}
                             </td>
                             <td className="px-6 py-4">
                               {getStatusBadge(member.status || 'ACTIVE')}
                             </td>
                             <td className="px-6 py-4 text-sm text-slate-500">
                               {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}
                             </td>
                             <td className="px-6 py-4 text-right">
                               <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {member.status === 'SUBSCRIBED' ? (
                                    <button 
                                      title="Desuscribir"
                                      onClick={() => handleStatusChange(member.id_contact, member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre', 'UNSUBSCRIBED')}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                                    >
                                      <i className="fa-solid fa-ban"></i>
                                    </button>
                                  ) : (
                                    <button 
                                      title="Resuscribir"
                                      onClick={() => handleStatusChange(member.id_contact, member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre', 'SUBSCRIBED')}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <i className="fa-solid fa-rotate-left"></i>
                                    </button>
                                  )}
                                  <button 
                                    title="Quitar de la lista"
                                    onClick={() => handleRemoveMember(member.id_contact, member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre')}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                               </div>
                             </td>
                           </tr>
                         ))}
                       </React.Fragment>
                     ))
                   )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
               <span>Mostrando {members.length} registros totales</span>
               {filterStatus !== 'ALL' && <span className="text-blue-600 font-medium">Filtro activo: {filterStatus}</span>}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="max-w-3xl mx-auto space-y-6">
             {/* Unsaved Changes Banner */}
             {hasUnsavedChanges && (
               <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xl"></i>
                    <div>
                      <p className="font-bold text-amber-800 text-sm">Cambios sin guardar</p>
                      <p className="text-xs text-amber-700">Tienes modificaciones pendientes en la configuración.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto justify-end">
                    <button 
                      onClick={() => setEditForm(originalForm)}
                      className="text-sm font-medium text-amber-700 hover:text-amber-900"
                    >
                      Descartar
                    </button>
                    <button 
                      onClick={handleUpdateList}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm"
                    >
                      Guardar
                    </button>
                  </div>
               </div>
             )}

            {/* General Info Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="mb-6 pb-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Información General</h3>
                    <p className="text-sm text-slate-500">Actualiza los detalles básicos de esta lista de contactos.</p>
                </div>
                
                <form onSubmit={handleUpdateList} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de la lista</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      placeholder="Ej. Clientes Potenciales Q1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
                    <textarea 
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-shadow"
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      placeholder="Describe el propósito de esta lista..."
                    />
                  </div>
                  
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-700 mb-3">Visibilidad</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${editForm.visibility === 'PRIVATE' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="mt-0.5">
                            <input 
                              type="radio" 
                              name="visibility" 
                              value="PRIVATE" 
                              checked={editForm.visibility === 'PRIVATE'}
                              onChange={(e) => setEditForm({...editForm, visibility: e.target.value})}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                             <span className="block text-sm font-semibold text-slate-800">Privada</span>
                             <span className="block text-xs text-slate-500 mt-0.5">Solo tú y los administradores pueden verla.</span>
                          </div>
                        </label>
                        
                        <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${editForm.visibility === 'PUBLIC_TENANT' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="mt-0.5">
                            <input 
                              type="radio" 
                              name="visibility" 
                              value="PUBLIC_TENANT" 
                              checked={editForm.visibility === 'PUBLIC_TENANT'}
                              onChange={(e) => setEditForm({...editForm, visibility: e.target.value})}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                             <span className="block text-sm font-semibold text-slate-800">Pública en la Empresa</span>
                             <span className="block text-xs text-slate-500 mt-0.5">Visible para todos los miembros de tu organización.</span>
                          </div>
                        </label>
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end border-t border-slate-100 mt-6">
                    <button 
                      type="submit" 
                      disabled={!hasUnsavedChanges}
                      className={`px-6 py-2.5 font-medium rounded-lg transition-colors shadow-sm ${
                        hasUnsavedChanges 
                         ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                         : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </form>
            </div>

            {/* Sharing Settings (HIDDEN FOR NOW as requested) */}
            <div className="hidden bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-2">Acceso Compartido</h3>
                <p className="text-xs text-slate-500 mb-6 pb-2 border-b border-slate-100">Selecciona los colegas que pueden ver y editar esta lista.</p>
                
                <div className={`space-y-4 max-h-[300px] overflow-y-auto pr-2 ${editForm.visibility !== 'PUBLIC_TENANT' ? 'opacity-50 pointer-events-none' : ''}`}>
                  {sharedUsers.map(user => (
                    <div key={user.id_user} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={user.avatar || 'https://via.placeholder.com/32'} alt={user.name} className="w-8 h-8 rounded-full bg-slate-200" />
                          <div className="leading-tight">
                            <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                            <p className="text-[10px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={user.has_access}
                            onChange={() => handleToggleShare(user.id_user)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <AudienceMembersModal
          isOpen={isAddMemberModalOpen}
          onClose={() => {
            setIsAddMemberModalOpen(false);
            refreshMembers();
          }}
          listId={list?.id_list || ''}
          listName={list?.name || ''}
          tenantId={user?.id_tenant || ''}
          userId={user?.id_user || ''}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingAction(null);
        }}
        onConfirm={confirmAction}
        title={
          pendingAction?.type === 'remove' ? 'Eliminar Miembro' :
          pendingAction?.type === 'unsubscribe' ? 'Desuscribir Miembro' :
          'Resuscribir Miembro'
        }
        message={
          pendingAction?.type === 'remove'
            ? `¿Seguro desea eliminar a ${pendingAction?.memberName} de la lista? Esta acción no se puede deshacer.`
            : pendingAction?.type === 'unsubscribe'
            ? `¿Seguro desea desuscribir a ${pendingAction?.memberName}? No se eliminarán pero no recibirá más correos.`
            : `¿Seguro desea resuscribir a ${pendingAction?.memberName}? Volverá a recibir correos.`
        }
        confirmText={
          pendingAction?.type === 'remove' ? 'Eliminar' :
          pendingAction?.type === 'unsubscribe' ? 'Desuscribir' :
          'Resuscribir'
        }
        cancelText="Cancelar"
        isDestructive={pendingAction?.type === 'remove'}
      />
    </div>
  );
};

export default ListDetail;
