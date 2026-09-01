const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function verificarColunaRole() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 VERIFICANDO SE A COLUNA "role" JÁ EXISTE');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Tentar buscar a coluna role
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name,role&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ COLUNA "role" JÁ EXISTE!');
    console.log('📊 Estrutura da tabela users:');
    console.log('   - id ✅');
    console.log('   - email ✅');
    console.log('   - name ✅');
    console.log('   - role ✅');
    
    // Verificar se tem dados
    const fullResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name,role`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`\n📋 Usuários encontrados: ${fullResponse.data.length}`);
    
    fullResponse.data.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} → Role: ${user.role || 'NULL'}`);
    });

    console.log('\n🎯 STATUS: Sistema admin PRONTO para usar!');
    
  } catch (error) {
    if (error.response?.data?.code === '42703') {
      console.log('❌ COLUNA "role" NÃO EXISTE AINDA');
      console.log('\n🔧 AÇÃO NECESSÁRIA:');
      console.log('1. Abra o SQL Editor no Supabase');
      console.log('2. Cole este SQL:');
      console.log('   ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT \'user\';');
      console.log('3. Clique em RUN ▶️');
      console.log('\n🌐 Link direto: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/sql/new');
    } else {
      console.log('⚠️ Erro ao verificar:', error.response?.data?.message || error.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

verificarColunaRole();
