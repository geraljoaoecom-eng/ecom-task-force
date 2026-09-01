import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const paises = [
      'Brasil',
      'Estados Unidos',
      'México',
      'Argentina',
      'Colômbia',
      'Peru',
      'Chile',
      'Espanha',
      'Portugal',
      'França',
      'Alemanha',
      'Itália',
      'Reino Unido',
      'Canadá',
      'Austrália'
    ];

    return NextResponse.json(paises);
  } catch (error) {
    console.error('Erro ao buscar países:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
