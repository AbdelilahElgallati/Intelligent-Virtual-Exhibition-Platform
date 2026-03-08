export enum OrgMemberRole {
    OWNER = "owner",
    MANAGER = "manager",
    MEMBER = "member",
}

export interface OrganizationRead {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    created_at: string;
    is_verified: boolean;
    is_flagged: boolean;
    is_suspended: boolean;
    industry?: string;
    website?: string;
    logo_url?: string;
    contact_email?: string;
}

export interface OrganizationMember {
    user_id: string;
    organization_id: string;
    role_in_org: OrgMemberRole;
    joined_at: string;
}
