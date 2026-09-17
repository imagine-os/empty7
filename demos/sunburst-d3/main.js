// sunburst-d3 — zoomable partition: rings by depth, arcs typed by colour, department hue on the rim, gaps between sectors.
import { loadOrg, mountHud, tooltipHtml } from '../../shared/hud.js';

const org = await loadOrg();
const TAU = Math.PI * 2, DEG = Math.PI / 180, BG = '#07080f';
const state = { gaps: true, equal: false, hover: null };
const svg = d3.select('#c');
const defs = svg.append('defs');
defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%').append('feGaussianBlur').attr('stdDeviation', 6);
const gRoot = svg.append('g');
const gArcs = gRoot.append('g'), gRims = gRoot.append('g'), gGlyphs = gRoot.append('g'), gLabels = gRoot.append('g'), gCentre = gRoot.append('g').attr('class', 'centre');
const crumb = document.getElementById('crumb');

// ------------------------------------------------------------------ hierarchy + partition (gap wedges between departments)
const root = d3.hierarchy(org.tree);
root.each(d => {
  d.id = d.data.id; d.node = org.byId.get(d.id);
  d.dept = d.depth === 1 ? d : d.depth > 1 ? d.parent.dept : null;
  d.hue = d.dept ? d.dept.node.hue : '#ffffff';
});
const leafCount = d3.rollup(root.leaves(), v => v.length, l => l.dept.id);
let focus = root;
function partitionLayout() {
  root.sum(d => d.children ? 0 : state.equal ? 100 / leafCount.get(org.byId.get(d.id).department) : 1);
  d3.partition().size([TAU, root.height + 1])(root);
  const gap = state.gaps ? 7 * DEG : 0.6 * DEG;
  for (const dept of root.children) {
    const X0 = dept.x0, X1 = dept.x1, n0 = X0 + gap / 2, n1 = X1 - gap / 2, f = x => n0 + (x - X0) / (X1 - X0) * (n1 - n0);
    dept.each(d => { d.x0 = f(d.x0); d.x1 = f(d.x1); });
  }
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const targetOf = (d, p) => ({
  x0: clamp01((d.x0 - p.x0) / (p.x1 - p.x0)) * TAU, x1: clamp01((d.x1 - p.x0) / (p.x1 - p.x0)) * TAU,
  y0: Math.max(0, d.y0 - p.depth), y1: Math.max(0, d.y1 - p.depth), h: Math.max(1, p.height),
});

// ------------------------------------------------------------------ geometry
let W = innerWidth, H = innerHeight, R = Math.min(W, H) / 2 - 56, r0 = R * 0.2;
const radius = (y, h) => y <= 1 ? y * r0 : r0 + (y - 1) / h * (R - r0);
const arc = d3.arc().startAngle(c => c.x0).endAngle(c => c.x1).padAngle(c => Math.min((c.x1 - c.x0) / 2, 0.0035)).padRadius(() => R)
  .innerRadius(c => radius(c.y0, c.h) + 1).outerRadius(c => radius(c.y1, c.h) - 1.5);
const rimArc = d3.arc().startAngle(c => c.x0).endAngle(c => c.x1).innerRadius(R + 3).outerRadius(R + 9);
const hubArc = d3.arc().startAngle(c => c.x0).endAngle(c => c.x1).innerRadius(() => r0 - 3).outerRadius(() => r0 + 1);
const visible = c => c.y1 <= c.h + 1 && c.y0 >= 1 && c.x1 > c.x0 + 1e-4;
const midR = c => (radius(c.y0, c.h) + radius(c.y1, c.h)) / 2;
const widthPx = c => (c.x1 - c.x0) * midR(c);
const centroidT = c => { const a = (c.x0 + c.x1) / 2, r = midR(c); return `translate(${r * Math.sin(a)},${-r * Math.cos(a)})`; };
const labelT = c => { const a = (c.x0 + c.x1) / 2 / DEG; return `rotate(${a - 90}) translate(${midR(c)},0) rotate(${a < 180 ? 0 : 180})`; };
const labelOk = (d, c) => visible(c) && widthPx(c) > 13 && d.data.label.length * 6.2 < radius(c.y1, c.h) - radius(c.y0, c.h) - 10;
const glyphOk = (d, c) => visible(c) && !d.children && widthPx(c) > 8;
const hexagon = { draw(ctx, size) { const r = Math.sqrt(size / 2.6); ctx.moveTo(r, 0); for (let i = 1; i < 6; i++) ctx.lineTo(r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3)); ctx.closePath(); } };
const SYM = { company: d3.symbolCircle, department: hexagon, project: d3.symbolSquare, skill: d3.symbolCircle, agent: d3.symbolDiamond, template: d3.symbolTriangle, tool: d3.symbolStar };
const symbol = d3.symbol().type(d => SYM[d.node.type]).size(d => d.node.type === 'tool' ? 44 : 30);
const fillAlpha = d => d.node.type === 'skill' ? 0.5 + d.node.level * 0.1 : d.node.status === 'idea' ? 0.3 : d.node.status === 'pilot' ? 0.6 : d.depth === 1 ? 0.95 : 0.85;
const pathOf = d => d.ancestors().reverse().map(a => a.data.label).join(' › ');

// ------------------------------------------------------------------ build once
partitionLayout();
const arcs = gArcs.selectAll('path').data(root.descendants().filter(d => d.depth > 0)).join('path')
  .attr('class', d => `arc ${d.node.type}` + (d.children ? '' : ' leaf') + (d.node.status ? ' status-' + d.node.status : ''))
  .attr('fill', d => d.node.color).attr('fill-opacity', fillAlpha).attr('stroke', d => d.hue).attr('stroke-opacity', .45)
  .on('pointerenter', (e, d) => hover(d, e)).on('pointermove', e => state.hover && hud.showTooltip(tipHtml(state.hover), e.clientX, e.clientY))
  .on('pointerleave', () => hover(null)).on('click', (e, d) => { e.stopPropagation(); zoomTo(d.children ? d : d.parent); });
const rims = gRims.selectAll('g').data(root.children).join('g').attr('fill', d => d.hue);
rims.append('path').attr('class', 'rim').attr('fill', d => d.hue).attr('opacity', .55).attr('filter', 'url(#glow)');
rims.append('path').attr('class', 'rim').attr('fill', d => d.hue);
rims.append('path').attr('class', 'rim hub').attr('fill', d => d.hue).attr('opacity', .9);
const glyphs = gGlyphs.selectAll('path').data(root.leaves()).join('path').attr('class', 'glyph').attr('d', symbol);
const labels = gLabels.selectAll('text').data(root.descendants().filter(d => d.depth > 0)).join('text')
  .attr('class', d => 'label ' + d.node.type).attr('text-anchor', 'middle').attr('dy', '0.35em').text(d => d.data.label);
gCentre.append('circle').attr('r', r0 - 6).on('click', () => zoomTo(focus.parent || root));
gCentre.append('text').attr('class', 'c-title').attr('y', -4);
gCentre.append('text').attr('class', 'c-sub').attr('y', 14);
gCentre.append('text').attr('class', 'c-sub').attr('y', 30);

// ------------------------------------------------------------------ zoom (Bostock tween on d.cur → d.target)
function zoomTo(p, dur = 750) {
  focus = p;
  root.each(d => d.target = targetOf(d, p));
  const t = svg.transition().duration(dur).ease(d3.easeCubicInOut);
  arcs.transition(t).tween('data', d => { const i = d3.interpolate(d.cur, d.target); return k => d.cur = i(k); })
    .attr('pointer-events', d => visible(d.target) ? null : 'none').attrTween('d', d => () => arc(d.cur));
  rims.selectAll('path').transition(t).attrTween('d', function (d) { const a = this.classList.contains('hub') ? hubArc : rimArc; return () => (d.cur.x1 > d.cur.x0 + 1e-4 && d.cur.y0 <= 1 ? a(d.cur) : ''); });
  glyphs.transition(t).attr('opacity', d => glyphOk(d, d.target) ? 1 : 0).attrTween('transform', d => () => centroidT(d.cur));
  labels.transition(t).attr('opacity', d => labelOk(d, d.target) ? 1 : 0).attrTween('transform', d => () => labelT(d.cur));
  const leaves = p.leaves().length;
  gCentre.select('circle').transition(t).attr('stroke', p.hue);
  gCentre.select('.c-title').text(p.data.label);
  gCentre.selectAll('.c-sub').data([p.node.type, `${leaves} leaves`]).text(s => s);
  setCrumb(p);
  return t;
}
function unfurl() {
  root.each(d => { const t = targetOf(d, root); d.cur = { ...t, x1: t.x0 }; d.target = t; });
  arcs.attr('d', d => arc(d.cur)).attr('pointer-events', 'none');
  glyphs.attr('opacity', 0); labels.attr('opacity', 0);
  rims.selectAll('path').attr('d', '');
  const grow = sel => sel.transition().delay(d => 150 + (d.depth - 1) * 450).duration(560).ease(d3.easeCubicOut);
  grow(arcs).tween('data', d => { const i = d3.interpolate(d.cur, d.target); return k => d.cur = i(k); }).attrTween('d', d => () => arc(d.cur)).attr('pointer-events', null);
  grow(rims.selectAll('path')).attrTween('d', function (d) { const a = this.classList.contains('hub') ? hubArc : rimArc; return () => a(d.cur); });
  glyphs.transition().delay(1550).duration(500).attr('transform', d => centroidT(d.target)).attr('opacity', d => glyphOk(d, d.target) ? 1 : 0);
  labels.transition().delay(d => 500 + (d.depth - 1) * 450).duration(400).attr('transform', d => labelT(d.target)).attr('opacity', d => labelOk(d, d.target) ? 1 : 0);
  gCentre.attr('opacity', 0).transition().duration(600).attr('opacity', 1);
  focus = root; gCentre.select('circle').attr('stroke', '#fff'); gCentre.select('.c-title').text(root.data.label);
  gCentre.selectAll('.c-sub').data(['company', `${root.leaves().length} leaves`]).text(s => s); setCrumb(root);
}

// ------------------------------------------------------------------ hover, breadcrumb, reset
const tipHtml = d => tooltipHtml(d.data.label, { type: d.node.type, path: pathOf(d), level: d.node.level ? `${d.node.level} / 5` : null, status: d.node.status, leaves: d.children ? d.leaves().length : null });
function setCrumb(d) {
  const parts = d.ancestors().reverse().map((a, i, arr) => i === arr.length - 1 ? `<b>${a.data.label}</b>` : a.data.label).join('<span class="sep">›</span>');
  const extra = d.node.level ? ` · level ${d.node.level}/5` : d.node.status ? ` · ${d.node.status}` : '';
  crumb.innerHTML = `${parts}<span class="type" style="background:${d.node.color}">${d.node.type}${extra}</span>`;
}
function hover(d, e) {
  state.hover = d; svg.classed('hovering', !!d);
  if (!d) { setCrumb(focus); return hud.hideTooltip(); }
  const anc = new Set(d.ancestors());
  arcs.classed('on', n => anc.has(n) || n.ancestors().includes(d));
  setCrumb(d); hud.showTooltip(tipHtml(d), e.clientX, e.clientY);
}
svg.on('dblclick', () => zoomTo(root));
function relayout(dur = 650) { partitionLayout(); zoomTo(focus, dur); }
function resize() {
  W = innerWidth; H = innerHeight; R = Math.min(W, H) / 2 - 56; r0 = R * 0.2;
  svg.attr('viewBox', [-W / 2, -H / 2, W, H]); rimArc.innerRadius(R + 3).outerRadius(R + 9); gCentre.select('circle').attr('r', r0 - 6);
}
addEventListener('resize', () => { resize(); zoomTo(focus, 0); });

// ------------------------------------------------------------------ HUD + boot
const hud = mountHud({
  title: 'Sunburst', library: 'D3 partition · SVG', version: '7.9.0', typeColors: org.meta.type_colors,
  toggles: [
    { id: 'glyphs', label: 'type glyphs', on: true, onChange: on => svg.classed('no-glyphs', !on) },
    { id: 'labels', label: 'labels', on: true, onChange: on => svg.classed('no-labels', !on) },
    { id: 'gaps', label: 'gaps', on: true, onChange: on => { state.gaps = on; relayout(); } },
    { id: 'equal', label: 'equal sectors', on: false, onChange: on => { state.equal = on; relayout(); } },
  ],
});
resize(); unfurl();

window.__demo = {
  hud, org, root, state, zoomTo, reset: () => zoomTo(root),
  get focus() { return focus; }, get hoverNode() { return state.hover ? state.hover.node : null; },
  find(id) { return root.descendants().find(d => d.id === id) || null; },
  screenPos(id) { const d = this.find(id); if (!d) return null; const c = d.cur, a = (c.x0 + c.x1) / 2, r = midR(c); return { x: W / 2 + r * Math.sin(a), y: H / 2 - r * Math.cos(a) }; },
};
