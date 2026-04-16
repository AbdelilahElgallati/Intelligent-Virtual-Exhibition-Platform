'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check, Star, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function OrganizerSubscription() {
    const { t } = useTranslation();
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">{t("organizer.subscription.title")}</h1>
                <p className="text-gray-500">{t("organizer.subscription.subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        name: t("organizer.subscription.plans.basic.name"),
                        price: t("organizer.subscription.plans.basic.price"),
                        icon: Check,
                        features: [
                            t("organizer.subscription.plans.basic.features.events"),
                            t("organizer.subscription.plans.basic.features.visitors"),
                            t("organizer.subscription.plans.basic.features.publicEvents")
                        ],
                        button: t("organizer.subscription.plans.basic.currentPlan"),
                        active: false
                    },
                    {
                        name: t("organizer.subscription.plans.pro.name"),
                        price: t("organizer.subscription.plans.pro.price"),
                        icon: Zap,
                        features: [
                            t("organizer.subscription.plans.pro.features.events"),
                            t("organizer.subscription.plans.pro.features.visitors"),
                            t("organizer.subscription.plans.pro.features.privateEvents"),
                            t("organizer.subscription.plans.pro.features.analytics")
                        ],
                        button: t("organizer.subscription.plans.pro.upgrade"),
                        active: true,
                        recommended: true
                    },
                    {
                        name: t("organizer.subscription.plans.enterprise.name"),
                        price: t("organizer.subscription.plans.enterprise.price"),
                        icon: Star,
                        features: [
                            t("organizer.subscription.plans.enterprise.features.customLimits"),
                            t("organizer.subscription.plans.enterprise.features.whiteLabeling"),
                            t("organizer.subscription.plans.enterprise.features.support"),
                            t("organizer.subscription.plans.enterprise.features.apiAccess")
                        ],
                        button: t("organizer.subscription.plans.enterprise.contactSales"),
                        active: false
                    },
                ].map((plan, idx) => (
                    <Card key={idx} className={`p-8 relative ${plan.recommended ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-gray-200'}`}>
                        {plan.recommended && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                {t("organizer.subscription.plans.pro.recommended")}
                            </span>
                        )}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                                {plan.price !== t("organizer.subscription.plans.enterprise.price") && <span className="text-gray-500 text-sm">{t("organizer.subscription.perMonth")}</span>}
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10">
                            {plan.features.map((feature, fIdx) => (
                                <li key={fIdx} className="flex items-center gap-3 text-sm text-gray-600">
                                    <plan.icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Button
                            className={`w-full ${plan.recommended ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 border'}`}
                            variant={plan.recommended ? 'primary' : 'outline'}
                            disabled={plan.name === t("organizer.subscription.plans.basic.name")}
                        >
                            {plan.button}
                        </Button>
                    </Card>
                ))}
            </div>
        </div>
    );
}
