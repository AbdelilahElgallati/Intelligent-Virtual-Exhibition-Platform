import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Event, ParticipantStatus } from '@/lib/api/types';
import Link from 'next/link';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
                {t('events.detail.joinCard.approved.noTimeline.message')}
                <span className="block mt-1 font-semibold">{t('events.detail.joinCard.approved.noTimeline.action')}</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">{t('events.detail.joinCard.approved.noTimeline.button')}</Button>
            </>
          );
        }

        if (lifecycle?.accessState === 'OPEN_SLOT_ACTIVE') {
          return (
            <>
              <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-4 text-sm font-medium">
                {t('events.detail.joinCard.approved.accessOpen.message')}
              </div>
              <Button asChild className="w-full h-12 text-lg">
                <Link href={`/events/${eventRef}/live`}>{t('events.detail.joinCard.approved.accessOpen.button')}</Link>
              </Button>
            </>
          );
        }

        if (lifecycle?.accessState === 'CLOSED_BEFORE_EVENT') {
          return (
            <>
              <div className="bg-cyan-50 text-cyan-700 p-4 rounded-lg mb-4 text-sm font-medium">
                {t('events.detail.joinCard.approved.closedBeforeEvent.message')}
                <span className="block mt-1 font-semibold">{formatTimeToStart(lifecycle.nextSlot?.start || null)}</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">{t('events.detail.joinCard.approved.closedBeforeEvent.button')}</Button>
            </>
          );
        }

        if (lifecycle?.accessState === 'CLOSED_BETWEEN_SLOTS') {
          return (
            <>
              <div className="bg-blue-50 text-blue-700 p-4 rounded-lg mb-4 text-sm font-medium">
                {t('events.detail.joinCard.approved.closedBetweenSlots.message')}
                <span className="block mt-1 font-semibold">{t('events.detail.joinCard.nextSlotIn', { time: formatTimeToStart(lifecycle.nextSlot?.start || null).replace('Starts in ', '') })}</span>
              </div>
              <Button disabled className="w-full h-12 text-lg">{t('events.detail.joinCard.approved.closedBetweenSlots.button')}</Button>
            </>
          );
        }

        return (
          <>
            <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">
              {t('events.detail.joinCard.approved.ended.message')}
            </div>
            <Button disabled variant="outline" className="w-full h-12 text-lg">{t('events.detail.joinCard.approved.ended.button')}</Button>
          </>
        );

      case 'PAYMENT_REQUIRED':
        if (lifecycle?.displayState === 'ENDED') {
          return (
            <>
              <div className="bg-slate-100 text-slate-700 p-4 rounded-lg mb-4 text-sm font-medium">{t('events.detail.joinCard.paymentRequired.ended.message')}</div>
              <Button disabled variant="outline" className="w-full h-12 text-lg">{t('events.detail.joinCard.paymentRequired.ended.button')}</Button>
            </>
          );
        }
        return (
          <>
              <div className="bg-orange-50 text-orange-700 p-4 rounded-lg mb-4 text-sm font-medium">
              {t('events.detail.joinCard.paymentRequired.active.message')}
              {event?.ticket_price != null && <span className="block mt-1 font-bold">{t('events.detail.joinCard.paymentRequired.active.ticketPrice', { price: event.ticket_price.toFixed(2), currency: 'MAD' })}</span>}
            </div>
            <Button asChild className="w-full h-12 text-lg"><Link href={`/events/${eventRef}/payment`}>{t('events.detail.joinCard.paymentRequired.active.button')}</Link></Button>
          </>
        );

      case 'PAYMENT_PENDING':
        return (
          <>
            <div className="bg-amber-50 text-amber-700 p-4 rounded-lg mb-4 text-sm font-medium">{t('events.detail.joinCard.paymentPending.message')}</div>
            <Button asChild className="w-full h-12 text-lg"><Link href={`/events/${eventRef}/payment`}>{t('events.detail.joinCard.paymentPending.button')}</Link></Button>
          </>
        );

      case 'PENDING':
      case 'REQUESTED':
        return (
          <>
            <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-4 text-sm font-medium">{t('events.detail.joinCard.pending.message')}</div>
            <Button disabled className="w-full h-12 text-lg">{t('events.detail.joinCard.pending.button')}</Button>
          </>
        );

      case 'REJECTED':
        return (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium">{t('events.detail.joinCard.rejected.message')}</div>
        );

      default:
        if (lifecycle?.displayState === 'ENDED') {
          return <Button disabled variant="outline" className="w-full h-12">{t('events.detail.joinCard.approved.ended.button')}</Button>;
        }
        return (
          <>
            <p className="text-muted-foreground mb-6">{t('events.detail.joinCard.notJoined.description')}</p>
            <Button onClick={onJoin} isLoading={loading} className="w-full h-12 text-lg">
              {event?.is_paid ? t('events.detail.joinCard.notJoined.buttonPaid') : t('events.detail.joinCard.notJoined.buttonFree')}
            </Button>
          </>
        );
    }
  };

  const getBadge = () => {
    if (isAccepted && lifecycle) {
      if (lifecycle.displayState === 'ENDED') return <Badge className="bg-slate-500">{t('events.detail.joinCard.badges.ended')}</Badge>;
      if (!lifecycle.hasScheduleSlots) return <Badge className="bg-amber-500 text-amber-900">{t('events.detail.joinCard.badges.timelinePending')}</Badge>;
      if (lifecycle.displayState === 'LIVE') return <Badge className="bg-emerald-500 text-white border-none">{t('events.detail.joinCard.badges.liveAccess')}</Badge>;
      if (lifecycle.displayState === 'IN_PROGRESS') return <Badge className="bg-blue-500 text-white border-none">{t('events.detail.joinCard.badges.inProgress')}</Badge>;
      return <Badge className="bg-cyan-500 text-white border-none">{t('events.detail.joinCard.badges.upcoming')}</Badge>;
    }

    switch (status) {
      case 'APPROVED': case 'GUEST_APPROVED': return <Badge className="bg-green-500">{t('events.detail.joinCard.badges.approved')}</Badge>;
      case 'PAYMENT_REQUIRED': return <Badge className="bg-orange-500 text-white">{t('events.detail.joinCard.badges.paymentRequired')}</Badge>;
      case 'PAYMENT_PENDING': return <Badge className="bg-amber-500 text-amber-900">{t('events.detail.joinCard.badges.paymentPending')}</Badge>;
      case 'PENDING': case 'REQUESTED': return <Badge className="bg-yellow-500 text-yellow-900">{t('events.detail.joinCard.badges.pending')}</Badge>;
      case 'REJECTED': return <Badge variant="destructive">{t('events.detail.joinCard.badges.rejected')}</Badge>;
      default: return <Badge variant="secondary">{t('events.detail.joinCard.badges.notJoined')}</Badge>;
    }
  };

  return (
    <Card className="sticky top-24">
      <CardHeader><div className="flex justify-between items-center"><CardTitle>{t('events.detail.joinCard.title')}</CardTitle>{getBadge()}</div></CardHeader>
      <CardContent>{renderContent()}</CardContent>
      <CardFooter className="text-[10px] text-muted-foreground border-t pt-4">{t('events.detail.joinCard.footer')}</CardFooter>
    </Card>
  );
};
