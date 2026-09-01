const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function setupAdminSystem() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 CONFIGURANDO SISTEMA DE ADMIN');
    console.log('═══════════════════════════════════════════════════════\n');

    // Passo 1: Buscar todos os usuários
    console.log('📋 Passo 1: Buscando usuários existentes...');
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const users = response.data;
    console.log(`   ✅ Encontrados ${users.length} usuários\n`);

    if (users.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado. Crie usuários primeiro.\n');
      return;
    }

    // Passo 2: Atualizar cada usuário com role
    console.log('🔧 Passo 2: Adicionando campo role aos usuários...\n');

    const adminEmails = [
      'directbpsquad@gmail.com',
      'geral.joaoecoom@gmail.com'
    ];

    let adminCount = 0;
    let userCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
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
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }
        );

        if (role === 'admin') {
          console.log(`   👑 ${user.email} → ADMIN`);
          adminCount++;
        } else {
          console.log(`   👤 ${user.email} → USER`);
          userCount++;
        }
      } catch (error) {
        if (error.response?.data?.code === '42703') {
          console.log(`\n⚠️ ERRO: Coluna "role" não existe na tabela users!`);
          console.log(`\n📝 É necessário executar este SQL no Supabase SQL Editor:`);
          console.log(`\nALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';\n`);
          console.log(`1. Acesse: https://supabase.com/dashboard`);
          console.log(`2. Vá para: SQL Editor`);
          console.log(`3. Cole o SQL acima`);
          console.log(`4. Execute (RUN)`);
          console.log(`5. Volte aqui e execute: node execute-setup-admin.js\n`);
          return;
        }
        console.log(`   ❌ Erro ao atualizar ${user.email}`);
        errorCount++;
      }
    }

    // Passo 3: Verificar resultado
    console.log('\n📊 Passo 3: Verificando configuração...\n');
    
    const verifyResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/users?select=email,name,role&order=role.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👑 Administradores: ${adminCount}`);
    console.log(`👤 Usuários comuns: ${userCount}`);
    if (errorCount > 0) {
      console.log(`❌ Erros: ${errorCount}`);
    }
    console.log(`📝 Total: ${users.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (adminCount > 0) {
      console.log('✅ SISTEMA CONFIGURADO COM SUCESSO!\n');
      console.log('Administradores criados:');
      verifyResponse.data
        .filter(u => u.role === 'admin')
        .forEach(admin => {
          console.log(`   👑 ${admin.email} - ${admin.name || '(sem nome)'}`);
        });
      console.log('\n🎉 Agora você pode acessar /dashboard com uma conta admin!\n');
    } else {
      console.log('⚠️ Nenhum administrador foi criado. Verifique os emails.\n');
    }

  } catch (error) {
    console.error('\n❌ Erro ao configurar sistema:', error.response?.data || error.message);
    
    if (error.response?.data?.code === '42703') {
      console.log(`\n⚠️ A coluna "role" não existe na tabela users.`);
      console.log(`\nPara criar a coluna, execute este SQL no Supabase:`);
      console.log(`\nALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';\n`);
    }
  }
}

setupAdminSystem();

