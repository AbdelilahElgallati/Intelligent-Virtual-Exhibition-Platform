import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Calendar, MapPin, Clock, Users, Globe } from 'lucide-react';
import Link from 'next/link';
import { Event } from '@/lib/api/types';
import { resolveMediaUrl } from '@/lib/media';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';

interface EventCardProps {
  event: Event;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const lifecycle = getEventLifecycle(event);
  const routeEventKey = event.slug || (event as any).id || (event as any)._id;

  const statusClass =
    lifecycle.displayState === 'ENDED'
      ? 'bg-slate-100 text-slate-600 border-slate-200'
      : lifecycle.displayState === 'LIVE'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : lifecycle.displayState === 'IN_PROGRESS'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-cyan-100 text-cyan-700 border-cyan-200';

  const accentColor =
    lifecycle.displayState === 'ENDED'
      ? 'bg-slate-500'
      : lifecycle.displayState === 'LIVE'
      ? 'bg-emerald-500'
      : lifecycle.displayState === 'IN_PROGRESS'
      ? 'bg-blue-500'
      : 'bg-cyan-500';

  const actionHref = lifecycle.accessState === 'OPEN_SLOT_ACTIVE' ? `/events/${routeEventKey}/live` : `/events/${routeEventKey}`;
  const actionLabel = lifecycle.accessState === 'OPEN_SLOT_ACTIVE' ? 'Enter Live Event' : lifecycle.displayState === 'UPCOMING' ? 'View Details' : 'View Summary';

  return (
    <Card className="group flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-muted/40">
      <div className="relative h-48 w-full overflow-hidden">
        {event.banner_url ? (
          <img
            src={resolveMediaUrl(event.banner_url)}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center opacity-80">
            <Globe className="text-white opacity-40" size={48} />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <Badge className={`border shadow-sm px-2.5 py-1 ${statusClass}`}>
            {lifecycle.displayState === 'LIVE' && <span className="mr-1.5 flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
            {lifecycle.displayState}
          </Badge>
        </div>
        {event.is_paid && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-black/60 backdrop-blur-md text-white border-none font-bold">
              PAID EVENT
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-6 flex-grow">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase">
            {event.category || 'Exhibition'}
          </Badge>
        </div>
        <h3 className="text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors mb-2">
          {event.title}
        </h3>
        <p className="text-muted-foreground text-sm line-clamp-2 mb-6 leading-relaxed">
          {event.description}
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <Calendar size={16} className="text-primary/60 shrink-0" />
            <span className="font-medium">
              {formatInTZ(event.start_date, getUserTimezone(), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <MapPin size={16} className="text-primary/60 shrink-0" />
            <span className="font-medium truncate">{event.location || 'Virtual'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <Users size={16} className="text-primary/60 shrink-0" />
            <span className="font-medium">
              {event.num_enterprises || 0} Enterprises
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex flex-col gap-4">
        <div className="w-full flex items-center justify-between">
          {(lifecycle.displayState === 'UPCOMING' || lifecycle.displayState === 'IN_PROGRESS') && lifecycle.nextSlot && (
            <div className="flex items-center gap-2 text-xs font-bold text-primary animate-in fade-in duration-500">
              <Clock size={12} />
              <span>{lifecycle.displayState === 'IN_PROGRESS' ? 'Next slot: ' : ''}{formatTimeToStart(lifecycle.nextSlot.start)}</span>
            </div>
          )}
          {lifecycle.displayState === 'LIVE' && lifecycle.currentSlot && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <Clock size={12} />
              <span>Current: {lifecycle.currentSlot.label}</span>
            </div>
          )}
        </div>
        
        <Button asChild className="w-full font-bold group/btn shadow-lg shadow-primary/10" variant={lifecycle.accessState === 'OPEN_SLOT_ACTIVE' ? 'primary' : 'outline'}>
          <Link href={actionHref}>
            {actionLabel}
            <Clock size={16} className="ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
