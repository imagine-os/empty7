// radial-tree-d3 — company at the centre, six department sectors with gap wedges, typed leaf glyphs.
import { loadOrg, mountHud, tooltipHtml } from '../../shared/hud.js';

const org = await loadOrg();
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const state = { wideGaps: true, hover: null, k: 1 };
const svg = d3.select('#c');
const gZoom = svg.append('g');
const gSectors = gZoom.append('g'), gLinks = gZoom.append('g'), gNodes = gZoom.append('g'), gArcs = gZoom.append('g');
const defs = svg.append('defs');
defs.append('filter').attr('id', 'blur').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
  .append('feGaussianBlur').attr('stdDeviation', 7);

// ------------------------------------------------------------------ hierarchy
const root = d3.hierarchy(org.tree);
root.each(d => {
  d.id = d.data.id; d.node = org.byId.get(d.id);
  d.dept = d.depth === 1 ? d : d.depth > 1 ? d.parent.dept : null;
  d.hue = d.dept ? d.dept.node.hue : '#ffffff';
});
const isBranch = d => d.depth > 0 && d.depth < 3 && (d.children || d._children);
const setCollapsed = (d, on) => { if (on && d.children) { d._children = d.children; d.children = null; } else if (!on && d._children) { d.children = d._children; d._children = null; } };
// descendants() only walks visible children, so walk manually when expanding.
const walk = (d, f) => { f(d); (d.children || d._children || []).forEach(c => walk(c, f)); };

// ------------------------------------------------------------------ layout (sector per department)
let W = innerWidth, H = innerHeight, R = Math.min(W, H) / 2 - 56;
const RING = [0, 0.32, 0.63, 1];
const sib = d => d.parent ? d.parent.children.indexOf(d) % 2 : 0;   // alternate leaves inward so glyphs never touch
const ringOf = d => d.depth === 2 && !d.children && !d._children ? R * 0.8 - sib(d) * 12 : d.depth === 3 ? R - sib(d) * 15 : R * RING[d.depth];
const tree = d3.tree().separation((a, b) => (a.parent === b.parent ? 1 : 1.7) / a.depth);
function layout() {
  const gap = (state.wideGaps ? 14 : 4) * DEG;
  const depts = root.children || [];
  root.x = 0; root.y = 0;
  const counts = depts.map(d => Math.max(3, d.leaves().length));
  const total = d3.sum(counts), avail = TAU - depts.length * gap;
  let a = gap / 2;
  depts.forEach((dept, i) => {
    const span = avail * counts[i] / total;
    tree.size([span, 1])(dept);
    dept.each(d => { d.x += a; d.y = ringOf(d); });
    dept.a0 = a; dept.a1 = a + span; a += span + gap;
  });
}
const px = d => d.y * Math.sin(d.x), py = d => -d.y * Math.cos(d.x);
const xy = (d, k = '') => `translate(${d['y' + k] * Math.sin(d['x' + k])},${-d['y' + k] * Math.cos(d['x' + k])})`;
const linkRadial = d3.linkRadial().angle(d => d.x).radius(d => d.y);
const sectorArc = d3.arc().innerRadius(R * 0.17).outerRadius(R + 10);
function arcLabelPath(d) {
  const r = Math.cos((d.a0 + d.a1) / 2) < 0 ? R + 30 : R + 18, flip = Math.cos((d.a0 + d.a1) / 2) < 0;
  const [s, e] = flip ? [d.a1, d.a0] : [d.a0, d.a1];
  return `M${r * Math.sin(s)},${-r * Math.cos(s)}A${r},${r} 0 0 ${flip ? 0 : 1} ${r * Math.sin(e)},${-r * Math.cos(e)}`;
}

// ------------------------------------------------------------------ glyphs
const hexagon = { draw(ctx, size) { const r = Math.sqrt(size / 2.6); ctx.moveTo(r, 0); for (let i = 1; i < 6; i++) ctx.lineTo(r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3)); ctx.closePath(); } };
const SYM = { company: d3.symbolCircle, department: hexagon, project: d3.symbolSquare, skill: d3.symbolCircle, agent: d3.symbolDiamond, template: d3.symbolTriangle, tool: d3.symbolStar };
const RAD = { company: 22, department: 14, project: 8 };
const rOf = d => RAD[d.node.type] || 5;
const symbol = d3.symbol().type(d => SYM[d.node.type]).size(d => Math.PI * rOf(d) ** 2 * (d.node.type === 'tool' ? 1.6 : 1));
const linkWidth = d => [3, 3, 2, 1.2, 0.8][d.target.depth] || 0.8;
const linkAlpha = d => [0.8, 0.8, 0.55, 0.4][d.target.depth] || 0.4;
const pathOf = d => d.ancestors().reverse().map(a => a.data.label).join(' › ');

// ------------------------------------------------------------------ render / update
function update(src, dur = 650) {
  layout();
  const t = svg.transition().duration(dur).ease(d3.easeCubicInOut);
  const nodes = root.descendants(), links = root.links(), depts = root.children || [];
  const from = d => src ? { x: src.x0 ?? src.x, y: src.y0 ?? src.y } : { x: d.parent?.x ?? 0, y: d.parent?.y ?? 0 };
  const plainLink = (s, tg) => ({ source: { x: s.x, y: s.y }, target: { x: tg.x, y: tg.y } });

  gSectors.selectAll('path').data(depts, d => d.id).join('path').attr('class', 'sector').attr('fill', d => d.hue).attr('stroke', d => d.hue)
    .transition(t).attrTween('d', function (d) { const i = d3.interpolate(this._a || { a0: d.a0, a1: d.a1 }, { a0: d.a0, a1: d.a1 }); return k => { this._a = i(k); return sectorArc({ startAngle: this._a.a0, endAngle: this._a.a1 }); }; });

  gArcs.selectAll('g').data(depts, d => d.id).join(enter => {
    const g = enter.append('g');
    g.append('path').attr('id', d => 'arc-' + d.id.replace(':', '-')).attr('fill', 'none');
    g.append('text').attr('class', 'arc-label').attr('fill', d => d.hue).attr('text-anchor', 'middle')
      .append('textPath').attr('href', d => '#arc-' + d.id.replace(':', '-')).attr('startOffset', '50%').text(d => d.data.label);
    return g;
  }).select('path').transition(t).attrTween('d', function (d) { const i = d3.interpolate(this._a || { a0: d.a0, a1: d.a1 }, { a0: d.a0, a1: d.a1 }); return k => arcLabelPath(this._a = i(k)); });

  gLinks.selectAll('path').data(links, d => d.target.id).join(
    enter => enter.append('path').attr('class', 'link').attr('stroke', d => d.target.hue).attr('stroke-width', d => linkWidth(d)).attr('stroke-opacity', d => linkAlpha(d))
      .each(function (d) { this._p = plainLink(from(d.target), from(d.target)); }),
    u => u,
    exit => exit.transition(t).attrTween('d', function (d) { const s = src || d.source; const i = d3.interpolate(this._p, plainLink(s, s)); return k => linkRadial(i(k)); }).remove(),
  ).transition(t).attrTween('d', function (d) { const i = d3.interpolate(this._p, plainLink(d.source, d.target)); return k => { this._p = i(k); return linkRadial(this._p); }; });

  const node = gNodes.selectAll('g.node').data(nodes, d => d.id).join(
    enter => {
      const g = enter.append('g').attr('class', d => `node ${d.node.type}` + (d.node.status ? ' status-' + d.node.status : ''))
        .attr('transform', d => xy(from(d))).each(function (d) { this._p = from(d); })
        .on('pointerenter', (e, d) => hover(d, e)).on('pointermove', e => state.hover && hud.showTooltip(tipHtml(state.hover), e.clientX, e.clientY))
        .on('pointerleave', () => hover(null)).on('click', (e, d) => { e.stopPropagation(); if (isBranch(d)) { setCollapsed(d, !!d.children); update(d); } });
      g.filter(d => d.depth <= 1).append('circle').attr('class', 'halo').attr('r', d => rOf(d) * 1.5).attr('fill', d => d.hue).attr('opacity', d => d.depth ? 0.5 : 0.6).attr('filter', 'url(#blur)');
      g.append('path').attr('class', 'glyph').attr('d', symbol).attr('fill', d => d.node.color).attr('stroke', d => d.depth ? d.hue : '#fff');
      g.filter(d => d.node.type === 'skill').append('circle').attr('class', 'ring').attr('r', 8.5).attr('stroke', d => d.node.color)
        .attr('stroke-dasharray', d => `${2 * Math.PI * 8.5 * d.node.level / 5} ${2 * Math.PI * 8.5}`).attr('transform', 'rotate(-90)');
      g.filter(d => d.depth >= 2).append('text').attr('class', d => 'label ' + (d.node.type === 'project' ? 'project' : 'leaf')).text(d => d.data.label);
      return g;
    },
    u => u,
    exit => exit.transition(t).attr('transform', d => xy(src || d.parent)).attr('opacity', 0).remove(),
  );
  node.classed('collapsed', d => !!d._children).classed('branch', isBranch);
  node.transition(t).attr('opacity', 1).attrTween('transform', function (d) { const i = d3.interpolate(this._p, { x: d.x, y: d.y }); return k => { this._p = i(k); return xy(this._p); }; });
  node.select('text.label').attr('text-anchor', d => (d.x < Math.PI) === (d.node.type !== 'project') ? 'start' : 'end')
    .attr('transform', d => { const deg = d.x / DEG - 90, off = (rOf(d) + 5) * (d.node.type === 'project' ? -1 : 1); return `rotate(${deg}) translate(${off},0) rotate(${d.x < Math.PI ? 0 : 180}) translate(0,3.5)`; });
  root.each(d => { d.x0 = d.x; d.y0 = d.y; });
  return t;
}

// ------------------------------------------------------------------ unfurl (staggered by depth, edges draw along their length)
function unfurl() {
  gNodes.selectAll('g.node').interrupt().attr('opacity', 0).transition().delay(d => 200 + d.depth * 420).duration(450).attr('opacity', 1);
  gLinks.selectAll('path').interrupt().each(function () { const L = this.getTotalLength(); d3.select(this).attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L); })
    .transition().delay(d => 100 + (d.target.depth - 1) * 420 + 100).duration(520).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
    .on('end', function () { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
  gArcs.selectAll('text').attr('opacity', 0).transition().delay(700).duration(600).attr('opacity', 1);
}

// ------------------------------------------------------------------ hover / zoom / reset
const tipHtml = d => tooltipHtml(d.data.label, { type: d.node.type, path: pathOf(d), level: d.node.level ? `${d.node.level} / 5` : null, status: d.node.status, children: d._children ? `${d._children.length} (collapsed)` : d.children ? d.children.length : null });
function hover(d, e) {
  state.hover = d;
  svg.classed('hovering', !!d);
  if (!d) return hud.hideTooltip();
  const anc = new Set(d.ancestors());
  gNodes.selectAll('g.node').classed('on', n => anc.has(n));
  gLinks.selectAll('path').classed('on', l => anc.has(l.target));
  hud.showTooltip(tipHtml(d), e.clientX, e.clientY);
}
const zoom = d3.zoom().scaleExtent([0.4, 7]).filter(e => !e.button && e.type !== 'dblclick')
  .on('zoom', e => { state.k = e.transform.k; gZoom.attr('transform', e.transform); svg.classed('zoomed', e.transform.k >= 1.7); });
svg.call(zoom).on('dblclick', reset);
function reset(dur = 700) {
  walk(root, n => setCollapsed(n, false));
  hud.setToggle('collapse', false);
  update(undefined, dur);
  svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity);
}
function resize() {
  W = innerWidth; H = innerHeight; R = Math.min(W, H) / 2 - 56;
  svg.attr('viewBox', [-W / 2, -H / 2, W, H]);
  sectorArc.innerRadius(R * 0.17).outerRadius(R + 10);
}
addEventListener('resize', () => { resize(); update(undefined, 0); });

// ------------------------------------------------------------------ HUD + boot
const hud = mountHud({
  title: 'Radial Tree', library: 'D3 tidy tree · SVG', version: '7.9.0', typeColors: org.meta.type_colors,
  toggles: [
    { id: 'labels', label: 'labels', on: true, onChange: on => svg.classed('no-labels', !on) },
    { id: 'gaps', label: 'wide gaps', on: true, onChange: on => { state.wideGaps = on; update(); } },
    { id: 'rings', label: 'level rings', on: true, onChange: on => svg.classed('no-rings', !on) },
    { id: 'collapse', label: 'collapse all', on: false, onChange: on => { root.children?.forEach(d => setCollapsed(d, on)); (root.children || []).forEach(d => walk(d, n => n.depth === 2 && setCollapsed(n, on))); update(); } },
  ],
});
resize(); update(undefined, 0).end().then(unfurl);

window.__demo = {
  hud, org, root, state,
  screenPos(id) { let n = null; walk(root, d => { if (d.id === id) n = d; }); if (!n) return null; const [x, y] = d3.zoomTransform(svg.node()).apply([px(n), py(n)]); return { x: x + W / 2, y: y + H / 2 }; },
  find(id) { let n = null; walk(root, d => { if (d.id === id) n = d; }); return n; },
  get hoverNode() { return state.hover ? state.hover.node : null; },
  collapsed(id) { const n = this.find(id); return !!(n && n._children); },
  reset, update,
};
