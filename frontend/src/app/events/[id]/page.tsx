'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation'; // Added usePathname
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
import { Download, Heart } from 'lucide-react';
import { downloadEventTicketReceiptPdf } from '@/lib/pdf/receipts';
import { StandsListResponse } from '@/types/stand';

const resolveFavoriteDocId = (fav: any): string => String(fav?.id || fav?._id || '');

interface EnterprisePreview {
  id?: string;
  _id?: string;
  user_id?: string;
  organization_name?: string;
  full_name?: string;
}

interface ScheduleSlotPreview {
  dayNumber: number;
  dateLabel?: string;
  startTime?: string;
  endTime?: string;
  label: string;
}

interface StandPreview {
  id?: string;
  _id?: string;
  name?: string;
  organization_name?: string;
}

interface EventPageProps {
  params: Promise<{ id?: string }> | { id?: string };
}

export default function EventDetailsPage({ params }: EventPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const id = resolvedParams?.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<ParticipantStatus>('NOT_JOINED');
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const [enterprisesPreview, setEnterprisesPreview] = useState<EnterprisePreview[]>([]);
  const [standPreview, setStandPreview] = useState<StandPreview[]>([]);

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

      const enterprisesPromise = apiClient
        .get<EnterprisePreview[]>(ENDPOINTS.PARTICIPANTS.ENTERPRISES(id))
        .catch(() => [] as EnterprisePreview[]);

      const standsPromise = apiClient
        .get<StandsListResponse>(ENDPOINTS.STANDS.LIST(id))
        .catch(() => ({ items: [], total: 0, limit: 0, skip: 0 } as StandsListResponse));

      const [eventData, statusData, enterprisesData, standsData] = await Promise.all([
        eventPromise,
        statusPromise,
        enterprisesPromise,
        standsPromise,
      ]);

      setEvent(eventData);
      setStatus(statusData.status);
      setEnterprisesPreview(Array.isArray(enterprisesData) ? enterprisesData : []);
      setStandPreview(Array.isArray(standsData?.items) ? (standsData.items as StandPreview[]) : []);

      if (isAuthenticated) {
        try {
          const favs = await favoritesService.list();
          const match = favs.find((f) => f.target_type === 'event' && (f.target_id === (eventData as any).id || f.target_id === (eventData as any)._id));
          const favoriteDocId = match ? resolveFavoriteDocId(match) : '';
          setFavoriteId(favoriteDocId || null);
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
      setFavoriteAnimating(true);
      if (favoriteId) {
        await favoritesService.remove(favoriteId);
        setFavoriteId(null);
      } else {
        const fav = await favoritesService.add('event', id);
        const favoriteDocId = resolveFavoriteDocId(fav);
        setFavoriteId(favoriteDocId || null);
      }
      window.setTimeout(() => setFavoriteAnimating(false), 250);
    } catch (err) {
      console.error('Favorite toggle failed', err);
      setFavoriteAnimating(false);
    }
  };

  const downloadReceipt = async () => {
    if (!id || !event) return;
    try {
      // Fetch receipt details from backend
      const res = await apiClient.get<any>(ENDPOINTS.PAYMENTS.RECEIPT(id));
      if (!res) throw new Error('No receipt found');
      await downloadEventTicketReceiptPdf({
        eventId: id,
        eventTitle: event.title || 'Event',
        payerName: res.payer_name || 'Visitor',
        payerEmail: res.payer_email || '',
        amount: Number(res.amount || (event as any).ticket_price || 0),
        currency: res.currency || 'MAD',
        paidAt: res.paid_at,
        reference: res.stripe_payment_intent_id || res.receipt_id || 'N/A',
      });
    } catch (err) {
      console.error('Failed to download receipt', err);
      alert('Could not download receipt. You might not have a paid receipt for this event.');
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

  const isPaidEvent = !!(event as any).is_paid && ((event as any).ticket_price || (event as any).price) > 0;
  const isApprovedVisitor = status === 'APPROVED' || status === 'GUEST_APPROVED';
  const wasEjectedFromLive = searchParams.get('event_ended') === 'true';

  const parseScheduleHighlights = (ev: Event): ScheduleSlotPreview[] => {
    const eventTimezone = ((ev as any).event_timezone as string) || 'UTC';
    const getDatePartsInTimezone = (value: Date, timeZone: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(value);
      const read = (type: Intl.DateTimeFormatPartTypes): number => {
        const raw = parts.find((p) => p.type === type)?.value;
        return Number(raw || 0);
      };
      return { year: read('year'), month: read('month'), day: read('day') };
    };

    const formatDayLabel = (dayNumber: number, dayIndex: number): string => {
      const dayOffset = Math.max(0, Number(dayNumber || (dayIndex + 1)) - 1);
      const seed = new Date((ev as any).start_date || new Date().toISOString());
      const ymd = getDatePartsInTimezone(seed, eventTimezone);
      const base = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + dayOffset, 12, 0, 0, 0));
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        timeZone: eventTimezone,
      }).format(base);
    };

    const days = Array.isArray((ev as any).schedule_days)
      ? ((ev as any).schedule_days as Array<any>)
      : (() => {
          if (!(ev as any).event_timeline || typeof (ev as any).event_timeline !== 'string') return [] as Array<any>;
          try {
            const parsed = JSON.parse((ev as any).event_timeline);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [] as Array<any>;
          }
        })();

    const flat: ScheduleSlotPreview[] = [];
    days.forEach((day: any, dayIndex: number) => {
      const dayNumber = day?.day_number || dayIndex + 1;
      const dateLabel = formatDayLabel(dayNumber, dayIndex);
      const slots = Array.isArray(day?.slots) ? day.slots : [];
      slots.forEach((slot: any) => {
        flat.push({
          dayNumber,
          dateLabel,
          startTime: slot?.start_time,
          endTime: slot?.end_time,
          label: slot?.label || 'Session',
        });
      });
    });

    return flat
      .sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        const aTime = a.startTime || '99:99';
        const bTime = b.startTime || '99:99';
        return aTime.localeCompare(bTime);
      })
      .slice(0, 6);
  };

  const scheduleHighlights = parseScheduleHighlights(event);
  const resolvedEnterpriseNames = (() => {
    const fromParticipants = enterprisesPreview
      .map((ent) => (ent.organization_name || ent.full_name || '').trim())
      .filter((name) => name.length > 0);

    if (fromParticipants.length > 0) {
      return Array.from(new Set(fromParticipants));
    }

    // Fallback: use stand names when enterprise participant list is empty.
    const fromStands = standPreview
      .map((s) => (s.organization_name || s.name || '').trim())
      .filter((name) => name.length > 0);

    return Array.from(new Set(fromStands));
  })();

  const totalSlots = (() => {
    const days = Array.isArray((event as any).schedule_days)
      ? ((event as any).schedule_days as Array<any>)
      : [];
    return days.reduce((sum, d) => sum + (Array.isArray(d?.slots) ? d.slots.length : 0), 0);
  })();

  return (
    <div className="pb-20">
      <EventDetailsHeader event={event} />

      <Container className="py-12">
        {wasEjectedFromLive && (
          <div className="mb-6 rounded-xl p-4 text-sm font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <p className="font-bold">Live Access Closed</p>
            <p className="mt-1">This event has ended, so you were moved out of the live area.</p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SectionTitle title="About this Event" align="left" className="mb-0" />
              <div className="flex items-center gap-3">
                {isApprovedVisitor && isPaidEvent && (
                  <Button size="sm" variant="outline" onClick={downloadReceipt} className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <Download size={16} /> Download Receipt
                  </Button>
                )}
                <Button size="sm" variant={favoriteId ? 'secondary' : 'outline'} onClick={toggleFavorite} className="gap-2">
                  <Heart className={`h-4 w-4 transition-all ${favoriteAnimating ? 'scale-125' : 'scale-100'} ${favoriteId ? 'fill-current' : ''}`} />
                  {favoriteId ? 'Favorited' : 'Add to favorites'}
                </Button>
              </div>
            </div>
            <section>
              <div className="mt-6 prose prose-indigo max-w-none text-muted-foreground">
                {event.description}
              </div>
            </section>

            <section>
              <SectionTitle title="Event Insights" align="left" className="mb-4" />
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 border rounded-xl bg-cyan-50/60 border-cyan-200">
                  <p className="text-xs uppercase tracking-wide text-cyan-700 font-semibold">Attending Enterprises</p>
                  <p className="text-2xl font-bold text-cyan-900 mt-1">{resolvedEnterpriseNames.length}</p>
                  <p className="text-sm text-cyan-800 mt-1">Companies ready to connect during the event.</p>
                </div>

                <div className="p-5 border rounded-xl bg-indigo-50/60 border-indigo-200">
                  <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">Schedule Sessions</p>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">{totalSlots}</p>
                  <p className="text-sm text-indigo-800 mt-1">Planned activities across the event timeline.</p>
                </div>

                <div className="p-5 border rounded-xl bg-emerald-50/70 border-emerald-200">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Experience Focus</p>
                  <p className="text-base font-semibold text-emerald-900 mt-1">
                    Networking, showcases, and live knowledge sessions
                  </p>
                  <p className="text-sm text-emerald-800 mt-1">Designed for discovery and real business conversations.</p>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle title="Who You Can Meet" align="left" className="mb-4" />
              <div className="mt-6 p-6 border rounded-xl bg-white">
                {resolvedEnterpriseNames.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(isApprovedVisitor ? resolvedEnterpriseNames : resolvedEnterpriseNames.slice(0, 6)).map((name, idx) => {
                      const key = `ent-name-${idx}-${name}`;
                      return (
                        <div key={key} className="px-3 py-2 rounded-lg border bg-zinc-50 text-sm text-zinc-700">
                          {name}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Enterprise lineup is being finalized. Check again soon for participating companies and stands.
                  </p>
                )}

                {!isApprovedVisitor && resolvedEnterpriseNames.length > 6 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    Register to unlock the full participant list and direct live access.
                  </p>
                )}
              </div>
            </section>

            <section>
              <SectionTitle title="Schedule Highlights" align="left" className="mb-4" />
              <div className="mt-6 p-6 border rounded-xl bg-white">
                {scheduleHighlights.length > 0 ? (
                  <div className="space-y-3">
                    {(isApprovedVisitor ? scheduleHighlights : scheduleHighlights.slice(0, 4)).map((slot, idx) => (
                      <div key={`${slot.dayNumber}-${slot.startTime}-${idx}`} className="rounded-lg border bg-zinc-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-zinc-900">{slot.label}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                            Day {slot.dayNumber}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600">
                          {slot.dateLabel ? `${slot.dateLabel} • ` : ''}
                          {slot.startTime || '--:--'}{slot.endTime ? ` - ${slot.endTime}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Full schedule details will appear here as soon as timeline slots are published.
                  </p>
                )}

                {!isApprovedVisitor && scheduleHighlights.length > 4 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    Register to unlock the complete schedule and all live sections.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <JoinEventCard
              eventId={id!}
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
