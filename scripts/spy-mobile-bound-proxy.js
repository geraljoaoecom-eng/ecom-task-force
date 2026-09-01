/**
 * Proxy HTTP CONNECT local — tráfego Meta sai pela interface USB do iPhone.
 * Mac pode ficar em Wi-Fi; só o browser SPY usa este proxy.
 */
const path = require('path');
const net = require('net');
const http = require('http');
const { findIphoneUsbInterface } = require(path.join(__dirname, '../apps/api/spy-mobile-usb-iface'));

const PORT = parseInt(process.env.SPY_MOBILE_BOUND_PROXY_PORT || '9790', 10) || 9790;
const HOST = '127.0.0.1';

function getBindAddress() {
  if (process.env.SPY_MOBILE_BIND_IP?.trim()) {
    return process.env.SPY_MOBILE_BIND_IP.trim();
  }
  const iface = findIphoneUsbInterface();
  return iface?.address || null;
}

function createBoundProxyServer(bindAddress) {
  const server = http.createServer((req, res) => {
    let u;
    try {
      u = new URL(req.url);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    const opts = {
      host: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: req.method,
      headers: req.headers,
      localAddress: bindAddress,
    };
    const pReq = http.request(opts, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res);
    });
    pReq.on('error', (err) => {
      try {
        res.writeHead(502);
        res.end(err.message || 'proxy error');
      } catch {
        // ignore
      }
    });
    req.pipe(pReq);
  });

  server.on('connect', (req, clientSocket, head) => {
    const [host, portStr] = String(req.url || '').split(':');
    const port = Number(portStr) || 443;
    const serverSocket = net.connect({
      host,
      port,
      localAddress: bindAddress,
    });
    serverSocket.on('connect', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', () => clientSocket.end());
    clientSocket.on('error', () => serverSocket.end());
  });

  server.on('clientError', (_err, socket) => {
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch {
      // ignore
    }
  });

  return server;
}

let serverInstance = null;
let bindInfo = null;

function ensureMobileBoundProxy() {
  if (serverInstance && bindInfo) {
    return Promise.resolve({ ok: true, ...bindInfo });
  }

  const bindAddress = getBindAddress();
  if (!bindAddress) {
    return Promise.resolve({
      ok: false,
      reason: 'iPhone USB nao detectado — liga o cabo USB e activa Partilha de Internet no iPhone',
    });
  }

  return new Promise((resolve) => {
    const server = createBoundProxyServer(bindAddress);
    server.on('error', (err) => {
      resolve({ ok: false, reason: err.message || 'Erro ao iniciar proxy USB' });
    });
    server.listen(PORT, HOST, () => {
      serverInstance = server;
      bindInfo = {
        bindAddress,
        port: PORT,
        proxyUrl: `http://${HOST}:${PORT}`,
      };
      console.log(`📱 SPY proxy USB — ${bindAddress} → ${bindInfo.proxyUrl}`);
      resolve({ ok: true, ...bindInfo });
    });
  });
}

function stopMobileBoundProxy() {
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch {
      // ignore
    }
    serverInstance = null;
    bindInfo = null;
  }
}

function getProxyUrl() {
  return bindInfo?.proxyUrl || null;
}

module.exports = {
  ensureMobileBoundProxy,
  stopMobileBoundProxy,
  getBindAddress,
  getProxyUrl,
};
