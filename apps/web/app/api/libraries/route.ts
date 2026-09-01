import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserLibraries, createLibrary, getUserById } from '@/lib/db';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);

    const filters = {
      q: searchParams.get('q') || '',
      folderId: searchParams.get('folderId') || '',
      status: searchParams.get('status') || '',
      nichos: searchParams.get('nichos') || '',
      estrategias: searchParams.get('estrategias') || '',
      produtos: searchParams.get('produtos') || '',
      idiomas: searchParams.get('idiomas') || '',
      paises: searchParams.get('paises') || ''
    };

    // Verificar role directamente na BD (não depende do JWT ter role)
    const dbUser = await getUserById(user.userId);
    const isAdmin = dbUser?.role === 'admin';
    const showAll = isAdmin && searchParams.get('showAll') === 'true';
    console.log('📚 Buscando bibliotecas:', showAll ? 'TODAS (admin)' : `user ${user.userId}`);
    const libraries = await getUserLibraries(user.userId, filters, { showAll });
    console.log(`✅ Encontradas ${libraries.length} bibliotecas`);

    return NextResponse.json(libraries);
  } catch (error: any) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
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

    console.log('➕ Criando biblioteca:', body.name);

    const library = await createLibrary(user.userId, body);

    console.log('✅ Biblioteca criada com sucesso:', library);
    
    // Scraping via API Express (scraper corrigido: active + país BR/WW)
    if (library?.id) {
      const authHeader = request.headers.get('authorization');
      proxyToBackend(`/api/libraries/${library.id}/refresh`, {
        method: 'POST',
        authHeader,
      }).catch((error) => {
        console.error('❌ Erro no scraping automático (proxy):', library.id, error);
      });
    }
    
    return NextResponse.json({ success: true, library, scrapingStarted: true });
  } catch (error: any) {
    console.error('❌ Erro ao criar biblioteca:', error);
    
    if (error.message === 'Essa biblioteca já existe em sistema' || error.message.includes('já existe')) {
      return NextResponse.json(
        { error: 'Essa biblioteca já existe em sistema' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
