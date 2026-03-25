import { NextResponse } from 'next/server';
import { enrollStudents } from '@/app/actions';
import type { StudentEnrollment } from '@/types';

type EnrollStudentsPayload = {
  studentEnrollments?: StudentEnrollment[];
  notify?: boolean;
};

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = (await request.json()) as EnrollStudentsPayload;
    const { courseId } = await context.params;
    const numericCourseId = Number(courseId);

    if (Number.isNaN(numericCourseId)) {
      return NextResponse.json({ error: 'El courseId es inválido.' }, { status: 400 });
    }

    const data = await enrollStudents({
      courseId: numericCourseId,
      studentEnrollments: payload.studentEnrollments || [],
      notify: Boolean(payload.notify),
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudieron guardar los estudiantes.')
        : 'No se pudieron guardar los estudiantes.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
