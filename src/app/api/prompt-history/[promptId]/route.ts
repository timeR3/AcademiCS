import { NextResponse } from 'next/server';
import { deletePromptFromHistory } from '@/app/actions';

export async function DELETE(_request: Request, context: { params: Promise<{ promptId: string }> }) {
  try {
    const { promptId } = await context.params;
    const data = await deletePromptFromHistory(promptId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo eliminar el prompt.')
        : 'No se pudo eliminar el prompt.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
