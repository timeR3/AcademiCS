import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

type SaveQuestionnairePayload = {
  questionnaire?: Array<{
    text: string;
    options: string[];
    correctOptionIndex: number;
  }>;
  questionsToDisplay?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ moduleId: string }> }) {
  const connection = await getPool().getConnection();
  try {
    const { moduleId: moduleIdParam } = await context.params;
    const payload = (await request.json()) as SaveQuestionnairePayload;
    const moduleId = Number(moduleIdParam);
    const questionnaire = payload.questionnaire || [];
    const questionsToDisplay = Number(payload.questionsToDisplay || 10);

    await connection.beginTransaction();
    await connection.query('DELETE FROM module_questions WHERE module_id = ?', [moduleId]);
    await connection.query('UPDATE course_modules SET questions_to_display = ? WHERE id = ?', [questionsToDisplay, moduleId]);

    if (questionnaire.length > 0) {
      const values = questionnaire.map((question) => [
        moduleId,
        question.text,
        JSON.stringify(question.options),
        question.correctOptionIndex,
      ]);
      await connection.query(
        'INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el cuestionario.' }, { status: 400 });
  } finally {
    connection.release();
  }
}
