import React, { useEffect, useMemo, useState } from 'react';
import { ClientContact, Deal, User } from '../types';
import { EventModal, EventFormData, Attendee as EventAttendee } from '../pages/calendar/EventModal';

const formatForInput = (d: Date): string => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dy}T${h}:${mi}`;
};

const toEventFormData = (seed?: Partial<EventFormData>): EventFormData => {
  const base = new Date();
  const end = new Date(base.getTime() + 60 * 60 * 1000);
  return {
    title: seed?.title || '',
    description: seed?.description || '',
    start: seed?.start || formatForInput(base),
    end: seed?.end || formatForInput(end),
    is_all_day: seed?.is_all_day || false,
    location: seed?.location || '',
    generate_meeting: seed?.generate_meeting || false,
    id_trato: seed?.id_trato || '',
    id_client_company: seed?.id_client_company || '',
  };
};

interface InteractionEventCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (payload: { formData: EventFormData; attendees: EventAttendee[] }) => void;
  contacts: ClientContact[];
  users: User[];
  currentUserId?: string;
  dealContext?: {
    id_trato: string;
    nombre_trato?: string;
    id_client_company?: string;
    client_company_name?: string;
    contact_name?: string;
  };
  initialFormData?: Partial<EventFormData>;
  initialAttendees?: EventAttendee[];
}

const InteractionEventCaptureModal: React.FC<InteractionEventCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  contacts,
  users,
  currentUserId,
  dealContext,
  initialFormData,
  initialAttendees = [],
}) => {
  const [formData, setFormData] = useState<EventFormData>(toEventFormData(initialFormData));
  const [attendees, setAttendees] = useState<EventAttendee[]>(initialAttendees);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAttendeeSuggestions, setShowAttendeeSuggestions] = useState(false);
  const [showDealSuggestions, setShowDealSuggestions] = useState(false);
  const [dealSearchInput, setDealSearchInput] = useState('');

  const selectedDeal = useMemo<Deal | null>(() => {
    if (!dealContext?.id_trato) return null;
    return {
      id_trato: dealContext.id_trato,
      nombre_trato: dealContext.nombre_trato || `Trato #${dealContext.id_trato}`,
      id_client_company: dealContext.id_client_company || '',
      client_company_name: dealContext.client_company_name || '',
      contact_name: dealContext.contact_name || '',
      id_deal_status: '',
      id_user: '',
    } as unknown as Deal;
  }, [dealContext]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(toEventFormData({
      ...initialFormData,
      id_trato: dealContext?.id_trato || initialFormData?.id_trato || '',
      id_client_company: dealContext?.id_client_company || initialFormData?.id_client_company || '',
    }));
    setAttendees(initialAttendees);
    setAttendeeInput('');
    setShowAttendeeSuggestions(false);
    setShowDealSuggestions(false);
    setDealSearchInput('');
  }, [isOpen, initialFormData, initialAttendees, dealContext]);

  const getAttendeeSuggestions = (): EventAttendee[] => {
    const alreadyAdded = attendees.map(a => a.email.toLowerCase());
    const q = attendeeInput.trim().toLowerCase();

    const candidateUsers = users
      .filter(u => u.id_user !== currentUserId)
      .filter(u => u.email_user)
      .filter(u => !alreadyAdded.includes(u.email_user.toLowerCase()))
      .filter(u => !q || u.email_user.toLowerCase().includes(q) || (u.name_user || '').toLowerCase().includes(q))
      .slice(0, 4)
      .map(u => ({ email: u.email_user, name: u.name_user, type: 'user' as const, id: u.id_user }));

    const candidateContacts = contacts
      .filter(c => c.email)
      .filter(c => !alreadyAdded.includes(String(c.email).toLowerCase()))
      .filter(c => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        return !q || String(c.email).toLowerCase().includes(q) || fullName.toLowerCase().includes(q);
      })
      .slice(0, 4)
      .map(c => ({
        email: String(c.email),
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.title || c.email,
        type: 'contact' as const,
        id: c.id_contact,
      }));

    return [...candidateUsers, ...candidateContacts].slice(0, 6);
  };

  const addAttendee = (attendee: EventAttendee) => {
    setAttendees(prev => prev.find(a => a.email.toLowerCase() === attendee.email.toLowerCase()) ? prev : [...prev, attendee]);
    setAttendeeInput('');
    setShowAttendeeSuggestions(false);
  };

  return (
    <EventModal
      isOpen={isOpen}
      mode="capture"
      submitLabel="Usar en gestión"
      isEditing={false}
      submitting={false}
      formData={formData}
      attendees={attendees}
      attendeeInput={attendeeInput}
      showAttendeeSuggestions={showAttendeeSuggestions}
      dealSearchInput={dealSearchInput}
      showDealSuggestions={showDealSuggestions}
      selectedDeal={selectedDeal}
      deals={selectedDeal ? [selectedDeal] : []}
      dealsLoading={false}
      dealsLoaded={true}
      contacts={contacts}
      users={users}
      currentUserId={currentUserId}
      onClose={onClose}
      onCapture={onCapture}
      onInputChange={(e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
      }}
      onAddAttendee={addAttendee}
      onRemoveAttendee={(email) => setAttendees(prev => prev.filter(a => a.email !== email))}
      onAttendeeInputChange={setAttendeeInput}
      onSetShowAttendeeSuggestions={setShowAttendeeSuggestions}
      onAddExternalAttendee={() => {
        const value = attendeeInput.trim();
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
        addAttendee({ email: value, type: 'external' });
      }}
      onDealSearchChange={setDealSearchInput}
      onSetShowDealSuggestions={setShowDealSuggestions}
      onSelectDeal={(deal) => {
        setFormData(prev => ({
          ...prev,
          id_trato: deal.id_trato || '',
          id_client_company: deal.id_client_company || '',
        }));
        setShowDealSuggestions(false);
      }}
      onClearDeal={() => {
        if (dealContext?.id_trato) return;
        setFormData(prev => ({ ...prev, id_trato: '', id_client_company: '' }));
      }}
      onFetchDeals={() => {}}
      getAttendeeSuggestions={getAttendeeSuggestions}
      getContactsByCompany={(companyId: string) => contacts.filter(c => c.id_client_company === companyId)}
    />
  );
};

export default InteractionEventCaptureModal;
