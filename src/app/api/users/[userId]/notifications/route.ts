import { NextResponse } from 'next/server';
import { fetchUserNotificationsService } from '@/server/services/notification.service';

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const notifications = await fetchUserNotificationsService(userId);
    return NextResponse.json({ data: notifications }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo obtener las notificaciones.' }, { status: 400 });
  }
}
