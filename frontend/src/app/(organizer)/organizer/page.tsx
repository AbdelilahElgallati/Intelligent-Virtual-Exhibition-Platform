'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent } from '@/types/event';
import { Calendar, Users, CheckCircle2, Clock } from 'lucide-react';

export default function OrganizerDashboard() {
    const { user } = useAuth();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await eventsApi.getOrganizerEvents();
                setEvents(data || []);
            } catch (err) {
                console.error('Failed to fetch events', err);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const stats = [
        { label: 'Total Events', value: events.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Events', value: Array.isArray(events) ? events.filter(e => e.state === 'approved' || e.state === 'live').length : 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Pending Approval', value: Array.isArray(events) ? events.filter(e => e.state === 'pending_approval').length : 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { label: 'Total Visitors', value: '---', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.full_name?.split(' ')[0]}</h1>
                <p className="text-gray-500">Here's what's happening with your events today.</p>
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
