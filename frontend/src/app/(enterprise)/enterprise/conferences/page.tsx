"use client";

import React, { useState, useEffect } from 'react';
import { formatInTZ } from '@/lib/timezone';
import { useAuth } from '@/context/AuthContext';
import { http } from '@/lib/http';
import { Conference } from '@/types/conference';
import { Loader2, Video, Calendar, Clock, Share2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export default function EnterpriseConferencesPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const router = useRouter();
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchConferences = async () => {
            try {
                // Fetch all conferences assigned to this enterprise
                const [confData, eventData] = await Promise.all([
                    http.get<Conference[]>('/conferences/my-assigned'),
                    http.get<any[]>('/enterprise/events').catch(() => [])
                ]);
                setConferences(confData);
                setEvents(eventData);
            } catch (err) {
                console.error('Failed to fetch conferences', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConferences();
    }, []);

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">{t('enterprise.conferences.title')}</h1>
                    <p className="text-zinc-500 mt-1">{t('enterprise.conferences.subtitle')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {conferences.map((c) => {
                    const event = events.find(e => (e.id || e._id) === c.event_id);
                    const eventPathId = event?.slug || c.event_id;
                    const tz = event?.event_timezone || 'UTC';
                    
                    return (
                    <Card key={c._id} className="group border-zinc-200 hover:border-indigo-200 transition-all shadow-sm hover:shadow-xl overflow-hidden rounded-3xl">
                        <div className={clsx(
                            "h-2 w-full",
                            c.status === 'live' ? "bg-emerald-500 animate-pulse" :
                                c.status === 'scheduled' ? "bg-indigo-500" : "bg-zinc-300"
                        )} />
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <span className={clsx(
                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                    c.status === 'live' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                                )}>
                                    {c.status === 'live' ? `🔴 ${t('enterprise.conferences.live')}` : c.status}
                                </span>
                                <div className="flex gap-1">
                                    <button className="p-1.5 text-zinc-400 hover:text-indigo-600 transition-colors">
                                        <Share2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-zinc-900 group-hover:text-indigo-600 transition-colors mb-4 line-clamp-2 min-h-[3.5rem]">
                                {c.title}
                            </h3>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                                    <Calendar size={14} className="text-indigo-500" />
                                    <span>
                                        {formatInTZ(c.start_time, tz, 'MMM d, yyyy')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                                    <Clock size={14} className="text-indigo-500" />
                                    <span>
                                        {`${formatInTZ(c.start_time, tz, 'h:mm a')} — ${formatInTZ(c.end_time, tz, 'h:mm a')}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    className={clsx(
                                        "flex-1 rounded-2xl font-black py-6",
                                        c.status === 'live' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                                    )}
                                    // Assuming conferences are event-specific, we might need event_id in the URL
                                    onClick={() => router.push(`/enterprise/events/${eventPathId}/conferences/${c._id}/live`)}
                                >
                                    {c.status === 'live' ? t('enterprise.conferences.enterStudio') : t('enterprise.conferences.goLive')}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="aspect-square p-0 w-12 h-12 rounded-2xl border-zinc-200"
                                    onClick={() => router.push(`/enterprise/events/${eventPathId}/manage`)}
                                >
                                    <ExternalLink size={18} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    );
                })}

                {conferences.length === 0 && (
                    <div className="col-span-full h-80 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-[2.5rem] border-2 border-dashed border-zinc-200">
                        <Video size={64} className="text-zinc-200 mb-4" />
                        <h3 className="text-xl font-black text-zinc-400">{t('enterprise.conferences.empty.title')}</h3>
                        <p className="text-sm text-zinc-400 max-w-sm mt-2">
                            {t('enterprise.conferences.empty.subtitle')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
