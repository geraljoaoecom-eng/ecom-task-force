import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    // Status básico do sistema de scraping
    return NextResponse.json({
      status: 'active',
      message: 'Sistema de scraping ativo',
      lastCheck: new Date().toISOString(),
      user: user.userId
    });
  } catch (error: any) {
    console.error('Erro ao verificar status do scraping:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
