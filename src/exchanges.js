// Adaptadores das APIs públicas de ticker de cada exchange.
//
// Para adicionar uma exchange, acrescente um objeto ao array EXCHANGES com:
//   id        identificador curto e único
//   name      nome exibido no painel
//   kind      'global' (referência, cota em USD/USDT) ou 'local'
//   currency  moeda de cotação ('USD', 'BRL', 'MXN', 'KRW', ...)
//   region    texto exibido como origem
//   url       site da exchange
//   fees      taxas padrão em % (editáveis na UI): { trading, withdrawal }
//   fetchPrices(assets) -> Promise<{ [ativo]: preço na moeda local | null }>
//
// Nota: Binance, Bybit e OKX cotam em USDT; o painel trata USDT ≈ USD para a
// referência global (prática padrão em cálculos de kimchi premium).

export const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'USDT'];

const TIMEOUT_MS = 6000;

async function getJSON(url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'premio-cripto/1.0 (monitor open-source; +https://github.com)',
        Accept: 'application/json',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Busca 1 requisição por ativo em paralelo; falha de um ativo não derruba os demais.
async function perAsset(assets, fn) {
  const out = {};
  await Promise.all(
    assets.map(async (a) => {
      try {
        out[a] = await fn(a);
      } catch {
        out[a] = null;
      }
    })
  );
  return out;
}

export const EXCHANGES = [
  // ── Globais (referência em USD) ────────────────────────────────────────────
  {
    id: 'binance',
    name: 'Binance',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.binance.com',
    fees: { trading: 0.1, withdrawal: 0 },
    async fetchPrices(assets) {
      const wanted = assets.filter((a) => a !== 'USDT');
      const symbols = encodeURIComponent(JSON.stringify(wanted.map((a) => `${a}USDT`)));
      const data = await getJSON(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`);
      const out = {};
      for (const a of wanted) {
        const row = data.find((r) => r.symbol === `${a}USDT`);
        out[a] = row ? num(row.price) : null;
      }
      return out;
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.coinbase.com',
    fees: { trading: 0.6, withdrawal: 0 },
    fetchPrices(assets) {
      return perAsset(assets, async (a) => {
        const data = await getJSON(`https://api.exchange.coinbase.com/products/${a}-USD/ticker`);
        return num(data.price);
      });
    },
  },
  {
    id: 'kraken',
    name: 'Kraken',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.kraken.com',
    fees: { trading: 0.25, withdrawal: 0 },
    async fetchPrices(assets) {
      const pairs = assets.map((a) => (a === 'BTC' ? 'XBTUSD' : `${a}USD`)).join(',');
      const data = await getJSON(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`);
      const out = {};
      for (const [key, tick] of Object.entries(data.result || {})) {
        const asset = key.includes('USDT')
          ? 'USDT'
          : key.includes('XBT')
            ? 'BTC'
            : assets.find((a) => a !== 'USDT' && key.includes(a));
        if (asset && assets.includes(asset)) out[asset] = num(tick.c?.[0]);
      }
      return out;
    },
  },
  {
    id: 'bybit',
    name: 'Bybit',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.bybit.com',
    fees: { trading: 0.1, withdrawal: 0 },
    fetchPrices(assets) {
      return perAsset(
        assets.filter((a) => a !== 'USDT'),
        async (a) => {
          const data = await getJSON(
            `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${a}USDT`
          );
          return num(data.result?.list?.[0]?.lastPrice);
        }
      );
    },
  },
  {
    id: 'okx',
    name: 'OKX',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.okx.com',
    fees: { trading: 0.1, withdrawal: 0 },
    fetchPrices(assets) {
      return perAsset(
        assets.filter((a) => a !== 'USDT'),
        async (a) => {
          const data = await getJSON(`https://www.okx.com/api/v5/market/ticker?instId=${a}-USDT`);
          return num(data.data?.[0]?.last);
        }
      );
    },
  },
  {
    id: 'bitfinex',
    name: 'Bitfinex',
    kind: 'global',
    currency: 'USD',
    region: 'Global',
    url: 'https://www.bitfinex.com',
    fees: { trading: 0.2, withdrawal: 0 },
    async fetchPrices(assets) {
      // Na Bitfinex o ticker de USDT é "UST"
      const sym = (a) => `t${a === 'USDT' ? 'UST' : a}USD`;
      const list = assets.map(sym).join(',');
      const data = await getJSON(`https://api-pub.bitfinex.com/v2/tickers?symbols=${list}`);
      const out = {};
      for (const a of assets) {
        const row = data.find((r) => r[0] === sym(a));
        out[a] = row ? num(row[7]) : null; // índice 7 = last_price
      }
      return out;
    },
  },

  // ── Locais / regionais ─────────────────────────────────────────────────────
  {
    id: 'mercadobitcoin',
    name: 'Mercado Bitcoin',
    kind: 'local',
    currency: 'BRL',
    region: 'Brasil',
    url: 'https://www.mercadobitcoin.com.br',
    fees: { trading: 0.7, withdrawal: 0 },
    async fetchPrices(assets) {
      const symbols = assets.map((a) => `${a}-BRL`).join(',');
      const data = await getJSON(`https://api.mercadobitcoin.net/api/v4/tickers?symbols=${symbols}`);
      const out = {};
      for (const a of assets) {
        const row = data.find((r) => r.pair === `${a}-BRL`);
        out[a] = row ? num(row.last) : null;
      }
      return out;
    },
  },
  {
    id: 'foxbit',
    name: 'Foxbit',
    kind: 'local',
    currency: 'BRL',
    region: 'Brasil',
    url: 'https://foxbit.com.br',
    fees: { trading: 0.5, withdrawal: 0 },
    async fetchPrices(assets) {
      const data = await getJSON('https://api.foxbit.com.br/rest/v3/markets/ticker/24hr');
      const list = data.data || [];
      const out = {};
      for (const a of assets) {
        const row = list.find((r) => r.market_symbol === `${a.toLowerCase()}brl`);
        out[a] = row ? num(row.last_trade?.price) : null;
      }
      return out;
    },
  },
  {
    id: 'novadax',
    name: 'NovaDAX',
    kind: 'local',
    currency: 'BRL',
    region: 'Brasil',
    url: 'https://www.novadax.com.br',
    fees: { trading: 0.5, withdrawal: 0 },
    async fetchPrices(assets) {
      const data = await getJSON('https://api.novadax.com/v1/market/tickers');
      const list = data.data || [];
      const out = {};
      for (const a of assets) {
        const row = list.find((r) => r.symbol === `${a}_BRL`);
        out[a] = row ? num(row.lastPrice) : null;
      }
      return out;
    },
  },
  {
    id: 'bitso',
    name: 'Bitso',
    kind: 'local',
    currency: 'MXN',
    region: 'México',
    url: 'https://bitso.com',
    fees: { trading: 0.65, withdrawal: 0 },
    async fetchPrices(assets) {
      const data = await getJSON('https://api.bitso.com/v3/ticker/');
      const list = data.payload || [];
      const out = {};
      for (const a of assets) {
        const row = list.find((r) => r.book === `${a.toLowerCase()}_mxn`);
        out[a] = row ? num(row.last) : null;
      }
      return out;
    },
  },
  {
    id: 'upbit',
    name: 'Upbit',
    kind: 'local',
    currency: 'KRW',
    region: 'Coreia do Sul',
    url: 'https://upbit.com',
    fees: { trading: 0.05, withdrawal: 0 },
    async fetchPrices(assets) {
      const markets = assets.map((a) => `KRW-${a}`).join(',');
      const data = await getJSON(`https://api.upbit.com/v1/ticker?markets=${markets}`);
      const out = {};
      for (const a of assets) {
        const row = data.find((r) => r.market === `KRW-${a}`);
        out[a] = row ? num(row.trade_price) : null;
      }
      return out;
    },
  },
  {
    id: 'bithumb',
    name: 'Bithumb',
    kind: 'local',
    currency: 'KRW',
    region: 'Coreia do Sul',
    url: 'https://www.bithumb.com',
    fees: { trading: 0.25, withdrawal: 0 },
    async fetchPrices(assets) {
      const data = await getJSON('https://api.bithumb.com/public/ticker/ALL_KRW');
      if (data.status !== '0000') throw new Error(`Bithumb status ${data.status}`);
      const out = {};
      for (const a of assets) {
        out[a] = num(data.data?.[a]?.closing_price);
      }
      return out;
    },
  },
];

export function exchangeMeta() {
  return EXCHANGES.map(({ id, name, kind, currency, region, url, fees }) => ({
    id,
    name,
    kind,
    currency,
    region,
    url,
    fees,
  }));
}
