import { NextResponse } from 'next/server';
import { fetchAppSettings, saveAppSettings } from '@/app/actions';
import type { AppSettings } from '@/types';

export async function GET() {
  try {
    const data = await fetchAppSettings();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo obtener la configuración.')
        : 'No se pudo obtener la configuración.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as Partial<AppSettings>;
    const data = await saveAppSettings(payload);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo guardar la configuración.')
        : 'No se pudo guardar la configuración.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
