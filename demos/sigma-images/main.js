// sigma-images — Sigma.js 3 + graphology + @sigma/node-image. Objects are composed to square card textures (2× canvas → data URL)
// and drawn by the image program in 'background' mode; the glyph view uses the pictogram ('color') mode with the generic icon.
import Graph from 'graphology';
import * as libNS from 'graphology-library';
import Sigma from 'sigma';
import { createNodeImageProgram } from '@sigma/node-image';
import { mountHud, tooltipHtml, buildNeighbors } from '../../shared/hud.js';

const lib = libNS.layout ? libNS : libNS.default;
const FA2Layout = lib.FA2Layout ?? (await import('graphology-layout-forceatlas2/worker')).default;
const container = document.getElementById('graph'), statusEl = document.getElementById('status');
if (!document.createElement('canvas').getContext('webgl')) { document.getElementById('fallback').classList.add('show'); throw new Error('sigma-images: WebGL unavailable'); }

const sys = await (await fetch('../../shared/system.json')).json();
const { type_colors: C, relation_styles: REL, teams: TEAMS } = sys.meta;
const asset = p => sys.meta.asset_root + p;
const byId = new Map(sys.nodes.map(n => [n.id, n]));
const BG = '#090b12', FONT = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', HEALTH = { healthy: '#8dff9e', degraded: '#ffb347', down: '#ff5f8f' };
const SIZE = { service: [120, 44], database: [96, 40], queue: [130, 32], repo: [110, 56], file: [44, 44], document: [54, 72], person: [48, 48], cloud: [96, 44] };
const ell = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const alpha = (c, a) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); const [r, g, b] = m ? [m[1], m[2], m[3]] : [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return `rgba(${r},${g},${b},${a * (m && m[4] != null ? +m[4] : 1)})`; };
const colorOf = n => (n.type === 'person' ? TEAMS[n.team]?.color || C.person : C[n.type]);

// ---- picture loading (SVGs without intrinsic size get one, so canvas drawImage works everywhere) ----------------------
const imgCache = new Map();
async function loadImg(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const p = (async () => { let src = url;
    if (url.endsWith('.svg')) { let t = await (await fetch(url)).text(); if (!/<svg[^>]*\swidth=/.test(t)) t = t.replace('<svg', '<svg width="128" height="128"'); src = URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' })); }
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image failed: ' + url)); i.src = src; }); })();
  imgCache.set(url, p); return p;
}
// ---- object cards: frame + picture(s) + badges, drawn at 2× on a square canvas → data URL ----------------------------
const S = 2, SCALE = 0.62, fit = (ctx, img, x, y, w, h) => { const r = Math.min(w / img.width, h / img.height), dw = img.width * r, dh = img.height * r; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
const cover = (ctx, img, x, y, w, h) => { const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); };
async function compose(n) {
  const [w, h] = SIZE[n.type], side = Math.max(w, h) + 8, c = document.createElement('canvas'); c.width = c.height = side * S;
  const ctx = c.getContext('2d'); ctx.scale(S, S); ctx.translate((side - w) / 2, (side - h) / 2);
  const col = colorOf(n), pic = n.thumb ? await loadImg(asset(n.thumb)) : n.avatar ? await loadImg(asset(n.avatar)) : null;
  const icon = n.icon ? await loadImg(asset(n.icon)) : null, logo = n.logo ? await loadImg(asset(n.logo)) : null;
  const frame = r => { ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.fillStyle = 'rgba(14,17,28,0.92)'; ctx.fill(); ctx.fillStyle = alpha(col, 0.16); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke(); };
  const well = (x, y, s) => { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(x, y, s, s, 6); ctx.fill(); };
  const badge = (t, x, y) => { ctx.fillStyle = '#1a1e2c'; ctx.strokeStyle = alpha(C.file, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, 30, 14, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8eaf2'; ctx.font = '600 9px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText(t, x + 15, y + 10.5); };
  switch (n.type) {
    case 'service': frame(8); well(8, 8, 28); fit(ctx, icon, 11, 11, 22, 22); well(84, 8, 28); fit(ctx, logo, 86, 10, 24, 24);
      ctx.beginPath(); ctx.arc(w - 6, 6, 5, 0, 7); ctx.fillStyle = HEALTH[n.health] || '#888'; ctx.fill(); ctx.strokeStyle = BG; ctx.lineWidth = 1.5; ctx.stroke(); break;
    case 'database': frame(20); ctx.beginPath(); ctx.moveTo(14, 12); ctx.lineTo(w - 14, 12); ctx.strokeStyle = alpha(col, 0.45); ctx.lineWidth = 1; ctx.stroke(); fit(ctx, icon, 14, 11, 18, 18); fit(ctx, logo, w - 40, 8, 24, 24); break;
    case 'queue': frame(16); fit(ctx, icon, 12, 7, 18, 18); fit(ctx, logo, w - 34, 5, 22, 22); break;
    case 'cloud': frame(22); fit(ctx, icon, 14, 11, 22, 22); fit(ctx, logo, w - 46, 7, 30, 30); break;
    case 'repo': ctx.beginPath(); ctx.roundRect(0, 0, 40, 12, [6, 6, 0, 0]); ctx.fillStyle = alpha(col, 0.35); ctx.fill(); ctx.translate(0, 8); frame(6); ctx.translate(0, -8);
      fit(ctx, icon, 10, 18, 26, 26); fit(ctx, logo, w - 34, 20, 22, 22); ctx.fillStyle = '#e8eaf2'; ctx.font = '600 9px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillText(`★ ${n.stars}`, w - 8, h - 5); break;
    case 'file': frame(10); fit(ctx, icon, 11, 5, 22, 22); badge('.' + n.ext, w - 32, h - 16); break;
    case 'document': ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, w, h, 3); ctx.clip(); ctx.fillStyle = '#161a26'; ctx.fillRect(0, 0, w, h); cover(ctx, pic, 0, 0, w, h); ctx.restore();
      ctx.beginPath(); ctx.moveTo(w - 12, 0); ctx.lineTo(w, 12); ctx.lineTo(w - 12, 12); ctx.closePath(); ctx.fillStyle = alpha(col, 0.9); ctx.fill(); ctx.beginPath(); ctx.roundRect(0, 0, w, h, 3); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke(); break;
    case 'person': ctx.save(); ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, 7); ctx.clip(); cover(ctx, pic, 0, 0, w, h); ctx.restore(); ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 1, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); break;
  }
  return { image: c.toDataURL('image/png'), size: side / 2 * SCALE, hr: h / side, wr: w / side, w, h };
}

// ---- graph model --------------------------------------------------------------------------------------------------------
const HUB = n => n.degree >= 6 || n.type === 'document' || n.type === 'service' || n.type === 'repo';
const graph = new Graph({ multi: true, type: 'directed' });
const cards = await Promise.all(sys.nodes.map(compose));
sys.nodes.forEach((n, i) => graph.addNode(n.id, { ...n, kind: n.type, type: 'card', ...cards[i], color: 'rgba(0,0,0,0)', glyph: asset(n.icon), typeColor: colorOf(n),
  label: ell(n.label), sub: n.sublabel ? ell(n.sublabel, 24) : null, forceLabel: HUB(n), zIndex: n.type === 'document' ? 3 : n.type === 'file' ? 0 : 2 }));
for (const l of sys.links) { const r = REL[l.relation]; graph.addEdge(l.source, l.target, { ...l, type: r.arrow ? 'arrow' : 'line', color: alpha(r.color, r.dash ? 0.45 : 0.75), size: r.dash ? r.width * 0.7 : r.width, weight: l.relation === 'contains' ? 4 : 1 }); }
const neighbors = buildNeighbors(sys.links);
lib.layout.circular.assign(graph, { scale: 300 });

// ---- renderer -----------------------------------------------------------------------------------------------------------
let renderer = null, hovered = null, focused = null, pictures = true, allLabels = false, teamHulls = false, filesIn = false, removedFiles = null;
function drawLabel(ctx, d, settings) {
  if (!d.label) return; const k = renderer?.getCamera().ratio ?? 1, y0 = d.y + d.size * (d.hr ?? 1) + 3;
  ctx.font = `600 ${settings.labelSize}px ${settings.labelFont}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(9,11,18,0.85)'; ctx.strokeText(d.label, d.x, y0); ctx.fillStyle = '#e8eaf2'; ctx.fillText(d.label, d.x, y0);
  if (d.sub && (k < 0.8 || allLabels)) { ctx.font = `500 ${settings.labelSize - 2}px ${settings.labelFont}`; ctx.strokeText(d.sub, d.x, y0 + settings.labelSize + 2); ctx.fillStyle = 'rgba(232,234,242,0.6)'; ctx.fillText(d.sub, d.x, y0 + settings.labelSize + 2); }
}
function drawHover(ctx, d, settings) {                                          // glow behind the enlarged object + its label
  ctx.save(); ctx.shadowColor = d.typeColor || '#fff'; ctx.shadowBlur = 22; ctx.fillStyle = alpha(d.typeColor || '#ffffff', 0.18);
  ctx.beginPath(); ctx.roundRect(d.x - d.size, d.y - d.size * (d.hr ?? 1), d.size * 2, d.size * 2 * (d.hr ?? 1), 10); ctx.fill(); ctx.restore(); drawLabel(ctx, d, settings);
}
const card = createNodeImageProgram({ drawingMode: 'background', keepWithinCircle: false, padding: 0, objectFit: 'contain', size: { mode: 'force', value: 256 }, correctCentering: false, drawLabel, drawHover });
const glyph = createNodeImageProgram({ drawingMode: 'color', keepWithinCircle: false, padding: 0.12, objectFit: 'contain', size: { mode: 'force', value: 96 }, drawLabel, drawHover });
const sigma = new Sigma(graph, container, {
  defaultNodeType: 'card', defaultEdgeType: 'line', nodeProgramClasses: { card, glyph }, zIndex: true, renderEdgeLabels: false,
  labelFont: FONT, labelSize: 11, labelWeight: '600', labelColor: { color: '#e8eaf2' }, labelRenderedSizeThreshold: 0, labelDensity: 4, labelGridCellSize: 50,
  defaultDrawNodeLabel: drawLabel, defaultDrawNodeHover: drawHover, stagePadding: 40, minCameraRatio: 0.06, maxCameraRatio: 2.5, zoomToSizeRatioFunction: r => r,
  nodeReducer: (n, a) => {
    const res = { ...a, type: pictures ? 'card' : 'glyph', color: pictures ? 'rgba(0,0,0,0)' : a.typeColor, size: pictures ? a.size : Math.min(a.size, 18), hr: pictures ? a.hr : 1, wr: pictures ? a.wr : 1, forceLabel: a.forceLabel || allLabels };
    if (!pictures) res.image = a.glyph;
    const active = hovered ?? focused;
    if (n === hovered) { res.size *= 1.35; res.zIndex = 10; res.highlighted = true; }
    else if (active != null && !neighbors.get(active)?.has(n)) { res.type = 'glyph'; res.image = a.glyph; res.color = 'rgba(232,234,242,0.14)'; res.size = Math.min(a.size, 16); res.hr = 1; res.wr = 1; res.label = null; res.forceLabel = false; res.zIndex = -1; }
    else if (active != null) res.forceLabel = true;
    return res;
  },
  edgeReducer: (e, a) => {
    const active = hovered ?? focused; if (active == null) return a;
    if (!graph.hasExtremity(e, active)) return { ...a, color: 'rgba(255,255,255,0.03)', zIndex: -1 };
    return { ...a, color: alpha(REL[a.relation].color, 1), size: a.size + 0.8, zIndex: 5 };
  },
});
renderer = sigma;
const refresh = () => sigma.refresh({ skipIndexation: true });

// ---- hulls: repos (files) and teams (people + services + repos) on a custom canvas below the edges ----------------------
const hullCanvas = sigma.createCanvas('hulls', { beforeLayer: 'edges' }), hctx = hullCanvas.getContext('2d');
function hull(pts) { pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y); if (pts.length < 3) return pts; const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = []; for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); } return lower.slice(0, -1).concat(upper.slice(0, -1)); }
function drawHulls() {
  const dpr = devicePixelRatio || 1, W = container.clientWidth, H = container.clientHeight;
  if (hullCanvas.width !== W * dpr) { hullCanvas.width = W * dpr; hullCanvas.height = H * dpr; hullCanvas.style.width = W + 'px'; hullCanvas.style.height = H + 'px'; }
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.clearRect(0, 0, W, H);
  for (const g of sys.groups) {
    if (g.kind === 'team' && !teamHulls) continue;
    const members = (g.kind === 'repo' ? [g.parent, ...g.members] : g.members).filter(id => graph.hasNode(id));
    if (members.length < 2) continue;
    const pts = members.flatMap(id => { const d = sigma.getNodeDisplayData(id), p = sigma.framedGraphToViewport(d), r = sigma.scaleSize(d.size) * Math.max(d.wr ?? 1, d.hr ?? 1) + 10; return [{ x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y - r }, { x: p.x + r, y: p.y + r }, { x: p.x - r, y: p.y + r }]; });
    const poly = hull(pts), pad = g.kind === 'team' ? 26 : 14;
    hctx.beginPath(); poly.forEach((p, i) => (i ? hctx.lineTo(p.x, p.y) : hctx.moveTo(p.x, p.y))); hctx.closePath();
    hctx.lineJoin = 'round'; hctx.lineWidth = pad * 2; hctx.strokeStyle = alpha(g.color, g.kind === 'team' ? 0.045 : 0.1); hctx.stroke(); hctx.fillStyle = alpha(g.color, g.kind === 'team' ? 0.045 : 0.1); hctx.fill();
    hctx.lineWidth = 1; hctx.strokeStyle = alpha(g.color, 0.35); hctx.stroke();
    const top = poly.reduce((a, p) => (p.y < a.y || (p.y === a.y && p.x < a.x) ? p : a), poly[0]);
    hctx.font = `600 10px ${FONT}`; hctx.textAlign = 'left'; hctx.fillStyle = alpha(g.color, 0.9); hctx.fillText(g.label.toUpperCase(), top.x - pad + 6, top.y - pad + 12);
  }
}
sigma.on('afterRender', drawHulls);

// ---- layout: ForceAtlas2 in a worker, settle, then a short overlap-removal pass --------------------------------------------
const fa2 = new FA2Layout(graph, { settings: { ...lib.layoutForceAtlas2.inferSettings(graph), scalingRatio: 24, gravity: 0.6, strongGravityMode: true, barnesHutOptimize: false, slowDown: 5, edgeWeightInfluence: 1, adjustSizes: false } });
function separate(iter = 40) {                                                   // push overlapping object boxes apart (viewport space)
  const ids = graph.nodes(), box = id => { const a = graph.getNodeAttributes(id), p = sigma.graphToViewport(a), s = sigma.scaleSize(a.size); return { id, x: p.x, y: p.y, hw: s * a.wr + 6, hh: s * a.hr + 13 }; };
  for (let it = 0; it < iter; it++) { const bs = ids.map(box); let moved = false;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j], dx = b.x - a.x, dy = b.y - a.y, ox = a.hw + b.hw - Math.abs(dx), oy = a.hh + b.hh - Math.abs(dy);
      if (ox > 0 && oy > 0) { moved = true; if (ox < oy) { const s = Math.sign(dx || 1) * ox / 2; a.x -= s; b.x += s; } else { const s = Math.sign(dy || 1) * oy / 2; a.y -= s; b.y += s; } } }
    for (const b of bs) { const g = sigma.viewportToGraph(b); graph.mergeNodeAttributes(b.id, { x: g.x, y: g.y }); } if (!moved) break; }
}
let stopTimer;
function runLayout(ms = 3000) {
  clearTimeout(stopTimer); statusEl.textContent = 'ForceAtlas2 settling'; fa2.start();
  stopTimer = setTimeout(() => { fa2.stop(); separate(); sigma.refresh(); separate(); sigma.getCamera().animatedReset({ duration: 600 }); statusEl.textContent = 'layout settled · drag to pan · click an object to focus'; }, ms);
}

// ---- HUD, object legend ---------------------------------------------------------------------------------------------------
function setFilesIn(on) {                                                        // collapse the 30 files into their repo folders
  filesIn = on;
  if (on) { removedFiles = graph.filterNodes((n, a) => a.kind === 'file').map(n => ({ n, a: graph.getNodeAttributes(n), e: graph.edges(n).map(e => ({ s: graph.source(e), t: graph.target(e), a: graph.getEdgeAttributes(e) })) })); removedFiles.forEach(f => graph.dropNode(f.n)); }
  else removedFiles?.forEach(f => { graph.addNode(f.n, f.a); f.e.forEach(e => graph.addEdge(e.s, e.t, e.a)); });
  graph.forEachNode((n, a) => { if (a.kind === 'repo') graph.setNodeAttribute(n, 'sub', on ? `▣ ${a.files} files · ★ ${a.stars}` : ell(a.sublabel, 24)); });
  runLayout(2200);
}
const hud = mountHud({ title: 'Object Images', library: 'Sigma.js + @sigma/node-image', version: '3.0.3 · 3.0.0', legend: false, toggles: [
  { id: 'pictures', label: 'pictures', on: true, onChange: on => { pictures = on; refresh(); } },
  { id: 'files', label: 'files inside repos', on: false, onChange: setFilesIn },
  { id: 'labels', label: 'all labels', on: false, onChange: on => { allLabels = on; refresh(); } },
  { id: 'teams', label: 'team hulls', on: false, onChange: on => { teamHulls = on; refresh(); } },
] });
const SAMPLE = { service: 'svc:api-gateway', database: 'db:postgres-main', queue: 'q:kafka-events', repo: 'repo:platform-api', file: 'file:platform-api/src/gateway/router.ts', document: 'doc:api-spec', person: 'person:ada-okafor', cloud: 'cloud:aws-ec2' };
const RADIUS = { service: 8, database: 20, queue: 14, repo: 6, file: 7, document: 2, person: 50, cloud: 14 };
const legend = document.createElement('div'); legend.className = 'hud hud--bl legend';
legend.innerHTML = Object.entries(SAMPLE).map(([t, id]) => { const n = byId.get(id), [w, h] = SIZE[t], fill = t === 'document' || t === 'person', pic = fill ? (n.thumb || n.avatar) : (n.logo || n.icon);
  return `<div class="legend-row"><span class="lg-frame${fill ? ' fill' : ''}" style="--c:${C[t]};width:${w * .5}px;height:${h * .5}px;border-radius:${RADIUS[t]}${t === 'person' ? '%' : 'px'}"><img src="${asset(pic)}" alt=""></span>${t}</div>`; }).join('')
  + '<div class="lg-title">relations</div>' + Object.entries(REL).map(([k, r]) => `<div class="lg-rel"><svg viewBox="0 0 34 8"><line x1="0" y1="4" x2="${r.arrow ? 28 : 34}" y2="4" stroke="${r.color}" stroke-width="${r.width + 0.6}" ${r.dash ? `stroke-dasharray="${r.dash.join(' ')}"` : ''}/>${r.arrow ? `<path d="M27 0.5 L34 4 L27 7.5 Z" fill="${r.color}"/>` : ''}</svg>${r.label}</div>`).join('');
hud.root.appendChild(legend);

// ---- hover card, focus ----------------------------------------------------------------------------------------------------
const name = id => byId.get(id)?.label || id;
const CARD = { service: d => ({ lang: d.lang, health: d.health, owner: name(d.owner), repo: name(d.repo), rps: d.rps?.toLocaleString(), 'deploys to': sys.links.filter(l => l.source === d.id && l.relation === 'deploys_to').map(l => name(l.target)).join(', ') }),
  database: d => ({ engine: d.engine, size: d.size_gb + ' GB' }), queue: d => ({ engine: d.engine }), repo: d => ({ language: d.language, stars: d.stars, files: d.files, team: TEAMS[d.team]?.label }),
  file: d => ({ path: d.sublabel, ext: '.' + d.ext, loc: d.loc, repo: name(d.repo) }), document: d => ({ format: d.format, pages: d.pages, kind: d.kind, updated: d.updated, author: name(d.author) }),
  person: d => ({ role: d.role, team: TEAMS[d.team]?.label }), cloud: d => ({ provider: d.provider }) };
const tipFor = id => { const d = byId.get(id), pic = d.thumb || d.avatar || d.logo || d.icon; return `<img src="${asset(pic)}" alt=""><div class="tt-type">${d.type}</div>` + tooltipHtml(d.label, { ...CARD[d.type](d), degree: d.degree }); };
sigma.on('enterNode', ({ node, event }) => { hovered = node; hud.showTooltip(tipFor(node), event.original.clientX, event.original.clientY); refresh(); });
sigma.on('leaveNode', () => { hovered = null; hud.hideTooltip(); refresh(); });
sigma.on('clickNode', ({ node }) => {                                            // frame the object + its neighbours
  focused = node; const ids = [node, ...(neighbors.get(node) || [])].filter(id => graph.hasNode(id)), ds = ids.map(id => sigma.getNodeDisplayData(id));
  const xs = ds.map(d => d.x), ys = ds.map(d => d.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cam = sigma.getCamera(), { width: W, height: H } = sigma.getDimensions(), a = sigma.framedGraphToViewport({ x: Math.min(...xs), y: Math.min(...ys) }), b = sigma.framedGraphToViewport({ x: Math.max(...xs), y: Math.max(...ys) });
  const ratio = Math.max(0.12, cam.ratio * Math.max((Math.abs(b.x - a.x) + 260) / W, (Math.abs(b.y - a.y) + 220) / H));
  cam.animate({ x: cx, y: cy, ratio: Math.min(ratio, cam.ratio) }, { duration: 700 }); refresh();
});
sigma.on('doubleClickStage', ({ event }) => { event.preventSigmaDefault(); focused = null; sigma.getCamera().animatedReset({ duration: 700 }); refresh(); });
sigma.on('clickStage', () => { if (focused) { focused = null; refresh(); } });

// ---- boot -------------------------------------------------------------------------------------------------------------------
window.__demo = { sigma, graph, hud, ready: true, runLayout,
  nodePos(id = 'svc:api-gateway') { return sigma.framedGraphToViewport(sigma.getNodeDisplayData(id)); },
  allPos: () => graph.mapNodes(n => { const d = sigma.getNodeDisplayData(n), p = sigma.framedGraphToViewport(d); return { x: p.x, y: p.y, r: sigma.scaleSize(d.size) }; }),
  state: () => ({ hovered: !!hovered, focused: !!focused, k: sigma.getCamera().ratio, nodes: graph.order, pictures, allLabels, teamHulls, filesIn, labelsShown: sigma.getNodeDisplayedLabels().size }) };
await (document.fonts?.ready ?? Promise.resolve());
container.classList.add('in');
runLayout(3000);
