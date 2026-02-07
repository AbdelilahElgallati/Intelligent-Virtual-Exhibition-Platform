import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Languages, ChevronDown, ChevronUp } from 'lucide-react';

interface TranslatedMessageBubbleProps {
    originalText: string;
    targetLang: string;
    autoTranslate?: boolean;
    isOwn?: boolean;
    senderName?: string;
}

export const TranslatedMessageBubble: React.FC<TranslatedMessageBubbleProps> = ({
    originalText,
    targetLang,
    autoTranslate = false,
    isOwn = false,
    senderName
}) => {
    const { translate, isTranslating } = useTranslation();
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(!autoTranslate);

    useEffect(() => {
        if (autoTranslate && originalText) {
            handleTranslate();
        }
    }, [autoTranslate, originalText, targetLang]);

    const handleTranslate = async () => {
        const result = await translate(originalText, targetLang);
        setTranslatedText(result);
        if (autoTranslate) {
            setShowOriginal(false);
        }
    };

    return (
        <div className={`flex flex-col mb-4 ${isOwn ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative group ${isOwn ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                {!isOwn && senderName && <p className="text-xs font-semibold mb-1 opacity-70">{senderName}</p>}

                <div className="space-y-2">
                    {showOriginal && (
                        <p className={`text-sm leading-relaxed ${translatedText ? 'opacity-50 italic text-xs' : ''}`}>
                            {originalText}
                        </p>
                    )}

                    {isTranslating ? (
                        <div className="flex items-center gap-2 text-xs opacity-70">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            Translating...
                        </div>
                    ) : translatedText && (
                        <p className="text-sm leading-relaxed font-medium">
                            {translatedText}
                        </p>
                    )}
                </div>

                {/* Translation Actions */}
                <div className={`absolute top-2 ${isOwn ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button
                        onClick={() => translatedText ? setShowOriginal(!showOriginal) : handleTranslate()}
                        className="p-1.5 bg-white border border-gray-100 rounded-full shadow-md text-gray-400 hover:text-indigo-600 transition-all active:scale-90"
                        title={translatedText ? (showOriginal ? 'Hide original' : 'Show original') : 'Translate'}
                    >
                        <Languages size={14} />
                    </button>
                </div>
            </div>

            {translatedText && (
                <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="text-[10px] mt-1 text-gray-400 hover:text-indigo-500 font-medium flex items-center gap-0.5"
                >
                    {showOriginal ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {showOriginal ? 'Hide Original' : 'View Original'}
                </button>
            )}
        </div>
    );
};
