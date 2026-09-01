const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Configuração do Supabase
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

// Configuração do SQLite
const sqliteDbPath = path.join(__dirname, 'atlas.db');

async function migrateToSupabaseRobust() {
  console.log('🚀 Iniciando migração robusta para Supabase...');
  
  try {
    // Conectar ao SQLite
    const sqliteDb = new sqlite3.Database(sqliteDbPath);
    
    console.log('📊 Migrando usuários...');
    await migrateUsersRobust(sqliteDb);
    
    console.log('📁 Migrando pastas...');
    await migrateFoldersRobust(sqliteDb);
    
    console.log('📚 Migrando bibliotecas...');
    await migrateLibrariesRobust(sqliteDb);
    
    console.log('📄 Migrando páginas...');
    await migratePagesRobust(sqliteDb);
    
    console.log('🔍 Migrando opções de filtro...');
    await migrateFilterOptionsRobust(sqliteDb);
    
    console.log('📈 Migrando histórico de anúncios...');
    await migrateAdHistoryRobust(sqliteDb);
    
    console.log('🗑️ Migrando histórico de exclusões...');
    await migrateDeletionHistoryRobust(sqliteDb);
    
    sqliteDb.close();
    
    console.log('✅ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
}

async function migrateUsersRobust(sqliteDb) {
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
            name: user.name || null,
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
            console.error(`❌ Erro ao migrar usuário ${user.email}:`, error.response?.data || error.message);
          }
        }
      }
      
      resolve();
    });
  });
}

async function migrateFoldersRobust(sqliteDb) {
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
          console.error(`❌ Erro ao migrar pasta ${folder.name}:`, error.response?.data || error.message);
          
          // Tentar inserir sem o ID (deixar o Supabase gerar)
          try {
            const folderDataSimple = {
              name: folder.name,
              user_id: folder.userId,
              created_at: folder.createdAt
            };
            
            await axios.post(`${SUPABASE_URL}/rest/v1/folders`, folderDataSimple, {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`✅ Pasta migrada (sem ID): ${folder.name}`);
          } catch (error2) {
            console.error(`❌ Erro definitivo ao migrar pasta ${folder.name}:`, error2.response?.data || error2.message);
          }
        }
      }
      
      resolve();
    });
  });
}

async function migrateLibrariesRobust(sqliteDb) {
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
            country: library.country || null,
            language: library.language || null,
            notes: library.notes || null,
            tags: library.tags || null,
            active_ads: library.activeAds || 0,
            last_checked_at: library.lastCheckedAt || null,
            created_at: library.createdAt,
            updated_at: library.updatedAt,
            user_id: library.userId,
            folder_id: library.folderId || null,
            estrategias: library.estrategias || null,
            idiomas: library.idiomas || null,
            nichos: library.nichos || null,
            paises: library.paises || null,
            produtos: library.produtos || null,
            status: library.status || null,
            tipos: library.tipos || null,
            nota: library.nota || null
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
          console.error(`❌ Erro ao migrar biblioteca ${library.name}:`, error.response?.data || error.message);
          
          // Tentar inserir sem o ID
          try {
            const libraryDataSimple = {
              name: library.name,
              source_type: library.sourceType,
              source_value: library.sourceValue,
              country: library.country || null,
              language: library.language || null,
              notes: library.notes || null,
              tags: library.tags || null,
              active_ads: library.activeAds || 0,
              last_checked_at: library.lastCheckedAt || null,
              created_at: library.createdAt,
              updated_at: library.updatedAt,
              user_id: library.userId,
              folder_id: library.folderId || null,
              estrategias: library.estrategias || null,
              idiomas: library.idiomas || null,
              nichos: library.nichos || null,
              paises: library.paises || null,
              produtos: library.produtos || null,
              status: library.status || null,
              tipos: library.tipos || null,
              nota: library.nota || null
            };
            
            await axios.post(`${SUPABASE_URL}/rest/v1/libraries`, libraryDataSimple, {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`✅ Biblioteca migrada (sem ID): ${library.name}`);
          } catch (error2) {
            console.error(`❌ Erro definitivo ao migrar biblioteca ${library.name}:`, error2.response?.data || error2.message);
          }
        }
      }
      
      resolve();
    });
  });
}

async function migratePagesRobust(sqliteDb) {
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
          console.error(`❌ Erro ao migrar página ${page.url}:`, error.response?.data || error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateFilterOptionsRobust(sqliteDb) {
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
          if (error.response?.status === 409) {
            console.log(`ℹ️ Opção de filtro já existe: ${option.type} - ${option.value}`);
          } else {
            console.error(`❌ Erro ao migrar opção de filtro ${option.type}:`, error.response?.data || error.message);
          }
        }
      }
      
      resolve();
    });
  });
}

async function migrateAdHistoryRobust(sqliteDb) {
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
          console.error(`❌ Erro ao migrar histórico:`, error.response?.data || error.message);
        }
      }
      
      resolve();
    });
  });
}

async function migrateDeletionHistoryRobust(sqliteDb) {
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
            source_type: deletion.sourceType || null,
            source_value: deletion.sourceValue || null,
            country: deletion.country || null,
            language: deletion.language || null,
            notes: deletion.notes || null,
            tags: deletion.tags || null,
            estrategias: deletion.estrategias || null,
            idiomas: deletion.idiomas || null,
            nichos: deletion.nichos || null,
            paises: deletion.paises || null,
            produtos: deletion.produtos || null,
            status: deletion.status || null,
            tipos: deletion.tipos || null,
            nota: deletion.nota || null,
            deleted_at: deletion.deletedAt,
            reason: deletion.reason || null
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
          console.error(`❌ Erro ao migrar exclusão ${deletion.libraryName}:`, error.response?.data || error.message);
        }
      }
      
      resolve();
    });
  });
}

// Executar migração
migrateToSupabaseRobust();
