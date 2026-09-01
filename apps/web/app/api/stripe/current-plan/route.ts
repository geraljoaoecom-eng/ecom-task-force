import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserCurrentPlan } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const plan = await getUserCurrentPlan(user.userId);
    return NextResponse.json({ plan });
  } catch (error: any) {
    if (error.message === 'Token de acesso necessário') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Erro ao buscar plano atual:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar plano atual' },
      { status: 500 }
    );
  }
}
