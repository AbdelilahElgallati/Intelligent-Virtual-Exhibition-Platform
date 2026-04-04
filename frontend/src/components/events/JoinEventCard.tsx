import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Event, ParticipantStatus } from '@/lib/api/types';
import Link from 'next/link';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';

interface JoinEventCardProps {
  status: ParticipantStatus;
  onJoin: () => void;
  loading: boolean;
  eventId: string;
  eventSlug?: string;   // URL-safe slug; falls back to eventId
  event?: Event | null;
}

export const JoinEventCard: React.FC<JoinEventCardProps> = ({
  status,
  onJoin,
  loading,
  eventId,
  eventSlug,
  event,
}) => {
  // Use slug when available so the URL shows a human-readable name, not an ObjectId
  const eventRef = eventSlug || eventId;
  const lifecycle = event ? getEventLifecycle(event) : null;
  const isBetweenSlots = !!(lifecycle && lifecycle.betweenSlots);
  const isAccepted = status === 'APPROVED' || status === 'GUEST_APPROVED';

  const renderContent = () => {
    switch (status) {
      case 'APPROVED':
      case 'GUEST_APPROVED':
        if (lifecycle && !lifecycle.hasScheduleSlots) {
          return (
            <>
              <div className="bg-amber-50 text-amber-700 p-4 rounded-lg mb-4 text-sm font-medium">
                Your registration is approved, but the event timeline is not published yet.
                <span className="block mt-1 font-semibold">Access will open when schedule slots are published.</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">
                Waiting for Timeline
              </Button>
            </>
          );
        }

        if (lifecycle?.status === 'upcoming') {
          return (
            <>
              <div className={`${isBetweenSlots ? 'bg-blue-50 text-blue-700' : 'bg-cyan-50 text-cyan-700'} p-4 rounded-lg mb-4 text-sm font-medium`}>
                {isBetweenSlots
                  ? 'Event timeline is in progress. Live access opens at the next active slot.'
                  : 'You are approved. Event access opens when the timeline goes live.'}
                <span className="block mt-1 font-semibold">
                  {isBetweenSlots
                    ? `Next slot ${formatTimeToStart(lifecycle.nextSlotStart || null).replace('Starts in ', 'in ')}`
                    : formatTimeToStart(lifecycle.nextSlotStart || null)}
                </span>
              </div>
              <Button disabled className="w-full h-12 text-lg">
                {isBetweenSlots ? 'Next Slot Soon' : 'Access Opens Soon'}
              </Button>
            </>
          );
        }

        if (lifecycle?.status === 'ended') {
          return (
            <>
              <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">
                This event timeline has ended. Live access is now closed.
              </div>
              <Button disabled variant="outline" className="w-full h-12 text-lg">
                Event Ended
              </Button>
            </>
          );
        }

        return (
          <>
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-4 text-sm font-medium">
              Your registration is approved. You can access the live event now.
            </div>
            <Button asChild className="w-full h-12 text-lg">
              <Link href={`/events/${eventRef}/live`}>Enter Event</Link>
            </Button>
          </>
        );
      case 'PAYMENT_REQUIRED':
        if (lifecycle?.status === 'ended') {
          return (
            <>
              <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">
                This event has ended. New paid access is closed.
              </div>
              <Button disabled variant="outline" className="w-full h-12 text-lg">
                Event Ended
              </Button>
            </>
          );
        }

        return (
          <>
            <div className="bg-orange-50 text-orange-700 p-4 rounded-lg mb-4 text-sm font-medium">
              This event requires payment.
              {event?.ticket_price != null && (
                <span className="block mt-1 font-bold">
                  Ticket Price: {event.ticket_price.toFixed(2)} MAD
                </span>
              )}
            </div>
            <Button asChild className="w-full h-12 text-lg">
              <Link href={`/events/${eventRef}/payment`}>Pay Now</Link>
            </Button>
          </>
        );
      case 'PAYMENT_PENDING':
        if (lifecycle?.status === 'ended') {
          return (
            <>
              <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">
                Payment review exists, but live access is closed because the event ended.
              </div>
              <Button disabled variant="outline" className="w-full h-12 text-lg">
                Event Ended
              </Button>
            </>
          );
        }

        return (
          <>
            <div className="bg-amber-50 text-amber-700 p-4 rounded-lg mb-4 text-sm font-medium">
              Your payment is being processed. You&apos;ll be granted access shortly.
            </div>
            <Button asChild className="w-full h-12 text-lg">
              <Link href={`/events/${eventRef}/payment`}>Check Payment Status</Link>
            </Button>
          </>
        );
      case 'PENDING':
      case 'REQUESTED':
        return (
          <>
            <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-4 text-sm font-medium">
              Your request is pending approval. You&apos;ll be notified once it&apos;s reviewed.
            </div>
            <Button disabled className="w-full h-12 text-lg">
              Pending Approval
            </Button>
          </>
        );
      case 'REJECTED':
        return (
          <>
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 text-sm font-medium">
              Your request was not approved for this event.
            </div>
            <Button variant="outline" className="w-full h-12 text-lg">
              Contact Organizer
            </Button>
          </>
        );
      default:
        if (lifecycle?.status === 'ended') {
          return (
            <>
              <p className="text-muted-foreground mb-6">
                This event timeline has ended. New registrations are closed.
              </p>
              <Button disabled variant="outline" className="w-full h-12 text-lg">
                Event Ended
              </Button>
            </>
          );
        }

        return (
          <>
            <p className="text-muted-foreground mb-6">
              Join this event to access stands, schedule, and resources.
              {event?.is_paid && event?.ticket_price != null && (
                <span className="block mt-2 text-sm font-semibold text-primary">
                  Ticket Price: {event.ticket_price.toFixed(2)} MAD
                </span>
              )}
            </p>
            <Button
              onClick={onJoin}
              isLoading={loading}
              className="w-full h-12 text-lg"
            >
              {event?.is_paid ? 'Register & Pay' : 'Register Now'}
            </Button>
          </>
        );
    }
  };

  const getBadge = () => {
    if (isAccepted && lifecycle) {
      if (lifecycle.status === 'ended') return <Badge className="bg-slate-500">ENDED</Badge>;
      if (!lifecycle.hasScheduleSlots) return <Badge className="bg-amber-500 text-amber-900">TIMELINE PENDING</Badge>;
      if (lifecycle.status === 'live') return <Badge className="bg-green-500">LIVE ACCESS</Badge>;
      if (isBetweenSlots) return <Badge className="bg-blue-500">IN PROGRESS</Badge>;
      if (lifecycle.status === 'upcoming') return <Badge className="bg-cyan-500">UPCOMING</Badge>;
      return <Badge className="bg-slate-500">ENDED</Badge>;
    }

    switch (status) {
      case 'APPROVED':
      case 'GUEST_APPROVED':
        return <Badge className="bg-green-500">APPROVED</Badge>;
      case 'PAYMENT_REQUIRED':
        return <Badge className="bg-orange-500 text-white">PAYMENT REQUIRED</Badge>;
      case 'PAYMENT_PENDING':
        return <Badge className="bg-amber-500 text-amber-900">PAYMENT PENDING</Badge>;
      case 'PENDING':
      case 'REQUESTED':
        return <Badge className="bg-yellow-500 text-yellow-900">PENDING</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">REJECTED</Badge>;
      default:
        return <Badge variant="secondary">NOT JOINED</Badge>;
    }
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Event Participation</CardTitle>
          {getBadge()}
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
      <CardFooter className="text-[10px] text-muted-foreground border-t pt-4">
        By joining, you agree to the event&apos;s code of conduct and privacy policy.
      </CardFooter>
    </Card>
  );
};
