const axios = require('axios');

async function testarLoginCompleto() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔐 TESTANDO LOGIN COMPLETO');
  console.log('═══════════════════════════════════════════════════════\n');

  const VPS_URL = 'https://ecoomtaskforce.site';
  
  try {
    console.log('1️⃣ Fazendo login com admin...');
    
    const loginResponse = await axios.post(`${VPS_URL}/api/auth/login`, {
      email: 'geral.joaoecoom@gmail.com',
      password: 'sua_senha_aqui' // SUBSTITUA PELA SENHA REAL
    });

    console.log('✅ Login realizado!');
    console.log('🎫 Token:', loginResponse.data.token ? 'Recebido' : 'Não recebido');
    
    const token = loginResponse.data.token;
    
    if (!token) {
      console.log('❌ Token não foi retornado no login');
      return;
    }

    console.log('\n2️⃣ Testando verificação do token...');
    
    const verifyResponse = await axios.get(`${VPS_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Token verificado!');
    console.log('👤 Usuário:', verifyResponse.data.user.email);
    console.log('👑 Role:', verifyResponse.data.user.role);
    
    console.log('\n3️⃣ Testando API /api/users...');
    
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

    console.log('\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!');

  } catch (error) {
    console.log('❌ Erro no teste:');
    
    if (error.response?.status === 401) {
      console.log('   🔐 Erro 401: Credenciais inválidas');
      console.log('   💡 Verifique email e senha');
    } else if (error.response?.status === 500) {
      console.log('   ⚠️  Erro 500: Problema no servidor');
      console.log('   💡 Verifique os logs do servidor');
    } else {
      console.log(`   ⚠️  ${error.response?.status}: ${error.response?.data?.error || error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔧 PRÓXIMOS PASSOS:');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Faça upload dos arquivos atualizados para a VPS:');
  console.log('   - apps/web/app/dashboard/page.tsx');
  console.log('   - apps/web/app/api/auth/verify/route.ts');
  console.log('   - apps/web/lib/adminMiddleware.ts');
  console.log('   - apps/web/app/api/users/route.ts\n');
  
  console.log('2️⃣ Reinicie o servidor na VPS:');
  console.log('   pm2 restart all\n');
  
  console.log('3️⃣ Teste no navegador:');
  console.log('   https://ecoomtaskforce.site/dashboard\n');
  
  console.log('4️⃣ Se ainda não funcionar, me diga:');
  console.log('   - Qual é a senha do admin geral.joaoecoom@gmail.com?');
  console.log('   - Qual erro aparece no Console do navegador?');
}

testarLoginCompleto();
