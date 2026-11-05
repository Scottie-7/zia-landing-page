/**
 * Author: Scottie Dunnavan
 * Sonar UI: Data layer + Panel renderers + TradingView Advanced Chart Integration + Screener Engine.
 */
const Sonar = (() => {
const API_BASE = "";
const DATA_SOURCE = "sample"; // "sample" | "api"
const Q = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const dp = p => p < 1 ? 4 : 2, tk = p => p < 1 ? 1e-4 : 0.01;
const f = (n, d = 2) => Number(n).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const cmp = new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits: 1});
const safe = p => Promise.resolve(p).catch(() => null);

const TIP = {
  iceberg_absorption: "ICEBERG_ABSORPTION (+1): Aggressive print >= $10k with AIR >= 1.0.",
  unexecuted_depletion: "UNEXECUTED_DEPLETION (-1): Visible size fell >= $10k with AIR <= 0.05."
};

// ---------- SAMPLE PROVIDERS ----------
const SYMS = {
  ONEG: ["Oneg Holdings", 2.41, 108.15], CHOW: ["Chow Therapeutics", 1.18, 64.2], SGRX: ["Sygrx Biosciences", 0.86, 41.7],
  KLNR: ["Kilner Robotics", 5.32, 22.4], VRTA: ["Verta Minerals", 3.07, 12.9], TRBO: ["Turbo Marine", 0.62, 7.2],
  NOVA: ["Novara Labs", 4.4, -9.6], PLZN: ["Plaz Networks", 1.74, -18.3]
};

const SCREENER_DATA = [
  { symbol: "ONEG", price: 2.41, pct: 108.15, vol: 14200000, rvol: 8.4, float: 2.8, mcap: 18.5, cat: "FDA Phase 2", low: 1.12, high: 2.65 },
  { symbol: "CHOW", price: 1.18, pct: 64.20, vol: 8900000, rvol: 5.2, float: 4.1, mcap: 12.2, cat: "Earnings Surge", low: 0.70, high: 1.25 },
  { symbol: "SGRX", price: 0.86, pct: 41.70, vol: 6400000, rvol: 3.8, float: 1.9, mcap: 8.4, cat: "Contract Win", low: 0.60, high: 0.94 },
  { symbol: "KLNR", price: 5.32, pct: 22.40, vol: 3200000, rvol: 2.6, float: 8.5, mcap: 45.1, cat: "Patents Granted", low: 4.30, high: 5.60 },
  { symbol: "VRTA", price: 3.07, pct: 12.90, vol: 2100000, rvol: 1.8, float: 6.2, mcap: 28.0, cat: "PR Momentum", low: 2.70, high: 3.15 },
  { symbol: "TRBO", price: 0.62, pct: 7.20, vol: 1500000, rvol: 1.4, float: 3.4, mcap: 5.1, cat: "Volume Spike", low: 0.57, high: 0.65 },
  { symbol: "NOVA", price: 4.40, pct: -9.60, vol: 1800000, rvol: 2.1, float: 12.0, mcap: 52.8, cat: "Offering", low: 4.20, high: 4.90 },
  { symbol: "PLZN", price: 1.74, pct: -18.30, vol: 4100000, rvol: 4.5, float: 5.8, mcap: 15.6, cat: "Downgrade", low: 1.68, high: 2.20 }
];

const base = s => SYMS[s] || ["Sample " + s, 1 + (hash(s) % 700) / 100, (hash(s) % 40) - 12];

const S = {
  movers: () => Object.keys(SYMS).map(k => { const r = rng(hash(k)), [name, price, pct] = SYMS[k];
    return {symbol: k, name, price, pct_change: pct, volume: Math.round(2e5 + r() * 9e6), rvol: +(1 + r() * 5).toFixed(1), mkt_cap: Math.round(2e7 + r() * 4e8), session: "regular"}; }),
  
  book: symbol => {
    const mid = base(symbol)[1], t = tk(mid), r = rng(hash(symbol) + Math.floor(Date.now() / 2000)), events = [];
    const makeLevels = (dir) => {
      let p = mid + dir * (t * 0.5);
      return Array.from({length: 6}, () => {
        const x = {price: +p.toFixed(dp(mid)), size: Math.round((1 + r() * 25) ** 1.3) * 100};
        p += dir * t;
        return x;
      });
    };
    const asks = makeLevels(1);
    const bids = makeLevels(-1);
    
    if (r() < 0.6) events.push({side: "bid", price: bids[Math.floor(r() * 3)].price, type: "iceberg_absorption"});
    if (r() < 0.6) events.push({side: "ask", price: asks[Math.floor(r() * 3)].price, type: "unexecuted_depletion"});
    
    return {symbol, ts: Date.now(), mid, bids, asks, events};
  },
  
  tape: symbol => {
    const mid = base(symbol)[1], r = rng(hash(symbol) + Math.floor(Date.now() / 2000)); let t = Date.now();
    return Array.from({length: 12}, () => { t -= r() * 2500; return {t: Math.round(t), price: +(mid + (r() - 0.5) * tk(mid) * 4).toFixed(dp(mid)), size: Math.round(1 + r() ** 2 * 20) * 100, side: r() > 0.47 ? "buy" : "sell"}; });
  },
  
  probs: symbol => {
    const r = rng(hash(symbol)), up = 0.31 + r() * 0.2, dn = 0.2 + r() * 0.15;
    return {horizon_s: 180, p_down: +dn.toFixed(3), p_neutral: +(1 - up - dn).toFixed(3), p_up: +up.toFixed(3), calibrated: true};
  },
  
  status: () => ({state: "online", grid_ms: 100, book_age_ms: Math.round(18 + Math.random() * 25), dropped_rows: 0})
};

// ---------- PROVIDER SWITCH ----------
const live = DATA_SOURCE === "api";
const get = path => fetch(API_BASE + path, {credentials: "same-origin"}).then(r => { if (!r.ok) throw r.status; return r.json(); });
const P = {
  getMovers: () => live ? get("/api/movers") : S.movers(),
  getBook: s => live ? get(`/api/book/${s}`) : S.book(s),
  getTape: s => live ? get(`/api/tape/${s}`) : S.tape(s),
  getProbabilities: s => live ? get(`/api/probs/${s}`) : S.probs(s),
  getStatus: () => live ? get("/api/status") : S.status()
};

// ---------- RENDERERS ----------
const st = {sym: "ONEG", tf: "5m", tab: "gainers", screenerFilter: "all"};
let movers = [];

function renderTVChart(symbol, tf) {
  const container = $("#tradingview_chart");
  if (!container) return;

  if (typeof TradingView === "undefined") {
    setTimeout(() => renderTVChart(symbol, tf), 100);
    return;
  }
  
  const tfMap = { "1m": "1", "5m": "5", "15m": "15", "1D": "D" };
  const interval = tfMap[tf] || "5";
  const formattedSymbol = symbol.includes(":") ? symbol : `NASDAQ:${symbol}`;

  container.innerHTML = "";
  try {
    new TradingView.widget({
      "autosize": true,
      "symbol": formattedSymbol,
      "interval": interval,
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#080C14",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": true,
      "studies": [
        "Volume@tv-basicstudies",
        "VWAP@tv-basicstudies",
        "Moving Average Ribbon@tv-basicstudies"
      ],
      "container_id": "tradingview_chart"
    });
  } catch (e) {
    console.error("TradingView init error:", e);
  }
  const csymEl = $("#csym");
  if (csymEl) csymEl.textContent = `${st.sym} · ${st.tf}`;
}

function drawMovers() {
  const moversEl = $("#movers");
  if (!moversEl) return;
  const rows = {gainers: m => m.filter(x => x.pct_change > 0).sort((a, b) => b.pct_change - a.pct_change), losers: m => m.filter(x => x.pct_change < 0).sort((a, b) => a.pct_change - b.pct_change), active: m => [...m].sort((a, b) => b.volume - a.volume)}[st.tab];
  moversEl.innerHTML = rows(movers).map(m => `<tr data-s="${m.symbol}" tabindex="0" class="cursor-pointer border-t border-slate-800/60 hover:bg-slate-800/60 ${m.symbol === st.sym ? "bg-slate-800/80" : ""}">
    <td class="py-1.5 pl-2"><div class="font-semibold text-slate-200">${m.symbol}${m.pct_change >= 5 && m.rvol >= 2 ? ' <span class="t2" title="Meets Tier 2 rule">T2</span>' : ""}</div><div class="truncate max-w-[90px] text-[10px] text-slate-400">${m.name}</div></td>
    <td class="text-right text-slate-300">${f(m.price, dp(m.price))}</td><td class="text-right ${m.pct_change >= 0 ? "text-emerald-400" : "text-rose-400"}">${m.pct_change >= 0 ? "+" : ""}${f(m.pct_change)}%</td>
    <td class="text-right text-slate-400">${cmp.format(m.volume)}</td><td class="text-right pr-2 text-slate-400">${m.rvol.toFixed(1)}</td></tr>`).join("");
}

function drawScreener() {
  const tbody = $("#screener-tbody");
  if (!tbody) return;

  let filtered = SCREENER_DATA;
  if (st.screenerFilter === "low-float") filtered = SCREENER_DATA.filter(x => x.float < 5.0);
  else if (st.screenerFilter === "high-rvol") filtered = SCREENER_DATA.filter(x => x.rvol >= 3.0);
  else if (st.screenerFilter === "micro-cap") filtered = SCREENER_DATA.filter(x => x.price < 5.0);

  tbody.innerHTML = filtered.map(row => `
    <tr data-s="${row.symbol}" class="hover:bg-slate-800/60 cursor-pointer transition-colors ${row.symbol === st.sym ? "bg-slate-800/80" : ""}">
      <td class="py-2 px-2 font-bold text-slate-100 flex items-center gap-1.5">
        <span class="text-cyan-400">${row.symbol}</span>
        ${row.float < 3.0 ? '<span class="text-[9px] bg-rose-950 text-rose-400 border border-rose-800 px-1 rounded">MICRO FLOAT</span>' : ''}
      </td>
      <td class="text-right py-2 px-2 text-slate-200">${f(row.price, dp(row.price))}</td>
      <td class="text-right py-2 px-2 font-bold ${row.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${row.pct >= 0 ? '+' : ''}${f(row.pct)}%</td>
      <td class="text-right py-2 px-2 text-slate-300">${cmp.format(row.vol)}</td>
      <td class="text-right py-2 px-2 font-semibold ${row.rvol >= 3.0 ? 'text-cyan-400' : 'text-slate-300'}">${row.rvol.toFixed(1)}x</td>
      <td class="text-right py-2 px-2 text-slate-300">${row.float}M</td>
      <td class="text-right py-2 px-2 text-slate-300">$${row.mcap}M</td>
      <td class="text-center py-2 px-2"><span class="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">${row.cat}</span></td>
      <td class="text-right py-2 px-2 text-slate-400 text-[11px]">${f(row.low, dp(row.low))} - ${f(row.high, dp(row.high))}</td>
    </tr>
  `).join("");
}

function drawBook(b) {
  const ladderEl = $("#ladder");
  if (!b || !ladderEl) return;
  const d = dp(b.mid), mid = b.mid;
  const asks = [...b.asks].slice(0, 5).reverse();
  const bids = [...b.bids].slice(0, 5);
  const maxSz = Math.max(...asks.map(x => x.size), ...bids.map(x => x.size), 1);

  let html = `
    <div class="font-mono text-xs bg-slate-950/90 rounded border border-slate-800 overflow-hidden">
      <div class="grid grid-cols-3 text-slate-400 py-1.5 px-2 border-b border-slate-800 text-[10px] uppercase font-semibold text-center bg-slate-900/80">
        <span class="text-left text-emerald-400">Bid Size</span>
        <span class="text-slate-300">Price ($)</span>
        <span class="text-right text-rose-400">Ask Size</span>
      </div>
      <div class="space-y-0.5 p-1">
  `;

  asks.forEach(ask => {
    const w = Math.min(100, (ask.size / maxSz) * 100);
    const ev = b.events.find(e => e.side === "ask" && Math.abs(e.price - ask.price) < 1e-4);
    const ice = ev && ev.type[0] === "i";
    html += `
      <div class="grid grid-cols-3 items-center py-0.5 px-1 relative text-[11px] h-6">
        <div class="text-left text-slate-600">-</div>
        <div class="text-center text-rose-400 font-bold font-mono">${f(ask.price, d)}</div>
        <div class="text-left text-slate-200 relative font-mono pl-2">
          <div class="absolute left-0 top-0 bottom-0 bg-rose-500/25 rounded-sm pointer-events-none" style="width: ${w}%"></div>
          <span class="relative z-10">${ask.size.toLocaleString()}</span>
          ${ev ? `<b class="ev ${ice ? "cy" : "am"} absolute -left-5 top-1" title="${TIP[ev.type]}">${ice ? "+1" : "−1"}</b>` : ""}
        </div>
      </div>
    `;
  });

  const spread = asks.length && bids.length ? asks[asks.length - 1].price - bids[0].price : 0.01;
  html += `
    <div class="my-1.5 grid grid-cols-3 items-center py-1 bg-slate-900/90 border-y border-cyan-500/30 text-[10px] px-1 font-mono">
      <span class="text-slate-400 text-left pl-1">SPR: ${f(spread, d)}</span>
      <span class="text-center text-cyan-400 font-bold">${f(mid, d)}</span>
      <span class="text-right text-slate-500 pr-1"></span>
    </div>
  `;

  bids.forEach(bid => {
    const w = Math.min(100, (bid.size / maxSz) * 100);
    const ev = b.events.find(e => e.side === "bid" && Math.abs(e.price - bid.price) < 1e-4);
    const ice = ev && ev.type[0] === "i";
    html += `
      <div class="grid grid-cols-3 items-center py-0.5 px-1 relative text-[11px] h-6">
        <div class="text-right text-slate-200 relative font-mono pr-2">
          <div class="absolute right-0 top-0 bottom-0 bg-emerald-500/25 rounded-sm pointer-events-none" style="width: ${w}%"></div>
          <span class="relative z-10">${bid.size.toLocaleString()}</span>
          ${ev ? `<b class="ev ${ice ? "cy" : "am"} absolute -right-5 top-1" title="${TIP[ev.type]}">${ice ? "+1" : "−1"}</b>` : ""}
        </div>
        <div class="text-center text-emerald-400 font-bold font-mono">${f(bid.price, d)}</div>
        <div class="text-right text-slate-600">-</div>
      </div>
    `;
  });

  html += `</div></div>`;
  ladderEl.innerHTML = html;
}

function drawTape(t) {
  const tapeEl = $("#tape");
  if (t && tapeEl) tapeEl.innerHTML = t.map(x => `<div class="flex justify-between ${x.side === "buy" ? "text-emerald-400" : "text-amber-400"}"><span>${new Date(x.t).toLocaleTimeString("en-US", {hour12: false})}</span><span>${f(x.price, dp(x.price))}</span><span>${x.size.toLocaleString()}</span></div>`).join("");
}

function drawProbs(p) {
  const probsEl = $("#probs");
  if (!probsEl) return;
  p = p || {p_down: 0.3, p_neutral: 0.4, p_up: 0.3};
  probsEl.innerHTML = [["Down", p.p_down, "bg-amber-500"], ["Neutral", p.p_neutral, "bg-slate-500"], ["Up", p.p_up, "bg-emerald-500"]].map(([n, v, c]) =>
    `<div class="flex items-center gap-2 text-xs"><span class="w-14 text-slate-300 font-medium">${n}</span><div class="flex-1 h-2 rounded bg-slate-800/80 overflow-hidden"><div class="${c} h-2 rounded" style="width:${v * 100}%"></div></div><span class="mono w-12 text-right text-slate-200">${(v * 100).toFixed(1)}%</span></div>`).join("");
}

function drawStatus(s) {
  s = s || {state: "online", grid_ms: 100, book_age_ms: 25, dropped_rows: 0}; 
  const on = s.state === "online";
  const pillEl = $("#pill"), healthEl = $("#health"), dropEl = $("#drop");
  if (pillEl) pillEl.innerHTML = `<span class="dot ${on ? "on" : ""}"></span><span>Grid Active · ${s.grid_ms}ms · Ping 14ms</span>`;
  if (healthEl) healthEl.innerHTML = [["Grid Aligner", s.grid_ms + " ms"], ["Book Age", s.book_age_ms + " ms"], ["Dropped Rows", s.dropped_rows]].map(([k, v]) => `<div class="flex justify-between"><dt class="text-slate-400">${k}</dt><dd class="text-slate-200">${v}</dd></div>`).join("");
  if (dropEl) {
    dropEl.classList.toggle("hidden", !(s.dropped_rows > 0));
    dropEl.textContent = `DATA DROP · ${s.dropped_rows} rows dropped this session`;
  }
}

function sess() {
  const sessEl = $("#sess");
  if (!sessEl) return;
  const p = new Intl.DateTimeFormat("en-US", {timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23"}).formatToParts(new Date()), g = t => +p.find(x => x.type === t).value, m = g("hour") * 60 + g("minute");
  sessEl.textContent = m < 240 || m >= 1200 ? "Closed" : m < 570 ? "Premarket" : m < 960 ? "Regular" : "After-hours";
}

async function refresh() {
  const s = st.sym, [b, t, p, u] = await Promise.all([safe(P.getBook(s)), safe(P.getTape(s)), safe(P.getProbabilities(s)), safe(P.getStatus())]);
  if (s === st.sym) { drawBook(b); drawTape(t); drawProbs(p); drawStatus(u); }
}

function setSym(s) { 
  st.sym = s.toUpperCase(); 
  const qEl = $("#q");
  if (qEl) qEl.value = st.sym; 
  drawMovers(); 
  drawScreener();
  renderTVChart(st.sym, st.tf); 
  refresh(); 
}

async function init() {
  renderTVChart(st.sym, st.tf);
  const all = a => document.querySelectorAll(a);
  all("[data-tab]").forEach(b => b.onclick = () => { st.tab = b.dataset.tab; all("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); drawMovers(); });
  all("[data-tf]").forEach(b => b.onclick = () => { st.tf = b.dataset.tf; all("[data-tf]").forEach(x => x.classList.toggle("on", x === b)); renderTVChart(st.sym, st.tf); });
  
  // Screener Filter Event Binding
  const screenerFilters = document.querySelectorAll("#screener-filters [data-filter]");
  screenerFilters.forEach(b => b.onclick = () => {
    st.screenerFilter = b.dataset.filter;
    screenerFilters.forEach(x => x.classList.toggle("on", x === b));
    drawScreener();
  });

  const qfEl = $("#qf");
  if (qfEl) qfEl.onsubmit = e => { e.preventDefault(); const v = $("#q").value.trim(); if (v) setSym(v); };
  
  const pick = e => { const r = e.target.closest("tr"); if (r && (e.type === "click" || e.key === "Enter")) setSym(r.dataset.s); };
  const moversEl = $("#movers");
  if (moversEl) { moversEl.onclick = pick; moversEl.onkeydown = pick; }
  
  const screenerEl = $("#screener-tbody");
  if (screenerEl) { screenerEl.onclick = pick; screenerEl.onkeydown = pick; }

  sess(); setInterval(sess, 6e4);
  movers = (await safe(P.getMovers())) || []; 
  drawMovers();
  drawScreener();
  refresh(); setInterval(refresh, 2000);
}
return {init, setSym, P};
})();