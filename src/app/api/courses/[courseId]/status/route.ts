import { NextResponse } from 'next/server';
import { archiveCourseService, reactivateSuspendedCourseService, restoreCourseService, suspendCourseService } from '@/server/services/course.service';

type StatusAction = 'archive' | 'suspend' | 'reactivate' | 'restore';

type StatusPayload = {
  action?: StatusAction;
};

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await context.params;
    const payload = (await request.json()) as StatusPayload;

    if (!payload.action) {
      return NextResponse.json({ error: 'La acción es requerida.' }, { status: 400 });
    }

    if (payload.action === 'archive') {
      const result = await archiveCourseService(courseId);
      return NextResponse.json({ data: result }, { status: 200 });
    }

    if (payload.action === 'suspend') {
      const result = await suspendCourseService(courseId);
      return NextResponse.json({ data: result }, { status: 200 });
    }

    if (payload.action === 'reactivate') {
      const result = await reactivateSuspendedCourseService(courseId);
      return NextResponse.json({ data: result }, { status: 200 });
    }

    if (payload.action === 'restore') {
      const result = await restoreCourseService(courseId);
      return NextResponse.json({ data: result }, { status: 200 });
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el estado del curso.' }, { status: 400 });
  }
}
