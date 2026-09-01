import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdHistory, getLibraryById } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request);
    const libraryId = params.id;
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '8', 10), 1), 30);

    if (!libraryId) {
      return NextResponse.json({ error: 'ID da biblioteca é obrigatório' }, { status: 400 });
    }

    const library = await getLibraryById(libraryId);
    if (!library) {
      return NextResponse.json({ error: 'Biblioteca não encontrada' }, { status: 404 });
    }

    const rows = await getAdHistory(libraryId, days);

    const formatted = rows.map((item: { date: Date; ads_count: number; library_id: string }) => ({
      date: item.date.toISOString(),
      adsCount: item.ads_count,
      libraryId: item.library_id,
    }));

    return NextResponse.json(formatted.reverse());
  } catch (error: unknown) {
    console.error('Erro ao buscar histórico de anúncios:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
