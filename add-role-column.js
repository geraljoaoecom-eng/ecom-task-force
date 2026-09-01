const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function addRoleColumn() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 ADICIONANDO CAMPO ROLE AOS USUÁRIOS');
    console.log('═══════════════════════════════════════════════════════\n');

    // Buscar todos os usuários
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id,email,name`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const users = response.data;
    console.log(`📊 Encontrados ${users.length} usuários\n`);

    // Definir admin padrão
    const adminEmails = [
      'directbpsquad@gmail.com',
      'geral.joaoecoom@gmail.com'
    ];

    let adminCount = 0;
    let userCount = 0;

    // Atualizar cada usuário com role
    for (const user of users) {
      const role = adminEmails.includes(user.email) ? 'admin' : 'user';
      
      await axios.patch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
        { 
          role: role,
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

      if (role === 'admin') {
        console.log(`👑 ${user.email} → ADMIN`);
        adminCount++;
      } else {
        console.log(`👤 ${user.email} → USER`);
        userCount++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👑 Admins: ${adminCount}`);
    console.log(`👤 Users: ${userCount}`);
    console.log(`📝 Total: ${users.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro ao adicionar campo role:', error.response?.data || error.message);
  }
}

addRoleColumn();

