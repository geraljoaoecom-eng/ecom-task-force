const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

console.log('🔄 Migrando bibliotecas do SQLite para Supabase...');

const db = new sqlite3.Database('atlas.db');

// Buscar bibliotecas do SQLite
db.all('SELECT * FROM Library ORDER BY createdAt DESC', [], async (err, libraries) => {
  if (err) {
    console.error('❌ Erro ao buscar bibliotecas:', err);
    return;
  }
  
  console.log(`📚 Encontradas ${libraries.length} bibliotecas no SQLite`);
  
  // Migrar cada biblioteca para Supabase
  for (const lib of libraries) {
    try {
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
        created_at: lib.createdAt,
        updated_at: lib.updatedAt
      };
      
      const response = await axios.post(`${SUPABASE_URL}/rest/v1/libraries`, libraryData, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Migrada: ${lib.name}`);
    } catch (error) {
      console.log(`❌ Erro ao migrar ${lib.name}:`, error.response?.data || error.message);
    }
  }
  
  console.log('🎉 Migração concluída!');
  db.close();
});