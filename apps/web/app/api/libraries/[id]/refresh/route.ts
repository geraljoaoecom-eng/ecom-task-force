import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request);
    const libraryId = params.id;

    if (!libraryId) {
      return NextResponse.json({ error: 'ID da biblioteca é obrigatório' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const backendRes = await proxyToBackend(`/api/libraries/${libraryId}/refresh`, {
      method: 'POST',
      authHeader,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro ao atualizar biblioteca (proxy):', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
