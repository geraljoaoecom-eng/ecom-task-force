const fs = require('fs');
const path = require('path');

console.log('🧹 Iniciando limpeza do projeto...\n');

// Arquivos para mover para pasta de backup
const filesToBackup = [
  'simple-server-production-backup.js',
  'server-production.js',
  'server-hostinger.js',
  'atlas.db.backup-20251009-165942',
  'migrate-admin-libraries.js',
  'migrate-clean.js',
  'migrate-complete.js',
  'migrate-fixed.js',
  'migrate-robust.js',
  'migrate-to-supabase-api.js',
  'migrate-to-supabase.js',
  'create-tables-direct.js',
  'create-tables-supabase.js',
  'setup-supabase-simple.js',
  'setup-supabase.js',
  'test-connection.js',
  'test-supabase-access.js',
  'taskforce-deploy.tar.gz'
];

// Criar pasta de backup
const backupDir = path.join(process.cwd(), '_backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log('✅ Pasta _backup criada');
}

// Mover arquivos
let movedCount = 0;
filesToBackup.forEach(file => {
  const sourcePath = path.join(process.cwd(), file);
  const destPath = path.join(backupDir, file);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.renameSync(sourcePath, destPath);
      console.log(`📦 Movido: ${file}`);
      movedCount++;
    } catch (error) {
      console.log(`⚠️ Não foi possível mover: ${file}`);
    }
  }
});

console.log(`\n✅ Limpeza concluída! ${movedCount} arquivos movidos para _backup/`);
console.log('\n💡 Dica: Você pode deletar a pasta _backup se não precisar mais dos arquivos antigos');

