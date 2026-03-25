import { NextResponse } from 'next/server';
import { addBibliographyItem } from '@/app/actions';

type AddBibliographyPayload = {
  courseId?: number;
  type?: 'file' | 'link';
  fileName?: string;
  dataUri?: string;
  url?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AddBibliographyPayload;

    if (!payload.courseId || !payload.type) {
      return NextResponse.json({ error: 'courseId y type son requeridos.' }, { status: 400 });
    }

    const data = await addBibliographyItem({
      courseId: payload.courseId,
      type: payload.type,
      fileName: payload.fileName,
      dataUri: payload.dataUri,
      url: payload.url,
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo agregar el ítem de bibliografía.')
        : 'No se pudo agregar el ítem de bibliografía.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
