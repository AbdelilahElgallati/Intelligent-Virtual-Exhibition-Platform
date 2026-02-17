"use client";

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { ChatShell } from '@/components/assistant/ChatShell';

// Floating assistant launcher that adapts its scope to the current page.
// - Home/other: platform scope
// - Event page: event-{id}
// - Stand page: stand-{standId}

const getScopeFromPath = (pathname: string): { scope: string; subtitle: string } => {
    const parts = pathname.split('/').filter(Boolean);
    // /events/[id]/stands/[standId]
    if (parts[0] === 'events' && parts[2] === 'stands' && parts[3]) {
        return { scope: `stand-${parts[3]}`, subtitle: 'Ask about this stand and its resources.' };
    }
    // /events/[id]
    if (parts[0] === 'events' && parts[1]) {
        return { scope: `event-${parts[1]}`, subtitle: 'Ask about this event, schedule, and stands.' };
    }
    return { scope: 'platform', subtitle: 'Ask about events, organizations, or how to navigate.' };
};

export const FloatingAssistant: React.FC = () => {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const { scope, subtitle } = useMemo(() => getScopeFromPath(pathname || '/'), [pathname]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className={clsx(
                    'fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-colors',
                    'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
                aria-label="Open assistant"
            >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">Assistant</span>
            </button>

            {open && (
                <div className="fixed right-4 bottom-20 z-40 w-full max-w-md h-[600px] md:h-[560px]">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 h-full overflow-hidden">
                        <ChatShell
                            scope={scope}
                            title="Virtual Assistant"
                            subtitle={subtitle}
                            suggestedPrompts={[
                                'What events are live now?',
                                'Show me stands I should visit.',
                                'What resources does this stand have?',
                            ]}
                            onClose={() => setOpen(false)}
                            className="h-full"
                        />
                    </div>
                </div>
            )}
        </>
    );
};
