import axios from 'axios';
import { RecommendationItem } from '../types/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: `${API_URL}/recommendations`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const recommendationsApi = {
    getUserRecs: (id: string) => api.get<RecommendationItem[]>(`/user/${id}`).then(res => res.data),
    getEventRecs: (id: string) => api.get<RecommendationItem[]>(`/events/${id}`).then(res => res.data),
    getEnterpriseRecs: (id: string) => api.get<RecommendationItem[]>(`/enterprise/${id}`).then(res => res.data),
};
