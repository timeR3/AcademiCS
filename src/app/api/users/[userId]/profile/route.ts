import { NextResponse } from 'next/server';
import { updateUserProfileService } from '@/server/services/auth.service';

type UpdateProfilePayload = {
  name?: string;
  password?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const payload = (await request.json()) as UpdateProfilePayload;
    const result = await updateUserProfileService({
      userId,
      name: payload.name,
      password: payload.password,
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el perfil.' }, { status: 400 });
  }
}
