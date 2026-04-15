import type { OrganizerEvent, EventStatus } from '@/types/event';
import { getEventLifecycle } from '@/lib/eventLifecycle';

/** 
 * Gathers backend state + calendar reality. 
 * If backend says 'live' but schedule is over, returns 'closed'.
 */
export function getEffectiveWorkflowState(event: OrganizerEvent): EventStatus {
    if (event.state === 'live') {
        const lifecycle = getEventLifecycle(event as any);
        if (lifecycle.displayState === 'ENDED') return 'closed';
    }
    return event.state;
}

export type LiveWorkflowKind = 'upcoming' | 'between_slots' | 'session_live' | 'closed';

/**
 * When backend state is `live`, maps calendar reality to human-friendly labels.
 * Used primarily by Organizer/Admin dashboards.
 */
export function getLiveWorkflowLabel(event: OrganizerEvent): {
    label: string;
    kind: LiveWorkflowKind;
} | null {
    if (event.state !== 'live') return null;
    
    const lifecycle = getEventLifecycle(event as any);
    
    switch (lifecycle.displayState) {
        case 'LIVE':
            return { label: 'Live', kind: 'session_live' };
        case 'IN_PROGRESS':
            return { label: 'In progress', kind: 'between_slots' };
        case 'ENDED':
            return { label: 'Closed', kind: 'closed' };
        case 'UPCOMING':
            return { label: 'Upcoming', kind: 'upcoming' };
        default:
            return null;
    }
}
