/**
 * Author: Scottie Dunnavan
 * Sonar UI: Data layer + Panel renderers + TradingView Advanced Chart Integration.
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
const base = s => SYMS[s] || ["Sample " + s, 1 + (hash(s) % 700) / 100, (hash(s) % 40) - 12];

const S = {
  book: symbol => {
    const mid = base(symbol)[1], t = tk(mid), r = rng(hash(symbol) + Math.floor(Date.now() / 2000)), events = [];
    const lv = dir => { let p = mid + dir * t * 0.5; return Array.from({length: 10}, () => { const x = {price: +p.toFixed(dp(mid)), size: Math.round((1 + r() * 25) ** 1.3) * 100}; p += dir * t * (r() > 0.7 ? 2 : 1); return x; }); };
    const venues = {NSDQ: {bids: lv(-1), asks: lv(1)}, ARCA: {bids: lv(-1), asks: lv(1)}};
    if (r() < 0.7) events.push({venue: "ARCA", side: "bid", price: venues.ARCA.bids[Math.floor(r() * 4)].price, type: "iceberg_absorption"});
    if (r() < 0.7) events.push({venue: "NSDQ", side: "ask", price: venues.NSDQ.asks[Math.floor(r() * 4)].price, type: "unexecuted_depletion"});
    return {symbol, ts: Date.now(), mid, bids: venues.NSDQ.bids, asks: venues.NSDQ.asks, venues, events};
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
  getBook: s => live ? get(`/api/book/${s}`) : S.book(s),
  getTape: s => live ? get(`/api/tape/${s}`) : S.tape(s),
  getProbabilities: s => live ? get(`/api/probs/${s}`) : S.probs(s),
  getStatus: () => live ? get("/api/status") : S.status()
};

// ---------- RENDERERS ----------
const st = {sym: "ONEG", tf: "1m"};

function renderTVChart(symbol, tf) {
  const container = $("#tradingview_chart");
  if (!container) return;

  if (typeof TradingView === "undefined") {
    setTimeout(() => renderTVChart(symbol, tf), 100);
    return;
  }
  
  const tfMap = { "1m": "1", "5m": "5", "15m": "15", "1D": "D" };
  const interval = tfMap[tf] || "1";
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
  if (s === st.sym) { drawBook(b); drawTape(t); drawProbs(p); drawStatus(u); document.dispatchEvent(new CustomEvent("sonar:tick", {detail: {sym: s, tf: st.tf, book: b, tape: t, probs: p, status: u}})); }
}

function setSym(s) { 
  st.sym = s.toUpperCase(); 
  const qEl = $("#q");
  if (qEl) qEl.value = st.sym; 
  renderTVChart(st.sym, st.tf); 
  refresh(); 
}

async function init() {
  renderTVChart(st.sym, st.tf);
  const all = a => document.querySelectorAll(a);
  all("[data-tf]").forEach(b => b.onclick = () => { st.tf = b.dataset.tf; all("[data-tf]").forEach(x => x.classList.toggle("on", x === b)); renderTVChart(st.sym, st.tf); });

  const qfEl = $("#qf");
  if (qfEl) qfEl.onsubmit = e => { e.preventDefault(); const v = $("#q").value.trim(); if (v) setSym(v); };

  sess(); setInterval(sess, 6e4);
  refresh(); setInterval(refresh, 2000);
}
return {init, setSym, P, st, base, live};
})();