#!/usr/bin/env node

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testProxy(proxyUrl, index) {
  try {
    console.log(`${colors.blue}🔄 Testando proxy ${index + 1}...${colors.reset}`);
    
    const agent = new HttpsProxyAgent(proxyUrl);
    const startTime = Date.now();
    
    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const responseTime = Date.now() - startTime;
    const ip = response.data.origin;
    
    console.log(`${colors.green}✅ Proxy ${index + 1} OK${colors.reset}`);
    console.log(`   IP: ${ip}`);
    console.log(`   Tempo: ${responseTime}ms`);
    console.log(`   URL: ${proxyUrl.split('@')[1]}`);
    
    return {
      index: index + 1,
      proxy: proxyUrl,
      ip: ip,
      status: 'working',
      responseTime: responseTime
    };
    
  } catch (error) {
    console.log(`${colors.red}❌ Proxy ${index + 1} FALHOU${colors.reset}`);
    console.log(`   Erro: ${error.message}`);
    console.log(`   URL: ${proxyUrl.split('@')[1]}`);
    
    return {
      index: index + 1,
      proxy: proxyUrl,
      status: 'failed',
      error: error.message
    };
  }
}

async function testAllProxies() {
  console.log(`${colors.yellow}🚀 ECOM Task Force - Teste de Proxies${colors.reset}`);
  console.log('=====================================\n');
  
  // Carregar lista de proxies
  let proxyList = [];
  try {
    const content = fs.readFileSync('proxy-list.txt', 'utf8');
    proxyList = content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.trim());
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao carregar proxy-list.txt: ${error.message}${colors.reset}`);
    return;
  }
  
  if (proxyList.length === 0) {
    console.error(`${colors.red}❌ Nenhum proxy encontrado no arquivo${colors.reset}`);
    return;
  }
  
  console.log(`${colors.blue}📡 Testando ${proxyList.length} proxies...${colors.reset}\n`);
  
  const results = [];
  const workingProxies = [];
  const failedProxies = [];
  
  // Testar cada proxy
  for (let i = 0; i < proxyList.length; i++) {
    const result = await testProxy(proxyList[i], i);
    results.push(result);
    
    if (result.status === 'working') {
      workingProxies.push(result);
    } else {
      failedProxies.push(result);
    }
    
    // Pausa entre testes para não sobrecarregar
    if (i < proxyList.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(''); // Linha em branco
  }
  
  // Resumo
  console.log(`${colors.yellow}📊 RESUMO DOS TESTES${colors.reset}`);
  console.log('==================');
  console.log(`${colors.green}✅ Funcionando: ${workingProxies.length}${colors.reset}`);
  console.log(`${colors.red}❌ Falhando: ${failedProxies.length}${colors.reset}`);
  console.log(`📈 Taxa de sucesso: ${Math.round((workingProxies.length / proxyList.length) * 100)}%`);
  
  if (workingProxies.length > 0) {
    console.log(`\n${colors.green}🎯 PROXIES FUNCIONAIS:${colors.reset}`);
    workingProxies.forEach(proxy => {
      console.log(`   ${proxy.index}. ${proxy.ip} (${proxy.responseTime}ms)`);
    });
  }
  
  if (failedProxies.length > 0) {
    console.log(`\n${colors.red}⚠️ PROXIES COM PROBLEMA:${colors.reset}`);
    failedProxies.forEach(proxy => {
      console.log(`   ${proxy.index}. ${proxy.proxy.split('@')[1]} - ${proxy.error}`);
    });
  }
  
  // Salvar resultados
  const report = {
    timestamp: new Date().toISOString(),
    total: proxyList.length,
    working: workingProxies.length,
    failed: failedProxies.length,
    successRate: Math.round((workingProxies.length / proxyList.length) * 100),
    results: results
  };
  
  fs.writeFileSync('proxy-test-report.json', JSON.stringify(report, null, 2));
  console.log(`\n📄 Relatório salvo em: proxy-test-report.json`);
  
  if (workingProxies.length >= 5) {
    console.log(`\n${colors.green}🎉 Sistema pronto para deploy!${colors.reset}`);
    console.log(`${colors.green}   ${workingProxies.length} proxies funcionais detectados${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️ Apenas ${workingProxies.length} proxies funcionais.${colors.reset}`);
    console.log(`${colors.yellow}   Recomendado: pelo menos 5 proxies para rotação eficiente${colors.reset}`);
  }
}

// Executar teste
testAllProxies().catch(console.error);
