import React from 'react';
import { Event } from '@/lib/api/types';
import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface JoinedEventsProps {
  events: Event[];
  loading: boolean;
}

export const JoinedEvents: React.FC<JoinedEventsProps> = ({ events, loading }) => {
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
        title="No events joined yet"
        message="You haven't joined any events. Explore recommended events to get started!"
        action={
          <Button asChild variant="outline">
            <Link href="/events">Browse All Events</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {events.map((event, index) => {
        const key = (event as any).id || (event as any)._id || `${event.title}-${index}`;
        return <EventCard key={key} event={event} />;
      })}
    </div>
  );
};
