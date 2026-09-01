const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function setupSupabase() {
  try {
    console.log('🚀 Configurando Supabase...');
    
    // Testar conexão
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log('✅ Conexão com Supabase estabelecida!');
    console.log('📊 Status:', response.status);
    
    // Criar usuário de teste
    const userData = {
      email: 'directbpsquad@gmail.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      name: 'Direct BP Squad'
    };
    
    try {
      const userResponse = await axios.post(`${SUPABASE_URL}/rest/v1/users`, userData, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Usuário criado:', userResponse.data);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️ Usuário já existe');
      } else {
        console.error('❌ Erro ao criar usuário:', error.message);
      }
    }
    
    console.log('🎉 Supabase configurado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao configurar Supabase:', error.message);
  }
}

setupSupabase();
