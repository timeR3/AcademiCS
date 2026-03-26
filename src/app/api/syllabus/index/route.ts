import { z } from 'zod/v3';
import { ai } from '../../../../ai/genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { query } from '../../../../lib/db';

type CreateSyllabusIndexPayload = {
  pdfDataUris?: string[];
  sourceFileIds?: string[];
  numModules?: number;
};

type StructuredContentItem = {
  title: string;
  content: string;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractNumericIndices(values: unknown[]): number[] {
  const indices = new Set<number>();
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      indices.add(value);
      continue;
    }
    if (typeof value === 'string') {
      const matches = value.match(/\d+/g) || [];
      for (const match of matches) {
        const parsed = Number(match);
        if (Number.isInteger(parsed) && parsed >= 0) {
          indices.add(parsed);
        }
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function pickRelevantIndices(title: string, items: StructuredContentItem[], maxItems = 6): number[] {
  if (items.length === 0) {
    return [];
  }
  const titleTokens = normalizeText(title)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !['modulo', 'fundamentos', 'tema', 'bloque', 'unidad'].includes(token));

  const scored = items
    .map((item, index) => {
      const source = normalizeText(`${item.title} ${item.content}`);
      const score = titleTokens.reduce((acc, token) => acc + (source.includes(token) ? 1 : 0), 0);
      return { index, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestByScore = scored.filter((entry) => entry.score > 0).map((entry) => entry.index);
  if (bestByScore.length > 0) {
    return bestByScore.slice(0, maxItems);
  }
  return items.map((_, index) => index).slice(0, Math.min(maxItems, items.length));
}

async function fetchSettings(): Promise<{ aiModel: string; adminSyllabusPrompt: string }> {
  const [rows]: any[] = await query('SELECT `key`, `value` FROM app_settings WHERE `key` IN ("aiModel", "adminSyllabusPrompt")', []);
  const settingsMap = rows.reduce((acc: Record<string, string>, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    aiModel: settingsMap.aiModel || 'gpt-4o-mini',
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
      return Response.json({ error: 'Debe proporcionar al menos una fuente.' }, { status: 400 });
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
      classificationMap: z.record(z.array(z.union([z.string(), z.number()]))),
    });

    const promptParts = allUris.map((url) => ({ media: { url } })) as Array<{ media: { url: string } } | { text: string }>;
    promptParts.push({
      text: payload.numModules && payload.numModules > 0
        ? `Genera exactamente ${payload.numModules + 1} módulos en total. El primero debe ser "Fundamentos".`
        : 'Define el número pedagógicamente óptimo de módulos y que el primero sea "Fundamentos".',
    });

    const generation = await ai.generate({
      model: openAI.model(aiModel),
      system:
        `${adminSyllabusPrompt}\n` +
        'Devuelve JSON con: moduleTitles, structuredContent, classificationMap. ' +
        'moduleTitles debe tener títulos semánticos, específicos y no genéricos como "Módulo 2". ' +
        'classificationMap debe mapear cada título de módulo a índices enteros de structuredContent. ' +
        'Cada módulo debe usar subconjuntos distintos de contenido para evitar repetición. ' +
        'Devuelve exclusivamente JSON válido, sin texto adicional.',
      prompt: promptParts,
    });

    const parsed = outputSchema.safeParse(JSON.parse(generation.text || '{}'));
    if (!parsed.success) {
      return Response.json({ error: 'No se pudo generar el índice del temario.' }, { status: 400 });
    }
    const output = parsed.data;

    const normalizedMap: Record<string, string[]> = {};
    for (const title of output.moduleTitles) {
      const rawIndices = output.classificationMap[title] || [];
      const parsedIndices = extractNumericIndices(rawIndices);
      const relevantFallback = pickRelevantIndices(title, output.structuredContent, 6);
      const finalIndices = parsedIndices.length > 0 ? parsedIndices : relevantFallback;
      normalizedMap[title] = finalIndices.map((value) => value.toString());
    }

    return Response.json(
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
    return Response.json({ error: error?.message || 'No se pudo generar el índice del temario.' }, { status: 400 });
  }
}
