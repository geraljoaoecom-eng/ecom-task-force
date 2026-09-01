import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateFolder, deleteFolder } from '@/lib/supabase';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome da pasta é obrigatório' },
        { status: 400 }
      );
    }

    const folder = await updateFolder(params.id, user.userId, body.name.trim());

    return NextResponse.json({ success: true, folder });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar pasta:', error);
    
    if (error.message.includes('não encontrada')) {
      return NextResponse.json(
        { error: 'Pasta não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = requireAuth(request);

    await deleteFolder(params.id, user.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao deletar pasta:', error);
    
    if (error.message.includes('não encontrada')) {
      return NextResponse.json(
        { error: 'Pasta não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
