const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

console.log('🚀 Iniciando migração completa para Supabase...');

const db = new sqlite3.Database('atlas.db');

// 1. Migrar usuários
console.log('\n👥 Migrando usuários...');
db.all('SELECT * FROM User', [], async (err, users) => {
  if (err) {
    console.error('❌ Erro ao buscar usuários:', err);
    return;
  }
  
  console.log(`📊 Encontrados ${users.length} usuários no SQLite`);
  
  for (const user of users) {
    try {
      const userData = {
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      };
      
      const response = await axios.post(`${SUPABASE_URL}/rest/v1/users`, userData, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates'
        }
      });
      
      console.log(`✅ Usuário migrado: ${user.email}`);
    } catch (error) {
      if (error.response?.data?.code === '23505') {
        console.log(`⚠️ Usuário já existe: ${user.email}`);
      } else {
        console.log(`❌ Erro ao migrar ${user.email}:`, error.response?.data || error.message);
      }
    }
  }
  
  // 2. Migrar pastas
  console.log('\n📁 Migrando pastas...');
  db.all('SELECT * FROM Folder', [], async (err, folders) => {
    if (err) {
      console.error('❌ Erro ao buscar pastas:', err);
      return;
    }
    
    console.log(`📊 Encontradas ${folders.length} pastas no SQLite`);
    
    for (const folder of folders) {
      try {
        const folderData = {
          id: folder.id,
          name: folder.name,
          user_id: folder.userId,
          created_at: folder.createdAt,
          updated_at: folder.updatedAt
        };
        
        const response = await axios.post(`${SUPABASE_URL}/rest/v1/folders`, folderData, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
          }
        });
        
        console.log(`✅ Pasta migrada: ${folder.name}`);
      } catch (error) {
        if (error.response?.data?.code === '23505') {
          console.log(`⚠️ Pasta já existe: ${folder.name}`);
        } else {
          console.log(`❌ Erro ao migrar pasta ${folder.name}:`, error.response?.data || error.message);
        }
      }
    }
    
    // 3. Migrar bibliotecas
    console.log('\n📚 Migrando bibliotecas...');
    db.all('SELECT * FROM Library', [], async (err, libraries) => {
      if (err) {
        console.error('❌ Erro ao buscar bibliotecas:', err);
        return;
      }
      
      console.log(`📊 Encontradas ${libraries.length} bibliotecas no SQLite`);
      
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
              'Content-Type': 'application/json',
              'Prefer': 'resolution=ignore-duplicates'
            }
          });
          
          console.log(`✅ Biblioteca migrada: ${lib.name}`);
        } catch (error) {
          if (error.response?.data?.code === '23505') {
            console.log(`⚠️ Biblioteca já existe: ${lib.name}`);
          } else {
            console.log(`❌ Erro ao migrar biblioteca ${lib.name}:`, error.response?.data || error.message);
          }
        }
      }
      
      // 4. Migrar páginas
      console.log('\n📄 Migrando páginas...');
      db.all('SELECT * FROM Page', [], async (err, pages) => {
        if (err) {
          console.error('❌ Erro ao buscar páginas:', err);
          return;
        }
        
        console.log(`📊 Encontradas ${pages.length} páginas no SQLite`);
        
        for (const page of pages) {
          try {
            const pageData = {
              id: page.id,
              library_id: page.libraryId,
              url: page.url,
              created_at: page.createdAt || new Date().toISOString()
            };
            
            const response = await axios.post(`${SUPABASE_URL}/rest/v1/pages`, pageData, {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates'
              }
            });
            
            console.log(`✅ Página migrada: ${page.url}`);
          } catch (error) {
            if (error.response?.data?.code === '23505') {
              console.log(`⚠️ Página já existe: ${page.url}`);
            } else {
              console.log(`❌ Erro ao migrar página ${page.url}:`, error.response?.data || error.message);
            }
          }
        }
        
        console.log('\n🎉 Migração completa finalizada!');
        console.log('📊 Verificando dados migrados...');
        
        // Verificar dados migrados
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
          
          const foldersResponse = await axios.get(`${SUPABASE_URL}/rest/v1/folders?select=count`, {
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
          console.log(`📁 Pastas no Supabase: ${foldersResponse.data[0]?.count || 0}`);
          console.log(`📄 Páginas no Supabase: ${pagesResponse.data[0]?.count || 0}`);
          
        } catch (error) {
          console.log('❌ Erro ao verificar dados migrados:', error.message);
        }
        
        db.close();
      });
    });
  });
});
