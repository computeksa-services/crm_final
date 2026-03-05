import React from 'react';
import { SimpleSpinner } from '../../../components/AppLoaders';

export const PermissionToggle: React.FC<{
  id: string;
  label: string;
  description: string;
  checked: boolean;
  isUpdating: boolean;
  disabled?: boolean;
  sideNote?: string;
  onChange: (checked: boolean) => void;
}> = ({ id, label, description, checked, isUpdating, disabled = false, sideNote, onChange }) => (
  <div className={`p-3 border border-slate-200 transition-all bg-white ${disabled ? 'opacity-55' : 'hover:border-slate-300'}`}>
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className={`font-medium text-slate-900 text-sm select-none flex-1 ${disabled || isUpdating ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {sideNote && (
          <span className="text-[11px] text-slate-600 font-medium whitespace-nowrap">{sideNote}</span>
        )}
        <label htmlFor={id} className={`relative inline-flex items-center flex-shrink-0 ${isUpdating || disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            id={id}
            className="sr-only peer"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isUpdating || disabled}
          />
          <div className={`w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-slate-400 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700 ${isUpdating || disabled ? 'opacity-50' : ''}`}></div>
          {isUpdating && <SimpleSpinner size="xs" className="absolute left-3 top-1/2 -translate-y-1/2" />}
        </label>
      </div>
    </div>
    <p className="text-xs text-slate-600 mt-2">{description}</p>
  </div>
);
