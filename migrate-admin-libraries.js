const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

console.log('🔄 Migrando bibliotecas restantes para o usuário principal...');

const db = new sqlite3.Database('atlas.db');

// Buscar bibliotecas com user_id admin e migrar para o usuário principal
db.all(`
  SELECT l.*, u.id as correct_user_id, u.email as user_email 
  FROM Library l 
  JOIN User u ON u.email = 'directbpsquad@gmail.com'
  WHERE l.userId = 'admin_1760100610402' 
  ORDER BY l.createdAt DESC
`, [], async (err, libraries) => {
  if (err) {
    console.error('❌ Erro ao buscar bibliotecas:', err);
    return;
  }
  
  console.log(`📊 Encontradas ${libraries.length} bibliotecas para migrar`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const lib of libraries) {
    try {
      // Converter datas para formato ISO
      const createdAt = lib.createdAt ? new Date(lib.createdAt).toISOString() : new Date().toISOString();
      const updatedAt = lib.updatedAt ? new Date(lib.updatedAt).toISOString() : new Date().toISOString();
      
      const libraryData = {
        id: lib.id,
        name: lib.name,
        source_type: lib.sourceType,
        source_value: lib.sourceValue,
        country: lib.country,
        language: lib.language,
        active_ads: lib.activeAds || 0,
        folder_id: lib.folderId,
        user_id: lib.correct_user_id, // Usar o ID correto do usuário principal
        nichos: lib.nichos,
        estrategias: lib.estrategias,
        produtos: lib.produtos,
        idiomas: lib.idiomas,
        paises: lib.paises,
        status: lib.status,
        nota: lib.nota,
        notes: lib.notes,
        created_at: createdAt,
        updated_at: updatedAt
      };
      
      const response = await axios.post(`${SUPABASE_URL}/rest/v1/libraries`, libraryData, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Biblioteca migrada: ${lib.name}`);
      successCount++;
    } catch (error) {
      console.log(`❌ Erro ao migrar biblioteca ${lib.name}:`, error.response?.data || error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Resumo da migração:`);
  console.log(`✅ Sucessos: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  
  // Verificar dados finais
  console.log('\n🔍 Verificando dados finais no Supabase...');
  
  try {
    const librariesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log(`📚 Total de bibliotecas no Supabase: ${librariesResponse.data[0]?.count || 0}`);
    
    // Listar bibliotecas
    const librariesListResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?select=id,name,user_id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log('\n📚 Bibliotecas no Supabase:');
    librariesListResponse.data.forEach(lib => {
      console.log(`- ${lib.name} (ID: ${lib.id})`);
    });
    
    console.log('\n🎉 Migração finalizada!');
    
  } catch (error) {
    console.log('❌ Erro ao verificar dados finais:', error.message);
  }
  
  db.close();
});
