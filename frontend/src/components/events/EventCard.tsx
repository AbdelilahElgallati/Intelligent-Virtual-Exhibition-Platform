import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Event } from '@/lib/api/types';
import { formatDate } from '@/lib/utils';

interface EventCardProps {
  event: Event;
  showStatus?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, showStatus }) => {
  const eventId = (event as any)?.id || (event as any)?._id;
  return (
    <Card className="overflow-hidden flex flex-col h-full group">
      {event.banner_url ? (
        <div className="h-40 w-full relative overflow-hidden">
          <img
            src={event.banner_url}
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
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </CardTitle>
          {showStatus && event.state && (
            <Badge variant={event.state === 'APPROVED' || event.state === 'live' ? 'success' : 'secondary'}>
              {event.state.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDate(event.start_date)} - {formatDate(event.end_date)}
        </div>
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
          <Link href={`/events/${eventId}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
