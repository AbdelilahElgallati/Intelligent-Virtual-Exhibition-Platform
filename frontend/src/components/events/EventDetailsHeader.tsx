import React, { useState, useEffect } from 'react';
import { Event } from '@/lib/api/types';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/common/Container';
import { resolveMediaUrl } from '@/lib/media';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { useAuth } from '@/context/AuthContext';
import { getUserTimezone, formatInUserTZ } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

interface EventDetailsHeaderProps {
  event: Event;
}

export const EventDetailsHeader: React.FC<EventDetailsHeaderProps> = ({ event }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const userTimezone = mounted ? (user?.timezone || getUserTimezone()) : 'UTC';

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  const lifecycle = getEventLifecycle(event);

  const statusConfig = {
    UPCOMING: { class: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: t('visitor.eventLiveLayout.upcoming') },
    LIVE: { class: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: t('visitor.eventLiveLayout.liveNow') },
    IN_PROGRESS: { class: 'bg-blue-100 text-blue-700 border-blue-200', label: t('visitor.eventLiveLayout.inProgress') },
    ENDED: { class: 'bg-slate-100 text-slate-700 border-slate-200', label: t('visitor.eventLiveLayout.closed') },
  }[lifecycle.displayState];

  return (
    <div className="bg-muted/30 border-b">
      <Container className="py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {event.banner_url && (
            <div className="w-full md:w-1/3 rounded-xl overflow-hidden shadow-lg aspect-video">
              <img
                src={resolveMediaUrl(event.banner_url)}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-grow space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={`border ${statusConfig.class}`}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline">{event.category || t('events.detail.exhibitionFallback')}</Badge>
              {event.tags?.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            {(lifecycle.displayState === 'UPCOMING' || lifecycle.displayState === 'IN_PROGRESS') && lifecycle.nextSlot && (
              <p className={lifecycle.displayState === 'IN_PROGRESS' ? "text-sm font-medium text-blue-700" : "text-sm font-medium text-cyan-700"}>
                {lifecycle.displayState === 'IN_PROGRESS' ? `${t('visitor.eventCard.nextSlot')} ` : ''}
                {formatTimeToStart(lifecycle.nextSlot.start)}
              </p>
            )}
            <h1 className="text-4xl font-bold tracking-tight">{event.title}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {event.description}
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground pt-2">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>
                  {formatInUserTZ(event.start_date, dateOptions, undefined, userTimezone)} - {formatInUserTZ(event.end_date, dateOptions, undefined, userTimezone)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>{event.location || t('visitor.eventDetailsHeader.virtualPlatform')}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>{t('visitor.eventDetailsHeader.organizedBy', { name: event.organizer_name || t('events.detail.organizerFallback') })}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};
