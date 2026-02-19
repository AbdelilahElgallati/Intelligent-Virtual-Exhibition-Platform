'use client';

import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent } from '@/types/event';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function OrganizerEvents() {
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await eventsApi.getOrganizerEvents();
                setEvents(data || []);
            } catch (err) {
                console.error('Failed to fetch events', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const columns = [
        {
            header: 'Event Title',
            accessor: 'title' as const,
            className: 'font-medium text-gray-900'
        },
        {
            header: 'Start Date',
            accessor: (item: OrganizerEvent) => new Date(item.start_date).toLocaleDateString()
        },
        {
            header: 'Status',
            accessor: (item: OrganizerEvent) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.state === 'approved' ? 'bg-green-100 text-green-700' :
                        item.state === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                    }`}>
                    {item.state}
                </span>
            )
        },
        {
            header: 'Actions',
            accessor: () => (
                <Button variant="outline" size="sm">Edit</Button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
                    <p className="text-gray-500">Manage and track your organized exhibitions.</p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={events}
                isLoading={loading}
                emptyMessage="You haven't created any events yet."
            />
        </div>
    );
}
