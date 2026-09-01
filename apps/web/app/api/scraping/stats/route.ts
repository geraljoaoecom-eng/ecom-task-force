import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminMiddleware';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const librariesResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/libraries?select=id,active_ads,last_checked_at,created_at`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const libraries = librariesResponse.data || [];
    
    const stats = {
      totalLibraries: libraries.length,
      totalActiveAds: libraries.reduce((sum: number, lib: any) => sum + (lib.active_ads || 0), 0),
      lastChecked: libraries.length > 0 
        ? Math.max(...libraries.map((lib: any) => new Date(lib.last_checked_at || 0).getTime()))
        : null,
      librariesWithAds: libraries.filter((lib: any) => (lib.active_ads || 0) > 0).length,
      averageAdsPerLibrary: libraries.length > 0 
        ? Math.round(libraries.reduce((sum: number, lib: any) => sum + (lib.active_ads || 0), 0) / libraries.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.message?.includes('Token')) {
      return NextResponse.json({ error: 'Token de autenticação inválido' }, { status: 401 });
    }
    if (error.message?.includes('administradores')) {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 });
    }
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
