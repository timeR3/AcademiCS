import { NextResponse } from 'next/server';
import { registerUserService } from '@/server/services/auth.service';
import type { UserRole } from '@/types';

type RegisterPayload = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RegisterPayload;

    if (!payload.name || !payload.email || !payload.password || !payload.role) {
      return NextResponse.json({ error: 'Nombre, email, contraseña y rol son requeridos.' }, { status: 400 });
    }

    const result = await registerUserService({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo registrar el usuario.' }, { status: 400 });
  }
}
