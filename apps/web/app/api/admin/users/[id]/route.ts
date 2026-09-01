import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminMiddleware';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    await axios.delete(`${SUPABASE_URL}/rest/v1/users?id=eq.${params.id}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('Token')) {
      return NextResponse.json({ error: 'Token de autenticação inválido' }, { status: 401 });
    }
    if (error.message?.includes('administradores')) {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 });
    }
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
