import React from 'react';
import { Globe, Check } from 'lucide-react';

const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
];

interface LanguageSelectorProps {
    currentLang: string;
    onLanguageChange: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    currentLang,
    onLanguageChange
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const selectedLang = languages.find(l => l.code === currentLang) || languages[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm font-medium transition-all"
            >
                <Globe size={16} className="text-gray-500" />
                <span>{selectedLang.name}</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    onLanguageChange(lang.code);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                                <span>{lang.name}</span>
                                {currentLang === lang.code && <Check size={14} className="text-indigo-600" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
