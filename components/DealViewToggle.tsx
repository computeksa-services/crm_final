import React from 'react';

type ViewMode = 'table' | 'kanban';

interface DealViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const DealViewToggle: React.FC<DealViewToggleProps> = ({ viewMode, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('table')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
          viewMode === 'table'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
        title="Vista de tabla"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M3 15h18"/>
          <path d="M9 3v18"/>
        </svg>
        <span className="hidden sm:inline">Tabla</span>
      </button>
      
      <button
        onClick={() => onChange('kanban')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
          viewMode === 'kanban'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
        title="Vista Kanban"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="18" rx="1"/>
          <rect x="14" y="3" width="7" height="18" rx="1"/>
        </svg>
        <span className="hidden sm:inline">Kanban</span>
      </button>
    </div>
  );
};

export default DealViewToggle;
