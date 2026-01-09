import React from 'react';
import { MOCK_INTEGRATIONS } from '../marketingMockData';

const Integrations: React.FC = () => {
  const googleInt = MOCK_INTEGRATIONS.find(i => i.provider === 'GOOGLE');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Integraciones de Correo</h2>
        <p className="text-slate-500">Conecta tus cuentas para enviar campañas directamente desde tus servidores.</p>
      </div>

      <div className="grid gap-6">
        {/* Google Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <i className="fa-brands fa-google text-3xl text-slate-800"></i>
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Google Workspace / Gmail</h3>
               <p className="text-sm text-slate-500">Permite enviar correos y sincronizar contactos.</p>
               {googleInt && (
                 <div className="flex items-center gap-2 mt-2">
                   <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                   <span className="text-xs font-medium text-slate-700">Conectado como {googleInt.email_connected}</span>
                 </div>
               )}
             </div>
           </div>
           <div>
             {googleInt ? (
               <button className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
                 Gestionar
               </button>
             ) : (
               <button className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-medium text-sm transition-colors">
                 Conectar
               </button>
             )}
           </div>
        </div>

        {/* Outlook Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <i className="fa-brands fa-microsoft text-3xl text-blue-500"></i>
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Microsoft Outlook / 365</h3>
               <p className="text-sm text-slate-500">Integración con Exchange Online.</p>
             </div>
           </div>
           <div>
             <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium text-sm transition-colors">
                Conectar
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
