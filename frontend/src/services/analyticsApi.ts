import axios from 'axios';
import { AnalyticsData } from '../types/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: `${API_URL}/analytics`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const analyticsApi = {
    getStandMetrics: (id: string) => api.get<AnalyticsData>(`/stand/${id}`).then(res => res.data),
    getEventMetrics: (id: string) => api.get<AnalyticsData>(`/event/${id}`).then(res => res.data),
    getVisitorMetrics: (id: string) => api.get<AnalyticsData>(`/visitor/${id}`).then(res => res.data),
};
