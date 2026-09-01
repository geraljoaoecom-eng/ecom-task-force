import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const statusOptions = [
      { value: 'ativo', label: 'Ativo' },
      { value: 'inativo', label: 'Inativo' }
    ];

    return NextResponse.json(statusOptions);
  } catch (error) {
    console.error('Erro ao buscar opções de status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
