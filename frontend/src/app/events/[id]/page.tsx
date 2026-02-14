'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Event, ParticipantStatus } from '@/lib/api/types';
import { EventDetailsHeader } from '@/components/events/EventDetailsHeader';
import { JoinEventCard } from '@/components/events/JoinEventCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { Container } from '@/components/common/Container';
import { SectionTitle } from '@/components/common/SectionTitle';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventDetailsPage({ params }: EventPageProps) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<ParticipantStatus>('NOT_JOINED');
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, statusData] = await Promise.all([
        apiClient.get<Event>(ENDPOINTS.EVENTS.GET(id)),
        apiClient.get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(id)),
      ]);
      setEvent(eventData);
      setStatus(statusData.status);
    } catch (err) {
      console.error('Failed to fetch event details:', err);
      setError('Failed to load event details. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleJoin = async () => {
    try {
      setJoinLoading(true);
      await apiClient.post(ENDPOINTS.EVENTS.JOIN(id));
      // Refetch status after joining
      const statusData = await apiClient.get<{ status: ParticipantStatus }>(
        ENDPOINTS.EVENTS.MY_STATUS(id)
      );
      setStatus(statusData.status);
    } catch (err) {
      console.error('Failed to join event:', err);
      alert('Failed to join event. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <LoadingState message="Loading event details..." />;
  }

  if (error || !event) {
    return (
      <Container className="py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">{error || 'Event not found'}</h2>
        <button
          onClick={() => window.location.reload()}
          className="text-primary hover:underline"
        >
          Try again
        </button>
      </Container>
    );
  }

  return (
    <div className="pb-20">
      <EventDetailsHeader event={event} />
      
      <Container className="py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <section>
              <SectionTitle title="About this Event" align="left" className="mb-4" />
              <div className="mt-6 prose prose-indigo max-w-none text-muted-foreground">
                {event.long_description || event.description}
              </div>
            </section>

            {status === 'APPROVED' && (
              <>
                <section>
                  <SectionTitle title="Exhibition Stands" align="left" className="mb-4" />
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 border rounded-xl bg-muted/20 text-center">
                      <p className="text-muted-foreground italic">Stands preview will be available soon.</p>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionTitle title="Resources & Schedule" align="left" className="mb-4" />
                  <div className="mt-6 p-6 border rounded-xl bg-muted/20 text-center">
                    <p className="text-muted-foreground italic">Resources and schedule will be available soon.</p>
                  </div>
                </section>
              </>
            )}
            
            {status !== 'APPROVED' && (
              <section className="p-8 border rounded-2xl bg-muted/10 text-center border-dashed">
                <h3 className="text-xl font-semibold mb-2">Exclusive Content</h3>
                <p className="text-muted-foreground">
                  Register for this event to view exhibition stands, schedules, and downloadable resources.
                </p>
              </section>
            )}
          </div>

          <div className="lg:col-span-1">
            <JoinEventCard
              eventId={id}
              status={status}
              onJoin={handleJoin}
              loading={joinLoading}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
