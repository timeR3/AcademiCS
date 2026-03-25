import { NextResponse } from 'next/server';
import { checkAiConfigStatus } from '@/app/actions';

export async function GET() {
  try {
    const data = await checkAiConfigStatus();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo verificar la configuración de IA.')
        : 'No se pudo verificar la configuración de IA.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
