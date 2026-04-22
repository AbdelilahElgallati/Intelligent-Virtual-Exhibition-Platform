import React from 'react';
import { Notification } from '@/lib/api/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface NotificationsPanelProps {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
}) => {
  const { t } = useTranslation();
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const getNotificationId = (notification: Notification): string =>
    String((notification as Notification & { _id?: string }).id || (notification as Notification & { _id?: string })._id || '');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-lg">{t('dashboard.notifications.title')}</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8"
          disabled={unreadCount === 0 || loading}
          onClick={onMarkAllRead}
        >
          {t('dashboard.notifications.markAllRead')}
        </Button>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto p-0">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('dashboard.notifications.empty')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification, index) => (
              <div
                key={getNotificationId(notification) || index}
                className={`p-4 transition-colors ${
                  !notification.is_read ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-medium">{notification.message}</p>
                  {!notification.is_read && (
                    <button
                      onClick={() => onMarkRead(getNotificationId(notification))}
                      className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"
                      title={t('dashboard.notifications.markAsRead')}
                    />
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(notification.created_at)}
                  </span>
                  {!notification.is_read && (
                    <span className="text-[10px] text-primary font-medium">{t('dashboard.notifications.unread')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
