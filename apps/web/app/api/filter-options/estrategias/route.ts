import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const estrategias = [
      'Marketing Digital',
      'E-commerce',
      'Dropshipping',
      'Affiliate Marketing',
      'Video Marketing',
      'Social Media',
      'Adwords',
      'Facebook Ads',
      'Instagram Marketing',
      'YouTube Marketing'
    ];

    return NextResponse.json(estrategias);
  } catch (error) {
    console.error('Erro ao buscar estratégias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
