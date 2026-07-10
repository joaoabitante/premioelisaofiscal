// Loop de coleta: busca preços de todas as exchanges em paralelo, calcula o
// prêmio de cada exchange local contra a referência global (mediana das
// globais em USD) e mantém o histórico em memória com persistência em disco.
//
// O prêmio segue a fórmula pedida:
//   Prêmio (%) = (Preço_Local / (Preço_Global × Taxa_Câmbio)) − 1
//
// Para exchanges globais o mesmo campo guarda o desvio da exchange contra a
// mediana global — útil para ver qual global está fora da linha.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { ASSETS, EXCHANGES, exchangeMeta } from './exchanges.js';
import { getFxRates } from './fx.js';

const MINUTE = 60_000;
const RETENTION_24H = 24 * 60 * MINUTE;
const RETENTION_7D = 7 * 24 * 60 * MINUTE;
const BUCKET_7D = 10 * MINUTE;
const PERSIST_EVERY_MS = 2 * MINUTE;
const STALE_AFTER_MS = 45_000;

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function pushBucket(arr, bucketMs, t, value, retentionMs, now) {
  const bt = Math.floor(t / bucketMs) * bucketMs;
  if (arr.length && arr[arr.length - 1][0] === bt) {
    arr[arr.length - 1][1] = value;
  } else {
    arr.push([bt, value]);
  }
  const cutoff = now - retentionMs;
  while (arr.length && arr[0][0] < cutoff) arr.shift();
}

export function createPoller({ intervalMs = 6000, dataDir = 'data' } = {}) {
  const currencies = [...new Set(EXCHANGES.map((e) => e.currency))];
  const histFile = path.join(dataDir, 'history.json');

  // hist[asset][exchangeId] = { m: [[ts, premioPct]], h: [[ts, premioPct]] }
  const hist = {};
  for (const a of ASSETS) {
    hist[a] = {};
    for (const e of EXCHANGES) hist[a][e.id] = { m: [], h: [] };
  }

  const state = {
    ts: 0,
    pollMs: intervalMs,
    assets: ASSETS,
    exchanges: exchangeMeta(),
    fx: { rates: null, updatedAt: 0, source: null },
    reference: {}, // preço USD de referência (mediana das globais) por ativo
    prices: {}, // prices[asset][exId] = { price, ts }
    premiums: {}, // premiums[asset][exId] = pct (globais: desvio vs mediana)
    errors: {}, // errors[exId] = { message, ts } quando a última coleta falhou
  };
  for (const a of ASSETS) {
    state.prices[a] = {};
    state.premiums[a] = {};
  }

  const listeners = new Set();
  let timer = null;
  let persistTimer = null;
  let dirty = false;

  async function loadHistory() {
    try {
      const raw = JSON.parse(await readFile(histFile, 'utf8'));
      if (raw?.hist) {
        for (const a of ASSETS) {
          for (const e of EXCHANGES) {
            const saved = raw.hist?.[a]?.[e.id];
            if (saved) {
              hist[a][e.id].m = Array.isArray(saved.m) ? saved.m : [];
              hist[a][e.id].h = Array.isArray(saved.h) ? saved.h : [];
            }
          }
        }
        console.log(`[hist] histórico carregado de ${histFile}`);
      }
    } catch {
      // primeiro boot ou arquivo corrompido: começa vazio
    }
  }

  async function persistHistory() {
    if (!dirty) return;
    dirty = false;
    try {
      await mkdir(dataDir, { recursive: true });
      const tmp = `${histFile}.tmp`;
      await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), hist }));
      await rename(tmp, histFile);
    } catch (err) {
      console.error('[hist] falha ao persistir histórico:', err.message);
    }
  }

  async function cycle() {
    const now = Date.now();

    const fxPromise = getFxRates(currencies).catch((err) => {
      console.error('[fx] sem taxa de câmbio:', err.message);
      return null;
    });

    const results = await Promise.all(
      EXCHANGES.map(async (ex) => {
        try {
          const prices = await ex.fetchPrices(ASSETS);
          return { ex, prices };
        } catch (err) {
          return { ex, error: err.message || String(err) };
        }
      })
    );

    const fx = await fxPromise;
    if (fx?.rates) state.fx = fx;

    for (const { ex, prices, error } of results) {
      if (error) {
        state.errors[ex.id] = { message: error, ts: now };
        continue;
      }
      delete state.errors[ex.id];
      for (const a of ASSETS) {
        const p = prices?.[a];
        if (Number.isFinite(p) && p > 0) {
          state.prices[a][ex.id] = { price: p, ts: now };
        }
      }
    }

    // Referência global por ativo: mediana das globais com preço fresco.
    for (const a of ASSETS) {
      const globals = EXCHANGES.filter((e) => e.kind === 'global')
        .map((e) => state.prices[a][e.id])
        .filter((p) => p && now - p.ts <= STALE_AFTER_MS)
        .map((p) => p.price);
      state.reference[a] = median(globals);
    }

    // Prêmios.
    const rates = state.fx.rates;
    for (const a of ASSETS) {
      const ref = state.reference[a];
      for (const ex of EXCHANGES) {
        const entry = state.prices[a][ex.id];
        let pct = null;
        if (ref && entry && rates?.[ex.currency]) {
          pct = (entry.price / (ref * rates[ex.currency]) - 1) * 100;
        }
        state.premiums[a][ex.id] = pct;

        if (pct !== null && ex.kind === 'local' && now - entry.ts <= STALE_AFTER_MS) {
          const H = hist[a][ex.id];
          pushBucket(H.m, MINUTE, now, pct, RETENTION_24H, now);
          pushBucket(H.h, BUCKET_7D, now, pct, RETENTION_7D, now);
          dirty = true;
        }
      }
    }

    state.ts = now;
    for (const cb of listeners) {
      try {
        cb(state);
      } catch {}
    }
  }

  return {
    async start() {
      await loadHistory();
      await cycle().catch((err) => console.error('[poll] ciclo falhou:', err.message));
      timer = setInterval(() => cycle().catch((err) => console.error('[poll]', err.message)), intervalMs);
      persistTimer = setInterval(persistHistory, PERSIST_EVERY_MS);
    },
    async stop() {
      clearInterval(timer);
      clearInterval(persistTimer);
      await persistHistory();
    },
    getState: () => state,
    getHistory(asset, range) {
      if (!ASSETS.includes(asset)) return null;
      const key = range === '7d' ? 'h' : 'm';
      const series = EXCHANGES.filter((e) => e.kind === 'local').map((e) => ({
        id: e.id,
        name: e.name,
        points: hist[asset][e.id][key],
      }));
      return { asset, range: range === '7d' ? '7d' : '24h', series };
    },
    onUpdate(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    staleAfterMs: STALE_AFTER_MS,
  };
}
