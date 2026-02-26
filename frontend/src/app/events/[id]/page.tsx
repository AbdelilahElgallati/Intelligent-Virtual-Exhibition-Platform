'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Event, ParticipantStatus } from '@/lib/api/types';
import { EventDetailsHeader } from '@/components/events/EventDetailsHeader';
import { JoinEventCard } from '@/components/events/JoinEventCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { Container } from '@/components/common/Container';
import { SectionTitle } from '@/components/common/SectionTitle';
import { useAuth } from '@/context/AuthContext';
import { favoritesService } from '@/services/favorites.service';
import { Button } from '@/components/ui/Button';

interface EventPageProps {
  params: Promise<{ id?: string }> | { id?: string };
}

export default function EventDetailsPage({ params }: EventPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const id = resolvedParams?.id;
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<ParticipantStatus>('NOT_JOINED');
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setError('Event not found');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Always fetch event details
      const eventPromise = apiClient.get<Event>(ENDPOINTS.EVENTS.GET(id));

      // Only fetch status if authenticated
      const statusPromise = isAuthenticated
        ? apiClient.get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(id))
        : Promise.resolve({ status: 'NOT_JOINED' as ParticipantStatus });

      const [eventData, statusData] = await Promise.all([eventPromise, statusPromise]);

      setEvent(eventData);
      setStatus(statusData.status);

      if (isAuthenticated) {
        try {
          const favs = await favoritesService.list();
          const match = favs.find((f) => f.target_type === 'event' && (f.target_id === (eventData as any).id || f.target_id === (eventData as any)._id));
          setFavoriteId(match ? match.id : null);
        } catch {
          /* ignore favorite fetch errors to not block page */
        }
      }
    } catch (err) {
      console.error('Failed to fetch event details:', err);
      // If event fetch fails, it's a critical error for the page
      // If status fetch fails (e.g. 401 despite check), we might still want to show event
      setError('Failed to load event details. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  const handleJoin = async () => {
    if (!id) {
      alert('Event not found.');
      return;
    }
    if (!isAuthenticated) {
      // Save current path to redirect back after login
      localStorage.setItem('redirectAfterLogin', pathname);
      router.push('/auth/login');
      return;
    }

    try {
      setJoinLoading(true);
      const result = await apiClient.post<any>(ENDPOINTS.EVENTS.JOIN(id));

      // Check if the event requires payment
      if (result?.requires_payment) {
        // Redirect to payment page
        router.push(`/events/${id}/payment`);
        return;
      }

      // Refetch status after joining (free event — instant APPROVED)
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

  const toggleFavorite = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', pathname);
      router.push('/auth/login');
      return;
    }
    try {
      if (favoriteId) {
        await favoritesService.remove(favoriteId);
        setFavoriteId(null);
      } else {
        const fav = await favoritesService.add('event', id);
        setFavoriteId(fav.id);
      }
    } catch (err) {
      console.error('Favorite toggle failed', err);
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
            <div className="flex items-center justify-between">
              <SectionTitle title="About this Event" align="left" className="mb-0" />
              <Button size="sm" variant={favoriteId ? 'secondary' : 'outline'} onClick={toggleFavorite}>
                {favoriteId ? 'Favorited' : 'Add to favorites'}
              </Button>
            </div>
            <section>
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
              event={event}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
