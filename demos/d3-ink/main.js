// d3-ink — "Ink & neon": d3-force + hand-drawn Canvas 2D (glow, arcs, hulls, staged entrance).
import { loadData, linkColor, mountHud, tooltipHtml, GOLD } from '../../shared/hud.js';

const data = await loadData('../../shared/data.json');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const sel = d3.select(canvas);
let W = 0, H = 0, DPR = 1, bg = null;

// ---------------------------------------------------------------- data
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const nodes = data.nodes.map(n => {
  let r = n.size * 1.25;                                // 3 + sqrt(degree)*2, shared semantics
  if (n.type === 'film') r += Math.sqrt(n.gross_musd || 0) * 0.3;
  if (n.type === 'person') r += (n.wins || 0) * 1.4;
  if (n.type === 'studio') r += 4;
  return { ...n, r, rgb: rgb(n.color), active: false, t0: 0 };
});
const byId = new Map(nodes.map(n => [n.id, n]));
const links = data.links.map(l => {
  const color = linkColor(l);
  return { ...l, source: byId.get(l.source), target: byId.get(l.target), color, rgb: rgb(color), gold: color === GOLD };
});
const studios = nodes.filter(n => n.type === 'studio');
const filmsOf = new Map(studios.map(s => [s.id, []]));
for (const l of links) if (l.relation === 'produced_by') filmsOf.get(l.target.id).push(l.source);
const isHub = n => n.type === 'studio' || n.type === 'award' || n.degree >= 13;

// ---------------------------------------------------------------- simulation
const DIST = { produced_by: 80, genre: 130, won: 170, nominated: 180, nominee: 170 };
const sim = d3.forceSimulation([])
  .force('link', d3.forceLink([]).distance(l => DIST[l.relation] || 85).strength(l => l.relation === 'genre' ? 0.3 : l.relation === 'produced_by' ? 1 : 0.45))
  .force('charge', d3.forceManyBody().strength(-260).distanceMax(600))
  .force('collide', d3.forceCollide(n => n.r + 6).iterations(2))
  .force('x', d3.forceX(0).strength(0.035)).force('y', d3.forceY(0).strength(0.045))
  .alphaDecay(0.018).velocityDecay(0.35).stop();

// Staged entrance: studios → films → people → genres/awards. The settle is the intro.
const ORDER = [['studio'], ['film'], ['person'], ['genre', 'award']];
let timers = [], userMoved = false;
function spawn(types) {
  const now = performance.now();
  nodes.filter(n => types.includes(n.type)).forEach((n, i, arr) => {
    const nb = [...(data.neighbors.get(n.id) || [])].map(id => byId.get(id)).filter(m => m.active);
    const anchor = nb[Math.floor(Math.random() * nb.length)];
    const a = n.type === 'studio' ? (i / arr.length) * Math.PI * 2 : Math.random() * Math.PI * 2;
    const d = n.type === 'studio' ? 230 : anchor ? 30 + Math.random() * 40 : 100;
    n.x = (anchor ? anchor.x : 0) + Math.cos(a) * d; n.y = (anchor ? anchor.y : 0) + Math.sin(a) * d;
    n.vx = n.vy = 0; n.active = true; n.t0 = now;
  });
  sim.nodes(nodes.filter(n => n.active));
  sim.force('link').links(links.filter(l => l.source.active && l.target.active));
  sim.alpha(0.9).restart();
}
function entrance() {
  timers.forEach(clearTimeout); timers = [];
  nodes.forEach(n => { n.active = false; n.fx = n.fy = null; });
  focus = null; hovered = null;
  ORDER.forEach((types, i) => timers.push(setTimeout(() => spawn(types), i * 450)));
  timers.push(setTimeout(() => { if (!userMoved && !focus) fitTo(nodes, 1200); }, ORDER.length * 450 + 1500));
}

// ---------------------------------------------------------------- camera, hover, drag, focus
let T = d3.zoomIdentity, hovered = null, focus = null, dragging = false;
const pick = (sx, sy) => { const [x, y] = T.invert([sx, sy]); const n = sim.find(x, y, 22 / T.k + 8); return n && Math.hypot(n.x - x, n.y - y) <= n.r + 8 / T.k ? n : null; };
const zoom = d3.zoom().scaleExtent([0.2, 6])
  .filter(e => (!e.ctrlKey || e.type === 'wheel') && !e.button && (e.type === 'wheel' || !pick(e.clientX, e.clientY)))
  .on('zoom', e => { T = e.transform; if (e.sourceEvent) userMoved = true; });
const drag = d3.drag().subject(e => pick(e.sourceEvent.clientX, e.sourceEvent.clientY))
  .on('start', e => { dragging = true; sim.alphaTarget(0.25).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
  .on('drag', e => { const [x, y] = T.invert([e.sourceEvent.clientX, e.sourceEvent.clientY]); e.subject.fx = x; e.subject.fy = y; })
  .on('end', e => { dragging = false; sim.alphaTarget(0); e.subject.fx = e.subject.fy = null; });
sel.call(drag).call(zoom).on('dblclick.zoom', null);

function fitTo(set, ms = 800) {
  const pts = set.filter(n => n.active && n.x != null); if (!pts.length) return;
  const x0 = d3.min(pts, n => n.x - n.r), x1 = d3.max(pts, n => n.x + n.r), y0 = d3.min(pts, n => n.y - n.r), y1 = d3.max(pts, n => n.y + n.r);
  const k = Math.max(0.2, Math.min(4, 0.92 * Math.min(W / Math.max(1, x1 - x0 + 160), H / Math.max(1, y1 - y0 + 160))));
  const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  sel.transition().duration(ms).ease(d3.easeCubicInOut).call(zoom.transform, t);
}
const hood = n => new Set([n.id, ...(data.neighbors.get(n.id) || [])]);
const fmt = v => (v == null ? null : Number.isInteger(v) ? String(v) : v.toFixed(1));
function tip(n) {
  const kv = { degree: n.degree };
  if (n.type === 'film') Object.assign(kv, { year: n.year, 'gross $M': fmt(n.gross_musd), roi: fmt(n.roi), wins: n.wins });
  if (n.type === 'person') Object.assign(kv, { born: n.born, films: n.film_count, wins: n.wins, nationality: n.nationality });
  if (n.type === 'studio') Object.assign(kv, { founded: n.founded, country: n.country, films: filmsOf.get(n.id).length });
  if (n.type === 'award') Object.assign(kv, { award: n.award, category: n.category });
  return tooltipHtml(n.label, kv);
}
canvas.addEventListener('mousemove', e => {
  if (dragging) return;
  hovered = pick(e.clientX, e.clientY);
  canvas.classList.toggle('grab', !!hovered);
  hovered ? hud.showTooltip(tip(hovered), e.clientX, e.clientY) : hud.hideTooltip();
});
canvas.addEventListener('mouseleave', () => { hovered = null; hud.hideTooltip(); });
canvas.addEventListener('click', e => {
  const n = pick(e.clientX, e.clientY);
  if (!n) { focus = null; return; }
  focus = n; fitTo([...hood(n)].map(id => byId.get(id)));
});
canvas.addEventListener('dblclick', e => {
  if (pick(e.clientX, e.clientY)) return;
  focus = null; userMoved = false;
  sel.transition().duration(800).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2));
});

// ---------------------------------------------------------------- HUD
const opts = { hulls: true, glow: true };
const hud = mountHud({
  title: 'Ink & Neon', library: 'd3-force · Canvas 2D', version: 'd3 7.9.0',
  toggles: [
    { id: 'hulls', label: 'studio hulls', on: true, onChange: on => (opts.hulls = on) },
    { id: 'glow', label: 'glow', on: true, onChange: on => (opts.glow = on) },
    { id: 'replay', label: 'replay entrance', on: false, onChange: () => { entrance(); setTimeout(() => hud.setToggle('replay', false), 250); } },
  ],
});

// ---------------------------------------------------------------- drawing
const SERIF = 'Fraunces, Georgia, "Times New Roman", serif';
const SANS = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const hullLine = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.6)).context(ctx);
const easeBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;   // cached ink wash + vignette
  const b = bg.getContext('2d'); b.scale(DPR, DPR); b.fillStyle = '#0a0a0f'; b.fillRect(0, 0, W, H);
  const v = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  v.addColorStop(0, 'rgba(34,28,58,0.55)'); v.addColorStop(0.5, 'rgba(10,10,15,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)');
  b.fillStyle = v; b.fillRect(0, 0, W, H);
}
addEventListener('resize', resize); resize();

function drawHulls() {
  for (const s of studios) {
    if (!s.active) continue;
    const pts = [];
    for (const n of [s, ...filmsOf.get(s.id)]) {
      if (!n.active) continue;
      const p = n.r + 16;
      pts.push([n.x - p, n.y], [n.x + p, n.y], [n.x, n.y - p], [n.x, n.y + p], [n.x - p * .7, n.y - p * .7], [n.x + p * .7, n.y + p * .7]);
    }
    const hull = d3.polygonHull(pts); if (!hull) continue;
    ctx.beginPath(); hullLine(hull);
    ctx.fillStyle = `rgba(${s.rgb},0.05)`; ctx.fill();
    ctx.lineWidth = 1 / T.k; ctx.strokeStyle = `rgba(${s.rgb},0.22)`; ctx.setLineDash([3 / T.k, 5 / T.k]); ctx.stroke(); ctx.setLineDash([]);
  }
}

function loop(now) { requestAnimationFrame(loop); draw(now); }
function draw(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(T.x, T.y); ctx.scale(T.k, T.k);

  const act = sim.nodes(), hl = hovered || focus, set = hl ? hood(hl) : null;
  if (opts.hulls) drawHulls();

  // Edges: quadratic arcs, additive so crossings brighten; gold award edges march.
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const l of sim.force('link').links()) {
    const s = l.source, t = l.target;
    const grow = Math.min(1, (now - Math.max(s.t0, t.t0)) / 700);
    const inSet = set && (hl.id === s.id || hl.id === t.id);
    let a = (l.gold ? 0.75 : l.relation === 'genre' || l.relation === 'produced_by' ? 0.16 : 0.3) * grow;
    if (set) a = inSet ? 0.95 * grow : 0.04 * grow;
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2, dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(40, len * 0.22) * ((s.index + t.index) % 2 ? 1 : -1);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(mx - dy / len * bow, my + dx / len * bow, t.x, t.y);
    ctx.strokeStyle = `rgba(${l.rgb},${a})`; ctx.lineWidth = (l.gold ? 1.6 : inSet ? 1.4 : 0.9) / Math.sqrt(T.k);
    if (l.gold) { ctx.setLineDash([5, 9]); ctx.lineDashOffset = -(now / 35) % 14; }
    ctx.stroke();
    if (l.gold) ctx.setLineDash([]);
  }

  // Nodes: cached radial-gradient sprites (glow halo + hard core) — additive, scale-in with overshoot when born.
  for (const n of act) {
    const t = Math.min(1, (now - n.t0) / 650), s = easeBack(t), r = n.r * s;
    const dim = set && !set.has(n.id) ? 0.16 : 1;
    if (r <= 0.1) continue;
    const sp = sprites[n.type];
    ctx.globalAlpha = dim * t;
    if (opts.glow && dim === 1) { const R = r * 3.4; ctx.drawImage(sp.glow, n.x - R, n.y - R, 2 * R, 2 * R); }
    ctx.drawImage(sp.core, n.x - r, n.y - r, 2 * r, 2 * r);
    ctx.globalAlpha = 1;
    if (hl && hl.id === n.id) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 5 / T.k, 0, Math.PI * 2); ctx.lineWidth = 1.5 / T.k; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke(); }
  }

  // Labels: serif display for hubs, sans for the neighbourhood; greedy collision avoidance by priority.
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
  const cands = [];
  for (const n of act) {
    const inSet = set && set.has(n.id), hub = isHub(n);
    if (!(hub || inSet) || (set && !inSet)) continue;
    cands.push({ n, pr: (hl && hl.id === n.id ? 100 : 0) + (n.type === 'studio' ? 50 : n.type === 'award' ? 40 : 0) + (inSet ? 20 : 0) + n.degree / 10 });
  }
  cands.sort((a, b) => b.pr - a.pr);
  const placed = [];
  for (const { n } of cands) {
    const t = Math.min(1, (now - n.t0) / 900), hub = isHub(n), big = n.type === 'studio' || n.type === 'award';
    const px = (big ? 15 : hub ? 13 : 11.5) / T.k, lh = px * 1.2;
    ctx.font = hub ? `${n.type === 'studio' ? 'italic 500' : '500'} ${px}px ${SERIF}` : `500 ${px}px ${SANS}`;
    const text = n.type === 'award' ? n.category : n.label, w = ctx.measureText(text).width;
    const box = { x0: n.x - w / 2 - 3 / T.k, x1: n.x + w / 2 + 3 / T.k, y0: n.y + n.r + 5 / T.k, y1: n.y + n.r + 7 / T.k + lh * (n.type === 'award' ? 2.1 : 1) };
    if (placed.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    placed.push(box);
    ctx.lineWidth = 3 / T.k; ctx.strokeStyle = `rgba(10,10,15,${0.85 * t})`;
    ctx.fillStyle = hub ? `rgba(${n.type === 'award' ? '240,224,255' : '247,242,232'},${0.92 * t})` : `rgba(232,234,242,${0.9 * t})`;
    ctx.strokeText(text, n.x, box.y0 + 2 / T.k); ctx.fillText(text, n.x, box.y0 + 2 / T.k);
    if (n.type === 'award') {
      ctx.font = `italic 400 ${9.5 / T.k}px ${SERIF}`; ctx.fillStyle = `rgba(${n.rgb},${0.85 * t})`;
      ctx.strokeText(n.award, n.x, box.y0 + 2 / T.k + lh); ctx.fillText(n.award, n.x, box.y0 + 2 / T.k + lh);
    }
  }
}

// Pre-rendered glow/core sprites per node type (drawImage is cheap; per-node shadowBlur is not).
function makeSprites() {
  const out = {};
  for (const [type, hex] of Object.entries(data.meta.type_colors)) {
    const c = rgb(hex), mk = stops => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(([o, col]) => gr.addColorStop(o, col));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return cv;
    };
    out[type] = {
      glow: mk([[0, `rgba(${c},0.55)`], [0.25, `rgba(${c},0.22)`], [0.6, `rgba(${c},0.05)`], [1, `rgba(${c},0)`]]),
      core: mk([[0, 'rgba(255,255,255,0.98)'], [0.35, `rgba(255,255,255,0.75)`], [0.62, `rgba(${c},0.95)`], [0.9, `rgba(${c},0.85)`], [1, `rgba(${c},0)`]]),
    };
  }
  return out;
}
const sprites = makeSprites();

// Wait for the display font (or 2.5 s) so labels never swap mid-entrance; degrade gracefully if fonts are blocked.
await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
sel.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2));
requestAnimationFrame(loop);
entrance();

// Test hook (used by the gallery smoke test).
window.__demo = {
  ready: true,
  nodePos(id = 'film:13') { const n = byId.get(id); return { x: T.applyX(n.x), y: T.applyY(n.y) }; },
  allPos: () => sim.nodes().map(n => ({ x: T.applyX(n.x), y: T.applyY(n.y), r: n.r * T.k })),
  state: () => ({ hovered: !!hovered, focused: !!focus, k: T.k }),
  bench(n = 20, o = {}) { Object.assign(opts, o); const t = performance.now(); for (let i = 0; i < n; i++) draw(performance.now()); return (performance.now() - t) / n; },
};
