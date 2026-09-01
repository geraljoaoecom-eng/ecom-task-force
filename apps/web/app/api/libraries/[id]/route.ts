import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { deleteLibrary, updateLibrary } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(request);
    const libraryId = params.id;
    const body = await request.json();

    if (!libraryId) {
      return NextResponse.json(
        { error: 'ID da biblioteca é obrigatório' },
        { status: 400 }
      );
    }

    console.log('📝 Atualizando biblioteca:', libraryId, 'com dados:', body);

    const updatedLibrary = await updateLibrary(libraryId, user.userId, body);

    console.log('✅ Biblioteca atualizada com sucesso');
    return NextResponse.json({ success: true, library: updatedLibrary });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(request);
    const libraryId = params.id;

    if (!libraryId) {
      return NextResponse.json(
        { error: 'ID da biblioteca é obrigatório' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deletando biblioteca:', libraryId);

    await deleteLibrary(libraryId, user.userId);

    console.log('✅ Biblioteca deletada com sucesso');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao deletar biblioteca:', error);
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
