"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { http } from '@/lib/http';
import {
    MessageSquare, Clock, User, Package, Hash, Calendar,
    Mail, Phone, Tag, ChevronDown, Layers
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
    CONTACTED: 'bg-blue-50 text-blue-700 border-blue-100',
    CLOSED: 'bg-zinc-50 text-zinc-500 border-zinc-100',
};

export default function EnterpriseRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>('ALL');

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const data = await http.get<any[]>('/enterprise/product-requests');
            setRequests(data);
        } catch (err) {
            console.error('Failed to fetch requests', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    const updateStatus = async (id: string, status: string) => {
        try {
            await http.patch(`/enterprise/product-requests/${id}/status`, { status });
            fetchRequests();
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const statusCounts = {
        ALL: requests.length,
        PENDING: requests.filter(r => r.status === 'PENDING').length,
        CONTACTED: requests.filter(r => r.status === 'CONTACTED').length,
        CLOSED: requests.filter(r => r.status === 'CLOSED').length,
    };

    const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-zinc-500 text-sm">Track and respond to product & service inquiries from visitors.</p>

                {/* Filter tabs */}
                <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
                    {(['ALL', 'PENDING', 'CONTACTED', 'CLOSED'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s
                                ? 'bg-white text-zinc-900 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-700'
                                }`}
                        >
                            {s} <span className="ml-1 text-[10px] opacity-60">({statusCounts[s]})</span>
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500">Loading requests...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-20 text-center shadow-sm">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MessageSquare className="text-zinc-300" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">No requests</h3>
                    <p className="text-zinc-500 max-w-xs mx-auto">
                        {filter === 'ALL'
                            ? 'Visitor inquiries about your products will appear here.'
                            : `No ${filter.toLowerCase()} requests.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((req) => (
                        <Card key={req._id || req.id} className="border-zinc-200 group hover:border-indigo-200 transition-all">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                    {/* Left: Info */}
                                    <div className="flex-1 space-y-4">
                                        {/* Header row */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <div className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 flex-shrink-0">
                                                <User size={17} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-zinc-900 text-sm">
                                                    {req.visitor_name || `Visitor #${req.visitor_id?.slice(-4) || '????'}`}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                                    <Clock size={11} />
                                                    {new Date(req.created_at).toLocaleDateString(undefined, {
                                                        month: 'short', day: 'numeric', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <span className={`ml-auto md:ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[req.status] || 'bg-zinc-50 text-zinc-500 border-zinc-100'}`}>
                                                {req.status}
                                            </span>
                                        </div>

                                        {/* Message */}
                                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 italic text-sm text-zinc-600">
                                            &ldquo;{req.message}&rdquo;
                                        </div>

                                        {/* Metadata chips */}
                                        <div className="flex flex-wrap gap-3">
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                                                <Package size={12} className="text-indigo-500" />
                                                <span className="font-medium">{req.product_is_service ? 'Service' : 'Product'}:</span>
                                                <span className="font-bold text-zinc-800">{req.product_name || `#${req.product_id?.slice(-6) || '—'}`}</span>
                                            </div>

                                            {req.event_id && (
                                                <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                    <Layers size={12} className="text-indigo-500" />
                                                    <span className="font-medium">Event:</span>
                                                    <span className="font-bold text-indigo-700">#{req.event_id?.slice(-6) || '—'}</span>
                                                </div>
                                            )}

                                            {req.quantity != null && (
                                                <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                    <Hash size={12} className="text-emerald-600" />
                                                    <span className="font-medium">Quantity:</span>
                                                    <span className="font-bold text-emerald-700">{req.quantity}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex flex-col gap-2 min-w-[160px]">
                                        {req.status === 'PENDING' && (
                                            <Button
                                                onClick={() => updateStatus(req._id || req.id, 'CONTACTED')}
                                                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-sm shadow-md shadow-indigo-100"
                                            >
                                                Mark Contacted
                                            </Button>
                                        )}
                                        {req.status === 'CONTACTED' && (
                                            <Button
                                                onClick={() => updateStatus(req._id || req.id, 'CLOSED')}
                                                variant="outline"
                                                className="w-full h-10 border-zinc-200 text-sm hover:bg-zinc-50"
                                            >
                                                Close Request
                                            </Button>
                                        )}
                                        {req.status === 'CLOSED' && (
                                            <div className="w-full h-10 flex items-center justify-center text-xs font-bold text-zinc-400 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 uppercase tracking-widest">
                                                Resolution Finished
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-9 border-zinc-200 bg-white text-sm hover:border-indigo-300 hover:text-indigo-600 group/btn"
                                                title="Email Visitor"
                                                asChild
                                                disabled={!req.visitor_email}
                                            >
                                                <a href={req.visitor_email ? `mailto:${req.visitor_email}?subject=Regarding your request for ${req.product_name || 'our product'}` : '#'}>
                                                    <Mail size={14} className="text-zinc-400 mr-1.5 group-hover/btn:text-indigo-500" /> Email
                                                </a>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="px-3 h-9 border-zinc-200 bg-white hover:border-emerald-300 hover:text-emerald-600 group/btn"
                                                title="Call Visitor"
                                                asChild
                                                disabled={!req.visitor_phone}
                                            >
                                                <a href={req.visitor_phone ? `tel:${req.visitor_phone}` : '#'}>
                                                    <Phone size={14} className="text-zinc-400 group-hover/btn:text-emerald-500" />
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
