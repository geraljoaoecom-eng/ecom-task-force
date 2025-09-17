const express = require('express');
const axios = require('axios');
const cron = require('cron');
const { HttpsProxyAgent } = require('proxy-agent');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const PROXY_POOL_SIZE = parseInt(process.env.PROXY_POOL_SIZE) || 10;
const ROTATION_INTERVAL = parseInt(process.env.ROTATION_INTERVAL) || 300; // 5 minutes

let proxyList = [];
let currentProxyIndex = 0;
let proxyStats = {};

// Load proxy list from file
function loadProxyList() {
  try {
    const proxyFile = path.join(__dirname, 'proxy-list.txt');
    if (fs.existsSync(proxyFile)) {
      const content = fs.readFileSync(proxyFile, 'utf8');
      proxyList = content.split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());
      console.log(`📡 Loaded ${proxyList.length} proxies from file`);
    } else {
      console.log('⚠️ No proxy-list.txt found, using default proxies');
      // Default proxy list (you should replace with real proxies)
      proxyList = [
        'http://proxy1.example.com:8080',
        'http://proxy2.example.com:8080',
        // Add more proxies here
      ];
    }
  } catch (error) {
    console.error('❌ Error loading proxy list:', error);
    proxyList = [];
  }
}

// Test proxy connection
async function testProxy(proxyUrl) {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return {
      proxy: proxyUrl,
      ip: response.data.origin,
      status: 'working',
      lastTest: new Date(),
      responseTime: response.headers['x-response-time'] || 'N/A'
    };
  } catch (error) {
    return {
      proxy: proxyUrl,
      status: 'failed',
      error: error.message,
      lastTest: new Date()
    };
  }
}

// Get next proxy in rotation
function getNextProxy() {
  if (proxyList.length === 0) {
    return null;
  }
  
  const proxy = proxyList[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  
  // Update stats
  if (!proxyStats[proxy]) {
    proxyStats[proxy] = { requests: 0, failures: 0 };
  }
  proxyStats[proxy].requests++;
  
  return proxy;
}

// Test all proxies
async function testAllProxies() {
  console.log('🔄 Testing all proxies...');
  const results = [];
  
  for (const proxy of proxyList) {
    const result = await testProxy(proxy);
    results.push(result);
    console.log(`${result.status === 'working' ? '✅' : '❌'} ${proxy}: ${result.status}`);
  }
  
  return results;
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    proxies: proxyList.length,
    currentIndex: currentProxyIndex,
    stats: proxyStats
  });
});

app.get('/proxy', (req, res) => {
  const proxy = getNextProxy();
  if (!proxy) {
    return res.status(503).json({ error: 'No proxies available' });
  }
  
  res.json({ 
    proxy: proxy,
    index: currentProxyIndex - 1,
    stats: proxyStats[proxy]
  });
});

app.get('/proxies', (req, res) => {
  res.json({
    total: proxyList.length,
    current: currentProxyIndex,
    list: proxyList,
    stats: proxyStats
  });
});

app.post('/test-proxies', async (req, res) => {
  const results = await testAllProxies();
  res.json({ results });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 IP Rotator running on port ${PORT}`);
  console.log(`📊 Pool size: ${PROXY_POOL_SIZE}`);
  console.log(`⏰ Rotation interval: ${ROTATION_INTERVAL}s`);
  
  // Load initial proxy list
  loadProxyList();
  
  // Test proxies on startup
  testAllProxies();
  
  // Schedule periodic proxy testing
  const testJob = new cron.CronJob('0 */5 * * * *', () => {
    console.log('🔄 Periodic proxy test...');
    testAllProxies();
  });
  
  testJob.start();
});

module.exports = app;
