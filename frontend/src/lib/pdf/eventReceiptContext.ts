import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';

export type EventReceiptContext = {
  eventTitle?: string;
  organizerName?: string;
  eventLocation?: string;
  eventTimezone?: string;
  category?: string;
  startDateLabel?: string;
  endDateLabel?: string;
};

export async function loadEventReceiptContext(eventId: string | undefined | null): Promise<EventReceiptContext | null> {
  if (!eventId) return null;
  try {
    const ev = await apiClient.get<any>(ENDPOINTS.EVENTS.GET(String(eventId)));
    const tz = getUserTimezone();
    return {
      eventTitle: ev?.title,
      organizerName: ev?.organizer_name,
      eventLocation: ev?.location,
      eventTimezone: ev?.event_timezone,
      category: ev?.category,
      startDateLabel: ev?.start_date ? formatInTZ(ev.start_date, tz, 'MMM d, yyyy h:mm a') : undefined,
      endDateLabel: ev?.end_date ? formatInTZ(ev.end_date, tz, 'MMM d, yyyy h:mm a') : undefined,
    };
  } catch {
    return null;
  }
}
