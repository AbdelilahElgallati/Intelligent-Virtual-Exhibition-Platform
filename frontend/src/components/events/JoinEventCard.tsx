import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ParticipantStatus } from '@/lib/api/types';
import Link from 'next/link';

interface JoinEventCardProps {
  status: ParticipantStatus;
  onJoin: () => void;
  loading: boolean;
  eventId: string;
}

export const JoinEventCard: React.FC<JoinEventCardProps> = ({
  status,
  onJoin,
  loading,
  eventId,
}) => {
  const renderContent = () => {
    switch (status) {
      case 'APPROVED':
        return (
          <>
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-4 text-sm font-medium">
              Your registration is approved! You can now access the event.
            </div>
            <Button asChild className="w-full h-12 text-lg">
              <Link href={`/events/${eventId}/live`}>Enter Event</Link>
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
        return (
          <>
            <p className="text-muted-foreground mb-6">
              Join this event to access stands, schedule, and resources.
            </p>
            <Button
              onClick={onJoin}
              isLoading={loading}
              className="w-full h-12 text-lg"
            >
              Register Now
            </Button>
          </>
        );
    }
  };

  const getBadge = () => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-500">APPROVED</Badge>;
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
