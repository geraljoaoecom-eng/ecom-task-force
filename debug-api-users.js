const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function testarAPIUsers() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 TESTANDO API /api/users');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Testar diretamente a API do Supabase
    console.log('1️⃣ Testando Supabase diretamente...');
    const supabaseResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name,role,created_at,updated_at&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Supabase funcionando!');
    console.log(`📊 ${supabaseResponse.data.length} usuários encontrados:`);
    
    supabaseResponse.data.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role}) - ID: ${user.id}`);
    });

    // Testar a API local (se o servidor estiver rodando)
    console.log('\n2️⃣ Testando API local /api/users...');
    try {
      const localResponse = await axios.get('http://localhost:3000/api/users', {
        headers: {
          'Cookie': 'auth-token=test' // Token de teste
        }
      });
      
      console.log('✅ API local funcionando!');
      console.log(`📊 ${localResponse.data.length} usuários retornados pela API local`);
      
    } catch (localError) {
      console.log('❌ API local não está respondendo:');
      console.log(`   Erro: ${localError.message}`);
      
      if (localError.code === 'ECONNREFUSED') {
        console.log('💡 SOLUÇÃO: Inicie o servidor Next.js');
        console.log('   npm run dev (na pasta apps/web)');
      }
    }

  } catch (error) {
    console.log('❌ Erro no teste:', error.response?.data?.message || error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔧 PRÓXIMOS PASSOS PARA DEBUG:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Verifique se o servidor está rodando:');
  console.log('   cd apps/web && npm run dev\n');
  
  console.log('2️⃣ Abra o navegador em:');
  console.log('   http://localhost:3000/dashboard\n');
  
  console.log('3️⃣ Abra o Console do navegador (F12) e veja os erros\n');
  
  console.log('4️⃣ Teste o login com:');
  console.log('   Email: geral.joaoecoom@gmail.com\n');
}

testarAPIUsers();
