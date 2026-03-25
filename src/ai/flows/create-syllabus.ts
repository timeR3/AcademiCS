import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { googleAI } from '@genkit-ai/googleai';
 
export const CreateSyllabusInputSchema = z.object({
  pdfHashes: z.array(z.string()).optional().default([]),
  fullTranscribedText: z.string().optional().default(''),
  aiModel: z.string().optional(),
  customSyllabusPrompt: z.string().optional(),
  numModules: z.number().int().min(1).optional(),
});
export type CreateSyllabusInput = z.infer<typeof CreateSyllabusInputSchema>;
 
const SyllabusSectionSchema = z.object({
    title: z.string(),
    content: z.string()
});
 
const LearningModuleSchema = z.object({
    title: z.string(),
    introduction: z.string(),
    syllabus: z.array(SyllabusSectionSchema),
});
 
export const CreateSyllabusOutputSchema = z.object({
  learningPath: z.array(LearningModuleSchema),
  promptSource: z.enum(['admin', 'file', 'code']),
});
export type CreateSyllabusOutput = z.infer<typeof CreateSyllabusOutputSchema>;
 
export async function createSyllabus(input: CreateSyllabusInput, abortSignal?: AbortSignal): Promise<CreateSyllabusOutput> {
  return createSyllabusFlow(input, {abortSignal});
}
 
export const extractTextPrompt = ai.definePrompt({
  name: 'extractTextPrompt',
  input: { schema: z.string() },
  output: { schema: z.string() },
  prompt: `{{media url=input}}`,
  system:
    'Extrae el texto completo y crudo del documento PDF proporcionado. No resumas, no expliques, no formatees. Solo extrae el texto.',
});
 
const createSyllabusFlow = ai.defineFlow(
  {
    name: 'createSyllabusFlow',
    inputSchema: CreateSyllabusInputSchema,
    outputSchema: CreateSyllabusOutputSchema,
  },
  async (input: CreateSyllabusInput) => {
    const { fullTranscribedText, aiModel, customSyllabusPrompt, numModules } = input;
    const promptSource: 'admin' | 'file' | 'code' = customSyllabusPrompt ? 'admin' : 'code';
    const moduleInstruction = numModules
      ? `Debes generar exactamente ${numModules} módulos.`
      : 'Debes generar el número de módulos pedagógicamente adecuado.';
    const systemPrompt =
      (customSyllabusPrompt?.trim() || 'Eres un diseñador instruccional experto en estructurar contenidos de cursos.') +
      `\n${moduleInstruction}`;
    const content = fullTranscribedText?.trim() || 'Sin contenido de referencia.';
    const { output } = await ai.generate({
      model: googleAI.model(aiModel || 'gemini-1.5-pro-latest'),
      system: systemPrompt,
      prompt: `Genera una ruta de aprendizaje completa a partir del siguiente contenido:\n\n${content}`,
      output: {
        schema: z.object({
          learningPath: z.array(LearningModuleSchema),
        }),
      },
    });
 
    if (!output) {
      throw new Error("La IA no generó una respuesta válida.");
    }
 
    return {
      learningPath: output.learningPath,
      promptSource,
    };
  }
);
