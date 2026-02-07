import axios from 'axios';
import { TranslationResponse } from '../types/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: `${API_URL}/translation`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const translationApi = {
    translate: (text: string, targetLang: string, sourceLang?: string) =>
        api.post<TranslationResponse>('/translate', { text, target_lang: targetLang, source_lang: sourceLang }).then(res => res.data),
    detectLanguage: (text: string) =>
        api.post<{ language: string; confidence: number }>('/detect-language', { text }).then(res => res.data),
};
