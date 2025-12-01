import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { ClientContact, ClientCompany } from '../types';

const ClientContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<ClientContact | null>(null);
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const foundContact = await MockApi.getClientContactById(id);
      if (foundContact) {
        setContact(foundContact);
        if (foundContact.id_client_company) {
          const foundCompany = await MockApi.getClientCompanyById(foundContact.id_client_company);
          setCompany(foundCompany || null);
        }
      } else {
        setContact(null);
      }
    } catch (e) {
      console.error("Error fetching contact details:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles del contacto...</div>;
  if (!contact) return <div className="p-8 text-center text-red-500">Contacto no encontrado.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-2">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors">
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{contact.first_name} {contact.last_name}</h1>
          <p className="text-sm text-slate-500">{contact.position || 'Cargo no especificado'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Contact Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información de Contacto</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-500">Email</label>
                <a href={`mailto:${contact.email}`} className="font-medium text-brand-600 hover:underline break-all">{contact.email}</a>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500">Teléfono</label>
                <p className="text-slate-800">{contact.phone || '-'}</p>
              </div>
            </div>
          </div>
          
          {company && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Empresa Asociada</h3>
              <div className="flex items-center">
                 <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 mr-3 text-xl">
                   <i className="fa-solid fa-building"></i>
                 </div>
                 <div>
                   <Link to={`/client-companies/${company.id_client_company}`} className="font-bold text-slate-800 hover:text-brand-600 transition-colors">{company.name_company}</Link>
                   <p className="text-xs text-slate-500">{company.industry || 'Industria no especificada'}</p>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Activity History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-60">
             <h3 className="font-bold text-slate-700 mb-2">Historial de Actividad</h3>
             <p className="text-sm text-slate-500 italic">Esta sección mostrará el historial de interacciones (cotizaciones, tratos, reuniones) con {contact.first_name} próximamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientContactDetail;
