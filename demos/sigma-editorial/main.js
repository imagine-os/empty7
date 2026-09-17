// sigma-editorial — "Editorial dark". Sigma.js 3 + graphology, ForceAtlas2 in a worker, node halos, curved edges.
import Graph from 'graphology';
import * as libNS from 'graphology-library';
import Sigma from 'sigma';
import EdgeCurveProgram, { indexParallelEdgesIndex } from '@sigma/edge-curve';
import { createNodeBorderProgram } from '@sigma/node-border';
import { loadData, linkColor, mountHud, tooltipHtml, GOLD } from '../../shared/hud.js';

const lib = libNS.layout ? libNS : libNS.default;
const FA2Layout = lib.FA2Layout ?? (await import('graphology-layout-forceatlas2/worker')).default;
const COMMUNITY_PALETTE = ['#4fd1c5', '#ff9f6b', '#b48cff', '#ffd166', '#7ee8fa', '#f97fb5', '#a3e635', '#60a5fa', '#fb7185', '#c084fc'];
const DIM_NODE = '#232634', DIM_EDGE = 'rgba(255,255,255,0.04)', HALO = 'rgba(255,255,255,0.25)';
const Z = { film: 3, studio: 2, award: 2, person: 1, genre: 0 };
const container = document.getElementById('graph'), statusEl = document.getElementById('status');

const withAlpha = (c, a) => c.startsWith('rgba') ? c : `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`;
const sizeOf = n => n.size + (n.type === 'film' ? (n.gross_musd || 0) / 100 : 0) + (n.type === 'person' ? (n.wins || 0) * 1.2 : 0);
const fmt = (v, unit = '') => v == null ? null : `${typeof v === 'number' ? v.toLocaleString() : v}${unit}`;

if (!document.createElement('canvas').getContext('webgl')) {
  document.getElementById('fallback').classList.add('show');
  throw new Error('sigma-editorial: WebGL unavailable');
}

// ---- graph model --------------------------------------------------------------
const data = await loadData('../../shared/data.json');
const graph = new Graph({ multi: true, type: 'undirected' });
for (const n of data.nodes) {
  const gold = n.type === 'award' || (n.wins || 0) > 0;
  graph.addNode(n.id, { ...n, kind: n.type, type: 'halo', size: sizeOf(n), typeColor: n.color, color: n.color,
    haloColor: gold ? withAlpha(GOLD, 0.85) : HALO, haloSize: gold ? 2.5 : 2, zIndex: Z[n.type] ?? 0 });
}
for (const l of data.links) {
  const gold = l.relation === 'won' || (l.relation === 'nominee' && l.won);
  graph.addEdge(l.source, l.target, { ...l, color: withAlpha(linkColor(l), gold ? 0.75 : 0.42), size: gold ? 1.6 : 0.8, zIndex: gold ? 1 : 0 });
}
// parallel credits (actor + writer, repeat nominations) fan out with distinct curvatures
indexParallelEdgesIndex(graph, { edgeIndexAttribute: 'pi', edgeMinIndexAttribute: 'pmin', edgeMaxIndexAttribute: 'pmax' });
graph.forEachEdge((e, a) => graph.setEdgeAttribute(e, 'curvature', a.pi == null ? 0.25 : 0.25 + 0.3 * a.pi));
lib.layout.circular.assign(graph, { scale: 200 });
lib.communitiesLouvain.assign(graph, { nodeCommunityAttribute: 'community', resolution: 1 });

// ---- renderer ---------------------------------------------------------------
let hovered = null, focused = null, dragged = null, mode = 'type', curved = true, allLabels = false;
const neighborsOf = n => new Set([n, ...graph.neighbors(n)]);
const colorOf = a => mode === 'community' ? COMMUNITY_PALETTE[a.community % COMMUNITY_PALETTE.length] : a.typeColor;

function drawLabel(ctx, d, settings) {
  if (!d.label) return;
  ctx.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(d.label, d.x + d.size + 5, d.y + settings.labelSize / 3 + 1);
  ctx.fillStyle = d.labelColor || settings.labelColor.color; ctx.fillText(d.label, d.x + d.size + 5, d.y + settings.labelSize / 3);
}
function drawHover(ctx, d, settings) {          // dark pill behind the hovered label instead of sigma's white box
  if (!d.label) return;
  ctx.font = `600 ${settings.labelSize}px ${settings.labelFont}`;
  const w = ctx.measureText(d.label).width + 14, h = settings.labelSize + 10, x = d.x + d.size + 2, y = d.y - h / 2;
  ctx.fillStyle = 'rgba(10,12,20,0.85)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText(d.label, x + 7, d.y + settings.labelSize / 3);
}

const sigma = new Sigma(graph, container, {
  defaultNodeType: 'halo', defaultEdgeType: 'curved', zIndex: true, renderEdgeLabels: false,
  nodeProgramClasses: { halo: createNodeBorderProgram({ borders: [
    { size: { attribute: 'haloSize', defaultValue: 2, mode: 'pixels' }, color: { attribute: 'haloColor' } },
    { size: { fill: true }, color: { attribute: 'color' } } ] }) },
  edgeProgramClasses: { curved: EdgeCurveProgram },
  labelFont: 'Inter, -apple-system, Segoe UI, Roboto, sans-serif', labelSize: 12, labelWeight: '500',
  labelColor: { color: 'rgba(255,255,255,0.9)' }, labelRenderedSizeThreshold: 8.5, labelDensity: 0.9, labelGridCellSize: 80,
  defaultDrawNodeLabel: drawLabel, defaultDrawNodeHover: drawHover, stagePadding: 60, minCameraRatio: 0.05, maxCameraRatio: 3,
  nodeReducer: (n, a) => {
    const res = { ...a, color: colorOf(a), highlighted: n === hovered };
    const active = hovered ?? focused;
    if (active != null && !neighborsOf(active).has(n)) { res.color = DIM_NODE; res.haloColor = 'rgba(255,255,255,0.05)'; res.label = null; }
    else if (active != null) res.forceLabel = true;
    if (allLabels) res.forceLabel = true;
    return res;
  },
  edgeReducer: (e, a) => {
    const res = { ...a, type: curved ? 'curved' : 'line' };
    const active = hovered ?? focused;
    if (active != null) {
      if (!graph.hasExtremity(e, active)) { res.color = DIM_EDGE; res.zIndex = -1; }
      else { res.color = withAlpha(linkColor(a), 1); res.size = a.size + 0.6; res.zIndex = 2; }
    }
    return res;
  },
});
const refresh = () => sigma.refresh({ skipIndexation: true });

// ---- layout: ForceAtlas2 live in a worker -----------------------------------
const fa2 = new FA2Layout(graph, { settings: { ...lib.layoutForceAtlas2.inferSettings(graph), scalingRatio: 8, gravity: 0.5,
  barnesHutOptimize: false, strongGravityMode: false, slowDown: 4, adjustSizes: false, edgeWeightInfluence: 0 } });
let stopTimer;
function runLayout(ms = 3000) {
  clearTimeout(stopTimer); fa2.start(); statusEl.classList.remove('idle'); statusEl.lastElementChild.textContent = 'ForceAtlas2 settling';
  stopTimer = setTimeout(() => { fa2.stop(); statusEl.classList.add('idle'); statusEl.lastElementChild.textContent = 'layout settled · click "relayout" to run again'; }, ms);
}

// ---- HUD ---------------------------------------------------------------------
const hud = mountHud({
  title: 'Editorial Dark', library: 'Sigma.js + graphology', version: '3.0.3',
  toggles: [
    { id: 'community', label: 'communities', on: false, onChange: on => { mode = on ? 'community' : 'type'; refresh(); } },
    { id: 'curved', label: 'curved edges', on: true, onChange: on => { curved = on; refresh(); } },
    { id: 'labels', label: 'all labels', on: false, onChange: on => { allLabels = on; refresh(); } },
    { id: 'relayout', label: 'relayout', on: false, onChange: () => { setTimeout(() => hud.setToggle('relayout', false), 300); lib.layout.circular.assign(graph, { scale: 200 }); runLayout(3000); } },
  ],
});
const tipFor = id => { const a = graph.getNodeAttributes(id); return tooltipHtml(a.label, {
  type: a.kind, community: mode === 'community' ? a.community : null, degree: graph.degree(id), year: a.year, gross: fmt(a.gross_musd, ' M$'),
  roi: a.roi != null ? a.roi + '×' : null, wins: a.wins, born: a.born, founded: a.founded, country: a.country, nationality: a.nationality, films: a.film_count }); };

// ---- interaction -------------------------------------------------------------
sigma.on('enterNode', ({ node, event }) => { hovered = node; hud.showTooltip(tipFor(node), event.original.clientX, event.original.clientY); refresh(); });
sigma.on('leaveNode', () => { hovered = null; hud.hideTooltip(); refresh(); });
sigma.on('clickNode', ({ node }) => {
  focused = node; const p = sigma.getNodeDisplayData(node);
  sigma.getCamera().animate({ x: p.x, y: p.y, ratio: 0.35 }, { duration: 700 }); refresh();
});
sigma.on('doubleClickStage', ({ event }) => { event.preventSigmaDefault(); focused = null; sigma.getCamera().animatedReset({ duration: 800 }); refresh(); });
sigma.on('clickStage', () => { if (focused) { focused = null; refresh(); } });
// drag nodes
sigma.on('downNode', ({ node }) => { dragged = node; if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox()); });
sigma.getMouseCaptor().on('mousemovebody', e => {
  if (!dragged) return;
  const p = sigma.viewportToGraph(e); graph.setNodeAttribute(dragged, 'x', p.x); graph.setNodeAttribute(dragged, 'y', p.y);
  hud.showTooltip(tipFor(dragged), e.original.clientX, e.original.clientY);
  e.preventSigmaDefault(); e.original.preventDefault(); e.original.stopPropagation();
});
const release = () => { dragged = null; };
sigma.getMouseCaptor().on('mouseup', release); sigma.on('upStage', release); sigma.on('upNode', release);

// ---- boot ----------------------------------------------------------------------
globalThis.__demo = { sigma, graph }; // test hook
await (document.fonts?.ready ?? Promise.resolve());
container.classList.add('in');
runLayout(3200);
