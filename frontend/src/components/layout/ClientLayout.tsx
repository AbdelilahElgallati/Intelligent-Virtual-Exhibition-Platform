'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant';

// Routes that should NOT show the global Navbar/Footer
const SHELL_FREE_PREFIXES = ['/admin', '/organizer', '/enterprise'];

// Routes that should hide only the Footer (immersive full-screen pages)
const FOOTER_FREE_PATTERNS = [/^\/events\/[^/]+\/stands\/[^/]+$/];

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isShellFree = SHELL_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const isFooterFree = FOOTER_FREE_PATTERNS.some((re) => re.test(pathname));

    if (isShellFree) {
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
