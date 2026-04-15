"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Container } from '@/components/common/Container';
import Link from "next/link";
import { Linkedin, Facebook, Twitter, Instagram } from 'lucide-react';

export const Footer: React.FC = () => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-zinc-900 text-zinc-400 py-12 border-t border-zinc-800">
            <Container>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-6">
                            <span className="text-2xl font-bold tracking-tight text-white italic">IVEP</span>
                        </Link>
                        <p className="text-sm leading-relaxed mb-6">
                            {t('layout.footer.tagline')}
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-white transition-colors"><Linkedin size={20} /></a>
                            <a href="#" className="hover:text-white transition-colors"><Twitter size={20} /></a>
                            <a href="#" className="hover:text-white transition-colors"><Facebook size={20} /></a>
                            <a href="#" className="hover:text-white transition-colors"><Instagram size={20} /></a>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6">{t('layout.footer.platform')}</h4>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/events" className="hover:text-white transition-colors">{t('layout.footer.eventsDirectory')}</Link></li>
                            <li><Link href="/marketplace" className="hover:text-white transition-colors">{t('layout.footer.globalMarketplace')}</Link></li>
                            <li><Link href="/assistant" className="hover:text-white transition-colors">{t('layout.footer.aiAssistant')}</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6">{t('layout.footer.account')}</h4>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/auth/login" className="hover:text-white transition-colors">{t('layout.footer.signIn')}</Link></li>
                            <li><Link href="/auth/register" className="hover:text-white transition-colors">{t('layout.footer.createAccount')}</Link></li>
                            <li><Link href="/favorites" className="hover:text-white transition-colors">{t('layout.footer.myFavorites')}</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6">{t('layout.footer.connectWithUs')}</h4>
                        <p className="text-sm leading-relaxed mb-4">
                            support@ivep.platform
                        </p>
                        <p className="text-sm leading-relaxed">
                            +212 5XX-XXXXXX
                        </p>
                    </div>
                </div>

                <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                    <p>{t('layout.footer.copyright', { year: currentYear })}</p>
                    <div className="flex gap-8">
                        <Link href="#" className="hover:text-white transition-colors">{t('layout.footer.privacyPolicy')}</Link>
                        <Link href="#" className="hover:text-white transition-colors">{t('layout.footer.termsOfService')}</Link>
                    </div>
                </div>
            </Container>
        </footer>
    );
};
