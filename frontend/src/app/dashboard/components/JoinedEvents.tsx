import React from 'react';
import { Event } from '@/types/event';
import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface JoinedEventsProps {
  events: Event[];
  loading: boolean;
}

export const JoinedEvents: React.FC<JoinedEventsProps> = ({ events, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-[300px] rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.visitor.joinedEvents.empty.title')}
        message={t('dashboard.visitor.joinedEvents.empty.message')}
        action={
          <Button asChild variant="outline">
            <Link href="/events">{t('dashboard.visitor.joinedEvents.empty.browseLink')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
