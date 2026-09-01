import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminMiddleware';
import bcrypt from 'bcryptjs';
import { getAllUsers, getUserByEmail, createUser } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error: any) {
    if (error.message.includes('Token')) {
      return NextResponse.json({ error: 'Token de autenticação inválido' }, { status: 401 });
    }
    if (error.message.includes('administradores')) {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 });
    }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({ email, password: hashedPassword, name, role });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
