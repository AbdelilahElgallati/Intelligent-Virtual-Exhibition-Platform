import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: `${API_URL}/leads`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const leadsApi = {
    getStandLeads: (standId: string) => api.get(`/stand/${standId}`).then(res => res.data),
    trackInteraction: (data: { visitor_id: string, stand_id: string, interaction_type: string, metadata?: any }) =>
        api.post('/interactions', data).then(res => res.data),
    exportLeads: (standId: string) => api.get(`/export/${standId}`).then(res => res.data),
};
