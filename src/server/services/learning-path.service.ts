import { ai } from '@/ai/genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { getPool, query } from '@/lib/db';
import type { CourseLevel, Question, SyllabusSection } from '@/types';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type AppSettingRow = RowDataPacket & { value: string };
type ModuleIdRow = RowDataPacket & { id: number };
type SharedFileRow = RowDataPacket & { id: number };

type GenerateSingleModuleSyllabusPayload = {
  moduleTitle: string;
  structuredContent: unknown[];
  classificationMap: Record<string, Array<string | number>>;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractNumericIndices(values: Array<string | number>): number[] {
  const result = new Set<number>();
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      result.add(value);
      continue;
    }
    if (typeof value === 'string') {
      const matches = value.match(/\d+/g) || [];
      for (const match of matches) {
        const parsed = Number(match);
        if (Number.isInteger(parsed) && parsed >= 0) {
          result.add(parsed);
        }
      }
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

function normalizeContentItem(item: unknown): string {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const fromContent = record.content;
    const fromText = record.text;
    const fromTitle = record.title;
    if (typeof fromContent === 'string') return fromContent;
    if (typeof fromText === 'string') return fromText;
    if (typeof fromTitle === 'string') return fromTitle;
  }
  return JSON.stringify(item);
}

function buildModuleInputText(payload: GenerateSingleModuleSyllabusPayload): string {
  const mappedIndices = payload.classificationMap[payload.moduleTitle] || [];
  const normalizedIndices = extractNumericIndices(mappedIndices);

  const titleTokens = normalizeText(payload.moduleTitle)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !['modulo', 'fundamentos', 'tema', 'bloque', 'unidad'].includes(token));

  const keywordMatchedIndices = payload.structuredContent
    .map((contentItem, indexValue) => {
      const sourceText = normalizeText(normalizeContentItem(contentItem));
      const score = titleTokens.reduce((acc, token) => acc + (sourceText.includes(token) ? 1 : 0), 0);
      return { indexValue, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.indexValue);

  const selectedContent = normalizedIndices.length > 0
    ? normalizedIndices
        .map((indexValue) => payload.structuredContent[indexValue])
        .filter((item) => typeof item !== 'undefined')
    : (keywordMatchedIndices.length > 0
        ? keywordMatchedIndices.slice(0, 6).map((indexValue) => payload.structuredContent[indexValue])
        : payload.structuredContent.slice(0, Math.min(6, payload.structuredContent.length)));

  return selectedContent.map((item, indexValue) => `Fuente ${indexValue + 1}:\n${normalizeContentItem(item)}`).join('\n\n');
}

async function fetchAiModelForSyllabus(): Promise<string> {
  const [rows] = await query('SELECT `value` FROM app_settings WHERE `key` = "aiModel" LIMIT 1', []) as [AppSettingRow[], unknown];
  return rows?.[0]?.value || 'gpt-4o-mini';
}

export async function saveLearningPathService(payload: { courseId: number; learningPath: CourseLevel[]; sourceFileHashes: string[] }): Promise<{ updatedLearningPath: CourseLevel[] }> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [modulesToDelete] = await connection.query<ModuleIdRow[]>('SELECT id FROM course_modules WHERE course_id = ?', [payload.courseId]);
    if (modulesToDelete.length > 0) {
      const moduleIdsToDelete = modulesToDelete.map((module) => module.id);
      await connection.query('DELETE FROM module_syllabus WHERE module_id IN (?)', [moduleIdsToDelete]);
      await connection.query('DELETE FROM module_questions WHERE module_id IN (?)', [moduleIdsToDelete]);
      await connection.query('DELETE FROM evaluation_submissions WHERE module_id IN (?)', [moduleIdsToDelete]);
      await connection.query('DELETE FROM course_modules WHERE id IN (?)', [moduleIdsToDelete]);
    }

    if (payload.sourceFileHashes.length > 0) {
      await connection.query('DELETE FROM course_source_files WHERE course_id = ?', [payload.courseId]);
      for (const hash of payload.sourceFileHashes) {
        const [sharedFileResult] = await connection.query<SharedFileRow[]>('SELECT id FROM shared_files WHERE file_hash = ?', [hash]);
        if (sharedFileResult.length > 0) {
          const sharedFileId = sharedFileResult[0].id;
          await connection.query('INSERT IGNORE INTO course_source_files (course_id, shared_file_id) VALUES (?, ?)', [payload.courseId, sharedFileId]);
        }
      }
    }

    const updatedLearningPath: CourseLevel[] = [];

    for (const [index, module] of payload.learningPath.entries()) {
      const moduleSql = 'INSERT INTO course_modules (course_id, title, introduction, module_order, questions_to_display) VALUES (?, ?, ?, ?, ?)';
      const [moduleResult] = await connection.query<ResultSetHeader>(moduleSql, [payload.courseId, module.title, module.introduction, index + 1, module.questionsToDisplay || 10]);
      const newModuleId = moduleResult.insertId;

      const newSyllabus: SyllabusSection[] = [];
      if (module.syllabus && module.syllabus.length > 0) {
        for (const section of module.syllabus) {
          const syllabusSql = 'INSERT INTO module_syllabus (module_id, title, content) VALUES (?, ?, ?)';
          const [syllabusResult] = await connection.query<ResultSetHeader>(syllabusSql, [newModuleId, section.title, section.content]);
          newSyllabus.push({
            ...section,
            id: syllabusResult.insertId.toString(),
          });
        }
      }

      const newQuestionnaire: Question[] = [];
      if (module.questionnaire && module.questionnaire.length > 0) {
        for (const question of module.questionnaire) {
          const questionSql = 'INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES (?, ?, ?, ?)';
          const params = [newModuleId, question.text, JSON.stringify(question.options), question.correctOptionIndex];
          const [questionResult] = await connection.query<ResultSetHeader>(questionSql, params);
          newQuestionnaire.push({
            ...question,
            id: questionResult.insertId.toString(),
          });
        }
      }

      updatedLearningPath.push({
        id: newModuleId.toString(),
        title: module.title,
        introduction: module.introduction,
        status: 'locked',
        syllabus: newSyllabus,
        questionnaire: newQuestionnaire,
        questionsToDisplay: module.questionsToDisplay || 10,
      });
    }

    await connection.commit();
    return { updatedLearningPath };
  } catch (_error) {
    await connection.rollback();
    throw new Error('No se pudo guardar la ruta de aprendizaje.');
  } finally {
    connection.release();
  }
}

export async function generateSingleModuleSyllabusService(payload: GenerateSingleModuleSyllabusPayload): Promise<{
  introduction: string;
  syllabus: { title: string; content: string }[];
  questionnaire: [];
  questionsToDisplay: number;
}> {
  const modelId = await fetchAiModelForSyllabus();
  const inputText = buildModuleInputText(payload);

  const schema = z.object({
    introduction: z.string(),
    syllabus: z.array(
      z.object({
        title: z.string(),
        content: z.string(),
      })
    ),
  });

  const { output } = await ai.generate({
    model: openAI.model(modelId),
    system: `Eres un experto diseñador instruccional. Genera el contenido del módulo solicitado en español, usando el material fuente solo como base de análisis. Sintetiza, estructura y redacta de forma original. Evita copiar texto literal del contenido fuente. Devuelve introducción y temario detallado.`,
    prompt: `Título del módulo: ${payload.moduleTitle}\n\nContenido fuente:\n${inputText}`,
    output: { schema },
  });

  if (!output) {
    throw new Error('No se pudo generar el temario del módulo.');
  }

  return {
    introduction: output.introduction,
    syllabus: output.syllabus,
    questionnaire: [],
    questionsToDisplay: 10,
  };
}
