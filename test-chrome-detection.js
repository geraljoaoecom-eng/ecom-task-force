#!/usr/bin/env node

/**
 * Script de teste para verificar se o Chrome/Chromium está sendo detectado
 * Execute: node test-chrome-detection.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 Teste de Detecção do Chrome/Chromium');
console.log('═══════════════════════════════════════════════════════\n');

// Função para encontrar Chrome (mesma do código)
function findChrome() {
  const possiblePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  console.log('📁 Verificando caminhos conhecidos...\n');
  
  for (const path of possiblePaths) {
    process.stdout.write(`   Testando: ${path} ... `);
    if (fs.existsSync(path)) {
      console.log('✅ ENCONTRADO!');
      return path;
    }
    console.log('❌');
  }

  console.log('\n🔎 Tentando comando "which"...\n');
  
  try {
    const chromePath = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf8' }).trim();
    if (chromePath && fs.existsSync(chromePath)) {
      console.log(`   ✅ Encontrado via which: ${chromePath}`);
      return chromePath;
    }
  } catch (e) {
    console.log('   ❌ Comando "which" não encontrou Chrome');
  }

  return null;
}

// Executar teste
const chromePath = findChrome();

console.log('\n═══════════════════════════════════════════════════════');
if (chromePath) {
  console.log('✅ SUCESSO! Chrome encontrado em:');
  console.log(`   ${chromePath}`);
  
  // Tentar obter versão
  console.log('\n📋 Informações da versão:');
  try {
    const version = execSync(`"${chromePath}" --version`, { encoding: 'utf8' }).trim();
    console.log(`   ${version}`);
  } catch (e) {
    console.log('   ⚠️ Não foi possível obter a versão');
  }
  
  console.log('\n🎉 O Puppeteer conseguirá usar este Chrome!');
  console.log('   O scraper deve funcionar corretamente.');
  
} else {
  console.log('❌ ERRO! Chrome não encontrado!');
  console.log('\n📝 Soluções:');
  console.log('\n1. Instalar Chromium:');
  console.log('   sudo apt-get update');
  console.log('   sudo apt-get install -y chromium-browser');
  console.log('\n2. OU instalar Google Chrome:');
  console.log('   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -');
  console.log('   sudo sh -c \'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list\'');
  console.log('   sudo apt-get update');
  console.log('   sudo apt-get install -y google-chrome-stable');
}
console.log('═══════════════════════════════════════════════════════\n');

// Informações adicionais do sistema
console.log('ℹ️  Informações do Sistema:\n');
console.log(`   SO: ${process.platform}`);
console.log(`   Arquitetura: ${process.arch}`);
console.log(`   Node.js: ${process.version}`);
console.log('');

// Teste do Puppeteer (se Chrome foi encontrado)
if (chromePath) {
  console.log('🧪 Testando Puppeteer...\n');
  
  const puppeteer = require('puppeteer');
  
  (async () => {
    try {
      console.log('   Iniciando browser...');
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      
      console.log('   ✅ Browser iniciado com sucesso!');
      
      const page = await browser.newPage();
      console.log('   ✅ Página criada!');
      
      await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 10000 });
      console.log('   ✅ Navegação funcionando!');
      
      const title = await page.title();
      console.log(`   📄 Título da página: "${title}"`);
      
      await browser.close();
      console.log('   ✅ Browser fechado!\n');
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 TUDO FUNCIONANDO PERFEITAMENTE!');
      console.log('   O scraper está pronto para uso.');
      console.log('═══════════════════════════════════════════════════════\n');
      
    } catch (error) {
      console.log('   ❌ Erro ao testar Puppeteer:');
      console.log(`   ${error.message}\n`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('⚠️  O Chrome foi encontrado mas há um erro ao executá-lo.');
      console.log('   Possíveis causas:');
      console.log('   - Faltam dependências do sistema');
      console.log('   - Problemas de memória');
      console.log('\n   Tente instalar as dependências:');
      console.log('   sudo apt-get install -y fonts-liberation libappindicator3-1');
      console.log('   libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3');
      console.log('   libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1');
      console.log('   libxdamage1 libxrandr2 xdg-utils');
      console.log('═══════════════════════════════════════════════════════\n');
    }
  })();
} else {
  console.log('⚠️  Pulando teste do Puppeteer (Chrome não encontrado)\n');
}

