const bcrypt = require('bcryptjs');
const axios = require('axios');

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

const users = [
  {
    email: 'directbpsquad@gmail.com',
    password: 'Direct123456.',
    name: 'Direct BP Squad'
  },
  {
    email: 'geral.joaoecoom@gmail.com',
    password: 'Cursor2020.',
    name: 'João ECOOM'
  },
  {
    email: 'ecoomtaskforcetrial@gmail.com',
    password: 'Trial123456.',
    name: 'ECOOM TaskForce Trial'
  }
];

async function createUser(email, password, name) {
  try {
    console.log(`\n📧 Criando usuário: ${email}`);
    
    // Verificar se o usuário já existe
    const existingUserResponse = await axios.get(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (existingUserResponse.data && existingUserResponse.data.length > 0) {
      console.log(`   ℹ️ Usuário ${email} já existe`);
      return { success: false, message: 'Usuário já existe' };
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`   🔐 Senha hasheada com sucesso`);

    // Criar usuário no Supabase
    const userData = {
      email,
      password: hashedPassword,
      name: name || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const response = await axios.post(`${SUPABASE_URL}/rest/v1/users`, userData, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    const user = response.data[0];
    console.log(`   ✅ Usuário criado com sucesso!`);
    console.log(`   👤 ID: ${user.id}`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👨 Nome: ${user.name}`);

    return { success: true, user };

  } catch (error) {
    console.error(`   ❌ Erro ao criar usuário ${email}:`, error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

async function createAllUsers() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 CRIANDO USUÁRIOS NO SUPABASE');
  console.log('═══════════════════════════════════════════════════════');
  
  let successCount = 0;
  let failedCount = 0;
  
  for (const user of users) {
    const result = await createUser(user.email, user.password, user.name);
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Usuários criados: ${successCount}`);
  console.log(`❌ Falhas: ${failedCount}`);
  console.log(`📝 Total: ${users.length}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

createAllUsers();

