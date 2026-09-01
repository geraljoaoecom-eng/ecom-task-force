const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://postgres:TaskForce2024!@db.gghsdrusnjderipykmhu.supabase.co:5432/postgres'
  });

  try {
    console.log('🔌 Testando conexão com Supabase...');
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Versão do PostgreSQL:', result.rows[0].version);
    
    await client.end();
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

testConnection();
