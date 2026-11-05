/* Sonar Pro panels: dual-venue ladder, liquidity heatmap, barrier forecast, feature monitor, promotion funnel.
   Hooks into sonar-ui.js through the "sonar:tick" event (book, tape, probs, status every 2 s).
   Shapes are identical in sample and api mode. book may carry venues:{NSDQ,ARCA}; a flat bids/asks book falls back to one venue. */
(() => {
const $ = s => document.querySelector(s);
const f = (n, d = 2) => Number(n).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const cmp = new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits: 1});
const hs = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const dec = p => p < 1 ? 4 : 2, tkOf = p => p < 1 ? 1e-4 : 0.01, pc = v => (v * 100).toFixed(2) + "%";
const sum = a => a.reduce((s, l) => s + l.size, 0);
const nm = k => k === "NSDQ" ? "Nasdaq" : k === "ARCA" ? "Arca" : k;
const TIP = {iceberg_absorption: "ICEBERG_ABSORPTION (+1): Aggressive print >= $10k with AIR >= 1.0.", unexecuted_depletion: "UNEXECUTED_DEPLETION (-1): Visible size fell >= $10k with AIR <= 0.05. Does not prove a cancel."};
const venues = b => b.venues || {NSDQ: {bids: b.bids, asks: b.asks}};

document.head.insertAdjacentHTML("beforeend", `<style>
#ladder2{display:grid;grid-template-columns:1fr 1fr;gap:8px;font:10px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}
.vh{display:flex;justify-content:space-between;margin-bottom:3px;font:600 11px Inter,sans-serif;color:#94A3B8}
.lv{position:relative;display:flex;justify-content:space-between;align-items:center;gap:3px;height:15px;padding:0 5px;background:linear-gradient(to left,rgb(var(--rgb)/.10) var(--c),transparent 0)}
.lv>*{position:relative}.lv i{position:absolute;left:0;top:1px;bottom:1px;background:rgb(var(--rgb)/.30)}
.lv.bid{--rgb:16 185 129}.lv.ask{--rgb:244 63 94}.lv b{font-weight:500}
.mid2{margin:2px 0;border-block:1px solid rgba(0,240,255,.3);background:#0f172a;text-align:center;font-size:10px;color:#00F0FF}
</style>`);

/* top of book across venues */
function tob(b) {
  const V = Object.values(venues(b)), bb = Math.max(...V.map(v => v.bids[0].price)), ba = Math.min(...V.map(v => v.asks[0].price));
  const bs = V.reduce((s, v) => s + (v.bids[0].price === bb ? v.bids[0].size : 0), 0), as = V.reduce((s, v) => s + (v.asks[0].price === ba ? v.asks[0].size : 0), 0);
  return {bb, ba, micro: (bb * as + ba * bs) / (bs + as)};
}

/* ---------- Dual-venue ladder ---------- */
function ladder(d) {
  const b = d.book, el = $("#ladder2"); if (!el) return;
  const V = venues(b), names = Object.keys(V), dd = dec(b.mid), N = 7, evs = b.events || [], t = tob(b);
  const mx = Math.max(1, ...names.flatMap(k => [...V[k].asks.slice(0, N), ...V[k].bids.slice(0, N)].map(l => l.size)));
  const tot = names.map(k => sum(V[k].bids.slice(0, 10)) + sum(V[k].asks.slice(0, 10))), all = tot.reduce((a, c) => a + c, 0) || 1;
  const col = k => {
    const v = V[k]; let ca = 0, cb = 0;
    const A = v.asks.slice(0, N).map(l => [l, ca += l.size]).reverse(), B = v.bids.slice(0, N).map(l => [l, cb += l.size]), cm = Math.max(ca, cb, 1);
    const bs = sum(v.bids.slice(0, 10)), as = sum(v.asks.slice(0, 10)), imb = (bs - as) / ((bs + as) || 1);
    const row = side => ([l, c]) => {
      const e = evs.find(e => e.side === side && Math.abs(e.price - l.price) < 1e-6 && (!e.venue || e.venue === k)), ice = e && e.type[0] === "i";
      return `<div class="lv ${side}" style="--c:${(c / cm * 100).toFixed(0)}%"><i style="width:${(l.size / mx * 100).toFixed(0)}%"></i><b>${f(l.price, dd)}</b>${e ? `<em class="ev ${ice ? "cy" : "am"}" title="${TIP[e.type]}">${ice ? "+1" : "−1"}</em>` : ""}<span>${cmp.format(l.size)}</span></div>`;
    };
    return `<div><div class="vh"><span>${nm(k)}</span><span title="Top-10 bid/ask imbalance" class="${imb >= 0 ? "text-emerald-400" : "text-rose-400"}">${imb >= 0 ? "+" : ""}${(imb * 100).toFixed(0)}%</span></div>${A.map(row("ask")).join("")}<div class="mid2">${f(v.asks[0].price - v.bids[0].price, dd)}</div>${B.map(row("bid")).join("")}</div>`;
  };
  el.innerHTML = names.map(col).join("") + `<div style="grid-column:1/-1"><div class="flex h-1.5 rounded overflow-hidden bg-slate-800">${tot.map((x, i) => `<div style="width:${x / all * 100}%" class="${i ? "bg-indigo-400/70" : "bg-cyan-500/70"}"></div>`).join("")}</div><div class="mt-1 text-center text-[10px] text-slate-400">Top-10 depth share: ${names.map((k, i) => `${nm(k)} ${(tot[i] / all * 100).toFixed(0)}%`).join(" · ")}</div><div class="text-center text-[10px] text-slate-400">Mid ${f((t.bb + t.ba) / 2, dd + 1)} · Micro ${f(t.micro, dd + 1)}</div></div>`;
}

/* ---------- Barrier forecast (spec section 7 triple-barrier) ---------- */
const H = {cols: [], bub: [], ev: [], n: 0, v: "ALL", sym: "", lastT: 0, bar: null, p: null};
function setBar(d) {
  const A = Object.values(venues(d.book)), ask = Math.min(...A.map(v => v.asks[0].price)), bid = Math.max(...A.map(v => v.bids[0].price));
  const sig15 = .0025 + (hs(d.sym) % 30) / 1e4, k = 1, sig180 = sig15 * Math.sqrt(12); // sample sigma; backend supplies real values
  const theta = (d.probs && d.probs.theta) || Math.max(.0015, k * sig180);
  H.bar = {ask, bid, k, sig180, theta, up: ask * (1 + theta), lo: bid * (1 - theta)}; H.p = d.probs;
}
function barrier(d) {
  const el = $("#barrier"), bar = H.bar; if (!el) return;
  const p = d.probs || {p_down: .3, p_neutral: .4, p_up: .3}, dd = dec(bar.ask), e = Math.floor(Date.now() / 1000) % 180;
  const cls = [["Down", p.p_down, "bg-amber-500", "text-amber-400"], ["Neutral", p.p_neutral, "bg-slate-500", "text-slate-300"], ["Up", p.p_up, "bg-emerald-500", "text-emerald-400"]], top = cls.reduce((a, c) => c[1] > a[1] ? c : a);
  const tile = (l, v, s, c) => `<div class="bg-slate-900 p-2 rounded border border-slate-800"><div class="text-slate-400 text-[10px]">${l}</div><div class="text-sm font-bold ${c} mt-0.5">$${f(v, dd)}</div><div class="text-[10px] text-slate-400">${s}</div></div>`;
  el.innerHTML = `<div class="text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 pb-1.5 flex justify-between items-center"><span class="font-bold text-cyan-400">Barrier Forecast (${d.sym})</span><span class="bg-cyan-950/60 ${top[3]} border border-cyan-800 px-2 py-0.5 rounded text-[10px]">Leading: ${top[0]} ${(top[1] * 100).toFixed(1)}%</span></div>
<div class="grid grid-cols-3 gap-2 text-center pt-1">${tile("Lower barrier", bar.lo, "bid × (1 − θ)", "text-amber-400")}${tile("Entry reference", bar.ask, "best ask", "text-slate-100")}${tile("Upper barrier", bar.up, "ask × (1 + θ)", "text-cyan-400")}</div>
${cls.map(([n, v, bg, tc]) => `<div class="flex items-center gap-2"><span class="w-14 text-slate-300">${n}</span><div class="flex-1 h-1.5 rounded bg-slate-800"><div class="${bg} h-1.5 rounded" style="width:${v * 100}%"></div></div><span class="w-12 text-right ${tc}">${(v * 100).toFixed(1)}%</span></div>`).join("")}
<div><div class="flex justify-between text-[10px] text-slate-400"><span>Window</span><span>${e} s / 180 s</span></div><div class="h-1 rounded bg-slate-800 mt-0.5"><div class="h-1 rounded bg-cyan-400" style="width:${e / 180 * 100}%"></div></div></div>
<div class="text-[10px] text-slate-400 flex justify-between gap-2"><span>θ = max(0.15%, k·σ₁₈₀) = ${pc(bar.theta)} · σ₁₈₀ ${pc(bar.sig180)} · k ${bar.k.toFixed(1)}</span><span class="text-cyan-400 shrink-0">Horizon: τ = 180s</span></div>
<div class="text-[10px] text-slate-400">Signal Source: DeepLOB CNN + Time &amp; Sales Velocity</div>`;
}

/* ---------- Microstructure feature monitor ---------- */
const side = (b, bid) => { const m = new Map(); Object.values(venues(b)).forEach(v => (bid ? v.bids : v.asks).forEach(l => m.set(l.price, (m.get(l.price) || 0) + l.size))); const ps = [...m.keys()].sort((a, c) => bid ? c - a : a - c).slice(0, 10); return {m: new Map(ps.map(p => [p, m.get(p)])), p10: ps[ps.length - 1]}; };
const ofi = (a, c, bid) => { let t = 0; new Set([...a.m.keys(), ...c.m.keys()]).forEach(p => { const beyond = lim => bid ? p < lim : p > lim; if (!a.m.has(p) && beyond(a.p10)) return; if (!c.m.has(p) && beyond(c.p10)) return; t += (c.m.get(p) || 0) - (a.m.get(p) || 0); }); return t; }; // entry/exit guards
const spark = (a, c) => { if (a.length < 2) return ""; const mn = Math.min(...a), mx = Math.max(...a), r = mx - mn || 1; return `<svg viewBox="0 0 100 22" class="w-full h-5" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${c}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${a.map((v, i) => `${(i / (a.length - 1) * 100).toFixed(1)},${(20 - (v - mn) / r * 18).toFixed(1)}`).join(" ")}"/></svg>`; };
const FD = [["mlofi", "MLOFI · 10 lvl", v => cmp.format(v), 1], ["mdiv", "Micro-price div", v => f(v, 1) + " bps", 1], ["air", "AIR · venue", v => f(v, 2), 0], ["svd", "Signed vol Δ", v => cmp.format(v), 1], ["rvol", "RVOL", v => f(v, 1) + "x", 0], ["sprd", "Spread", v => f(v, 0) + " bps", 0]];
const F = {sym: "", prev: null, h: {}};
function features(d) {
  const el = $("#feat"), b = d.book; if (!el) return;
  if (F.sym !== d.sym) { F.sym = d.sym; F.prev = null; FD.forEach(x => F.h[x[0]] = []); }
  const t = tob(b), mid = (t.bb + t.ba) / 2, cur = {B: side(b, true), A: side(b, false)}, push = (k, v) => { F.h[k].push(v); if (F.h[k].length > 60) F.h[k].shift(); };
  if (F.prev) push("mlofi", ofi(F.prev.B, cur.B, true) - ofi(F.prev.A, cur.A, false));
  F.prev = cur;
  push("mdiv", (t.micro - mid) / mid * 1e4); push("sprd", (t.ba - t.bb) / mid * 1e4);
  push("air", (b.events || []).some(e => e.type[0] === "i") ? 1 + Math.random() : Math.random() * .6); // sample; backend supplies AIR_v
  push("svd", (d.tape || []).reduce((s, x) => s + (x.side === "buy" ? x.size : -x.size), 0));
  push("rvol", 1.2 + (hs(d.sym) % 60) / 10 + (Math.random() - .5) * .3);
  el.innerHTML = FD.map(([k, n, fm, sg]) => { const a = F.h[k], v = a[a.length - 1], c = sg && v < 0 ? "#F59E0B" : sg ? "#10B981" : "#00F0FF"; return `<div class="bg-slate-950/80 border border-slate-800 rounded p-2"><div class="text-[10px] text-slate-400">${n}</div><div class="mono text-sm font-semibold" style="color:${c}">${v === undefined ? "–" : fm(v)}</div>${spark(a, c)}</div>`; }).join("");
}

/* ---------- Promotion funnel (spec section 3) ---------- */
function funnel(d) {
  const el = $("#funnel"), b = d.book; if (!el) return;
  const mid = b.mid, rest = Object.values(venues(b)).flatMap(v => [...v.bids, ...v.asks]).filter(l => Math.abs(l.price - mid) / mid <= .01).reduce((s, l) => s + l.price * l.size, 0);
  const pct = Sonar.base(d.sym)[2], rv = 1.2 + (hs(d.sym) % 60) / 10, dw = 600 - Math.floor(Date.now() / 1000) % 600;
  const checks = [["Move ≥ 5.0%", pct >= 5, f(pct, 2) + "%"], ["RVOL ≥ 2.0", rv >= 2, f(rv, 1) + "x"], ["Resting ≥ $15k within ±1%", rest >= 15000, "$" + cmp.format(rest)]], ok = checks.every(c => c[1]);
  el.innerHTML = [["Universe · $1M–$1B", 4812, 100], ["Tier 1 · L1", 412, 72], ["Tier 2 · L1 + book", 62, 44], ["Tier 3 · top-3 + depth", 3, 18]].map(([n, c, w]) => `<div class="mb-1.5"><div class="flex justify-between text-[10px] text-slate-400"><span>${n}</span><span class="mono text-slate-200">${c.toLocaleString()}</span></div><div class="h-1.5 rounded bg-slate-800"><div class="h-1.5 rounded bg-cyan-500/70" style="width:${w}%"></div></div></div>`).join("")
  + `<div class="mt-3 flex items-center justify-between"><span class="mono text-xs font-semibold text-slate-100">${d.sym}</span><span class="rounded px-2 py-0.5 text-[10px] font-mono border ${ok ? "text-cyan-400 border-cyan-800 bg-cyan-950/60" : "text-slate-300 border-slate-700 bg-slate-900"}">${ok ? "Tier 2 eligible" : "Tier 1 only"}</span></div>`
  + checks.map(([n, p, v]) => `<div class="mt-1 flex items-center justify-between text-[11px]"><span class="${p ? "text-emerald-400" : "text-rose-400"}">${p ? "✓" : "✕"} <span class="text-slate-300">${n}</span></span><span class="mono text-slate-200">${v}</span></div>`).join("")
  + `<div class="mt-3 flex justify-between text-[10px] text-slate-400"><span>Moomoo slots</span><span class="mono text-slate-200">62 / 100</span></div><div class="h-1.5 rounded bg-slate-800"><div class="h-1.5 rounded bg-indigo-400/70" style="width:62%"></div></div><div class="mt-2 flex justify-between text-[10px] text-slate-400"><span>Dwell lock</span><span class="mono text-slate-200">${dw} s of 600 s</span></div>`;
}

/* ---------- Liquidity heatmap with trade bubbles and barrier zone ---------- */
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
  const V = venues(b), L = {}; ["NSDQ", "ARCA"].forEach(k => L[k] = V[k] ? [...V[k].bids, ...V[k].asks] : []);
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
  const sel = H.v === "ALL" ? ["NSDQ", "ARCA"] : [H.v], dd = dec(mid), p = H.p || {p_down: .3, p_neutral: .4, p_up: .3};
  let mx = 1; H.cols.forEach(c => sel.forEach(k => c.L[k].forEach(l => { mx = Math.max(mx, l.size * tkp(l.price)); })));
  H.cols.forEach(c => sel.forEach(k => c.L[k].forEach(l => { const a = Math.sqrt(l.size * tkp(l.price) / mx); if (a < .05) return; x.fillStyle = `rgba(0,240,255,${(.06 + .8 * a).toFixed(2)})`; x.fillRect(X(c.n), Y(l.price) - ch / 2, cw + .5, ch); })));
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
  x.fillStyle = "#94A3B8"; x.fillText("−180s", 4, h - 4); x.fillText("now", hw - 22, h - 4); x.fillText("+180s", w - aw - 38, h - 4);
}

/* ---------- Wiring ---------- */
document.addEventListener("sonar:tick", e => {
  const d = e.detail; if (!d.book) return;
  const sym = $("#heat-sym"); if (sym) sym.textContent = `${d.sym} · ${d.tf}`;
  [setBar, ladder, barrier, features, funnel, ingest, heat].forEach(fn => { try { fn(d); } catch (err) { console.error("sonar-pro", fn.name, err); } });
});
document.querySelectorAll("#heat-venue button").forEach(b => b.onclick = () => { H.v = b.dataset.v; document.querySelectorAll("#heat-venue button").forEach(x => x.classList.toggle("on", x === b)); heat(); });
if ($("#heat")) new ResizeObserver(() => heat()).observe($("#heat"));
addEventListener("keydown", e => { // 1-4 = timeframes, / = symbol search
  if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  const i = "1234".indexOf(e.key); if (i >= 0) { const b = document.querySelectorAll("[data-tf]")[i]; if (b) b.click(); }
  if (e.key === "/") { e.preventDefault(); const q = $("#q"); if (q) q.focus(); }
});
})();