const bcrypt = require('bcryptjs');
const axios = require('axios');

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function updateUserPassword() {
  try {
    const email = 'directbpsquad@gmail.com';
    const newPassword = 'Direct123456.';
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 ATUALIZANDO SENHA DO USUÁRIO');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`📧 Email: ${email}`);
    
    // Buscar usuário
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.data || response.data.length === 0) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    const user = response.data[0];
    console.log(`👤 ID: ${user.id}`);
    console.log(`👨 Nome: ${user.name}`);
    
    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`\n🔐 Nova senha hasheada com sucesso`);

    // Atualizar senha
    await axios.patch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
      {
        password: hashedPassword,
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Senha atualizada com sucesso!`);
    console.log(`🔑 Nova senha: ${newPassword}`);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ OPERAÇÃO CONCLUÍDA');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro ao atualizar senha:', error.response?.data || error.message);
  }
}

updateUserPassword();

