const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function testUsers() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 TESTANDO SISTEMA DE USUÁRIOS');
    console.log('═══════════════════════════════════════════════════════\n');

    // Buscar usuários com role
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name,role,created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const users = response.data;
    console.log(`📊 Total de usuários: ${users.length}\n`);

    if (users.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado!');
      return;
    }

    // Mostrar cada usuário
    users.forEach((user, index) => {
      const roleIcon = user.role === 'admin' ? '👑' : '👤';
      const roleLabel = user.role === 'admin' ? 'ADMIN' : 'USER';
      
      console.log(`${index + 1}. ${roleIcon} ${user.email}`);
      console.log(`   Nome: ${user.name || '(sem nome)'}`);
      console.log(`   Role: ${roleLabel}`);
      console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    // Contar admins e users
    const admins = users.filter(u => u.role === 'admin');
    const normalUsers = users.filter(u => u.role === 'user' || !u.role);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ESTATÍSTICAS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👑 Administradores: ${admins.length}`);
    console.log(`👤 Usuários comuns: ${normalUsers.length}`);
    console.log(`📝 Total: ${users.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (admins.length === 0) {
      console.log('⚠️ ATENÇÃO: Nenhum administrador encontrado!');
      console.log('Execute o SQL do arquivo: setup-admin-system.sql\n');
    } else {
      console.log('✅ Sistema configurado corretamente!');
      console.log('\nAdmins encontrados:');
      admins.forEach(admin => {
        console.log(`   👑 ${admin.email} - ${admin.name || '(sem nome)'}`);
      });
      console.log('\n🎉 Pronto para usar o dashboard!\n');
    }

  } catch (error) {
    if (error.response?.data?.code === '42703') {
      console.error('❌ Coluna "role" não existe!\n');
      console.log('📝 SOLUÇÃO:');
      console.log('1. Abra: https://supabase.com/dashboard');
      console.log('2. Vá para SQL Editor');
      console.log('3. Execute o SQL do arquivo: setup-admin-system.sql\n');
    } else {
      console.error('❌ Erro:', error.response?.data || error.message);
    }
  }
}

testUsers();

