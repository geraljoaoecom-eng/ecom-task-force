import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const nichos = [
      'Saúde',
      'Beleza',
      'Fitness',
      'Moda',
      'Eletrônicos',
      'Casa e Jardim',
      'Automóveis',
      'Viagens',
      'Alimentação',
      'Pet',
      'Tecnologia',
      'Educação',
      'Finanças',
      'Entretenimento',
      'Esportes'
    ];

    return NextResponse.json(nichos);
  } catch (error) {
    console.error('Erro ao buscar nichos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
