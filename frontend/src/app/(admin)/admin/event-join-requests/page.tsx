"use client";

import React, { useEffect, useState } from 'react';
import { http } from '@/lib/http';
import { formatInUserTZ } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';
import {
    Building2, Globe, MapPin, Calendar, Users, Briefcase,
    CheckCircle2, XCircle, Link as LinkIcon, Mail
} from 'lucide-react';

interface EnterpriseReg {
    _id: string;
    full_name: string;
    email: string;
    approval_status: string;
    created_at: string;
    organization?: {
        _id: string;
        name: string;
        industry?: string;
        country?: string;
        city?: string;
        professional_email?: string;
        website?: string;
        linkedin?: string;
        company_size?: string;
        creation_year?: number;
        description?: string;
    };
}

const STATUS_COLORS: Record<string, string> = {
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_TABS = ['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

export default function EnterpriseRegistrationsPage() {
    const { t } = useTranslation();
    const [registrations, setRegistrations] = useState<EnterpriseReg[]>([]);
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
            const data = await http.get<any>(`/admin/enterprise-registrations${params}`);
            setRegistrations(data.registrations || []);
            setTotal(data.total || 0);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.enterprise.error.loadFailed'));
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
            await http.post(`/admin/enterprise-registrations/${userId}/approve`, {});
            await fetchRegistrations(activeTab);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.enterprise.error.approveFailed'));
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (userId: string) => {
        const reason = window.prompt(t('admin.approvals.enterprise.rejectionReasonPrompt'));
        if (reason === null) return;
        setProcessing(userId);
        try {
            await http.post(`/admin/enterprise-registrations/${userId}/reject`, { reason });
            await fetchRegistrations(activeTab);
        } catch (e: any) {
            setError(e.message || t('admin.approvals.enterprise.error.rejectFailed'));
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">{t('admin.approvals.enterprise.title')}</h1>
                <p className="text-zinc-500 mt-1">{t('admin.approvals.enterprise.description')}</p>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${activeTab === tab
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                            }`}>
                        {tab === 'ALL'
                            ? t('admin.approvals.enterprise.tabs.all')
                            : tab === 'PENDING_APPROVAL'
                                ? t('admin.approvals.enterprise.tabs.pending')
                                : tab === 'APPROVED'
                                    ? t('admin.approvals.enterprise.tabs.approved')
                                    : t('admin.approvals.enterprise.tabs.rejected')}
                    </button>
                ))}
                <span className="ml-auto text-sm text-zinc-500 self-center">{t('admin.approvals.enterprise.totalCount', { count: total })}</span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48 text-zinc-400">{t('admin.approvals.enterprise.loading')}</div>
            ) : registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-zinc-100 text-zinc-400 gap-2">
                    <Building2 size={32} className="text-zinc-200" />
                    {t('admin.approvals.enterprise.noRegistrations')}
                </div>
            ) : (
                <div className="grid gap-4">
                    {registrations.map(reg => {
                        const org = reg.organization;
                        return (
                            <div key={reg._id} className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    {/* Left: Info */}
                                    <div className="space-y-3 flex-1 min-w-0">
                                        {/* Header */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <Building2 size={20} className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-900 truncate">{org?.name || reg.full_name}</h3>
                                                <p className="text-xs text-zinc-500">{reg.email}</p>
                                            </div>
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[reg.approval_status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                                                {reg.approval_status === 'PENDING_APPROVAL'
                                                    ? t('admin.approvals.enterprise.status.pending_approval')
                                                    : reg.approval_status === 'APPROVED'
                                                        ? t('admin.approvals.enterprise.status.approved')
                                                        : reg.approval_status === 'REJECTED'
                                                            ? t('admin.approvals.enterprise.status.rejected')
                                                            : reg.approval_status?.replace(/_/g, ' ')}
                                            </span>
                                        </div>

                                        {/* Contact person */}
                                        <p className="text-sm text-zinc-600">
                                            <span className="font-medium text-zinc-700">{t('admin.approvals.enterprise.field.contact')}:</span> {reg.full_name}
                                        </p>

                                        {/* Organization Details Grid */}
                                        {org && (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm mt-2">
                                                {org.industry && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Briefcase size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <span className="text-zinc-600">{org.industry}</span>
                                                    </div>
                                                )}
                                                {(org.country || org.city) && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <span className="text-zinc-600">{[org.city, org.country].filter(Boolean).join(', ')}</span>
                                                    </div>
                                                )}
                                                {org.company_size && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Users size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <span className="text-zinc-600">{t('admin.approvals.enterprise.field.employees', { count: org.company_size })}</span>
                                                    </div>
                                                )}
                                                {org.creation_year && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <span className="text-zinc-600">{t('admin.approvals.enterprise.field.founded', { year: org.creation_year })}</span>
                                                    </div>
                                                )}
                                                {org.professional_email && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <span className="text-zinc-600 truncate">{org.professional_email}</span>
                                                    </div>
                                                )}
                                                {org.website && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <a href={org.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate">
                                                            {org.website}
                                                        </a>
                                                    </div>
                                                )}
                                                {org.linkedin && (
                                                    <div className="flex items-center gap-1.5">
                                                        <LinkIcon size={13} className="text-zinc-400 flex-shrink-0" />
                                                        <a href={org.linkedin} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate">
                                                            {t('admin.approvals.enterprise.field.linkedin')}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Description */}
                                        {org?.description && (
                                            <p className="text-sm text-zinc-500 mt-1 line-clamp-2 italic">"{org.description}"</p>
                                        )}

                                        {/* Created at */}
                                        <p className="text-xs text-zinc-400 mt-1">
                                            {t('admin.approvals.enterprise.registeredOn', { date: formatInUserTZ(reg.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) })}
                                        </p>
                                    </div>

                                    {/* Right: Actions */}
                                    {reg.approval_status === 'PENDING_APPROVAL' && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => handleApprove(reg._id)}
                                                disabled={processing === reg._id}
                                                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
                                                <CheckCircle2 size={15} />
                                                {processing === reg._id ? t('admin.common.actions.processingIndicator') : t('common.actions.approve')}
                                            </button>
                                            <button onClick={() => handleReject(reg._id)}
                                                disabled={processing === reg._id}
                                                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50 transition-all flex items-center gap-1.5">
                                                <XCircle size={15} />
                                                {t('common.actions.reject')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
