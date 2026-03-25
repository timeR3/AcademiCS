import { NextResponse } from 'next/server';
import { deleteBadge } from '@/app/actions';

export async function DELETE(_request: Request, context: { params: Promise<{ badgeId: string }> }) {
  try {
    const { badgeId } = await context.params;
    const data = await deleteBadge(badgeId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo eliminar la insignia.')
        : 'No se pudo eliminar la insignia.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
