import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const getAuthHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = axios.create({
    baseURL: `${API_URL}/resources`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const resourcesApi = {
    uploadResource: (standId: string, title: string, type: string, file: File, description?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('type', type);
        if (description) formData.append('description', description);

        return api.post(`/upload?stand_id=${standId}&title=${title}&type=${type}${description ? `&description=${description}` : ''}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(res => res.data);
    },

    getStandCatalog: (standId: string) => api.get(`/stand/${standId}`).then(res => res.data),
    trackDownload: (resourceId: string) => api.get(`/${resourceId}/track`).then(res => res.data),
};
