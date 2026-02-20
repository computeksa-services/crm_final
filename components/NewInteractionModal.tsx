import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import NewInteractionForm from './NewInteractionForm';

interface NewInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'CONTACT' | 'DEAL';
  contactEmail?: string;
  contactName?: string;
  collaborators?: Array<{
    id_user?: string;
    id?: string;
    email?: string;
    name?: string;
    avatar?: string | null;
  }>;
  onSuccess: () => void;
}

const NewInteractionModal: React.FC<NewInteractionModalProps> = ({
  isOpen,
  onClose,
  entityId,
  entityType,
  contactEmail,
  contactName,
  collaborators,
  onSuccess,
}) => {
  return createPortal(
    isOpen ? (
      <div
        className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white w-full sm:max-w-[600px] sm:rounded-xl rounded-t-2xl shadow-xl overflow-hidden flex flex-col max-h-[96dvh]">

          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between shrink-0 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-0.5">Nueva gestión</p>
              <h2 className="text-[15px] font-semibold text-slate-800 leading-tight">
                {contactName || 'Registrar actividad'}
              </h2>
              {contactEmail && <p className="text-[12px] text-slate-400 mt-0.5">{contactEmail}</p>}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors mt-0.5">
              <X size={16} />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">
            <NewInteractionForm
              entityId={entityId}
              entityType={entityType}
              contactEmail={contactEmail}
              contactName={contactName}
              collaborators={collaborators}
              onSuccess={() => {
                onSuccess();
                onClose();
              }}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    ) : null,
    document.body
  );
};

export default NewInteractionModal;
