const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

// Configuração do SQLite
const sqliteDbPath = path.join(__dirname, 'atlas.db');

async function migrateToSupabase() {
  console.log('🚀 Iniciando migração para Supabase...');
  
  try {
    // Conectar ao SQLite
    const sqliteDb = new sqlite3.Database(sqliteDbPath);
    
    console.log('📊 Migrando usuários...');
    await migrateUsers(sqliteDb);
    
    console.log('📁 Migrando pastas...');
    await migrateFolders(sqliteDb);
    
    console.log('📚 Migrando bibliotecas...');
    await migrateLibraries(sqliteDb);
    
    console.log('📄 Migrando páginas...');
    await migratePages(sqliteDb);
    
    console.log('🔍 Migrando opções de filtro...');
    await migrateFilterOptions(sqliteDb);
    
    console.log('📈 Migrando histórico de anúncios...');
    await migrateAdHistory(sqliteDb);
    
    console.log('🗑️ Migrando histórico de exclusões...');
    await migrateDeletionHistory(sqliteDb);
    
    sqliteDb.close();
    
    console.log('✅ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
}

async function migrateUsers(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM User', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const user of rows) {
        try {
          const userData = {
            id: user.id,
            email: user.email,
            password: user.password,
            name: user.name,
            created_at: user.createdAt,
            updated_at: user.updatedAt
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/users`, userData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Usuário migrado: ${user.email}`);
        } catch (error) {
          if (error.response?.status === 409) {
            console.log(`ℹ️ Usuário já existe: ${user.email}`);
          } else {
            console.error(`❌ Erro ao migrar usuário ${user.email}:`, error.message);
          }
        }
      }
      
      resolve();
    });
  });
}

async function migrateFolders(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM Folder', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const folder of rows) {
        try {
          const folderData = {
            id: folder.id,
            name: folder.name,
            user_id: folder.userId,
            created_at: folder.createdAt
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/folders`, folderData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Pasta migrada: ${folder.name}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar pasta ${folder.name}:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateLibraries(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM Library', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const library of rows) {
        try {
          const libraryData = {
            id: library.id,
            name: library.name,
            source_type: library.sourceType,
            source_value: library.sourceValue,
            country: library.country,
            language: library.language,
            notes: library.notes,
            tags: library.tags,
            active_ads: library.activeAds,
            last_checked_at: library.lastCheckedAt,
            created_at: library.createdAt,
            updated_at: library.updatedAt,
            user_id: library.userId,
            folder_id: library.folderId,
            estrategias: library.estrategias,
            idiomas: library.idiomas,
            nichos: library.nichos,
            paises: library.paises,
            produtos: library.produtos,
            status: library.status,
            tipos: library.tipos,
            nota: library.nota
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/libraries`, libraryData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Biblioteca migrada: ${library.name}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar biblioteca ${library.name}:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migratePages(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM Page', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const page of rows) {
        try {
          const pageData = {
            id: page.id,
            url: page.url,
            library_id: page.libraryId
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/pages`, pageData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Página migrada: ${page.url}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar página ${page.url}:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateFilterOptions(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM FilterOption', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const option of rows) {
        try {
          const optionData = {
            id: option.id,
            type: option.type,
            value: option.value,
            created_at: option.createdAt
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/filter_options`, optionData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Opção de filtro migrada: ${option.type} - ${option.value}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar opção de filtro ${option.type}:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateAdHistory(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM AdHistory', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const history of rows) {
        try {
          const historyData = {
            id: history.id,
            library_id: history.libraryId,
            ads_count: history.adsCount,
            date: history.date
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/ad_history`, historyData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Histórico migrado: ${history.adsCount} anúncios em ${history.date}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar histórico:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateDeletionHistory(sqliteDb) {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM DeletionHistory', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const deletion of rows) {
        try {
          const deletionData = {
            id: deletion.id,
            library_name: deletion.libraryName,
            source_type: deletion.sourceType,
            source_value: deletion.sourceValue,
            country: deletion.country,
            language: deletion.language,
            notes: deletion.notes,
            tags: deletion.tags,
            estrategias: deletion.estrategias,
            idiomas: deletion.idiomas,
            nichos: deletion.nichos,
            paises: deletion.paises,
            produtos: deletion.produtos,
            status: deletion.status,
            tipos: deletion.tipos,
            nota: deletion.nota,
            deleted_at: deletion.deletedAt,
            reason: deletion.reason
          };
          
          await axios.post(`${SUPABASE_URL}/rest/v1/deletion_history`, deletionData, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ Exclusão migrada: ${deletion.libraryName}`);
        } catch (error) {
          console.error(`❌ Erro ao migrar exclusão ${deletion.libraryName}:`, error.message);
        }
      }
      
      resolve();
    });
  });
}

// Executar migração
migrateToSupabase();
