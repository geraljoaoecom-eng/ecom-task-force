import cron from 'node-cron';
import { refreshAllLibraries } from './libraries';

// Inicia o agendador automático
export function startScheduler(): void {
  console.log('⏰ Iniciando scheduler automático...');
  
  // Executa a cada hora (0 minutos de cada hora)
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 Executando atualização automática...');
    try {
      await refreshAllLibraries(); // Atualiza TODAS as bibliotecas
    } catch (error) {
      console.error('❌ Erro na atualização automática:', error);
    }
  });
  
  console.log('✅ Scheduler configurado para executar a cada hora - ATUALIZANDO TODAS AS BIBLIOTECAS');
}
