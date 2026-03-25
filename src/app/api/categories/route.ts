import { NextResponse } from 'next/server';
import { fetchAllCategories, createCategory, updateCategory } from '@/app/actions';
import type { CourseCategory } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyActiveParam = searchParams.get('onlyActive');
    const onlyActive = onlyActiveParam === 'true';
    const data = await fetchAllCategories({ onlyActive });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener categorías.')
        : 'No se pudieron obtener categorías.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateCategoryPayload = {
  name?: string;
};

type UpdateCategoryPayload = {
  id?: string;
  name?: string;
  status?: CourseCategory['status'];
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateCategoryPayload;
    if (!payload.name || !payload.name.trim()) {
      return NextResponse.json({ error: 'El nombre de la categoría es requerido.' }, { status: 400 });
    }
    const data = await createCategory(payload.name.trim());
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo crear la categoría.')
        : 'No se pudo crear la categoría.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as UpdateCategoryPayload;
    if (!payload.id) {
      return NextResponse.json({ error: 'El id de categoría es requerido.' }, { status: 400 });
    }
    const data = await updateCategory({
      id: payload.id,
      name: payload.name,
      status: payload.status,
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo actualizar la categoría.')
        : 'No se pudo actualizar la categoría.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
