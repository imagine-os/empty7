// Graph Gallery — shared HUD + data helpers. Dependency-free ES module.

const TYPE_COLORS = { studio: '#f5b642', film: '#ff5f8f', person: '#5ec8ff', genre: '#8dff9e', award: '#e6c3ff' };
const GOLD = '#ffd166';
const FAINT = 'rgba(255,255,255,0.18)';
const RELATION_COLORS = {
  director: '#fff3e0', actor: '#5ec8ff', writer: '#b48cff', composer: '#4fd1c5', producer: '#f5b642',
  genre: FAINT, produced_by: FAINT, nominated: '#e6c3ff', won: GOLD,
};

/** Fetch data.json, add color/size to nodes, return {...d, byId, neighbors}. */
export async function loadData(url = '../../shared/data.json') {
  const d = await (await fetch(url)).json();
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  d.nodes.forEach(n => { n.color = d.meta.type_colors[n.type]; n.size = 3 + Math.sqrt(n.degree) * 2; });
  return { ...d, byId, neighbors: buildNeighbors(d.links) };
}

/** Map<id, Set<id>> adjacency from links (source/target may be ids or node objects). */
export function buildNeighbors(links) {
  const nb = new Map();
  const add = (a, b) => { if (!nb.has(a)) nb.set(a, new Set()); nb.get(a).add(b); };
  for (const l of links) {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    add(s, t); add(t, s);
  }
  return nb;
}

/** Shared edge colour semantics. Gold for won / nominee(won); role tints; faint structural edges. */
export function linkColor(link /*, byId */) {
  if (link.relation === 'won' || (link.relation === 'nominee' && link.won)) return GOLD;
  if (link.relation === 'nominee') return '#e6c3ff';
  return RELATION_COLORS[link.relation] || FAINT;
}

// ---------------------------------------------------------------------------

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function ensureStylesheet() {
  if ([...document.styleSheets].some(s => (s.href || '').includes('shared/theme.css'))) return;
  if (document.querySelector('link[href*="shared/theme.css"]')) return;
  const link = el('link'); link.rel = 'stylesheet'; link.href = '../../shared/theme.css';
  document.head.appendChild(link);
}

/**
 * Mount the shared chrome. Toggles: [{id, label, on, onChange(state)}].
 * Returns { root, showTooltip(html,x,y), hideTooltip(), setToggle(id,on), fps }.
 */
export function mountHud({
  title = 'Demo', library = '', version = '', legend = true, toggles = [],
  back = '../../index.html', typeColors = TYPE_COLORS,
} = {}) {
  ensureStylesheet();
  const root = el('div', 'hud-root');
  document.body.appendChild(root);

  // Top-left: title
  const sub = [library, version].filter(Boolean).join(' · ');
  root.appendChild(el('div', 'hud hud--tl', `<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}`));

  // Bottom-left: legend
  if (legend) {
    const lg = el('div', 'hud hud--bl legend');
    for (const [type, color] of Object.entries(typeColors)) {
      lg.appendChild(el('div', 'legend-row', `<span class="legend-dot" style="--dot:${color}"></span>${type}`));
    }
    root.appendChild(lg);
  }

  // Top-right: toggles
  const pills = new Map();
  if (toggles.length) {
    const tg = el('div', 'hud hud--tr toggles');
    for (const t of toggles) {
      const b = el('button', 'pill' + (t.on ? ' on' : ''), t.label);
      b.type = 'button';
      b.addEventListener('click', () => { const on = b.classList.toggle('on'); t.onChange?.(on); });
      pills.set(t.id, { btn: b, t });
      tg.appendChild(b);
    }
    root.appendChild(tg);
  }

  // Bottom-right: FPS (rAF-based, refreshed twice a second)
  const fpsEl = el('div', 'hud hud--br fps', '<b>—</b> fps');
  root.appendChild(fpsEl);
  const fps = { value: 0 };
  let frames = 0, last = performance.now();
  (function tick(now) {
    frames++;
    if (now - last >= 500) {
      fps.value = Math.round(frames * 1000 / (now - last));
      fpsEl.innerHTML = `<b>${fps.value}</b> fps`;
      frames = 0; last = now;
    }
    requestAnimationFrame(tick);
  })(last);

  // Back link
  if (back) { const a = el('a', 'back', '← Gallery'); a.href = back; root.appendChild(a); }

  // Tooltip
  const tip = el('div', 'tooltip');
  root.appendChild(tip);
  const showTooltip = (html, x, y) => {
    tip.innerHTML = html;
    const pad = 16, w = tip.offsetWidth || 200, h = tip.offsetHeight || 60;
    const fx = x + pad + w > innerWidth ? x - w - pad : x;
    const fy = y + pad + h > innerHeight ? y - h - pad : y;
    tip.style.left = fx + 'px'; tip.style.top = fy + 'px';
    tip.classList.add('show');
  };
  const hideTooltip = () => tip.classList.remove('show');

  const setToggle = (id, on) => {
    const p = pills.get(id); if (!p) return;
    p.btn.classList.toggle('on', !!on);
  };

  // H hides all chrome for screenshots
  addEventListener('keydown', e => {
    if (e.key === 'h' || e.key === 'H') {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      document.body.classList.toggle('hud-hidden');
    }
  });

  return { root, showTooltip, hideTooltip, setToggle, fps };
}

/** Helper to build tooltip markup: label + key/value rows. */
export function tooltipHtml(label, kv = {}) {
  const rows = Object.entries(kv).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<div class="tt-kv"><span>${k}</span><b>${v}</b></div>`).join('');
  return `<div class="tt-label">${label}</div>${rows}`;
}

// ---------------------------------------------------------------------------
// Structured group (org.json): Company -> departments -> projects -> typed leaves.

/** Distinct per-department accents (branch tint); node type is still shown by shape + type colour. */
const DEPT_HUES = ['#ff7a45', '#ffd166', '#4fd1c5', '#5ec8ff', '#b48cff', '#ff5f8f'];

/**
 * Fetch org.json and index it. Returns {...d, byId, childrenOf, deptOf(id)}.
 * Every node gets `.color` (from meta.type_colors); department nodes also get `.hue`
 * (a distinct accent from DEPT_HUES, in meta.departments order) for tinting their branch.
 */
export async function loadOrg(url = '../../shared/org.json') {
  const d = await (await fetch(url)).json();
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const childrenOf = new Map();
  for (const l of d.links) {
    if (!childrenOf.has(l.source)) childrenOf.set(l.source, []);
    childrenOf.get(l.source).push(l.target);
  }
  const depts = d.meta.departments || d.nodes.filter(n => n.type === 'department').map(n => n.id);
  d.nodes.forEach(n => {
    n.color = d.meta.type_colors[n.type];
    if (n.type === 'department') n.hue = DEPT_HUES[depts.indexOf(n.id) % DEPT_HUES.length];
  });
  const deptOf = id => { const n = byId.get(id); return n && n.department ? byId.get(n.department) : null; };
  return { ...d, byId, childrenOf, deptOf };
}

export { TYPE_COLORS, RELATION_COLORS, GOLD, FAINT, DEPT_HUES };
