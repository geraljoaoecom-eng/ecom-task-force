const axios = require('axios');

async function testLogin() {
  try {
    console.log('🧪 Testando login...');
    
    const response = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'pokt@gmail.com',
      password: '84005787'
    });
    
    console.log('✅ LOGIN SUCESSO!');
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ ERRO NO LOGIN:');
    console.log('Status:', error.response?.status);
    console.log('Mensagem:', error.response?.data || error.message);
  }
}

testLogin();
