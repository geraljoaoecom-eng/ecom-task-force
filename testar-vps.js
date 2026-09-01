const axios = require('axios');

async function testarVPS() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 TESTANDO API NA VPS');
  console.log('═══════════════════════════════════════════════════════\n');

  // Substitua pela URL da sua VPS
  const VPS_URL = 'https://seu-dominio.com'; // OU IP da VPS
  
  console.log('⚠️  IMPORTANTE: Substitua "seu-dominio.com" pela URL real da sua VPS');
  console.log('   Exemplos:');
  console.log('   - https://meusite.com');
  console.log('   - http://192.168.1.100:3000');
  console.log('   - https://vps.exemplo.com\n');

  try {
    console.log('1️⃣ Testando API /api/users na VPS...');
    
    const response = await axios.get(`${VPS_URL}/api/users`, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ API VPS funcionando!');
    console.log(`📊 ${response.data.length} usuários encontrados`);
    
    response.data.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.log('❌ Erro na VPS:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   🔌 Conexão recusada - VPS pode estar offline');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   🌐 Domínio não encontrado - URL incorreta');
    } else if (error.response?.status === 401) {
      console.log('   🔐 Erro de autenticação - Token inválido');
    } else if (error.response?.status === 403) {
      console.log('   🚫 Acesso negado - Usuário não é admin');
    } else {
      console.log(`   ⚠️  ${error.response?.status}: ${error.response?.data?.message || error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔧 DEBUG NA VPS:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Verifique se a VPS está rodando:');
  console.log('   pm2 status (ou ps aux | grep node)\n');
  
  console.log('2️⃣ Verifique os logs da aplicação:');
  console.log('   pm2 logs (ou tail -f /var/log/app.log)\n');
  
  console.log('3️⃣ Teste o dashboard na VPS:');
  console.log('   https://seu-dominio.com/dashboard\n');
  
  console.log('4️⃣ Abra o Console do navegador (F12) e veja os erros\n');
  
  console.log('5️⃣ Verifique se o usuário está logado como admin\n');
}

testarVPS();
