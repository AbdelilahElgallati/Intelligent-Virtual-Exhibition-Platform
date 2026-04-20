'use client';

import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MarketplacePage() {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center p-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                <ShoppingBag className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('visitor.marketplace.landing.title')}</h1>
            <p className="text-gray-500 text-base max-w-md mb-8">
                {t('visitor.marketplace.landing.subtitle')}
            </p>
            <Link
                href="/events"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                {t('visitor.marketplace.landing.actions.browseEvents')}
                <ArrowRight className="w-4 h-4" />
            </Link>
        </div>
    );
}
