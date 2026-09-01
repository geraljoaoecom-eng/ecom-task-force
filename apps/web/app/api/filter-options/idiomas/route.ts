import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const idiomas = [
      'Português',
      'Inglês',
      'Espanhol',
      'Francês',
      'Italiano',
      'Alemão',
      'Russo',
      'Chinês',
      'Japonês',
      'Árabe'
    ];

    return NextResponse.json(idiomas);
  } catch (error) {
    console.error('Erro ao buscar idiomas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
