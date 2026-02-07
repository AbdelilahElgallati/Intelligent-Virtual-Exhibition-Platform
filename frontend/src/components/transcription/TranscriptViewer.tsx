import React, { useRef, useEffect } from 'react';
import { TranscriptLine } from '../../hooks/useTranscription';
import { Clock, FileText, Download } from 'lucide-react';

interface TranscriptViewerProps {
    lines: TranscriptLine[];
    activeId: string | null;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ lines, activeId }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeId && scrollRef.current) {
            const activeElement = document.getElementById(`line-${activeId}`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [activeId]);

    return (
        <div className="flex flex-col h-full bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden font-sans">
            <header className="px-5 py-4 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-sm text-gray-900">Live Transcript</h3>
                </div>
                <button className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors" title="Download transcript">
                    <Download size={16} />
                </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
                {lines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 opacity-60">
                        <Clock size={32} />
                        <p className="text-xs font-medium">Waiting for session to start...</p>
                    </div>
                ) : (
                    lines.map((line) => (
                        <div
                            key={line.id}
                            id={`line-${line.id}`}
                            className={`p-3 rounded-xl transition-all duration-300 flex gap-4 ${activeId === line.id
                                    ? 'bg-indigo-50/80 ring-1 ring-indigo-500/20'
                                    : 'hover:bg-gray-50'
                                }`}
                        >
                            <span className="text-[10px] font-bold text-gray-400 w-12 shrink-0 pt-0.5 font-mono">
                                [{line.timestamp}]
                            </span>
                            <p className={`text-sm leading-relaxed ${activeId === line.id ? 'text-indigo-900 font-medium' : 'text-gray-700'
                                }`}>
                                {line.text}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
