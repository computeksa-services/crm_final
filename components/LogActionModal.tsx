import React from 'react';
import { createPortal } from 'react-dom';
import { FollowUpItem } from '../types';
import { X } from 'lucide-react';
import NewInteractionForm from './NewInteractionForm';

interface LogActionModalProps {
  item: FollowUpItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LogActionModal: React.FC<LogActionModalProps> = ({ item, isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative flex flex-col items-stretch z-10 animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 z-20"><X size={22}/></button>
        <h2 className="font-black text-xl text-slate-800 mb-4 px-8 pt-8">Registrar Gestión</h2>
        <div className="px-8 pb-8">
          <NewInteractionForm
            entityId={item.entity_type === 'DEAL' ? (item.id_entity || item.id_trato || '') : (item.id_entity || item.id_contact || '')}
            entityType={item.entity_type}
            contactEmail={item.email}
            contactName={(item as any).contact_name || (item as any).contact_full_name || item.title || 'Contacto'}
            collaborators={(item as any).collaborators || []}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LogActionModal;
