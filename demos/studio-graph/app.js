/* Studio Graph — an in-browser SQLite database (sql.js) rendered as 3D graphs (3d-force-graph).
 *
 * Sections:
 *   1. Config & state          5. Query runner + result table
 *   2. Database + schema       6. Result → graph mapping (the "intelligent" link)
 *   3. Graph model (schema/data)  7. Side panel (record + relations)
 *   4. Renderer                8. UI wiring
 */
(() => {
'use strict';

/* ------------------------------------------------------------------ 1. Config & state */
const SQL_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
// Validated dark categorical palette (fixed slot order; a 9th+ table gets neutral "other").
const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_COLOR = '#7a7a80';
const PREFERRED_ORDER = ['films', 'people', 'studios', 'genres', 'awards', 'nominations', 'credits', 'film_genres'];
const DIM_NODE = 'rgba(140,140,150,0.10)';
const DIM_LINK = 'rgba(140,140,150,0.05)';
const LINK_COLOR = 'rgba(195,194,183,0.28)';
const LINK_HI = 'rgba(244,244,242,0.85)';
const LABEL_CAP = 80;             // max HTML labels drawn in data mode
const $ = (s) => document.querySelector(s);

let SQL, db, graph;
let schema = { tables: [], byName: new Map(), fkColumnTargets: new Map(), singularToTable: new Map() };
let tableColor = new Map();
let dataGraph = { nodes: [], links: [] };
let schemaGraph = { nodes: [], links: [] };
let nodeById = new Map();
let adjacency = new Map();        // node id -> Set(neighbor id)
let mode = 'data';                // 'data' | 'schema'
const state = {
  highlight: null,                // Set of node ids or null
  highlightSource: null,          // 'query' | 'search' | 'neighborhood'
  focus: false,                   // show only highlighted subgraph
  bridges: new Set(),             // non-result rows that connect 2+ result nodes (drawn dim in focus mode)
  hiddenTables: new Set(),
  selected: null,                 // node id
  hoverId: null,
  labelSet: [],                   // node ids that get an HTML label
};

/* ------------------------------------------------------------------ 2. Database + schema */
async function loadDatabase() {
  if (!SQL) SQL = await initSqlJs({ locateFile: (f) => SQL_CDN + f });
  // Standalone bundle embeds the seed in <script type="text/plain" id="seed-sql">; the folder build fetches it.
  const inline = document.getElementById('seed-sql');
  const seed = inline ? inline.textContent : await (await fetch('seed.sql')).text();
  if (db) db.close();
  db = new SQL.Database();
  db.exec(seed);
}

/** Introspect sqlite_master + PRAGMAs into a plain schema description. */
function readSchema() {
  const tables = [];
  const master = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid");
  const names = master.length ? master[0].values.map((r) => r[0]) : [];
  for (const name of names) {
    const cols = rows(`PRAGMA table_info(${qi(name)})`).map((r) => ({ cid: r[0], name: r[1], type: r[2] || '', notnull: !!r[3], dflt: r[4], pk: r[5] }));
    const fks = rows(`PRAGMA foreign_key_list(${qi(name)})`).map((r) => ({ table: r[2], from: r[3], to: r[4] }));
    const count = rows(`SELECT count(*) FROM ${qi(name)}`)[0][0];
    const pk = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    const textCols = cols.filter((c) => /CHAR|TEXT|CLOB/i.test(c.type) || c.type === '').map((c) => c.name);
    tables.push({ name, cols, fks, count, pk, textCols, labelCol: pickLabelCol(cols) });
  }
  // Resolve FK targets that omit the referenced column (defaults to the parent's PK).
  const byName = new Map(tables.map((t) => [t.name, t]));
  for (const t of tables) for (const fk of t.fks) if (!fk.to && byName.get(fk.table)) fk.to = byName.get(fk.table).pk[0] || 'rowid';
  // Which tables reference which (incoming), FK column name -> target tables, singular -> table.
  const fkColumnTargets = new Map();
  for (const t of tables) {
    t.incoming = [];
    for (const fk of t.fks) {
      if (!fkColumnTargets.has(fk.from)) fkColumnTargets.set(fk.from, new Set());
      fkColumnTargets.get(fk.from).add(fk.table);
    }
  }
  for (const t of tables) for (const fk of t.fks) byName.get(fk.table)?.incoming.push({ table: t.name, from: fk.from });
  const singularToTable = new Map();
  for (const t of tables) for (const s of singulars(t.name)) singularToTable.set(s, t.name);
  // Stable colors: preferred order first, then remaining in creation order.
  const ordered = [...PREFERRED_ORDER.filter((n) => byName.has(n)), ...tables.map((t) => t.name).filter((n) => !PREFERRED_ORDER.includes(n))];
  tableColor = new Map(ordered.map((n, i) => [n, PALETTE[i] ?? OTHER_COLOR]));
  schema = { tables, byName, fkColumnTargets, singularToTable };
}

function pickLabelCol(cols) {
  const pref = ['title', 'name', 'label', 'category'];
  for (const p of pref) { const c = cols.find((c) => c.name.toLowerCase() === p); if (c) return c.name; }
  return null;
}
function singulars(name) {
  const out = [name];
  if (name === 'people') out.push('person');
  if (name.endsWith('ies')) out.push(name.slice(0, -3) + 'y');
  if (name.endsWith('s')) out.push(name.slice(0, -1));
  return out;
}
const qi = (id) => '"' + String(id).replace(/"/g, '""') + '"';
const rows = (sql, params) => { const r = db.exec(sql, params); return r.length ? r[0].values : []; };
const dbSignature = () => rows("SELECT group_concat(sql, ';') FROM sqlite_master")[0][0] + '|' + rows('SELECT total_changes()')[0][0];

/* ------------------------------------------------------------------ 3. Graph model */
function buildGraphs() {
  const oldPos = new Map([...nodeById].map(([id, n]) => [id, [n.x, n.y, n.z]]));
  // --- data graph: one node per row, one link per FK value
  const nodes = [], links = [];
  nodeById = new Map();
  for (const t of schema.tables) {
    const idCol = t.pk.length === 1 ? t.pk[0] : null;
    let res;
    try { res = db.exec(`SELECT rowid AS __rid, * FROM ${qi(t.name)}`); } catch { res = db.exec(`SELECT NULL AS __rid, * FROM ${qi(t.name)}`); }
    if (!res.length) continue;
    const cols = res[0].columns.slice(1);
    for (const vals of res[0].values) {
      const row = {}; cols.forEach((c, i) => (row[c] = vals[i + 1]));
      const key = idCol ? row[idCol] : vals[0];
      const node = { id: `${t.name}:${key}`, table: t.name, key, row, val: 1, degree: 0, label: '' };
      const p = oldPos.get(node.id); if (p && p[0] != null) [node.x, node.y, node.z] = p;
      nodes.push(node); nodeById.set(node.id, node);
    }
  }
  adjacency = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const t of schema.tables) {
    for (const fk of t.fks) {
      for (const n of nodes) {
        if (n.table !== t.name) continue;
        const v = n.row[fk.from]; if (v == null) continue;
        const target = nodeById.get(`${fk.table}:${v}`); if (!target) continue;
        links.push({ source: n.id, target: target.id, column: fk.from, from: n.table, to: fk.table });
        adjacency.get(n.id).add(target.id); adjacency.get(target.id).add(n.id);
      }
    }
  }
  for (const n of nodes) { n.degree = adjacency.get(n.id).size; n.val = Math.max(0.8, n.degree * 0.7); n.label = labelFor(n, 0); }
  dataGraph = { nodes, links };
  // --- schema graph: one node per table
  const sNodes = schema.tables.map((t) => ({ id: t.name, table: t.name, kind: 'table', rows: t.count, val: 1 + Math.sqrt(t.count), label: t.name }));
  const sLinks = [];
  for (const t of schema.tables) for (const fk of t.fks) if (schema.byName.has(fk.table)) sLinks.push({ source: t.name, target: fk.table, column: fk.from, to: fk.to, curvature: fk.table === t.name ? 0.6 : 0 });
  schemaGraph = { nodes: sNodes, links: sLinks };
}

/** Human label for a data node: title/name column, else labels of referenced rows (junction rows), else "table #key". */
function labelFor(n, depth) {
  const t = schema.byName.get(n.table);
  if (t.labelCol && n.row[t.labelCol] != null) return String(n.row[t.labelCol]);
  if (depth < 1 && t.fks.length) {
    const refs = t.fks.map((fk) => { const r = nodeById.get(`${fk.table}:${n.row[fk.from]}`); return r ? labelFor(r, depth + 1) : null; }).filter(Boolean);
    const attr = t.cols.find((c) => !t.pk.includes(c.name) && !t.fks.some((f) => f.from === c.name) && n.row[c.name] != null && typeof n.row[c.name] === 'string');
    if (refs.length) return refs.join(' · ') + (attr ? ` (${n.row[attr.name]})` : '');
  }
  return `${t.name} #${n.key}`;
}

/* ------------------------------------------------------------------ 4. Renderer */
function createRenderer() {
  const el = $('#graph');
  graph = ForceGraph3D({ rendererConfig: { antialias: true, alpha: false } })(el)
    .backgroundColor('#141416')
    .showNavInfo(false)
    .nodeRelSize(4)
    .nodeOpacity(0.95)
    .nodeVal((n) => n.val)
    .nodeColor(nodeColor)
    .nodeLabel(tooltipFor)
    .nodeVisibility(nodeVisible)
    .linkVisibility((l) => nodeVisible(l.source) && nodeVisible(l.target))
    .linkColor(linkColor)
    .linkWidth((l) => (linkEmphasized(l) ? 1.1 : 0))
    .linkOpacity(1)
    .linkCurvature('curvature')
    .linkDirectionalArrowLength((l) => (mode === 'schema' ? 6 : linkEmphasized(l) ? 3 : 1.6))
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor(linkColor)
    .linkLabel((l) => (mode === 'schema' ? `${l.source.id}.${l.column} → ${l.target.id}.${l.to}` : `${l.from}.${l.column} → ${l.to}`))
    .onNodeClick((n) => (mode === 'schema' ? selectTable(n.id) : selectNode(n.id, { fly: false })))
    .onNodeHover((n) => { state.hoverId = n ? n.id : null; el.style.cursor = n ? 'pointer' : null; refreshLabels(); })
    .onBackgroundClick(() => { if (mode === 'data') { state.selected = null; renderSidePanel(); refreshColors(); refreshLabels(); } })
    .warmupTicks(40)
    .cooldownTime(4000)
    .onEngineStop(() => { if (fitPending) { fitPending = false; graph.zoomToFit(700, 40); } });
  const wrap = $('#graph-wrap');
  new ResizeObserver(() => graph.width(wrap.clientWidth).height(wrap.clientHeight)).observe(wrap);
  requestAnimationFrame(labelLoop);
}

const inHighlight = (id) => !state.highlight || state.highlight.has(id);
function nodeColor(n) {
  const base = tableColor.get(n.table) || OTHER_COLOR;
  if (mode === 'schema') return base;
  if (n.id === state.selected || n.id === state.hoverId) return '#ffffff';
  if (state.bridges.has(n.id)) return hexAlpha(base, 0.35);
  return inHighlight(n.id) ? base : DIM_NODE;
}
function linkEmphasized(l) {
  const s = idOf(l.source), t = idOf(l.target);
  if (state.selected && (s === state.selected || t === state.selected)) return true;
  if (!state.highlight) return false;
  const inS = state.highlight.has(s) || state.bridges.has(s), inT = state.highlight.has(t) || state.bridges.has(t);
  return inS && inT;
}
function linkColor(l) {
  if (mode === 'schema') return 'rgba(195,194,183,0.7)';
  if (linkEmphasized(l)) return LINK_HI;
  if (state.highlight && !(inHighlight(idOf(l.source)) && inHighlight(idOf(l.target)))) return DIM_LINK;
  return LINK_COLOR;
}
function nodeVisible(n) { const node = typeof n === 'object' ? n : nodeById.get(n); return node ? !state.hiddenTables.has(node.table) : true; }
const idOf = (x) => (typeof x === 'object' ? x.id : x);
const hexAlpha = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

function tooltipFor(n) {
  if (mode === 'schema') {
    const t = schema.byName.get(n.id);
    const cols = t.cols.map((c) => `<div><code>${esc(c.name)}</code> <span style="color:#898781">${esc(c.type || 'ANY')}${c.pk ? ' PK' : ''}${c.notnull ? ' NOT NULL' : ''}</span></div>`).join('');
    return `<div style="background:#1c1c1f;border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:8px 10px;font:12px system-ui;color:#f4f4f2"><b style="font-family:monospace">${esc(t.name)}</b> <span style="color:#898781">${t.count} rows</span>${cols}</div>`;
  }
  return `<div style="background:#1c1c1f;border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:5px 9px;font:12px system-ui;color:#f4f4f2"><span style="color:${tableColor.get(n.table)};font-family:monospace">${esc(n.table)}</span> ${esc(n.label)}</div>`;
}

/** Push current mode's graph to the renderer, respecting focus mode (subgraph re-layout). */
function applyGraphData() {
  let g = mode === 'schema' ? schemaGraph : dataGraph;
  state.bridges = new Set();
  if (mode === 'data' && state.focus && state.highlight) {
    // Result rows often connect only through junction rows (people — credits — films): keep any row
    // adjacent to 2+ result rows as a dim "bridge" so the answer's real shape is visible.
    for (const id of state.highlight) for (const nb of adjacency.get(id) || []) {
      if (state.highlight.has(nb) || state.bridges.has(nb)) continue;
      let hits = 0; for (const k of adjacency.get(nb)) if (state.highlight.has(k) && ++hits >= 2) break;
      if (hits >= 2) state.bridges.add(nb);
    }
    const keep = new Set([...state.highlight, ...state.bridges]);
    g = { nodes: g.nodes.filter((n) => keep.has(n.id)), links: g.links.filter((l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))) };
  }
  fitPending = true;
  graph.nodeRelSize(mode === 'schema' ? 6 : 4.5);
  // Force tuning by graph size: a 9-table schema or a focused subgraph needs far more room than 400 rows.
  const n = g.nodes.length;
  graph.d3Force('charge').strength(mode === 'schema' ? -900 : n < 60 ? -260 : n < 150 ? -150 : -40);
  graph.d3Force('link').distance(mode === 'schema' ? 110 : n < 150 ? 45 : 30);
  graph.graphData(g);              // graphData() rebuilds the layout and reheats the simulation itself
  refreshColors(); refreshLabels();
  setTimeout(() => graph.zoomToFit(600, 40), 500);     // early fit; a second fit runs when the layout settles
}
let fitPending = false;
function refreshColors() {
  graph.nodeColor(graph.nodeColor()).linkColor(graph.linkColor()).linkWidth(graph.linkWidth()).linkDirectionalArrowLength(graph.linkDirectionalArrowLength());
  graph.nodeVisibility(graph.nodeVisibility());
  const on = !!state.highlight;
  $('#btn-focus').disabled = !on || mode === 'schema';
  $('#btn-clear').disabled = !on && !state.selected;
}

// --- HTML label overlay (crisp text positioned via graph2ScreenCoords each frame)
const labelEls = new Map();
function refreshLabels() {
  const layer = $('#labels');
  let wanted = [];
  if (mode === 'schema') {
    wanted = schemaGraph.nodes.map((n) => ({ key: n.id, node: n, text: n.id, cls: 'table' }));
    schemaGraph.links.forEach((l, i) => wanted.push({ key: 'L' + i, link: l, text: l.column, cls: 'edge' }));
  } else {
    const ids = new Set();
    if (state.selected) ids.add(state.selected);
    if (state.hoverId) ids.add(state.hoverId);
    if (state.highlight && state.highlight.size <= LABEL_CAP) state.highlight.forEach((id) => ids.add(id));
    else if (state.highlight) { let i = 0; for (const id of state.highlight) { if (i++ >= LABEL_CAP) break; ids.add(id); } }
    for (const id of ids) { const n = nodeById.get(id); if (n && nodeVisible(n)) wanted.push({ key: id, node: n, text: n.label, cls: id === state.selected ? 'selected' : '' }); }
  }
  const keep = new Set(wanted.map((w) => w.key));
  for (const [k, el] of labelEls) if (!keep.has(k)) { el.remove(); labelEls.delete(k); }
  for (const w of wanted) {
    let el = labelEls.get(w.key);
    if (!el) { el = document.createElement('div'); layer.appendChild(el); labelEls.set(w.key, el); }
    el.className = 'lbl ' + w.cls; el.textContent = w.text; el._ref = w;
    if (w.node) el.style.borderLeft = `3px solid ${tableColor.get(w.node.table) || OTHER_COLOR}`;
  }
}
function labelLoop() {
  requestAnimationFrame(labelLoop);
  if (!labelEls.size || !graph) return;
  const cam = graph.camera(); const m = cam.matrixWorld.elements;
  const fwd = [-m[8], -m[9], -m[10]];
  const W = graph.width(), H = graph.height();
  for (const el of labelEls.values()) {
    const w = el._ref; let x, y, z;
    if (w.node) ({ x, y, z } = w.node); else { const s = w.link.source, t = w.link.target; if (typeof s !== 'object') continue; x = (s.x + t.x) / 2; y = (s.y + t.y) / 2; z = (s.z + t.z) / 2; }
    if (x == null) { el.style.display = 'none'; continue; }
    const dx = x - cam.position.x, dy = y - cam.position.y, dz = z - cam.position.z;
    if (dx * fwd[0] + dy * fwd[1] + dz * fwd[2] <= 0) { el.style.display = 'none'; continue; }
    const p = graph.graph2ScreenCoords(x, y, z);
    if (p.x < -50 || p.y < -20 || p.x > W + 50 || p.y > H + 20) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - (w.node ? 14 : 0)).toFixed(1)}px) translate(-50%, -50%)`;
  }
}

function flyTo(id) {
  const n = nodeById.get(id) || schemaGraph.nodes.find((x) => x.id === id);
  if (!n || n.x == null) return;
  const dist = mode === 'schema' ? 160 : 90;
  const r = Math.hypot(n.x, n.y, n.z) || 1; const k = 1 + dist / r;
  graph.cameraPosition({ x: n.x * k, y: n.y * k, z: n.z * k }, n, 900);
}

/* ------------------------------------------------------------------ 5. Query runner + results */
const PRESETS = [
  { name: 'Co-stars who appeared together in 2+ films (self-join, GROUP BY, HAVING)', sql:
`-- Pairs of actors credited together in at least two films
SELECT a.person_id            AS person_id,
       pa.name                AS actor,
       b.person_id            AS costar_person_id,
       pb.name                AS costar,
       COUNT(*)               AS films_together,
       group_concat(f.title, ' | ') AS films
FROM credits a
JOIN credits b  ON b.film_id = a.film_id AND b.person_id > a.person_id AND b.role = 'actor'
JOIN people pa  ON pa.id = a.person_id
JOIN people pb  ON pb.id = b.person_id
JOIN films f    ON f.id = a.film_id
WHERE a.role = 'actor'
GROUP BY a.person_id, b.person_id
HAVING COUNT(*) >= 2
ORDER BY films_together DESC, actor;` },
  { name: 'Directors ranked by total gross (join + aggregate)', sql:
`SELECT p.id                       AS person_id,
       p.name                     AS director,
       COUNT(*)                   AS films,
       ROUND(SUM(f.gross_musd),1) AS total_gross_musd,
       ROUND(AVG(f.gross_musd / f.budget_musd), 2) AS avg_return
FROM credits c
JOIN people p ON p.id = c.person_id
JOIN films  f ON f.id = c.film_id
WHERE c.role = 'director'
GROUP BY p.id
ORDER BY total_gross_musd DESC;` },
  { name: 'Films with nominations but no wins (subquery)', sql:
`SELECT f.id AS film_id, f.title, f.year, s.name AS studio,
       (SELECT COUNT(*) FROM nominations n WHERE n.film_id = f.id) AS nominations
FROM films f
JOIN studios s ON s.id = f.studio_id
WHERE EXISTS (SELECT 1 FROM nominations n WHERE n.film_id = f.id)
  AND NOT EXISTS (SELECT 1 FROM nominations n WHERE n.film_id = f.id AND n.won = 1)
ORDER BY nominations DESC, f.year;` },
  { name: 'Top 2 grossing films per studio (window function)', sql:
`WITH ranked AS (
  SELECT f.id AS film_id, f.title, f.year, f.gross_musd, f.studio_id,
         RANK() OVER (PARTITION BY f.studio_id ORDER BY f.gross_musd DESC) AS rank_in_studio
  FROM films f
)
SELECT s.id AS studio_id, s.name AS studio, r.rank_in_studio, r.film_id, r.title, r.year, r.gross_musd
FROM ranked r JOIN studios s ON s.id = r.studio_id
WHERE r.rank_in_studio <= 2
ORDER BY s.name, r.rank_in_studio;` },
  { name: "Everyone who worked on an Okonkwo-Reyes film (CTE, many-to-many)", sql:
`WITH her_films AS (
  SELECT c.film_id FROM credits c JOIN people p ON p.id = c.person_id
  WHERE p.name = 'Ines Okonkwo-Reyes' AND c.role = 'director'
)
SELECT p.id AS person_id, p.name, c.role, f.id AS film_id, f.title, c.character
FROM credits c
JOIN her_films h ON h.film_id = c.film_id
JOIN people p ON p.id = c.person_id
JOIN films  f ON f.id = c.film_id
WHERE p.name <> 'Ines Okonkwo-Reyes'
ORDER BY p.name, f.year;` },
  { name: 'Award winners and their winning films', sql:
`SELECT a.name AS award, a.category, n.year,
       f.id AS film_id, f.title,
       n.person_id, p.name AS recipient
FROM nominations n
JOIN awards a ON a.id = n.award_id
JOIN films  f ON f.id = n.film_id
LEFT JOIN people p ON p.id = n.person_id
WHERE n.won = 1
ORDER BY n.year, a.category;` },
  { name: 'Multi-hyphenates: people credited in 2+ distinct roles', sql:
`SELECT p.id AS person_id, p.name, COUNT(DISTINCT c.role) AS roles,
       group_concat(DISTINCT c.role) AS role_list, COUNT(DISTINCT c.film_id) AS films
FROM people p JOIN credits c ON c.person_id = p.id
GROUP BY p.id
HAVING COUNT(DISTINCT c.role) >= 2
ORDER BY roles DESC, films DESC;` },
  { name: 'Genre share by decade (pure aggregate, no ids → table only)', sql:
`SELECT (f.year / 10) * 10 AS decade, g.name AS genre, COUNT(*) AS films,
       ROUND(AVG(f.gross_musd / f.budget_musd), 2) AS avg_return
FROM films f
JOIN film_genres fg ON fg.film_id = f.id
JOIN genres g ON g.id = fg.genre_id
GROUP BY decade, g.name
ORDER BY decade, films DESC;` },
  { name: 'Nordic films: joined to studios and genres (list, dim the rest)', sql:
`SELECT f.id, f.title, f.year, s.name AS studio, group_concat(g.name, ', ') AS genres
FROM films f
JOIN studios s ON s.id = f.studio_id
JOIN film_genres fg ON fg.film_id = f.id
JOIN genres g ON g.id = fg.genre_id
WHERE s.country IN ('Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland')
GROUP BY f.id
ORDER BY f.year;` },
  { name: 'Schema change: CREATE TABLE + INSERT (graph rebuilds)', sql:
`CREATE TABLE IF NOT EXISTS soundtracks (
  id INTEGER PRIMARY KEY,
  film_id INTEGER NOT NULL REFERENCES films(id),
  composer_id INTEGER REFERENCES people(id),
  title TEXT NOT NULL,
  tracks INTEGER
);
INSERT OR IGNORE INTO soundtracks (id, film_id, composer_id, title, tracks) VALUES
  (1, 13, 34, 'Hemisphere (Original Score)', 18),
  (2, 4,  33, 'A Lantern for Ghosts: Songs', 11),
  (3, 25, 34, 'Gravity Well: Orbital Suite', 22);
SELECT st.id, st.title, f.title AS film, p.name AS composer, st.tracks
FROM soundtracks st JOIN films f ON f.id = st.film_id LEFT JOIN people p ON p.id = st.composer_id;` },
];

let lastMapping = null; // { colMaps, rowNodeIds }

function runQuery(text) {
  text = (text || '').trim();
  if (!text) return;
  const before = dbSignature();
  let results;
  try { results = db.exec(text); }
  catch (e) { showError(e.message); return; }
  const changed = dbSignature() !== before;
  if (changed) rebuildFromDb({ keepView: true });
  const last = results[results.length - 1];
  if (!last) {
    $('#results').innerHTML = `<div class="meta">Statement executed${changed ? ' — database changed, graph rebuilt' : ''}. 0 rows returned.</div>`;
    clearHighlight(); setExplain('');
    return;
  }
  const mapping = mapResult(last, text);
  renderResults(last, mapping, changed);
  applyMapping(mapping);
}
function showError(msg) {
  $('#results').innerHTML = `<div class="meta">Error</div><div class="error">${esc(msg)}</div>`;
  setStatus('query failed');
}
function renderResults(res, mapping, changed) {
  const cols = res.columns, vals = res.values;
  const mapByCol = new Map(mapping.colMaps.map((m) => [m.col, m]));
  let html = `<div class="meta"><span>${vals.length} row${vals.length === 1 ? '' : 's'}</span><span>${cols.length} columns</span>${changed ? '<span>database changed → graph rebuilt</span>' : ''}${mapping.rowNodeIds.some((r) => r.length) ? '<span>click a row to open it in the graph</span>' : ''}</div>`;
  html += '<table class="grid"><thead><tr>' + cols.map((c) => `<th>${esc(c)}${mapByCol.has(c) ? `<span class="map" title="mapped to ${esc(mapByCol.get(c).table)} nodes">↗ ${esc(mapByCol.get(c).table)}</span>` : ''}</th>`).join('') + '</tr></thead><tbody>';
  const limit = Math.min(vals.length, 500);
  for (let r = 0; r < limit; r++) {
    const ids = mapping.rowNodeIds[r];
    html += `<tr class="${ids.length ? 'row' : ''}" data-ids="${esc(ids.join(' '))}" ${ids.length ? 'tabindex="0"' : ''}>` + vals[r].map((v) => v == null ? '<td class="null">NULL</td>' : typeof v === 'number' ? `<td class="num">${fmtNum(v)}</td>` : `<td title="${esc(String(v))}">${esc(String(v))}</td>`).join('') + '</tr>';
  }
  html += '</tbody></table>' + (vals.length > limit ? `<div class="meta">… ${vals.length - limit} more rows not shown</div>` : '');
  $('#results').innerHTML = html;
}
const fmtNum = (v) => Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 3 });

/* ------------------------------------------------------------------ 6. Result → graph mapping */
/**
 * Decide, for each result column, which table's nodes its values identify.
 * Order of evidence: FK column names (film_id → films), `<singular>_id`, `<table>.id`/`<table>_id`,
 * bare `id` (resolved by the tables named in the SQL, then by PK-value matching),
 * and finally text columns whose every value is a known label (title → films, director → people).
 */
function mapResult(res, sqlText) {
  const cols = res.columns, vals = res.values;
  const textLower = sqlText.toLowerCase();
  const tablesInQuery = schema.tables.filter((t) => new RegExp(`\\b${t.name}\\b`, 'i').test(textLower)).map((t) => t.name);
  const fromMatch = textLower.match(/\bfrom\s+"?([a-z_][a-z0-9_]*)"?/);      // the query's primary table (first FROM)
  const primaryTable = fromMatch && schema.byName.has(fromMatch[1]) ? fromMatch[1] : null;
  const entityTables = schema.tables.filter((t) => t.pk.length === 1);       // value-matching only against real single-column PKs
  const pkSets = new Map(entityTables.map((t) => [t.name, new Set(dataGraph.nodes.filter((n) => n.table === t.name).map((n) => n.key))]));
  const labelSets = new Map(schema.tables.filter((t) => t.labelCol).map((t) => [t.name, new Map(dataGraph.nodes.filter((n) => n.table === t.name).map((n) => [String(n.label).toLowerCase(), n.key]))]));
  const colMaps = [], notes = [];

  cols.forEach((col, ci) => {
    const values = [...new Set(vals.map((r) => r[ci]).filter((v) => v != null))];
    if (!values.length) return;
    const lc = col.toLowerCase();
    const allInts = values.every((v) => Number.isInteger(v) || /^\d+$/.test(String(v)));
    const pkOk = (t) => pkSets.has(t) && values.every((v) => pkSets.get(t).has(typeof v === 'string' ? Number(v) : v) || pkSets.get(t).has(v));
    let candidates = [];
    if (allInts) {
      // (a) exact / suffix match on a known FK column name: person_id, costar_person_id
      for (const [fkCol, targets] of schema.fkColumnTargets) if (lc === fkCol.toLowerCase() || lc.endsWith('_' + fkCol.toLowerCase())) candidates.push(...targets);
      // (b) <singular>_id / <table>_id / <table>.id
      const m = lc.match(/^(?:.*?[._])?([a-z_]+?)[._]?id$/);
      if (m && schema.singularToTable.has(m[1])) candidates.push(schema.singularToTable.get(m[1]));
      candidates = [...new Set(candidates)].filter(pkOk);
      // (c) bare id / *_id with no name evidence: tables named in the query whose PK set contains every value
      if (!candidates.length && /(^|[._])id$/.test(lc)) {
        const inQ = tablesInQuery.filter(pkOk);
        if (inQ.length === 1) candidates = inQ;
        else if (inQ.length > 1) { if (primaryTable && inQ.includes(primaryTable)) candidates = [primaryTable]; else notes.push(`“${col}” is ambiguous (${inQ.join(', ')})`); }
        else { const any = entityTables.map((t) => t.name).filter(pkOk); if (any.length === 1) candidates = any; }
      }
      if (candidates.length) {
        const table = candidates.find((t) => tablesInQuery.includes(t)) || candidates[0];
        colMaps.push({ col, ci, table, kind: 'pk', toKey: (v) => (typeof v === 'string' ? Number(v) : v) });
      }
    } else if (values.every((v) => typeof v === 'string')) {
      // (d) label matching: every value is the title/name of a row in exactly one table
      const hits = [...labelSets].filter(([, set]) => values.every((v) => set.has(v.toLowerCase()))).map(([t]) => t);
      const pick = hits.length === 1 ? hits[0] : hits.find((t) => tablesInQuery.includes(t) && hits.filter((h) => tablesInQuery.includes(h)).length === 1);
      if (pick) colMaps.push({ col, ci, table: pick, kind: 'label', toKey: (v) => labelSets.get(pick).get(v.toLowerCase()) });
    }
  });

  const rowNodeIds = vals.map((r) => [...new Set(colMaps.map((m) => (r[m.ci] == null ? null : `${m.table}:${m.toKey(r[m.ci])}`)).filter((id) => id && nodeById.has(id)))]);
  return { colMaps, rowNodeIds, notes };
}

function applyMapping(mapping) {
  lastMapping = mapping;
  const ids = new Set(mapping.rowNodeIds.flat());
  if (!mapping.colMaps.length) {
    clearHighlight();
    setExplain(`No id or name columns recognized — aggregate result, table only.${mapping.notes.length ? ' ' + mapping.notes.join('; ') + '.' : ''}`);
    return;
  }
  if (!ids.size) { clearHighlight(); setExplain('Mapped columns found but no rows matched graph nodes.'); return; }
  const counts = {};
  for (const id of ids) { const t = nodeById.get(id).table; counts[t] = (counts[t] || 0) + 1; }
  const parts = Object.entries(counts).map(([t, c]) => `<b>${c}</b> ${esc(t)}`);
  const via = [...new Set(mapping.colMaps.map((m) => `${m.col} → ${m.table}`))].join(', ');
  state.highlight = ids; state.highlightSource = 'query';
  if (mode === 'data') { if (state.focus) applyGraphData(); else { refreshColors(); refreshLabels(); } }
  setExplain(`Highlighted ${parts.join(', ')} from the result <span style="color:#898781">(${esc(via)})</span>${mapping.notes.length ? ` · ${esc(mapping.notes.join('; '))}` : ''}`);
}

function clearHighlight() {
  const hadFocus = state.focus;
  state.highlight = null; state.highlightSource = null; state.focus = false;
  $('#btn-focus').setAttribute('aria-pressed', 'false');
  if (hadFocus) applyGraphData(); else { refreshColors(); refreshLabels(); }
}
function setExplain(html) { const el = $('#explain'); el.innerHTML = html; el.classList.toggle('show', !!html); }

/* ------------------------------------------------------------------ 7. Side panel */
function selectNode(id, { fly = true } = {}) {
  const n = nodeById.get(id); if (!n) return;
  state.selected = id;
  if (mode !== 'data') setMode('data');
  if (state.focus && state.highlight && !state.highlight.has(id)) { state.highlight.add(id); applyGraphData(); }
  refreshColors(); refreshLabels(); renderSidePanel();
  if (fly) flyTo(id);
  document.querySelectorAll('#results tr.selected').forEach((tr) => tr.classList.remove('selected'));
  document.querySelectorAll(`#results tr.row`).forEach((tr) => { if (tr.dataset.ids.split(' ').includes(id)) tr.classList.add('selected'); });
}

function renderSidePanel() {
  const side = $('#side');
  const n = state.selected && nodeById.get(state.selected);
  if (!n) { side.innerHTML = '<div class="empty">Click a node in the graph, or a row in a result, to see the full record and everything related to it.</div>'; return; }
  const t = schema.byName.get(n.table);
  const color = tableColor.get(n.table) || OTHER_COLOR;
  let html = `<div class="node-head"><span class="swatch" style="background:${color}"></span><span class="pill">${esc(n.table)}</span><span class="pill" style="background:transparent;color:#898781">${n.degree} link${n.degree === 1 ? '' : 's'}</span></div>`;
  html += `<h2 style="margin:0 0 4px;font-size:17px">${esc(n.label)}</h2>`;
  html += `<div class="node-actions"><button id="btn-neigh" class="primary" title="Focus the graph on this node and its 1- and 2-hop neighbours">Show neighborhood</button><button id="btn-flyto">Fly to</button><button id="btn-rowsql" title="Put a query for this row in the editor">Query row</button></div>`;
  // full row, FK columns rendered as links
  html += '<dl class="row-fields">';
  for (const c of t.cols) {
    const v = n.row[c.name]; const fk = t.fks.find((f) => f.from === c.name);
    let val = v == null ? '<span style="color:#898781">NULL</span>' : esc(String(v));
    if (fk && v != null) { const ref = nodeById.get(`${fk.table}:${v}`); if (ref) val = `<span class="fkref" data-id="${esc(ref.id)}" tabindex="0" role="link">${esc(ref.label)}</span> <span style="color:#898781">(${esc(fk.table)} #${esc(String(v))})</span>`; }
    html += `<dt>${esc(c.name)}</dt><dd>${val}</dd>`;
  }
  html += '</dl>';
  // related rows grouped by incoming relationship
  for (const inc of t.incoming) {
    const ct = schema.byName.get(inc.table);
    const related = dataGraph.nodes.filter((m) => m.table === inc.table && m.row[inc.from] === n.key);
    html += `<div class="rel-group"><h3><span class="swatch" style="background:${tableColor.get(inc.table)}"></span>${esc(inc.table)} <code>via ${esc(inc.from)}</code> <span style="color:#898781;font-weight:400">${related.length}</span></h3>`;
    const shown = related.slice(0, 200);
    for (const m of shown) {
      const chips = ct.fks.filter((f) => f.from !== inc.from).map((f) => { const r = nodeById.get(`${f.table}:${m.row[f.from]}`); return r ? `<span class="chip" data-id="${esc(r.id)}" role="link" tabindex="0" title="${esc(f.table)}">${esc(r.label)}</span>` : ''; }).filter(Boolean);
      const attrs = ct.cols.filter((c) => !ct.pk.includes(c.name) && !ct.fks.some((f) => f.from === c.name) && m.row[c.name] != null && c.name !== ct.labelCol).map((c) => `<em>${esc(c.name)}</em> ${esc(String(m.row[c.name]))}`);
      const title = ct.labelCol && m.row[ct.labelCol] != null ? `<span>${esc(String(m.row[ct.labelCol]))}</span>` : '';
      html += `<div class="rel-row compact" data-id="${esc(m.id)}" tabindex="0" role="button">${title}${chips.join(' <span style="color:#898781">·</span> ')}${attrs.length ? ` <span class="attr">${attrs.join(' · ')}</span>` : ''}</div>`;
    }
    if (related.length > shown.length) html += `<div class="rel-row" style="color:#898781">… ${related.length - shown.length} more</div>`;
    html += '</div>';
  }
  if (!t.incoming.length && !t.fks.length) html += '<div class="empty">This table has no foreign keys in either direction.</div>';
  side.innerHTML = html;
  side.querySelector('#btn-neigh').onclick = () => showNeighborhood(n.id);
  side.querySelector('#btn-flyto').onclick = () => flyTo(n.id);
  side.querySelector('#btn-rowsql').onclick = () => { $('#sql').value = `SELECT * FROM ${qi(t.name)} WHERE ${t.pk.length === 1 ? qi(t.pk[0]) : 'rowid'} = ${typeof n.key === 'number' ? n.key : `'${String(n.key).replace(/'/g, "''")}'`};`; runQuery($('#sql').value); };
  side.querySelectorAll('[data-id]').forEach((el) => {
    const go = (e) => { e.stopPropagation(); selectNode(el.dataset.id); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
  });
  side.scrollTop = 0;
}

function showNeighborhood(id) {
  const hop1 = new Set(adjacency.get(id) || []);
  const hop2 = new Set();
  for (const h of hop1) for (const k of adjacency.get(h) || []) if (k !== id && !hop1.has(k)) hop2.add(k);
  const all = new Set([id, ...hop1, ...hop2]);
  state.highlight = all; state.highlightSource = 'neighborhood'; state.focus = true;
  $('#btn-focus').setAttribute('aria-pressed', 'true');
  applyGraphData();
  setExplain(`Neighborhood of <b>${esc(nodeById.get(id).label)}</b>: ${hop1.size} direct neighbours, ${hop2.size} at two hops (${all.size} nodes shown).`);
}

/** Schema mode: clicking a table runs SELECT * … LIMIT 50 and shows its definition. */
function selectTable(name) {
  const t = schema.byName.get(name); if (!t) return;
  $('#sql').value = `SELECT * FROM ${qi(name)} LIMIT 50;`;
  runQuery($('#sql').value);
  document.querySelectorAll('.table-item').forEach((el) => el.classList.toggle('active', el.dataset.table === name));
  const side = $('#side');
  side.innerHTML = `<div class="node-head"><span class="swatch" style="background:${tableColor.get(name)}"></span><h2 style="font-family:var(--mono)">${esc(name)}</h2><span class="pill">${t.count} rows</span></div>
    <dl class="row-fields">${t.cols.map((c) => `<dt>${esc(c.name)}${c.pk ? ' <span style="color:#c98500">PK</span>' : ''}</dt><dd>${esc(c.type || 'ANY')}${c.notnull ? ' <span style="color:#898781">NOT NULL</span>' : ''}${t.fks.some((f) => f.from === c.name) ? ` <span style="color:#898781">→ ${esc(t.fks.find((f) => f.from === c.name).table)}</span>` : ''}</dd>`).join('')}</dl>
    ${t.incoming.length ? `<div class="rel-group"><h3>Referenced by</h3>${t.incoming.map((i) => `<div class="rel-row compact" style="cursor:default"><code>${esc(i.table)}.${esc(i.from)}</code></div>`).join('')}</div>` : ''}`;
}

/* ------------------------------------------------------------------ 8. UI wiring */
function renderSchemaSidebar() {
  const list = $('#table-list');
  list.innerHTML = schema.tables.map((t) => `
    <div class="table-item" data-table="${esc(t.name)}" tabindex="0" role="button" title="SELECT * FROM ${esc(t.name)} LIMIT 50">
      <div class="th"><span class="swatch" style="background:${tableColor.get(t.name)}"></span><span class="tname">${esc(t.name)}</span><span class="count">${t.count}</span></div>
      ${t.fks.length ? `<div class="fks">${t.fks.map((f) => `<div>${esc(f.from)} <span class="arrow">→</span> ${esc(f.table)}.${esc(f.to)}</div>`).join('')}</div>` : ''}
    </div>`).join('');
  list.querySelectorAll('.table-item').forEach((el) => {
    const go = () => selectTable(el.dataset.table);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $('#legend').innerHTML = schema.tables.map((t) => `<button data-table="${esc(t.name)}" aria-pressed="${state.hiddenTables.has(t.name) ? 'false' : 'true'}" title="Toggle ${esc(t.name)} nodes"><span class="swatch" style="background:${tableColor.get(t.name)}"></span>${esc(t.name)} <span style="color:#898781">${t.count}</span></button>`).join('');
  $('#legend').querySelectorAll('button').forEach((b) => b.onclick = () => {
    const name = b.dataset.table;
    if (state.hiddenTables.has(name)) state.hiddenTables.delete(name); else state.hiddenTables.add(name);
    b.setAttribute('aria-pressed', state.hiddenTables.has(name) ? 'false' : 'true');
    refreshColors(); refreshLabels();
  });
  const totalRows = schema.tables.reduce((s, t) => s + t.count, 0);
  setStatus(`${schema.tables.length} tables · ${totalRows} rows · ${dataGraph.links.length} FK edges`);
}

function rebuildFromDb({ keepView = false } = {}) {
  readSchema();
  buildGraphs();
  if (state.selected && !nodeById.has(state.selected)) state.selected = null;
  if (state.highlight) { for (const id of [...state.highlight]) if (!nodeById.has(id)) state.highlight.delete(id); if (!state.highlight.size) { state.highlight = null; state.focus = false; } }
  renderSchemaSidebar();
  applyGraphData();
  if (!keepView) renderSidePanel(); else if (state.selected) renderSidePanel();
}

function setMode(m) {
  mode = m;
  $('#mode-schema').setAttribute('aria-pressed', String(m === 'schema'));
  $('#mode-data').setAttribute('aria-pressed', String(m === 'data'));
  $('#legend').style.display = m === 'schema' ? 'none' : '';
  applyGraphData();
  if (m === 'schema') setTimeout(() => graph.zoomToFit(700, 80), 500);
}

function setStatus(s) { $('#status').textContent = s; }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- search
let searchMatches = [], searchIdx = 0;
function doSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) { if (state.highlightSource === 'search') { clearHighlight(); setExplain(''); } searchMatches = []; return; }
  searchMatches = dataGraph.nodes.filter((n) => nodeVisible(n) && n.label.toLowerCase().includes(q))
    .sort((a, b) => (schema.byName.get(a.table).labelCol ? 0 : 1) - (schema.byName.get(b.table).labelCol ? 0 : 1)
      || (a.label.toLowerCase().startsWith(q) ? 0 : 1) - (b.label.toLowerCase().startsWith(q) ? 0 : 1) || a.label.length - b.label.length);
  searchIdx = 0;
  if (mode !== 'data') setMode('data');
  if (state.focus) { state.focus = false; $('#btn-focus').setAttribute('aria-pressed', 'false'); state.highlight = null; applyGraphData(); }
  state.highlight = searchMatches.length ? new Set(searchMatches.map((n) => n.id)) : new Set(); state.highlightSource = 'search';
  refreshColors(); refreshLabels();
  setExplain(searchMatches.length ? `<b>${searchMatches.length}</b> node${searchMatches.length === 1 ? '' : 's'} match “${esc(q)}” — Enter cycles matches` : `No nodes match “${esc(q)}”`);
  if (searchMatches.length) flyTo(searchMatches[0].id);
}

function wireUI() {
  const presets = $('#presets');
  PRESETS.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p.name; presets.appendChild(o); });
  presets.onchange = () => { if (presets.value === '') return; $('#sql').value = PRESETS[presets.value].sql; runQuery($('#sql').value); };
  $('#btn-run').onclick = () => runQuery($('#sql').value);
  $('#sql').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery($('#sql').value); } });
  $('#mode-schema').onclick = () => setMode('schema');
  $('#mode-data').onclick = () => setMode('data');
  $('#btn-rebuild').onclick = () => { rebuildFromDb({ keepView: true }); setExplain('Graph rebuilt from the live database.'); };
  $('#btn-reset').onclick = async () => { setStatus('resetting…'); await loadDatabase(); state.selected = null; state.hiddenTables.clear(); clearHighlight(); rebuildFromDb(); setExplain('Database reset to seed data.'); $('#results').innerHTML = '<div class="meta">Results appear here.</div>'; };
  $('#btn-fit').onclick = () => graph.zoomToFit(700, 40);
  $('#btn-clear').onclick = () => { state.selected = null; clearHighlight(); setExplain(''); renderSidePanel(); $('#search').value = ''; document.querySelectorAll('#results tr.selected').forEach((tr) => tr.classList.remove('selected')); };
  $('#btn-focus').onclick = () => {
    if (!state.highlight) return;
    state.focus = !state.focus;
    $('#btn-focus').setAttribute('aria-pressed', String(state.focus));
    applyGraphData();
    const ex = $('#explain'); ex.innerHTML = ex.innerHTML.replace(/ · <i>.*<\/i>$/, '');
    if (state.focus) ex.innerHTML += ` · <i>focused: ${state.highlight.size} result rows${state.bridges.size ? ` + ${state.bridges.size} connecting rows (dimmed)` : ''}</i>`;
  };
  // result rows → node
  $('#results').addEventListener('click', (e) => { const tr = e.target.closest('tr.row'); if (tr) selectNode(tr.dataset.ids.split(' ')[0]); });
  $('#results').addEventListener('keydown', (e) => { const tr = e.target.closest('tr.row'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectNode(tr.dataset.ids.split(' ')[0]); } });
  // search
  let timer; const search = $('#search');
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch(search.value), 160); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter' && searchMatches.length) { searchIdx = (searchIdx + 1) % searchMatches.length; flyTo(searchMatches[searchIdx].id); } });
  // global keys
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); search.select(); }
    if (e.key === 'Escape') { if (!$('#hint').hidden) { $('#hint').hidden = true; return; } if (typing) document.activeElement.blur(); else $('#btn-clear').click(); }
    if (!typing && (e.key === '1' || e.key === '2')) setMode(e.key === '1' ? 'schema' : 'data');
  });
  // first-load hint
  let seen = false; try { seen = localStorage.getItem('studio-graph-hint') === '1'; } catch {}
  $('#hint').hidden = seen;
  const closeHint = () => { $('#hint').hidden = true; try { localStorage.setItem('studio-graph-hint', '1'); } catch {} };
  $('#hint-close').onclick = closeHint;
  $('#hint').addEventListener('click', (e) => { if (e.target === $('#hint')) closeHint(); });
  $('#btn-help').onclick = () => { $('#hint').hidden = false; };
}

async function boot() {
  wireUI();
  try {
    if (typeof initSqlJs !== 'function') throw new Error('sql.js failed to load from the CDN.');
    if (typeof ForceGraph3D !== 'function') throw new Error('3d-force-graph failed to load from the CDN.');
    await loadDatabase();
    createRenderer();
    rebuildFromDb();
    $('#loading').hidden = true;
    $('#sql').value = PRESETS[0].sql;
    setExplain('Ready. Run a query (Ctrl/⌘+Enter) or pick a preset — matching rows light up in the graph.');
  } catch (e) {
    $('#loading').textContent = 'Failed to start: ' + e.message;
    console.error(e);
  }
}
boot();
window.__studioGraph = { state, get graph() { return graph; }, get nodeById() { return nodeById; }, get schema() { return schema; } }; // for tests/console
})();
