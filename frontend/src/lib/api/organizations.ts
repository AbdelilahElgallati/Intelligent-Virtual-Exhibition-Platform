import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { OrganizationRead } from '@/types/organization';

export const organizationsApi = {
    /** Get all organizations */
    listOrganizations: () =>
        apiClient.get<OrganizationRead[]>(ENDPOINTS.ORGANIZATIONS.LIST),

    /** Get a single organization by ID */
    getOrganizationById: (id: string) =>
        apiClient.get<OrganizationRead>(ENDPOINTS.ORGANIZATIONS.GET(id)),

    /** Create a new organization */
    createOrganization: (data: any) =>
        apiClient.post<OrganizationRead>(ENDPOINTS.ORGANIZATIONS.CREATE, data),
};
