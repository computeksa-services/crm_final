import React, { useState } from 'react';
import { marketingApi } from '../../../services/marketingApi';
import { useAuth } from '../../../contexts/AuthContext';
import { CampaignFormData } from './CampaignWizardModal';

interface CampaignReviewProps {
  formData: CampaignFormData;
  campaignId?: string;
  onSuccess: (campaign: any) => void;
  onClose: () => void;
}

interface LoadingState {
  isSaving: boolean;
  isLaunching: boolean;
}

/**
 * Paso 4: Revisión y Lanzamiento
 * Muestra un resumen de la campaña y permite guardar como borrador o lanzar
 */
const CampaignReview: React.FC<CampaignReviewProps> = ({
  formData,
  campaignId,
  onSuccess,
  onClose,
}) => {
  const [loading, setLoading] = useState<LoadingState>({
    isSaving: false,
    isLaunching: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Guarda la campaña como borrador
   */
  const handleSaveDraft = async () => {
    try {
      setLoading((prev) => ({ ...prev, isSaving: true }));
      setError(null);

      // Preparar payload
      const payload = {
        ...formData,
        id: campaignId, // Si es edición, incluir ID
      };

      const response = await marketingApi.saveCampaign(payload);

      setSuccessMessage('Campaña guardada como borrador correctamente');

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar la campaña'
      );
      console.error('Error saving campaign:', err);
    } finally {
      setLoading((prev) => ({ ...prev, isSaving: false }));
    }
  };

  /**
   * Lanza la campaña (guarda + envía)
   * 1. Guarda la campaña primero
   * 2. Luego lanza la campaña con el ID retornado
   */
  const handleLaunchCampaign = async () => {
    try {
      setLoading((prev) => ({ ...prev, isLaunching: true }));
      setError(null);

      // Paso 1: Guardar la campaña
      const payload = {
        ...formData,
        id: campaignId,
      };

      const savedCampaign = await marketingApi.saveCampaign(payload);
      const campaignIdToLaunch = savedCampaign.id || campaignId;

      if (!campaignIdToLaunch) {
        throw new Error('No se pudo obtener el ID de la campaña');
      }

      // Paso 2: Lanzar la campaña
      const launchResponse = await marketingApi.launchCampaign(
        campaignIdToLaunch
      );

      setSuccessMessage(
        `🎉 ¡Campaña lanzada exitosamente! ${launchResponse.message || ''}`
      );

      // Ejecutar callback
      onSuccess(launchResponse);

      // Cerrar modal después de 3 segundos
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al lanzar la campaña'
      );
      console.error('Error launching campaign:', err);
    } finally {
      setLoading((prev) => ({ ...prev, isLaunching: false }));
    }
  };

  /**
   * Calcula el número total de suscriptores
   * (Este cálculo debería venir de la API, aquí es aproximado)
   */
  const calculateTotalSubscribers = (): number => {
    // En una implementación real, esto vendría de la API
    // Por ahora, es un placeholder
    return 0;
  };

  const totalSubscribers = calculateTotalSubscribers();
  const isLoading = loading.isSaving || loading.isLaunching;

  return (
    <div className="campaign-review">
      {/* Success Message */}
      {successMessage && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Review Summary */}
      <div className="review-section">
        <h3>📋 Resumen de la Campaña</h3>

        <div className="summary-grid">
          {/* Nombre */}
          <div className="summary-item">
            <label className="summary-label">Nombre Interno</label>
            <div className="summary-value">
              {formData.name || <em className="text-muted">No definido</em>}
            </div>
          </div>

          {/* Asunto */}
          <div className="summary-item">
            <label className="summary-label">Asunto del Email</label>
            <div className="summary-value">
              {formData.subject || <em className="text-muted">No definido</em>}
            </div>
          </div>

          {/* Tipo de Remitente */}
          <div className="summary-item">
            <label className="summary-label">Remitente</label>
            <div className="summary-value">
              {formData.sender_type === 'USER' ? 'Mi Usuario' : 'Empresa'}
            </div>
          </div>

          {/* Listas Seleccionadas */}
          <div className="summary-item">
            <label className="summary-label">Listas Seleccionadas</label>
            <div className="summary-value">
              {formData.target_lists.length} lista
              {formData.target_lists.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Adjuntos */}
          <div className="summary-item">
            <label className="summary-label">Archivos Adjuntos</label>
            <div className="summary-value">
              {formData.attachments.length} archivo
              {formData.attachments.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Contenido */}
          <div className="summary-item">
            <label className="summary-label">Contenido HTML</label>
            <div className="summary-value">
              {formData.html_content.length > 0 ? (
                <span>✓ Definido</span>
              ) : (
                <em className="text-muted">No definido</em>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="preview-section">
        <h3>👁️ Vista Previa del Contenido</h3>

        <div className="email-preview">
          <div className="email-header">
            <div className="email-subject">
              <strong>Asunto:</strong> {formData.subject}
            </div>
            <div className="email-from">
              <strong>De:</strong>{' '}
              {formData.sender_type === 'USER'
                ? 'Mi Usuario Personal'
                : 'Cuenta Empresarial'}
            </div>
          </div>

          <div className="email-body">
            {formData.html_content ? (
              <div
                className="html-content"
                dangerouslySetInnerHTML={{ __html: formData.html_content }}
              />
            ) : (
              <div className="empty-content">
                <p>Sin contenido definido</p>
              </div>
            )}
          </div>

          {formData.attachments.length > 0 && (
            <div className="email-attachments">
              <strong>Archivos Adjuntos:</strong>
              <ul>
                {formData.attachments.map((att: any) => (
                  <li key={att.id}>📎 {att.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Important Notes */}
      <div className="info-box">
        <div className="info-header">
          <span className="info-icon">ℹ️</span>
          <strong>Información Importante</strong>
        </div>
        <ul className="info-list">
          <li>La campaña se enviará a {formData.target_lists.length} lista(s) de audiencia</li>
          <li>Una vez lanzada, la campaña no podrá ser editada</li>
          <li>Puedes guardar como borrador para revisar o editar luego</li>
          <li>Se enviará un resumen por email una vez completado el envío</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="actions-section">
        <button
          type="button"
          className="btn btn-secondary btn-draft"
          onClick={handleSaveDraft}
          disabled={isLoading}
        >
          {loading.isSaving ? (
            <>
              <span className="spinner"></span>
              Guardando...
            </>
          ) : (
            <>
              <span>💾</span>
              Guardar Borrador
            </>
          )}
        </button>

        <button
          type="button"
          className="btn btn-success btn-launch"
          onClick={handleLaunchCampaign}
          disabled={isLoading}
        >
          {loading.isLaunching ? (
            <>
              <span className="spinner"></span>
              Lanzando...
            </>
          ) : (
            <>
              <span>🚀</span>
              Lanzar Campaña
            </>
          )}
        </button>
      </div>

      <style>{`
        .campaign-review {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
          border-radius: 4px;
          animation: slideIn 0.3s ease;
        }

        .success-icon {
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          animation: slideIn 0.3s ease;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .review-section,
        .preview-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .review-section h3,
        .preview-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #007bff;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 4px;
          border: 1px solid #eee;
        }

        .summary-label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .summary-value {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .summary-value span {
          color: #28a745;
          font-weight: 600;
        }

        .text-muted {
          color: #999;
          font-style: italic;
        }

        .email-preview {
          display: flex;
          flex-direction: column;
          border: 1px solid #ddd;
          border-radius: 6px;
          overflow: hidden;
          background: white;
        }

        .email-header {
          padding: 16px;
          background: #f0f0f0;
          border-bottom: 1px solid #ddd;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .email-subject {
          font-size: 14px;
          color: #333;
        }

        .email-from {
          font-size: 13px;
          color: #666;
        }

        .email-body {
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
          background: white;
        }

        .html-content {
          font-size: 14px;
          line-height: 1.6;
          color: #333;
        }

        .html-content :global(img) {
          max-width: 100%;
          height: auto;
        }

        .empty-content {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
          color: #999;
          font-style: italic;
        }

        .email-attachments {
          padding: 12px 16px;
          background: #f9f9f9;
          border-top: 1px solid #ddd;
          font-size: 13px;
        }

        .email-attachments ul {
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .email-attachments li {
          color: #666;
          padding-left: 4px;
        }

        .info-box {
          background: #e7f3ff;
          border-left: 4px solid #007bff;
          border-radius: 4px;
          padding: 16px;
        }

        .info-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #004085;
          font-size: 14px;
        }

        .info-icon {
          font-size: 18px;
        }

        .info-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-list li {
          font-size: 13px;
          color: #004085;
          padding-left: 20px;
          position: relative;
        }

        .info-list li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #007bff;
          font-weight: 600;
        }

        .actions-section {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-success {
          background: #28a745;
          color: white;
          font-weight: 600;
        }

        .btn-success:hover:not(:disabled) {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .campaign-review {
            gap: 16px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .email-body {
            max-height: 250px;
          }

          .actions-section {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default CampaignReview;
