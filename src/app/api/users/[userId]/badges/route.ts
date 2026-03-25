import { NextResponse } from 'next/server';
import { fetchUserBadges } from '@/app/actions';

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const data = await fetchUserBadges(userId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener insignias.')
        : 'No se pudieron obtener insignias.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
