import { NextResponse } from 'next/server';
import { fetchPromptHistory } from '@/app/actions';

export async function GET() {
  try {
    const data = await fetchPromptHistory();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo obtener el historial de prompts.')
        : 'No se pudo obtener el historial de prompts.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
