import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../services/apiClient';

// Fix para los iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface CompanyMapProps {
  address?: string;
  city?: string;
  country?: string;
  companyName: string;
}

// Mapa de países a coordenadas (centros aproximados)
const COUNTRY_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  'Ecuador': { lat: -1.8312, lng: -78.1834 },
  'Colombia': { lat: 4.5709, lng: -74.2973 },
  'Perú': { lat: -12.0464, lng: -77.0428 },
  'Chile': { lat: -33.8688, lng: -151.2093 },
  'Argentina': { lat: -34.6037, lng: -58.3816 },
  'España': { lat: 40.4168, lng: -3.7038 },
  'México': { lat: 19.4326, lng: -99.1332 },
  'Estados Unidos': { lat: 37.7749, lng: -122.4194 },
  'Brasil': { lat: -23.5505, lng: -46.6333 },
  'Canadá': { lat: 43.6629, lng: -79.3957 },
  'Francia': { lat: 48.8566, lng: 2.3522 },
};

const CompanyMap: React.FC<CompanyMapProps> = ({ address, city, country, companyName }) => {
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const geocodeAddress = async () => {
      try {
        // Intentar en orden: dirección+ciudad+país -> ciudad+país -> país
        const queries = [];
        
        // Query 1: dirección + ciudad + país
        if (address && city && country) {
          const parts = [address, city, country];
          queries.push(encodeURIComponent(parts.join(', ')));
        }
        
        // Query 2: ciudad + país
        if (city && country) {
          const parts = [city, country];
          queries.push(encodeURIComponent(parts.join(', ')));
        }
        
        // Query 3: solo país
        if (country) {
          queries.push(encodeURIComponent(country));
        }

        // Si no hay queries, error
        if (queries.length === 0) {
          setError(true);
          setLoading(false);
          return;
        }

        let found = false;

        // Intentar cada query en orden
        for (const query of queries) {
          try {
            const response = await apiFetch(
              `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&timeout=5`,
              { 
                headers: { 
                  'User-Agent': 'CRM-Computeksa/1.0 (https://app.computeksa.com)' 
                }
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              
              if (data.length > 0) {
                setCoordinates({
                  lat: parseFloat(data[0].lat),
                  lng: parseFloat(data[0].lon),
                });
                setError(false);
                setLoading(false);
                found = true;
                break;
              }
            }
          } catch (err) {
            // Intentar con la siguiente query
            console.warn('Query fallida:', query, err);
            continue;
          }
        }

        if (!found) {
          // Si ningún query funcionó con Nominatim, usar fallback de país
          if (country && COUNTRY_COORDINATES[country]) {
            setCoordinates(COUNTRY_COORDINATES[country]);
            setError(false);
          } else {
            setError(true);
          }
        }
      } catch (err) {
        console.error('Error in geocoding:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    geocodeAddress();
  }, [address, city, country]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
        <div className="flex flex-col items-center gap-2">
          <i className="fa-solid fa-map text-2xl text-slate-400"></i>
          <p className="text-sm text-slate-500">Cargando mapa...</p>
        </div>
      </div>
    );
  }


  if (error || !coordinates) {
    return (
      <div className="w-full h-64 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
        <div className="flex flex-col items-center gap-2 text-center">
          <i className="fa-solid fa-map-location-dot text-2xl text-slate-400"></i>
          <p className="text-sm text-slate-500">No se pudo cargar la ubicación</p>
          {!address && !city && !country && (
            <p className="text-xs text-slate-400">Faltan datos de dirección/ciudad/país</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={[coordinates.lat, coordinates.lng]}
        zoom={13}
        style={{ width: '100%', height: '300px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coordinates.lat, coordinates.lng]}>
          <Popup>
            <div className="text-sm font-semibold">{companyName}</div>
            {address && <div className="text-xs text-slate-600">{address}</div>}
            {city && <div className="text-xs text-slate-600">{city}</div>}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default CompanyMap;
