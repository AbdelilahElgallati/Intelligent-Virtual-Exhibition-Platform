import axios from 'axios';
import { Message } from '../types/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: `${API_URL}/assistant`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const ragApi = {
    query: (scope: string, query: string) => api.post(`/${scope}/query`, { query }),
    ingest: (scope: string, data: any) => api.post(`/${scope}/ingest`, data),
    getSession: (id: string) => api.get<any>(`/session/${id}`).then(res => res.data),
};
