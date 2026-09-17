// echarts-image-symbols — graph series where every node is an 'image://' card composed from the shared assets.
import { mountHud, tooltipHtml, buildNeighbors } from '../../shared/hud.js';

const sys = await (await fetch('../../shared/system.json')).json();
const M = sys.meta, asset = p => M.asset_root + p, byId = new Map(sys.nodes.map(n => [n.id, n])), nb = buildNeighbors(sys.links);
const SIZE = { service: [120, 44], database: [96, 40], queue: [130, 32], repo: [110, 56], file: [44, 44], document: [54, 72], person: [48, 48], cloud: [96, 44] };
const HEALTH = { healthy: '#8dff9e', degraded: '#ffb347', down: '#ff5f8f' }, FONT = getComputedStyle(document.body).fontFamily || 'sans-serif', R = 2;
const TEAMS = Object.keys(M.teams), ti = d => Math.max(0, TEAMS.indexOf(d.team)), TYPES = Object.keys(M.type_colors);
const color = d => (d.type === 'person' ? M.teams[d.team]?.color || M.type_colors.person : M.type_colors[d.type]);
const pictureFor = d => d.thumb || d.avatar || d.logo || d.icon, tech = d => d.lang || d.engine || d.language || d.provider || '';
const trunc = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s), esc = s => s.replace(/[{}]/g, '');
const mix = (hex, a) => { const [r, g, b] = hex.match(/\w\w/g).map(v => parseInt(v, 16)); return `rgb(${(r * a + 11 * (1 - a)) | 0},${(g * a + 13 * (1 - a)) | 0},${(b * a + 22 * (1 - a)) | 0})`; };
const state = { files: false, pictures: true, circular: false, labels: true };

// ---- Load every picture once, then compose one card per node (cached per node × variant) -----------------------------
const urls = new Set(); sys.nodes.forEach(n => [n.icon, n.logo, n.thumb, n.avatar].filter(Boolean).forEach(p => urls.add(asset(p))));
const IMG = new Map(await Promise.all([...urls].map(u => new Promise(res => { const im = new Image(); im.onload = () => res([u, im]); im.onerror = () => res([u, null]); im.src = u; }))));
const cache = new Map();
function card(d, pics = state.pictures, collapsed = !state.files) {
  const key = `${d.id}|${pics}|${collapsed}`; if (cache.has(key)) return cache.get(key);
  const [w, h] = SIZE[d.type], f = M.type_frames[d.type], c = color(d), cv = document.createElement('canvas'); cv.width = w * R; cv.height = (h + 8) * R;
  const x = cv.getContext('2d'); x.scale(R, R); x.translate(w / 2, h / 2 + 8); x.lineWidth = 1.5;
  const rr = (X, Y, W, H, r, fill = mix(c, .16), stroke = c) => { x.beginPath(); x.roundRect(X, Y, W, H, r); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.stroke(); } };
  const img = (p, X, Y, s, well = true) => { const im = IMG.get(asset(p)); if (well) rr(X - 3, Y - 3, s + 6, s + 6, 5, 'rgba(255,255,255,.07)', null); if (im) x.drawImage(im, X, Y, s, s); };
  const txt = (t, X, Y, size, col = 'rgba(232,234,242,.6)', align = 'center', font = '') => { x.font = `${font} ${size}px ${FONT}`; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, X, Y); };
  const wide = (rx, s, both, tx) => { rr(-w / 2, -h / 2, w, h, rx); img(both || !pics ? d.icon : d.logo || d.icon, -w / 2 + 8, -s / 2, s); if (both && d.logo && pics) img(d.logo, w / 2 - 8 - s, -s / 2, s); txt(trunc(tech(d), 12), tx, 0, 9.5); };
  if (f === 'tile') { rr(-22, -22, 44, 44, 10); img(d.icon, -14, -16, 26); txt('.' + d.ext, 20, 15, 9, c, 'right', '600'); }
  else if (f === 'page') { rr(-27, -36, 54, 72, 3); const im = IMG.get(asset(d.thumb));
    if (pics && im) { const k = Math.max(50 / im.width, 68 / im.height); x.drawImage(im, (im.width - 50 / k) / 2, 0, 50 / k, 68 / k, -25, -34, 50, 68); } else img(d.icon, -15, -15, 30, false);
    x.beginPath(); x.moveTo(13, -36); x.lineTo(27, -22); x.lineTo(13, -22); x.closePath(); x.fillStyle = c; x.fill(); x.strokeStyle = '#07080f'; x.stroke(); }
  else if (f === 'circle') { x.beginPath(); x.arc(0, 0, 23, 0, 7); x.fillStyle = mix(c, .16); x.fill(); x.strokeStyle = c; x.lineWidth = 2; x.stroke();
    x.save(); x.beginPath(); x.arc(0, 0, 20, 0, 7); x.clip(); const im = IMG.get(asset(pics ? d.avatar : d.icon)); if (im) x.drawImage(im, -20, -20, 40, 40); x.restore(); }
  else if (f === 'rack') { wide(8, 28, true, 0); x.beginPath(); x.arc(w / 2 - 6, -h / 2 + 6, 3.5, 0, 7); x.fillStyle = HEALTH[d.health]; x.fill(); x.strokeStyle = '#07080f'; x.stroke(); }
  else if (f === 'cylinder') { wide(20, 24, false, 12); x.beginPath(); x.ellipse(0, -h / 2 + 1, w / 2 - 1, 5, 0, 0, 7); x.strokeStyle = c; x.globalAlpha = .6; x.stroke(); x.globalAlpha = 1; }
  else if (f === 'pipe') wide(16, 18, false, 8);
  else if (f === 'folder') { rr(-w / 2, -h / 2 - 7, 40, 12, 3); rr(-w / 2, -h / 2, w, h, 6); img(pics ? d.logo : d.icon, -47, -15, 30); txt(trunc(d.language, 12), 10, -1, 9.5); txt('★ ' + d.stars, 10, 13, 9.5);
    if (collapsed) { rr(w / 2 - 34, -h / 2 - 8, 40, 14, 7, c, null); txt(d.files + ' files', w / 2 - 14, -h / 2 - 1, 9, '#07080f', 'center', '700'); } }
  else if (f === 'cloud') wide(22, 28, false, 14);
  const url = cv.toDataURL(); cache.set(key, url); return url;
}
const swatch = type => { const d = sys.nodes.find(n => n.type === type), [w, h] = SIZE[type], cv = document.createElement('canvas'); cv.width = cv.height = 48 * R; const x = cv.getContext('2d'), im = new Image(); im.src = card(d, true, false);
  const k = Math.min(46 / w, 30 / (h + 8)); x.drawImage(im, (48 - w * k) / 2 * R, (48 - (h + 8) * k) / 2 * R, w * k * R, (h + 8) * k * R); return cv.toDataURL(); };

// ---- Series data ------------------------------------------------------------------------------------------------------
const nid = v => (typeof v === 'object' ? v.id : v), order = { cloud: 0, service: 1, database: 2, queue: 3, repo: 4, file: 5, person: 6, document: 7 };
const bandXY = d => ({ cloud: [0, -300], service: [(ti(d) - 1.5) * 170, -100], database: [0, 110], queue: [0, 110], repo: [380, 0], file: [470, 0], person: [-390, -175 + ti(d) * 75], document: [-560, 40] }[d.type]);
let nodes = [], links = [];
function seriesData() {
  nodes = sys.nodes.filter(n => state.files || n.type !== 'file').sort((a, b) => order[a.type] - order[b.type] || ti(a) - ti(b));
  const ids = new Set(nodes.map(n => n.id));
  links = sys.links.filter(l => ids.has(nid(l.source)) && ids.has(nid(l.target)));
  return {
    data: nodes.map(d => { const [w, h] = SIZE[d.type], [bx, by] = bandXY(d); return { id: d.id, name: d.id, category: TYPES.indexOf(d.type), symbol: 'image://' + card(d), symbolSize: [w, h + 8],
      x: bx + (Math.random() - .5) * 80, y: by + (Math.random() - .5) * 80, label: { formatter: `{n|${esc(trunc(d.label))}}` + (d.sublabel && /service|repo|document/.test(d.type) ? `\n{s|${esc(trunc(d.sublabel, 22))}}` : '') } }; }),
    links: links.map(l => { const s = M.relation_styles[l.relation]; return { source: nid(l.source), target: nid(l.target), relation: l.relation, symbol: ['none', s.arrow ? 'arrow' : 'none'], symbolSize: [0, 7],
      lineStyle: { color: s.color, width: s.width, type: s.dash || 'solid', curveness: 0.15 } }; }),
  };
}
const option = () => ({ animationDurationUpdate: 600, legend: { data: TYPES.map(t => ({ name: t, icon: 'image://' + swatch(t) })), bottom: 14, left: 'center', itemWidth: 26, itemHeight: 26, itemGap: 14,
    textStyle: { color: '#e8eaf2', fontSize: 12 }, backgroundColor: 'rgba(10,12,20,.72)', borderColor: 'rgba(255,255,255,.08)', borderRadius: 10, padding: [6, 12] },
  tooltip: { show: false },
  series: [{ type: 'graph', layout: state.circular ? 'circular' : 'force', roam: true, draggable: true, zoom: 1, scaleLimit: { min: 0.3, max: 5 }, ...seriesData(),
    categories: TYPES.map(t => ({ name: t, itemStyle: { color: M.type_colors[t] } })), circular: { rotateLabel: false },
    force: { repulsion: [520, 1500], edgeLength: [70, 170], gravity: 0.06, layoutAnimation: true, friction: 0.6 },
    label: { show: state.labels, position: 'bottom', distance: 2, rich: { n: { fontSize: 12, fontWeight: 500, color: '#e8eaf2', textBorderColor: '#07080f', textBorderWidth: 2, lineHeight: 14 },
      s: { fontSize: 10.5, color: 'rgba(232,234,242,.6)', textBorderColor: '#07080f', textBorderWidth: 2, lineHeight: 13 } } },
    edgeLabel: { show: false, formatter: p => M.relation_styles[p.data.relation].label, fontSize: 9, color: 'rgba(232,234,242,.7)', textBorderColor: '#07080f', textBorderWidth: 2 },
    emphasis: { focus: 'adjacency', scale: 1.35, edgeLabel: { show: true }, lineStyle: { width: 2.4, shadowBlur: 6, shadowColor: 'rgba(255,255,255,.4)' } },
    blur: { itemStyle: { opacity: 0.18 }, label: { opacity: 0.25 }, lineStyle: { opacity: 0.1 } } }] });

const chart = echarts.init(document.getElementById('chart'), null, { renderer: 'canvas' });
chart.setOption(option());
let fitOnce = true; chart.on('finished', () => { if (fitOnce && nodes.length) { fitOnce = false; roamTo(nodes, 40, 1.4); } });   // first time the force settles: fit the map
addEventListener('resize', () => chart.resize());

// ---- Positions (internal layout API), hulls overlay, hover card, focus ----------------------------------------------------
const sm = () => chart.getModel().getSeriesByIndex(0), rect = () => chart.getDom().getBoundingClientRect(), zoomOf = () => { const cs = sm().coordinateSystem; return cs.getZoom ? cs.getZoom() : cs.getRoamTransform()[0]; };
const pos = id => { const s = sm(), data = s.getData(), i = nodes.findIndex(n => n.id === id), lay = i >= 0 && data.getItemLayout(i); if (!lay) return null; const [x, y] = s.coordinateSystem.dataToPoint(lay); return { x, y }; };
const hulls = document.getElementById('hulls'), hullLine = pts => { const p = pts.map(q => q.join(',')); return 'M' + p.join('L') + 'Z'; };
function convexHull(pts) { pts = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); } for (const p of pts.reverse()) { while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
let hullReq = 0;
function drawHulls() { hullReq = 0; if (!state.files || state.circular) { hulls.innerHTML = ''; return; } const z = zoomOf(), out = [];
  for (const g of sys.groups.filter(g => g.kind === 'repo')) { const pts = [];
    for (const id of [...g.members, g.parent]) { const p = pos(id), n = byId.get(id); if (!p) continue; const [w, h] = SIZE[n.type], px = (w / 2 + 14) * z, py = (h / 2 + 26) * z; pts.push([p.x - px, p.y - py], [p.x + px, p.y - py], [p.x + px, p.y + py], [p.x - px, p.y + py]); }
    if (pts.length < 6) continue; const hull = convexHull(pts), x0 = Math.min(...hull.map(p => p[0])), y0 = Math.min(...hull.map(p => p[1]));
    out.push(`<path class="hull" d="${hullLine(hull)}" fill="${g.color}" stroke="${g.color}"/><text class="hull-label" x="${x0 + 10}" y="${y0 + 14}" fill="${g.color}">${g.label}</text>`); }
  hulls.innerHTML = out.join(''); }
chart.on('rendered', () => { if (!hullReq) hullReq = requestAnimationFrame(drawHulls); });

function attrs(d) { const lab = id => byId.get(id)?.label, out = links.filter(l => nid(l.source) === d.id).reduce((m, l) => ((m[l.relation] ??= []).push(byId.get(nid(l.target)).label), m), {});
  return { service: { lang: d.lang, health: d.health, owner: lab(d.owner), repo: lab(d.repo), rps: d.rps, 'deploys to': out.deploys_to?.join(', ') }, database: { engine: d.engine, size: d.size_gb + ' GB' }, queue: { engine: d.engine },
    repo: { language: d.language, stars: d.stars, files: d.files }, file: { path: d.sublabel, ext: d.ext, loc: d.loc, repo: lab(d.repo) }, document: { format: d.format, pages: d.pages, kind: d.kind, updated: d.updated, author: lab(d.author) },
    person: { role: d.role, team: M.teams[d.team]?.label }, cloud: { provider: d.provider } }[d.type]; }
const cardHtml = d => `<img class="${d.type === 'document' ? 'page' : ''}" src="${asset(state.pictures ? pictureFor(d) : d.icon)}"><div><div class="tt-type">${d.type}</div>${tooltipHtml(d.label, attrs(d))}</div>`;
let hoverNode = null, focusNode = null;
chart.on('mouseover', p => { if (p.dataType !== 'node') return; hoverNode = byId.get(p.data.id); hud.root.querySelector('.tooltip').classList.add('card'); const r = rect(); hud.showTooltip(cardHtml(hoverNode), p.event.offsetX + r.left, p.event.offsetY + r.top); });
chart.on('mouseout', p => { if (p.dataType === 'node') { hoverNode = null; hud.hideTooltip(); } });
function roamTo(list, pad = 60, maxK = 2.2, minK = 0.3) {   // zoom/pan so the given nodes fill the view (screen-space bbox → graphRoam)
  const z = zoomOf(), pts = list.map(n => ({ n, p: pos(n.id) })).filter(o => o.p);
  const x0 = Math.min(...pts.map(o => o.p.x - (SIZE[o.n.type][0] / 2) * z)) - pad, x1 = Math.max(...pts.map(o => o.p.x + (SIZE[o.n.type][0] / 2) * z)) + pad;
  const y0 = Math.min(...pts.map(o => o.p.y - (SIZE[o.n.type][1] / 2) * z)) - pad, y1 = Math.max(...pts.map(o => o.p.y + SIZE[o.n.type][1] * z)) + pad;
  const H = innerHeight - 64;   // keep the in-canvas category legend clear
  let k = Math.min(maxK / z, innerWidth / (x1 - x0), H / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (k * z < minK) { k = minK / z; cx = pts[0].p.x; cy = pts[0].p.y; }
  chart.dispatchAction({ type: 'graphRoam', seriesIndex: 0, zoom: k, originX: cx, originY: cy });
  chart.dispatchAction({ type: 'graphRoam', seriesIndex: 0, dx: innerWidth / 2 - cx, dy: H / 2 - cy });
}
const preview = document.getElementById('preview');
function focus(d) {
  if (focusNode === d) return reset();
  focusNode = d; roamTo([d, ...[...nb.get(d.id)].map(id => byId.get(id)).filter(n => nodes.includes(n))], 60, 2.2, 1.1);
  chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: nodes.indexOf(d) });
  if (d.type === 'document') { const chips = links.filter(l => /documents|references/.test(l.relation) && (nid(l.source) === d.id || nid(l.target) === d.id)).map(l => `<span class="chip">${byId.get(nid(l.source) === d.id ? nid(l.target) : nid(l.source)).label}</span>`).join('');
    preview.innerHTML = `<h3>${d.label} <button aria-label="close">✕</button></h3><img src="${asset(d.thumb)}"><div class="chips">${chips}</div>`; preview.classList.add('show'); preview.querySelector('button').onclick = reset; }
}
function reset() { focusNode = null; preview.classList.remove('show'); chart.dispatchAction({ type: 'downplay', seriesIndex: 0 }); roamTo(nodes, 40, 1.4); }
chart.on('click', p => { if (p.dataType === 'node') focus(byId.get(p.data.id)); });
chart.getZr().on('dblclick', e => { if (!e.target) reset(); });

// ---- HUD ---------------------------------------------------------------------------------------------------------------
const refresh = () => (fitOnce = true, chart.setOption({ series: [{ layout: state.circular ? 'circular' : 'force', label: { show: state.labels }, ...seriesData() }] }));
const hud = mountHud({ title: 'Image Symbols', library: 'ECharts', version: '6.1.0 · graph + image:// symbols', legend: false, toggles: [
  { id: 'files', label: 'files inside repos', on: true, onChange: on => { state.files = !on; refresh(); } },
  { id: 'pictures', label: 'pictures', on: true, onChange: on => { state.pictures = on; refresh(); } },
  { id: 'circular', label: 'circular', on: false, onChange: on => { state.circular = on; refresh(); } },
  { id: 'labels', label: 'labels', on: true, onChange: on => { state.labels = on; refresh(); } }] });
const legend = document.createElement('div'); legend.className = 'hud hud--bl legend objects'; hud.root.appendChild(legend);
legend.innerHTML = '<h4>Relations</h4>' + Object.entries(M.relation_styles).map(([r, s]) => `<div class="legend-row rel"><svg viewBox="0 0 34 8"><line x1="0" y1="4" x2="${s.arrow ? 28 : 34}" y2="4" stroke="${s.color}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash.join(' ')}"` : ''}/>${s.arrow ? `<path d="M28,1L34,4L28,7Z" fill="${s.color}"/>` : ''}</svg>${s.label}</div>`).join('');

const demo = window.__demo = { hud, chart, sys, state, ready: false, get hoverNode() { return hoverNode; }, get nodes() { return nodes; },
  screenPos: id => { const p = pos(id), r = rect(); return p && { x: p.x + r.left, y: p.y + r.top }; },
  clickState: () => ({ focus: focusNode?.id || null, k: +zoomOf().toFixed(3), preview: preview.classList.contains('show') }),
  toggleState: () => ({ ...state, nodes: nodes.length, links: links.length, hulls: hulls.querySelectorAll('path').length, cards: cache.size, layout: sm().get('layout'), labelsShown: !!sm().get(['label', 'show']) }),
  reset, settle: () => { const f = sm().forceLayout; if (f) { for (let i = 0; i < 200; i++) f.step(); f.warmUp?.(); } } };
setTimeout(() => { demo.ready = true; }, 2500);
