import React, { useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { CampaignFormData } from './CampaignWizardModal';

interface CampaignEditorProps {
  formData: CampaignFormData;
  updateFormData: <K extends keyof CampaignFormData>(
    field: K,
    value: CampaignFormData[K]
  ) => void;
}

/**
 * Paso 2: Editor de contenido HTML
 * Permite editar el contenido de la campaña usando react-quill
 * y gestionar archivos adjuntos
 */
const CampaignEditor: React.FC<CampaignEditorProps> = ({
  formData,
  updateFormData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Módulos y formatos de react-quill
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ['link', 'image', 'video'],
      ['clean'],
    ],
  };

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'code-block',
    'list',
    'bullet',
    'script',
    'indent',
    'color',
    'background',
    'align',
    'link',
    'image',
    'video',
  ];

  /**
   * Maneja el cambio de contenido HTML
   */
  const handleEditorChange = (content: string) => {
    updateFormData('html_content', content);
  };

  /**
   * Abre el diálogo de selección de archivo
   */
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Maneja la selección de archivos
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    // Convertir FileList a Array y agregar a los adjuntos
    const newFiles = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`, // ID temporal único
      name: file.name,
      url: URL.createObjectURL(file), // URL local para preview
      file: file, // Guardar el objeto File para posible upload posterior
    }));

    const currentAttachments = formData.attachments as any[];
    updateFormData('attachments', [...currentAttachments, ...newFiles]);
  };

  /**
   * Elimina un archivo adjunto
   */
  const handleRemoveAttachment = (fileId: string) => {
    const updatedAttachments = (formData.attachments as any[]).filter(
      (att) => att.id !== fileId
    );
    updateFormData('attachments', updatedAttachments);
  };

  /**
   * Calcula el tamaño total de los archivos
   */
  const getTotalFileSize = (): string => {
    const attachments = formData.attachments as any[];
    if (attachments.length === 0) return '0 KB';

    const totalBytes = attachments.reduce((sum, att) => {
      return sum + (att.file?.size || 0);
    }, 0);

    if (totalBytes === 0) return '0 KB';
    if (totalBytes < 1024) return `${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(2)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const attachments = formData.attachments as any[];

  return (
    <div className="campaign-editor">
      {/* Editor de Contenido */}
      <div className="editor-section">
        <h3>Contenido del Email</h3>
        <div className="quill-wrapper">
          <ReactQuill
            theme="snow"
            value={formData.html_content}
            onChange={handleEditorChange}
            modules={modules}
            formats={formats}
            placeholder="Escribe o pega tu contenido HTML aquí..."
          />
        </div>
        <small className="form-text">
          Puedes usar el editor visual o pegar HTML directamente.
          {formData.html_content.length > 0 && (
            <span> ({formData.html_content.length} caracteres)</span>
          )}
        </small>
      </div>

      {/* Sección de Adjuntos */}
      <div className="attachments-section">
        <h3>Archivos Adjuntos (Opcional)</h3>

        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif"
          />
          <button
            type="button"
            className="btn-upload"
            onClick={handleFileInputClick}
          >
            <span className="upload-icon">📎</span>
            <span className="upload-text">Seleccionar Archivos</span>
          </button>
          <small className="form-text">
            Formatos: PDF, DOC, XLS, PPT, ZIP, JPG, PNG, GIF
          </small>
        </div>

        {/* Lista de Adjuntos */}
        {attachments.length > 0 && (
          <div className="attachments-list">
            <div className="attachments-header">
              <span className="attachments-title">
                {attachments.length} archivo{attachments.length > 1 ? 's' : ''}
              </span>
              <span className="attachments-size">
                Tamaño total: {getTotalFileSize()}
              </span>
            </div>

            <div className="files">
              {attachments.map((attachment, index) => (
                <div key={attachment.id} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <span className="file-name">{attachment.name}</span>
                      {attachment.file && (
                        <span className="file-size">
                          {(attachment.file.size / 1024).toFixed(2)} KB
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    title="Eliminar archivo"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {attachments.length === 0 && (
          <div className="empty-state">
            <p>No hay archivos adjuntos. Haz clic en "Seleccionar Archivos" para agregar.</p>
          </div>
        )}
      </div>

      <style>{`
        .campaign-editor {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .editor-section,
        .attachments-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .editor-section h3,
        .attachments-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #007bff;
        }

        .quill-wrapper {
          border: 1px solid #ddd;
          border-radius: 4px;
          overflow: hidden;
        }

        .quill-wrapper :global(.ql-container) {
          font-size: 14px;
          min-height: 300px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .quill-wrapper :global(.ql-toolbar) {
          border-top: none;
          border-left: none;
          border-right: none;
          background: #f9f9f9;
        }

        .quill-wrapper :global(.ql-editor) {
          padding: 16px;
        }

        .form-text {
          font-size: 12px;
          color: #666;
        }

        .upload-area {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          border: 2px dashed #007bff;
          border-radius: 6px;
          background: #f0f7ff;
          text-align: center;
        }

        .btn-upload {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          align-self: center;
        }

        .btn-upload:hover {
          background: #0056b3;
          transform: translateY(-2px);
        }

        .upload-icon {
          font-size: 18px;
        }

        .upload-text {
          font-weight: 500;
        }

        .attachments-list {
          border: 1px solid #ddd;
          border-radius: 4px;
          overflow: hidden;
        }

        .attachments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f9f9f9;
          border-bottom: 1px solid #ddd;
        }

        .attachments-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .attachments-size {
          font-size: 12px;
          color: #666;
        }

        .files {
          display: flex;
          flex-direction: column;
          max-height: 300px;
          overflow-y: auto;
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          transition: background 0.2s;
        }

        .file-item:hover {
          background: #f9f9f9;
        }

        .file-item:last-child {
          border-bottom: none;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .file-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .file-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .file-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          font-size: 12px;
          color: #999;
        }

        .btn-remove {
          padding: 6px 10px;
          background: #f0f0f0;
          color: #666;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .btn-remove:hover {
          background: #dc3545;
          color: white;
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          color: #999;
          background: #f9f9f9;
          border-radius: 4px;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .campaign-editor {
            gap: 24px;
          }

          .quill-wrapper :global(.ql-container) {
            min-height: 250px;
          }

          .attachments-header {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default CampaignEditor;
