import React from 'react';
import { Event } from '@/lib/api/types';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Container } from '@/components/common/Container';

interface EventDetailsHeaderProps {
  event: Event;
}

export const EventDetailsHeader: React.FC<EventDetailsHeaderProps> = ({ event }) => {
  return (
    <div className="bg-muted/30 border-b">
      <Container className="py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {event.banner_url && (
            <div className="w-full md:w-1/3 rounded-xl overflow-hidden shadow-lg aspect-video">
              <img
                src={event.banner_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-grow space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{event.category || 'Exhibition'}</Badge>
              {event.tags?.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{event.title}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {event.description}
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground pt-2">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                <span>
                  {formatDate(event.start_date)} - {formatDate(event.end_date)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <span>{event.location || 'Virtual Platform'}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                <span>Organized by {event.organizer_name || 'IVEP Organizer'}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};
