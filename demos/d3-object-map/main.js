// d3-object-map — every node drawn as its object (SVG frames + <image> pictures), typed edges, repo/team hulls.
import { mountHud, tooltipHtml, buildNeighbors } from '../../shared/hud.js';

const sys = await (await fetch('../../shared/system.json')).json();
const M = sys.meta, asset = p => M.asset_root + p, byId = new Map(sys.nodes.map(n => [n.id, n]));
const SIZE = { service: [120, 44], database: [96, 40], queue: [130, 32], repo: [110, 56], file: [44, 44], document: [54, 72], person: [48, 48], cloud: [96, 44] };
const DIST = { calls: 150, reads: 120, writes: 120, publishes: 120, consumes: 120, contains: 62, documents: 170, references: 130, owns: 130, authored: 120, deploys_to: 150, monitors: 180 };
const HEALTH = { healthy: '#8dff9e', degraded: '#ffb347', down: '#ff5f8f' };
const TEAMS = Object.keys(M.teams), ti = d => Math.max(0, TEAMS.indexOf(d.team));
const color = d => d.type === 'person' ? (M.teams[d.team]?.color || M.type_colors.person) : M.type_colors[d.type];
const pictureFor = d => d.thumb || d.avatar || d.logo || d.icon;
const trunc = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const tech = d => d.lang || d.engine || d.language || d.provider || '';
const nid = v => (typeof v === 'object' ? v.id : v);
const nb = buildNeighbors(sys.links);
const state = { files: true, pictures: true, rel: false, layers: true };
// Layered bands: cloud top, services middle (by team), data stores below, repos+files right (by repo), people+docs left.
const idx = (type, d) => sys.nodes.filter(n => n.type === type).indexOf(d), repoIdx = d => sys.nodes.filter(n => n.type === 'repo').findIndex(n => n.id === (d.type === 'repo' ? d.id : d.repo));
const svcIdx = d => sys.nodes.filter(n => n.type === 'service' && n.team === d.team).indexOf(d);   // 2 rows × up to 2 columns per team
const bandX = d => ({ repo: 420, file: 520, person: -440, document: -640 + (idx('document', d) % 2) * 100, service: (ti(d) - 1.5) * 200 + (Math.floor(svcIdx(d) / 2) - 0.5) * 100,
  cloud: (idx('cloud', d) - 3.5) * 120, database: (idx('database', d) - 2.5) * 150, queue: 480 - (idx('queue', d) ? 960 : 0) }[d.type] ?? 0);
const bandY = d => ({ cloud: -330, service: -170 + (svcIdx(d) % 2) * 75, database: 130, queue: 130, person: -175 + ti(d) * 75, repo: (repoIdx(d) - 3.5) * 105, file: (repoIdx(d) - 3.5) * 105,
  document: (Math.floor(idx('document', d) / 2) - 3) * 105 + 40 }[d.type] ?? 0);

// ---- SVG scaffold ---------------------------------------------------------------------------------------------
const svg = d3.select('#map'), W = () => innerWidth, H = () => innerHeight;
const defs = svg.append('defs');
for (const [rel, s] of Object.entries(M.relation_styles))
  defs.append('marker').attr('id', 'arrow-' + rel).attr('viewBox', '0 -3 6 6').attr('refX', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-3L6,0L0,3Z').attr('fill', s.color);
defs.append('clipPath').attr('id', 'clip-avatar').append('circle').attr('r', 20);
const root = svg.append('g');
const gHull = root.append('g'), gLink = root.append('g').attr('fill', 'none'), gELabel = root.append('g'), gNode = root.append('g');
const hullLine = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.6));

// ---- Frames: one drawing routine per meta.type_frames value ---------------------------------------------------------
function drawFrame(sel, d) {
  const [w, h] = SIZE[d.type], f = M.type_frames[d.type], c = color(d), b = sel.append('g').attr('class', 'body');
  const frame = (x, y, ww, hh, rx) => b.append('rect').attr('class', 'frame').attr('x', x).attr('y', y).attr('width', ww).attr('height', hh).attr('rx', rx);
  const pic = (href, x, y, s, cls = 'pic') => { b.append('rect').attr('class', 'well').attr('x', x - 3).attr('y', y - 3).attr('width', s + 6).attr('height', s + 6).attr('rx', 6);
    return b.append('image').attr('class', cls).attr('href', href).attr('data-pic', href).attr('x', x).attr('y', y).attr('width', s).attr('height', s); };
  const text = (t, x, y, cls) => b.append('text').attr('class', cls).attr('x', x).attr('y', y).text(t);
  const wide = (rx, s, both, tx) => { frame(-w / 2, -h / 2, w, h, rx); pic(asset(both ? d.icon : d.logo || d.icon), -w / 2 + 8, -s / 2, s);
    if (both && d.logo) pic(asset(d.logo), w / 2 - 8 - s, -s / 2, s, 'logo'); text(trunc(tech(d), 12), tx, 3.5, 'tech'); };
  if (f === 'tile') { frame(-22, -22, 44, 44, 10); pic(asset(d.icon), -14, -16, 26); text('.' + d.ext, 20, 19, 'badge'); }
  else if (f === 'page') { frame(-27, -36, 54, 72, 3); b.append('image').attr('class', 'pic').attr('href', asset(d.thumb)).attr('data-pic', asset(d.thumb))
      .attr('x', -25).attr('y', -34).attr('width', 50).attr('height', 68).attr('preserveAspectRatio', 'xMidYMin slice');
    b.append('path').attr('d', 'M13,-36L27,-22L13,-22Z').attr('fill', c).attr('stroke', '#07080f').attr('stroke-width', 1); }
  else if (f === 'circle') { b.append('circle').attr('class', 'frame').attr('r', 24); b.append('image').attr('class', 'pic').attr('href', asset(d.avatar)).attr('data-pic', asset(d.avatar))
      .attr('x', -20).attr('y', -20).attr('width', 40).attr('height', 40).attr('clip-path', 'url(#clip-avatar)'); }
  else if (f === 'rack') { wide(8, 28, true, 0); b.append('circle').attr('cx', w / 2 - 6).attr('cy', -h / 2 + 6).attr('r', 3.5).attr('fill', HEALTH[d.health]).attr('stroke', '#07080f'); }
  else if (f === 'cylinder') { wide(20, 24, false, 12); b.append('ellipse').attr('cx', 0).attr('cy', -h / 2 + 1).attr('rx', w / 2 - 1).attr('ry', 5).attr('fill', 'none').attr('stroke', c).attr('stroke-opacity', .6); }
  else if (f === 'pipe') wide(16, 18, false, 8);
  else if (f === 'folder') { b.append('rect').attr('class', 'frame').attr('x', -w / 2).attr('y', -h / 2 - 7).attr('width', 40).attr('height', 12).attr('rx', 3); frame(-w / 2, -h / 2, w, h, 6);
    pic(asset(d.logo), -47, -15, 30); text(trunc(d.language, 12), 10, -1, 'tech'); text('★ ' + d.stars, 10, 13, 'tech');
    b.append('g').attr('class', 'count').style('display', 'none').call(g => { g.append('rect').attr('x', w / 2 - 34).attr('y', -h / 2 - 8).attr('width', 40).attr('height', 14).attr('rx', 7).attr('fill', c);
      g.append('text').attr('class', 'count').attr('x', w / 2 - 14).attr('y', -h / 2 + 3).text(d.files + ' files'); }); }
  else if (f === 'cloud') wide(22, 28, false, 14);
  sel.append('text').attr('class', 'label').attr('y', h / 2 + (f === 'folder' ? 14 : 13)).text(trunc(d.label));
  if (d.sublabel) sel.append('text').attr('class', 'sub').attr('y', h / 2 + (f === 'folder' ? 26 : 25)).text(trunc(d.sublabel, 22));
}

// ---- Simulation + join --------------------------------------------------------------------------------------------
let nodes = [], links = [], node = gNode.selectAll('g.node'), link = gLink.selectAll('path.link'), hoverNode = null, focusNode = null;
const sim = d3.forceSimulation().alphaDecay(0.028)
  .force('link', d3.forceLink().id(d => d.id).distance(l => DIST[l.relation] || 130).strength(l => (l.relation === 'contains' ? 0.9 : state.layers ? 0.08 : 0.3)))
  .force('charge', d3.forceManyBody().strength(-260).distanceMax(400))
  .force('collide', d3.forceCollide(d => Math.hypot(...SIZE[d.type]) / 2 + ({ document: 16, service: 14, repo: 12 }[d.type] || 8)).iterations(2))
  .force('x', d3.forceX(d => (state.layers ? bandX(d) : 0)).strength(() => (state.layers ? 0.5 : 0.03)))
  .force('y', d3.forceY(d => (state.layers ? bandY(d) : 0)).strength(() => (state.layers ? 0.6 : 0.03)))
  .on('tick', ticked);

function build() {
  nodes = sys.nodes.filter(n => state.files || n.type !== 'file');
  const ids = new Set(nodes.map(n => n.id));
  links = sys.links.filter(l => ids.has(nid(l.source)) && ids.has(nid(l.target))).map(l => ({ ...l, source: nid(l.source), target: nid(l.target) }));
  link = link.data(links, l => l.source + '>' + l.target).join('path').attr('class', l => 'link ' + l.relation)
    .attr('stroke', l => M.relation_styles[l.relation].color).attr('stroke-width', l => M.relation_styles[l.relation].width).attr('color', l => M.relation_styles[l.relation].color)
    .attr('stroke-dasharray', l => (M.relation_styles[l.relation].dash || []).join(' ') || null).attr('marker-end', l => (M.relation_styles[l.relation].arrow ? `url(#arrow-${l.relation})` : null));
  node = node.data(nodes, d => d.id).join(enter => {
    const g = enter.append('g').attr('class', d => 'node ' + d.type).style('--c', color).style('opacity', 0);
    g.each(function (d) { drawFrame(d3.select(this), d); });
    g.transition().duration(700).delay((d, i) => 300 + i * 12).style('opacity', 1);
    return g;
  });
  node.select('g.count').style('display', state.files ? 'none' : null);
  node.on('pointerenter', (e, d) => setHover(d, e)).on('pointermove', (e, d) => hud.showTooltip(card(d), e.clientX, e.clientY)).on('pointerleave', () => setHover(null))
    .on('click', (e, d) => { e.stopPropagation(); focus(d); })
    .call(d3.drag().clickDistance(4).on('start', () => sim.alphaTarget(0.25).restart()).on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; }).on('end', (e, d) => { d.fx = d.fy = null; sim.alphaTarget(0); }));
  applyPictures();
  sim.nodes(nodes); sim.force('link').links(links); sim.alpha(0.9).restart();
}

function edgePath(l) {
  const s = l.source, t = l.target, dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const trim = n => { const [w, h] = SIZE[n.type]; return Math.min((w / 2 + 3) / (Math.abs(ux) || 1e-6), (h / 2 + 3) / (Math.abs(uy) || 1e-6)); };
  const ks = trim(s), kt = trim(t) + (M.relation_styles[l.relation].arrow ? 5 : 0);
  const x1 = s.x + ux * ks, y1 = s.y + uy * ks, x2 = t.x - ux * kt, y2 = t.y - uy * kt, cx = (x1 + x2) / 2 - uy * len * 0.12, cy = (y1 + y2) / 2 + ux * len * 0.12;
  l.mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2; l.my = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  return `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`;
}
function hullPath(members) {
  const pts = [];
  for (const n of members) { const [w, h] = SIZE[n.type], px = w / 2 + 14, py = h / 2 + 26; pts.push([n.x - px, n.y - py], [n.x + px, n.y - py], [n.x + px, n.y + py], [n.x - px, n.y + py]); }
  const hull = d3.polygonHull(pts); return hull && { d: hullLine(hull), x: d3.min(hull, p => p[0]) + 10, y: d3.min(hull, p => p[1]) + 14 };
}
function ticked() {
  node.attr('transform', d => `translate(${d.x},${d.y})`);
  link.attr('d', edgePath);
  const visible = new Set(nodes.map(n => n.id));
  const groups = sys.groups.filter(g => (g.kind === 'repo' ? state.files : !state.layers))
    .map(g => ({ g, hull: hullPath([...g.members, g.parent].filter(id => visible.has(id)).map(id => byId.get(id))) })).filter(x => x.hull);
  gHull.selectAll('g.hull-g').data(groups, x => x.g.id).join(enter => { const e = enter.append('g').attr('class', 'hull-g'); e.append('path').attr('class', 'hull'); e.append('text').attr('class', 'hull-label'); return e; })
    .each(function ({ g, hull }) { d3.select(this).select('path').attr('d', hull.d).attr('fill', g.color).attr('stroke', g.color); d3.select(this).select('text').attr('x', hull.x).attr('y', hull.y).attr('fill', g.color).text(g.label); });
  const labelled = state.rel ? links : links.filter(l => hoverNode && (l.source === hoverNode || l.target === hoverNode));
  gELabel.selectAll('text.edge-label').data(labelled, l => l.source.id + '>' + l.target.id).join('text').attr('class', 'edge-label').attr('x', l => l.mx).attr('y', l => l.my).text(l => M.relation_styles[l.relation].label);
}

// ---- Hover card, focus, zoom --------------------------------------------------------------------------------------
function attrs(d) {
  const lab = id => byId.get(id)?.label, out = links.filter(l => l.source === d).reduce((m, l) => ((m[l.relation] ??= []).push(l.target.label), m), {});
  return { service: { lang: d.lang, health: d.health, owner: lab(d.owner), repo: lab(d.repo), rps: d.rps, 'deploys to': out.deploys_to?.join(', ') },
    database: { engine: d.engine, size: d.size_gb + ' GB' }, queue: { engine: d.engine }, repo: { language: d.language, stars: d.stars, files: d.files },
    file: { path: d.sublabel, ext: d.ext, loc: d.loc, repo: lab(d.repo) }, document: { format: d.format, pages: d.pages, kind: d.kind, updated: d.updated, author: lab(d.author) },
    person: { role: d.role, team: M.teams[d.team]?.label }, cloud: { provider: d.provider } }[d.type];
}
const card = d => `<img class="${d.type === 'document' ? 'page' : ''}" src="${asset(state.pictures ? pictureFor(d) : d.icon)}"><div><div class="tt-type">${d.type}</div>${tooltipHtml(d.label, attrs(d))}</div>`;
function setHover(d, e) {
  hoverNode = d; hud.root.querySelector('.tooltip').classList.toggle('card', !!d);
  node.classed('hover', n => n === d).classed('dim', n => !!d && n !== d && !nb.get(d.id).has(n.id)).filter(n => n === d).raise();
  link.classed('lit', l => !!d && (l.source === d || l.target === d)).classed('dim', l => !!d && l.source !== d && l.target !== d);
  if (d) hud.showTooltip(card(d), e.clientX, e.clientY); else hud.hideTooltip();
  ticked();
}
const zoom = d3.zoom().scaleExtent([0.25, 5]).on('zoom', e => { root.attr('transform', e.transform); svg.classed('zoomed-out', e.transform.k < 1); });
svg.call(zoom).on('dblclick.zoom', null).on('dblclick', () => reset()).on('click', () => { if (focusNode) reset(); });
function zoomTo(list, pad = 60, maxK = 2.2, ms = 800, minK = 0.25) {
  const x0 = d3.min(list, n => n.x - SIZE[n.type][0] / 2) - pad, x1 = d3.max(list, n => n.x + SIZE[n.type][0] / 2) + pad, y0 = d3.min(list, n => n.y - SIZE[n.type][1] / 2) - pad, y1 = d3.max(list, n => n.y + SIZE[n.type][1]) + pad;
  let k = Math.min(maxK, W() / (x1 - x0), H() / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (k < minK) { k = minK; cx = list[0].x; cy = list[0].y; }   // neighbours span the map: zoom onto the object itself
  svg.transition().duration(ms).call(zoom.transform, d3.zoomIdentity.translate(W() / 2, H() / 2).scale(k).translate(-cx, -cy));
}
const preview = document.getElementById('preview');
function focus(d) {
  if (focusNode === d) return reset();
  focusNode = d; zoomTo([d, ...[...nb.get(d.id)].map(id => byId.get(id)).filter(n => n.x != null && nodes.includes(n))], 60, 2.2, 800, 1.1);
  if (d.type === 'document') { const chips = links.filter(l => l.source === d || l.target === d).filter(l => /documents|references/.test(l.relation)).map(l => `<span class="chip">${(l.source === d ? l.target : l.source).label}</span>`).join('');
    preview.innerHTML = `<h3>${d.label} <button aria-label="close">✕</button></h3><img src="${asset(d.thumb)}"><div class="chips">${chips}</div>`; preview.classList.add('show'); preview.querySelector('button').onclick = reset; }
}
function reset() { focusNode = null; preview.classList.remove('show'); fit(); }
const fit = () => zoomTo(nodes, 40, 1.4, 900);

// ---- HUD: title, toggles, custom object legend ------------------------------------------------------------------------------
function applyPictures() {
  node.selectAll('image.pic').attr('href', function (d) { return state.pictures ? this.dataset.pic : asset(d.icon); }).attr('preserveAspectRatio', d => (d.type === 'document' ? (state.pictures ? 'xMidYMin slice' : 'xMidYMid meet') : null));
  node.selectAll('image.logo').style('display', state.pictures ? null : 'none');
}
const hud = mountHud({ title: 'Object Map', library: 'D3', version: '7.9.0 · SVG <image> tiles', legend: false, toggles: [
  { id: 'files', label: 'files inside repos', on: !state.files, onChange: on => { state.files = !on; build(); setTimeout(fit, 1500); } },
  { id: 'pictures', label: 'pictures', on: true, onChange: on => { state.pictures = on; applyPictures(); } },
  { id: 'rel', label: 'relation labels', on: false, onChange: on => { state.rel = on; ticked(); } },
  { id: 'layers', label: 'layers', on: true, onChange: on => { state.layers = on; sim.force('x').initialize(nodes); sim.force('y').initialize(nodes); sim.alpha(0.8).restart(); setTimeout(fit, 1800); } }] });
const legend = document.createElement('div'); legend.className = 'hud hud--bl legend objects'; hud.root.appendChild(legend);
legend.insertAdjacentHTML('beforeend', '<h4>Objects</h4>');
for (const type of Object.keys(M.type_colors)) {
  const row = document.createElement('div'); row.className = 'legend-row'; legend.appendChild(row);
  const s = d3.select(row).append('svg').attr('width', 52).attr('height', 30).attr('viewBox', '-26 -15 52 30');
  const sample = { ...sys.nodes.find(n => n.type === type) }; delete sample.sublabel;
  const g = s.append('g').attr('class', 'node ' + type).style('--c', color(sample)).attr('transform', `scale(${Math.min(48 / SIZE[type][0], 28 / SIZE[type][1])})`);
  drawFrame(g, sample); g.select('text.label').remove();
  row.insertAdjacentHTML('beforeend', `<span>${type}</span>`);
}
legend.insertAdjacentHTML('beforeend', '<h4>Relations</h4>' + Object.entries(M.relation_styles).map(([r, s]) => `<div class="legend-row rel"><svg viewBox="0 0 34 8"><line x1="0" y1="4" x2="${s.arrow ? 28 : 34}" y2="4" stroke="${s.color}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash.join(' ')}"` : ''}/>${s.arrow ? `<path d="M28,1L34,4L28,7Z" fill="${s.color}"/>` : ''}</svg>${s.label}</div>`).join(''));

build();
setTimeout(() => { fit(); demo.ready = true; }, 2600);
addEventListener('resize', () => { if (!focusNode) fit(); });
const demo = window.__demo = { hud, sys, ready: false, state, get hoverNode() { return hoverNode; }, get nodes() { return nodes; },
  screenPos: id => { const n = byId.get(id), t = d3.zoomTransform(svg.node()); return { x: t.applyX(n.x), y: t.applyY(n.y) }; },
  clickState: () => ({ focus: focusNode?.id || null, k: +d3.zoomTransform(svg.node()).k.toFixed(3), preview: preview.classList.contains('show') }),
  toggleState: () => ({ ...state, nodes: nodes.length, links: links.length, hulls: gHull.selectAll('path').size(), pics: node.selectAll('image.pic').filter(function () { return this.getAttribute('href').includes('thumbs/'); }).size(), edgeLabels: gELabel.selectAll('text').size() }),
  reset, fit, settle: () => { sim.tick(220); sim.alpha(0.01); ticked(); fit(); } };
