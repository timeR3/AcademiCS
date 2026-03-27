import { query } from '@/lib/db';
import type { Notification } from '@/types';
import type { RowDataPacket } from 'mysql2';

type NotificationRow = RowDataPacket & {
  id: number;
  title: string;
  description: string;
  link: string;
  is_read: number;
  created_at: Date;
};

export async function fetchUserNotificationsService(userId: string): Promise<Notification[]> {
  const sql = 'SELECT id, title, description, link, is_read, created_at FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 10';
  const [results] = await query(sql, [Number(userId)]) as [NotificationRow[], unknown];

  return results.map((notification) => ({
    id: notification.id.toString(),
    title: notification.title,
    description: notification.description,
    link: notification.link,
    isRead: !!notification.is_read,
    createdAt: notification.created_at.toISOString(),
  }));
}

export async function markUserNotificationsAsReadService(payload: { userId: string; notificationIds: string[] }): Promise<{ success: boolean }> {
  if (payload.notificationIds.length === 0) {
    return { success: true };
  }

  const placeholders = payload.notificationIds.map(() => '?').join(',');
  const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`;
  const params = [Number(payload.userId), ...payload.notificationIds.map(Number)];
  await query(sql, params);
  return { success: true };
}
