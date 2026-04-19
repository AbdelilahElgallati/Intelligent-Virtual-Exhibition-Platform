'use client';

import { usePathname } from 'next/navigation';
import '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant';

// Routes that should NOT show the global Navbar/Footer
const SHELL_FREE_PREFIXES = ['/admin', '/organizer', '/enterprise'];

// Routes that should hide Navbar + Footer (fully immersive pages)
const IMMERSIVE_PATTERNS = [/^\/events\/[^/]+\/stands\/[^/]+$/];

// Routes that should hide only the Footer
const FOOTER_FREE_PATTERNS = [...IMMERSIVE_PATTERNS];

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isShellFree = SHELL_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const isImmersive = IMMERSIVE_PATTERNS.some((re) => re.test(pathname));
    const isFooterFree = FOOTER_FREE_PATTERNS.some((re) => re.test(pathname));

    if (isShellFree || isImmersive) {
        return <>{children}</>;
    }

    return (
        <>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <FloatingAssistant />
            {!isFooterFree && <Footer />}
        </>
    );
}
