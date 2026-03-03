import React from 'react';
import { BrandSpinner } from '../../components/AppLoaders';

// ── ICONS ─────────────────────────────────────────────────────────────────────
const IconX        = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconTrash    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IconCheck    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconArrow    = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconWarn     = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

// ── SHARED BACKDROP ───────────────────────────────────────────────────────────
const Backdrop: React.FC<{ zIndex?: string; onClick?: () => void; children: React.ReactNode }> = ({
  zIndex = 'z-[70]', onClick, children,
}) => (
  <div
    className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-[2px]`}
    onClick={(e) => { if (e.target === e.currentTarget) onClick?.(); }}
  >
    {children}
  </div>
);

// ── MODAL SHELL ───────────────────────────────────────────────────────────────
const ModalCard: React.FC<{ children: React.ReactNode; maxWidth?: string }> = ({
  children, maxWidth = 'max-w-md',
}) => (
  <div className={`bg-white border border-gray-200 rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col overflow-hidden`}>
    {children}
  </div>
);

// ── DELETE CONFIRM MODAL ──────────────────────────────────────────────────────
interface DeleteConfirmModalProps {
  isOpen: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen, deleting, onConfirm, onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <Backdrop onClick={onCancel}>
      <ModalCard>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400"><IconWarn /></span>
            <h2 className="text-sm font-semibold text-gray-900">Eliminar evento</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-1.5">
          <p className="text-sm text-gray-700">
            Esta acción no se puede deshacer. El evento se eliminará para todos los asistentes.
          </p>
          <p className="text-xs text-gray-400">Confirma para continuar.</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <><BrandSpinner size="xs" /> Eliminando…</>
            ) : (
              <><IconTrash /> Eliminar</>
            )}
          </button>
        </div>
      </ModalCard>
    </Backdrop>
  );
};

// ── RSVP CONFIRM MODAL ────────────────────────────────────────────────────────
interface RSVPConfirmModalProps {
  isOpen: boolean;
  rsvpAction: 'accepted' | 'declined' | 'tentative' | null;
  submittingRSVP: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RSVPConfirmModal: React.FC<RSVPConfirmModalProps> = ({
  isOpen, rsvpAction, submittingRSVP, onConfirm, onCancel,
}) => {
  if (!isOpen) return null;

  const LABELS: Record<string, string> = {
    accepted:  '¿Confirmas que asistirás a este evento?',
    declined:  '¿Confirmas que no asistirás a este evento?',
    tentative: '¿Confirmas que tu asistencia es tentativa?',
  };

  const CONFIRM_LABELS: Record<string, string> = {
    accepted:  'Aceptar',
    declined:  'Rechazar',
    tentative: 'Confirmar',
  };

  return (
    <Backdrop onClick={onCancel}>
      <ModalCard>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Confirmar respuesta</h2>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-1.5">
          <p className="text-sm text-gray-700 font-medium">
            {rsvpAction ? LABELS[rsvpAction] : ''}
          </p>
          <p className="text-xs text-gray-400">
            El organizador recibirá una notificación con tu respuesta.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            disabled={submittingRSVP}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={submittingRSVP}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submittingRSVP ? (
              <BrandSpinner size="xs" />
            ) : (
              <><IconCheck /> {rsvpAction ? CONFIRM_LABELS[rsvpAction] : 'Confirmar'}</>
            )}
          </button>
        </div>
      </ModalCard>
    </Backdrop>
  );
};

// ── CONFIRM CHANGES MODAL ─────────────────────────────────────────────────────
interface ConfirmChangesModalProps {
  isOpen: boolean;
  submitting: boolean;
  changes: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmChangesModal: React.FC<ConfirmChangesModalProps> = ({
  isOpen, submitting, changes, onConfirm, onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <Backdrop zIndex="z-[60]" onClick={onCancel}>
      <ModalCard maxWidth="max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400"><IconWarn /></span>
            <h2 className="text-sm font-semibold text-gray-900">Confirmar cambios</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            Se detectaron los siguientes cambios en el evento:
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-[260px] overflow-y-auto">
            <ul className="space-y-2">
              {changes.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="text-gray-300 mt-0.5 shrink-0"><IconArrow /></span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-400">¿Confirmas que deseas guardar estos cambios?</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting && <BrandSpinner size="xs" />}
            Guardar cambios
          </button>
        </div>
      </ModalCard>
    </Backdrop>
  );
};