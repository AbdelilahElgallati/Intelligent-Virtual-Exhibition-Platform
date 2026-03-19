"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { http } from '@/lib/http';
import {
    Users,
    Mail,
    Phone,
    Calendar,
    Download,
    Filter,
    Search,
    ChevronRight,
    MessageSquare,
    Package,
    ArrowUpRight,
    Clock
} from 'lucide-react';
import clsx from 'clsx';

interface Lead {
    _id: string;
    id?: string;
    visitor_id: string;
    visitor_name?: string;
    visitor_email?: string;
    visitor_phone?: string;
    stand_id: string;
    interaction_type: string;
    metadata: any;
    timestamp: string;
}

interface Stand {
    id: string;
    name: string;
    event_id: string;
}

export default function EnterpriseLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stands, setStands] = useState<Stand[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStand, setSelectedStand] = useState<string>('all');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Events to find stands
            const events = await http.get<any[]>('/enterprise/events');
            const approvedEvents = events.filter(
                ev => ev.participation?.status === 'approved' || ev.participation?.status === 'guest_approved'
            );

            // 2. Fetch stands
            const standPromises = approvedEvents.map(ev =>
                http.get<Stand>(`/enterprise/events/${ev.id || ev._id}/stand`).catch(() => null)
            );
            const standResults = (await Promise.all(standPromises)).filter(s => s !== null) as Stand[];
            setStands(standResults);

            // 3. Fetch Leads for all stands
            const leadPromises = standResults.map(s =>
                http.get<Lead[]>(`/leads/stand/${s.id}`).catch(() => [])
            );
            const leadResults = await Promise.all(leadPromises);
            setLeads(leadResults.flat().sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ));

        } catch (err) {
            console.error('Failed to fetch leads', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filteredLeads = leads.filter(l => {
        const matchesSearch = !search ||
            (l.visitor_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (l.interaction_type || '').toLowerCase().includes(search.toLowerCase());
        const matchesStand = selectedStand === 'all' || l.stand_id === selectedStand;
        return matchesSearch && matchesStand;
    });

    const getInteractionIcon = (type: string) => {
        switch (type) {
            case 'visit': return <Users size={14} className="text-blue-500" />;
            case 'chat': return <MessageSquare size={14} className="text-indigo-500" />;
            case 'product_request': return <Package size={14} className="text-emerald-500" />;
            default: return <Clock size={14} className="text-zinc-400" />;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-indigo-600 text-white border-0 shadow-lg shadow-indigo-100">
                    <CardContent className="p-6">
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Total Leads</p>
                        <h3 className="text-3xl font-bold">{leads.length}</h3>
                    </CardContent>
                </Card>
                <Card className="bg-white border-zinc-200">
                    <CardContent className="p-6">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Visits</p>
                        <h3 className="text-3xl font-bold text-zinc-900">
                            {leads.filter(l => l.interaction_type === 'visit').length}
                        </h3>
                    </CardContent>
                </Card>
                <Card className="bg-white border-zinc-200">
                    <CardContent className="p-6">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Chat Inquiries</p>
                        <h3 className="text-3xl font-bold text-zinc-900">
                            {leads.filter(l => l.interaction_type === 'chat').length}
                        </h3>
                    </CardContent>
                </Card>
                <Card className="bg-white border-zinc-200">
                    <CardContent className="p-6">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Action Rate</p>
                        <h3 className="text-3xl font-bold text-zinc-900">
                            {leads.length > 0 ? Math.round((leads.filter(l => l.interaction_type !== 'visit').length / leads.length) * 100) : 0}%
                        </h3>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search leads..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                    <select
                        className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedStand}
                        onChange={e => setSelectedStand(e.target.value)}
                    >
                        <option value="all">All Stands</option>
                        {stands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <Button variant="outline" className="gap-2 text-sm border-zinc-200">
                    <Download size={16} /> Export CSV
                </Button>
            </div>

            {/* Leads Table */}
            <Card className="border-zinc-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/50 border-b border-zinc-100">
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Visitor</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Interaction</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Stand / Event</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Time</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-6"><div className="h-4 bg-zinc-100 rounded w-32" /></td>
                                        <td className="px-6 py-6"><div className="h-4 bg-zinc-100 rounded w-24" /></td>
                                        <td className="px-6 py-6"><div className="h-4 bg-zinc-100 rounded w-40" /></td>
                                        <td className="px-6 py-6"><div className="h-4 bg-zinc-100 rounded w-28" /></td>
                                        <td className="px-6 py-6 text-right"><div className="h-8 bg-zinc-100 rounded w-20 ml-auto" /></td>
                                    </tr>
                                ))
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-zinc-400 italic">
                                        No leads found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map(lead => (
                                    <tr key={lead.id || lead._id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                                    {(lead.visitor_name || 'V').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-900">
                                                        {lead.visitor_name || `Visitor #${(lead.visitor_id || '').slice(-4)}`}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-400">{lead.visitor_email || 'No email provided'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1.5 rounded-lg bg-zinc-100 group-hover:bg-white border border-transparent group-hover:border-zinc-100 transition-all">
                                                    {getInteractionIcon(lead.interaction_type)}
                                                </span>
                                                <span className="text-xs font-medium text-zinc-700 capitalize">
                                                    {(lead.interaction_type || 'unknown').replace('_', ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-medium text-zinc-800">
                                                {stands.find(s => s.id === lead.stand_id)?.name || 'Unknown Stand'}
                                            </p>
                                            <p className="text-[10px] text-zinc-400 capitalize">Event ID: {lead.stand_id?.slice(-6)}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-zinc-600">
                                                {new Date(lead.timestamp).toLocaleDateString()}
                                            </p>
                                            <p className="text-[10px] text-zinc-400">
                                                {new Date(lead.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider border-zinc-200">
                                                View Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
