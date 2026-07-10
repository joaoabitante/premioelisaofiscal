// Taxas de câmbio USD -> moeda local, com cache e fonte reserva.
// Fonte primária: open.er-api.com (ExchangeRate-API, gratuita, sem chave).
// Reserva: frankfurter.app (BCE).

const TTL_MS = 10 * 60 * 1000; // câmbio fiat muda devagar; 10 min evita rate limit
const TIMEOUT_MS = 8000;

let cache = { rates: null, updatedAt: 0, source: null };
let inflight = null;

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrimary(currencies) {
  const data = await getJSON('https://open.er-api.com/v6/latest/USD');
  if (data.result !== 'success') throw new Error('er-api: resposta sem sucesso');
  const rates = {};
  for (const c of currencies) {
    const r = Number(data.rates?.[c]);
    if (!Number.isFinite(r) || r <= 0) throw new Error(`er-api: taxa ausente para ${c}`);
    rates[c] = r;
  }
  return { rates, source: 'exchangerate-api.com' };
}

async function fetchFallback(currencies) {
  const to = currencies.filter((c) => c !== 'USD').join(',');
  const data = await getJSON(`https://api.frankfurter.app/latest?from=USD&to=${to}`);
  const rates = {};
  for (const c of currencies) {
    if (c === 'USD') continue;
    const r = Number(data.rates?.[c]);
    if (!Number.isFinite(r) || r <= 0) throw new Error(`frankfurter: taxa ausente para ${c}`);
    rates[c] = r;
  }
  return { rates, source: 'frankfurter.app (BCE)' };
}

export async function getFxRates(currencies) {
  const now = Date.now();
  if (cache.rates && now - cache.updatedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      let result;
      try {
        result = await fetchPrimary(currencies);
      } catch {
        result = await fetchFallback(currencies);
      }
      cache = {
        rates: { ...result.rates, USD: 1 },
        updatedAt: Date.now(),
        source: result.source,
      };
    } catch (err) {
      // Mantém o cache antigo (mesmo vencido) em vez de zerar o painel.
      if (!cache.rates) throw err;
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}
