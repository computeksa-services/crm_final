import React, { useEffect, useState } from 'react';
import { MockApi } from '../services/mockApi';
import { CalendarEvent, ClientCompany } from '../types';

const Calendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    tipo: 'REUNION',
    id_client_company: ''
  });

  const fetchData = async () => {
    const [eventsData, clientsData] = await Promise.all([
      MockApi.getEvents(),
      MockApi.getClientCompanies()
    ]);
    setEvents(eventsData);
    setClients(clientsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Simple Month Generation Logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const daysArray = [];
    // Padding for empty start days
    for (let i = 0; i < firstDay; i++) {
      daysArray.push(null);
    }
    // Days of month
    // Days of month
    for (let i = 1; i <= days; i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const days = getDaysInMonth(currentMonth);

  const getEventsForDay = (date: Date) => {
    return events.filter(e => {
      const eventDate = new Date(e.fecha_inicio);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // --- FORM HANDLERS ---

  const handleOpenModal = () => {
    // Default start date to now, end date to +1 hour
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (d: Date) => d.toISOString().slice(0, 16);

    setFormData({
      titulo: '',
      descripcion: '',
      fecha_inicio: formatForInput(now),
      fecha_fin: formatForInput(oneHourLater),
      tipo: 'REUNION',
      id_client_company: ''
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Find client name if selected
      const selectedClient = clients.find(c => c.id_client_company === formData.id_client_company);
      
      const newEvent: Partial<CalendarEvent> = {
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
        fecha_fin: new Date(formData.fecha_fin).toISOString(),
        tipo: formData.tipo as any,
        id_client_company: formData.id_client_company || undefined,
        // nombre_cliente: selectedClient?.name_company || undefined, // Not part of interface? Assuming it is handled or not needed if types don't have it
        id_user: 'current-user-id' // MockApi will handle this
      };

      await MockApi.addEvent(newEvent);
      await fetchData(); // Refresh events
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating event", error);
      alert("Error al crear el evento");
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Calendario</h1>
        
        <div className="flex items-center space-x-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1 flex items-center">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded text-slate-500">
               <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span className="w-32 text-center font-bold text-slate-700">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded text-slate-500">
               <i className="fa-solid fa-chevron-right"></i>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 bg-slate-50">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">Cargando eventos...</div>
        ) : (
          <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
            {days.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/50 border-b border-r border-slate-100 min-h-[100px]"></div>;

              const dayEvents = getEventsForDay(date);
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div key={date.toISOString()} className={`p-2 border-b border-r border-slate-100 min-h-[100px] transition-colors hover:bg-slate-50 relative group`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}`}>
                      {date.getDate()}
                    </span>
                    <button 
                       onClick={handleOpenModal} // Ideally pass date to pre-fill
                       className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand-500 transition-opacity"
                    >
                      <i className="fa-solid fa-plus-circle"></i>
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.map(ev => (
                      <div key={ev.id_evento} className={`text-xs p-1.5 rounded border-l-2 cursor-pointer truncate ${
                        ev.tipo === 'REUNION' ? 'bg-blue-50 border-blue-500 text-blue-700' : 
                        ev.tipo === 'LLAMADA' ? 'bg-green-50 border-green-500 text-green-700' :
                        'bg-gray-100 border-gray-400 text-gray-700'
                      }`} title={ev.titulo}>
                         <span className="font-bold mr-1">{new Date(ev.fecha_inicio).getHours()}:00</span>
                         {ev.titulo}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- CREATE EVENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Nuevo Evento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input 
                  type="text"
                  name="titulo"
                  required
                  value={formData.titulo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="Ej: Reunión con Cliente"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select 
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="REUNION">Reunión</option>
                    <option value="LLAMADA">Llamada</option>
                    <option value="TAREA">Tarea</option>
                    <option value="DEADLINE">Deadline</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente (Opcional)</label>
                  <select 
                    name="id_client_company"
                    value={formData.id_client_company}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">-- Sin cliente --</option>
                    {clients.map(c => (
                      <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inicio</label>
                  <input 
                    type="datetime-local"
                    name="fecha_inicio"
                    required
                    value={formData.fecha_inicio}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Fin</label>
                   <input 
                    type="datetime-local"
                    name="fecha_fin"
                    required
                    value={formData.fecha_fin}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea 
                  name="descripcion"
                  rows={3}
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Detalles adicionales..."
                />
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
    </div>
  );
};

export default Calendar;
