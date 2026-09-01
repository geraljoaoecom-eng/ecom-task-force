import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Temporariamente retornando planos mockados até implementar Stripe
    const plans = [
      {
        id: 'basic',
        name: 'Básico',
        price: 29.90,
        stripe_price_id: 'price_basic',
        features: ['Até 5 bibliotecas', 'Suporte básico']
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 59.90,
        stripe_price_id: 'price_pro',
        features: ['Bibliotecas ilimitadas', 'Suporte prioritário', 'Relatórios avançados']
      }
    ];

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
