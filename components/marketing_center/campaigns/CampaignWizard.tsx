import React, { useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { marketingApi } from '../../../services/marketingApi';
import { MarketingCampaign, MarketingList } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  campaignId?: string | null;
  onClose: () => void;
  onSaved?: (campaign: MarketingCampaign) => void;
}

type Step = 1 | 2 | 3;

type DraftState = {
  id_campaign?: string;
  name: string;
  subject: string;
  html_content: string;
  sender_type: 'USER' | 'TENANT';
  target_lists: string[];
  attachments: Array<{ file_name: string; file_url: string }>;
};

const emptyDraft: DraftState = {
  name: '',
  subject: '',
  html_content: '',
  sender_type: 'USER',
  target_lists: [],
  attachments: [],
};

const CampaignWizard: React.FC<Props> = ({ campaignId, onClose, onSaved }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available lists
  useEffect(() => {
    const loadLists = async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      try {
        const data = await marketingApi.getLists(user.id_tenant, user.id_user);
        setLists(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching lists', err);
        setLists([]);
      }
    };
    loadLists();
  }, [user?.id_tenant, user?.id_user]);

  // Load campaign detail if editing
  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) return;
      setIsLoading(true);
      try {
        const data = await marketingApi.getCampaignDetail(campaignId);
        setDraft({
          id_campaign: data.id_campaign,
          name: data.name || '',
          subject: data.subject || '',
          html_content: data.html_content || '',
          sender_type: (data.sender_type as 'USER' | 'TENANT') || 'USER',
          target_lists: data.target_lists || [],
          attachments: data.attachments || [],
        });
        setStep(1);
      } catch (err) {
        console.error('Error loading campaign', err);
        setError('No se pudo cargar la campaña');
      } finally {
        setIsLoading(false);
      }
    };
    loadCampaign();
  }, [campaignId]);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
      ],
    }),
    []
  );

  const handleNext = () => setStep(prev => (prev < 3 ? ((prev + 1) as Step) : prev));
  const handleBack = () => setStep(prev => (prev > 1 ? ((prev - 1) as Step) : prev));

  const handleChange = (field: keyof DraftState, value: any) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const toggleList = (listId: string) => {
    setDraft(prev => ({
      ...prev,
      target_lists: prev.target_lists.includes(listId)
        ? prev.target_lists.filter(id => id !== listId)
        : [...prev.target_lists, listId],
    }));
  };

  const handleAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map(f => ({ file_name: f.name, file_url: '' }));
    setDraft(prev => ({ ...prev, attachments: mapped }));
  };

  const saveDraft = async () => {
    if (!user?.id_tenant || !user?.id_user) {
      setError('Faltan credenciales de usuario');
      return;
    }
    if (!draft.name || !draft.subject) {
      setError('Completa nombre interno y asunto');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        id_campaign: draft.id_campaign,
        name: draft.name,
        subject: draft.subject,
        html_content: draft.html_content,
        sender_type: draft.sender_type,
        target_lists: draft.target_lists,
        attachments: draft.attachments,
      };
      const saved = await marketingApi.saveCampaign(user.id_tenant, user.id_user, payload);
      setDraft(prev => ({ ...prev, id_campaign: saved.id_campaign }));
      onSaved?.(saved);
      return saved;
    } catch (err) {
      console.error('Error saving draft', err);
      setError('No se pudo guardar el borrador');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const launchNow = async () => {
    const saved = await saveDraft();
    if (!saved?.id_campaign || !user?.id_user) return;
    setIsSaving(true);
    setError(null);
    try {
      await marketingApi.launchCampaign(saved.id_campaign, user.id_user);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('Error launching campaign', err);
      setError('No se pudo lanzar la campaña');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Interno *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={draft.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Boletín semanal"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Asunto del Correo *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={draft.subject}
              onChange={e => handleChange('subject', e.target.value)}
              placeholder="Novedades de la semana"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Remitente</label>
            <div className="flex gap-3">
              {['USER', 'TENANT'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleChange('sender_type', val)}
                  className={`px-4 py-2 rounded-lg border ${draft.sender_type === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                >
                  {val === 'USER' ? 'Personal' : 'Corporativo'}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Contenido</label>
            <ReactQuill
              theme="snow"
              value={draft.html_content}
              onChange={value => handleChange('html_content', value)}
              modules={quillModules}
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Adjuntos</label>
            <input type="file" multiple onChange={handleAttachments} />
            {draft.attachments.length > 0 && (
              <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
                {draft.attachments.map((att, idx) => (
                  <li key={`${att.file_name}-${idx}`}>{att.file_name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6">
        <div>
          <p className="text-sm text-slate-600 mb-2">Selecciona las listas de destinatarios</p>
          <div className="grid md:grid-cols-2 gap-3">
            {lists.map(list => (
              <label key={list.list_id} className="flex items-center gap-3 border rounded-lg px-3 py-2 hover:border-blue-300">
                <input
                  type="checkbox"
                  checked={draft.target_lists.includes(list.list_id)}
                  onChange={() => toggleList(list.list_id)}
                />
                <div>
                  <p className="font-semibold text-slate-800">{list.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{list.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-slate-50">
          <h4 className="font-bold text-slate-800 mb-2">Resumen</h4>
          <ul className="text-sm text-slate-700 space-y-1">
            <li><strong>Nombre:</strong> {draft.name || '—'}</li>
            <li><strong>Asunto:</strong> {draft.subject || '—'}</li>
            <li><strong>Remitente:</strong> {draft.sender_type === 'USER' ? 'Personal' : 'Corporativo'}</li>
            <li><strong>Listas:</strong> {draft.target_lists.length} seleccionadas</li>
          </ul>
        </div>
      </div>
    );
  };

  const stepLabels: Record<Step, string> = {
    1: 'Configuración',
    2: 'Contenido',
    3: 'Destinatarios y Envío',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="text-sm text-slate-500">Wizard de Campañas</p>
            <h2 className="text-2xl font-bold text-slate-900">{campaignId ? 'Editar Campaña' : 'Nueva Campaña'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 flex gap-3">
          {[1, 2, 3].map(num => (
            <div key={num} className={`flex-1 rounded-lg px-3 py-2 border ${step === num ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === num ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {num}
                </span>
                <span className="text-sm font-semibold">{stepLabels[num as Step]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <i className="fas fa-spinner fa-spin mr-2"></i> Cargando...
            </div>
          ) : (
            renderStep()
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={handleBack} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700">Atrás</button>
            )}
            {step < 3 && (
              <button onClick={handleNext} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Siguiente</button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveDraft}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : 'Guardar Borrador'}
            </button>
            {step === 3 && (
              <button
                onClick={launchNow}
                disabled={isSaving || draft.target_lists.length === 0}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {isSaving ? 'Enviando...' : '🚀 Lanzar Ahora'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;
