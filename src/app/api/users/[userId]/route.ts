import { NextResponse } from 'next/server';
import { updateUserByAdmin } from '@/app/actions';
import type { UserRole } from '@/types';

type UpdateUserPayload = {
  name?: string;
  email?: string;
  password?: string;
  roles?: UserRole[];
  status?: 'active' | 'inactive';
};

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const payload = (await request.json()) as UpdateUserPayload;
    const data = await updateUserByAdmin({
      userId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
      status: payload.status,
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'No se pudo actualizar el usuario.')
        : 'No se pudo actualizar el usuario.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
