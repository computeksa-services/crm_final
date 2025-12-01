import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Tratos Ganados', value: '$124,500', icon: 'fa-trophy', color: 'text-green-500', bg: 'bg-green-100' },
          { label: 'Cotizaciones Pendientes', value: '14', icon: 'fa-clock', color: 'text-yellow-500', bg: 'bg-yellow-100' },
          { label: 'Clientes Nuevos', value: '8', icon: 'fa-user-plus', color: 'text-blue-500', bg: 'bg-blue-100' },
          { label: 'Tasa de Conversión', value: '32%', icon: 'fa-chart-line', color: 'text-purple-500', bg: 'bg-purple-100' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mr-4`}>
              <i className={`fa-solid ${stat.icon} text-xl`}></i>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h2 className="text-lg font-bold text-slate-800 mb-4">Actividad Reciente</h2>
           <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 mt-1">
                    <i className="fa-solid fa-file-alt text-slate-500 text-xs"></i>
                  </div>
                  <div>
                    <p className="text-sm text-slate-800"><span className="font-bold">Admin</span> generó la cotización #104{i}</p>
                    <p className="text-xs text-slate-400">Hace {i * 15} minutos</p>
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Pipeline de Ventas</h2>
          <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400">
             <div className="text-center">
                <i className="fa-solid fa-chart-column text-4xl mb-2"></i>
                <p>Gráfico de Embudo (Visualización)</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
