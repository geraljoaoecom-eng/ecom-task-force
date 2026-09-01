const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
};

async function verDadosBanco() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFICANDO DADOS DO BANCO DE DADOS');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. USUÁRIOS
    console.log('👥 TABELA: users\n');
    try {
      const usersResponse = await axios.get(
        `${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`,
        { headers }
      );

      const users = usersResponse.data;
      console.log(`📊 Total de usuários: ${users.length}\n`);

      if (users.length > 0) {
        // Pegar as colunas do primeiro usuário
        const columns = Object.keys(users[0]);
        console.log('📋 Colunas disponíveis:');
        columns.forEach(col => console.log(`   - ${col}`));
        console.log('');

        // Mostrar primeiros 5 usuários
        console.log('👤 Usuários (primeiros 5):');
        users.slice(0, 5).forEach((user, index) => {
          console.log(`\n${index + 1}. ${user.email}`);
          console.log(`   ID: ${user.id}`);
          console.log(`   Nome: ${user.name || '(sem nome)'}`);
          console.log(`   Role: ${user.role || '❌ SEM ROLE'}`);
          console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
        });
        console.log('');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar usuários:', error.response?.data?.message || error.message);
    }

    // 2. BIBLIOTECAS
    console.log('\n📚 TABELA: libraries\n');
    try {
      const librariesResponse = await axios.get(
        `${SUPABASE_URL}/rest/v1/libraries?select=id,name,active_ads,user_id,created_at&order=created_at.desc&limit=5`,
        { headers }
      );

      const libraries = librariesResponse.data;
      console.log(`📊 Total de bibliotecas: ${libraries.length}+\n`);

      if (libraries.length > 0) {
        console.log('📚 Bibliotecas (primeiras 5):');
        libraries.forEach((lib, index) => {
          console.log(`\n${index + 1}. ${lib.name}`);
          console.log(`   ID: ${lib.id}`);
          console.log(`   Anúncios: ${lib.active_ads}`);
          console.log(`   User ID: ${lib.user_id}`);
          console.log(`   Criado: ${new Date(lib.created_at).toLocaleString('pt-BR')}`);
        });
        console.log('');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar bibliotecas:', error.response?.data?.message || error.message);
    }

    // 3. PASTAS
    console.log('\n📁 TABELA: folders\n');
    try {
      const foldersResponse = await axios.get(
        `${SUPABASE_URL}/rest/v1/folders?select=id,name,user_id,created_at&order=created_at.desc&limit=5`,
        { headers }
      );

      const folders = foldersResponse.data;
      console.log(`📊 Total de pastas: ${folders.length}+\n`);

      if (folders.length > 0) {
        console.log('📁 Pastas (primeiras 5):');
        folders.forEach((folder, index) => {
          console.log(`${index + 1}. ${folder.name} (User: ${folder.user_id})`);
        });
        console.log('');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar pastas:', error.response?.data?.message || error.message);
    }

    // 4. VERIFICAR SE ROLE EXISTE
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFICAÇÃO DA COLUNA ROLE');
    console.log('═══════════════════════════════════════════════════════\n');

    try {
      const roleCheckResponse = await axios.get(
        `${SUPABASE_URL}/rest/v1/users?select=role&limit=1`,
        { headers }
      );

      if (roleCheckResponse.data && roleCheckResponse.data.length > 0) {
        const hasRole = 'role' in roleCheckResponse.data[0];
        if (hasRole) {
          console.log('✅ Coluna "role" EXISTE na tabela users!');
          console.log(`   Valor de exemplo: "${roleCheckResponse.data[0].role || 'null'}"\n`);
        } else {
          console.log('❌ Coluna "role" NÃO EXISTE na tabela users!\n');
          console.log('Execute o SQL do arquivo: setup-admin-system.sql\n');
        }
      }
    } catch (error) {
      if (error.response?.data?.code === '42703') {
        console.log('❌ Coluna "role" NÃO EXISTE na tabela users!\n');
        console.log('📝 SOLUÇÃO: Execute este SQL no Supabase SQL Editor:\n');
        console.log('ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT \'user\';\n');
        console.log('UPDATE users SET role = \'admin\' WHERE email IN (\'directbpsquad@gmail.com\', \'geral.joaoecoom@gmail.com\');\n');
      } else {
        console.log('⚠️ Erro ao verificar coluna role:', error.response?.data?.message || error.message);
      }
    }

    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

verDadosBanco();

