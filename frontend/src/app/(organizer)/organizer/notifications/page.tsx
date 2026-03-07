'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api/notifications';
import { Bell, CheckCheck, CreditCard, Link2, CheckCircle2, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Notification {
    id: string;
    _id?: string;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

// Map notification type → icon + colour
const TYPE_META: Record<string, { icon: React.ElementType; ring: string; dot: string }> = {
    payment_required: { icon: CreditCard, ring: 'border-orange-200 bg-orange-50', dot: 'bg-orange-500' },
    payment_confirmed: { icon: CheckCircle2, ring: 'border-green-200  bg-green-50', dot: 'bg-green-500' },
    links_generated: { icon: Link2, ring: 'border-indigo-200 bg-indigo-50', dot: 'bg-indigo-500' },
    event_approved: { icon: CheckCircle2, ring: 'border-green-200  bg-green-50', dot: 'bg-green-500' },
    event_rejected: { icon: Info, ring: 'border-red-200    bg-red-50', dot: 'bg-red-500' },
    invitation_sent: { icon: Bell, ring: 'border-blue-200   bg-blue-50', dot: 'bg-blue-500' },
};

function getMeta(type: string) {
    return TYPE_META[type] ?? { icon: Bell, ring: 'border-gray-200 bg-gray-50', dot: 'bg-gray-400' };
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'just now';
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    const load = async () => {
        try {
            const data = await notificationsApi.getNotifications();
            setNotifications(data as Notification[]);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleMarkAll = async () => {
        setMarkingAll(true);
        try {
            await notificationsApi.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } finally { setMarkingAll(false); }
    };

    const handleMarkOne = async (id: string) => {
        try {
            await notificationsApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id || n._id === id ? { ...n, is_read: true } : n))
            );
        } catch { /* silent */ }
    };

    const unread = notifications.filter((n) => !n.is_read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-indigo-600" />
                        Notifications
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {unread > 0 ? `${unread} unread` : 'All caught up!'}
                    </p>
                </div>
                {unread > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        isLoading={markingAll}
                        onClick={handleMarkAll}
                    >
                        <CheckCheck className="w-4 h-4" />
                        Mark all read
                    </Button>
                )}
            </div>

            {/* List */}
            {notifications.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No notifications yet.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {notifications.map((n) => {
                        const id = n.id ?? n._id ?? '';
                        const meta = getMeta(n.type);
                        const Icon = meta.icon;
                        return (
                            <div
                                key={id}
                                className={`flex items-start gap-4 px-5 py-4 transition-colors ${n.is_read ? 'bg-white' : 'bg-orange-50/40'
                                    }`}
                            >
                                {/* Icon */}
                                <div className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center ${meta.ring}`}>
                                    <Icon className="w-4 h-4 text-current opacity-70" />
                                </div>

                                {/* Body */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                        {n.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                                        {!n.is_read && (
                                            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                                        )}
                                    </div>
                                </div>

                                {/* Mark read */}
                                {!n.is_read && (
                                    <button
                                        onClick={() => handleMarkOne(id)}
                                        className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                                    >
                                        Mark read
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
