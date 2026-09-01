import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    const authHeader = request.headers.get('authorization');
    const backendRes = await proxyToBackend('/api/libraries/refresh-all', {
      method: 'POST',
      authHeader,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro refresh-all (proxy):', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
