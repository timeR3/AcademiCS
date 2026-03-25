import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { query } from '@/lib/db';

type GenerateQuestionnairePayload = {
  content?: string;
  numQuestions?: number;
};

async function fetchQuestionnaireSettings(): Promise<{ aiModel: string; prompt: string }> {
  const [rows]: any[] = await query('SELECT `key`, `value` FROM app_settings WHERE `key` IN ("aiModel", "adminQuestionnairePrompt")', []);
  const settings = rows.reduce((acc: Record<string, string>, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    aiModel: settings.aiModel || 'gemini-1.5-pro-latest',
    prompt:
      settings.adminQuestionnairePrompt ||
      'Genera un cuestionario de opción múltiple de alta calidad con 4 opciones por pregunta.',
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateQuestionnairePayload;
    if (!payload.content || !payload.content.trim()) {
      return NextResponse.json({ error: 'content is required.' }, { status: 400 });
    }

    const numQuestions = Math.max(1, Number(payload.numQuestions || 10));
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

    const { output } = await ai.generate({
      model: googleAI.model(settings.aiModel),
      system: settings.prompt,
      prompt:
        `Genera ${numQuestions} preguntas de opción múltiple en español.\n` +
        `Contenido base:\n${payload.content}`,
      output: { schema },
    });

    if (!output) {
      return NextResponse.json({ error: 'No se pudo generar el cuestionario.' }, { status: 400 });
    }

    return NextResponse.json({ data: output }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo generar el cuestionario.' }, { status: 400 });
  }
}
