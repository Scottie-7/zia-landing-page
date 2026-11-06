/* Sonar Pro v2: aggregated back-to-back ladder + venue/tier settings, liquidity heatmap, order-flow spectrogram,
   barrier forecast (configurable horizon), features, promotion funnel, evaluation board, latency waterfall,
   command palette, drag/resize layout, subscription request flow. Everything follows one ticker via the "sonar:tick" event.
   Add ?pro to the URL to preview every venue and L3 unlocked (sample data). */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const f = (n, d = 2) => Number(n).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const cmp = new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits: 1});
const hs = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const dec = p => p < 1 ? 4 : 2, tkOf = p => p < 1 ? 1e-4 : 0.01, pc = v => (v * 100).toFixed(2) + "%", sum = a => a.reduce((s, l) => s + l.size, 0);
const PRO = new URLSearchParams(location.search).has("pro");
const LOCK = '<svg class="inline w-3 h-3 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="locked"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const TIP = {iceberg_absorption: "ICEBERG_ABSORPTION (+1): Aggressive print >= $10k with AIR >= 1.0.", unexecuted_depletion: "UNEXECUTED_DEPLETION (-1): Visible size fell >= $10k with AIR <= 0.05. Does not prove a cancel."};
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

/* ---- Venue catalog. c = placeholder estimate in USD/month for Level 2 (edit freely); free = included in the free preview ---- */
const VEN = [{id: "NSDQ", n: "Nasdaq", c: 15, free: 1}, {id: "ARCA", n: "NYSE Arca", c: 15, free: 1}, {id: "NYSE", n: "NYSE", c: 20}, {id: "AMEX", n: "NYSE American", c: 10}, {id: "BZX", n: "Cboe BZX", c: 12}, {id: "BYX", n: "Cboe BYX", c: 8}, {id: "EDGX", n: "Cboe EDGX", c: 12}, {id: "EDGA", n: "Cboe EDGA", c: 8}, {id: "IEX", n: "IEX", c: 6}, {id: "MEMX", n: "MEMX", c: 10}, {id: "BX", n: "Nasdaq BX", c: 8}, {id: "PSX", n: "Nasdaq PSX", c: 8}];
const TIER = {L1: {n: "Level 1", m: .3, d: "NBBO quotes and trades"}, L2: {n: "Level 2", m: 1, d: "Price-level depth by venue"}, L3: {n: "Level 3", m: 2.5, d: "Order-level (MBO) reconstruction"}};
const G = {sym: "", hz: 180, k: 1, sel: new Set(["NSDQ", "ARCA"]), tier: "L2", flip: false, pop: false};
const nm = k => (VEN.find(v => v.id === k) || {n: k}).n, isLocked = v => !v.free && !PRO;
const est = (ids, t) => [...ids].reduce((s, id) => { const v = VEN.find(x => x.id === id); return s + (v.free && t !== "L3" ? 0 : v.c * TIER[t].m); }, 0);
let LAST = null;

document.head.insertAdjacentHTML("beforeend", `<style>
#ladder2{font:10px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}
.lhd,.lr{display:grid;grid-template-columns:1fr 64px 1fr;align-items:center}
.lhd{padding-bottom:2px;border-bottom:1px solid #1e293b;font:600 10px Inter,sans-serif;color:#94A3B8}
.lr{height:14px}.lr b{text-align:center;font-weight:600}.lr.bid b{color:#10B981}.lr.ask b{color:#fb7185}
.sz{position:relative;display:flex;align-items:center;gap:3px;height:12px;padding:0 4px;color:#e2e8f0}.sz>*{position:relative}.sz u{text-decoration:none}
.sz i{position:absolute;top:0;bottom:0;border-radius:1px}.lr.bid .sz i{background:rgba(16,185,129,.34)}.lr.ask .sz i{background:rgba(244,63,94,.34)}
.sz.l{justify-content:flex-end}.sz.l i{right:0}.sz.r i{left:0}
.mid2{margin:2px 0;border-block:1px solid rgba(0,240,255,.3);background:#0f172a;text-align:center;font-size:10px;color:#00F0FF}
#ven-pop{position:absolute;right:0;top:100%;z-index:30;width:15.5rem;margin-top:4px;padding:6px;border:1px solid #334155;border-radius:6px;background:#0b1220;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.vrow{display:flex;justify-content:space-between;gap:8px;padding:4px 6px;border-radius:4px;font-size:11px;color:#cbd5e1;cursor:pointer}.vrow:hover{background:#1e293b}
.mdl{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:1rem;background:rgba(2,6,23,.82);backdrop-filter:blur(4px)}
.mp{width:100%;max-width:32rem;max-height:92vh;overflow:auto;padding:1.25rem;border:1px solid #1e293b;border-radius:.5rem;background:#0b1220}
.mp .inp{width:100%;margin-top:.25rem;padding:.5rem .75rem;border:1px solid #334155;border-radius:.375rem;background:#0F172A;font-size:.85rem;color:#f8fafc}
.cta{padding:.5rem 1rem;border-radius:.375rem;background:#06b6d4;font-size:.8rem;font-weight:600;color:#020617}.cta:hover{background:#22d3ee}.cta:disabled{opacity:.4}
.cta2{padding:.5rem 1rem;border:1px solid #334155;border-radius:.375rem;font-size:.8rem;color:#cbd5e1}
.tcard{display:flex;flex-direction:column;gap:2px;padding:8px;border:1px solid #334155;border-radius:6px;font-size:10px;color:#94A3B8;cursor:pointer}.tcard b{font-size:12px;color:#e2e8f0}.tcard.on{border-color:#06b6d4;background:rgba(8,51,68,.5)}
.evh{margin-bottom:4px;font-size:10px;font-weight:600;color:#94A3B8}
.editing [data-panel]{position:relative;min-height:140px;overflow:auto;resize:vertical;outline:1px dashed rgba(0,240,255,.55);outline-offset:2px}
.editbar{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:2px 6px;border-radius:4px;background:#083344;font:600 10px "JetBrains Mono",monospace;color:#00F0FF}
.grip{cursor:grab}.editbar button{padding:0 8px;border:1px solid #0e7490;border-radius:3px;margin-left:4px}
@keyframes syn{from{box-shadow:0 0 0 1px #00F0FF,0 0 18px rgba(0,240,255,.35)}to{box-shadow:0 0 0 0 transparent}}.sync-flash{animation:syn .8s ease-out}
</style>`);

/* ---------- Aggregation across selected venues ---------- */
function synthV(sym, mid, id) { const r = rng(hs(id + sym) + Math.floor(Date.now() / 2000)), t = tkOf(mid), d = dec(mid); const lv = dir => { let p = mid + dir * t * .5; return Array.from({length: 10}, () => { const x = {price: +p.toFixed(d), size: Math.round((1 + r() * 18) ** 1.25) * 100}; p += dir * t * (r() > .7 ? 2 : 1); return x; }); }; return {bids: lv(-1), asks: lv(1)}; }
function agg(b, sym) {
  const V = {}, src = b.venues || {NSDQ: {bids: b.bids, asks: b.asks}};
  VEN.forEach(v => { if (!G.sel.has(v.id)) return; const x = src[v.id] || (PRO && !Sonar.live ? synthV(sym, b.mid, v.id) : null); if (x) V[v.id] = x; });
  if (!Object.keys(V).length) Object.assign(V, src);
  const m = {bids: new Map(), asks: new Map()};
  Object.entries(V).forEach(([id, v]) => ["bids", "asks"].forEach(s => v[s].forEach(l => { const e = m[s].get(l.price) || {size: 0, v: {}}; e.size += l.size; e.v[id] = (e.v[id] || 0) + l.size; m[s].set(l.price, e); })));
  const fin = (mp, bid) => [...mp].map(([price, e]) => ({price, size: e.size, v: e.v})).sort((a, c) => bid ? c.price - a.price : a.price - c.price);
  return {bids: fin(m.bids, true), asks: fin(m.asks, false), V};
}
const tob = A => { const b = A.bids[0], a = A.asks[0]; return {bb: b.price, ba: a.price, mid: (b.price + a.price) / 2, micro: (b.price * a.size + a.price * b.size) / (a.size + b.size)}; };

/* ---------- Venue / tier settings bar ---------- */
function vbar() {
  const el = $("#vbar"); if (!el) return;
  el.innerHTML = `<div class="flex gap-1">${["L1", "L2", "L3"].map(t => `<button class="btn ${G.tier === t ? "on" : ""}" data-tier="${t}" title="${TIER[t].d}">${t}${t === "L3" && !PRO ? " " + LOCK : ""}</button>`).join("")}<button class="btn" data-flip title="Swap bid and ask sides" aria-label="Swap sides">⇄</button></div>
  <button id="ven-btn" class="btn" aria-expanded="${G.pop}">Venues ${G.sel.size}/${VEN.length} ▾</button>
  <div id="ven-pop" class="${G.pop ? "" : "hidden"}">${VEN.map(v => `<div class="vrow" data-v="${v.id}"><span>${isLocked(v) ? LOCK : G.sel.has(v.id) ? "✓" : "○"} ${v.n}</span><span class="mono text-slate-400">${v.free ? "Free preview" : (isLocked(v) ? "from " : "") + "$" + v.c + "/mo"}</span></div>`).join("")}<button class="cta w-full mt-1" data-sub>Add data feeds (L1 · L2 · L3)</button></div>`;
  $$("[data-vcount]").forEach(s => s.textContent = `${G.sel.size}/${VEN.length}`);
}

/* ---------- Aggregated back-to-back ladder ---------- */
function ladder(d) {
  const el = $("#ladder2"); if (!el) return;
  const A = d.A, t = tob(A), dd = dec(d.book.mid), N = G.tier === "L1" ? 1 : 8, evs = d.book.events || [];
  const asks = A.asks.slice(0, N), bids = A.bids.slice(0, N), mx = Math.max(1, ...asks.map(l => l.size), ...bids.map(l => l.size));
  const row = (side, l) => {
    const e = evs.find(x => x.side === side && Math.abs(x.price - l.price) < 1e-6), ice = e && e.type[0] === "i", left = (side === "bid") !== G.flip;
    const mk = e ? `<em class="ev ${ice ? "cy" : "am"}" title="${TIP[e.type]}">${ice ? "+1" : "−1"}</em>` : "";
    const cell = `<span class="sz ${left ? "l" : "r"}" title="${Object.entries(l.v).map(([k, s]) => nm(k) + " " + s.toLocaleString()).join(" · ")}"><i style="width:${(l.size / mx * 100).toFixed(0)}%"></i>${left ? mk : ""}<u>${cmp.format(l.size)}</u>${left ? "" : mk}</span>`;
    return `<div class="lr ${side}">${left ? cell : "<span></span>"}<b>${f(l.price, dd)}</b>${left ? "<span></span>" : cell}</div>`;
  };
  const tot = Object.entries(A.V).map(([k, v]) => [k, sum(v.bids.slice(0, 10)) + sum(v.asks.slice(0, 10))]), all = tot.reduce((s, x) => s + x[1], 0) || 1;
  el.innerHTML = `<div class="lhd"><span>${G.flip ? "Ask" : "Bid"} size</span><span class="text-center">Price</span><span class="text-right">${G.flip ? "Bid" : "Ask"} size</span></div>${asks.slice().reverse().map(l => row("ask", l)).join("")}<div class="mid2">Spread ${f(t.ba - t.bb, dd)} · Mid ${f(t.mid, dd + 1)} · Micro ${f(t.micro, dd + 1)}</div>${bids.map(l => row("bid", l)).join("")}<div class="mt-1.5 text-center text-[10px] text-slate-400">${G.tier === "L3" ? "Order-level reconstruction (sample) · " : ""}${tot.sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, v]) => `${nm(k)} ${(v / all * 100).toFixed(0)}%`).join(" · ")} depth share</div>`;
}

/* ---------- Barrier forecast (configurable horizon) ---------- */
const H = {cols: [], bub: [], ev: [], n: 0, sym: "", lastT: 0, bar: null, p: null};
const probs = d => { if (Sonar.live || (G.hz === 180 && d.probs)) return d.probs; const r = rng(hs(d.sym + G.hz) + Math.floor(Date.now() / 5000)), a = .18 + r() * .22, b = .2 + r() * .22; return {p_down: a, p_up: b, p_neutral: 1 - a - b}; };
function setBar(d) {
  const t = tob(d.A), sig15 = .0025 + (hs(d.sym) % 30) / 1e4, sigH = sig15 * Math.sqrt(G.hz / 15), theta = Math.max(.0015, G.k * sigH); // sample sigma; backend supplies real values
  H.bar = {ask: t.ba, bid: t.bb, k: G.k, sigH, theta, up: t.ba * (1 + theta), lo: t.bb * (1 - theta)}; H.p = probs(d);
}
function barrier(d) {
  const el = $("#barrier"), bar = H.bar; if (!el) return;
  const p = H.p || {p_down: .3, p_neutral: .4, p_up: .3}, dd = dec(bar.ask), e = Math.floor(Date.now() / 1000) % G.hz;
  const cls = [["Down", p.p_down, "bg-amber-500", "text-amber-400"], ["Neutral", p.p_neutral, "bg-slate-500", "text-slate-300"], ["Up", p.p_up, "bg-emerald-500", "text-emerald-400"]], top = cls.reduce((a, c) => c[1] > a[1] ? c : a);
  const tile = (l, v, s, c) => `<div class="bg-slate-900 p-2 rounded border border-slate-800"><div class="text-slate-400 text-[10px]">${l}</div><div class="text-sm font-bold ${c} mt-0.5">$${f(v, dd)}</div><div class="text-[10px] text-slate-400">${s}</div></div>`;
  el.innerHTML = `<div class="text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 pb-1.5 flex justify-between items-center"><span class="font-bold text-cyan-400">Barrier Forecast (${d.sym})</span><span class="bg-cyan-950/60 ${top[3]} border border-cyan-800 px-2 py-0.5 rounded text-[10px]">Leading: ${top[0]} ${(top[1] * 100).toFixed(1)}%</span></div>
<div class="grid grid-cols-3 gap-2 text-center pt-1">${tile("Lower barrier", bar.lo, "bid × (1 − θ)", "text-amber-400")}${tile("Entry reference", bar.ask, "best ask", "text-slate-100")}${tile("Upper barrier", bar.up, "ask × (1 + θ)", "text-cyan-400")}</div>
${cls.map(([n, v, bg, tc]) => `<div class="flex items-center gap-2"><span class="w-14 text-slate-300">${n}</span><div class="flex-1 h-1.5 rounded bg-slate-800"><div class="${bg} h-1.5 rounded" style="width:${v * 100}%"></div></div><span class="w-12 text-right ${tc}">${(v * 100).toFixed(1)}%</span></div>`).join("")}
<div><div class="flex justify-between text-[10px] text-slate-400"><span>Window</span><span>${e} s / ${G.hz} s</span></div><div class="h-1 rounded bg-slate-800 mt-0.5"><div class="h-1 rounded bg-cyan-400" style="width:${e / G.hz * 100}%"></div></div></div>
<div class="text-[10px] text-slate-400 flex justify-between gap-2"><span>θ = max(0.15%, k·σ_h) = ${pc(bar.theta)} · σ_h ${pc(bar.sigH)} · k ${bar.k.toFixed(1)}</span><span class="text-cyan-400 shrink-0">Horizon: τ = ${G.hz}s</span></div>
<div class="text-[10px] text-slate-400">Signal Source: DeepLOB CNN + Time &amp; Sales Velocity</div>`;
}

/* ---------- Microstructure features ---------- */
const side = (A, bid) => { const a = (bid ? A.bids : A.asks).slice(0, 10); return {m: new Map(a.map(l => [l.price, l.size])), p10: a[a.length - 1].price}; };
const ofi = (a, c, bid) => { let t = 0; new Set([...a.m.keys(), ...c.m.keys()]).forEach(p => { const beyond = lim => bid ? p < lim : p > lim; if (!a.m.has(p) && beyond(a.p10)) return; if (!c.m.has(p) && beyond(c.p10)) return; t += (c.m.get(p) || 0) - (a.m.get(p) || 0); }); return t; }; // entry/exit guards
const spark = (a, c) => { if (a.length < 2) return ""; const mn = Math.min(...a), mx = Math.max(...a), r = mx - mn || 1; return `<svg viewBox="0 0 100 22" class="w-full h-5" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${c}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${a.map((v, i) => `${(i / (a.length - 1) * 100).toFixed(1)},${(20 - (v - mn) / r * 18).toFixed(1)}`).join(" ")}"/></svg>`; };
const FD = [["mlofi", "MLOFI · 10 lvl", v => cmp.format(v), 1], ["mdiv", "Micro-price div", v => f(v, 1) + " bps", 1], ["air", "AIR · venue", v => f(v, 2), 0], ["svd", "Signed vol Δ", v => cmp.format(v), 1], ["rvol", "RVOL", v => f(v, 1) + "x", 0], ["sprd", "Spread", v => f(v, 0) + " bps", 0]];
const F = {sym: "", prev: null, h: {}};
function features(d) {
  const el = $("#feat"); if (!el) return;
  if (F.sym !== d.sym) { F.sym = d.sym; F.prev = null; FD.forEach(x => F.h[x[0]] = []); }
  const t = tob(d.A), cur = {B: side(d.A, true), A: side(d.A, false)}, push = (k, v) => { F.h[k].push(v); if (F.h[k].length > 60) F.h[k].shift(); };
  if (F.prev) push("mlofi", ofi(F.prev.B, cur.B, true) - ofi(F.prev.A, cur.A, false));
  F.prev = cur; push("mdiv", (t.micro - t.mid) / t.mid * 1e4); push("sprd", (t.ba - t.bb) / t.mid * 1e4);
  push("air", (d.book.events || []).some(e => e.type[0] === "i") ? 1 + Math.random() : Math.random() * .6); // sample; backend supplies AIR_v
  push("svd", (d.tape || []).reduce((s, x) => s + (x.side === "buy" ? x.size : -x.size), 0));
  push("rvol", 1.2 + (hs(d.sym) % 60) / 10 + (Math.random() - .5) * .3);
  el.innerHTML = FD.map(([k, n, fm, sg]) => { const a = F.h[k], v = a[a.length - 1], c = sg && v < 0 ? "#F59E0B" : sg ? "#10B981" : "#00F0FF"; return `<div class="bg-slate-950/80 border border-slate-800 rounded p-2"><div class="text-[10px] text-slate-400">${n}</div><div class="mono text-sm font-semibold" style="color:${c}">${v === undefined ? "–" : fm(v)}</div>${spark(a, c)}</div>`; }).join("");
}

/* ---------- Promotion funnel ---------- */
function funnel(d) {
  const el = $("#funnel"); if (!el) return;
  const mid = tob(d.A).mid, rest = [...d.A.bids, ...d.A.asks].filter(l => Math.abs(l.price - mid) / mid <= .01).reduce((s, l) => s + l.price * l.size, 0);
  const pct = Sonar.base(d.sym)[2], rv = 1.2 + (hs(d.sym) % 60) / 10, dw = 600 - Math.floor(Date.now() / 1000) % 600;
  const checks = [["Move ≥ 5.0%", pct >= 5, f(pct, 2) + "%"], ["RVOL ≥ 2.0", rv >= 2, f(rv, 1) + "x"], ["Resting ≥ $15k within ±1%", rest >= 15000, "$" + cmp.format(rest)]], ok = checks.every(c => c[1]);
  el.innerHTML = [["Universe · $1M–$1B", 4812, 100], ["Tier 1 · L1", 412, 72], ["Tier 2 · L1 + book", 62, 44], ["Tier 3 · top-3 + depth", 3, 18]].map(([n, c, w]) => `<div class="mb-1.5"><div class="flex justify-between text-[10px] text-slate-400"><span>${n}</span><span class="mono text-slate-200">${c.toLocaleString()}</span></div><div class="h-1.5 rounded bg-slate-800"><div class="h-1.5 rounded bg-cyan-500/70" style="width:${w}%"></div></div></div>`).join("")
  + `<div class="mt-3 flex items-center justify-between"><span class="mono text-xs font-semibold text-slate-100">${d.sym}</span><span class="rounded px-2 py-0.5 text-[10px] font-mono border ${ok ? "text-cyan-400 border-cyan-800 bg-cyan-950/60" : "text-slate-300 border-slate-700 bg-slate-900"}">${ok ? "Tier 2 eligible" : "Tier 1 only"}</span></div>`
  + checks.map(([n, p, v]) => `<div class="mt-1 flex items-center justify-between text-[11px]"><span class="${p ? "text-emerald-400" : "text-rose-400"}">${p ? "✓" : "✕"} <span class="text-slate-300">${n}</span></span><span class="mono text-slate-200">${v}</span></div>`).join("")
  + `<div class="mt-3 flex justify-between text-[10px] text-slate-400"><span>Moomoo slots</span><span class="mono text-slate-200">62 / 100</span></div><div class="h-1.5 rounded bg-slate-800"><div class="h-1.5 rounded bg-indigo-400/70" style="width:62%"></div></div><div class="mt-2 flex justify-between text-[10px] text-slate-400"><span>Dwell lock</span><span class="mono text-slate-200">${dw} s of 600 s</span></div>`;
}

/* ---------- Liquidity heatmap ---------- */
const tkp = p => hs(p.toFixed(4)) % 7 === 0 && !Sonar.live ? 3.5 : 1; // sample only: persistent "walls"
const mkCol = (mid, L) => ({n: H.n++, mid, L});
function synth(mid) { const tk = tkOf(mid), mk = dir => { let p = mid + dir * tk * .5; return Array.from({length: 10}, () => { const l = {price: +p.toFixed(4), size: Math.round((1 + Math.random() * 25) ** 1.3) * 100}; p += dir * tk * (Math.random() > .7 ? 2 : 1); return l; }); }; return {NSDQ: [...mk(-1), ...mk(1)], ARCA: [...mk(-1), ...mk(1)]}; }
function ingest(d) {
  const b = d.book, tk = tkOf(b.mid);
  if (H.sym !== d.sym) { // seed ~3 min of history so the panel is populated immediately (sample mode)
    H.sym = d.sym; H.cols = []; H.bub = []; H.ev = []; H.n = 0; H.lastT = 0;
    let m = b.mid; const mids = []; for (let i = 0; i < 89; i++) { mids.unshift(m); m += (Math.random() - .5) * tk * 1.5; }
    mids.forEach(x => H.cols.push(mkCol(x, synth(x))));
    for (let i = 0; i < 40; i++) { const c = H.cols[Math.floor(Math.random() * 89)]; H.bub.push({n: c.n, price: c.mid + (Math.random() - .5) * tk * 3, size: 100 * Math.ceil(Math.random() * 12), side: Math.random() > .5 ? "buy" : "sell"}); }
  }
  const L = {}; Object.entries(d.A.V).forEach(([k, v]) => L[k] = [...v.bids, ...v.asks]);
  H.cols.push(mkCol(b.mid, L)); if (H.cols.length > 90) H.cols.shift();
  const n = H.n - 1, tape = d.tape || [];
  (b.events || []).forEach(e => H.ev.push({n, price: e.price, type: e.type}));
  tape.filter(x => x.t > H.lastT).forEach(x => H.bub.push({n, price: x.price, size: x.size, side: x.side}));
  H.lastT = Math.max(H.lastT, ...tape.map(x => x.t));
  const n0 = H.cols[0].n; H.bub = H.bub.filter(x => x.n >= n0); H.ev = H.ev.filter(x => x.n >= n0);
}
function heat() {
  const cv = $("#heat"), bar = H.bar; if (!cv || !H.cols.length || !bar) return;
  const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.font = "10px 'JetBrains Mono',monospace";
  const last = H.cols[H.cols.length - 1], mid = last.mid, tk = tkOf(mid), half = Math.max(12 * tk, 1.4 * Math.max(bar.up - mid, mid - bar.lo)), pmin = mid - half, pmax = mid + half;
  const aw = 54, hw = (w - aw) * .72, fw = w - aw - hw, cw = hw / 90, Y = p => 6 + (h - 12) * (1 - (p - pmin) / (pmax - pmin)), ch = Math.max(2, (h - 12) * tk / (pmax - pmin)), X = n => hw - (last.n - n + 1) * cw;
  const ks = c => Object.keys(c.L).filter(k => G.sel.has(k)), dd = dec(mid), p = H.p || {p_down: .3, p_neutral: .4, p_up: .3};
  let mx = 1; H.cols.forEach(c => ks(c).forEach(k => c.L[k].forEach(l => { mx = Math.max(mx, l.size * tkp(l.price)); })));
  H.cols.forEach(c => ks(c).forEach(k => c.L[k].forEach(l => { const a = Math.sqrt(l.size * tkp(l.price) / mx); if (a < .05) return; x.fillStyle = `rgba(0,240,255,${(.06 + .8 * a).toFixed(2)})`; x.fillRect(X(c.n), Y(l.price) - ch / 2, cw + .5, ch); })));
  x.lineWidth = 1; x.fillStyle = "#94A3B8";
  for (let i = 0; i <= 4; i++) { const pr = pmin + (pmax - pmin) * i / 4, y = Y(pr); x.strokeStyle = "rgba(30,41,59,.8)"; x.beginPath(); x.moveTo(0, y); x.lineTo(w - aw, y); x.stroke(); x.fillText(f(pr, dd), w - aw + 6, y + 3); }
  x.strokeStyle = "rgba(248,250,252,.75)"; x.lineWidth = 1.2; x.beginPath(); H.cols.forEach((c, i) => { const px = X(c.n) + cw / 2; i ? x.lineTo(px, Y(c.mid)) : x.moveTo(px, Y(c.mid)); }); x.stroke();
  H.bub.forEach(q => { x.fillStyle = q.side === "buy" ? "rgba(16,185,129,.75)" : "rgba(245,158,11,.75)"; x.beginPath(); x.arc(X(q.n) + cw / 2, Y(q.price), 2 + Math.sqrt(q.size / 100) * 1.1, 0, 7); x.fill(); });
  H.ev.forEach(e => { const cx = X(e.n) + cw / 2, cy = Y(e.price); x.fillStyle = e.type[0] === "i" ? "#00F0FF" : "#F59E0B"; x.beginPath(); x.moveTo(cx, cy - 5); x.lineTo(cx + 5, cy); x.lineTo(cx, cy + 5); x.lineTo(cx - 5, cy); x.fill(); });
  const yu = Y(bar.up), yl = Y(bar.lo);
  x.fillStyle = "rgba(0,240,255,.05)"; x.fillRect(hw, yu, fw, yl - yu); x.setLineDash([5, 4]); x.lineWidth = 1;
  [[yu, "rgba(0,240,255,.6)"], [yl, "rgba(245,158,11,.6)"]].forEach(([y, c]) => { x.strokeStyle = c; x.beginPath(); x.moveTo(0, y); x.lineTo(w - aw, y); x.stroke(); });
  x.strokeStyle = "rgba(148,163,184,.6)"; x.beginPath(); x.moveTo(hw, 0); x.lineTo(hw, h); x.moveTo(w - aw, yu); x.lineTo(w - aw, yl); x.stroke(); x.setLineDash([]);
  x.fillStyle = "#00F0FF"; x.fillText(`Up ≥ ${f(bar.up, dd)} · ${(p.p_up * 100).toFixed(0)}%`, hw + 8, yu + 13);
  x.fillStyle = "#94A3B8"; x.fillText(`Neutral · ${(p.p_neutral * 100).toFixed(0)}%`, hw + 8, (yu + yl) / 2 + 3);
  x.fillStyle = "#F59E0B"; x.fillText(`Down ≤ ${f(bar.lo, dd)} · ${(p.p_down * 100).toFixed(0)}%`, hw + 8, yl - 6);
  x.fillStyle = "#94A3B8"; x.fillText("−180s", 4, h - 4); x.fillText("now", hw - 22, h - 4); x.fillText(`+${G.hz}s`, w - aw - 40, h - 4);
}

/* ---------- Order-flow spectrogram: per-level change in aggregated resting size ---------- */
const SP = {cols: [], prev: null, sym: ""};
function specIngest(d) {
  const pad = a => Array.from({length: 10}, (_, i) => a[i] ? a[i].size : 0), cur = [...pad(d.A.asks).reverse(), ...pad(d.A.bids)];
  if (SP.sym !== d.sym) { SP.sym = d.sym; SP.prev = null; SP.cols = Array.from({length: 89}, () => Array.from({length: 20}, () => (Math.random() - .5) * 3000)); }
  if (SP.prev) { SP.cols.push(cur.map((s, i) => s - SP.prev[i])); if (SP.cols.length > 90) SP.cols.shift(); }
  SP.prev = cur;
}
function spec() {
  const cv = $("#spec"); if (!cv || !SP.cols.length) return;
  const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.font = "10px 'JetBrains Mono',monospace";
  const aw = 34, rh = (h - 14) / 20, cw = (w - aw) / 90; let mx = 1; SP.cols.forEach(c => c.forEach(v => mx = Math.max(mx, Math.abs(v))));
  SP.cols.forEach((c, i) => c.forEach((v, j) => { const a = Math.min(1, Math.sqrt(Math.abs(v) / mx)); if (a < .08) return; x.fillStyle = (v > 0 ? "rgba(0,240,255," : "rgba(245,158,11,") + (.85 * a).toFixed(2) + ")"; x.fillRect((90 - SP.cols.length + i) * cw, j * rh, cw + .5, rh - .5); }));
  x.strokeStyle = "rgba(248,250,252,.5)"; x.beginPath(); x.moveTo(0, 10 * rh); x.lineTo(w - aw, 10 * rh); x.stroke();
  x.fillStyle = "#94A3B8"; [["A10", 0], ["A5", 5], ["A1", 9], ["B1", 10], ["B5", 14], ["B10", 19]].forEach(([t, j]) => x.fillText(t, w - aw + 6, (j + .7) * rh));
  x.fillText("−180s", 4, h - 3); x.fillText("now", w - aw - 24, h - 3);
}

/* ---------- Evaluation board (sample values until the first data pull) ---------- */
const EV = {m: "XGB", key: ""};
function evalBoard(d) {
  const el = $("#evalb-body"); if (!el) return; const key = d.sym + EV.m + G.hz; if (EV.key === key) return; EV.key = key;
  const r = rng(hs(key)), N = 1200 + Math.floor(r() * 500), sh = [.24, .5, .26], bonus = {XGB: 0, LSTM: .02, DLOB: .04}[EV.m];
  const cm = [0, 1, 2].map(i => { const n = Math.round(N * sh[i]), row = [0, 0, 0]; row[i] = Math.round(n * (.5 + bonus + (r() - .5) * .08)); const rest = n - row[i], o = [0, 1, 2].filter(j => j !== i), a = Math.round(rest * (.4 + r() * .2)); row[o[0]] = a; row[o[1]] = rest - a; return row; });
  const colSum = j => cm[0][j] + cm[1][j] + cm[2][j], cls = ["Down", "Neutral", "Up"].map((n, i) => { const tp = cm[i][i], p = tp / (colSum(i) || 1), rc = tp / (cm[i][0] + cm[i][1] + cm[i][2] || 1); return {n, f1: 2 * p * rc / ((p + rc) || 1)}; });
  const macro = cls.reduce((s, c) => s + c.f1, 0) / 3, maj = (2 * sh[1] / (1 + sh[1])) / 3, evb = r() * 3 - .4, ci = [macro - .03 - r() * .01, macro + .03 + r() * .01];
  const bins = Array.from({length: 8}, (_, i) => { const p = (i + .5) / 8; return [p, Math.min(1, Math.max(0, p + (r() - .5) * .07 - .01))]; }), ece = bins.reduce((s, b) => s + Math.abs(b[0] - b[1]), 0) / 8;
  const neff = 1100 + Math.floor(r() * 700), mino = 180 + Math.floor(r() * 200), pass = neff >= 1500 && mino >= 300, cmx = Math.max(...cm.flat()), fc = ["bg-amber-500", "bg-slate-400", "bg-emerald-500"];
  const meter = (l, v, t) => `<div class="mb-2"><div class="flex justify-between text-[10px] text-slate-400"><span>${l}</span><span class="mono text-slate-200">${v.toLocaleString()} / ${t.toLocaleString()}</span></div><div class="h-1.5 rounded bg-slate-800"><div class="h-1.5 rounded ${v >= t ? "bg-emerald-500" : "bg-amber-500"}" style="width:${Math.min(100, v / t * 100)}%"></div></div></div>`;
  el.innerHTML = `<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4 text-xs">
<div><div class="evh">Per-class F1 · ${d.sym} slice</div>${cls.map((c, i) => `<div class="flex items-center gap-2 mb-1.5"><span class="w-14 text-slate-300">${c.n}</span><div class="flex-1 h-1.5 rounded bg-slate-800"><div class="${fc[i]} h-1.5 rounded" style="width:${c.f1 * 100}%"></div></div><span class="mono w-10 text-right text-slate-200">${f(c.f1, 3)}</span></div>`).join("")}<div class="mt-2 space-y-1 text-[11px] text-slate-400"><div>Macro-F1 <span class="mono text-cyan-400">${f(macro, 3)}</span> · majority baseline <span class="mono text-slate-200">${f(maj, 3)}</span></div><div>EV after spread <span class="mono ${evb >= 0 ? "text-emerald-400" : "text-amber-400"}">${evb >= 0 ? "+" : ""}${f(evb, 2)} bps</span></div><div>Day-block bootstrap 95% CI <span class="mono text-slate-200">[${f(ci[0], 3)}, ${f(ci[1], 3)}]</span></div></div></div>
<div><div class="evh">Confusion matrix (true × predicted)</div><div class="grid grid-cols-4 gap-0.5 text-center text-[10px]"><span></span>${["Down", "Neut", "Up"].map(n => `<span class="text-slate-400">${n}</span>`).join("")}${cm.map((rw, i) => `<span class="text-left text-slate-400">${["Down", "Neut", "Up"][i]}</span>` + rw.map((v, j) => `<span class="mono rounded py-1.5 text-slate-100 ${i === j ? "font-bold" : ""}" style="background:rgba(0,240,255,${(.07 + .6 * v / cmx).toFixed(2)})">${v}</span>`).join("")).join("")}</div></div>
<div><div class="evh">Calibration · ECE <span class="mono text-cyan-400">${f(ece, 3)}</span></div><svg viewBox="-6 -4 112 112" class="w-full h-32" role="img" aria-label="Reliability diagram"><line x1="0" y1="100" x2="100" y2="0" stroke="#475569" stroke-dasharray="3 3"/><polyline fill="none" stroke="#00F0FF" stroke-width="1.5" points="${bins.map(b => `${(b[0] * 100).toFixed(1)},${(100 - b[1] * 100).toFixed(1)}`).join(" ")}"/>${bins.map(b => `<circle cx="${(b[0] * 100).toFixed(1)}" cy="${(100 - b[1] * 100).toFixed(1)}" r="2" fill="#00F0FF"/>`).join("")}</svg><div class="text-[10px] text-slate-400">Predicted probability vs observed frequency</div></div>
<div><div class="evh">Sample-size gate</div>${meter("N_eff (non-overlapping)", neff, 1500)}${meter("Minority class", mino, 300)}<div class="text-[10px] text-slate-400">N_total ≈ ${cmp.format(neff * G.hz / 2)} sliding · stride 2 s</div><span class="mt-1 inline-block rounded border px-2 py-0.5 text-[10px] font-mono ${pass ? "text-emerald-400 border-emerald-800 bg-emerald-950/40" : "text-amber-400 border-amber-800 bg-amber-950/40"}">${pass ? "Gate passed" : "Underpowered · report as transfer ablation"}</span></div></div>`;
}

/* ---------- Latency waterfall ---------- */
const LT = [];
function latency(d) {
  const el = $("#lat"); if (!el) return; const j = Math.random, br = d.status && d.status.book_age_ms || 8 + j() * 6;
  const st = [["Exchange → receive", br], ["Reorder window", 10], ["100 ms grid bucket", 38 + j() * 24], ["Feature build", 3 + j() * 3], ["Model inference", 7 + j() * 6], ["Render", 4 + j() * 4]], tot = st.reduce((s, x) => s + x[1], 0); let off = 0;
  LT.push(tot); if (LT.length > 60) LT.shift(); const s = [...LT].sort((a, b) => a - b);
  el.innerHTML = st.map(([n, v]) => { const l = off / tot * 100; off += v; return `<div class="mb-1.5"><div class="flex justify-between text-[10px] text-slate-400"><span>${n}</span><span class="mono text-slate-200">${v.toFixed(1)} ms</span></div><div class="relative h-1.5 rounded bg-slate-800"><div class="absolute h-1.5 rounded bg-cyan-500/80" style="left:${l}%;width:${Math.max(1.5, v / tot * 100)}%"></div></div></div>`; }).join("")
  + `<div class="mt-2 flex justify-between text-[11px]"><span class="text-slate-400">End to end</span><span class="mono text-cyan-400">${tot.toFixed(1)} ms</span></div><div class="flex justify-between text-[10px] text-slate-400"><span>p50 <span class="mono text-slate-200">${s[Math.floor(s.length * .5)].toFixed(1)}</span> · p99 <span class="mono text-slate-200">${s[Math.min(s.length - 1, Math.floor(s.length * .99))].toFixed(1)}</span> ms</span><span>sample timings</span></div>`;
}

/* ---------- Modal + subscription request flow ---------- */
function modal(id, html) { let m = $("#" + id); if (!m) { m = document.createElement("div"); m.id = id; m.className = "mdl"; m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m); } m.innerHTML = html; return m; }
const W = {step: 1, email: "", name: "", tier: "L2", ids: new Set(), agree: false, done: null};
function sub() { const a = LS("zia_account"); Object.assign(W, {step: a ? 2 : 1, email: a ? a.email : "", name: a && a.name || "", tier: G.tier === "L1" ? "L2" : G.tier, ids: new Set(G.sel), agree: false, done: null}); G.pop = false; vbar(); subRender(); }
function subRender() {
  const total = est(W.ids, W.tier);
  const head = `<div class="flex items-center justify-between"><h3 class="font-bold text-slate-100">Add market data to your plan</h3><button data-x class="text-slate-400 hover:text-slate-100" aria-label="Close">✕</button></div><div class="mt-2 flex gap-1 text-[10px] font-mono">${["Account", "Data", "Review"].map((s, i) => `<span class="rounded border px-2 py-0.5 ${W.step === i + 1 && !W.done ? "border-cyan-700 text-cyan-400 bg-cyan-950/50" : "border-slate-800 text-slate-400"}">${i + 1}. ${s}</span>`).join("")}</div>`;
  let body;
  if (W.done) body = `<div class="text-center space-y-2 py-2"><div class="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">✓</div><h4 class="font-bold text-slate-100 text-sm">Request saved</h4><p class="text-xs text-slate-400">Request <span class="mono text-cyan-400">${W.done.id}</span> for ${W.done.email} was recorded. Access is provisioned after review; the 30-day free trial starts then.</p><div class="flex justify-center gap-2 pt-2"><button data-dl class="cta2">Download saved requests (JSON)</button><button data-x class="cta">Close</button></div></div>`;
  else if (W.step === 1) body = `<p class="text-xs text-slate-400">Create an account first. Your email is saved as a pending client account; a password is set when access is provisioned.</p><label class="mt-3 block text-xs text-slate-400">Email<input id="sub-email" type="email" autocomplete="email" class="inp" value="${W.email}" placeholder="name@example.com"></label><label class="mt-2 block text-xs text-slate-400">Name (optional)<input id="sub-name" autocomplete="name" class="inp" value="${W.name}"></label><p id="sub-err" class="mt-2 hidden text-xs text-rose-400"></p><div class="mt-4"><button data-next class="cta">Create account and continue</button></div>`;
  else if (W.step === 2) body = `<div class="grid gap-2 sm:grid-cols-3">${Object.entries(TIER).map(([k, t]) => `<label class="tcard ${W.tier === k ? "on" : ""}"><input type="radio" name="tier" data-t="${k}" ${W.tier === k ? "checked" : ""} class="sr-only"><b>${t.n}</b><span>${t.d}</span></label>`).join("")}</div><div class="mt-3 max-h-52 overflow-auto rounded border border-slate-800 divide-y divide-slate-800">${VEN.map(v => `<label class="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"><span class="flex items-center gap-2"><input type="checkbox" data-vc="${v.id}" ${W.ids.has(v.id) ? "checked" : ""}><span class="text-slate-200">${v.n}</span></span><span class="mono text-slate-400">${v.free && W.tier !== "L3" ? "Included" : "~$" + (v.c * TIER[W.tier].m).toFixed(0) + "/mo"}</span></label>`).join("")}</div><div class="mt-3 flex items-center justify-between"><span class="text-xs text-slate-400">Estimated market-data cost</span><span class="mono text-lg text-cyan-400">~$${total.toFixed(0)}/mo</span></div><p class="mt-1 text-[10px] text-slate-400">Placeholder estimates; actual exchange fees may differ. The terminal access fee is billed separately once plan pricing is set. First 30 days free.</p><div class="mt-3 flex gap-2"><button data-back class="cta2">Back</button><button data-next class="cta">Review</button></div>`;
  else body = `<div class="rounded border border-slate-800 p-3 text-xs space-y-1.5"><div class="flex justify-between"><span class="text-slate-400">Account</span><span class="text-slate-200">${W.email}</span></div><div class="flex justify-between"><span class="text-slate-400">Data tier</span><span class="text-slate-200">${TIER[W.tier].n}</span></div><div class="flex justify-between gap-3"><span class="text-slate-400">Venues</span><span class="text-slate-200 text-right">${[...W.ids].map(nm).join(", ")}</span></div><div class="flex justify-between"><span class="text-slate-400">Estimated market data</span><span class="mono text-cyan-400">~$${total.toFixed(0)}/mo</span></div><div class="flex justify-between"><span class="text-slate-400">Terminal access</span><span class="text-slate-200">Pricing TBD · 30-day free trial</span></div></div><label class="mt-3 flex items-start gap-2 text-xs text-slate-300"><input id="sub-agree" type="checkbox" class="mt-0.5"> I agree to subscribe to the selected data at the estimated rates once access is provisioned. Fees are confirmed before billing begins.</label><div class="mt-3 flex gap-2"><button data-back class="cta2">Back</button><button id="sub-go" data-submit class="cta" disabled>Submit request</button></div>`;
  modal("sub-mdl", `<div class="mp" role="dialog" aria-modal="true" aria-label="Add market data">${head}<div class="mt-4">${body}</div></div>`);
}
function subNext() {
  if (W.step === 1) { const em = $("#sub-email").value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { const e = $("#sub-err"); e.textContent = "Enter a valid email address."; e.classList.remove("hidden"); return; } W.email = em; W.name = $("#sub-name").value.trim(); LS("zia_account", {email: em, name: W.name, ts: new Date().toISOString()}); }
  W.step++; subRender();
}
function subSubmit() {
  const req = {id: "REQ-" + Date.now().toString(36).toUpperCase(), email: W.email, name: W.name, tier: W.tier, venues: [...W.ids], est_monthly_usd: est(W.ids, W.tier), agreed_to_terms: true, trial_days: 30, ticker: G.sym, ts: new Date().toISOString()};
  LS("zia_subscription_requests", (LS("zia_subscription_requests") || []).concat(req)); // local copy; a backend route can collect these for real
  fetch("/api/subscription-requests", {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify(req)}).catch(() => {});
  W.done = req; subRender();
}
const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(LS("zia_subscription_requests") || [], null, 2)], {type: "application/json"})); a.download = "zia-subscription-requests.json"; a.click(); };
window.SonarRequests = {list: () => LS("zia_subscription_requests") || [], download};

/* ---------- Command palette ---------- */
const SYMS = ["ONEG", "CHOW", "SGRX", "KLNR", "VRTA", "TRBO", "NOVA", "PLZN"];
const PANELS = [["Liquidity heatmap", "heat"], ["Order-flow spectrogram", "spectro"], ["Model evaluation board", "evalb"], ["Latency waterfall", "latency"], ["Barrier forecast", "barrier"], ["Order book ladder", "book"], ["Feature monitor", "feat"], ["Promotion funnel", "funnel"]];
const CMDS = () => [...SYMS.map(s => ({t: "Load ticker " + s, k: "symbol " + s, run: () => Sonar.setSym(s)})),
  ...["1m", "5m", "15m", "1D"].map((tf, i) => ({t: "Timeframe " + tf, k: "chart interval", run: () => { const b = $$("[data-tf]")[i]; if (b) b.click(); }})),
  ...[30, 60, 180, 300, 900].map(h => ({t: "Prediction horizon " + h + "s", k: "tau barrier model", run: () => setHz(h)})),
  {t: "Toggle layout edit mode", k: "drag resize move panels", run: () => layoutMode(!document.body.classList.contains("editing"))}, {t: "Reset layout", k: "default panels", run: resetLayout},
  {t: "Add data feeds and venues", k: "subscribe level 2 level 3 exchanges data", run: sub},
  ...PANELS.map(([n, p]) => ({t: "Go to " + n, k: "scroll jump", run: () => { const el = $(`[data-panel="${p}"]`); if (el) el.scrollIntoView({behavior: "smooth", block: "center"}); }}))];
function palette() {
  const m = modal("pal", `<div class="mp !p-0 !max-w-lg"><input id="pal-in" class="w-full border-b border-slate-800 bg-transparent px-4 py-3 text-sm text-slate-100 outline-none" placeholder="Search tickers, panels and settings…" autocomplete="off" aria-label="Command palette"><ul id="pal-ul" class="max-h-72 overflow-auto py-1"></ul><div class="border-t border-slate-800 px-4 py-1.5 text-[10px] text-slate-400">↑↓ navigate · Enter run · Esc close</div></div>`);
  let sel = 0, items = [];
  const paint = () => { $("#pal-ul").innerHTML = items.map((c, i) => `<li data-i="${i}" class="cursor-pointer px-4 py-1.5 text-sm ${i === sel ? "bg-cyan-950/60 text-cyan-300" : "text-slate-300"}">${c.t}</li>`).join("") || '<li class="px-4 py-2 text-xs text-slate-400">No matches</li>'; };
  const draw = () => { const q = $("#pal-in").value.trim(), w = q.toLowerCase().split(/\s+/); items = CMDS().filter(c => w.every(x => (c.t + " " + c.k).toLowerCase().includes(x))).slice(0, 9); if (/^[A-Za-z.]{1,6}$/.test(q) && !SYMS.includes(q.toUpperCase())) items.unshift({t: "Load ticker " + q.toUpperCase(), run: () => Sonar.setSym(q.toUpperCase())}); sel = 0; paint(); };
  const run = i => { const c = items[i]; if (c) { m.remove(); c.run(); } };
  $("#pal-in").oninput = draw;
  $("#pal-in").onkeydown = e => { if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); } else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); } else if (e.key === "Enter") run(sel); };
  $("#pal-ul").onclick = e => { const li = e.target.closest("li[data-i]"); if (li) run(+li.dataset.i); };
  draw(); $("#pal-in").focus();
}

/* ---------- Drag / resize layout (saved in this browser) ---------- */
const LKEY = "zia_layout_v1", spanRe = /\b(lg|md):col-span-(\d+)\b/, SPANS = [3, 4, 5, 6, 8, 12];
function saveLayout() { const o = {}; $$("[data-grid]").forEach(g => { o[g.dataset.grid] = [...g.children].filter(c => c.dataset.panel).map(c => { const m = c.className.match(spanRe); return [c.dataset.panel, m ? +m[2] : 0, c.style.height || ""]; }); }); LS(LKEY, o); }
function loadLayout() { const o = LS(LKEY); if (!o) return; $$("[data-grid]").forEach(g => (o[g.dataset.grid] || []).forEach(([id, span, ht]) => { const p = g.querySelector(`[data-panel="${id}"]`); if (!p) return; g.appendChild(p); if (span) p.className = p.className.replace(spanRe, (a, bp) => `${bp}:col-span-${span}`); if (ht) p.style.height = ht; })); }
function resetLayout() { try { localStorage.removeItem(LKEY); } catch (e) {} location.reload(); }
function layoutMode(on) {
  document.body.classList.toggle("editing", on); const b = $("#edit-layout"); if (b) b.classList.toggle("on", on);
  $$("[data-panel]").forEach(p => { let bar = p.querySelector(":scope > .editbar"); if (on && !bar) { bar = document.createElement("div"); bar.className = "editbar"; bar.innerHTML = '<span class="grip" title="Drag to reorder">⠿ Drag</span><span>Width <button data-w="-1" aria-label="Narrower">−</button><button data-w="1" aria-label="Wider">+</button></span>'; p.prepend(bar); } if (!on && bar) bar.remove(); });
}
let drag = null;
document.addEventListener("mousedown", e => { const g = e.target.closest(".grip"); if (g) { drag = g.closest("[data-panel]"); drag.draggable = true; } });
document.addEventListener("mouseup", () => { if (drag) { drag.draggable = false; drag = null; } });
document.addEventListener("dragstart", e => { if (drag && e.target === drag) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag.dataset.panel); drag.style.opacity = .5; } });
document.addEventListener("dragover", e => { if (!drag) return; const t = e.target.closest("[data-panel]"); if (!t || t === drag || t.parentNode !== drag.parentNode) return; e.preventDefault(); const r = t.getBoundingClientRect(), wide = r.width > t.parentNode.clientWidth * .9, before = wide ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2; t.parentNode.insertBefore(drag, before ? t : t.nextSibling); });
document.addEventListener("dragend", () => { if (drag) { drag.draggable = false; drag.style.opacity = ""; drag = null; saveLayout(); } });
const flash = () => $$("[data-panel]").forEach(p => { p.classList.remove("sync-flash"); void p.offsetWidth; p.classList.add("sync-flash"); });

/* ---------- Settings: horizon, k, tabs ---------- */
function rerun() { if (!LAST) return; EV.key = ""; [setBar, barrier, heat, evalBoard].forEach(fn => { try { fn(LAST); } catch (e) { console.error(fn.name, e); } }); }
function setHz(h) { G.hz = h; $$("#hz button").forEach(b => b.classList.toggle("on", +b.dataset.h === h)); rerun(); }

/* ---------- Wiring ---------- */
document.addEventListener("sonar:tick", e => {
  const d = e.detail; if (!d.book) return;
  d.A = agg(d.book, d.sym); LAST = d;
  const changed = G.sym && G.sym !== d.sym; G.sym = d.sym;
  const hl = $("#heat-sym"); if (hl) hl.textContent = `${d.sym} · ${d.tf}`;
  const sc = $("#sync-chip"); if (sc) sc.textContent = `● Synced · ${d.sym} · ${$$("[data-panel]").length} panels`;
  if (changed) flash();
  [setBar, ladder, barrier, features, funnel, ingest, heat, specIngest, spec, evalBoard, latency].forEach(fn => { try { fn(d); } catch (err) { console.error("sonar-pro", fn.name, err); } });
});
document.addEventListener("click", e => {
  const t = e.target;
  if (t.closest("[data-sub]")) return sub();
  if (t.closest("[data-x]")) return $$(".mdl").forEach(m => m.remove());
  if (t.closest("[data-next]")) return subNext();
  if (t.closest("[data-back]")) { W.step--; return subRender(); }
  if (t.closest("[data-submit]")) return subSubmit();
  if (t.closest("[data-dl]")) return download();
  const tr = t.closest("[data-tier]"); if (tr) { if (tr.dataset.tier === "L3" && !PRO) return sub(); G.tier = tr.dataset.tier; vbar(); return LAST && ladder(LAST); }
  if (t.closest("[data-flip]")) { G.flip = !G.flip; return LAST && ladder(LAST); }
  if (t.closest("#ven-btn")) { G.pop = !G.pop; return vbar(); }
  const vr = t.closest(".vrow"); if (vr) { const v = VEN.find(x => x.id === vr.dataset.v); if (isLocked(v)) return sub(); if (G.sel.has(v.id) && G.sel.size > 1) G.sel.delete(v.id); else G.sel.add(v.id); vbar(); if (LAST) { LAST.A = agg(LAST.book, LAST.sym); [setBar, ladder, heat, funnel].forEach(fn => fn(LAST)); } return; }
  if (G.pop && !t.closest("#vbar")) { G.pop = false; vbar(); }
  const wb = t.closest("[data-w]"); if (wb) { const p = wb.closest("[data-panel]"), m = p.className.match(spanRe); if (m) { const i = Math.max(0, Math.min(SPANS.length - 1, SPANS.indexOf(+m[2]) + +wb.dataset.w)); p.className = p.className.replace(spanRe, `${m[1]}:col-span-${SPANS[i]}`); saveLayout(); } }
  const hb = t.closest("#hz button"); if (hb) setHz(+hb.dataset.h);
  const eb = t.closest("#ev-tabs button"); if (eb) { EV.m = eb.dataset.m; $$("#ev-tabs button").forEach(b => b.classList.toggle("on", b === eb)); EV.key = ""; if (LAST) evalBoard(LAST); }
  if (t.closest("#open-pal")) palette();
  if (t.closest("#edit-layout")) layoutMode(!document.body.classList.contains("editing"));
  if (t.closest("#reset-layout")) resetLayout();
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.matches("[data-t]")) { W.tier = t.dataset.t; subRender(); }
  else if (t.matches("[data-vc]")) { if (t.checked) W.ids.add(t.dataset.vc); else if (W.ids.size > 1) W.ids.delete(t.dataset.vc); subRender(); }
  else if (t.id === "sub-agree") $("#sub-go").disabled = !t.checked;
});
const kk = $("#kk"); if (kk) kk.oninput = () => { G.k = +kk.value; $("#kv").textContent = G.k.toFixed(1); rerun(); };
["heat", "spec"].forEach(id => { const c = $("#" + id); if (c) new ResizeObserver(() => id === "heat" ? heat() : spec()).observe(c); });
addEventListener("keydown", e => {
  if (e.key === "Escape") $$(".mdl").forEach(m => m.remove());
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); return palette(); }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); return palette(); }
  const i = "1234".indexOf(e.key); if (i >= 0) { const b = $$("[data-tf]")[i]; if (b) b.click(); }
});
vbar(); loadLayout();
})();