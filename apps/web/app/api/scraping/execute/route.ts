import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminMiddleware';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const authHeader = request.headers.get('authorization');
    const backendRes = await proxyToBackend('/api/scraping/execute', {
      method: 'POST',
      authHeader,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    if (message.includes('Token')) {
      return NextResponse.json({ error: 'Token de autenticação inválido' }, { status: 401 });
    }
    if (message.includes('administradores')) {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 });
    }
    console.error('Erro ao executar scraping (proxy):', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
