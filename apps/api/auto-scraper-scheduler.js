const { updateAllLibraries } = require('./library-scraper-service');

class AutoScraperScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    
    // Horários (24h) — 4×/dia, de 6 em 6h. A fiabilidade real vem do
    // library-refresh-scheduler (catch-up), resistente a restarts da API.
    this.schedule = [
      { hour: 0, minute: 0, name: 'Meia-noite' },
      { hour: 6, minute: 0, name: 'Madrugada' },
      { hour: 12, minute: 0, name: 'Meio-dia' },
      { hour: 18, minute: 0, name: 'Tarde' }
    ];
    
    this.lastExecution = null;
    this.nextExecution = null;
    this.totalExecutions = 0;
  }

  /**
   * Iniciar o scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler já está rodando');
      return;
    }

    this.isRunning = true;
    this.nextExecution = this.calculateNextExecution();
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🤖 SISTEMA DE SCRAPING AUTOMÁTICO INICIADO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📅 Horários programados:`);
    this.schedule.forEach(s => {
      console.log(`   • ${s.hour.toString().padStart(2, '0')}:${s.minute.toString().padStart(2, '0')} - ${s.name}`);
    });
    console.log(`⏰ Próxima execução: ${this.nextExecution.time} (${this.nextExecution.name})`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verificar a cada minuto se é hora de executar
    this.intervalId = setInterval(() => {
      this.checkAndExecute();
    }, 60000); // 1 minuto
    
    // Executar uma vez imediatamente para teste (opcional)
    if (process.env.SCRAPER_IMMEDIATE_START === 'true') {
      console.log('🧪 Execução imediata de teste...\n');
      setTimeout(() => {
        this.executeUpdate();
      }, 5000);
    }
  }

  /**
   * Parar o scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Sistema de scraping automático parado\n');
  }

  /**
   * Verificar se é hora de executar
   */
  async checkAndExecute() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Verificar se algum horário programado corresponde ao atual
    const shouldExecute = this.schedule.some(schedule => 
      schedule.hour === currentHour && schedule.minute === currentMinute
    );

    if (shouldExecute) {
      const scheduleName = this.schedule.find(
        s => s.hour === currentHour && s.minute === currentMinute
      ).name;
      
      console.log(`\n⏰ HORÁRIO DE EXECUÇÃO: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${scheduleName})`);
      await this.executeUpdate();
      
      // Calcular próxima execução
      this.nextExecution = this.calculateNextExecution();
      console.log(`⏰ Próxima execução: ${this.nextExecution.time} (${this.nextExecution.name})\n`);
    }
  }

  /**
   * Executar atualização de bibliotecas
   */
  async executeUpdate() {
    try {
      this.lastExecution = new Date();
      this.totalExecutions++;
      
      console.log(`🔄 Execução #${this.totalExecutions} iniciada às ${this.lastExecution.toLocaleString('pt-BR')}`);
      
      const result = await updateAllLibraries();
      
      if (result.success) {
        console.log(`✅ Atualização automática #${this.totalExecutions} concluída com sucesso!`);
      } else {
        console.error(`❌ Atualização automática #${this.totalExecutions} falhou: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Erro crítico na atualização automática:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Executar atualização manual (para testes/admin)
   */
  async executeManualUpdate() {
    console.log('\n🔧 EXECUÇÃO MANUAL INICIADA\n');
    return await this.executeUpdate();
  }

  /**
   * Calcular próxima execução
   */
  calculateNextExecution() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Encontrar próximo horário
    for (const schedule of this.schedule) {
      const scheduleMinutes = schedule.hour * 60 + schedule.minute;
      
      if (scheduleMinutes > currentMinutes) {
        const nextDate = new Date();
        nextDate.setHours(schedule.hour, schedule.minute, 0, 0);
        
        return {
          time: `${schedule.hour.toString().padStart(2, '0')}:${schedule.minute.toString().padStart(2, '0')}`,
          name: schedule.name,
          date: nextDate.toISOString(),
          timestamp: nextDate.getTime()
        };
      }
    }
    
    // Se não encontrou hoje, é amanhã no primeiro horário
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.schedule[0].hour, this.schedule[0].minute, 0, 0);
    
    return {
      time: `${this.schedule[0].hour.toString().padStart(2, '0')}:${this.schedule[0].minute.toString().padStart(2, '0')}`,
      name: this.schedule[0].name,
      date: tomorrow.toISOString(),
      timestamp: tomorrow.getTime()
    };
  }

  /**
   * Obter status do scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastExecution: this.lastExecution ? this.lastExecution.toISOString() : null,
      nextExecution: this.nextExecution,
      totalExecutions: this.totalExecutions,
      schedule: this.schedule.map(s => ({
        time: `${s.hour.toString().padStart(2, '0')}:${s.minute.toString().padStart(2, '0')}`,
        name: s.name
      }))
    };
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    const uptime = this.isRunning && this.lastExecution 
      ? Date.now() - this.lastExecution.getTime()
      : 0;
      
    return {
      isRunning: this.isRunning,
      totalExecutions: this.totalExecutions,
      lastExecution: this.lastExecution,
      nextExecution: this.nextExecution,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime)
    };
  }

  /**
   * Formatar uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

module.exports = AutoScraperScheduler;

