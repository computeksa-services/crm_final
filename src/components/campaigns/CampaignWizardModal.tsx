import React, { useState, useEffect } from 'react';
import { marketingApi } from '../../../services/marketingApi';
import Toast from '../../../components/Toast';
import CampaignSettings from './CampaignSettings';
import CampaignEditor from './CampaignEditor';
import CampaignAudience from './CampaignAudience';
import CampaignReview from './CampaignReview';

/**
 * Interfaz para los datos del formulario del Wizard de Campañas
 */
export interface CampaignFormData {
  name: string;
  subject: string;
  sender_type: 'USER' | 'TENANT';
  html_content: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  target_lists: string[]; // Array de IDs de listas
}

/**
 * Interfaz para los props del componente
 */
interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string;
  onSuccess: (campaign: any) => void;
}

/**
 * Componente contenedor principal del Wizard de Campañas
 * Gestiona la navegación entre pasos y el estado global del formulario
 */
const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  onSuccess,
}) => {
  // Estado del paso actual (1-4)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Estado de carga
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado global del formulario
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    subject: '',
    sender_type: 'USER',
    html_content: '',
    attachments: [],
    target_lists: [],
  });

  /**
   * useEffect: Carga datos de la campaña si se está editando
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (campaignId) {
      loadCampaignData();
    } else {
      // Resetear formulario para nueva campaña
      resetFormData();
    }
  }, [isOpen, campaignId]);

  /**
   * Carga los datos de una campaña existente desde la API
   */
  const loadCampaignData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const campaign = await marketingApi.getCampaignDetail(campaignId!);

      setFormData({
        name: campaign.name || '',
        subject: campaign.subject || '',
        sender_type: campaign.sender_type || 'USER',
        html_content: campaign.html_content || '',
        attachments: (campaign.attachments || []).map((a: any) => ({
          id: a.id || a.file_id || `${Date.now()}-${Math.random()}`,
          name: a.name || a.file_name || 'Adjunto',
          url: a.url || a.file_url || '',
        })),
        target_lists: campaign.target_lists || [],
      });

      // Resetear al primer paso
      setCurrentStep(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar los datos de la campaña'
      );
      console.error('Error loading campaign:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resetea el formulario a valores iniciales
   */
  const resetFormData = () => {
    setFormData({
      name: '',
      subject: '',
      sender_type: 'USER',
      html_content: '',
      attachments: [],
      target_lists: [],
    });
    setCurrentStep(1);
    setError(null);
  };

  /**
   * Actualiza un campo específico del formulario
   */
  const updateFormData = <K extends keyof CampaignFormData>(
    field: K,
    value: CampaignFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Avanza al siguiente paso con validación
   */
  const nextStep = () => {
    // Validación básica según el paso actual
    switch (currentStep) {
      case 1:
        // Validar configuración básica
        if (!formData.name.trim()) {
          setError('El nombre de la campaña es requerido');
          return;
        }
        if (!formData.subject.trim()) {
          setError('El asunto es requerido');
          return;
        }
        break;

      case 2:
        // Validar contenido HTML
        if (!formData.html_content.trim()) {
          setError('El contenido HTML es requerido');
          return;
        }
        break;

      case 3:
        // Validar selección de listas
        if (formData.target_lists.length === 0) {
          setError('Debes seleccionar al menos una lista de audiencia');
          return;
        }
        break;
    }

    setError(null);

    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  /**
   * Retrocede al paso anterior
   */
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
      setError(null);
    }
  };

  /**
   * Cierra el modal y resetea el estado
   */
  const handleClose = () => {
    resetFormData();
    onClose();
  };

  /**
   * Muestra un toast
   */
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Si no está abierto, no renderizar nada
  if (!isOpen) {
    return null;
  }

  return (
    <div className="campaign-wizard-modal">
      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2>
              {campaignId ? 'Editar Campaña' : 'Crear Nueva Campaña'}
            </h2>
            <button
              className="close-button"
              onClick={handleClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="progress-indicator">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`progress-step ${
                  step <= currentStep ? 'active' : ''
                }`}
              >
                <span className="step-number">{step}</span>
                <span className="step-label">
                  {
                    [
                      'Configuración',
                      'Contenido',
                      'Audiencia',
                      'Resumen',
                    ][step - 1]
                  }
                </span>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Content */}
          <div className="modal-body">
            {isLoading ? (
              <div className="loading-state">
                <p>Cargando campaña...</p>
              </div>
            ) : (
              <>
                {currentStep === 1 && (
                  <CampaignSettings
                    formData={formData}
                    updateFormData={updateFormData}
                  />
                )}

                {currentStep === 2 && (
                  <CampaignEditor
                    formData={formData}
                    updateFormData={updateFormData}
                  />
                )}

                {currentStep === 3 && (
                  <CampaignAudience
                    formData={formData}
                    updateFormData={updateFormData}
                  />
                )}

                {currentStep === 4 && (
                  <CampaignReview
                    formData={formData}
                    campaignId={campaignId}
                    onSuccess={(_campaign: any) => {
                      showToast('success', '¡Campaña lanzada exitosamente!');
                      onSuccess(_campaign);
                    }}
                    onClose={handleClose}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={prevStep}
              disabled={currentStep === 1 || isLoading || isSaving || isLaunching}
            >
              Anterior
            </button>

            {currentStep < 4 ? (
              <button
                className="btn btn-primary"
                onClick={nextStep}
                disabled={isLoading || isSaving || isLaunching}
              >
                Siguiente
              </button>
            ) : (
              <button
                className="btn btn-success"
                disabled={isLoading || isSaving || isLaunching}
              >
                {isLaunching ? 'Lanzando...' : '🚀 Lanzar'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .campaign-wizard-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          max-width: 800px;
          width: 90%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #333;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: #f0f0f0;
          color: #333;
        }

        .progress-indicator {
          display: flex;
          padding: 20px 24px;
          background: #f9f9f9;
          border-bottom: 1px solid #e0e0e0;
          gap: 0;
        }

        .progress-step {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .progress-step:not(:last-child)::after {
          content: '';
          position: absolute;
          height: 2px;
          background: #e0e0e0;
          right: -50%;
          top: 18px;
          width: 100%;
        }

        .progress-step.active:not(:last-child)::after {
          background: #007bff;
        }

        .step-number {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e0e0e0;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
        }

        .progress-step.active .step-number {
          background: #007bff;
          color: white;
        }

        .step-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 500;
        }

        .progress-step.active .step-label {
          color: #007bff;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          background: #fff3cd;
          color: #856404;
          border-left: 4px solid #ffc107;
          margin-bottom: 0;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #666;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 24px;
          border-top: 1px solid #e0e0e0;
          background: #f9f9f9;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #218838;
        }

        @media (max-width: 768px) {
          .modal-content {
            width: 95%;
            max-height: 95vh;
          }

          .progress-indicator {
            gap: 8px;
          }

          .progress-step {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .progress-step:not(:last-child)::after {
            height: 100%;
            width: 2px;
            top: 50%;
            right: auto;
            left: 18px;
          }

          .step-label {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default CampaignWizardModal;
