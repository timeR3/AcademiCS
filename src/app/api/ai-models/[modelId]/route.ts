import { NextResponse } from 'next/server';
import { deleteAiModel } from '@/app/actions';

export async function DELETE(_request: Request, context: { params: Promise<{ modelId: string }> }) {
  try {
    const { modelId } = await context.params;
    const data = await deleteAiModel(modelId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo eliminar el modelo.')
        : 'No se pudo eliminar el modelo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
