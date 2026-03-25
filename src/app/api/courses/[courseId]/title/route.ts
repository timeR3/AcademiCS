import { NextResponse } from 'next/server';
import { updateCourseTitleService } from '@/server/services/course.service';

type TitlePayload = {
  title?: string;
  categoryId?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId: courseIdParam } = await context.params;
    const courseId = Number(courseIdParam);
    const payload = (await request.json()) as TitlePayload;

    if (!payload.title) {
      return NextResponse.json({ error: 'El título es requerido.' }, { status: 400 });
    }

    const result = await updateCourseTitleService({
      courseId,
      title: payload.title,
      categoryId: payload.categoryId,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el curso.' }, { status: 400 });
  }
}
