import React from 'react';
import { CampaignFormData } from './CampaignWizardModal';

interface CampaignSettingsProps {
  formData: CampaignFormData;
  updateFormData: <K extends keyof CampaignFormData>(
    field: K,
    value: CampaignFormData[K]
  ) => void;
}

/**
 * Paso 1: Configuración básica de la campaña
 * Permite definir nombre, asunto y tipo de remitente
 */
const CampaignSettings: React.FC<CampaignSettingsProps> = ({
  formData,
  updateFormData,
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormData('name', e.target.value);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormData('subject', e.target.value);
  };

  const handleSenderTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    updateFormData('sender_type', e.target.value as 'USER' | 'TENANT');
  };

  return (
    <div className="campaign-settings">
      <div className="settings-section">
        <h3>Información Básica</h3>

        {/* Nombre Interno */}
        <div className="form-group">
          <label htmlFor="campaign-name">
            Nombre Interno
            <span className="required">*</span>
          </label>
          <input
            id="campaign-name"
            type="text"
            className="form-control"
            placeholder="Ej: Campaña Año Nuevo 2024"
            value={formData.name}
            onChange={handleNameChange}
            maxLength={100}
          />
          <small className="form-text">
            {formData.name.length}/100 caracteres
          </small>
        </div>

        {/* Asunto del Email */}
        <div className="form-group">
          <label htmlFor="campaign-subject">
            Asunto del Email
            <span className="required">*</span>
          </label>
          <input
            id="campaign-subject"
            type="text"
            className="form-control"
            placeholder="Ej: ¡Bienvenido a 2024!"
            value={formData.subject}
            onChange={handleSubjectChange}
            maxLength={150}
          />
          <small className="form-text">
            {formData.subject.length}/150 caracteres
          </small>
        </div>

        {/* Tipo de Remitente */}
        <div className="form-group">
          <label htmlFor="sender-type">
            Remitente
            <span className="required">*</span>
          </label>
          <select
            id="sender-type"
            className="form-control"
            value={formData.sender_type}
            onChange={handleSenderTypeChange}
          >
            <option value="USER">Mi Usuario</option>
            <option value="TENANT">Empresa</option>
          </select>
          <small className="form-text">
            {formData.sender_type === 'USER'
              ? 'Los emails se enviarán desde tu usuario personal'
              : 'Los emails se enviarán desde la cuenta empresarial'}
          </small>
        </div>
      </div>

      <div className="settings-info">
        <div className="info-box">
          <h4>📋 Resumen de Configuración</h4>
          <ul>
            <li>
              <strong>Nombre:</strong>{' '}
              {formData.name || <em className="text-muted">Sin definir</em>}
            </li>
            <li>
              <strong>
                Asunto
                <span className="required">*</span>:
              </strong>{' '}
              {formData.subject || <em className="text-muted">Sin definir</em>}
            </li>
            <li>
              <strong>Remitente:</strong>{' '}
              {formData.sender_type === 'USER'
                ? 'Mi Usuario'
                : 'Empresa'}
            </li>
          </ul>
        </div>
      </div>

      <style>{`
        .campaign-settings {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #007bff;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .required {
          color: #dc3545;
          font-weight: 600;
        }

        .form-control {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          transition: all 0.2s;
        }

        .form-control:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .form-text {
          font-size: 12px;
          color: #666;
        }

        .settings-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-box {
          background: #f0f7ff;
          border-left: 4px solid #007bff;
          border-radius: 4px;
          padding: 16px;
        }

        .info-box h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #007bff;
        }

        .info-box ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-box li {
          font-size: 14px;
          color: #333;
        }

        .text-muted {
          color: #999;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .campaign-settings {
            gap: 16px;
          }

          .settings-section {
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default CampaignSettings;
