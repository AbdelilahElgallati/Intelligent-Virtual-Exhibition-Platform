import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

/**
 * Helper functions to call FastAPI backend directly.
 */

export async function createSalon(token: string, data: any) {
  const response = await api.post('/events', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function approveSalon(adminToken: string, salonId: string) {
  const response = await api.patch(`/admin/events/${salonId}/approve`, {}, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  return response.data;
}

export async function rejectSalon(adminToken: string, salonId: string, reason: string) {
  const response = await api.patch(`/admin/events/${salonId}/reject`, { reason }, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  return response.data;
}

export async function createStand(token: string, salonId: string, data: any) {
  const response = await api.post(`/events/${salonId}/stands`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function requestMeeting(visitorToken: string, standId: string, data: any) {
  const response = await api.post(`/stands/${standId}/meetings`, data, {
    headers: { Authorization: `Bearer ${visitorToken}` }
  });
  return response.data;
}

export async function acceptMeeting(exposantToken: string, meetingId: string) {
  const response = await api.patch(`/meetings/${meetingId}/accept`, {}, {
    headers: { Authorization: `Bearer ${exposantToken}` }
  });
  return response.data;
}

export async function getAnalytics(token: string, salonId: string) {
  const response = await api.get(`/analytics/events/${salonId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function createProduct(token: string, standId: string, data: any) {
  const response = await api.post(`/stands/${standId}/products`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

export async function createService(token: string, standId: string, data: any) {
  const response = await api.post(`/stands/${standId}/services`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}
