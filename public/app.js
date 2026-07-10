/* Prêmio Cripto — frontend (sem dependências).
   Consome /api/stream (SSE) com fallback para polling de /api/state. */

'use strict';

// ═════════ Doação ═════════
const DONATE = {
  projectsUrl: 'https://github.com/joaoabitante', // "conheça meus projetos"
  items: [
    { label: 'LiveTip', value: 'https://livetip.gg/libertcontador' },
  ],
};

// Cores por exchange local (paleta categórica validada p/ fundo escuro;
// a cor segue a exchange, nunca a posição na tabela).
const SERIES_COLORS = {
  mercadobitcoin: '#3987e5',
  foxbit: '#d95926',
  novadax: '#9085e9',
  bitso: '#199e70',
  upbit: '#c98500',
  bithumb: '#d55181',
};
const EXTRA_COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#d55181', '#d95926'];
let extraIdx = 0;
const colorOf = (id) => SERIES_COLORS[id] || (SERIES_COLORS[id] = EXTRA_COLORS[extraIdx++ % EXTRA_COLORS.length]);

// ═════════ Estado ═════════
const store = {
  get: (k, fb) => {
    try { const v = localStorage.getItem('pc.' + k); return v === null ? fb : JSON.parse(v); }
    catch { return fb; }
  },
  set: (k, v) => { try { localStorage.setItem('pc.' + k, JSON.stringify(v)); } catch {} },
};

let S = null;                              // último estado do servidor
let asset = store.get('asset', 'BTC');
let range = store.get('range', '24h');
let history = null;                        // dados de /api/history
let showNet = store.get('net', false);
let hiddenSeries = new Set(store.get('hidden', []));
let feesOv = store.get('fees', {});        // { exId: {trading, withdrawal}, _ref: 0.10 }
let alertCfg = Object.assign({ threshold: 2, notify: false, sound: true }, store.get('alerts', {}));
let alertLog = store.get('alertLog', []);
const lastAlertAt = new Map();             // "ativo:exchange" -> ts (cooldown)
const ALERT_COOLDOWN = 5 * 60_000;

const $ = (id) => document.getElementById(id);

// ═════════ Formatação (pt-BR) ═════════
const priceDigits = (v) => (v >= 10000 ? 0 : v >= 100 ? 2 : v >= 1 ? 4 : 6);

function fmtPrice(v, currency) {
  if (!Number.isFinite(v)) return '—';
  const d = currency === 'KRW' ? 0 : priceDigits(v);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(v);
}

function fmtPct(v, { sign = true, digits = 2 } = {}) {
  if (!Number.isFinite(v)) return '—';
  const s = v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (sign && v > 0 ? '+' : '') + s + '%';
}

function fmtAge(ms) {
  if (ms < 1500) return 'agora';
  if (ms < 60_000) return `há ${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return `há ${Math.round(ms / 60_000)} min`;
  return `há ${Math.round(ms / 3_600_000)} h`;
}

const fmtTime = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDayTime = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ═════════ Taxas / prêmio líquido ═════════
const feeOf = (ex) => ({
  trading: feesOv[ex.id]?.trading ?? ex.fees.trading,
  withdrawal: feesOv[ex.id]?.withdrawal ?? ex.fees.withdrawal,
});
const refFee = () => feesOv._ref ?? 0.1;

function netPremium(ex, grossPct) {
  if (!Number.isFinite(grossPct)) return null;
  const f = feeOf(ex);
  return grossPct - f.trading - f.withdrawal - refFee();
}

// ═════════ Conexão (SSE + fallback polling) ═════════
let es = null;
let pollTimer = null;

function setConn(mode) {
  const el = $('conn');
  el.className = 'conn ' + (mode === 'live' ? 'live' : mode === 'down' ? 'down' : '');
  el.querySelector('.conn-label').textContent =
    mode === 'live' ? 'ao vivo' : mode === 'poll' ? 'polling' : mode === 'down' ? 'sem conexão' : 'conectando…';
}

function onState(state) {
  S = state;
  restartPollBar();
  renderAll();
  checkAlerts();
}

// barra fina no topo indicando o próximo ciclo de coleta
function restartPollBar() {
  const bar = $('pollBar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.transform = 'scaleX(1)';
  void bar.offsetWidth;
  bar.style.transition = `transform ${S.pollMs || 6000}ms linear`;
  bar.style.transform = 'scaleX(0)';
}

function connect() {
  es = new EventSource('/api/stream');
  es.addEventListener('state', (ev) => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    setConn('live');
    onState(JSON.parse(ev.data));
  });
  es.onerror = () => {
    setConn('poll');
    if (!pollTimer) {
      pollTimer = setInterval(async () => {
        try {
          const r = await fetch('/api/state');
          onState(await r.json());
          setConn('poll');
        } catch { setConn('down'); }
      }, 7000);
    }
  };
}

async function fetchHistory() {
  try {
    const r = await fetch(`/api/history?asset=${asset}&range=${range}`);
    history = await r.json();
    renderChart();
    if (S) renderTable(); // sparklines da tabela usam o mesmo histórico
  } catch { /* mantém o gráfico anterior */ }
}

// ═════════ Tiles ═════════
function renderTiles() {
  const locals = S.exchanges.filter((e) => e.kind === 'local');
  const rows = locals
    .map((e) => ({ e, pct: S.premiums[asset]?.[e.id] }))
    .filter((r) => Number.isFinite(r.pct));
  rows.sort((a, b) => b.pct - a.pct);
  const hi = rows[0], lo = rows[rows.length - 1];
  const ref = S.reference[asset];
  const fx = S.fx?.rates || {};

  const pctTile = (r) => r
    ? { v: fmtPct(r.pct), cls: r.pct >= 0 ? 'pos' : 'neg', sub: r.e.name }
    : { v: '—', cls: '', sub: 'sem dados' };
  const h = pctTile(hi), l = pctTile(lo);

  // janela de arbitragem: comprar na local mais barata, vender na mais cara
  const windowOk = hi && lo && hi.e.id !== lo.e.id;
  const win = windowOk
    ? { v: fmtPct(hi.pct - lo.pct, { sign: false }), sub: `compre ${lo.e.name} → venda ${hi.e.name}` }
    : { v: '—', sub: 'aguardando 2+ exchanges' };

  $('tiles').innerHTML = `
    <div class="tile tile-hero"><div class="tile-label">Janela de arbitragem (${asset})</div>
      <div class="tile-value">${win.v}</div><div class="tile-sub">${win.sub}</div></div>
    <div class="tile"><div class="tile-label">Maior prêmio</div>
      <div class="tile-value ${h.cls}">${h.v}</div><div class="tile-sub">${h.sub}</div></div>
    <div class="tile"><div class="tile-label">Menor prêmio</div>
      <div class="tile-value ${l.cls}">${l.v}</div><div class="tile-sub">${l.sub}</div></div>
    <div class="tile"><div class="tile-label">Referência global (mediana)</div>
      <div class="tile-value">${fmtPrice(ref, 'USD')}</div><div class="tile-sub">${asset}/USD</div></div>
    <div class="tile"><div class="tile-label">Câmbio (USD →)</div>
      <div class="tile-value">${fx.BRL ? 'R$ ' + fx.BRL.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'}</div>
      <div class="tile-sub">MXN ${fx.MXN ? fx.MXN.toFixed(2) : '—'} · KRW ${fx.KRW ? Math.round(fx.KRW).toLocaleString('pt-BR') : '—'}</div></div>`;
}

// ═════════ Tabela (linhas persistentes p/ atualização suave) ═════════
const rowCache = new Map(); // exId -> { tr, cells, lastPrice }

function makeRow(ex) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="ex-name"><span class="ex-chip"></span><a href="${ex.url}" target="_blank" rel="noopener">${ex.name}</a></span></td>
    <td class="market">${ex.currency} · ${ex.region}</td>
    <td class="num price-cell"></td>
    <td class="num price-usd"></td>
    <td class="num premium-cell"></td>
    <td class="num premium-net col-net"></td>
    <td class="num spark-cell"></td>
    <td class="num age"></td>
    <td><span class="status"><span class="status-dot"></span><span class="status-text"></span></span></td>`;
  tr.querySelector('.ex-chip').style.background = ex.kind === 'local' ? colorOf(ex.id) : 'var(--muted)';
  const cells = {
    price: tr.querySelector('.price-cell'),
    usd: tr.querySelector('.price-usd'),
    premium: tr.querySelector('.premium-cell'),
    net: tr.querySelector('.premium-net'),
    spark: tr.querySelector('.spark-cell'),
    age: tr.querySelector('.age'),
    status: tr.querySelector('.status'),
    statusText: tr.querySelector('.status-text'),
  };
  return { tr, cells, lastPrice: null };
}

function setPremiumCell(el, pct) {
  if (!Number.isFinite(pct)) {
    el.innerHTML = '<span class="na">—</span>';
    return;
  }
  const pos = pct >= 0;
  el.innerHTML = `<span class="pill ${pos ? 'pos' : 'neg'}"><span class="arrow">${pos ? '▲' : '▼'}</span>${fmtPct(pct)}</span>`;
}

// mini-gráfico de tendência do prêmio (últimas 3 h) para a linha da tabela
function sparkline(points, w = 88, h = 26) {
  const cutoff = Date.now() - 3 * 3_600_000;
  const pts = (points || []).filter((p) => p[0] >= cutoff);
  if (pts.length < 2) return '<span class="na">—</span>';
  const vs = pts.map((p) => p[1]);
  let min = Math.min(...vs, 0), max = Math.max(...vs, 0);
  if (max - min < 1e-9) { max += 0.01; min -= 0.01; }
  const x = (i) => 2 + (i / (pts.length - 1)) * (w - 4);
  const y = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6);
  let d = '';
  for (let i = 0; i < pts.length; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pts[i][1]).toFixed(1)}`;
  const last = vs[vs.length - 1];
  const color = last >= 0 ? 'var(--up)' : 'var(--down)';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <line x1="2" x2="${w - 2}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

function renderTable() {
  const now = S.ts;
  const staleMs = S.staleAfterMs || 45_000;
  const rates = S.fx?.rates || {};
  $('tableAsset').textContent = asset;
  $('priceTable').classList.toggle('show-net', showNet);
  $('netNote').hidden = !showNet;

  const locals = S.exchanges.filter((e) => e.kind === 'local');
  const globals = S.exchanges.filter((e) => e.kind === 'global');

  const localRows = locals.map((e) => ({ e, pct: S.premiums[asset]?.[e.id] }));
  localRows.sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity)); // maior prêmio primeiro

  const update = (ex, pct, tbody) => {
    let rc = rowCache.get(ex.id);
    if (!rc) { rc = makeRow(ex); rowCache.set(ex.id, rc); }
    const entry = S.prices[asset]?.[ex.id];
    const err = S.errors?.[ex.id];
    const age = entry ? now - entry.ts : Infinity;
    const price = entry?.price;

    // preço + flash suave na direção do movimento
    if (Number.isFinite(price)) {
      if (rc.lastPrice !== null && price !== rc.lastPrice) {
        rc.cells.price.classList.remove('flash-up', 'flash-down');
        void rc.cells.price.offsetWidth; // reinicia a animação
        rc.cells.price.classList.add(price > rc.lastPrice ? 'flash-up' : 'flash-down');
      }
      rc.lastPrice = price;
      rc.cells.price.textContent = fmtPrice(price, ex.currency);
      const rate = rates[ex.currency];
      rc.cells.usd.textContent = rate ? fmtPrice(price / rate, 'USD') : '—';
    } else {
      rc.cells.price.textContent = '—';
      rc.cells.usd.textContent = '—';
    }

    setPremiumCell(rc.cells.premium, pct);
    setPremiumCell(rc.cells.net, ex.kind === 'local' ? netPremium(ex, pct) : NaN);
    if (ex.kind === 'local' && history && history.asset === asset) {
      rc.cells.spark.innerHTML = sparkline(history.series.find((s) => s.id === ex.id)?.points);
    } else if (ex.kind === 'global') {
      rc.cells.spark.innerHTML = '<span class="na">—</span>';
    }
    rc.cells.age.textContent = entry ? fmtAge(age) : '—';

    // status: OK / instável (preço velho ou erro com preço antigo) / offline
    let st = 'ok', label = 'OK', title = '';
    if (!entry && err) { st = 'off'; label = 'offline'; title = err.message; }
    else if (!entry) { st = 'warn'; label = 'sem par'; }
    else if (age > staleMs || err) { st = 'warn'; label = 'instável'; title = err?.message || 'preço sem atualização'; }
    rc.cells.status.className = 'status ' + st;
    rc.cells.statusText.textContent = label;
    rc.cells.status.title = title;
    rc.tr.classList.toggle('stale', st !== 'ok' && !!entry);
    rc.tr.classList.toggle('alert-row',
      ex.kind === 'local' && Number.isFinite(pct) && Math.abs(pct) >= alertCfg.threshold);

    tbody.appendChild(rc.tr); // appendChild move a linha => reordenação sem recriar
  };

  const tbL = $('tbodyLocal'), tbG = $('tbodyGlobal');
  document.querySelectorAll('.skel-row').forEach((r) => r.remove());
  for (const { e, pct } of localRows) update(e, pct, tbL);
  for (const e of globals) update(e, S.premiums[asset]?.[e.id], tbG);
}

// ═════════ Gráfico SVG (multi-série, crosshair + tooltip) ═════════
const CHART_H = 320;
const MARGIN = { l: 54, r: 148, t: 14, b: 26 };
const MARGIN_NARROW = { l: 48, r: 10, t: 14, b: 26 }; // sem rótulos diretos no mobile

function chartSeries() {
  if (!history || history.asset !== asset) return [];
  const bucket = range === '7d' ? 600_000 : 60_000;
  return history.series
    .filter((s) => !hiddenSeries.has(s.id))
    .map((s) => {
      let pts = s.points;
      // anexa o valor ao vivo para o gráfico não "parar" entre refetches
      const live = S?.premiums[asset]?.[s.id];
      if (Number.isFinite(live) && S.ts) {
        const last = pts[pts.length - 1];
        if (!last || S.ts - last[0] > 5000) pts = [...pts, [S.ts, live]];
      }
      return { id: s.id, name: s.name, color: colorOf(s.id), pts, bucket };
    })
    .filter((s) => s.pts.length > 0);
}

function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || mag * 10;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

let chartGeom = null; // p/ crosshair: { x(t), y(v), series, x0, x1, w }

function renderChart() {
  const svg = $('chart');
  $('chartAsset').textContent = asset;
  const W = svg.clientWidth || 800;
  svg.setAttribute('viewBox', `0 0 ${W} ${CHART_H}`);
  renderLegend();

  const series = chartSeries();
  const now = Date.now();
  const rangeMs = range === '7d' ? 7 * 86_400_000 : 86_400_000;
  const t0 = now - rangeMs, t1 = now;

  const all = series.flatMap((s) => s.pts.filter((p) => p[0] >= t0).map((p) => p[1]));
  if (!all.length) {
    svg.innerHTML = `<text class="chart-empty" x="${W / 2}" y="${CHART_H / 2}" text-anchor="middle">Coletando histórico… os pontos aparecem conforme o servidor acumula dados.</text>`;
    chartGeom = null;
    return;
  }

  let vMin = Math.min(0, ...all), vMax = Math.max(0, ...all);
  const pad = (vMax - vMin || 1) * 0.12;
  vMin -= pad; vMax += pad;

  const M = W < 640 ? MARGIN_NARROW : MARGIN;
  const iw = W - M.l - M.r;
  const ih = CHART_H - M.t - M.b;
  const x = (t) => M.l + ((t - t0) / (t1 - t0)) * iw;
  const y = (v) => M.t + (1 - (v - vMin) / (vMax - vMin)) * ih;

  let g = '';

  // gridlines + eixo Y (%)
  for (const v of niceTicks(vMin, vMax)) {
    const yy = y(v);
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${yy}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>`;
    g += `<text x="${M.l - 8}" y="${yy + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${fmtPct(v, { digits: Math.abs(v) < 1 ? 2 : 1 })}</text>`;
  }
  // linha do zero destacada (paridade com a referência global)
  if (vMin < 0 && vMax > 0) {
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--baseline)" stroke-width="1.5"/>`;
  }
  // eixo X (tempo)
  const xStep = range === '7d' ? 86_400_000 : 4 * 3_600_000;
  for (let t = Math.ceil(t0 / xStep) * xStep; t <= t1; t += xStep) {
    g += `<text x="${x(t)}" y="${CHART_H - 8}" text-anchor="middle" fill="var(--muted)" font-size="11">${
      range === '7d' ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : fmtTime(t)
    }</text>`;
  }

  // séries (quebra o traço quando há buraco na coleta)
  const labels = [];
  for (const s of series) {
    const pts = s.pts.filter((p) => p[0] >= t0 - s.bucket);
    if (!pts.length) continue;
    let d = '', prevT = null;
    for (const [t, v] of pts) {
      const cmd = prevT === null || t - prevT > s.bucket * 3 ? 'M' : 'L';
      d += `${cmd}${x(Math.max(t, t0)).toFixed(1)},${y(v).toFixed(1)}`;
      prevT = t;
    }
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const [lt, lv] = pts[pts.length - 1];
    labels.push({ y: y(lv), color: s.color, text: `${s.name} ${fmtPct(lv)}`, name: s.name });
  }

  // rótulos diretos no fim da linha, sem sobreposição (só quando há espaço)
  if (M.r > 40) {
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
    }
    for (const lb of labels) {
      g += `<text x="${W - M.r + 8}" y="${lb.y + 4}" fill="${lb.color}" font-size="11.5" font-weight="600">${lb.text}</text>`;
    }
  }

  svg.innerHTML = g;
  chartGeom = { x, y, series, t0, t1, W, iw, M };
}

function renderLegend() {
  if (!history) return;
  $('legend').innerHTML = history.series
    .map((s) => {
      const live = S?.premiums[asset]?.[s.id];
      return `<button class="legend-item ${hiddenSeries.has(s.id) ? 'off' : ''}" data-id="${s.id}" type="button">
        <span class="ex-chip" style="background:${colorOf(s.id)}"></span>${s.name}
        <span class="lv">${fmtPct(live)}</span></button>`;
    })
    .join('');
}

$('legend').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.legend-item');
  if (!btn) return;
  const id = btn.dataset.id;
  hiddenSeries.has(id) ? hiddenSeries.delete(id) : hiddenSeries.add(id);
  store.set('hidden', [...hiddenSeries]);
  renderChart();
});

// crosshair + tooltip
const chartBox = $('chartBox');
chartBox.addEventListener('mousemove', (ev) => {
  const tip = $('chartTip');
  if (!chartGeom) { tip.hidden = true; return; }
  const rect = chartBox.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const scale = chartGeom.W / rect.width; // viewBox vs. tamanho renderizado
  const t = chartGeom.t0 + ((px * scale - chartGeom.M.l) / chartGeom.iw) * (chartGeom.t1 - chartGeom.t0);
  if (t < chartGeom.t0 || t > chartGeom.t1) { tip.hidden = true; drawCrosshair(null); return; }

  const rows = [];
  for (const s of chartGeom.series) {
    let best = null;
    for (const p of s.pts) { // séries têm no máx. ~1450 pontos; busca linear é ok
      if (best === null || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    }
    if (best && Math.abs(best[0] - t) <= s.bucket * 2) rows.push({ s, v: best[1] });
  }
  if (!rows.length) { tip.hidden = true; drawCrosshair(null); return; }
  rows.sort((a, b) => b.v - a.v);

  tip.innerHTML = `<div class="tip-time">${range === '7d' ? fmtDayTime(t) : fmtTime(t)}</div>` +
    rows.map(({ s, v }) =>
      `<div class="tip-row"><span class="tip-name"><span class="ex-chip" style="background:${s.color}"></span>${s.name}</span><b class="${v >= 0 ? 'pos' : 'neg'}">${fmtPct(v)}</b></div>`
    ).join('');
  tip.hidden = false;
  const tipW = tip.offsetWidth || 160;
  tip.style.left = Math.min(px + 14, rect.width - tipW - 6) + 'px';
  tip.style.top = Math.max(ev.clientY - rect.top - 20, 4) + 'px';
  drawCrosshair(chartGeom.x(t)); // coord. no viewBox (viewBox = largura do render)
});
chartBox.addEventListener('mouseleave', () => { $('chartTip').hidden = true; drawCrosshair(null); });

function drawCrosshair(xPos) {
  let line = $('chart').querySelector('.crosshair');
  if (xPos === null) { line?.remove(); return; }
  if (!line) {
    line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'crosshair');
    line.setAttribute('stroke', 'var(--muted)');
    line.setAttribute('stroke-dasharray', '3,3');
    line.setAttribute('y1', MARGIN.t);
    line.setAttribute('y2', CHART_H - MARGIN.b);
    $('chart').appendChild(line);
  }
  line.setAttribute('x1', xPos);
  line.setAttribute('x2', xPos);
}

// ═════════ Alertas ═════════
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    o.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(gain).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.4);
  } catch {}
}

function checkAlerts() {
  const now = Date.now();
  const staleMs = S.staleAfterMs || 45_000;
  for (const a of S.assets) {
    for (const ex of S.exchanges) {
      if (ex.kind !== 'local') continue;
      const pct = S.premiums[a]?.[ex.id];
      const entry = S.prices[a]?.[ex.id];
      if (!Number.isFinite(pct) || !entry || now - entry.ts > staleMs) continue;
      if (Math.abs(pct) < alertCfg.threshold) continue;
      const key = `${a}:${ex.id}`;
      if (now - (lastAlertAt.get(key) || 0) < ALERT_COOLDOWN) continue;
      lastAlertAt.set(key, now);
      fireAlert({ t: now, asset: a, ex: ex.name, pct });
    }
  }
}

function fireAlert(item) {
  alertLog.unshift(item);
  alertLog = alertLog.slice(0, 50);
  store.set('alertLog', alertLog);
  renderAlertLog();
  showToast(item);
  if (alertCfg.sound) beep();
  if (alertCfg.notify && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`⚡ ${item.asset} em ${item.ex}: prêmio ${fmtPct(item.pct)}`, {
      body: `Acima do limite de ${alertCfg.threshold}% — confira o painel.`,
    });
  }
}

// toast deslizante — some sozinho depois de 6 s
function showToast(item) {
  const box = $('toasts');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = `⚡ <b>${item.asset}</b> em ${item.ex}: prêmio <b class="${item.pct >= 0 ? 'pos' : 'neg'}">${fmtPct(item.pct)}</b>
    <small>acima do limite de ${alertCfg.threshold}%</small>`;
  box.appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 350);
  }, 6000);
}

function renderAlertLog() {
  const el = $('alertLog');
  if (!alertLog.length) { el.innerHTML = '<li class="empty">Nenhum alerta ainda.</li>'; return; }
  el.innerHTML = alertLog
    .map((i) => `<li><span>${i.asset} · ${i.ex} <b class="${i.pct >= 0 ? 'pos' : 'neg'}">${fmtPct(i.pct)}</b></span><span class="when">${fmtDayTime(i.t)}</span></li>`)
    .join('');
}

function bindAlertControls() {
  const th = $('alertThreshold'), no = $('alertNotify'), so = $('alertSound');
  th.value = alertCfg.threshold;
  no.checked = alertCfg.notify;
  so.checked = alertCfg.sound;
  th.addEventListener('change', () => {
    alertCfg.threshold = Math.max(0.1, Number(th.value) || 2);
    store.set('alerts', alertCfg);
    if (S) renderTable();
  });
  no.addEventListener('change', async () => {
    if (no.checked && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') no.checked = false;
    }
    alertCfg.notify = no.checked;
    store.set('alerts', alertCfg);
  });
  so.addEventListener('change', () => { alertCfg.sound = so.checked; store.set('alerts', alertCfg); });
}

// ═════════ Modal de taxas ═════════
function openFees() {
  const body = $('feesBody');
  body.innerHTML = S.exchanges
    .map((ex) => {
      const f = feeOf(ex);
      return `<tr><td>${ex.name} <small style="color:var(--muted)">${ex.kind === 'global' ? 'global' : ex.region}</small></td>
        <td class="num"><input type="number" min="0" step="0.05" data-ex="${ex.id}" data-k="trading" value="${f.trading}"></td>
        <td class="num"><input type="number" min="0" step="0.05" data-ex="${ex.id}" data-k="withdrawal" value="${f.withdrawal}"></td></tr>`;
    })
    .join('');
  $('refFee').value = refFee();
  $('feesModal').showModal();
}

function bindFees() {
  $('btnFees').addEventListener('click', openFees);
  $('feesClose').addEventListener('click', () => $('feesModal').close());
  $('feesModal').addEventListener('input', (ev) => {
    const inp = ev.target;
    if (inp.id === 'refFee') {
      feesOv._ref = Math.max(0, Number(inp.value) || 0);
    } else if (inp.dataset.ex) {
      feesOv[inp.dataset.ex] = feesOv[inp.dataset.ex] || {};
      feesOv[inp.dataset.ex][inp.dataset.k] = Math.max(0, Number(inp.value) || 0);
    }
    store.set('fees', feesOv);
    if (S) renderTable();
  });
  $('feesReset').addEventListener('click', () => {
    feesOv = {};
    store.set('fees', feesOv);
    openFees();
    if (S) renderTable();
  });
}

// ═════════ Doação ═════════
function bindDonate() {
  $('donateList').innerHTML = DONATE.items
    .map((i) => {
      const v = i.value.startsWith('https://')
        ? `<a class="d-value" href="${i.value}" target="_blank" rel="noopener noreferrer">${i.value.replace('https://', '')}</a>`
        : `<span class="d-value">${i.value}</span>`;
      return `<li><span class="d-label">${i.label}</span>${v}
        <button class="copy-btn" data-copy="${i.value}" type="button">copiar</button></li>`;
    })
    .join('');
  $('linkProjects').href = DONATE.projectsUrl;
  $('linkProjectsModal').href = DONATE.projectsUrl;
  const open = () => $('donateModal').showModal();
  $('btnDonate').addEventListener('click', open);
  $('btnDonateFooter').addEventListener('click', open);
  $('donateClose').addEventListener('click', () => $('donateModal').close());
  $('donateList').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.copy-btn');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'copiado ✓';
      setTimeout(() => (btn.textContent = 'copiar'), 1500);
    } catch {}
  });
}

// ═════════ Abas / controles ═════════
function renderTabs() {
  if (!S) return;
  $('assetTabs').innerHTML = S.assets
    .map((a) => `<button class="asset-tab ${a === asset ? 'active' : ''}" data-asset="${a}" type="button">${a}</button>`)
    .join('');
}

$('assetTabs').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.asset-tab');
  if (!btn || btn.dataset.asset === asset) return;
  asset = btn.dataset.asset;
  store.set('asset', asset);
  renderTabs();
  renderAll();
  fetchHistory();
});

document.querySelectorAll('.range-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    if (btn.dataset.range === range) return;
    range = btn.dataset.range;
    store.set('range', range);
    document.querySelectorAll('.range-btn').forEach((b) => b.classList.toggle('active', b === btn));
    fetchHistory();
  })
);

$('netToggle').addEventListener('change', (ev) => {
  showNet = ev.target.checked;
  store.set('net', showNet);
  if (S) renderTable();
});

// ═════════ Render principal ═════════
function renderAll() {
  if (!S) return;
  if (!$('assetTabs').children.length) renderTabs();
  renderTiles();
  renderTable();
  renderChart();
  $('fxSource').textContent = S.fx?.source || '—';
}

function init() {
  document.querySelectorAll('.range-btn').forEach((b) => b.classList.toggle('active', b.dataset.range === range));
  $('netToggle').checked = showNet;
  bindAlertControls();
  bindFees();
  bindDonate();
  renderAlertLog();
  connect();
  fetchHistory();
  setInterval(fetchHistory, 60_000);
  setInterval(() => { if (S) renderTable(); }, 5000); // mantém o "há Xs" fresco
  window.addEventListener('resize', () => renderChart());
}

init();
