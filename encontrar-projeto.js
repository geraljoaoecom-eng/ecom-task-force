const axios = require('axios');

async function listarProjetos() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 LISTANDO TODOS OS PROJETOS SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Tentar acessar diretamente o projeto conhecido
    const response = await axios.get(
      'https://kpnhedyyxgodfgzqggdx.supabase.co/rest/v1/users?select=count',
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0'
        }
      }
    );

    console.log('✅ PROJETO ENCONTRADO!');
    console.log('📊 ID do Projeto: kpnhedyyxgodfgzqggdx');
    console.log('🌐 Dashboard: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx');
    console.log('💻 SQL Editor: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/sql/new');
    console.log('👥 Tabela Users: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx/editor/users');
    
  } catch (error) {
    console.log('❌ Erro ao acessar projeto:', error.message);
    console.log('\n💡 SOLUÇÕES:');
    console.log('1. Verifique se está logado no Supabase');
    console.log('2. Procure por projetos com nomes como:');
    console.log('   - ECOM TaskForce');
    console.log('   - Força-Tarefa');
    console.log('   - TaskForce');
    console.log('   - kpnhedyyxgodfgzqggdx');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎯 PRÓXIMOS PASSOS:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Cole este link no navegador:');
  console.log('   https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx\n');
  
  console.log('2️⃣ Ou procure na lista de projetos por:');
  console.log('   - Nome: "ECOM TaskForce" ou "Força-Tarefa"');
  console.log('   - ID: "kpnhedyyxgodfgzqggdx"\n');
  
  console.log('3️⃣ Depois vá para:');
  console.log('   SQL Editor → Cole o SQL → RUN ▶️\n');
}

listarProjetos();
