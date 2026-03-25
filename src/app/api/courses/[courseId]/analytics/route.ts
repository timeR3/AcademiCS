import { NextResponse } from 'next/server';
import { fetchCourseAnalytics } from '@/app/actions';

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await context.params;
    const data = await fetchCourseAnalytics(courseId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron obtener los análisis del curso.')
        : 'No se pudieron obtener los análisis del curso.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
