import React from 'react';
// import { useDataCache } from '../contexts/DataCacheContext';
import { generateProtectedContactsTemplate } from '../utils/generateProtectedContactsTemplate';
import { useDataCache } from '../contexts/DataCacheContext';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

const TEMPLATE_COLUMNS = [
  'RUC_EMPRESA',
  'NOMBRE_EMPRESA',
  'NOMBRE_CONTACTO',
  'APELLIDO_CONTACTO',
  'EMAIL_CONTACTO',
  'TELEFONO_CONTACTO',
  'CARGO',
  'ETIQUETAS_EMPRESA',
];

const EXAMPLE_ROW: Record<string, string> = {
  RUC_EMPRESA: '1790012345001',
  NOMBRE_EMPRESA: 'EMPRESA DE EJEMPLO S.A.',
  NOMBRE_CONTACTO: 'Juan',
  APELLIDO_CONTACTO: 'Pérez',
  EMAIL_CONTACTO: 'juan.perez@ejemplo.com',
  TELEFONO_CONTACTO: '+593991234567',
  CARGO: 'Gerente',
  ETIQUETAS_EMPRESA: 'Cliente',
};



const DownloadContactsTemplate: React.FC = () => {
  const [labels, setLabels] = React.useState<string[]>([]);
  const { companyTypes = [], countries = [] } = useDataCache();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { user } = useAuth();

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    if (!user?.id_tenant || !user?.id_user) {
      setError('No hay sesión activa.');
      setLabels([]);
      setLoading(false);
      return;
    }
    const url = buildUrl(GATEWAY_CONFIG.API.LABELS_TENANT, { id_tenant: user.id_tenant, id_user: user.id_user });
    apiFetch(url)
      .then(async res => {
        if (!res.ok) {
          if (res.status === 401) throw new Error('No autorizado. Inicia sesión para ver las etiquetas.');
          throw new Error('Error al obtener etiquetas.');
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLabels(data.map((l: any) => l.name));
        } else {
          setLabels([]);
          setError('No hay etiquetas configuradas.');
        }
      })
      .catch((err) => {
        setLabels([]);
        setError(err.message || 'Error al obtener etiquetas.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async () => {
    // Extrae solo los nombres para los dropdowns
    const typeNames = companyTypes.map(t => t.name);
    const countryNames = countries.map(c => c.name);
    await generateProtectedContactsTemplate(labels, typeNames, countryNames);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleDownload}
        className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-60"
        disabled={loading || labels.length === 0 || !!error}
      >
        {loading ? 'Cargando etiquetas...' : 'Descargar Plantilla de Importación'}
      </button>
      {error && (
        <span className="text-xs text-red-500 font-semibold">{error}</span>
      )}
    </div>
  );
};

export default DownloadContactsTemplate;
