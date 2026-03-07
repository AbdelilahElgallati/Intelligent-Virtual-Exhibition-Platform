import React from 'react';
import { Container } from '@/components/common/Container';

export const Footer: React.FC = () => {
    return (
        <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 py-12">
            <Container>
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                    <div className="flex flex-col items-center gap-2 md:items-start">
                        <span className="text-xl font-bold tracking-tight text-indigo-600">IVEP</span>
                        <p className="text-sm text-zinc-500 text-center md:text-left">
                            Intelligent Virtual Exhibition Platform.
                        </p>
                    </div>

                    <div className="flex gap-8">
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Platform</span>
                            <ul className="flex flex-col gap-1">
                                <li><a href="#" className="text-sm text-zinc-600 hover:text-indigo-600">About</a></li>
                                <li><a href="#" className="text-sm text-zinc-600 hover:text-indigo-600">Contact</a></li>
                            </ul>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Legal</span>
                            <ul className="flex flex-col gap-1">
                                <li><a href="#" className="text-sm text-zinc-600 hover:text-indigo-600">Privacy</a></li>
                                <li><a href="#" className="text-sm text-zinc-600 hover:text-indigo-600">Terms</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-12 border-t border-zinc-200 pt-8 text-center">
                    <p className="text-xs text-zinc-400">
                        © {new Date().getFullYear()} IVEP. All rights reserved.
                    </p>
                </div>
            </Container>
        </footer>
    );
};
