import React from 'react';

type ViewMode = 'table' | 'list' | 'kanban';

interface DealViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const DealViewToggle: React.FC<DealViewToggleProps> = ({ viewMode, onChange }) => {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-1">
      <button
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'table'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Vista de tabla"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M3 15h18"/>
          <path d="M9 3v18"/>
        </svg>
        <span className="hidden sm:inline">Tabla</span>
      </button>
      
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'list'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Vista de lista"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="4" rx="1"/>
          <rect x="3" y="13" width="18" height="4" rx="1"/>
        </svg>
        <span className="hidden sm:inline">Lista</span>
      </button>
      
      <button
        onClick={() => onChange('kanban')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'kanban'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Vista Kanban"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="18" rx="1"/>
          <rect x="14" y="3" width="7" height="18" rx="1"/>
        </svg>
        <span className="hidden sm:inline">Kanban</span>
      </button>
    </div>
  );
};

export default DealViewToggle;
