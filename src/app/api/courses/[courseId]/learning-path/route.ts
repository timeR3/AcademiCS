import { NextResponse } from 'next/server';
import { saveLearningPathService } from '@/server/services/learning-path.service';
import type { CourseLevel } from '@/types';

type SaveLearningPathPayload = {
  learningPath?: CourseLevel[];
  sourceFileHashes?: string[];
};

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await context.params;
    const payload = (await request.json()) as SaveLearningPathPayload;
    const result = await saveLearningPathService({
      courseId: Number(courseId),
      learningPath: payload.learningPath || [],
      sourceFileHashes: payload.sourceFileHashes || [],
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar la ruta de aprendizaje.' }, { status: 400 });
  }
}
