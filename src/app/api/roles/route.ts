import { NextResponse } from 'next/server';
import { fetchAllRoles } from '@/app/actions';

export async function GET() {
  try {
    const data = await fetchAllRoles();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener roles.')
        : 'No se pudieron obtener roles.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
