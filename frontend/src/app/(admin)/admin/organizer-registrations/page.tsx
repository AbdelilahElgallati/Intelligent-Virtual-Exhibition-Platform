"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { http } from '@/lib/http';

interface OrgReg {
    _id: string;
    full_name: string;
    email: string;
    org_name: string;
    org_type: string;
    org_country: string;
    org_city: string;
    org_phone: string;
    org_website: string;
    org_professional_email: string;
    approval_status: string;
    created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_TABS = ['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

export default function OrganizerRegistrationsPage() {
    const { t } = useTranslation();
    const [registrations, setRegistrations] = useState<OrgReg[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('PENDING_APPROVAL');
    const [processing, setProcessing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchRegistrations = async (filterStatus: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = filterStatus !== 'ALL' ? `?approval_status=${filterStatus}` : '';
            const data = await http.get<any>(`/admin/organizer-registrations${params}`);
            setRegistrations(data.registrations || []);
            setTotal(data.total || 0);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.organizer.error.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations(activeTab);
    }, [activeTab]);

    const handleApprove = async (userId: string) => {
        setProcessing(userId);
        try {
            await http.post(`/admin/organizer-registrations/${userId}/approve`, {});
            await fetchRegistrations(activeTab);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.organizer.error.approveFailed'));
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (userId: string) => {
        const reason = window.prompt(t('admin.approvals.organizer.rejectionReasonPrompt'));
        if (reason === null) return;
        setProcessing(userId);
        try {
            await http.post(`/admin/organizer-registrations/${userId}/reject`, { reason });
            await fetchRegistrations(activeTab);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.organizer.error.rejectFailed'));
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">{t('admin.approvals.organizer.title')}</h1>
                <p className="text-zinc-500 mt-1">{t('admin.approvals.organizer.description')}</p>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${activeTab === tab
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                            }`}>
                        {tab === 'ALL' ? t('admin.approvals.organizer.tabs.all') : t(`admin.approvals.organizer.tabs.${tab.toLowerCase().replace('_approval', '')}`)}
                    </button>
                ))}
                <span className="ml-auto text-sm text-zinc-500 self-center">{t('admin.approvals.organizer.totalCount', { count: total })}</span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48 text-zinc-400">{t('common.status.loading')}</div>
            ) : registrations.length === 0 ? (
                <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-zinc-100 text-zinc-400">
                    {t('admin.approvals.organizer.noRegistrations')}
                </div>
            ) : (
                <div className="grid gap-4">
                    {registrations.map(reg => (
                        <div key={reg._id} className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                {/* Left: Info */}
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="font-bold text-zinc-900 truncate">{reg.full_name}</h3>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[reg.approval_status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                                            {t(`admin.approvals.organizer.status.${reg.approval_status.toLowerCase()}`, { defaultValue: reg.approval_status?.replace('_', ' ') })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-500">{reg.email}</p>

                                    {/* Org Details */}
                                    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                        <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.organization')} </span><span className="text-zinc-600">{reg.org_name || '—'}</span></div>
                                        <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.type')} </span><span className="text-zinc-600">{reg.org_type || '—'}</span></div>
                                        <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.location')} </span><span className="text-zinc-600">{[reg.org_city, reg.org_country].filter(Boolean).join(', ') || '—'}</span></div>
                                        <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.phone')} </span><span className="text-zinc-600">{reg.org_phone || '—'}</span></div>
                                        <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.proEmail')} </span><span className="text-zinc-600">{reg.org_professional_email || '—'}</span></div>
                                        {reg.org_website && (
                                            <div><span className="font-medium text-zinc-700">{t('admin.approvals.organizer.field.website')} </span>
                                                <a href={reg.org_website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate">{reg.org_website}</a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                {reg.approval_status === 'PENDING_APPROVAL' && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => handleApprove(reg._id)}
                                            disabled={processing === reg._id}
                                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all">
                                            {processing === reg._id ? '…' : t('common.actions.approve')}
                                        </button>
                                        <button onClick={() => handleReject(reg._id)}
                                            disabled={processing === reg._id}
                                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50 transition-all">
                                            {t('common.actions.reject')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
