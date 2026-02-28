'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent } from '@/types/event';
import { Calendar, Users, CheckCircle2, Clock, Download, FileText } from 'lucide-react';
import { organizerService } from '@/services/organizer.service';
import { Button } from '@/components/ui/Button';
import { OrganizerSummary } from '@/types/organizer';

export default function OrganizerDashboard() {
    const { user } = useAuth();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const [summary, setSummary] = useState<OrganizerSummary | null>(null);
    const [exportLoading, setExportLoading] = useState(false);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const [eventsData, summaryData] = await Promise.all([
                    eventsApi.getOrganizerEvents(),
                    organizerService.getOverallSummary()
                ]);
                setEvents(eventsData || []);
                setSummary(summaryData);
            } catch (err) {
                console.error('Failed to fetch dashboard data', err);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const handleExportOverall = async () => {
        setExportLoading(true);
        try {
            await organizerService.exportOverallReportPDF();
        } catch (err) {
            console.error('Export failed', err);
        } finally {
            setExportLoading(false);
        }
    };

    const stats = [
        { label: 'Total Events', value: events.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Events', value: Array.isArray(events) ? events.filter(e => e.state === 'approved' || e.state === 'live' || e.state === 'payment_done' || e.state === 'payment_proof_submitted').length : 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Pending Approval', value: Array.isArray(events) ? events.filter(e => e.state === 'pending_approval' || e.state === 'waiting_for_payment').length : 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { label: 'Total Visitors', value: summary?.overview.total_visitors ?? '---', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.full_name?.split(' ')[0]}</h1>
                    <p className="text-gray-500">Here's what's happening with your events today.</p>
                </div>
                {!loading && events.length > 0 && (
                    <Button
                        variant="primary"
                        onClick={handleExportOverall}
                        isLoading={exportLoading}
                        className="gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export Overall Performance (PDF)
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={idx} className="p-6 border-none shadow-sm flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Events</h3>
                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-gray-500 text-sm">Loading events...</p>
                        ) : !Array.isArray(events) || events.length === 0 ? (
                            <p className="text-gray-500 text-sm">No events found. Start by creating one!</p>
                        ) : (
                            events.slice(0, 5).map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center text-indigo-600 font-bold">
                                            {event.title.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{event.title}</div>
                                            <div className="text-xs text-gray-500">{new Date(event.start_date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${event.state === 'approved' ? 'bg-green-100 text-green-700' :
                                        event.state === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {event.state}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card className="p-6 bg-indigo-900 text-white border-none">
                    <h3 className="text-lg font-bold mb-2">Organizer Tip</h3>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                        Keep your event details up to date to attract more exhibitors and visitors.
                        Detailed descriptions and high-quality banners significantly increase engagement levels.
                    </p>
                    <button className="bg-white text-indigo-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors">
                        Learn More
                    </button>
                </Card>
            </div>
        </div>
    );
}
