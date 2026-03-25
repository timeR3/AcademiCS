import { NextResponse } from 'next/server';
import { deleteBibliographyItem, fetchBibliographyItem } from '@/app/actions';

export async function GET(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await context.params;
    const data = await fetchBibliographyItem(itemId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo obtener el archivo de bibliografía.')
        : 'No se pudo obtener el archivo de bibliografía.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await context.params;
    const data = await deleteBibliographyItem(itemId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo eliminar el ítem de bibliografía.')
        : 'No se pudo eliminar el ítem de bibliografía.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
