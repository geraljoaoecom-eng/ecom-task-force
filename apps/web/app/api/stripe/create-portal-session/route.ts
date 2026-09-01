import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    // Temporariamente retornando erro até implementar Stripe
    return NextResponse.json(
      { error: 'Stripe não implementado ainda' },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('Erro ao criar sessão do portal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
