const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const FacebookAdsCrawler = require('./facebook-crawler');

const dbPath = path.join(__dirname, '..', '..', 'atlas.db');

class LibraryUpdateService {
  constructor() {
    this.crawler = new FacebookAdsCrawler();
    this.isProcessing = false;
    this.queue = [];
  }

  // Atualizar uma biblioteca específica
  async updateSingleLibrary(libraryId, userId) {
    console.log(`🔄 Atualizando biblioteca: ${libraryId} para usuário: ${userId}`);
    
    try {
      // Buscar dados da biblioteca
      const library = await this.getLibraryById(libraryId, userId);
      if (!library) {
        throw new Error('Biblioteca não encontrada');
      }

      // Verificar se a URL é válida
      if (!library.sourceValue || !library.sourceValue.includes('facebook.com/ads/library')) {
        throw new Error('URL inválida para Facebook Ads Library');
      }

      // Fazer scraping
      const result = await this.crawler.scrapeLibrary(
        library.sourceValue, 
        library.name, 
        userId
      );

      if (result.success) {
        // Atualizar banco de dados
        await this.updateLibraryInDatabase(libraryId, result.activeAds);
        
        // Registrar no histórico
        await this.addToHistory(libraryId, result.activeAds, userId);
        
        console.log(`✅ Biblioteca ${library.name} atualizada: ${result.activeAds} anúncios`);
        
        return {
          success: true,
          activeAds: result.activeAds,
          libraryName: library.name
        };
      } else {
        throw new Error(result.error || 'Falha no scraping');
      }

    } catch (error) {
      console.error(`❌ Erro ao atualizar biblioteca ${libraryId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Atualizar todas as bibliotecas de um usuário
  async updateUserLibraries(userId) {
    console.log(`🔄 Atualizando todas as bibliotecas do usuário: ${userId}`);
    
    try {
      const libraries = await this.getUserLibraries(userId);
      const results = [];
      
      for (const library of libraries) {
        console.log(`📚 Processando: ${library.name}`);
        
        const result = await this.updateSingleLibrary(library.id, userId);
        results.push({
          libraryId: library.id,
          libraryName: library.name,
          ...result
        });
        
        // Delay entre requisições para evitar bloqueios
        await this.delay(2000);
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Atualização concluída: ${successCount}/${libraries.length} bibliotecas`);
      
      return {
        success: true,
        totalLibraries: libraries.length,
        successCount,
        results
      };
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar bibliotecas do usuário ${userId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Atualizar todas as bibliotecas de todos os usuários (para cron)
  async updateAllLibraries() {
    if (this.isProcessing) {
      console.log('⚠️ Atualização já em andamento, pulando...');
      return;
    }
    
    this.isProcessing = true;
    console.log('🚀 Iniciando atualização global de bibliotecas...');
    
    try {
      const users = await this.getAllUsers();
      const globalResults = [];
      
      for (const user of users) {
        console.log(`👤 Processando usuário: ${user.email}`);
        
        const userResult = await this.updateUserLibraries(user.id);
        globalResults.push({
          userId: user.id,
          userEmail: user.email,
          ...userResult
        });
        
        // Delay entre usuários
        await this.delay(5000);
      }
      
      const totalLibraries = globalResults.reduce((sum, r) => sum + (r.totalLibraries || 0), 0);
      const totalSuccess = globalResults.reduce((sum, r) => sum + (r.successCount || 0), 0);
      
      console.log(`🎉 Atualização global concluída: ${totalSuccess}/${totalLibraries} bibliotecas`);
      
      return {
        success: true,
        totalUsers: users.length,
        totalLibraries,
        totalSuccess,
        results: globalResults
      };
      
    } catch (error) {
      console.error('❌ Erro na atualização global:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Funções auxiliares do banco de dados
  async getLibraryById(libraryId, userId) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.get(
        'SELECT * FROM Library WHERE id = ? AND userId = ?',
        [libraryId, userId],
        (err, row) => {
          if (err) {
            console.error('❌ Erro ao buscar biblioteca:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
          db.close();
        }
      );
    });
  }

  async getUserLibraries(userId) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.all(
        'SELECT * FROM Library WHERE userId = ? AND sourceValue LIKE "%facebook.com/ads/library%"',
        [userId],
        (err, rows) => {
          if (err) {
            console.error('❌ Erro ao buscar bibliotecas do usuário:', err.message);
            reject(err);
          } else {
            resolve(rows || []);
          }
          db.close();
        }
      );
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.all('SELECT id, email FROM User', [], (err, rows) => {
        if (err) {
          console.error('❌ Erro ao buscar usuários:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
        db.close();
      });
    });
  }

  async updateLibraryInDatabase(libraryId, activeAds) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.run(
        'UPDATE Library SET activeAds = ?, lastCheckedAt = datetime("now"), updatedAt = datetime("now") WHERE id = ?',
        [activeAds, libraryId],
        function(err) {
          if (err) {
            console.error('❌ Erro ao atualizar biblioteca no banco:', err.message);
            reject(err);
          } else {
            resolve(this.changes);
          }
          db.close();
        }
      );
    });
  }

  async addToHistory(libraryId, activeAds, userId) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      // Gerar ID único para o histórico
      const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      db.run(
        'INSERT INTO AdHistory (id, libraryId, adsCount, date) VALUES (?, ?, ?, datetime("now"))',
        [historyId, libraryId, activeAds],
        function(err) {
          if (err) {
            console.error('❌ Erro ao adicionar ao histórico:', err.message);
            reject(err);
          } else {
            console.log(`✅ Histórico adicionado: ${activeAds} anúncios para biblioteca ${libraryId}`);
            resolve(this.lastID);
          }
          db.close();
        }
      );
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    await this.crawler.close();
  }
}

module.exports = LibraryUpdateService;
