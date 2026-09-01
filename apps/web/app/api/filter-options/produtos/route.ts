import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const produtos = [
      'Produtos Físicos',
      'Infoprodutos',
      'Serviços',
      'Cursos Online',
      'E-books',
      'Software',
      'Apps',
      'Assinaturas',
      'Consultoria',
      'Treinamentos'
    ];

    return NextResponse.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
