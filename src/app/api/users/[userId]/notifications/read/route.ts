import { NextResponse } from 'next/server';
import { markUserNotificationsAsReadService } from '@/server/services/notification.service';

type MarkAsReadPayload = {
  notificationIds?: string[];
};

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const payload = (await request.json()) as MarkAsReadPayload;
    const result = await markUserNotificationsAsReadService({
      userId,
      notificationIds: payload.notificationIds || [],
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo marcar las notificaciones como leídas.' }, { status: 400 });
  }
}
