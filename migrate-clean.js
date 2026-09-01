const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

console.log('🧹 Limpando dados inválidos e migrando apenas dados válidos...');

const db = new sqlite3.Database('atlas.db');

// 1. Limpar bibliotecas existentes no Supabase
console.log('\n🗑️ Limpando bibliotecas existentes no Supabase...');
axios.delete(`${SUPABASE_URL}/rest/v1/libraries?id=neq.0`, {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  }
})
.then(() => {
  console.log('✅ Bibliotecas limpas no Supabase');
  
  // 2. Buscar apenas bibliotecas válidas (com user_id válido)
  console.log('\n📚 Migrando apenas bibliotecas válidas...');
  db.all(`
    SELECT l.*, u.email as user_email 
    FROM Library l 
    JOIN User u ON l.userId = u.id 
    WHERE l.userId IS NOT NULL 
    ORDER BY l.createdAt DESC
  `, [], async (err, libraries) => {
    if (err) {
      console.error('❌ Erro ao buscar bibliotecas válidas:', err);
      return;
    }
    
    console.log(`📊 Encontradas ${libraries.length} bibliotecas válidas no SQLite`);
    
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
          user_id: lib.userId,
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
        
        console.log(`✅ Biblioteca migrada: ${lib.name} (${lib.user_email})`);
        successCount++;
      } catch (error) {
        console.log(`❌ Erro ao migrar biblioteca ${lib.name}:`, error.response?.data || error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Resumo da migração:`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    
    // 3. Migrar páginas das bibliotecas migradas
    console.log('\n📄 Migrando páginas das bibliotecas migradas...');
    db.all(`
      SELECT p.*, l.userId 
      FROM Page p 
      JOIN Library l ON p.libraryId = l.id 
      WHERE l.userId IS NOT NULL
    `, [], async (err, pages) => {
      if (err) {
        console.error('❌ Erro ao buscar páginas:', err);
        return;
      }
      
      console.log(`📊 Encontradas ${pages.length} páginas válidas no SQLite`);
      
      let pageSuccessCount = 0;
      let pageErrorCount = 0;
      
      for (const page of pages) {
        try {
          const pageData = {
            id: page.id,
            library_id: page.libraryId,
            url: page.url
          };
          
          const response = await axios.post(`${SUPABASE_URL}/rest/v1/pages`, pageData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Página migrada: ${page.url}`);
          pageSuccessCount++;
        } catch (error) {
          console.log(`❌ Erro ao migrar página ${page.url}:`, error.response?.data || error.message);
          pageErrorCount++;
        }
      }
      
      console.log(`\n📊 Resumo da migração de páginas:`);
      console.log(`✅ Sucessos: ${pageSuccessCount}`);
      console.log(`❌ Erros: ${pageErrorCount}`);
      
      // Verificar dados finais
      console.log('\n🔍 Verificando dados finais no Supabase...');
      
      try {
        const usersResponse = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=count`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        
        const librariesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?select=count`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        
        const pagesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/pages?select=count`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        
        console.log(`👥 Usuários no Supabase: ${usersResponse.data[0]?.count || 0}`);
        console.log(`📚 Bibliotecas no Supabase: ${librariesResponse.data[0]?.count || 0}`);
        console.log(`📄 Páginas no Supabase: ${pagesResponse.data[0]?.count || 0}`);
        
        console.log('\n🎉 Migração limpa concluída com sucesso!');
        
      } catch (error) {
        console.log('❌ Erro ao verificar dados finais:', error.message);
      }
      
      db.close();
    });
  });
})
.catch(error => {
  console.log('❌ Erro ao limpar bibliotecas:', error.response?.data || error.message);
  db.close();
});
