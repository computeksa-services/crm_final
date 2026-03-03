import React from 'react';
import { GATEWAY_CONFIG } from '../services/gatewayConfig';
import { useDataCache } from '../contexts/DataCacheContext';
import DownloadContactsTemplate from '../components/DownloadContactsTemplate';

const ContactsImportExportModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {

  const { company_labels } = useDataCache();
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limpiar errores y éxitos previos
    setUploadError(null);
    setUploadSuccess(null);
    // Obtener el nuevo archivo y automáticamente reemplazar el anterior
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    
    try {
      // Crear FormData NUEVO cada vez para evitar corrupción
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      
      const res = await fetch(GATEWAY_CONFIG.API.CONTACTS_IMPORT, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('appToken') || ''}`
        },
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Error al importar contactos');
      }
      
      const result = await res.json();
      const registros = result.registros || result.count || '0';
      const mensaje = result.message || 'Importación completada';
      setUploadSuccess(`${mensaje}. Registros importados: ${registros}`);
      
      // Limpiar archivo DESPUÉS de éxito
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err: any) {
      console.error('Error upload:', err);
      setUploadError(err.message || 'Error al importar contactos');
      // NO limpiar el archivo si hay error, para que pueda reintentar
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl z-10"
          onClick={onClose}
        >
          &times;
        </button>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <i className="fa-solid fa-upload text-emerald-600 text-2xl"></i>
            <h2 className="text-xl font-bold text-slate-700">Importar Contactos</h2>
          </div>

          {/* PASO 1: DESCARGAR PLANTILLA */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">1</span>
              <h3 className="font-semibold text-slate-700">Descargar plantilla</h3>
            </div>
            <p className="text-sm text-slate-600 ml-8 mb-3">Descarga la plantilla en blanco, llénala con tus contactos y luego cárgala aquí.</p>
            <div className="ml-8">
              <DownloadContactsTemplate company_labels={company_labels} />
            </div>
          </div>

          {/* DIVISOR */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* PASO 2: CARGAR PLANTILLA LLENA */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">2</span>
              <h3 className="font-semibold text-slate-700">Cargar plantilla llena</h3>
            </div>
            <p className="text-sm text-slate-600 ml-8 mb-3">Sube el archivo Excel (.xlsx) con tus contactos completados.</p>
            
            <div className="ml-8 flex flex-col gap-3">
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploading}
                className="border border-slate-300 rounded px-3 py-2 text-sm hover:border-slate-400 focus:outline-none focus:border-emerald-500"
              />
              
              {selectedFile && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded border border-emerald-200">
                  <i className="fa-solid fa-file-excel text-emerald-600"></i>
                  <span className="text-sm text-slate-700 flex-1">{selectedFile.name}</span>
                  <button
                    className="text-xs text-red-500 hover:underline font-semibold"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={uploading}
                  >Quitar</button>
                </div>
              )}
              
              <button
                className="px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-check"></i>}
                {!uploading && 'Enviar archivo'}
              </button>
              
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-semibold flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 font-semibold flex items-start gap-2">
                  <i className="fa-solid fa-circle-check mt-0.5 flex-shrink-0"></i>
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactsImportExportModal;
