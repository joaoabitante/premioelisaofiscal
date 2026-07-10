// Prêmio Cripto — servidor HTTP sem dependências (Node >= 18).
// Atua como proxy/cache das APIs públicas das exchanges (resolve CORS e
// rate limit: cada exchange é consultada 1x por ciclo, independentemente de
// quantos navegadores estejam conectados) e serve o painel estático.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPoller } from './src/poller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;
const POLL_MS = Math.max(3000, Number(process.env.POLL_MS) || 6000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const poller = createPoller({ intervalMs: POLL_MS, dataDir: path.join(__dirname, 'data') });

const sseClients = new Set();
poller.onUpdate((state) => {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const res of sseClients) res.write(payload);
});

// Headers de segurança/privacidade em toda resposta: sem sniffing de tipo,
// sem referrer vazando para terceiros, sem embutir o painel em iframes.
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...SEC_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      ...SEC_HEADERS,
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { ...SEC_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — não encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/state') {
    return sendJSON(res, 200, { ...poller.getState(), staleAfterMs: poller.staleAfterMs });
  }

  if (url.pathname === '/api/history') {
    const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
    const range = url.searchParams.get('range') || '24h';
    const data = poller.getHistory(asset, range);
    if (!data) return sendJSON(res, 400, { error: `ativo desconhecido: ${asset}` });
    return sendJSON(res, 200, data);
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      ...SEC_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(`event: state\ndata: ${JSON.stringify(poller.getState())}\n\n`);
    sseClients.add(res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return;
  }

  return serveStatic(res, url.pathname);
});

await poller.start();
server.listen(PORT, () => {
  console.log(`⚡ Prêmio Cripto rodando em http://localhost:${PORT} (coleta a cada ${POLL_MS / 1000}s)`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await poller.stop();
    process.exit(0);
  });
}
