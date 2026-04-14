'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
    CalendarCheck,
    Users,
    Building2,
    CreditCard,
    ShieldCheck,
    ArrowRight,
    BarChart3,
    Activity,
    ScrollText,
    AlertTriangle,
    Briefcase,
    UserCheck,
    Wallet
} from 'lucide-react';

const CARDS = [
    {
        titleKey: 'layout.admin.sidebar.events',
        descriptionKey: 'admin.dashboard.cards.events.description',
        href: '/admin/events',
        Icon: CalendarCheck,
        accent: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100',
        tagKey: 'admin.dashboard.cards.events.tag',
        tagColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    },
    {
        titleKey: 'layout.admin.sidebar.users',
        descriptionKey: 'admin.dashboard.cards.users.description',
        href: '/admin/users',
        Icon: Users,
        accent: 'text-violet-600',
        bg: 'bg-violet-50',
        border: 'border-violet-100',
        tagKey: 'admin.dashboard.cards.users.tag',
        tagColor: 'bg-violet-50 text-violet-700 border border-violet-200',
    },
    {
        titleKey: 'layout.admin.sidebar.organizations',
        descriptionKey: 'admin.dashboard.cards.organizations.description',
        href: '/admin/organizations',
        Icon: Building2,
        accent: 'text-sky-600',
        bg: 'bg-sky-50',
        border: 'border-sky-100',
        tagKey: 'admin.dashboard.cards.organizations.tag',
        tagColor: 'bg-sky-50 text-sky-700 border border-sky-200',
    },
    {
        titleKey: 'layout.admin.sidebar.enterprises',
        descriptionKey: 'admin.dashboard.cards.enterprises.description',
        href: '/admin/enterprises',
        Icon: Briefcase,
        accent: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        tagKey: 'admin.dashboard.cards.enterprises.tag',
        tagColor: 'bg-amber-50 text-amber-700 border border-amber-200',
    },
    {
        titleKey: 'layout.admin.sidebar.organizerApprovals',
        descriptionKey: 'admin.dashboard.cards.organizerApprovals.description',
        href: '/admin/organizer-registrations',
        Icon: UserCheck,
        accent: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        tagKey: 'admin.dashboard.cards.organizerApprovals.tag',
        tagColor: 'bg-rose-50 text-rose-700 border border-rose-200',
    },
    {
        titleKey: 'layout.admin.sidebar.enterpriseApprovals',
        descriptionKey: 'admin.dashboard.cards.enterpriseApprovals.description',
        href: '/admin/event-join-requests',
        Icon: Briefcase,
        accent: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-100',
        tagKey: 'admin.dashboard.cards.enterpriseApprovals.tag',
        tagColor: 'bg-orange-50 text-orange-700 border border-orange-200',
    },
    {
        titleKey: 'layout.admin.sidebar.finance',
        descriptionKey: 'admin.dashboard.cards.finance.description',
        href: '/admin/finance',
        Icon: Wallet,
        accent: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        tagKey: 'admin.dashboard.cards.finance.tag',
        tagColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
    {
        titleKey: 'layout.admin.sidebar.monitoring',
        descriptionKey: 'admin.dashboard.cards.monitoring.description',
        href: '/admin/monitoring',
        Icon: Activity,
        accent: 'text-teal-600',
        bg: 'bg-teal-50',
        border: 'border-teal-100',
        tagKey: 'admin.dashboard.cards.monitoring.tag',
        tagColor: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    {
        titleKey: 'layout.admin.sidebar.auditLogs',
        descriptionKey: 'admin.dashboard.cards.auditLogs.description',
        href: '/admin/audit',
        Icon: ScrollText,
        accent: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-100',
        tagKey: 'admin.dashboard.cards.auditLogs.tag',
        tagColor: 'bg-purple-50 text-purple-700 border border-purple-200',
    },
    {
        titleKey: 'layout.admin.sidebar.incidents',
        descriptionKey: 'admin.dashboard.cards.incidents.description',
        href: '/admin/incidents',
        Icon: AlertTriangle,
        accent: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-100',
        tagKey: 'admin.dashboard.cards.incidents.tag',
        tagColor: 'bg-red-50 text-red-700 border border-red-200',
    },
];

export default function AdminDashboardPage() {
    const { t } = useTranslation();

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">{t('admin.dashboard.title')}</h1>
                    <p className="text-zinc-500 text-sm mt-0.5">
                        {t('admin.dashboard.description')}
                    </p>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CARDS.map(({ titleKey, descriptionKey, href, Icon, accent, bg, border, tagKey, tagColor }) => {
                    const title = t(titleKey);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className="group flex flex-col gap-4 p-6 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-300 hover:shadow-sm transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                                    <Icon className={`w-5 h-5 ${accent}`} />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tagColor}`}>
                                    {t(tagKey)}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{title}</h2>
                                <p className="text-sm text-zinc-500 mt-1 leading-relaxed line-clamp-2">{t(descriptionKey)}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 mt-auto pt-1">
                                {t('admin.dashboard.goTo', { title })} <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
