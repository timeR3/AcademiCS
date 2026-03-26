import { z } from 'zod/v3';
import { ai } from '../../../../ai/genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { query } from '../../../../lib/db';

type GenerateQuestionnairePayload = {
  content?: string;
  numQuestions?: number;
  difficulty?: 'low' | 'medium' | 'high';
};

type QuestionDifficulty = 'low' | 'medium' | 'high';

const DIFFICULTY_SYSTEM_PROMPTS: Record<QuestionDifficulty, string> = {
  low: 'Genera preguntas de dificultad baja, centradas en definiciones, identificación de conceptos y comprensión básica.',
  medium: 'Genera preguntas de dificultad media, enfocadas en aplicación de conceptos y relaciones entre ideas.',
  high: 'Genera preguntas de dificultad alta, orientadas a análisis crítico, inferencia y resolución de casos.',
};

async function fetchQuestionnaireSettings(): Promise<{ aiModel: string }> {
  const [rows]: any[] = await query('SELECT `key`, `value` FROM app_settings WHERE `key` IN ("aiModel")', []);
  const settings = rows.reduce((acc: Record<string, string>, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    aiModel: settings.aiModel || 'gpt-4o-mini',
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateQuestionnairePayload;
    if (!payload.content || !payload.content.trim()) {
      return Response.json({ error: 'content is required.' }, { status: 400 });
    }

    const numQuestions = Math.max(1, Number(payload.numQuestions || 10));
    const difficulty: QuestionDifficulty = payload.difficulty === 'low' || payload.difficulty === 'high' ? payload.difficulty : 'medium';
    const settings = await fetchQuestionnaireSettings();

    const schema = z.object({
      questionnaire: z.array(
        z.object({
          text: z.string(),
          options: z.array(z.string()).length(4),
          correctOptionIndex: z.number().int().min(0).max(3),
        })
      ),
    });

    const generation = await ai.generate({
      model: openAI.model(settings.aiModel),
      system:
        'Eres un evaluador pedagógico estricto. Genera cuestionarios de opción múltiple en español. ' +
        'Cada pregunta debe tener exactamente 4 opciones y una única respuesta correcta. ' +
        `${DIFFICULTY_SYSTEM_PROMPTS[difficulty]}`,
      prompt:
        `Genera ${numQuestions} preguntas de opción múltiple.\n` +
        `Nivel de dificultad: ${difficulty}.\n` +
        `Contenido base:\n${payload.content}\n\n` +
        'Devuelve exclusivamente JSON válido con la forma { "questionnaire": [...] }, sin texto adicional.',
    });

    const parsed = schema.safeParse(JSON.parse(generation.text || '{}'));
    if (!parsed.success) {
      return Response.json({ error: 'No se pudo generar el cuestionario.' }, { status: 400 });
    }

    return Response.json({ data: parsed.data }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo generar el cuestionario.' }, { status: 400 });
  }
}
