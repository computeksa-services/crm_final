import React, { useState, useEffect } from 'react';
import { marketingApi } from '../../../services/marketingApi';
import { useAuth } from '../../../contexts/AuthContext';
import { CampaignFormData } from './CampaignWizardModal';

interface AudienceList {
  id: string;
  name: string;
  member_count: number;
  description?: string;
}

interface CampaignAudienceProps {
  formData: CampaignFormData;
  updateFormData: <K extends keyof CampaignFormData>(
    field: K,
    value: CampaignFormData[K]
  ) => void;
  onValidationChange?: (data: {
    selectedCount: number;
    selectedWithContactsCount: number;
    totalSubscribers: number;
  }) => void;
}

/**
 * Paso 3: Selección de listas de audiencia
 * Carga las listas disponibles y permite seleccionar múltiples listas
 * Muestra contador de suscriptores totales
 */
const CampaignAudience: React.FC<CampaignAudienceProps> = ({
  formData,
  updateFormData,
  onValidationChange,
}) => {
  const { user } = useAuth();
  const [lists, setLists] = useState<AudienceList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * useEffect: Carga las listas disponibles al montar el componente
   */
  useEffect(() => {
    loadLists();
  }, []);

  /**
   * Carga las listas disponibles desde la API
   */
  const loadLists = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!user?.id_tenant || !user?.id_user) throw new Error('Sesión inválida');
      const response = await marketingApi.getLists(user.id_tenant, user.id_user);
      const normalized: AudienceList[] = (response || []).map((l) => ({
        id: (l as any).list_id,
        name: l.name,
        member_count: l.member_count,
        description: l.description,
      }));
      setLists(normalized);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las listas'
      );
      console.error('Error loading lists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Maneja el cambio de selección de una lista
   */
  const handleListToggle = (listId: string) => {
    const targetLists = formData.target_lists;
    const newTargetLists = targetLists.includes(listId)
      ? targetLists.filter((id) => id !== listId)
      : [...targetLists, listId];

    updateFormData('target_lists', newTargetLists);
  };

  /**
   * Calcula el número total de suscriptores de las listas seleccionadas
   */
  const getTotalSubscribers = (): number => {
    return lists
      .filter((list) => formData.target_lists.includes(list.id))
      .reduce((sum, list) => sum + list.member_count, 0);
  };

  /**
   * Filtra las listas según el término de búsqueda
   */
  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSubscribers = getTotalSubscribers();
  const selectedCount = formData.target_lists.length;
  const selectedWithContactsCount = lists.filter(
    (list) => formData.target_lists.includes(list.id) && list.member_count > 0
  ).length;

  useEffect(() => {
    if (!onValidationChange) return;
    onValidationChange({
      selectedCount,
      selectedWithContactsCount,
      totalSubscribers,
    });
  }, [onValidationChange, selectedCount, selectedWithContactsCount, totalSubscribers]);

  return (
    <div className="campaign-audience">
      {/* Header */}
      <div className="audience-header">
        <h3>Selecciona las Listas de Audiencia</h3>
        <p className="subtitle">
          Elige una o más listas para enviar la campaña
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button
            type="button"
            className="btn-retry"
            onClick={loadLists}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-state">
          <p>Cargando listas de audiencia...</p>
        </div>
      )}

      {/* Search Bar */}
      {!isLoading && lists.length > 0 && (
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar listas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-count">
            {filteredLists.length} de {lists.length} listas
          </span>
        </div>
      )}

      {/* Lists Container */}
      {!isLoading && !error && (
        <>
          {filteredLists.length > 0 ? (
            <div className="lists-container">
              {filteredLists.map((list) => {
                const isSelected = formData.target_lists.includes(list.id);
                return (
                  <div
                    key={list.id}
                    className={`list-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="list-checkbox">
                      <input
                        id={`list-${list.id}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleListToggle(list.id)}
                        className="checkbox-input"
                      />
                      <label htmlFor={`list-${list.id}`} className="checkbox-label">
                        {list.name}
                      </label>
                    </div>

                    <div className="list-info">
                      {list.description && (
                        <p className="list-description">{list.description}</p>
                      )}
                      <div className="list-stats">
                        <span className="member-count">
                          👥 {list.member_count.toLocaleString()} suscriptores
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              {lists.length === 0 ? (
                <>
                  <p className="empty-icon">📭</p>
                  <p className="empty-text">No hay listas disponibles</p>
                  <small className="empty-description">
                    Debes crear al menos una lista de audiencia en el módulo de Marketing
                  </small>
                </>
              ) : (
                <>
                  <p className="empty-icon">🔍</p>
                  <p className="empty-text">
                    No se encontraron listas con "{searchTerm}"
                  </p>
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => setSearchTerm('')}
                  >
                    Limpiar búsqueda
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Summary Card */}
      {!isLoading && selectedCount > 0 && (
        <div className="summary-card">
          <div className="summary-item">
            <span className="summary-label">Listas seleccionadas</span>
            <span className="summary-value">{selectedCount}</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-item">
            <span className="summary-label">Total de suscriptores</span>
            <span className="summary-value highlight">
              {totalSubscribers.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Empty Selection State */}
      {!isLoading && selectedCount === 0 && filteredLists.length > 0 && (
        <div className="info-box">
          <span className="info-icon">ℹ️</span>
          <span className="info-text">
            Selecciona al menos una lista para continuar
          </span>
        </div>
      )}

      {!isLoading && selectedCount > 0 && selectedWithContactsCount === 0 && (
        <div className="info-box warning">
          <span className="info-icon">⚠️</span>
          <span className="info-text">
            Las listas seleccionadas no tienen contactos. Elige al menos una lista con suscriptores.
          </span>
        </div>
      )}

      <style>{`
        .campaign-audience {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .audience-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .audience-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin: 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #007bff;
        }

        .subtitle {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffc107;
          border-radius: 4px;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .btn-retry {
          margin-left: auto;
          padding: 6px 12px;
          background: #ffc107;
          color: #000;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .btn-retry:hover {
          background: #ffb300;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #666;
        }

        .loading-state p {
          margin: 0;
          font-size: 14px;
        }

        .search-section {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .search-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .search-count {
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        .lists-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }

        .lists-container::-webkit-scrollbar {
          width: 6px;
        }

        .lists-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .lists-container::-webkit-scrollbar-thumb {
          background: #ddd;
          border-radius: 3px;
        }

        .lists-container::-webkit-scrollbar-thumb:hover {
          background: #bbb;
        }

        .list-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: #fff;
          transition: all 0.2s;
          cursor: pointer;
        }

        .list-item:hover {
          border-color: #007bff;
          background: #f0f7ff;
        }

        .list-item.selected {
          border-color: #007bff;
          background: #f0f7ff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .list-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .checkbox-input {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #007bff;
          flex-shrink: 0;
        }

        .checkbox-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          cursor: pointer;
          margin: 0;
        }

        .list-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 28px;
        }

        .list-description {
          font-size: 13px;
          color: #666;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .list-stats {
          display: flex;
          gap: 12px;
        }

        .member-count {
          font-size: 13px;
          color: #007bff;
          font-weight: 500;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: #f9f9f9;
          border-radius: 6px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 500;
          color: #333;
          margin: 0 0 8px 0;
        }

        .empty-description {
          font-size: 12px;
          color: #666;
          margin: 0;
        }

        .btn-clear-search {
          margin-top: 12px;
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-clear-search:hover {
          background: #0056b3;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 16px;
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          border-radius: 6px;
          font-weight: 500;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .summary-label {
          font-size: 12px;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 20px;
          font-weight: 700;
        }

        .summary-value.highlight {
          font-size: 24px;
          color: #ffff00;
        }

        .summary-divider {
          width: 1px;
          height: 40px;
          background: rgba(255, 255, 255, 0.3);
        }

        .info-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #e7f3ff;
          color: #004085;
          border: 1px solid #b3d9ff;
          border-radius: 4px;
        }

        .info-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .info-text {
          font-size: 13px;
          margin: 0;
        }

        .info-box.warning {
          background: #fff8e6;
          border-color: #ffd27a;
        }

        @media (max-width: 768px) {
          .campaign-audience {
            gap: 16px;
          }

          .lists-container {
            max-height: 300px;
          }

          .summary-card {
            flex-direction: column;
            gap: 12px;
          }

          .summary-divider {
            display: none;
          }

          .summary-item {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default CampaignAudience;
