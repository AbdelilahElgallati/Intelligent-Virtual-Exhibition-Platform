import type { OrganizerEvent, EventStatus } from '@/types/event';
import { getEventLifecycle } from '@/lib/eventLifecycle';

/** Workflow state with live→closed when the schedule has ended. */
export function getEffectiveWorkflowState(event: OrganizerEvent): EventStatus {
    if (event.state === 'live') {
        const lifecycle = getEventLifecycle(event as any);
        if (lifecycle.status === 'ended') return 'closed';
    }
    return event.state;
}

export type LiveWorkflowKind = 'upcoming' | 'between_slots' | 'session_live' | 'closed';

/**
 * When workflow state is `live`, maps calendar reality to Upcoming / In progress / Live / Closed.
 * Returns null when the event is not in workflow `live` (caller uses pipeline labels).
 */
export function getLiveWorkflowLabel(event: OrganizerEvent): {
    label: string;
    kind: LiveWorkflowKind;
} | null {
    if (event.state !== 'live') return null;
    const effective = getEffectiveWorkflowState(event);
    if (effective === 'closed') {
        return { label: 'Closed', kind: 'closed' };
    }
    const lifecycle = getEventLifecycle(event as any);
    if (lifecycle.status === 'live') {
        return { label: 'Live', kind: 'session_live' };
    }
    if (lifecycle.betweenSlots) {
        return { label: 'In progress', kind: 'between_slots' };
    }
    if (lifecycle.status === 'upcoming') {
        return { label: 'Upcoming', kind: 'upcoming' };
    }
    return { label: 'Live', kind: 'session_live' };
}
