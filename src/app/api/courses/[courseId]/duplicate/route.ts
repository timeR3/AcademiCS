import { NextResponse } from 'next/server';
import { duplicateCourseService } from '@/server/services/course.service';

export async function POST(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await context.params;
    const result = await duplicateCourseService(courseId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo duplicar el curso.' }, { status: 400 });
  }
}
