/**
 * @fileOverview Flujo de generación de cuestionarios para profesores.
 *
 * - generateQuestionnaire - Una función que maneja el proceso de generación de cuestionarios.
 */

import {ai} from '../genkit';
import {openAI} from '@genkit-ai/compat-oai/openai';
import { GenerateQuestionnaireInput, GenerateQuestionnaireOutput } from '../../types';
export type { GenerateQuestionnaireInput, GenerateQuestionnaireOutput } from '../../types';
import { z } from 'zod/v3';


export async function generateQuestionnaire(
  input: GenerateQuestionnaireInput
): Promise<GenerateQuestionnaireOutput> {
  return generateQuestionnaireFlow(input);
}

// Prompt base que edita el usuario. No contiene variables de plantilla.
const defaultQuestionnairePrompt = `Eres un educador experto especializado en crear evaluaciones de alta calidad. Tu tarea es generar un cuestionario de opción múltiple basado en el contenido proporcionado.
  Cada pregunta debe:
  1. Ser clara, concisa y relevante para los conceptos clave del contenido.
  2. Tener 4 opciones de respuesta.
  3. Incluir una respuesta correcta y tres distractores plausibles pero incorrectos. Los distractores deben ser desafiantes y requerir una comprensión real del tema, no ser obviamente falsos.
  4. Cubrir una variedad de temas del contenido proporcionado.
  5. Indicar el índice de la respuesta correcta en el campo 'correctOptionIndex'.
  Formatea la salida como un array JSON de objetos, donde cada objeto representa una pregunta con los campos "text" (la pregunta), "options" (un array de 4 strings de opciones) y "correctOptionIndex" (el índice de la respuesta correcta).`;


const generateQuestionnaireFlow = ai.defineFlow(
  {
    name: 'generateQuestionnaireFlow',
    inputSchema: z.object({
      content: z.string(),
      numQuestions: z.number().int().min(1),
      customPrompt: z.string().optional(),
      aiModel: z.string().optional(),
    }),
    outputSchema: z.object({
      questionnaire: z.array(
        z.object({
          text: z.string(),
          options: z.array(z.string()).length(4),
          correctOptionIndex: z.number().int().min(0).max(3),
        })
      ),
    }),
  },
  async ({content, numQuestions, customPrompt, aiModel}: GenerateQuestionnaireInput) => {
    
    // 1. Usar el prompt personalizado del admin si existe, si no, el default.
    const basePrompt = customPrompt || defaultQuestionnairePrompt;

    // 2. Construir el prompt final que se enviará a la IA, combinando el prompt base con las directivas del sistema.
    const finalPrompt = `${basePrompt}

Genera un cuestionario con ${numQuestions} preguntas.

Contenido de referencia: 
\`\`\`
${content}
\`\`\`
`;

    // 3. Llamar a la IA con el prompt final y el contexto necesario para rellenar las variables.
    const {output} = await ai.generate({
        model: openAI.model(aiModel || 'gpt-4o-mini'),
        prompt: finalPrompt,
        output: {
            schema: z.object({
              questionnaire: z.array(
                z.object({
                  text: z.string(),
                  options: z.array(z.string()).length(4),
                  correctOptionIndex: z.number().int().min(0).max(3),
                })
              ),
            }),
        },
    });
    
    return output!;
  }
);
