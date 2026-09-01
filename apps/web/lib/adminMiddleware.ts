import { NextRequest } from 'next/server';
import { getUserById } from '@/lib/db';

export async function requireAdmin(request: NextRequest): Promise<{ userId: string; email: string; role: string }> {
  let token = request.headers.get('authorization')?.split(' ')[1];

  if (!token) {
    const cookies = request.headers.get('cookie');
    if (cookies) {
      const authCookie = cookies.split(';').find((c) => c.trim().startsWith('auth-token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }
  }

  if (!token) {
    throw new Error('Token não fornecido');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token inválido');
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const userId = payload.userId;

  if (!userId) {
    throw new Error('userId não encontrado no token');
  }

  const user = await getUserById(userId);

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  if (user.role !== 'admin') {
    throw new Error('Acesso negado - apenas administradores');
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const user = await getUserById(userId);
    return user?.role === 'admin';
  } catch {
    return false;
  }
}
