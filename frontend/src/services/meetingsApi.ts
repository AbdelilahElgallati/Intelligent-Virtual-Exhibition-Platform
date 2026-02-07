import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const getAuthHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = axios.create({
    baseURL: `${API_URL}/meetings`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const meetingsApi = {
    requestMeeting: (data: any) => api.post('/', data).then(res => res.data),
    getMyMeetings: () => api.get('/my-meetings').then(res => res.data),
    getStandMeetings: (standId: string) => api.get(`/stand/${standId}`).then(res => res.data),
    updateMeetingStatus: (id: string, update: any) => api.patch(`/${id}`, update).then(res => res.data),
};
