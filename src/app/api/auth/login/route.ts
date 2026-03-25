import { NextResponse } from 'next/server';
import { loginUserService } from '@/server/services/auth.service';

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;

    if (!payload.email || !payload.password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos.' }, { status: 400 });
    }

    const user = await loginUserService({
      email: payload.email,
      password: payload.password,
    });

    return NextResponse.json({ data: user }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo iniciar sesión.' }, { status: 401 });
  }
}
