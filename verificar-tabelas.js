const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function verificarTabelas() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 VERIFICANDO TABELAS NO SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  const tabelas = ['users', 'libraries', 'folders', 'pages', 'ad_history', 'filter_options'];

  for (const tabela of tabelas) {
    try {
      const response = await axios.get(
        `${SUPABASE_URL}/rest/v1/${tabela}?select=count`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      );

      const count = response.headers['content-range']?.split('/')[1] || '?';
      console.log(`✅ ${tabela.padEnd(20)} → ${count} registros`);
      
    } catch (error) {
      if (error.response?.status === 404 || error.response?.data?.code === '42P01') {
        console.log(`❌ ${tabela.padEnd(20)} → NÃO EXISTE`);
      } else {
        console.log(`⚠️  ${tabela.padEnd(20)} → Erro: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📍 LINKS DIRETOS PARA O SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('🌐 Dashboard Principal:');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx\n');

  console.log('📊 Table Editor (ver tabelas visualmente):');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/editor\n');

  console.log('👥 Tabela Users:');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/editor/users\n');

  console.log('💻 SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/sql/new\n');

  console.log('🗄️  Database (menu):');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/database/tables\n');

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('💡 DICA: Cole qualquer um desses links no navegador!\n');
}

verificarTabelas();

