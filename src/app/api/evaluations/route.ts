import { NextResponse } from 'next/server';
import { submitEvaluation } from '@/app/actions';

type SubmitEvaluationPayload = {
  studentId?: string;
  courseId?: number;
  moduleId?: number;
  score?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SubmitEvaluationPayload;
    if (!payload.studentId || typeof payload.courseId !== 'number' || typeof payload.moduleId !== 'number' || typeof payload.score !== 'number') {
      return NextResponse.json({ error: 'Payload inválido para evaluación.' }, { status: 400 });
    }
    const data = await submitEvaluation({
      studentId: payload.studentId,
      courseId: payload.courseId,
      moduleId: payload.moduleId,
      score: payload.score,
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo enviar la evaluación.')
        : 'No se pudo enviar la evaluación.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
