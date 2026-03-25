import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { query } from '@/lib/db';

type CreateSyllabusIndexPayload = {
  pdfDataUris?: string[];
  sourceFileIds?: string[];
  numModules?: number;
};

async function fetchSettings(): Promise<{ aiModel: string; adminSyllabusPrompt: string }> {
  const [rows]: any[] = await query('SELECT `key`, `value` FROM app_settings WHERE `key` IN ("aiModel", "adminSyllabusPrompt")', []);
  const settingsMap = rows.reduce((acc: Record<string, string>, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    aiModel: settingsMap.aiModel || 'gemini-1.5-pro-latest',
    adminSyllabusPrompt:
      settingsMap.adminSyllabusPrompt ||
      'Eres un diseñador instruccional experto. Devuelve una propuesta de índice de módulos y clasificación de contenido.',
  };
}

async function fetchSourceFileUrisAndHashes(sourceFileIds: string[]): Promise<{ uris: string[]; hashes: string[] }> {
  if (sourceFileIds.length === 0) {
    return { uris: [], hashes: [] };
  }

  const [rows]: any[] = await query(
    `SELECT sf.file_content, sf.file_hash
     FROM shared_files sf
     JOIN course_source_files csf ON csf.shared_file_id = sf.id
     WHERE csf.id IN (?)`,
    [sourceFileIds]
  );

  const uris: string[] = [];
  const hashes: string[] = [];

  for (const row of rows) {
    const base64 = row.file_content?.toString('base64');
    if (base64) {
      uris.push(`data:application/pdf;base64,${base64}`);
    }
    if (row.file_hash) {
      hashes.push(row.file_hash);
    }
  }

  return { uris, hashes };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateSyllabusIndexPayload;
    const uploadedUris = payload.pdfDataUris || [];
    const sourceFileIds = payload.sourceFileIds || [];
    const { uris: existingUris, hashes: existingHashes } = await fetchSourceFileUrisAndHashes(sourceFileIds);
    const allUris = [...uploadedUris, ...existingUris];

    if (allUris.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos una fuente.' }, { status: 400 });
    }

    const { aiModel, adminSyllabusPrompt } = await fetchSettings();
    const outputSchema = z.object({
      moduleTitles: z.array(z.string().min(1)),
      structuredContent: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
        })
      ),
      classificationMap: z.record(z.array(z.string())),
    });

    const promptParts = allUris.map((url) => ({ media: { url } })) as Array<{ media: { url: string } } | { text: string }>;
    promptParts.push({
      text: payload.numModules && payload.numModules > 0
        ? `Genera exactamente ${payload.numModules + 1} módulos en total. El primero debe ser "Fundamentos".`
        : 'Define el número pedagógicamente óptimo de módulos y que el primero sea "Fundamentos".',
    });

    const { output } = await ai.generate({
      model: googleAI.model(aiModel),
      system:
        `${adminSyllabusPrompt}\n` +
        'Devuelve JSON con: moduleTitles, structuredContent, classificationMap. ' +
        'classificationMap debe mapear cada título de módulo a índices de structuredContent en string.',
      prompt: promptParts,
      output: { schema: outputSchema },
    });

    if (!output) {
      return NextResponse.json({ error: 'No se pudo generar el índice del temario.' }, { status: 400 });
    }

    const normalizedMap: Record<string, string[]> = {};
    for (const title of output.moduleTitles) {
      normalizedMap[title] = output.classificationMap[title] || [];
    }

    return NextResponse.json(
      {
        data: {
          moduleTitles: output.moduleTitles,
          structuredContent: output.structuredContent,
          classificationMap: normalizedMap,
          pdfHashes: existingHashes,
          promptSource: 'admin',
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo generar el índice del temario.' }, { status: 400 });
  }
}
