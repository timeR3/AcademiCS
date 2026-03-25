import { NextResponse } from 'next/server';
import { generateSingleModuleSyllabusService } from '@/server/services/learning-path.service';

type GenerateModulePayload = {
  moduleTitle?: string;
  structuredContent?: unknown[];
  classificationMap?: Record<string, string[]>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateModulePayload;
    if (!payload.moduleTitle) {
      return NextResponse.json({ error: 'moduleTitle is required.' }, { status: 400 });
    }

    const result = await generateSingleModuleSyllabusService({
      moduleTitle: payload.moduleTitle,
      structuredContent: payload.structuredContent || [],
      classificationMap: payload.classificationMap || {},
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo generar el temario del módulo.' }, { status: 400 });
  }
}
