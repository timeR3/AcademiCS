import { NextResponse } from 'next/server';
import { fetchSourceFile } from '@/app/actions';

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await context.params;
    const data = await fetchSourceFile(fileId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo obtener el archivo de origen.')
        : 'No se pudo obtener el archivo de origen.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
