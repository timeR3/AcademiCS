import { NextResponse } from 'next/server';
import { fetchAllAiModels, saveAiModel } from '@/app/actions';
import type { AiModel } from '@/types';

type SaveAiModelPayload = Partial<AiModel>;

export async function GET() {
  try {
    const data = await fetchAllAiModels();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener los modelos.')
        : 'No se pudieron obtener los modelos.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SaveAiModelPayload;
    const data = await saveAiModel(payload);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo guardar el modelo.')
        : 'No se pudo guardar el modelo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
