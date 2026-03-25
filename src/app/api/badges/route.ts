import { NextResponse } from 'next/server';
import { fetchAllBadges, saveBadge } from '@/app/actions';
import type { Badge } from '@/types';

type SaveBadgePayload = Omit<Badge, 'id'> & { id?: string };

export async function GET() {
  try {
    const data = await fetchAllBadges();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener las insignias.')
        : 'No se pudieron obtener las insignias.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SaveBadgePayload;
    const data = await saveBadge(payload);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo guardar la insignia.')
        : 'No se pudo guardar la insignia.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
