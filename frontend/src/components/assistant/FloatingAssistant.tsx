"use client";

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { ChatShell } from '@/components/assistant/ChatShell';

// Floating assistant launcher that adapts its scope to the current page.
// - Home/other: platform scope
// - Event page: event-{id}
// - Stand page: stand-{standId}

const useAssistantScope = (pathname: string) => {
    const { t } = useTranslation();
    
    return useMemo(() => {
        const parts = pathname.split('/').filter(Boolean);
        // /events/[id]/stands/[standId]
        if (parts[0] === 'events' && parts[2] === 'stands' && parts[3]) {
            return { scope: `stand-${parts[3]}`, subtitle: t('layout.assistant.subtitles.stand') };
        }
        // /events/[id]
        if (parts[0] === 'events' && parts[1]) {
            return { scope: `event-${parts[1]}`, subtitle: t('layout.assistant.subtitles.event') };
        }
        return { scope: 'platform', subtitle: t('layout.assistant.subtitles.platform') };
    }, [pathname, t]);
};

export const FloatingAssistant: React.FC = () => {
    const { t } = useTranslation();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const { scope, subtitle } = useAssistantScope(pathname || '/');

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className={clsx(
                    'fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-colors',
                    'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
                aria-label={t('layout.assistant.buttonLabel')}
            >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">{t('layout.assistant.buttonLabel')}</span>
            </button>

            {open && (
                <div className="fixed right-4 bottom-20 z-40 w-[calc(100vw-2rem)] max-w-sm h-[600px] md:h-[560px]">
                    <div className="h-full rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                        <ChatShell
                            scope={scope}
                            title={t('layout.assistant.title')}
                            subtitle={subtitle}
                            suggestedPrompts={t('layout.assistant.suggestedPrompts', { returnObjects: true }) as string[]}
                            onClose={() => setOpen(false)}
                            className="h-full"
                        />
                    </div>
                </div>
            )}
        </>
    );
};
