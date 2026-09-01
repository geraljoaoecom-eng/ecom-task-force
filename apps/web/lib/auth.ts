import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'TaskForce-JWT-Secret-2024-Super-Secure';

export interface AuthUser {
  userId: string;
  email: string;
  role?: string;
}

export function authenticateToken(request: NextRequest): AuthUser | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as AuthUser;
    return user;
  } catch (error) {
    return null;
  }
}

export function requireAuth(request: NextRequest): AuthUser {
  const user = authenticateToken(request);
  if (!user) {
    throw new Error('Token de acesso necessário');
  }
  return user;
}
