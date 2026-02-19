import { User } from './user';

export interface Organization {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    created_at: string;
}

export interface OrganizerProfile extends User {
    organization?: Organization;
}

export interface StatCard {
    label: string;
    value: string | number;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
}
