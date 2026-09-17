// cosmos-galaxy — "Living galaxy". cosmos.gl 3.4.1 GPU force simulation, shared HUD chrome.
import { loadData, linkColor, mountHud, tooltipHtml, GOLD } from '../../shared/hud.js';
import { makeStress } from '../../shared/stress.js';

const { Graph, PointShape } = globalThis.Cosmos || {};
const TYPE_INDEX = { studio: 0, film: 1, person: 2, genre: 3, award: 4 };
const SHAPES = { studio: PointShape?.Square, film: PointShape?.Circle, person: PointShape?.Circle,
                 genre: PointShape?.Diamond, award: PointShape?.Star };
const container = document.getElementById('graph');
const labelsEl = document.getElementById('labels');

// ---- helpers ---------------------------------------------------------------
function rgba(c, a = 1) {                       // '#rrggbb' | 'rgba(r,g,b,a)' -> [r,g,b,a] floats
  if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] * a]; }
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}
const sizeOf = n => (n.size ?? 3) + (n.type === 'film' ? (n.gross_musd || 0) / 100 : 0) + (n.type === 'person' ? (n.wins || 0) * 1.2 : 0);
const fmt = (v, unit = '') => v == null ? null : `${typeof v === 'number' ? v.toLocaleString() : v}${unit}`;

// ---- WebGL2 gate -----------------------------------------------------------
if (!Graph || !document.createElement('canvas').getContext('webgl2')) {
  document.getElementById('fallback').classList.add('show');
  mountHud({ title: 'Living Galaxy', library: 'cosmos.gl', version: '3.4.1', toggles: [] });
  throw new Error('cosmos-galaxy: WebGL2 unavailable');
}

// ---- state -----------------------------------------------------------------
let base;                       // shared dataset
let cur = { nodes: [], links: [] };
let idx = new Map();            // id -> index
let hovered, focused;
let repel = true, labelsOn = true, pointerIn = false, stress = false, userZoomed = false, ticks = 0;
let tracked = [];               // label node indices
let mouse;                      // last pointer event (cosmos may fire hover with no event)
const hud = mountHud({
  title: 'Living Galaxy', library: 'cosmos.gl', version: '3.4.1',
  toggles: [
    { id: 'sim', label: 'simulation', on: true, onChange: on => on ? graph.unpause() : graph.pause() },
    { id: 'repel', label: 'mouse repel', on: true, onChange: on => { repel = on; } },
    { id: 'labels', label: 'labels', on: true, onChange: on => { labelsOn = on; labelsEl.style.display = on ? '' : 'none'; } },
    { id: 'stress', label: 'stress 50k', on: false, onChange: on => { stress = on; load(on ? makeStress(50000) : base); } },
  ],
});

// ---- graph -----------------------------------------------------------------
const graph = new Graph(container, {
  backgroundColor: [0, 0, 0, 0],
  spaceSize: 4096, pointSizeScale: 1, scalePointsOnZoom: false, scaleLinksOnZoom: false, pointOpacity: 0,
  pointDefaultShape: PointShape.Circle, pointGreyoutOpacity: 0.12, linkGreyoutOpacity: 0.05,
  renderHoveredPointRing: true, hoveredPointRingColor: [1, 1, 1, 0.9], focusedPointRingColor: rgba(GOLD, 1),
  curvedLinks: true, curvedLinkWeight: 0.6, curvedLinkSegments: 12, linkColorInterpolateFromEndpoints: true,
  linkOpacity: 0, linkWidthScale: 1, linkBlending: true, linkVisibilityDistanceRange: [30, 300], linkVisibilityMinTransparency: 0.35,
  simulationGravity: 0.15, simulationRepulsion: 4, simulationLinkSpring: 0.5, simulationLinkDistance: 40,
  simulationDecay: 20000, simulationFriction: 0.86, simulationCluster: 0.06, simulationRepulsionFromMouse: 3,
  enableRightClickRepulsion: true, transitionDuration: 800, enableDrag: true, fitViewOnInit: false,
  onPointMouseOver: (i, _p, ev) => { hovered = i; highlight(); showTip(i, ev); },
  onMouseMove: (i, _p, ev) => { if (ev) mouse = ev; if (hovered != null) showTip(hovered); },
  onPointMouseOut: () => { hovered = undefined; hud.hideTooltip(); highlight(); },
  onPointClick: i => { focused = i; const nb = graph.getNeighboringPointIndices(i); graph.setConfigPartial({ focusedPointIndex: i }); graph.fitViewByPointIndices([i, ...nb], 700, 0.35, true); highlight(); },
  onZoomStart: (_e, userDriven) => { if (userDriven) userZoomed = true; },
  // slow cinematic dolly-in as the simulation contracts (tick-based so it is frame-rate independent); off once the user zooms
  onSimulationTick: () => { ticks++; if (!userZoomed && (ticks === 15 || ticks === 120 || ticks === 400)) graph.fitView(ticks === 15 ? 1000 : 1800, 0.12, true); },
  onBackgroundClick: () => { if (focused != null) { focused = undefined; graph.setConfigPartial({ focusedPointIndex: undefined }); highlight(); } },
});
// cosmos applies the mouse-repulsion force only while the right button is held; alias it to plain hover
// so the galaxy visibly flows away from the cursor (right-drag still works as a stronger push).
// Only while the cursor is moving and not resting on a point, so hover/click still land.
Object.defineProperty(graph, 'isRightClickMouse', { get: () => repel && pointerIn && hovered == null && performance.now() - lastMove < 350, set() {} });
let lastMove = 0;
container.addEventListener('pointermove', () => { lastMove = performance.now(); });
container.addEventListener('pointerenter', () => { pointerIn = true; });
container.addEventListener('pointerleave', () => { pointerIn = false; });
container.addEventListener('dblclick', () => { if (hovered != null) return; focused = undefined; graph.setConfigPartial({ focusedPointIndex: undefined, highlightedPointIndices: undefined }); graph.fitView(900, 0.1, true); });

function highlight() {
  const i = hovered ?? focused;
  if (i == null) { graph.setConfigPartial({ highlightedPointIndices: undefined }); return; }
  graph.setConfigPartial({ highlightedPointIndices: [i, ...graph.getNeighboringPointIndices(i)] });
}
function showTip(i, ev = mouse) {
  const n = cur.nodes[i]; if (!n || !ev) return;
  const deg = graph.getNeighboringPointIndices(i).length;
  hud.showTooltip(tooltipHtml(n.label, {
    type: n.type, degree: deg, year: n.year, gross: fmt(n.gross_musd, ' M$'), roi: n.roi != null ? n.roi + '×' : null,
    wins: n.wins, born: n.born, founded: n.founded, country: n.country, nationality: n.nationality, films: n.film_count,
  }), ev.clientX, ev.clientY);
}

// Build typed arrays for a dataset and push into the GPU. Works for the 85-node film graph and the 50k stress set.
function load(d) {
  cur = d; hovered = focused = undefined; hud.hideTooltip();
  const N = d.nodes.length, L = d.links.length;
  idx = new Map(d.nodes.map((n, i) => [n.id, i]));
  const pos = new Float32Array(N * 2), col = new Float32Array(N * 4), size = new Float32Array(N), shape = new Float32Array(N);
  const clusters = new Array(N);
  d.nodes.forEach((n, i) => {
    // seed each type in its own sector so clusters coalesce quickly
    const a = TYPE_INDEX[n.type] / 5 * Math.PI * 2 + (Math.random() - 0.5) * 1.6, r = 200 + Math.random() * 500;
    pos[i * 2] = n.x ?? 2048 + Math.cos(a) * r; pos[i * 2 + 1] = n.y ?? 2048 + Math.sin(a) * r;
    col.set(rgba(n.color, 1), i * 4);
    size[i] = stress ? n.size : sizeOf(n);
    shape[i] = SHAPES[n.type] ?? PointShape.Circle;
    clusters[i] = TYPE_INDEX[n.type];
  });
  const links = new Float32Array(L * 2), lcol = new Float32Array(L * 4), lw = new Float32Array(L);
  d.links.forEach((l, i) => {
    links[i * 2] = idx.get(l.source); links[i * 2 + 1] = idx.get(l.target);
    const gold = l.relation === 'won' || (l.relation === 'nominee' && l.won);
    lcol.set(rgba(linkColor(l), stress ? 0.5 : 1), i * 4);
    lw[i] = gold ? 2.4 : stress ? 0.5 : 0.9;
  });
  graph.setPointPositions(pos); graph.setPointColors(col); graph.setPointSizes(size); graph.setPointShapes(shape);
  graph.setLinks(links); graph.setLinkColors(lcol); graph.setLinkWidths(lw);
  graph.setPointClusters(clusters);
  graph.setConfigPartial({ focusedPointIndex: undefined, highlightedPointIndices: undefined,
    simulationRepulsion: stress ? 1 : 4, simulationLinkDistance: stress ? 4 : 40, simulationLinkSpring: stress ? 1 : 0.5,
    simulationGravity: stress ? 0.25 : 0.15, simulationCluster: stress ? 0.1 : 0.06,
    linkOpacity: stress ? 0.18 : 0.35, curvedLinks: !stress });
  graph.render(1, 0); graph.start(1);            // snap (no GPU transition) when swapping datasets
  hud.setToggle('sim', true);
  userZoomed = false; ticks = 0;                 // re-arm the entrance dolly (see onSimulationTick)
  // labels: top-N hubs (none on the stress set)
  const N_LABELS = stress ? 0 : 26;
  tracked = [...d.nodes.keys()].sort((a, b) => (d.nodes[b].degree || 0) - (d.nodes[a].degree || 0)).slice(0, N_LABELS);
  graph.trackPointPositionsByIndices(tracked);
  labelsEl.innerHTML = '';
  for (const i of tracked) {
    const e = document.createElement('div'); e.className = 'lbl' + (d.nodes[i].degree >= 12 ? ' hub' : '');
    e.textContent = d.nodes[i].label; e.style.color = d.nodes[i].type === 'person' ? 'rgba(255,255,255,.85)' : d.nodes[i].color; labelsEl.appendChild(e);
  }
}

// Label overlay: reposition tracked hubs every frame, fade with zoom + hover greyout.
(function tickLabels() {
  requestAnimationFrame(tickLabels);
  if (!labelsOn || !graph.isReady || !tracked.length) return;
  const map = graph.getTrackedPointPositionsMap(), z = graph.getZoomLevel();
  const zf = Math.min(1, Math.max(0, (z - 0.35) / 0.6));
  const active = hovered ?? focused, nb = active != null ? new Set([active, ...graph.getNeighboringPointIndices(active)]) : null;
  tracked.forEach((i, k) => {
    const el = labelsEl.children[k], p = map.get(i); if (!el || !p) return;
    const [x, y] = graph.spaceToScreenPosition(p), r = graph.spaceToScreenRadius(cur.nodes[i].size ?? 4) || 6;
    el.style.transform = `translate(${x}px, ${y + r + 4}px) translate(-50%, 0)`;
    el.style.opacity = (nb && !nb.has(i) ? 0.12 : 1) * zf;
  });
})();

// ---- boot -------------------------------------------------------------------
globalThis.__demo = { graph, get cur() { return cur; } }; // test hook
base = await loadData('../../shared/data.json');
await graph.ready;
load(base);
container.classList.add('in');
// Entrance: points and links bloom in over ~1.6 s while the GPU simulation settles.
const t0 = performance.now();
(function fade(now) {
  const t = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - t, 3);
  graph.setConfigPartial({ pointOpacity: e, linkOpacity: (stress ? 0.18 : 0.35) * e });
  if (t < 1) requestAnimationFrame(fade); else document.getElementById('hint').classList.add('show');
})(t0);
setTimeout(() => document.getElementById('hint').classList.remove('show'), 9000);
