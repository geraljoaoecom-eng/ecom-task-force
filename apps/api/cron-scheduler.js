const LibraryUpdateService = require('./library-update-service');

class CronScheduler {
  constructor() {
    this.updateService = new LibraryUpdateService();
    this.isRunning = false;
    this.schedule = [
      { hour: 8, minute: 0, name: 'Manhã' },
      { hour: 12, minute: 0, name: 'Meio-dia' },
      { hour: 16, minute: 0, name: 'Tarde' },
      { hour: 20, minute: 0, name: 'Noite' },
      { hour: 0, minute: 0, name: 'Meia-noite' },
      { hour: 4, minute: 0, name: 'Madrugada' }
    ];
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Cron já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Iniciando cron scheduler...');
    console.log('📅 Horários programados:', this.schedule.map(s => `${s.hour}:${s.minute.toString().padStart(2, '0')} (${s.name})`).join(', '));

    // Executar verificação a cada minuto
    this.interval = setInterval(() => {
      this.checkAndExecute();
    }, 60000); // 1 minuto

    // Executar imediatamente na primeira vez (para teste)
    setTimeout(() => {
      console.log('🧪 Executando primeira verificação...');
      this.checkAndExecute();
    }, 5000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Cron scheduler parado');
  }

  async checkAndExecute() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Verificar se é hora de executar
    const shouldExecute = this.schedule.some(schedule => 
      schedule.hour === currentHour && schedule.minute === currentMinute
    );

    if (shouldExecute) {
      console.log(`⏰ Hora de executar atualização: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      await this.executeUpdate();
    }
  }

  async executeUpdate() {
    try {
      console.log('🔄 Iniciando atualização automática de bibliotecas...');
      
      const result = await this.updateService.updateAllLibraries();
      
      if (result.success) {
        console.log(`✅ Atualização automática concluída:`);
        console.log(`   👥 Usuários processados: ${result.totalUsers}`);
        console.log(`   📚 Bibliotecas processadas: ${result.totalLibraries}`);
        console.log(`   ✅ Sucessos: ${result.totalSuccess}`);
        console.log(`   ❌ Falhas: ${result.totalLibraries - result.totalSuccess}`);
      } else {
        console.error(`❌ Falha na atualização automática: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Erro crítico na atualização automática:', error.message);
    }
  }

  // Executar atualização manual (para testes)
  async executeManualUpdate() {
    console.log('🔧 Executando atualização manual...');
    return await this.executeUpdate();
  }

  // Obter status do cron
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextExecution: this.getNextExecution(),
      schedule: this.schedule
    };
  }

  getNextExecution() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    for (const schedule of this.schedule) {
      const scheduleTime = schedule.hour * 60 + schedule.minute;
      if (scheduleTime > currentTime) {
        const nextDate = new Date();
        nextDate.setHours(schedule.hour, schedule.minute, 0, 0);
        return {
          time: `${schedule.hour}:${schedule.minute.toString().padStart(2, '0')}`,
          name: schedule.name,
          date: nextDate.toISOString()
        };
      }
    }
    
    // Próxima execução é amanhã no primeiro horário
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.schedule[0].hour, this.schedule[0].minute, 0, 0);
    
    return {
      time: `${this.schedule[0].hour}:${this.schedule[0].minute.toString().padStart(2, '0')}`,
      name: this.schedule[0].name,
      date: tomorrow.toISOString()
    };
  }
}

module.exports = CronScheduler;
