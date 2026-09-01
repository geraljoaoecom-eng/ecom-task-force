const axios = require('axios');

async function testarAutenticacao() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔐 TESTANDO AUTENTICAÇÃO ADMIN');
  console.log('═══════════════════════════════════════════════════════\n');

  // Substitua pela URL da sua VPS
  const VPS_URL = 'https://seu-dominio.com'; // SUBSTITUA PELA URL REAL
  
  console.log('⚠️  IMPORTANTE: Substitua "seu-dominio.com" pela URL real da sua VPS\n');

  try {
    console.log('1️⃣ Testando login com admin...');
    
    // Tentar fazer login primeiro
    const loginResponse = await axios.post(`${VPS_URL}/api/auth/login`, {
      email: 'geral.joaoecoom@gmail.com',
      password: 'sua_senha_aqui' // SUBSTITUA PELA SENHA REAL
    });

    console.log('✅ Login realizado com sucesso!');
    console.log('🎫 Token recebido:', loginResponse.data.token ? 'Sim' : 'Não');
    
    const token = loginResponse.data.token;
    
    console.log('\n2️⃣ Testando API /api/users com token...');
    
    const usersResponse = await axios.get(`${VPS_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API /api/users funcionando!');
    console.log(`📊 ${usersResponse.data.length} usuários encontrados:`);
    
    usersResponse.data.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.log('❌ Erro no teste:');
    
    if (error.response?.status === 401) {
      console.log('   🔐 Erro 401: Token inválido ou expirado');
      console.log('   💡 Solução: Faça login novamente');
    } else if (error.response?.status === 403) {
      console.log('   🚫 Erro 403: Usuário não é admin');
      console.log('   💡 Solução: Use um email de admin');
    } else if (error.response?.status === 500) {
      console.log('   ⚠️  Erro 500: Problema no servidor');
      console.log('   💡 Solução: Verifique os logs do servidor');
    } else {
      console.log(`   ⚠️  ${error.response?.status}: ${error.response?.data?.error || error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔧 DEBUG MANUAL:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Abra o Console do navegador (F12)');
  console.log('2️⃣ Vá para a aba Network');
  console.log('3️⃣ Recarregue a página do dashboard');
  console.log('4️⃣ Clique na requisição /api/users');
  console.log('5️⃣ Veja os Headers da requisição');
  console.log('6️⃣ Verifique se tem Authorization: Bearer ...');
  console.log('7️⃣ Veja a resposta (Response)');
  
  console.log('\n📋 Informações necessárias:');
  console.log('- URL da VPS: ?');
  console.log('- Email admin: geral.joaoecoom@gmail.com');
  console.log('- Senha admin: ?');
}

testarAutenticacao();
