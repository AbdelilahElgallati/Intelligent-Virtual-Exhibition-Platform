import React from 'react';
import { Languages } from 'lucide-react';

interface AutoTranslateToggleProps {
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
}

export const AutoTranslateToggle: React.FC<AutoTranslateToggleProps> = ({
    isEnabled,
    onToggle
}) => {
    return (
        <button
            onClick={() => onToggle(!isEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold uppercase tracking-wider ${isEnabled
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
        >
            <Languages size={14} />
            <span>{isEnabled ? 'Auto-Translate ON' : 'Auto-Translate OFF'}</span>
        </button>
    );
};
