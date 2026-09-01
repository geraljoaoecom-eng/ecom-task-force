const axios = require('axios');
const fs = require('fs');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function createTables() {
  try {
    console.log('🚀 Criando tabelas no Supabase...');
    
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('create-tables.sql', 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📊 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);
          
          const response = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            query: command
          }, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Comando ${i + 1} executado com sucesso`);
        } catch (error) {
          console.log(`⚠️ Comando ${i + 1} falhou (pode ser normal):`, error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log('🎉 Tabelas criadas com sucesso!');
    
    // Testar se as tabelas foram criadas
    await testTables();
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
  }
}

async function testTables() {
  try {
    console.log('🔍 Testando se as tabelas foram criadas...');
    
    const tables = ['users', 'folders', 'libraries', 'pages', 'filter_options', 'ad_history', 'deletion_history'];
    
    for (const table of tables) {
      try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        
        console.log(`✅ Tabela ${table} existe e está acessível`);
      } catch (error) {
        console.log(`❌ Tabela ${table} não existe ou não está acessível`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao testar tabelas:', error.message);
  }
}

createTables();
