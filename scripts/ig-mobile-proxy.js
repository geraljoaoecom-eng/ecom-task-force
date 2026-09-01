// Mini-proxy HTTP/HTTPS (CONNECT) — corre no Mac ligado à hotspot móvel.
// Os pedidos ao Instagram saem por este proxy → IP MEO móvel em Portugal.
// A VPS liga-se via túnel SSH reverso e usa-o como IG_PROXY_URL.
//
// Uso: node scripts/ig-mobile-proxy.js
// Porta fixa 8899, só escuta em 127.0.0.1 (exposto à VPS apenas pelo túnel SSH).
const net = require('net');
const http = require('http');

const PORT = 8899;
const HOST = '127.0.0.1';
const AUTH = process.env.IG_PROXY_AUTH || ''; // opcional "user:pass"

function checkAuth(req) {
  if (!AUTH) return true;
  const h = req.headers['proxy-authorization'] || '';
  const expected = 'Basic ' + Buffer.from(AUTH).toString('base64');
  return h === expected;
}

const server = http.createServer((req, res) => {
  if (!checkAuth(req)) { res.writeHead(407, { 'Proxy-Authenticate': 'Basic' }); return res.end(); }
  let u;
  try { u = new URL(req.url); } catch { res.writeHead(400); return res.end(); }
  const opts = {
    host: u.hostname,
    port: u.port || 80,
    path: u.pathname + u.search,
    method: req.method,
    headers: req.headers,
  };
  const pReq = http.request(opts, (pRes) => {
    res.writeHead(pRes.statusCode, pRes.headers);
    pRes.pipe(res);
  });
  pReq.on('error', () => { try { res.writeHead(502); } catch {} res.end(); });
  req.pipe(pReq);
});

// HTTPS: tunnel CONNECT (TLS end-to-end, o proxy só passa bytes)
server.on('connect', (req, clientSocket, head) => {
  if (!checkAuth(req)) { clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic\r\n\r\n'); return clientSocket.end(); }
  const [host, port] = req.url.split(':');
  const serverSocket = net.connect(Number(port) || 443, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  serverSocket.on('error', () => clientSocket.end());
  clientSocket.on('error', () => serverSocket.end());
});

server.on('clientError', (err, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch {} });
server.listen(PORT, HOST, () => console.log(`[ig-mobile-proxy] a escutar em ${HOST}:${PORT} — pronto a servir IP móvel`));
