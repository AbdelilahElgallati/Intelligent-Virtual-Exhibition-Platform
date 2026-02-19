export interface Stand {
    id: string;
    event_id: string;
    organization_id: string;
    name: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    website_url?: string;
    tags?: string[];
    stand_type?: string;
    created_at: string;
}

export interface StandCreatePayload {
    name: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    website_url?: string;
    tags?: string[];
    stand_type?: string;
}

export interface StandUpdatePayload extends Partial<StandCreatePayload> {}