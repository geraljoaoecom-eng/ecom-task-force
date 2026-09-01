const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function createTablesViaAPI() {
  try {
    console.log('🚀 Criando tabelas via API do Supabase...');
    
    // Comandos SQL para criar as tabelas
    const sqlCommands = [
      // Criar tabela de usuários
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      // Criar tabela de pastas
      `CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(name, user_id)
      )`,
      
      // Criar tabela de bibliotecas
      `CREATE TABLE IF NOT EXISTS libraries (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_value TEXT NOT NULL,
        country TEXT,
        language TEXT,
        notes TEXT,
        tags TEXT,
        active_ads INTEGER DEFAULT 0,
        last_checked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id TEXT REFERENCES folders(id),
        estrategias TEXT,
        idiomas TEXT,
        nichos TEXT,
        paises TEXT,
        produtos TEXT,
        status TEXT,
        tipos TEXT,
        nota TEXT
      )`,
      
      // Criar tabela de páginas
      `CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        url TEXT NOT NULL,
        library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE
      )`,
      
      // Criar tabela de opções de filtro
      `CREATE TABLE IF NOT EXISTS filter_options (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(type, value)
      )`,
      
      // Criar tabela de histórico de anúncios
      `CREATE TABLE IF NOT EXISTS ad_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        ads_count INTEGER NOT NULL,
        date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      // Criar tabela de histórico de exclusões
      `CREATE TABLE IF NOT EXISTS deletion_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        library_name TEXT NOT NULL,
        source_type TEXT,
        source_value TEXT,
        country TEXT,
        language TEXT,
        notes TEXT,
        tags TEXT,
        estrategias TEXT,
        idiomas TEXT,
        nichos TEXT,
        paises TEXT,
        produtos TEXT,
        status TEXT,
        tipos TEXT,
        nota TEXT,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reason TEXT
      )`
    ];
    
    // Executar cada comando SQL
    for (let i = 0; i < sqlCommands.length; i++) {
      try {
        console.log(`⚡ Executando comando ${i + 1}/${sqlCommands.length}...`);
        
        const response = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          sql: sqlCommands[i]
        }, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`✅ Comando ${i + 1} executado com sucesso`);
      } catch (error) {
        console.log(`⚠️ Comando ${i + 1} falhou:`, error.response?.data?.message || error.message);
        
        // Tentar método alternativo
        try {
          const response = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/query`, {
            query: sqlCommands[i]
          }, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Comando ${i + 1} executado com método alternativo`);
        } catch (error2) {
          console.log(`❌ Comando ${i + 1} falhou completamente:`, error2.response?.data?.message || error2.message);
        }
      }
    }
    
    // Criar índices
    console.log('📊 Criando índices...');
    const indexCommands = [
      'CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_libraries_active_ads ON libraries(active_ads, updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_ad_history_library_date ON ad_history(library_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_deletion_history_deleted_at ON deletion_history(deleted_at)',
      'CREATE INDEX IF NOT EXISTS idx_filter_options_type ON filter_options(type)'
    ];
    
    for (const indexCmd of indexCommands) {
      try {
        await axios.post(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          sql: indexCmd
        }, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ Índice criado: ${indexCmd.split(' ')[5]}`);
      } catch (error) {
        console.log(`⚠️ Índice falhou: ${error.message}`);
      }
    }
    
    // Inserir dados de filtro padrão
    console.log('🔍 Inserindo opções de filtro padrão...');
    const filterData = [
      { type: 'status', value: 'active' },
      { type: 'nichos', value: 'EMAGRECIMENTO' },
      { type: 'nichos', value: 'DIABETES' },
      { type: 'nichos', value: 'SEXUAL' },
      { type: 'nichos', value: 'RELIGIOSO' },
      { type: 'nichos', value: 'EDUCACIONAL' },
      { type: 'estrategias', value: 'VSL' },
      { type: 'estrategias', value: 'PÁG. VENDAS' },
      { type: 'estrategias', value: 'QUIZ' },
      { type: 'produtos', value: 'NUTRA' },
      { type: 'produtos', value: 'INFO' },
      { type: 'produtos', value: 'SORTEIOS' },
      { type: 'idiomas', value: 'pt' },
      { type: 'idiomas', value: 'EN' },
      { type: 'idiomas', value: 'es' },
      { type: 'paises', value: 'BR' },
      { type: 'paises', value: 'USA' },
      { type: 'paises', value: 'LATAM' }
    ];
    
    for (const filter of filterData) {
      try {
        await axios.post(`${SUPABASE_URL}/rest/v1/filter_options`, filter, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ Filtro inserido: ${filter.type} - ${filter.value}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`ℹ️ Filtro já existe: ${filter.type} - ${filter.value}`);
        } else {
          console.log(`⚠️ Erro ao inserir filtro: ${error.message}`);
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

createTablesViaAPI();
