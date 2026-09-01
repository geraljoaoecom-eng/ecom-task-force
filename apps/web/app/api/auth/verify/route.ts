import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const userId = payload.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
