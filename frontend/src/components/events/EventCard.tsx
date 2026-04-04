import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Event } from '@/types/event';
import { formatDate } from '@/lib/utils';
import { resolveMediaUrl } from '@/lib/media';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { CheckCircle2, CircleOff, Clock3, Heart } from 'lucide-react';

interface EventCardProps {
  event: Event;
  showStatus?: boolean;
  isRegistered?: boolean;
  favoriteId?: string | null;
  favoriteAnimating?: boolean;
  onToggleFavorite?: (eventId: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isRegistered,
  favoriteId,
  favoriteAnimating,
  onToggleFavorite,
}) => {
  const evAny = event as any;
  const idForFavorites = String(evAny?.id || evAny?._id || event.slug || '');
  const routeEventKey = event.slug || evAny?.id || evAny?._id;
  const lifecycle = getEventLifecycle(event);
  const isBetweenSlots = lifecycle.betweenSlots;
  const lifecycleLabel = !lifecycle.hasScheduleSlots
    ? 'TIMELINE TBD'
    : isBetweenSlots
      ? 'IN PROGRESS'
      : lifecycle.status === 'live'
      ? 'LIVE'
      : lifecycle.status === 'upcoming'
        ? 'UPCOMING'
        : 'ENDED';
  const lifecycleClass =
    !lifecycle.hasScheduleSlots
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : isBetweenSlots
        ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lifecycle.status === 'live'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : lifecycle.status === 'upcoming'
        ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  const actionHref = lifecycle.status === 'live' ? `/events/${routeEventKey}/live` : `/events/${routeEventKey}`;
  const actionLabel = lifecycle.status === 'live' ? 'Enter Live Event' : lifecycle.status === 'upcoming' ? 'View Details' : 'View Summary';

  return (
    <Card className="overflow-hidden flex flex-col h-full group">
      {event.banner_url ? (
        <div className="h-40 w-full relative overflow-hidden">
          <img
            src={resolveMediaUrl(event.banner_url)}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground">No banner</span>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-xl line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </CardTitle>
          <div className="flex flex-col items-end gap-1">
            {idForFavorites && onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(idForFavorites)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${
                  favoriteId
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-zinc-300 bg-white text-zinc-600 hover:border-rose-300 hover:text-rose-600'
                }`}
                aria-label={favoriteId ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`h-3.5 w-3.5 transition-transform ${favoriteAnimating ? 'scale-125' : 'scale-100'} ${favoriteId ? 'fill-current' : ''}`} />
                {favoriteId ? 'Favorited' : 'Favorite'}
              </button>
            )}
            <Badge className={`border whitespace-nowrap text-[11px] font-semibold tracking-wide ${lifecycleClass}`}>
              {lifecycleLabel}
            </Badge>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDate(event.start_date)} - {formatDate(event.end_date)}
        </div>
        {!lifecycle.hasScheduleSlots && (
          <div className="text-xs text-amber-700 mt-1 font-medium inline-flex items-center gap-1">
            <CircleOff className="h-3.5 w-3.5" /> Schedule timeline not published yet
          </div>
        )}
        {lifecycle.hasScheduleSlots && lifecycle.status === 'upcoming' && lifecycle.nextSlotStart && (
          <div className={`text-xs mt-1 font-medium ${isBetweenSlots ? 'text-blue-700' : 'text-cyan-700'}`}>
            {isBetweenSlots ? `Next slot ${formatTimeToStart(lifecycle.nextSlotStart).replace('Starts in ', 'in ')}` : formatTimeToStart(lifecycle.nextSlotStart)}
          </div>
        )}
        {lifecycle.hasScheduleSlots && lifecycle.status === 'live' && lifecycle.activeSlotLabel && (
          <div className="text-xs text-emerald-700 mt-1 font-medium">
            Live slot: {lifecycle.activeSlotLabel}
          </div>
        )}

        {typeof isRegistered === 'boolean' && (
          <div className="mt-2">
            <span
              className={
                isRegistered
                  ? 'inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700'
                  : 'inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600'
              }
            >
              {isRegistered ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
              {isRegistered ? 'Registered' : 'Not registered'}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {event.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {event.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild variant="outline" className="w-full">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
