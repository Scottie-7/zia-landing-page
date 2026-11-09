/* Sonar Pro v2: aggregated back-to-back ladder + venue/tier settings, liquidity heatmap, order-flow spectrogram,
   barrier forecast (configurable horizon), features, L2-L3 book reconstruction, evaluation board, side-dock latency box + market movers,
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
const G = {sym: "", hz: 180, k: 1, sel: new Set(["NSDQ", "ARCA"]), tier: "L2", flip: false, pop: false, rv: "L2", gate: 0};
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
.rr{display:grid;grid-template-columns:52px 1fr 54px;align-items:center;gap:4px;height:15px;font:10px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}
.rr b{text-align:right;font-weight:600}.rr.bid b{color:#10B981}.rr.ask b{color:#fb7185}.rr u{text-decoration:none;color:#e2e8f0;text-align:right;white-space:nowrap}
.rr .bar{display:flex;height:9px;overflow:hidden;border-radius:1px}.rr .bar i{height:100%;min-width:1px;border-right:1px solid #080C14}
#dock{position:fixed;left:0;top:4.5rem;bottom:0;z-index:40;pointer-events:none}
#dock-rail{pointer-events:auto;position:absolute;left:0;top:0;display:flex;flex-direction:column;gap:4px}
.dk-tab{writing-mode:vertical-rl;transform:rotate(180deg);padding:10px 4px;border:1px solid #334155;border-left:0;border-radius:0 6px 6px 0;background:#0b1220;font:600 10px "JetBrains Mono",monospace;color:#94A3B8}
.dk-tab.on{background:#083344;color:#00F0FF;border-color:#0e7490}
#dock-panel{pointer-events:auto;position:absolute;left:26px;top:0;width:min(236px,calc(100vw - 40px));max-height:calc(100vh - 5rem);overflow-y:auto;padding:8px 8px 0;border:1px solid #1e293b;border-radius:0 8px 8px 0;background:rgba(8,12,20,.96);backdrop-filter:blur(10px);box-shadow:8px 0 30px rgba(0,0,0,.5);transform:translateX(-110%);visibility:hidden;transition:transform .2s,visibility 0s .2s}
#dock-panel.open{transform:none;visibility:visible;transition:transform .2s}
.rr.gate{background:rgba(255,255,255,.05)}.rc-tip{position:absolute;padding:3px 5px;border:1px solid;border-radius:4px;background:rgba(2,6,23,.94);font:9px "JetBrains Mono",monospace;line-height:1.35;color:#e2e8f0;white-space:nowrap}
.dk-sec{margin-bottom:8px;overflow:hidden;max-height:540px;border:1px solid #1e293b;border-radius:6px;background:rgba(15,23,42,.7);transition:max-height .2s}.dk-sec.shut{max-height:0;margin:0;border-width:0}
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
  const t = tob(d.A), sig15 = t.mid >= 100 ? .0002 + (hs(d.sym) % 30) / 1e5 : .0025 + (hs(d.sym) % 30) / 1e4, sigH = sig15 * Math.sqrt(G.hz / 15), theta = Math.max(.0015, G.k * sigH); // sample sigma; backend supplies real values
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
const spark = (a, c) => { if (a.length < 2) return ""; const mn = Math.min(...a), mx = Math.max(...a), r = mx - mn || 1; return `<svg viewBox="0 0 100 22" class="w-full h-4" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${c}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${a.map((v, i) => `${(i / (a.length - 1) * 100).toFixed(1)},${(20 - (v - mn) / r * 18).toFixed(1)}`).join(" ")}"/></svg>`; };
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
  el.innerHTML = FD.map(([k, n, fm, sg]) => { const a = F.h[k], v = a[a.length - 1], c = sg && v < 0 ? "#F59E0B" : sg ? "#10B981" : "#00F0FF"; return `<div class="bg-slate-950/80 border border-slate-800 rounded px-2 py-1"><div class="text-[10px] text-slate-400">${n}</div><div class="mono text-sm font-semibold" style="color:${c}">${v === undefined ? "–" : fm(v)}</div>${spark(a, c)}</div>`; }).join("");
}

/* ---------- Level 2-3 order book reconstruction: venue-stacked depth + order queues, hover/pin crosshair, price gate (L3 = sample MBO until backend feed) ---------- */
const VC = ["#38BDF8", "#A78BFA", "#F472B6", "#FBBF24", "#34D399", "#FB923C", "#60A5FA", "#C084FC", "#2DD4BF", "#F87171", "#A3E635", "#E879F9"], vcol = id => VC[VEN.findIndex(v => v.id === id)] || "#94A3B8";
const RC = {pmin: 0, pmax: 1, A: null, mid: 1, dd: 2, pin: null, hov: null, sym: ""}, GH = {k: "", h: [], prev: new Map()};
const lvlAt = (A, p, ex) => { const m = [...A.bids.slice(0, 10), ...A.asks.slice(0, 10)].reduce((a, l) => !a || Math.abs(l.price - p) < Math.abs(a.price - p) ? l : a, null); return ex && (!m || Math.abs(m.price - p) > tkOf(RC.mid) / 2) ? {price: p, size: 0, v: {}} : m; };
function crossHTML() {
  const A = RC.A; if (!A) return "";
  const one = (p, pin) => { const l = lvlAt(A, p, pin); if (!l) return ""; const bid = l.price < RC.mid, cum = sum((bid ? A.bids : A.asks).slice(0, 10).filter(q => bid ? q.price >= l.price : q.price <= l.price)), x = (l.price - RC.pmin) / ((RC.pmax - RC.pmin) || 1) * 100, c = pin ? "#FBBF24" : "#E2E8F0", right = x > 58;
    return `<div style="position:absolute;top:0;bottom:0;left:${x.toFixed(2)}%;border-left:1px ${pin ? "dashed" : "solid"} ${c}"></div><div class="rc-tip" style="${right ? "right" : "left"}:${(right ? 100 - x : x).toFixed(2)}%;${pin ? "bottom" : "top"}:2px;border-color:${c}"><b style="color:${bid ? "#34D399" : "#FB7185"}">${bid ? "BID" : "ASK"} ${f(l.price, RC.dd)}</b>${pin ? " · pinned" : ""}<br>Resting <b>${l.size.toLocaleString()}</b> sh<br>Cum from touch ${cmp.format(cum)} sh · ${Math.abs((l.price - RC.mid) * 100).toFixed(1)}¢ from mid${l.size ? `<br><span style="color:#94A3B8">${Object.entries(l.v).map(([k, s]) => nm(k) + " " + cmp.format(s)).join(" · ")}</span>` : ""}</div>`; };
  return (RC.pin != null ? one(RC.pin, 1) : "") + (RC.hov != null ? one(RC.hov, 0) : "");
}
const paintCross = () => { const o = $("#rc-ov"); if (o) o.innerHTML = crossHTML(); };
function recon(d) {
  const el = $("#recon"); if (!el) return;
  const A = d.A, N = 10, t = tob(A), dd = dec(d.book.mid), evs = d.book.events || [], bids = A.bids.slice(0, N), asks = A.asks.slice(0, N), L3 = G.rv === "L3";
  const mx = Math.max(1, ...bids.map(l => l.size), ...asks.map(l => l.size)), bT = sum(bids), aT = sum(asks), im = (bT - aT) / ((bT + aT) || 1), mc = Math.max(bT, aT, 1);
  const pmin = bids[bids.length - 1].price, pmax = asks[asks.length - 1].price, X = p => ((p - pmin) / ((pmax - pmin) || 1) * 300).toFixed(1), Y = c => (96 - c / mc * 90).toFixed(1);
  if (RC.sym !== d.sym) Object.assign(RC, {sym: d.sym, pin: null, hov: null}); Object.assign(RC, {pmin, pmax, A, mid: t.mid, dd});
  const n = G.gate, gk = d.sym + n; if (GH.k !== gk) Object.assign(GH, {k: gk, h: [], prev: new Map()});
  let g = null;
  if (n) { const gb = bids.slice(0, n), ga = asks.slice(0, n), b = sum(gb), a = sum(ga), now = Date.now(); let ch = 0; [...gb, ...ga].forEach(l => { if (GH.prev.has(l.price)) ch += Math.abs(l.size - GH.prev.get(l.price)); }); GH.prev = new Map([...gb, ...ga].map(l => [l.price, l.size]));
    GH.h.push({t: now, b, a, ch: ch / ((b + a) || 1)}); if (GH.h.length > 60) GH.h.shift(); const o = GH.h[Math.max(0, GH.h.length - 6)], dt = Math.max(1, (now - o.t) / 1000);
    g = {b, a, eb: gb[gb.length - 1].price, ea: ga[ga.length - 1].price, rb: (b - o.b) / dt, ra: (a - o.a) / dt, ch: GH.h[GH.h.length - 1].ch}; }
  const area = (L, col) => { let c = 0; const pts = []; L.forEach((l, i) => { if (i) pts.push([X(l.price), Y(c)]); c += l.size; pts.push([X(l.price), Y(c)]); }); const e = pts[pts.length - 1]; return `<polygon points="${[[pts[0][0], 100], ...pts, [e[0], 100]].join(" ")}" fill="${col}" fill-opacity=".28" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`; };
  const gl = g ? `<rect x="${X(g.eb)}" y="0" width="${(X(g.ea) - X(g.eb)).toFixed(1)}" height="100" fill="#fff" fill-opacity=".05"/>${[[g.eb, "#A3E635"], [g.ea, "#E879F9"]].map(([p, c]) => `<line x1="${X(p)}" x2="${X(p)}" y1="0" y2="100" stroke="${c}" stroke-width="1.6" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`).join("")}` : "";
  const segs = l => Object.entries(l.v).map(([k, s]) => { if (!L3) return `<i style="flex:${s};background:${vcol(k)}" title="${nm(k)} ${s.toLocaleString()}"></i>`; const r = rng(hs(k + l.price)), q = 1 + Math.floor(r() * Math.min(5, 1 + s / 400)), w = Array.from({length: q}, () => .3 + r()), W2 = w.reduce((a, c) => a + c, 0); return w.map((z, i) => `<i style="flex:${s * z / W2};background:${vcol(k)};opacity:${i % 2 ? .62 : 1}" title="${nm(k)} order ${i + 1}/${q} · ~${Math.round(s * z / W2 / 100) * 100}"></i>`).join(""); }).join("");
  const row = (side, l) => { const e = evs.find(x => x.side === side && Math.abs(x.price - l.price) < 1e-6), ice = e && e.type[0] === "i", ing = g && (side === "bid" ? l.price >= g.eb : l.price <= g.ea); return `<div class="rr ${side} ${ing ? "gate" : ""}"><b>${f(l.price, dd)}</b><span><span class="bar" style="width:${(l.size / mx * 100).toFixed(1)}%">${segs(l)}</span></span><u>${e ? `<em class="ev ${ice ? "cy" : "am"}" title="${TIP[e.type]}">${ice ? "+1" : "−1"}</em> ` : ""}${cmp.format(l.size)}</u></div>`; };
  const tabs = ["L2", "L3"].map(k => `<button class="btn ${G.rv === k ? "on" : ""}" data-rv="${k}" title="${TIER[k].d}">${k}${k === "L3" && !PRO ? " " + LOCK : ""}</button>`).join("");
  const tot = Object.entries(A.V).map(([k, v]) => [k, sum(v.bids.slice(0, N)) + sum(v.asks.slice(0, N))]), all = tot.reduce((s, x) => s + x[1], 0) || 1;
  const gbtn = [0, 3, 5, 10, 15].map(k => `<button class="btn ${G.gate === k ? "on" : ""}" data-gate="${k}">${k || "Off"}</button>`).join("");
  let gh = `<div class="mt-1 text-slate-500">Pick 3, 5, 10 or 15 levels to total the resting shares from the touch out to that depth on each side.</div>`;
  if (g) { const hh = GH.h, tt = g.b + g.a || 1, mxv = Math.max(1, ...hh.map(q => Math.max(q.b, q.a))), pl = k => hh.map((q, i) => `${(i / Math.max(1, hh.length - 1) * 120).toFixed(1)},${(28 - q[k] / mxv * 26).toFixed(1)}`).join(" "), rt = v => (v >= 0 ? "+" : "−") + cmp.format(Math.abs(v)) + "/s", cl = g.ch >= .5 ? ["High", "#F43F5E"] : g.ch >= .25 ? ["Medium", "#FBBF24"] : ["Low", "#34D399"];
    gh = `<div class="mt-1.5 grid grid-cols-2 gap-2 mono"><div><div class="text-[9px] text-slate-400">BUY ${f(g.eb, dd)} → ${f(bids[0].price, dd)} · ${((t.mid - g.eb) * 100).toFixed(1)}¢</div><div class="text-sm font-bold" style="color:#A3E635">${g.b.toLocaleString()} sh</div><div style="color:${g.rb >= 0 ? "#34D399" : "#FBBF24"}">${rt(g.rb)}</div></div><div class="text-right"><div class="text-[9px] text-slate-400">${f(asks[0].price, dd)} → ${f(g.ea, dd)} SELL · ${((g.ea - t.mid) * 100).toFixed(1)}¢</div><div class="text-sm font-bold" style="color:#E879F9">${g.a.toLocaleString()} sh</div><div style="color:${g.ra >= 0 ? "#34D399" : "#FBBF24"}">${rt(g.ra)}</div></div></div>
<div class="mt-1 flex h-1.5 overflow-hidden rounded bg-slate-800"><i style="width:${g.b / tt * 100}%;background:#A3E635"></i><i style="width:${g.a / tt * 100}%;background:#E879F9"></i></div>
<svg viewBox="0 0 120 30" preserveAspectRatio="none" class="mt-1 h-8 w-full" role="img" aria-label="Live gated size history"><polyline fill="none" stroke="#A3E635" stroke-width="1.4" vector-effect="non-scaling-stroke" points="${pl("b")}"/><polyline fill="none" stroke="#E879F9" stroke-width="1.4" vector-effect="non-scaling-stroke" points="${pl("a")}"/></svg>
<div class="flex justify-between text-[9px] text-slate-400"><span>Buy ${(g.b / tt * 100).toFixed(0)}% · Sell ${(g.a / tt * 100).toFixed(0)}%</span><span>Contested <b style="color:${cl[1]}">${cl[0]}</b> · ${(g.ch * 100).toFixed(0)}% turnover/tick</span></div>`; }
  el.innerHTML = `<div class="flex items-center justify-between"><div class="flex gap-1">${tabs}</div><span class="text-slate-400">${L3 ? "Order queues (sample MBO)" : "Depth by venue"} · hover size, click pin</span></div>
<div class="mt-2 flex justify-between mono"><span class="text-emerald-400">Bid ${cmp.format(bT)}</span><span class="${im >= 0 ? "text-emerald-400" : "text-rose-400"}">Imbalance ${im >= 0 ? "+" : ""}${(im * 100).toFixed(0)}%</span><span class="text-rose-400">Ask ${cmp.format(aT)}</span></div>
<div class="rc-chart relative mt-1 cursor-crosshair"><svg viewBox="0 0 300 100" preserveAspectRatio="none" class="block w-full h-[120px] rounded border border-slate-800 bg-slate-950/70" role="img" aria-label="Cumulative bid and ask depth">${area(bids, "#10B981")}${area(asks, "#F43F5E")}${gl}<line x1="${X(t.mid)}" x2="${X(t.mid)}" y1="0" y2="100" stroke="#38BDF8" stroke-width="1.6" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 3px #38BDF8)"/></svg><div id="rc-ov" class="pointer-events-none absolute inset-0 overflow-hidden">${crossHTML()}</div></div>
<div class="flex justify-between mono text-[9px] text-slate-500"><span>${f(pmin, dd)}</span><span class="text-sky-400">${f(t.mid, dd + 1)}</span><span>${f(pmax, dd)}</span></div>
<div class="mt-1.5 rounded border border-slate-800 bg-slate-950/60 p-1.5"><div class="flex items-center justify-between"><span class="text-slate-300">Price gate · levels from touch</span><div class="flex gap-1">${gbtn}</div></div>${gh}</div>
<div class="mt-1.5">${asks.slice().reverse().map(l => row("ask", l)).join("")}<div class="mid2">Spread ${f(t.ba - t.bb, dd)} · Micro ${f(t.micro, dd + 1)}</div>${bids.map(l => row("bid", l)).join("")}</div>
<div class="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-400">${tot.sort((a, c) => c[1] - a[1]).map(([k, v]) => `<span><b style="color:${vcol(k)}">■</b> ${nm(k)} ${(v / all * 100).toFixed(0)}%</span>`).join("")}</div>`;
}
/* glowing current-price line + axis tag + buy/sell pressure bar, shared by heatmap and spectrogram */
function curLine(x, w, aw, ym, mid, dd, bT, aT, lb) {
  x.save(); x.shadowColor = "#38BDF8"; x.shadowBlur = 12; x.strokeStyle = "#38BDF8"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, ym); x.lineTo(w - aw, ym); x.stroke(); x.restore();
  x.fillStyle = "#38BDF8"; x.fillRect(w - aw + 1, ym - 7, aw - 2, 14); x.fillStyle = "#020617"; x.fillText(f(mid, dd), w - aw + 4, ym + 3);
  const tt = bT + aT || 1, bw = 90 * bT / tt; x.fillStyle = "#10B981"; x.fillRect(6, 6, bw, 4); x.fillStyle = "#F43F5E"; x.fillRect(6 + bw, 6, 90 - bw, 4);
  x.fillStyle = "#cbd5e1"; x.fillText(`${lb[0]} ${(bT / tt * 100).toFixed(0)}% · ${lb[1]} ${(aT / tt * 100).toFixed(0)}%`, 102, 11);
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
  H.cols.forEach(c => ks(c).forEach(k => c.L[k].forEach(l => { const a = Math.sqrt(l.size * tkp(l.price) / mx); if (a < .05) return; const hh = ch * (.55 + .85 * a); x.fillStyle = l.price >= c.mid ? `hsla(${(18 - 18 * a).toFixed(0)},92%,${(46 + 10 * a).toFixed(0)}%,${(.12 + .8 * a).toFixed(2)})` : `hsla(${(168 - 30 * a).toFixed(0)},78%,${(36 + 14 * a).toFixed(0)}%,${(.12 + .8 * a).toFixed(2)})`; x.fillRect(X(c.n), Y(l.price) - hh / 2, cw + .5, hh); })));
  x.lineWidth = 1; x.fillStyle = "#94A3B8";
  for (let i = 0; i <= 4; i++) { const pr = pmin + (pmax - pmin) * i / 4, y = Y(pr); x.strokeStyle = "rgba(30,41,59,.8)"; x.beginPath(); x.moveTo(0, y); x.lineTo(w - aw, y); x.stroke(); x.fillText(f(pr, dd), w - aw + 6, y + 3); }
  x.strokeStyle = "rgba(248,250,252,.75)"; x.lineWidth = 1.2; x.beginPath(); H.cols.forEach((c, i) => { const px = X(c.n) + cw / 2; i ? x.lineTo(px, Y(c.mid)) : x.moveTo(px, Y(c.mid)); }); x.stroke();
  const pf = new Map(); ks(last).forEach(k => last.L[k].forEach(l => pf.set(l.price, (pf.get(l.price) || 0) + l.size))); const pm = Math.max(1, ...pf.values()); let bT = 0, aT = 0;
  pf.forEach((s, pr) => { const ask = pr >= mid, bw = s / pm * 44; if (ask) aT += s; else bT += s; x.fillStyle = ask ? "rgba(244,63,94,.55)" : "rgba(16,185,129,.55)"; x.fillRect(w - aw - bw, Y(pr) - ch / 2, bw, Math.max(1.5, ch - .5)); });
  curLine(x, w, aw, Y(mid), mid, dd, bT, aT, ["Buy", "Sell"]);
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

/* ---------- Order-flow spectrogram: bid x ask footprint with volume profile (sample prints until the live tape connects) ---------- */
const SP = {cols: [], sym: "", lastT: 0, wall: null};
function fpSynth(m, mid) { const tk = tkOf(mid), kc = Math.round(mid / tk); for (let i = 0; i < 8; i++) { const k = kc + Math.round((Math.random() + Math.random() - 1) * 4), e = m.get(k) || [0, 0]; e[Math.random() > .5 ? 1 : 0] += 100 * Math.ceil(Math.random() ** 2 * 12); m.set(k, e); } }
function specIngest(d) {
  const mid = d.book.mid, tk = tkOf(mid), tp = d.tape || [], big = a => a.slice(0, 10).reduce((m, l) => l.size > m.size ? l : m, a[0]);
  if (SP.sym !== d.sym) { SP.sym = d.sym; SP.lastT = 0; SP.cols = H.cols.slice(-89).map(c => { const m = new Map(); fpSynth(m, c.mid); return {mid: c.mid, m}; }); }
  const m = new Map(); if (!Sonar.live) fpSynth(m, mid);
  tp.filter(x => x.t > SP.lastT).forEach(x => { const k = Math.round(x.price / tk), e = m.get(k) || [0, 0]; e[x.side === "buy" ? 1 : 0] += x.size; m.set(k, e); });
  SP.lastT = Math.max(SP.lastT, ...tp.map(x => x.t)); SP.cols.push({mid, m}); if (SP.cols.length > 90) SP.cols.shift();
  SP.wall = {a: big(d.A.asks).price, b: big(d.A.bids).price};
}
function spec() {
  const cv = $("#spec"); if (!cv || !SP.cols.length) return;
  const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.font = "8px 'JetBrains Mono',monospace";
  const mid = SP.cols[SP.cols.length - 1].mid, tk = tkOf(mid), dd = dec(mid), kc = Math.round(mid / tk), R = 15, top = 20, bot = 22, aw = 54, pw = 56, x0 = pw + 4, x1 = w - aw, K = 6;
  const rh = (h - top - bot) / R, Yp = p => top + (kc + 7 - p / tk + .5) * rh, inW = k => Math.abs(k - kc) <= 7, bars = [];
  for (let e = SP.cols.length; e > 0; e -= K) { const cs = SP.cols.slice(Math.max(0, e - K), e), m = new Map(); cs.forEach(c => c.m.forEach((v, k) => { const q = m.get(k) || [0, 0]; q[0] += v[0]; q[1] += v[1]; m.set(k, q); })); bars.unshift({m, mid: cs[cs.length - 1].mid}); }
  const bw = (x1 - x0) / Math.ceil(90 / K), bx = i => x1 - (bars.length - i) * bw, prof = new Map(); let mxC = 1, bT = 0, aT = 0;
  bars.forEach(b => b.m.forEach((v, k) => { if (!inW(k)) return; mxC = Math.max(mxC, v[0] + v[1]); const q = prof.get(k) || [0, 0]; q[0] += v[0]; q[1] += v[1]; prof.set(k, q); aT += v[0]; bT += v[1]; }));
  const mxP = Math.max(1, ...[...prof.values()].map(v => v[0] + v[1])), poc = [...prof].reduce((m, [k, v]) => v[0] + v[1] > m[1] ? [k, v[0] + v[1]] : m, [kc, -1])[0];
  x.lineWidth = 1;
  for (let k = kc - 7; k <= kc + 7; k++) { const y = Yp(k * tk); x.strokeStyle = "rgba(30,41,59,.55)"; x.beginPath(); x.moveTo(x0, y + rh / 2); x.lineTo(x1, y + rh / 2); x.stroke(); if ((k - kc) % 2 === 0) { x.fillStyle = "#94A3B8"; x.fillText(f(k * tk, dd), x1 + 6, y + 3); } }
  if (SP.wall) [[SP.wall.a, "244,63,94"], [SP.wall.b, "16,185,129"]].forEach(([p, c]) => { const y = Yp(p); if (y < top || y > h - bot) return; x.fillStyle = `rgba(${c},.12)`; x.fillRect(x0, y - rh / 2, x1 - x0, rh); x.fillStyle = `rgba(${c},.95)`; x.fillText("S/R", x0 + 3, y + 3); });
  prof.forEach(([s, b], k) => { const y = Yp(k * tk) - rh / 2, ws = s / mxP * pw, wb = b / mxP * pw; x.fillStyle = "rgba(244,63,94,.7)"; x.fillRect(0, y + 1, ws, rh - 2); x.fillStyle = "rgba(16,185,129,.7)"; x.fillRect(ws, y + 1, wb, rh - 2); if (k === poc) { x.strokeStyle = "#FBBF24"; x.strokeRect(.5, y + 1.5, ws + wb, rh - 3); } });
  bars.forEach((b, i) => {
    const X0 = bx(i) + 1, cw = bw - 2, hl = cw / 2; let pk = -1, pocK = null, dl = 0;
    b.m.forEach((v, k) => { dl += v[1] - v[0]; if (!inW(k)) return; const tot = v[0] + v[1], y = Yp(k * tk) - rh / 2; if (tot > pk) { pk = tot; pocK = k; }
      x.fillStyle = (v[1] >= v[0] ? "rgba(16,185,129," : "rgba(244,63,94,") + (.08 + .4 * tot / mxC).toFixed(2) + ")"; x.fillRect(X0, y + .5, cw, rh - 1);
      const ib = v[1] >= 3 * v[0] && v[1] >= 300, is = v[0] >= 3 * v[1] && v[0] >= 300; if (ib) { x.fillStyle = "#22C55E"; x.fillRect(X0 + hl, y + .5, hl, rh - 1); } if (is) { x.fillStyle = "#EF4444"; x.fillRect(X0, y + .5, hl, rh - 1); }
      if (rh >= 9) { x.textAlign = "left"; x.fillStyle = is ? "#0B1120" : "#FB7185"; x.fillText(cmp.format(v[0]), X0 + 2, y + rh / 2 + 3); x.textAlign = "right"; x.fillStyle = ib ? "#0B1120" : "#34D399"; x.fillText(cmp.format(v[1]), X0 + cw - 2, y + rh / 2 + 3); x.textAlign = "left"; } });
    if (pocK !== null) { x.strokeStyle = "#FBBF24"; x.strokeRect(X0 + .5, Yp(pocK * tk) - rh / 2 + .5, cw - 1, rh - 1); }
    x.textAlign = "center"; x.fillStyle = dl >= 0 ? "#34D399" : "#FB7185"; x.fillText((dl >= 0 ? "+" : "") + cmp.format(dl), X0 + cw / 2, h - 12); x.textAlign = "left";
  });
  x.strokeStyle = "rgba(248,250,252,.7)"; x.lineWidth = 1.2; x.beginPath(); bars.forEach((b, i) => { const px = bx(i) + bw / 2, py = Yp(b.mid); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
  x.setLineDash([4, 3]); x.lineWidth = 1; x.strokeStyle = "rgba(251,191,36,.8)"; x.beginPath(); x.moveTo(x0, Yp(poc * tk)); x.lineTo(x1, Yp(poc * tk)); x.stroke(); x.setLineDash([]); x.fillStyle = "#FBBF24"; x.fillText("POC", x1 - 22, Yp(poc * tk) - 3);
  curLine(x, w, aw, Yp(mid), mid, dd, bT, aT, ["Buy vol", "Sell vol"]);
  x.fillStyle = "#94A3B8"; x.fillText("−180s", x0, h - 3); x.fillText("now", x1 - 24, h - 3);
}

/* ---------- Flow & activity signals (sample-derived from the tape and book until the backend supplies them) ---------- */
const FL = {sym: "", v: [], vl: [], sk: [], an: [], n: 0, tot: 0, sa: 0};
function flow2(d) {
  const el = $("#flow2"); if (!el) return;
  if (FL.sym !== d.sym) Object.assign(FL, {sym: d.sym, v: [], vl: [], sk: [], an: [], n: 0, tot: 0, sa: 0});
  const A = d.A, t = tob(A), tp = d.tape || [], ts = tp.map(q => q.t), span = Math.max(1, (Math.max(...ts, 0) - Math.min(...ts, Infinity)) / 1000);
  const vm = tp.reduce((s, q) => s + q.size, 0) / span * 60, vel = tp.length / span, bf = tp.length ? tp.filter(q => q.side === "buy").length / tp.length : .5;
  FL.n++; FL.tot += vm; const avg = FL.tot / FL.n; [[FL.v, vm], [FL.vl, vel], [FL.sk, bf]].forEach(([a, v]) => { a.push(v); if (a.length > 40) a.shift(); });
  const sp = t.ba - t.bb, mdn = FL.sa || sp; FL.sa = FL.sa ? FL.sa * .95 + sp * .05 : sp;
  const st = t.bb > t.ba ? 3 : (t.bb === t.ba || sp > 2.5 * mdn) ? 2 : (d.book.events || []).some(e => e.type[0] === "u") ? 1 : 0; FL.an.push(st); if (FL.an.length > 40) FL.an.shift();
  const nl = n => [sum(A.bids.slice(0, n)), sum(A.asks.slice(0, n))], r5 = nl(5), r10 = nl(10), im5 = (r5[0] - r5[1]) / ((r5[0] + r5[1]) || 1), AC = ["#334155", "#F59E0B", "#FB923C", "#F43F5E"];
  const T = (l, v, c, vis, sub) => `<div class="flex flex-col rounded border border-slate-800 bg-slate-950/80 px-2 py-1.5"><div class="text-[10px] text-slate-400">${l}</div><div class="mono text-sm font-semibold" style="color:${c}">${v}</div><div class="my-1 flex-1 min-h-[26px]">${vis}</div><div class="text-[9px] text-slate-500">${sub}</div></div>`;
  const bars = (a, c, ref) => { const m = Math.max(1, ...a, ref || 0); return `<svg viewBox="0 0 80 30" preserveAspectRatio="none" class="h-full w-full" aria-hidden="true">${a.map((v, i) => `<rect x="${i * 2}" y="${(30 - v / m * 28).toFixed(1)}" width="1.5" height="${(v / m * 28).toFixed(1)}" fill="${c}"/>`).join("")}${ref ? `<line x1="0" x2="80" y1="${(30 - ref / m * 28).toFixed(1)}" y2="${(30 - ref / m * 28).toFixed(1)}" stroke="#FBBF24" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>` : ""}</svg>`; };
  const strip = (a, fn, ht) => `<svg viewBox="0 0 80 8" preserveAspectRatio="none" class="w-full ${ht || "h-2"}" aria-hidden="true">${a.map((v, i) => `<rect x="${i * 2}" width="2" height="8" fill="${fn(v)}"/>`).join("")}</svg>`;
  const split = (l, [b, a]) => `<div class="mono flex items-center gap-1 text-[9px]"><span class="w-9 text-slate-400">${l}</span><span class="w-9 text-right text-emerald-400">${cmp.format(b)}</span><div class="flex h-1.5 flex-1 overflow-hidden rounded bg-slate-800"><i style="width:${b / ((b + a) || 1) * 100}%;background:#10B981"></i><i style="width:${a / ((b + a) || 1) * 100}%;background:#F43F5E"></i></div><span class="w-9 text-rose-400">${cmp.format(a)}</span></div>`;
  const mxv = Math.max(.001, ...FL.vl), flagged = FL.an.filter(v => v > 0).length;
  el.innerHTML = T("Avg volume / min", cmp.format(vm) + "/min", "#00F0FF", bars(FL.v, "rgba(0,240,255,.75)", avg), `session avg ${cmp.format(avg)}/min · ${((vm / avg - 1) * 100).toFixed(0)}% vs avg · ${$("#sess") ? $("#sess").textContent : ""}`)
  + T("Order velocity", vel.toFixed(1) + " prints/s", "#A78BFA", `<div class="flex h-full flex-col gap-0.5">${bars(FL.vl, "rgba(167,139,250,.8)")}${strip(FL.vl, v => `rgba(0,240,255,${(.08 + .9 * v / mxv).toFixed(2)})`)}${strip(FL.sk, v => v >= .5 ? `rgba(16,185,129,${(.2 + (v - .5) * 1.6).toFixed(2)})` : `rgba(244,63,94,${(.2 + (.5 - v) * 1.6).toFixed(2)})`)}</div>`, `intensity strip · buy/sell skew strip (${(bf * 100).toFixed(0)}% buys)`)
  + T("Resting orders · near touch", (im5 >= 0 ? "+" : "") + (im5 * 100).toFixed(0) + "% bid", im5 >= 0 ? "#34D399" : "#FB7185", `<div class="flex h-full flex-col justify-center gap-1">${split("5 lvl", r5)}${split("10 lvl", r10)}</div>`, "shares on nearest 5 / 10 levels · buy left, sell right")
  + T("Book integrity", ["Book clean", "Depletion seen", "Locked / wide", "CROSSED"][st], st ? AC[st] : "#34D399", `<div class="flex h-full items-center">${strip(FL.an, v => AC[v], "h-3")}</div>`, `${flagged} flagged of last ${FL.an.length} ticks · spread ${f(sp / t.mid * 1e4, 1)} bps`);
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

/* ---------- Latency waterfall (compact mini box in the side dock) ---------- */
const LT = [], LC = ["#38BDF8", "#A78BFA", "#F472B6", "#FBBF24", "#34D399", "#FB923C"];
function latency(d) {
  const el = $("#lat"); if (!el) return; const j = Math.random, br = d.status && d.status.book_age_ms || 8 + j() * 6;
  const st = [["Exchange → receive", br], ["Reorder window", 10], ["100 ms grid bucket", 38 + j() * 24], ["Feature build", 3 + j() * 3], ["Model inference", 7 + j() * 6], ["Render", 4 + j() * 4]], tot = st.reduce((s, x) => s + x[1], 0);
  LT.push(tot); if (LT.length > 60) LT.shift(); const s = [...LT].sort((a, b) => a - b);
  el.innerHTML = `<div class="flex h-2 overflow-hidden rounded bg-slate-800">${st.map(([n, v], i) => `<i title="${n} ${v.toFixed(1)} ms" style="width:${v / tot * 100}%;background:${LC[i]}"></i>`).join("")}</div>
<div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-slate-400">${st.map(([n, v], i) => `<span class="flex justify-between gap-1"><span class="truncate"><b style="color:${LC[i]}">■</b> ${n}</span><span class="mono text-slate-200">${v.toFixed(0)}</span></span>`).join("")}</div>
<div class="mt-1.5 flex justify-between text-[10px] text-slate-400"><span>End to end <span class="mono text-cyan-400">${tot.toFixed(1)} ms</span></span><span>p50 <span class="mono text-slate-200">${s[Math.floor(s.length * .5)].toFixed(1)}</span> · p99 <span class="mono text-slate-200">${s[Math.min(s.length - 1, Math.floor(s.length * .99))].toFixed(1)}</span></span></div>`;
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
const SYMS = ["SPY", "ONEG", "CHOW", "SGRX", "KLNR", "VRTA", "TRBO", "NOVA", "PLZN"];
const PANELS = [["Liquidity heatmap", "heat"], ["Order-flow spectrogram", "spectro"], ["Model evaluation board", "evalb"], ["L2-L3 book reconstruction", "recon"], ["Barrier forecast", "barrier"], ["Order book ladder", "book"], ["Feature monitor", "feat"]];
const CMDS = () => [...SYMS.map(s => ({t: "Load ticker " + s, k: "symbol " + s, run: () => Sonar.setSym(s)})),
  ...["1m", "5m", "15m", "1D"].map((tf, i) => ({t: "Timeframe " + tf, k: "chart interval", run: () => { const b = $$("[data-tf]")[i]; if (b) b.click(); }})),
  ...[30, 60, 180, 300, 900].map(h => ({t: "Prediction horizon " + h + "s", k: "tau barrier model", run: () => setHz(h)})),
  {t: "Toggle layout edit mode", k: "drag resize move panels", run: () => layoutMode(!document.body.classList.contains("editing"))}, {t: "Reset layout", k: "default panels", run: resetLayout},
  {t: "Add data feeds and venues", k: "subscribe level 2 level 3 exchanges data", run: sub},
  {t: "Open Market Movers side panel", k: "hotlists gainers losers dock", run: () => dock("movers", true)}, {t: "Open Latency box", k: "pipeline waterfall dock", run: () => dock("lat", true)},
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
const LKEY = "zia_layout_v2", spanRe = /\b(lg|md):col-span-(\d+)\b/, SPANS = [3, 4, 5, 6, 8, 12];
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
  [setBar, ladder, recon, barrier, features, flow2, ingest, heat, specIngest, spec, evalBoard, latency].forEach(fn => { try { fn(d); } catch (err) { console.error("sonar-pro", fn.name, err); } });
});
document.addEventListener("click", e => {
  const t = e.target;
  if (t.closest("[data-sub]")) return sub();
  if (t.closest("[data-x]")) return $$(".mdl").forEach(m => m.remove());
  if (t.closest("[data-next]")) return subNext();
  if (t.closest("[data-back]")) { W.step--; return subRender(); }
  if (t.closest("[data-submit]")) return subSubmit();
  if (t.closest("[data-dl]")) return download();
  const gt = t.closest("[data-gate]"); if (gt) { G.gate = +gt.dataset.gate; return LAST && recon(LAST); }
  const dk = t.closest("[data-dock]"); if (dk) return dock(dk.dataset.dock);
  const rv = t.closest("[data-rv]"); if (rv) { if (rv.dataset.rv === "L3" && !PRO) return sub(); G.rv = rv.dataset.rv; return LAST && recon(LAST); }
  const tr = t.closest("[data-tier]"); if (tr) { if (tr.dataset.tier === "L3" && !PRO) return sub(); G.tier = tr.dataset.tier; vbar(); return LAST && ladder(LAST); }
  if (t.closest("[data-flip]")) { G.flip = !G.flip; return LAST && ladder(LAST); }
  if (t.closest("#ven-btn")) { G.pop = !G.pop; return vbar(); }
  const vr = t.closest(".vrow"); if (vr) { const v = VEN.find(x => x.id === vr.dataset.v); if (isLocked(v)) return sub(); if (G.sel.has(v.id) && G.sel.size > 1) G.sel.delete(v.id); else G.sel.add(v.id); vbar(); if (LAST) { LAST.A = agg(LAST.book, LAST.sym); [setBar, ladder, recon, heat].forEach(fn => fn(LAST)); } return; }
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
/* ---------- Collapsible side dock (state saved in this browser) ---------- */
const DK = Object.assign({movers: 0, lat: 0}, LS("zia_dock_v1") || {});
function dock(k, on) {
  if (k) { DK[k] = on === undefined ? !DK[k] : on; LS("zia_dock_v1", DK); }
  const p = $("#dock-panel"), open = !!(DK.movers || DK.lat); if (!p) return; p.classList.toggle("open", open); p.setAttribute("aria-hidden", String(!open));
  ["movers", "lat"].forEach(n => { const s = $(`[data-dk="${n}"]`); if (s) s.classList.toggle("shut", !DK[n]); $$(`.dk-tab[data-dock="${n}"]`).forEach(b => { b.classList.toggle("on", !!DK[n]); b.setAttribute("aria-expanded", String(!!DK[n])); }); });
}
vbar(); loadLayout(); dock();
const rcEl = $("#recon");
if (rcEl) { // hover = crosshair with resting shares at the price; click = pin / unpin that level
  const px = e => { const s = rcEl.querySelector(".rc-chart svg"); if (!s || !RC.A) return null; const r = s.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom ? null : RC.pmin + (e.clientX - r.left) / r.width * (RC.pmax - RC.pmin); };
  rcEl.addEventListener("mousemove", e => { const p = px(e); RC.hov = p == null ? null : lvlAt(RC.A, p).price; paintCross(); });
  rcEl.addEventListener("mouseleave", () => { RC.hov = null; paintCross(); });
  rcEl.addEventListener("click", e => { const p = px(e); if (p == null) return; const q = lvlAt(RC.A, p).price; RC.pin = RC.pin != null && Math.abs(RC.pin - q) < tkOf(RC.mid) / 2 ? null : q; paintCross(); });
}
})();