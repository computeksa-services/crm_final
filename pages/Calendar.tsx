import React, { useEffect, useState } from 'react';
import { CalendarEvent, ClientCompany, ClientContact, User, Deal, Quote } from '../types';
import { useAuth } from '../contexts/AuthContext';

type ViewMode = 'day' | 'week' | 'month';

interface Attendee {
  email: string;
  name?: string;
  type: 'contact' | 'user' | 'external';
  id?: string;
}

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: '',
    end: '',
    is_all_day: false,
    location: '',
    generate_meeting: false,
    id_trato: ''
  });
  
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAttendeeSuggestions, setShowAttendeeSuggestions] = useState(false);

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const getDateRange = () => {
    let startDate: Date;
    let endDate: Date;

    if (viewMode === 'day') {
      // Día actual desde 00:00:00 hasta 23:59:59
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
    } else if (viewMode === 'week') {
      // Semana actual (domingo a sábado)
      const day = currentDate.getDay();
      startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Mes actual
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      startDate = new Date(year, month, 1, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59);
    }

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  };

  const fetchData = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      console.log('Fetching events:', { start, end, id_user: user.id_user, id_tenant: user.id_tenant, viewMode });
      
      const [eventsResponse, clientsResponse, contactsResponse, usersResponse, dealsResponse, quotesResponse] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${user.id_tenant}`),
        fetch(`https://service.computeksa.com/webhook/api/deals?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`https://service.computeksa.com/webhook/api/quotes?id_tenant=${user.id_tenant}&id_user=${user.id_user}`)
      ]);
      
      const eventsData = eventsResponse.ok ? await eventsResponse.json() : [];
      const clientsData = clientsResponse.ok ? await clientsResponse.json() : [];
      const contactsData = contactsResponse.ok ? await contactsResponse.json() : [];
      const usersData = usersResponse.ok ? await usersResponse.json() : [];
      const dealsData = dealsResponse.ok ? await dealsResponse.json() : [];
      const quotesData = quotesResponse.ok ? await quotesResponse.json() : [];
      
      console.log('Events received:', eventsData);
      
      setEvents(eventsData);
      setClients(clientsData);
      setContacts(contactsData);
      setUsers(usersData);
      setDeals(dealsData);
      setQuotes(quotesData);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate, viewMode, user]);

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeLabel = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
  };

  // Obtener eventos próximos (siguientes 7 días)
  const getUpcomingEvents = () => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return events
      .filter(e => {
        const eventStart = new Date(e.start);
        return eventStart >= now && eventStart <= sevenDaysLater;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5);
  };

  // --- EVENT DETAIL ---
  const fetchEventDetail = async (eventId: string) => {
    if (!user?.id_tenant || !user?.id_user) return;

    setLoadingDetail(true);
    setIsDetailModalOpen(true);
    
    try {
      const response = await fetch(
        `https://service.computeksa.com/webhook/api/events/detail?id_evento=${eventId}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener detalles del evento');
      }
      
      const data = await response.json();
      console.log('Event detail received:', data);
      setSelectedEventDetail(data);
    } catch (error) {
      console.error('Error fetching event detail:', error);
      alert('Error al cargar los detalles del evento');
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleEventClick = (eventId: string) => {
    fetchEventDetail(eventId);
  };

  // --- FORM HANDLERS ---

  const handleOpenModal = () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Formatear para datetime-local usando hora local del sistema
    const formatForInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setFormData({
      title: '',
      description: '',
      start: formatForInput(now),
      end: formatForInput(oneHourLater),
      is_all_day: false,
      location: '',
      generate_meeting: false,
      id_trato: ''
    });
    setAttendees([]);
    setAttendeeInput('');
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const inputValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: inputValue }));
  };

  const addAttendee = (attendee: Attendee) => {
    if (!attendees.find(a => a.email === attendee.email)) {
      setAttendees([...attendees, attendee]);
      setAttendeeInput('');
      setShowAttendeeSuggestions(false);
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a.email !== email));
  };

  const addExternalAttendee = () => {
    const email = attendeeInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addAttendee({ email, type: 'external' });
    }
  };

  const getAttendeeSuggestions = () => {
    if (!attendeeInput) {
      // Si no hay búsqueda, mostrar todos los usuarios y contactos principales
      const suggestions: Attendee[] = [];
      
      // Primero todos los usuarios del tenant
      users.slice(0, 5).forEach(u => {
        suggestions.push({
          email: u.email_user,
          name: u.name_user,
          type: 'user',
          id: u.id_user
        });
      });
      
      // Luego algunos contactos
      contacts.slice(0, 5).forEach(c => {
        suggestions.push({
          email: c.email,
          name: `${c.first_name} ${c.last_name}`,
          type: 'contact',
          id: c.id_contact
        });
      });
      
      return suggestions;
    }
    
    const search = attendeeInput.toLowerCase();
    const suggestions: Attendee[] = [];

    // Buscar en contactos
    contacts
      .filter(c => 
        c.email.toLowerCase().includes(search) || 
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
        (c.client_company_name && c.client_company_name.toLowerCase().includes(search))
      )
      .slice(0, 8)
      .forEach(c => {
        suggestions.push({
          email: c.email,
          name: `${c.first_name} ${c.last_name}${c.client_company_name ? ` (${c.client_company_name})` : ''}`,
          type: 'contact',
          id: c.id_contact
        });
      });

    // Buscar en usuarios
    users
      .filter(u => 
        u.email_user.toLowerCase().includes(search) || 
        u.name_user.toLowerCase().includes(search)
      )
      .slice(0, 5)
      .forEach(u => {
        suggestions.push({
          email: u.email_user,
          name: u.name_user,
          type: 'user',
          id: u.id_user
        });
      });

    return suggestions;
  };

  // Agregar sugerencias automáticas basadas en el trato seleccionado
  const handleDealChange = (dealId: string) => {
    console.log('Deal selected:', dealId, 'Available deals:', deals);
    
    setFormData(prev => ({ ...prev, id_trato: dealId }));
    
    if (dealId && deals.length > 0) {
      const selectedDeal = deals.find(d => d.id_trato === dealId);
      console.log('Found deal:', selectedDeal);
      
      if (selectedDeal) {
        // Sugerir contacto del trato
        if (selectedDeal.id_contact) {
          const contact = contacts.find(c => c.id_contact === selectedDeal.id_contact);
          if (contact && !attendees.find(a => a.email === contact.email)) {
            console.log('Adding contact:', contact);
            addAttendee({
              email: contact.email,
              name: `${contact.first_name} ${contact.last_name}`,
              type: 'contact',
              id: contact.id_contact
            });
          }
        }
        
        // Sugerir al creador del trato si no soy yo
        if (selectedDeal.id_user && selectedDeal.id_user !== user?.id_user) {
          const creator = users.find(u => u.id_user === selectedDeal.id_user);
          if (creator && !attendees.find(a => a.email === creator.email_user)) {
            console.log('Adding deal creator:', creator);
            addAttendee({
              email: creator.email_user,
              name: creator.name_user,
              type: 'user',
              id: creator.id_user
            });
          }
        }
      }
    }
  };

  // Obtener contactos filtrados por empresa
  const getContactsByCompany = (companyId: string) => {
    return contacts.filter(c => c.id_client_company === companyId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        action: 'create',
        id_user: user?.id_user,
        id_tenant: user?.id_tenant,
        event: {
          title: formData.title,
          description: formData.description,
          start: new Date(formData.start).toISOString(),
          end: new Date(formData.end).toISOString(),
          is_all_day: formData.is_all_day,
          location: formData.location || undefined,
          generate_meeting: formData.generate_meeting,
          id_trato: formData.id_trato || undefined,
          id_tenant: user?.id_tenant,
          id_user: user?.id_user
        },
        attendees: attendees
      };

      console.log('Creating event:', payload);

      const response = await fetch('https://service.computeksa.com/webhook/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear evento');
      }
      
      await fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating event", error);
      alert(error instanceof Error ? error.message : "Error al crear el evento");
    } finally {
      setSubmitting(false);
    }
  };

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-slate-800">Calendario</h1>
          
          <button 
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
          >
            Hoy
          </button>
          
          <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200">
            <button onClick={() => navigate('prev')} className="p-2 hover:bg-slate-100 rounded-l text-slate-500">
               <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span className="px-4 text-center font-semibold text-slate-700 capitalize min-w-[200px]">
              {getDateRangeLabel()}
            </span>
            <button onClick={() => navigate('next')} className="p-2 hover:bg-slate-100 rounded-r text-slate-500">
               <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Selector de Vista */}
          <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'day' 
                  ? 'bg-brand-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'week' 
                  ? 'bg-brand-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'month' 
                  ? 'bg-brand-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Mes
            </button>
          </div>
          
          <button 
            onClick={handleOpenModal}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            <i className="fa-solid fa-plus mr-2"></i> Nuevo Evento
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 overflow-hidden">{/* Calendar View */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">{loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <i className="fa-solid fa-spinner fa-spin mr-2"></i> Cargando eventos...
            </div>
          ) : viewMode === 'month' ? (
            <MonthView events={events} currentDate={currentDate} onOpenModal={handleOpenModal} onEventClick={handleEventClick} />
          ) : viewMode === 'week' ? (
            <WeekView events={events} currentDate={currentDate} onOpenModal={handleOpenModal} onEventClick={handleEventClick} />
          ) : (
            <DayView events={events} currentDate={currentDate} onOpenModal={handleOpenModal} onEventClick={handleEventClick} />
          )}
        </div>

        {/* Panel Lateral - Eventos Próximos */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col max-h-full">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <i className="fa-solid fa-clock mr-2 text-brand-600"></i>
            Próximos Eventos
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {upcomingEvents.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <i className="fa-solid fa-calendar-xmark text-3xl mb-2"></i>
                <p className="text-sm">No hay eventos próximos</p>
              </div>
            ) : (
              upcomingEvents.map(event => {
                const startDate = new Date(event.start);
                const isToday = startDate.toDateString() === new Date().toDateString();
                const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                
                let dateLabel = startDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                if (isToday) dateLabel = 'Hoy';
                if (isTomorrow) dateLabel = 'Mañana';
                
                const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
                
                return (
                  <div 
                    key={event.id}
                    onClick={() => handleEventClick(event.id)}
                    className="p-3 rounded-lg border-l-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    style={{ borderColor: event.color || '#6366f1' }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase">{dateLabel}</span>
                      <span className="text-xs font-bold" style={{ color: event.color || '#6366f1' }}>{timeStr}</span>
                    </div>
                    <h4 className="font-semibold text-sm text-slate-800 mb-1">{event.title}</h4>
                    {event.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{event.description}</p>
                    )}
                    {event.meeting_url && (
                      <div className="mt-2 flex items-center text-xs text-brand-600">
                        <i className="fa-solid fa-video mr-1"></i>
                        <span>Reunión virtual</span>
                      </div>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="mt-2 flex items-center text-xs text-slate-500">
                        <i className="fa-solid fa-users mr-1"></i>
                        <span>{event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>



      {/* --- CREATE EVENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Nuevo Evento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="Ej: Reunión con Cliente"
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Inicio <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="datetime-local"
                    name="start"
                    required
                    value={formData.start}
                    onChange={handleInputChange}
                    disabled={formData.is_all_day}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">
                     Fin <span className="text-red-500">*</span>
                   </label>
                   <input 
                    type="datetime-local"
                    name="end"
                    required
                    value={formData.end}
                    onChange={handleInputChange}
                    disabled={formData.is_all_day}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Todo el día */}
              <div className="flex items-center">
                <input 
                  type="checkbox"
                  name="is_all_day"
                  id="is_all_day"
                  checked={formData.is_all_day}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                />
                <label htmlFor="is_all_day" className="ml-2 text-sm text-slate-700">
                  Evento de todo el día
                </label>
              </div>

              {/* Ubicación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                <input 
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Ej: Oficina Central, Sala de Juntas"
                />
              </div>

              {/* Generar videollamada */}
              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <input 
                  type="checkbox"
                  name="generate_meeting"
                  id="generate_meeting"
                  checked={formData.generate_meeting}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                />
                <label htmlFor="generate_meeting" className="ml-2 text-sm text-slate-700 flex items-center">
                  <i className="fa-solid fa-video mr-2 text-brand-600"></i>
                  Generar enlace de videollamada (Google Meet / Teams)
                </label>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea 
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Detalles adicionales sobre el evento..."
                />
              </div>

              {/* Relaciones CRM */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <i className="fa-solid fa-handshake mr-1"></i> Trato Relacionado
                </label>
                <select 
                  name="id_trato"
                  value={formData.id_trato}
                  onChange={(e) => handleDealChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">-- Seleccionar un trato --</option>
                  {deals && deals.length > 0 ? (
                    deals.map(d => (
                      <option key={d.id_trato} value={d.id_trato}>
                        {d.nombre_trato} {d.client_company_name ? `(${d.client_company_name})` : ''}
                      </option>
                    ))
                  ) : (
                    <option disabled>No hay tratos disponibles</option>
                  )}
                </select>
              </div>

              {/* Asistentes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <i className="fa-solid fa-users mr-1"></i> Asistentes
                </label>
                
                {/* Input de búsqueda */}
                <div className="relative">
                  <input 
                    type="text"
                    value={attendeeInput}
                    onChange={(e) => {
                      setAttendeeInput(e.target.value);
                      setShowAttendeeSuggestions(true);
                    }}
                    onFocus={() => setShowAttendeeSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addExternalAttendee();
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Buscar contacto o email externo..."
                  />
                  
                  {/* Sugerencias */}
                  {showAttendeeSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* Si hay una empresa seleccionada, mostrar sus contactos primero */}
                      {formData.id_client_company && !attendeeInput && (
                        <>
                          <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 sticky top-0">
                            Contactos de la empresa
                          </div>
                          {getContactsByCompany(formData.id_client_company).map((contact, idx) => (
                            <button
                              key={`company-${idx}`}
                              type="button"
                              onClick={() => addAttendee({
                                email: contact.email,
                                name: `${contact.first_name} ${contact.last_name}`,
                                type: 'contact',
                                id: contact.id_contact
                              })}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-800">{contact.first_name} {contact.last_name}</div>
                                <div className="text-xs text-slate-500">{contact.email}</div>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                Contacto
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {/* Sugerencias generales */}
                      {getAttendeeSuggestions().length > 0 && (
                        <>
                          {formData.id_client_company && !attendeeInput && (
                            <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 sticky top-0">
                              Todos los colaboradores y contactos
                            </div>
                          )}
                          {getAttendeeSuggestions().map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => addAttendee(suggestion)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-800">{suggestion.name || suggestion.email}</div>
                                <div className="text-xs text-slate-500">{suggestion.email}</div>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                suggestion.type === 'contact' ? 'bg-blue-100 text-blue-700' :
                                suggestion.type === 'user' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {suggestion.type === 'contact' ? 'Contacto' : suggestion.type === 'user' ? 'Colaborador' : 'Externo'}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {/* Agregar email externo */}
                      {attendeeInput && getAttendeeSuggestions().length === 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeInput) && (
                        <button
                          type="button"
                          onClick={addExternalAttendee}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 text-sm text-slate-600"
                        >
                          <i className="fa-solid fa-plus mr-2"></i>
                          Agregar "{attendeeInput}" como invitado externo
                        </button>
                      )}
                      
                      {/* Mensaje si no hay resultados */}
                      {attendeeInput && getAttendeeSuggestions().length === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeInput) && (
                        <div className="px-3 py-4 text-center text-sm text-slate-400">
                          No se encontraron resultados
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de asistentes agregados */}
                {attendees.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attendees.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            att.type === 'contact' ? 'bg-blue-500' :
                            att.type === 'user' ? 'bg-green-500' :
                            'bg-gray-500'
                          }`}></span>
                          <div>
                            <div className="text-sm font-medium text-slate-800">{att.name || att.email}</div>
                            {att.name && <div className="text-xs text-slate-500">{att.email}</div>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttendee(att.email)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm flex items-center ${submitting ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar Evento
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- EVENT DETAIL MODAL --- */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center" style={{ backgroundColor: selectedEventDetail?.[0]?.color ? `${selectedEventDetail[0].color}10` : '#f8fafc' }}>
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <i className="fa-solid fa-calendar-day mr-2" style={{ color: selectedEventDetail?.[0]?.color || '#6366f1' }}></i>
                Detalles del Evento
              </h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>

            {/* Content */}
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400 mr-2"></i>
                <span className="text-slate-500">Cargando detalles...</span>
              </div>
            ) : selectedEventDetail && selectedEventDetail[0] ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(() => {
                  const event = selectedEventDetail[0];
                  const startDate = new Date(event.start);
                  const endDate = new Date(event.end);
                  
                  const formatDate = (date: Date) => {
                    return date.toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                  };
                  
                  const formatTime = (date: Date) => {
                    return date.toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  };

                  return (
                    <>
                      {/* Título */}
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">{event.title}</h3>
                        <span 
                          className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: event.color || '#6366f1' }}
                        >
                          {event.type}
                        </span>
                      </div>

                      {/* Fecha y Hora */}
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center text-slate-700">
                          <i className="fa-solid fa-calendar mr-3 text-slate-400 w-5"></i>
                          <span className="capitalize">{formatDate(startDate)}</span>
                        </div>
                        {!event.allDay && (
                          <div className="flex items-center text-slate-700">
                            <i className="fa-solid fa-clock mr-3 text-slate-400 w-5"></i>
                            <span>{formatTime(startDate)} - {formatTime(endDate)}</span>
                          </div>
                        )}
                        {event.allDay && (
                          <div className="flex items-center text-slate-700">
                            <i className="fa-solid fa-sun mr-3 text-slate-400 w-5"></i>
                            <span>Todo el día</span>
                          </div>
                        )}
                      </div>

                      {/* Link de Reunión */}
                      {event.meeting_url && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <i className="fa-solid fa-video mr-2 text-blue-600"></i>
                                <span className="font-semibold text-blue-900">Reunión Virtual</span>
                                <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {event.meeting_platform?.replace('_', ' ')}
                                </span>
                              </div>
                              <a 
                                href={event.meeting_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                              >
                                {event.meeting_url}
                              </a>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(event.meeting_url);
                                alert('Link copiado al portapapeles');
                              }}
                              className="ml-2 p-2 hover:bg-blue-100 rounded text-blue-600"
                              title="Copiar link"
                            >
                              <i className="fa-solid fa-copy"></i>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Descripción */}
                      {event.description && (
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-2 flex items-center">
                            <i className="fa-solid fa-align-left mr-2 text-slate-400"></i>
                            Descripción
                          </h4>
                          <p className="text-slate-600 whitespace-pre-wrap">{event.description}</p>
                        </div>
                      )}

                      {/* Relaciones CRM */}
                      {(event.deal_title || event.quote_number) && (
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3 flex items-center">
                            <i className="fa-solid fa-link mr-2 text-slate-400"></i>
                            Relaciones
                          </h4>
                          <div className="space-y-2">
                            {event.deal_title && (
                              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                                <i className="fa-solid fa-handshake text-green-600 mr-3"></i>
                                <div>
                                  <div className="text-xs text-green-600 font-medium">Trato</div>
                                  <div className="text-sm font-semibold text-green-900">{event.deal_title}</div>
                                </div>
                              </div>
                            )}
                            {event.quote_number && (
                              <div className="flex items-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <i className="fa-solid fa-file-invoice text-purple-600 mr-3"></i>
                                <div>
                                  <div className="text-xs text-purple-600 font-medium">Cotización</div>
                                  <div className="text-sm font-semibold text-purple-900">#{event.quote_number}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Asistentes */}
                      {event.attendees && event.attendees.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3 flex items-center">
                            <i className="fa-solid fa-users mr-2 text-slate-400"></i>
                            Asistentes ({event.attendees.length})
                          </h4>
                          <div className="space-y-2">
                            {event.attendees.map((attendee: any, idx: number) => {
                              const statusConfig = {
                                'accepted': { icon: 'check-circle', color: 'text-green-600', bg: 'bg-green-50', label: 'Aceptado' },
                                'declined': { icon: 'times-circle', color: 'text-red-600', bg: 'bg-red-50', label: 'Rechazado' },
                                'tentative': { icon: 'question-circle', color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Tentativo' },
                                'needs_action': { icon: 'clock', color: 'text-slate-400', bg: 'bg-slate-50', label: 'Sin responder' }
                              };
                              
                              const status = statusConfig[attendee.status as keyof typeof statusConfig] || statusConfig.needs_action;
                              
                              return (
                                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${status.bg} border-slate-200`}>
                                  <div className="flex items-center space-x-3">
                                    {attendee.avatar ? (
                                      <img src={attendee.avatar} alt={attendee.email} className="w-10 h-10 rounded-full" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                        <i className="fa-solid fa-user text-slate-500"></i>
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <div className="font-medium text-slate-800 flex items-center">
                                        {attendee.email}
                                        {attendee.is_organizer && (
                                          <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                            Organizador
                                          </span>
                                        )}
                                      </div>
                                      <div className={`text-xs ${status.color} flex items-center mt-1`}>
                                        <i className={`fa-solid fa-${status.icon} mr-1`}></i>
                                        {status.label}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                No se pudo cargar la información del evento
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center">
                  <i className="fa-solid fa-edit mr-2"></i>
                  Editar
                </button>
                <button className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center">
                  <i className="fa-solid fa-trash mr-2"></i>
                  Eliminar
                </button>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MONTH VIEW ============
interface ViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onOpenModal: () => void;
  onEventClick: (eventId: string) => void;
}

const MonthView: React.FC<ViewProps> = ({ events, currentDate, onOpenModal, onEventClick }) => {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const daysArray = [];
    for (let i = 0; i < firstDay; i++) {
      daysArray.push(null);
    }
    for (let i = 1; i <= days; i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const days = getDaysInMonth(currentDate);

  return (
    <>
      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 bg-slate-50">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/50 border-b border-r border-slate-100 min-h-[100px]"></div>;

          const dayEvents = getEventsForDay(date);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={date.toISOString()} className="p-2 border-b border-r border-slate-100 min-h-[100px] hover:bg-slate-50 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
                <button 
                  onClick={onOpenModal}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand-500 transition-opacity"
                >
                  <i className="fa-solid fa-plus-circle"></i>
                </button>
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(ev => {
                  const startDate = new Date(ev.start);
                  const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
                  
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => onEventClick(ev.id)}
                      className="text-xs p-1.5 rounded border-l-2 cursor-pointer truncate hover:shadow-md transition-shadow"
                      style={{
                        backgroundColor: ev.color ? `${ev.color}10` : '#f0f9ff',
                        borderColor: ev.color || '#3b82f6'
                      }}
                      title={ev.title}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{timeStr}</span>
                        {ev.meeting_url && <i className="fa-solid fa-video text-[10px]" style={{ color: ev.color || '#3b82f6' }}></i>}
                      </div>
                      <div className="truncate" style={{ color: ev.color || '#1e40af' }}>{ev.title}</div>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-slate-500 pl-1">+{dayEvents.length - 3} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ============ WEEK VIEW ============
const WeekView: React.FC<ViewProps> = ({ events, currentDate, onOpenModal, onEventClick }) => {
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const weekDays = getWeekDays();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex flex-col h-full">
      {/* Header con días */}
      <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="py-3 text-center text-sm font-semibold text-slate-500"></div>
        {weekDays.map((day, idx) => {
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <div key={idx} className="py-3 text-center">
              <div className={`text-xs text-slate-500 ${isToday ? 'font-bold' : ''}`}>
                {day.toLocaleDateString('es-ES', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold mt-1 ${isToday ? 'text-brand-600' : 'text-slate-700'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid de horas */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8 auto-rows-[60px]">
          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div className="border-r border-b border-slate-100 p-2 text-xs text-slate-500 text-right pr-2 bg-slate-50">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, dayIdx) => {
                const dayEvents = getEventsForDay(day).filter(e => {
                  const eventHour = new Date(e.start).getHours();
                  return eventHour === hour;
                });

                return (
                  <div key={dayIdx} className="border-r border-b border-slate-100 p-1 hover:bg-slate-50 group relative">
                    {dayEvents.map(ev => {
                      const startDate = new Date(ev.start);
                      const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
                      
                      return (
                        <div 
                          key={ev.id}
                          onClick={() => onEventClick(ev.id)}
                          className="text-xs p-1 rounded mb-1 cursor-pointer border-l-2 hover:shadow-md transition-shadow"
                          style={{
                            backgroundColor: ev.color ? `${ev.color}20` : '#f0f9ff',
                            borderColor: ev.color || '#3b82f6'
                          }}
                          title={ev.title}
                        >
                          <div className="font-bold" style={{ color: ev.color || '#1e40af' }}>{timeStr}</div>
                          <div className="truncate">{ev.title}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============ DAY VIEW ============
const DayView: React.FC<ViewProps> = ({ events, currentDate, onOpenModal, onEventClick }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour: number) => {
    return events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.getHours() === hour &&
             eventDate.toDateString() === currentDate.toDateString();
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 p-4 text-center">
        <div className="text-sm text-slate-500 capitalize">
          {currentDate.toLocaleDateString('es-ES', { weekday: 'long' })}
        </div>
        <div className="text-3xl font-bold text-slate-800 mt-1">
          {currentDate.getDate()}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Horas del día */}
      <div className="flex-1 overflow-y-auto">
        {hours.map(hour => {
          const hourEvents = getEventsForHour(hour);

          return (
            <div key={hour} className="flex border-b border-slate-100 min-h-[80px] hover:bg-slate-50 group">
              <div className="w-20 p-3 text-sm text-slate-500 text-right border-r border-slate-100 bg-slate-50">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 p-2 space-y-2">
                {hourEvents.map(ev => {
                  const startDate = new Date(ev.start);
                  const endDate = new Date(ev.end);
                  const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
                  
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => onEventClick(ev.id)}
                      className="p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow"
                      style={{
                        backgroundColor: ev.color ? `${ev.color}15` : '#f0f9ff',
                        borderColor: ev.color || '#3b82f6'
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-sm" style={{ color: ev.color || '#1e40af' }}>{ev.title}</h4>
                        {ev.meeting_url && (
                          <i className="fa-solid fa-video text-sm" style={{ color: ev.color || '#3b82f6' }}></i>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mb-1">{timeStr}</div>
                      {ev.description && (
                        <p className="text-xs text-slate-600 mt-2">{ev.description}</p>
                      )}
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="mt-2 flex items-center text-xs text-slate-500">
                          <i className="fa-solid fa-users mr-1"></i>
                          <span>{ev.attendees.length} participante{ev.attendees.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
