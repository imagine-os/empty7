// sunburst-business — six-ring zoomable business model: units → lines/departments → products → sub-products → offerings.
import { mountHud, tooltipHtml } from '../../shared/hud.js';

const data = await (await fetch('../../shared/business.json')).json();
const { meta } = data, TH = meta.thresholds;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const state = { size: 'revenue', color: 'unit', gaps: true, hover: null, matches: null, filter: null };
const svg = d3.select('#c');
const gRoot = svg.append('g'), gArcs = gRoot.append('g'), gLabels = gRoot.append('g'), gCentre = gRoot.append('g').attr('class', 'centre');

// ------------------------------------------------------------------ formatting + scales
const money = v => v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : v >= 100 ? `$${v.toFixed(0)}M` : v >= 10 ? `$${v.toFixed(1)}M` : `$${v.toFixed(2)}M`;
const int = v => d3.format(',')(Math.round(v)), pct = v => `${v.toFixed(1)}%`, spct = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const SIZES = { revenue: [d => d.revenue, money], cost: [d => d.cost, money], headcount: [d => d.headcount, int], customers: [d => d.customers, int], equal: [() => 1, v => `${int(v)} leaves`] };
const COLORS = ['unit', 'margin', 'growth', 'stage', 'health'];
const marginScale = d3.scaleDiverging([TH.company_margin - TH.margin_range, TH.company_margin, TH.company_margin + TH.margin_range], d3.interpolateRdYlGn).clamp(true);
const growthScale = d3.scaleDiverging([TH.company_growth - TH.growth_range, TH.company_growth, TH.company_growth + TH.growth_range], d3.interpolateRdYlGn).clamp(true);
const healthScale = d3.scaleSequential(TH.health_range, d3.interpolateRgbBasis(['#4a1942', '#b48cff', '#5ec8ff', '#8dff9e'])).clamp(true);
const unitColor = d => d3.interpolateLab(d3.color(d.hue).darker(.3), d3.color(d.hue).brighter(1.15))((d.depth - 1) / 5);
const fill = d => state.color === 'unit' ? unitColor(d) : state.color === 'margin' ? marginScale(d.node.margin) : state.color === 'growth' ? growthScale(d.node.growth)
  : state.color === 'stage' ? meta.stage_colors[d.node.stage] : healthScale(d.node.health);
const shade = v => state.color === 'margin' ? marginScale(v) : growthScale(v);

// ------------------------------------------------------------------ hierarchy + partition (gap wedges between business units)
const root = d3.hierarchy(data.tree);
root.each(d => { d.id = d.data.id; d.node = d.data; d.unit = d.depth === 1 ? d : d.depth > 1 ? d.parent.unit : null; d.hue = d.unit ? d.unit.node.hue : '#ffffff'; });
const nodes = root.descendants().filter(d => d.depth > 0), byId = new Map(root.descendants().map(d => [d.id, d]));
let focus = root;
function partitionLayout() {
  root.sum(d => d.children ? 0 : SIZES[state.size][0](d));
  d3.partition().size([TAU, root.height + 1])(root);
  const gap = (state.gaps ? 6 : 0.5) * DEG;
  for (const u of root.children) {
    const X0 = u.x0, X1 = u.x1, n0 = X0 + gap / 2, n1 = X1 - gap / 2, f = x => n0 + (x - X0) / (X1 - X0) * (n1 - n0);
    u.each(d => { d.x0 = f(d.x0); d.x1 = f(d.x1); });
  }
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const targetOf = (d, p) => ({ x0: clamp01((d.x0 - p.x0) / (p.x1 - p.x0)) * TAU, x1: clamp01((d.x1 - p.x0) / (p.x1 - p.x0)) * TAU,
  y0: Math.max(0, d.y0 - p.depth), y1: Math.max(0, d.y1 - p.depth), h: Math.max(1, p.height) });

// ------------------------------------------------------------------ geometry: level-of-detail ring widths (outer rings thin until zoomed)
let W = innerWidth, H = innerHeight, R, r0, cx;
const RW = [1, 1, .85, .62, .45, .34];
const cum = y => { const i = Math.min(RW.length - 1, Math.floor(y)); return d3.sum(RW.slice(0, i)) + (y - i) * RW[i]; };
const radius = (y, h) => y <= 1 ? y * r0 : r0 + cum(y - 1) / cum(h) * (R - r0);
const arc = d3.arc().startAngle(c => c.x0).endAngle(c => c.x1).padAngle(c => Math.min((c.x1 - c.x0) / 2, 0.003)).padRadius(() => R)
  .innerRadius(c => radius(c.y0, c.h) + .8).outerRadius(c => radius(c.y1, c.h) - 1.2);
const visible = c => c.y1 <= c.h + 1 && c.y0 >= 1 && c.x1 > c.x0 + 1e-4;
const midR = c => (radius(c.y0, c.h) + radius(c.y1, c.h)) / 2;
const widthPx = c => (c.x1 - c.x0) * midR(c);
const thick = c => radius(c.y1, c.h) - radius(c.y0, c.h), textW = d => d.node.label.length * (d.depth === 1 ? 9.6 : 6.3);
const tangential = c => widthPx(c) > thick(c);   // wide inner arcs read along the arc, narrow outer arcs read radially
const labelT = (d, c) => { const a = (c.x0 + c.x1) / 2 / DEG, r = midR(c);
  return d.tang ? `rotate(${a}) translate(0,${-r}) rotate(${a > 90 && a < 270 ? 180 : 0})` : `rotate(${a - 90}) translate(${r},0) rotate(${a < 180 ? 0 : 180})`; };
const labelOk = (d, c) => visible(c) && (d.tang ? textW(d) < widthPx(c) * .85 && thick(c) > 14 : widthPx(c) > 12 && textW(d) < thick(c) - 8);
const alphaOf = c => c.y0 <= 3 ? .92 : c.y0 <= 4 ? .78 : .62;
const pathOf = d => d.ancestors().reverse().map(a => a.node.label).join(' › ');

// ------------------------------------------------------------------ build once
partitionLayout();
const arcs = gArcs.selectAll('path').data(nodes).join('path').attr('class', d => `arc ${d.node.type}`).attr('fill', fill)
  .on('pointerenter', (e, d) => hover(d, e)).on('pointermove', e => state.hover && hud.showTooltip(tipHtml(state.hover), e.clientX, e.clientY))
  .on('pointerleave', () => hover(null)).on('click', (e, d) => { e.stopPropagation(); zoomTo(d.children ? d : d.parent); });
const labels = gLabels.selectAll('text').data(nodes).join('text').attr('class', d => 'label ' + d.node.type).attr('text-anchor', 'middle').attr('dy', '0.35em').text(d => d.node.label);
gCentre.append('circle').on('click', () => zoomTo(focus.parent || root));
gCentre.append('path').attr('class', 'spark-area'); gCentre.append('path').attr('class', 'spark');
gCentre.append('text').attr('class', 'c-sub').attr('y', -46); gCentre.append('text').attr('class', 'c-title').attr('y', -26);
gCentre.append('text').attr('class', 'c-kpi').attr('y', -6); gCentre.append('text').attr('class', 'c-kpi').attr('y', 12);
const sparkPath = (s, w, h, area) => { const x = d3.scaleLinear([0, 11], [-w / 2, w / 2]), y = d3.scaleLinear([0, d3.max(s)], [h / 2, -h / 2]);
  return (area ? d3.area().x((v, i) => x(i)).y0(h / 2).y1(v => y(v)) : d3.line().x((v, i) => x(i)).y(v => y(v))).curve(d3.curveMonotoneX)(s); };
function setCentre(p) {
  const n = p.node, col = p.depth ? p.hue : '#fff';
  gCentre.select('circle').transition().duration(500).attr('stroke', col);
  gCentre.select('.c-sub').text(p.depth ? n.type : 'company');
  gCentre.select('.c-title').text(n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label).attr('font-size', n.label.length > 16 ? 13 : 15);
  gCentre.selectAll('.c-kpi').data([`${money(n.revenue)} · ${pct(n.margin)} margin`, `${spct(n.growth)} YoY · ${int(n.headcount)} FTE`]).text(s => s);
  const w = r0 * 1.15, h = 22, dy = 40;
  gCentre.select('.spark').attr('stroke', col).attr('transform', `translate(0,${dy})`).attr('d', sparkPath(n.series, w, h));
  gCentre.select('.spark-area').attr('fill', col).attr('transform', `translate(0,${dy})`).attr('d', sparkPath(n.series, w, h, true));
}

// ------------------------------------------------------------------ zoom (Bostock tween on d.cur → d.target)
function zoomTo(p, dur = 750) {
  focus = p; root.each(d => { d.target = targetOf(d, p); d.tang = tangential(d.target); });
  const t = svg.transition().duration(dur).ease(d3.easeCubicInOut);
  arcs.transition(t).tween('data', d => { const i = d3.interpolate(d.cur, d.target); return k => d.cur = i(k); })
    .attr('pointer-events', d => visible(d.target) ? null : 'none').attr('fill-opacity', d => alphaOf(d.target)).attrTween('d', d => () => arc(d.cur));
  labels.transition(t).attr('opacity', d => labelOk(d, d.target) ? 1 : 0).attrTween('transform', d => () => labelT(d, d.cur));
  setCentre(p); if (!state.hover) showPanel(p);
  return t;
}
function unfurl() {
  root.each(d => { const t = targetOf(d, root); d.cur = { ...t, x1: t.x0 }; d.target = t; d.tang = tangential(t); });
  arcs.attr('d', d => arc(d.cur)).attr('pointer-events', 'none').attr('fill-opacity', d => alphaOf(d.target)); labels.attr('opacity', 0);
  arcs.transition().delay(d => 100 + (d.depth - 1) * 250).duration(600).ease(d3.easeCubicOut)
    .tween('data', d => { const i = d3.interpolate(d.cur, d.target); return k => d.cur = i(k); }).attrTween('d', d => () => arc(d.cur)).attr('pointer-events', null);
  labels.transition().delay(d => 450 + (d.depth - 1) * 250).duration(400).attr('transform', d => labelT(d, d.target)).attr('opacity', d => labelOk(d, d.target) ? 1 : 0);
  gCentre.attr('opacity', 0).transition().duration(700).attr('opacity', 1);
  focus = root; setCentre(root); showPanel(root);
}
function relayout(dur = 650) { partitionLayout(); zoomTo(focus, dur); }
function recolor() { arcs.transition().duration(600).attr('fill', fill); renderLegend(); if (!state.hover) showPanel(focus); }

// ------------------------------------------------------------------ KPI panel (right)
const panel = document.createElement('div'); panel.className = 'hud panel'; document.body.appendChild(panel);
const modes = document.createElement('div'); modes.className = 'modes'; panel.appendChild(modes);
const body = document.createElement('div'); panel.appendChild(body);
const modeRow = (key, opts, label) => { const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<span class="k">${label}</span>`;
  for (const o of opts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pill' + (state[key] === o ? ' on' : ''); b.textContent = o; b.dataset[key] = o;
    b.addEventListener('click', () => setMode(key, o)); row.appendChild(b); } modes.appendChild(row); };
modeRow('size', Object.keys(SIZES), 'size'); modeRow('color', COLORS, 'colour');
function setMode(key, v) { if (!SIZES[v] && !COLORS.includes(v)) return; state[key] = v;
  modes.querySelectorAll(`[data-${key}]`).forEach(b => b.classList.toggle('on', b.dataset[key] === v)); key === 'size' ? relayout() : recolor(); }
const kpi = (k, v, col) => `<div class="kpi"><div class="k">${k}</div><div class="v"${col ? ` style="color:${col}"` : ''}>${v}</div></div>`;
function showPanel(d) {
  const n = d.node, [val, fmt] = SIZES[state.size], kids = (d.children || []).slice().sort((a, b) => b.value - a.value), max = kids[0]?.value || 1;
  const crumbs = d.ancestors().reverse().map(a => `<span data-id="${a.id}">${a.node.label}</span>`).join('<span class="sep">›</span>');
  const share = d.parent ? `${(d.value / d.parent.value * 100).toFixed(1)}% of ${d.parent.node.label}` : '100% of company';
  const drag = kids.length > 1 ? d3.least(kids, k => k.node.margin) : null, lead = kids.length > 1 ? d3.greatest(kids, k => k.node.growth) : null;
  body.innerHTML = `<div class="crumbs">${crumbs}</div><div class="ttl">${n.label}</div>
    <div class="badges"><span class="badge" style="background:${meta.type_colors[n.type]}">${n.type}${n.kind ? ' · ' + n.kind : ''}</span>
      <span class="badge stage" style="color:${meta.stage_colors[n.stage]};border-color:${meta.stage_colors[n.stage]}">${n.stage}</span></div>
    <div class="own">Owner <b>${n.owner}</b> · ${share}</div>
    <div class="spark-box"><svg viewBox="-110 -22 220 44" preserveAspectRatio="none"><path d="${sparkPath(n.series, 220, 40, true)}" fill="${d.hue}" opacity=".18"/>
      <path d="${sparkPath(n.series, 220, 40)}" fill="none" stroke="${d.hue}" stroke-width="1.6"/></svg></div>
    <div class="kpis">${kpi('Revenue', money(n.revenue))}${kpi('Cost', money(n.cost))}${kpi('Margin', pct(n.margin), marginScale(n.margin))}
      ${kpi('Growth YoY', spct(n.growth), growthScale(n.growth))}${kpi('Headcount', int(n.headcount))}${kpi('Customers', int(n.customers))}
      ${kpi('Health', `${n.health}<small>/100</small>`, healthScale(n.health))}${kpi('Rev / FTE', money(n.revenue / n.headcount))}${kpi('Descendants', int(d.descendants().length - 1))}</div>
    ${drag ? `<div class="sec">what's dragging · what's leading</div><div class="callout">
      <div data-id="${drag.id}" style="border-color:${marginScale(drag.node.margin)}">Lowest margin: <b>${drag.node.label}</b> at ${pct(drag.node.margin)} (${money(drag.node.revenue)})</div>
      <div data-id="${lead.id}" style="border-color:${growthScale(lead.node.growth)}">Fastest growth: <b>${lead.node.label}</b> ${spct(lead.node.growth)} YoY (${money(lead.node.revenue)})</div></div>` : ''}
    ${kids.length ? `<div class="sec">${kids.length} children by ${state.size}</div>` + kids.map(k => `<div class="kid" data-id="${k.id}"><span class="nm">${k.node.label}</span>
      <span class="v">${fmt(k.value)} <span class="sh">${(k.value / d.value * 100).toFixed(0)}%</span></span><span class="bar"><i style="width:${k.value / max * 100}%;background:${fill(k)}"></i></span></div>`).join('') : ''}`;
}
panel.addEventListener('click', e => { const id = e.target.closest('[data-id]')?.dataset.id, d = id && byId.get(id); if (d) zoomTo(d.children ? d : d.parent); });

// ------------------------------------------------------------------ hover, search, legend
const tipHtml = d => tooltipHtml(d.node.label, { type: d.node.type, path: d.depth > 1 ? pathOf(d.parent) : null, revenue: money(d.node.revenue), margin: pct(d.node.margin), growth: spct(d.node.growth) });
function hover(d, e) {
  state.hover = d; svg.classed('hovering', !!d);
  if (!d) { showPanel(focus); return hud.hideTooltip(); }
  const anc = new Set(d.ancestors());
  arcs.classed('on', n => anc.has(n) || n.ancestors().includes(d));
  showPanel(d); hud.showTooltip(tipHtml(d), e.clientX, e.clientY);
}
const q = document.getElementById('q'), qn = document.getElementById('qn');
function setMatches(list, filter = null) {
  state.matches = list; state.filter = filter; svg.classed('filtering', !!list); arcs.classed('match', d => !!list && list.includes(d));
  qn.textContent = list ? `${list.length} hit${list.length === 1 ? '' : 's'}` : '';
  document.getElementById('f-top').classList.toggle('on', filter === 'top'); document.getElementById('f-loss').classList.toggle('on', filter === 'loss');
}
function search(text) { const s = text.trim().toLowerCase(); if (!s) return setMatches(null);
  setMatches(nodes.filter(d => d.node.label.toLowerCase().includes(s)).sort((a, b) => b.node.revenue - a.node.revenue)); }
q.addEventListener('input', () => search(q.value));
q.addEventListener('keydown', e => { if (e.key === 'Enter' && state.matches?.length) { const m = state.matches[0]; zoomTo(m.children ? m : m.parent); }
  if (e.key === 'Escape') { q.value = ''; setMatches(null); q.blur(); } e.stopPropagation(); });
const quick = { top: () => root.leaves().slice().sort((a, b) => b.node.revenue - a.node.revenue).slice(0, 10), loss: () => nodes.filter(d => d.node.margin < 0) };
for (const k of ['top', 'loss']) document.getElementById('f-' + k).addEventListener('click', () => { q.value = ''; state.filter === k ? setMatches(null) : setMatches(quick[k](), k); });
const legend = document.createElement('div'); legend.className = 'hud hud--bl lg'; document.body.appendChild(legend);
function renderLegend() {
  const grad = (sc, lo, hi) => `linear-gradient(90deg,${d3.range(0, 1.01, .1).map(t => sc(lo + t * (hi - lo))).join(',')})`;
  const cont = (title, sc, lo, mid, hi, f, mk) => `<div class="t">${title}</div><div class="bar" style="background:${grad(sc, lo, hi)}"><i class="mk" style="left:${mk}%"></i></div>
    <div class="ticks"><span>${f(lo)}</span><span>${f(mid)} company</span><span>${f(hi)}</span></div>`;
  const rows = obj => Object.entries(obj).map(([k, c]) => `<div class="legend-row"><span class="legend-dot" style="--dot:${c}"></span>${k}</div>`).join('');
  legend.innerHTML = state.color === 'unit' ? `<div class="t">business units · lighter = deeper</div><div class="legend">${rows(meta.unit_hues)}</div>`
    : state.color === 'stage' ? `<div class="t">lifecycle stage</div><div class="legend">${rows(meta.stage_colors)}</div>`
    : state.color === 'margin' ? cont('margin vs company average', marginScale, TH.company_margin - TH.margin_range, TH.company_margin, TH.company_margin + TH.margin_range, pct, 50)
    : state.color === 'growth' ? cont('growth YoY vs company', growthScale, TH.company_growth - TH.growth_range, TH.company_growth, TH.company_growth + TH.growth_range, spct, 50)
    : cont('health score', healthScale, TH.health_range[0], root.node.health, TH.health_range[1], v => Math.round(v), (root.node.health - TH.health_range[0]) / (TH.health_range[1] - TH.health_range[0]) * 100);
}

// ------------------------------------------------------------------ reset, keys, resize, HUD, boot
svg.on('dblclick', () => zoomTo(root));
addEventListener('keydown', e => { if (e.key === 'Escape' && focus.parent) zoomTo(focus.parent);
  if (e.key === 'h' || e.key === 'H') setTimeout(() => { resize(); zoomTo(focus, 500); }, 0); });   // re-centre the wheel when the HUD is hidden
function resize() {
  W = innerWidth; H = innerHeight; const hid = document.body.classList.contains('hud-hidden'); cx = W > 900 && !hid ? -150 : 0; R = Math.min(W - (W > 900 && !hid ? 380 : 40), H - (hid ? 40 : 120)) / 2; r0 = R * 0.24;
  svg.attr('viewBox', [-W / 2, -H / 2, W, H]); gRoot.attr('transform', `translate(${cx},10)`); gCentre.select('circle').attr('r', r0 - 6);
}
addEventListener('resize', () => { resize(); zoomTo(focus, 0); });
const hud = mountHud({
  title: 'Business Sunburst', library: 'D3 partition · SVG', version: '7.9.0', legend: false,
  toggles: [
    { id: 'labels', label: 'labels', on: true, onChange: on => svg.classed('no-labels', !on) },
    { id: 'gaps', label: 'unit gaps', on: true, onChange: on => { state.gaps = on; relayout(); } },
  ],
});
resize(); renderLegend(); unfurl();

window.__demo = {
  hud, data, root, state, zoomTo, setMode, search, setMatches, quick, reset: () => zoomTo(root),
  get focus() { return focus; }, get hoverNode() { return state.hover ? state.hover.node : null; },
  panelText: () => body.textContent, find: id => byId.get(id) || null,
  screenPos(id) { const d = byId.get(id); if (!d) return null; const c = d.cur, a = (c.x0 + c.x1) / 2, r = midR(c); return { x: W / 2 + cx + r * Math.sin(a), y: H / 2 + 10 - r * Math.cos(a) }; },
};
