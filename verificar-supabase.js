const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function verificarSupabase() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 VERIFICANDO CONEXÃO COM SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📡 URL do Supabase:');
  console.log(`   ${SUPABASE_URL}\n`);

  console.log('🔑 Tipo de Key:');
  console.log(`   Service Role Key (completo acesso)\n`);

  try {
    // Testar conexão
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    });

    const count = response.headers['content-range']?.split('/')[1] || 'desconhecido';

    console.log('✅ CONEXÃO ATIVA COM SUPABASE!\n');
    console.log('📊 Dados acessíveis:');
    console.log(`   - ${count} usuários na tabela users`);
    console.log('   - Acesso total ao banco de dados');
    console.log('   - Service Role Key válida\n');

    console.log('🌐 Projeto Supabase:');
    console.log('   - Ref: kpnhedyyxgodfgzqggdx');
    console.log('   - URL: https://kpnhedyyxgodfgzqggdx.supabase.co');
    console.log('   - Dashboard: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ CONFIRMADO: SISTEMA USA SUPABASE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('💡 Para adicionar a coluna "role":');
    console.log('   1. Acesse o dashboard: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx');
    console.log('   2. Clique em "SQL Editor" no menu lateral');
    console.log('   3. Execute: ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT \'user\';\n');

  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error.response?.data || error.message);
    console.log('\n⚠️ O sistema pode não estar conectado ao Supabase corretamente.\n');
  }
}

verificarSupabase();

