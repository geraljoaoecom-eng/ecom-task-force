import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserFolders, createFolder } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const folders = await getUserFolders(user.userId);
    
    return NextResponse.json(folders);
  } catch (error: any) {
    console.error('❌ Erro ao buscar pastas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome da pasta é obrigatório' },
        { status: 400 }
      );
    }

    const folder = await createFolder(user.userId, body.name.trim());

    return NextResponse.json({ success: true, folder });
  } catch (error: any) {
    console.error('❌ Erro ao criar pasta:', error);
    
    if (error.response?.status === 409 || error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Já existe uma pasta com este nome' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
