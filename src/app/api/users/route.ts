import { NextResponse } from 'next/server';
import { fetchAllUsers } from '@/app/actions';

export async function GET() {
  try {
    const data = await fetchAllUsers();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener usuarios.')
        : 'No se pudieron obtener usuarios.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
