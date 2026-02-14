'use client';

import React, { useEffect, useState } from 'react';
import { JoinedEvents } from '@/components/dashboard/JoinedEvents';
import { RecommendedEvents } from '@/components/dashboard/RecommendedEvents';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Event, Recommendation, Notification, EventsResponse } from '@/lib/api/types';
import { SectionTitle } from '@/components/common/SectionTitle';
import { Container } from '@/components/common/Container';

export default function VisitorDashboard() {
  const [joinedEvents, setJoinedEvents] = useState<Event[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState({
    events: true,
    recommendations: true,
    notifications: true,
  });

  const fetchJoinedEvents = async () => {
    try {
      const data = await apiClient.get<EventsResponse>(ENDPOINTS.EVENTS.JOINED);
      setJoinedEvents(data.events);
    } catch (error) {
      console.error('Failed to fetch joined events:', error);
    } finally {
      setLoading((prev) => ({ ...prev, events: false }));
    }
  };

  const fetchRecommendations = async () => {
    try {
      const data = await apiClient.get<Recommendation[]>(ENDPOINTS.RECOMMENDATIONS.EVENTS);
      setRecommendations(data);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading((prev) => ({ ...prev, recommendations: false }));
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiClient.get<Notification[]>(ENDPOINTS.NOTIFICATIONS.LIST);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading((prev) => ({ ...prev, notifications: false }));
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  useEffect(() => {
    fetchJoinedEvents();
    fetchRecommendations();
    fetchNotifications();
  }, []);

  return (
    <Container className="py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div>
            <SectionTitle title="My Joined Events" subtitle="Events you are participating in" align="left" />
            <div className="mt-6">
              <JoinedEvents events={joinedEvents} loading={loading.events} />
            </div>
          </div>

          <div>
            <SectionTitle title="Recommended for You" subtitle="Events based on your interests" align="left" />
            <div className="mt-6">
              <RecommendedEvents recommendations={recommendations} loading={loading.recommendations} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 h-[calc(100vh-120px)] sticky top-24">
          <NotificationsPanel
            notifications={notifications}
            loading={loading.notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      </div>
    </Container>
  );
}
