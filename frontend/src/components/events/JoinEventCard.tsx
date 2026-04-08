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
  eventSlug?: string;
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
  const eventRef = eventSlug || eventId;
  const lifecycle = event ? getEventLifecycle(event) : null;
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
              <Button disabled className="w-full h-12 text-lg">Waiting for Timeline</Button>
            </>
          );
        }

        if (lifecycle?.accessState === 'OPEN_SLOT_ACTIVE') {
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
        }

        if (lifecycle?.accessState === 'CLOSED_BEFORE_EVENT') {
          return (
            <>
              <div className="bg-cyan-50 text-cyan-700 p-4 rounded-lg mb-4 text-sm font-medium">
                You are approved. Event access opens when the timeline goes live.
                <span className="block mt-1 font-semibold">{formatTimeToStart(lifecycle.nextSlot?.start || null)}</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">Access Opens Soon</Button>
            </>
          );
        }

        if (lifecycle?.accessState === 'CLOSED_BETWEEN_SLOTS') {
          return (
            <>
              <div className="bg-blue-50 text-blue-700 p-4 rounded-lg mb-4 text-sm font-medium">
                Event is in progress. Live access opens at the next active slot.
                <span className="block mt-1 font-semibold">Next slot in {formatTimeToStart(lifecycle.nextSlot?.start || null).replace('Starts in ', '')}</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">Next Slot Soon</Button>
            </>
          );
        }

        return (
          <>
            <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">
              This event timeline has ended. Live access is now closed.
            </div>
            <Button disabled variant="outline" className="w-full h-12 text-lg">Event Ended</Button>
          </>
        );

      case 'PAYMENT_REQUIRED':
        if (lifecycle?.displayState === 'ENDED') {
          return (
            <>
              <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">This event has ended. New paid access is closed.</div>
              <Button disabled variant="outline" className="w-full h-12 text-lg">Event Ended</Button>
            </>
          );
        }
        return (
          <>
            <div className="bg-orange-50 text-orange-700 p-4 rounded-lg mb-4 text-sm font-medium">
              This event requires payment.
              {event?.ticket_price != null && <span className="block mt-1 font-bold">Ticket Price: {event.ticket_price.toFixed(2)} MAD</span>}
            </div>
            <Button asChild className="w-full h-12 text-lg"><Link href={`/events/${eventRef}/payment`}>Pay Now</Link></Button>
          </>
        );

      case 'PAYMENT_PENDING':
        return (
          <>
            <div className="bg-amber-50 text-amber-700 p-4 rounded-lg mb-4 text-sm font-medium">Your payment is being processed. You&apos;ll be granted access shortly.</div>
            <Button asChild className="w-full h-12 text-lg"><Link href={`/events/${eventRef}/payment`}>Check Status</Link></Button>
          </>
        );

      case 'PENDING':
      case 'REQUESTED':
        return (
          <>
            <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-4 text-sm font-medium">Your request is pending approval. You&apos;ll be notified once it&apos;s reviewed.</div>
            <Button disabled className="w-full h-12 text-lg">Pending Approval</Button>
          </>
        );

      case 'REJECTED':
        return (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium">Your request was not approved.</div>
        );

      default:
        if (lifecycle?.displayState === 'ENDED') {
          return <Button disabled variant="outline" className="w-full h-12">Event Ended</Button>;
        }
        return (
          <>
            <p className="text-muted-foreground mb-6">Join this event to access stands, schedule, and resources.</p>
            <Button onClick={onJoin} isLoading={loading} className="w-full h-12 text-lg">
              {event?.is_paid ? 'Register & Pay' : 'Register Now'}
            </Button>
          </>
        );
    }
  };

  const getBadge = () => {
    if (isAccepted && lifecycle) {
      if (lifecycle.displayState === 'ENDED') return <Badge className="bg-slate-500">ENDED</Badge>;
      if (!lifecycle.hasScheduleSlots) return <Badge className="bg-amber-500 text-amber-900">TIMELINE PENDING</Badge>;
      if (lifecycle.displayState === 'LIVE') return <Badge className="bg-emerald-500 text-white border-none">LIVE ACCESS</Badge>;
      if (lifecycle.displayState === 'IN_PROGRESS') return <Badge className="bg-blue-500 text-white border-none">IN PROGRESS</Badge>;
      return <Badge className="bg-cyan-500 text-white border-none">UPCOMING</Badge>;
    }

    switch (status) {
      case 'APPROVED': case 'GUEST_APPROVED': return <Badge className="bg-green-500">APPROVED</Badge>;
      case 'PAYMENT_REQUIRED': return <Badge className="bg-orange-500 text-white">PAYMENT REQUIRED</Badge>;
      case 'PAYMENT_PENDING': return <Badge className="bg-amber-500 text-amber-900">PAYMENT PENDING</Badge>;
      case 'PENDING': case 'REQUESTED': return <Badge className="bg-yellow-500 text-yellow-900">PENDING</Badge>;
      case 'REJECTED': return <Badge variant="destructive">REJECTED</Badge>;
      default: return <Badge variant="secondary">NOT JOINED</Badge>;
    }
  };

  return (
    <Card className="sticky top-24">
      <CardHeader><div className="flex justify-between items-center"><CardTitle>Participation</CardTitle>{getBadge()}</div></CardHeader>
      <CardContent>{renderContent()}</CardContent>
      <CardFooter className="text-[10px] text-muted-foreground border-t pt-4">By joining, you agree to the code of conduct.</CardFooter>
    </Card>
  );
};
