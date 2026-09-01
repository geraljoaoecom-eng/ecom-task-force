const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function createTablesSimple() {
  try {
    console.log('🚀 Tentando criar tabelas de forma simples...');
    
    // Primeiro, vamos testar se conseguimos acessar o banco
    console.log('🔍 Testando acesso ao banco...');
    
    try {
      const response = await axios.get(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      console.log('✅ Acesso ao Supabase OK');
      console.log('📊 Status:', response.status);
      
    } catch (error) {
      console.error('❌ Erro de acesso:', error.message);
      return;
    }
    
    // Tentar criar uma tabela simples primeiro
    console.log('📊 Tentando criar tabela de teste...');
    
    try {
      // Tentar inserir dados em uma tabela que pode já existir
      const testData = {
        id: 'test-' + Date.now(),
        email: 'test@test.com',
        password: 'test123',
        name: 'Test User'
      };
      
      const response = await axios.post(`${SUPABASE_URL}/rest/v1/users`, testData, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Tabela users existe e funcionando!');
      
      // Deletar o teste
      await axios.delete(`${SUPABASE_URL}/rest/v1/users?id=eq.${testData.id}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      console.log('✅ Teste removido');
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Tabela users não existe - precisamos criá-la');
        console.log('💡 Você precisa criar as tabelas manualmente no dashboard do Supabase');
        console.log('🌐 Acesse: https://supabase.com/dashboard/project/kpnhedyyxgodfgzqggdx');
        console.log('📝 Execute o SQL do arquivo create-tables.sql');
      } else {
        console.log('⚠️ Erro inesperado:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createTablesSimple();
