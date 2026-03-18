

'use server';

/**
 * @fileOverview Herramienta de generación de rutas de aprendizaje por IA.
 * Arquitectura Robusta de 3 Fases para Calidad y Velocidad.
 *
 * 1.  **Fase 1 (Bibliotecario):** `createSyllabusFlow`. Lee los títulos de sección de los documentos y propone un índice de módulos temáticos. Es una llamada muy rápida.
 * 2.  **Fase 2 (Clasificador):** `classifySectionsFlow`. Mapea cada sección del documento original a uno de los módulos propuestos en la Fase 1. También es muy rápido.
 * 3.  **Fase 3 (Arquitecto Enfocado):** `generateSingleModuleSyllabusFlow`. Para cada módulo temático, recibe ÚNICAMENTE el contenido pre-clasificado y lo sintetiza. Para el módulo "Fundamentos", recibe TODO el contenido para una visión global. Es rápido y preciso.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import fs from 'fs';
import path from 'path';
import { fetchTranscript, saveTranscript } from '@/app/actions';
import { createHash } from 'crypto';

// This input is now used by the main `createSyllabusFlow`. 
// It expects the full text to be provided, not just hashes.
const CreateSyllabusInputSchema = z.object({
  pdfHashes: z.array(z.string()).describe(
    "Un array de hashes SHA-256 que identifican las transcripciones de los archivos a utilizar."
  ),
  fullTranscribedText: z.string().describe("El texto completo y combinado de todas las fuentes."),
  aiModel: z.string().optional().describe('El modelo de IA a utilizar para la generación.'),
  customSyllabusPrompt: z.string().optional().describe('Un prompt de sistema personalizado para guiar la generación del temario.'),
  numModules: z.number().optional().describe('El número de módulos a generar.'),
});
export type CreateSyllabusInput = z.infer<typeof CreateSyllabusInputSchema>;

const SyllabusSectionSchema = z.object({
    title: z.string().describe('El título de este tema o sub-sección del temario.'),
    content: z.string().describe('El contenido detallado y completo para este tema, extraído y explicado a partir de los documentos o el video.')
});

const LearningModuleSchema = z.object({
    title: z.string().describe('El título de este módulo o hito de aprendizaje (Ej: "Módulo 1: Introducción a React").'),
    introduction: z.string().describe('Un párrafo introductorio que resume los objetivos y el contenido que se cubrirá en este módulo.'),
    syllabus: z.array(SyllabusSectionSchema).describe('Un array de secciones que componen el temario detallado de este módulo.'),
});

const CreateSyllabusOutputSchema = z.object({
  learningPath: z.array(LearningModuleSchema).describe('Una ruta de aprendizaje compuesta por varios módulos. Cada módulo contiene su propio temario detallado.'),
  promptSource: z.enum(['admin', 'file', 'code']).describe('La fuente del prompt utilizado para la generación.'),
});
export type CreateSyllabusOutput = z.infer<typeof CreateSyllabusOutputSchema>;

export async function createSyllabus(input: CreateSyllabusInput, abortSignal?: AbortSignal): Promise<CreateSyllabusOutput> {
  // This is the main entry point for the flow.
  return createSyllabusFlow(input, {abortSignal});
}

export const extractTextPrompt = ai.definePrompt({
  name: 'extractTextPrompt',
  input: { schema: z.string().describe("PDF como URI de datos") },
  output: { schema: z.string() },
  prompt: `{{media url=input}}`,
  system:
    'Extrae el texto completo y crudo del documento PDF proporcionado. No resumas, no expliques, no formatees. Solo extrae el texto.',
});

// This flow is now simplified. It no longer handles transcription.
// It just takes the transcribed text and generates the syllabus.
const createSyllabusFlow = ai.defineFlow(
  {
    name: 'createSyllabusFlow',
    inputSchema: CreateSyllabusInputSchema,
    outputSchema: CreateSyllabusOutputSchema,
  },
  async ({pdfHashes, fullTranscribedText, aiModel, customSyllabusPrompt, numModules}, streamingCallback, context) => {
    
    let defaultSyllabusPrompt = '';
    let promptSource: 'admin' | 'file' | 'code' = 'code'; 
    if (input.customSyllabusPrompt) {
        promptSource = 'admin';
    } else {
        try {
            const promptFilePath = path.join(process.cwd(), 'prompt_codigo.txt');
            if (fs.existsSync(promptFilePath)) {
                promptSource = 'file';
            }
        } catch (error) {}
    }
    
    let moduleInstruction = '';
    if (input.numModules && input.numModules > 0) {
        moduleInstruction = `Debes agrupar estos títulos en exactamente ${input.numModules + 1} módulos en total. El primero siempre debe ser "Fundamentos", seguido de ${input.numModules} módulos temáticos.`;
    } else {
        moduleInstruction = `**REQUERIMIENTO ADICIONAL:** El número de módulos debe ser el que consideres pedagógicamente óptimo según la densidad y extensión del contenido.`;
    }
    systemPrompt = `${systemPrompt}\n\n${moduleInstruction}`;

    // Esta parte también se simplificará. El flujo recibirá un único bloque de texto.
    const fullTranscribedText = "El contenido será proporcionado por la acción que llama a este flujo.";

    const { output } = await ai.generate({
        model: googleAI.model(aiModel || 'gemini-1.5-pro-latest'),
        system: systemPrompt,
        prompt: [{ text: fullTranscribedText }], // Enviamos el texto combinado
        output: {
            schema: z.object({
              learningPath: z.array(LearningModuleSchema),
            })
        },
        flowContext: context,
    });
    
    if (!output) {
      throw new Error("La IA no generó una respuesta válida.");
    }
    
    const parsedOutput = phase1OutputSchema.parse(output);

    if (!parsedOutput.moduleTitles) {
      throw new Error("La IA no generó una lista de títulos de módulos válida.");
    }

    return {
        learningPath: output.learningPath,
        promptSource: promptSource,
    };
    // ---- FIN: Lógica temporal ----
  }
);

    
