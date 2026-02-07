import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const chatApi = {
    getRooms: async (token: string) => {
        const response = await axios.get(`${API_URL}/chat/rooms`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getMessages: async (roomId: string, token: string, limit = 50, skip = 0) => {
        const response = await axios.get(`${API_URL}/chat/rooms/${roomId}/messages`, {
            params: { limit, skip },
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};
