// lanes-skilltree — one swimlane per department, a left→right tech tree per lane. D3 7.9.0, SVG.
import { loadOrg, mountHud, tooltipHtml } from '../../shared/hud.js';

const org = await loadOrg();
const svg = d3.select('#c'), root = svg.append('g').attr('class', 'root');
const gLanes = root.append('g'), gLinks = root.append('g'), gNodes = root.append('g');
const state = { spread: false, onlySkills: false, collapseProjects: false, fills: true };
const collapsed = new Set();                       // ids of collapsed departments / projects
const X = { company: 60, dept: 320, proj: 580, leaf: 820 };
const WIDTH = [3, 2, 1.2], COL_STEP = 28, COLS = 8;
const depts = org.meta.departments.map(id => org.byId.get(id));
const kids = id => (org.childrenOf.get(id) || []).map(i => org.byId.get(i));
let current = null, W = innerWidth, H = innerHeight, hovered = null;

// Blocks per department: its projects plus one virtual "General" block for leaves hanging directly off the department.
const blocksOf = new Map(depts.map(d => {
  const ch = kids(d.id), blocks = ch.filter(k => k.type === 'project').map(p => ({ node: p, leaves: kids(p.id) }));
  const loose = ch.filter(k => k.type !== 'project');
  if (loose.length) blocks.push({ node: { id: d.id + ':general', type: 'general', label: 'General', parent: d.id, department: d.id }, leaves: loose });
  return [d.id, blocks];
}));

// ------------------------------------------------------------------ layout: rows stack downward, lanes never overlap
function layout() {
  const cols = state.spread ? 1 : COLS, rowH = state.spread ? 20 : 16, gap = state.spread ? 14 : 10, pad = 20;
  const nodes = [], links = [], rails = [], lanes = [];
  const company = { ...org.byId.get('company:root'), x: X.company, y: 0, depth: 0 };
  nodes.push(company);
  let y = 0;
  depts.forEach((d, i) => {
    const top = y; y += pad + 12;
    const dn = { ...d, x: X.dept, y: 0, depth: 1, parentNode: company, collapsed: collapsed.has(d.id), count: kids(d.id).length };
    nodes.push(dn); links.push({ source: company, target: dn, depth: 0, hue: d.hue });
    if (!dn.collapsed) for (const b of blocksOf.get(d.id)) {
      const isCol = collapsed.has(b.node.id) || state.collapseProjects;
      const leaves = isCol ? [] : b.leaves.filter(l => !state.onlySkills || l.type === 'skill');
      const rows = Math.max(1, Math.ceil(leaves.length / cols)), h = rows * rowH;
      const bn = { ...b.node, x: X.proj, y: y + h / 2, depth: 2, parentNode: dn, collapsed: isCol, count: b.leaves.length, hue: d.hue };
      nodes.push(bn); links.push({ source: dn, target: bn, depth: 1, hue: d.hue });
      let prev = null;
      leaves.forEach((l, j) => {
        const c = j % cols, ln = { ...l, x: X.leaf + c * COL_STEP, y: y + Math.floor(j / cols) * rowH + rowH / 2, depth: 3, parentNode: bn, hue: d.hue };
        nodes.push(ln);
        if (c === 0) links.push({ source: bn, target: ln, depth: 2, hue: d.hue }); else rails.push({ source: prev, target: ln, hue: d.hue });
        prev = ln;
      });
      y += h + gap;
    }
    y += pad - (dn.collapsed ? 0 : gap);
    if (y - top < 64) y = top + 64;
    dn.y = (top + y) / 2;
    lanes.push({ d, top, bottom: y, i, projects: blocksOf.get(d.id).filter(b => b.node.type === 'project').length, leaves: blocksOf.get(d.id).reduce((s, b) => s + b.leaves.length, 0) });
  });
  company.y = y / 2;
  return { nodes, links, rails, lanes, height: y, width: X.leaf + (state.spread ? 170 : COLS * COL_STEP) };
}

// ------------------------------------------------------------------ glyphs (type → shape), level rings, status marks
const sym = (t, s) => d3.symbol().type(t).size(s)();
const hexPath = r => 'M' + d3.range(6).map(i => { const a = Math.PI / 3 * i - Math.PI / 6; return [r * Math.cos(a), r * Math.sin(a)].map(v => v.toFixed(2)); }).join('L') + 'Z';
const ringArc = d3.arc().innerRadius(7.2).outerRadius(9.2);
const linkPath = d3.linkHorizontal().x(d => d.x).y(d => d.y);

function drawNode(d) {
  const g = d3.select(this), c = d.color || '#fff';
  if (d.type === 'company') {
    g.append('circle').attr('r', 30).attr('fill', '#fff').attr('opacity', .35).attr('filter', 'url(#bloom)');
    g.append('circle').attr('r', 22).attr('fill', '#fff');
    g.append('text').attr('class', 'company-label').attr('y', 42).text(d.label);
  } else if (d.type === 'department') {
    g.append('circle').attr('r', 26).attr('fill', d.hue).attr('opacity', .35).attr('filter', 'url(#blur)');
    g.append('path').attr('d', hexPath(14)).attr('fill', c).attr('stroke', d.hue).attr('stroke-width', 2);
    g.append('text').attr('class', 'badge').attr('y', 3.5);
  } else if (d.type === 'project' || d.type === 'general') {
    g.append('path').attr('class', 'shape').attr('d', sym(d3.symbolSquare, 190)).attr('fill', c).attr('stroke', d.type === 'general' ? d.hue : c)
      .attr('stroke-width', 1.5).attr('stroke-dasharray', d.type === 'general' ? '3 2' : null);
    g.append('text').attr('x', 14).attr('dy', '.35em').text(d.label);
    g.append('text').attr('class', 'badge').attr('y', 3);
  } else {
    if (d.type === 'skill') {
      g.append('path').attr('d', sym(d3.symbolCircle, 70)).attr('fill', c);
      g.selectAll('path.ring').data(d3.range(5)).join('path').attr('class', 'ring')
        .attr('d', i => ringArc({ startAngle: i * 1.2566 + .17, endAngle: (i + 1) * 1.2566 - .17 }))
        .attr('fill', i => i < (d.level || 0) ? c : 'rgba(255,255,255,0.12)');
    } else if (d.type === 'agent') {
      g.append('path').attr('d', sym(d3.symbolDiamond, 110)).attr('fill', d.status === 'idea' ? 'none' : c).attr('stroke', c).attr('stroke-width', 1.2).attr('opacity', d.status === 'idea' ? .75 : 1);
      if (d.status === 'live') g.append('circle').attr('cx', 7).attr('cy', -7).attr('r', 2.4).attr('fill', c);
      if (d.status === 'pilot') g.append('circle').attr('r', 9).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1).attr('stroke-dasharray', '2 2.2').attr('opacity', .8);
    } else if (d.type === 'template') g.append('path').attr('d', sym(d3.symbolTriangle, 90)).attr('fill', c);
    else g.append('path').attr('d', sym(d3.symbolStar, 100)).attr('fill', c);
    g.append('text').attr('class', 'leaf-label').attr('x', 11).attr('dy', '.35em').text(d.label);
  }
}

// ------------------------------------------------------------------ render (keyed joins, tweened re-layout, unfurl on first run)
function render(initial = false) {
  const L = current = layout();
  const T = d3.transition().duration(initial ? 0 : 650).ease(d3.easeCubicInOut);
  const dl = d => initial ? d.depth * 450 : 0;

  const lane = gLanes.selectAll('g.lane').data(L.lanes, l => l.d.id).join(enter => {
    const g = enter.append('g').attr('class', 'lane');
    g.append('rect').attr('class', 'fill').attr('x', -4000).attr('width', 9000);
    g.append('line').attr('class', 'sep').attr('x1', -4000).attr('x2', 5000);
    g.append('path').attr('class', 'hex').attr('d', hexPath(5.5)).attr('fill', l => l.d.hue);
    g.append('text').attr('class', 'lane-title').attr('x', 10).text(l => l.d.label);
    g.append('text').attr('class', 'lane-sub').attr('x', 10);
    g.style('opacity', 0).transition().delay(450).duration(600).style('opacity', 1);
    return g;
  });
  lane.select('rect.fill').transition(T).attr('y', l => l.top).attr('height', l => l.bottom - l.top).attr('fill', l => l.d.hue).attr('fill-opacity', l => l.i % 2 ? .05 : .022);
  lane.select('line.sep').transition(T).attr('y1', l => l.top).attr('y2', l => l.top);
  lane.select('path.hex').transition(T).attr('transform', l => `translate(${X.dept - 70},${l.top + 15})`);
  lane.select('text.lane-title').transition(T).attr('x', X.dept - 60).attr('y', l => l.top + 19);
  lane.select('text.lane-sub').text(l => `${l.projects} projects · ${l.leaves} leaves`).transition(T).attr('x', X.dept - 60).attr('y', l => l.top + 32);

  const link = gLinks.selectAll('path.link').data(L.links, l => l.target.id).join(
    enter => enter.append('path').attr('class', 'link').attr('d', linkPath).attr('stroke', l => l.hue).attr('stroke-opacity', .55)
      .attr('stroke-width', l => WIDTH[l.depth]).attr('stroke-linecap', 'round')
      .each(function (l) { if (!initial) return; const len = this.getTotalLength(); d3.select(this).attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().delay(l.depth * 450 + 200).duration(520).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0).on('end', function () { d3.select(this).attr('stroke-dasharray', null); }); }),
    update => update, exit => exit.transition(T).style('opacity', 0).remove());
  link.transition(T).attr('d', linkPath);
  const rail = gLinks.selectAll('path.rail').data(L.rails, r => r.target.id).join(
    enter => enter.append('path').attr('class', 'rail').attr('d', linkPath).attr('stroke', r => r.hue).attr('stroke-opacity', .3).attr('stroke-width', .8).attr('stroke-dasharray', '1.5 3')
      .style('opacity', 0).call(s => s.transition().delay(d => initial ? 1500 : 300).duration(400).style('opacity', 1)),
    update => update, exit => exit.remove());
  rail.transition(T).attr('d', linkPath);

  const node = gNodes.selectAll('g.node').data(L.nodes, d => d.id).join(
    enter => enter.append('g').attr('class', d => `node t-${d.type}`).attr('transform', d => `translate(${(d.parentNode || d).x},${(d.parentNode || d).y})`)
      .style('opacity', 0).each(drawNode)
      .on('pointerenter', (e, d) => hover(d, e)).on('pointermove', (e, d) => hud.showTooltip(tipFor(d), e.clientX, e.clientY)).on('pointerleave', unhover)
      .on('click', (e, d) => { e.stopPropagation(); click(d); }),
    update => update,
    exit => exit.transition(T).style('opacity', 0).attr('transform', d => `translate(${d.parentNode.x},${d.parentNode.y})`).remove());
  node.select('text.badge').text(d => d.collapsed ? d.count : '');
  node.filter(d => d.type === 'project').select('path.shape').attr('fill', d => d.collapsed ? 'none' : d.color);
  node.transition(T).delay(dl).style('opacity', 1).attr('transform', d => `translate(${d.x},${d.y})`);
  root.classed('spread', state.spread).classed('no-fills', !state.fills);
}

// ------------------------------------------------------------------ interaction
const pathOf = d => { const p = []; for (let n = d; n; n = n.parentNode) if (n.type !== 'general') p.unshift(n.label); return p.join(' › '); };
const tipFor = d => tooltipHtml(d.label, { type: d.type, path: pathOf(d), level: d.level && '●'.repeat(d.level) + '○'.repeat(5 - d.level), status: d.status, department: d.type === 'department' ? `${d.count} direct children` : undefined });
function hover(d, e) {
  hovered = d; const ids = new Set(); for (let n = d; n; n = n.parentNode) ids.add(n.id);
  gNodes.selectAll('g.node').classed('dim', n => !ids.has(n.id));
  gLinks.selectAll('path').classed('dim', l => !ids.has(l.target.id));
  if (e) hud.showTooltip(tipFor(d), e.clientX, e.clientY);
}
function unhover() { hovered = null; gNodes.selectAll('g.node').classed('dim', false); gLinks.selectAll('path').classed('dim', false); hud.hideTooltip(); }
function click(d) {
  if (d.type === 'company') return reset();
  if (d.depth > 2) return;
  collapsed.has(d.id) ? collapsed.delete(d.id) : collapsed.add(d.id);
  render(); if (d.type === 'department') fit(700);
}
const zoom = d3.zoom().scaleExtent([0.25, 6]).filter(e => !(e.type === 'wheel' && !e.ctrlKey && !e.metaKey) && !e.button)
  .on('zoom', e => root.attr('transform', e.transform));
svg.call(zoom).on('dblclick.zoom', null)
  .on('wheel', e => { if (e.ctrlKey || e.metaKey) return; e.preventDefault(); svg.call(zoom.translateBy, -e.deltaX * .5, -e.deltaY * .8); }, { passive: false })
  .on('dblclick', () => reset());
function fit(dur = 900) {
  const k = Math.min(1.3, (W - 48) / current.width, (H - 48) / current.height);
  svg.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate((W - current.width * k) / 2 + 6, (H - current.height * k) / 2).scale(k));
}
function reset() { collapsed.clear(); state.collapseProjects = false; hud.setToggle('collapse', false); render(); fit(); }
addEventListener('resize', () => { W = innerWidth; H = innerHeight; });

// ------------------------------------------------------------------ HUD
const toggle = (id, label, on, fn) => ({ id, label, on, onChange: v => { fn(v); render(); fit(700); } });
const hud = mountHud({
  title: 'Lanes Skill-tree', library: 'D3 · SVG swimlanes', version: 'd3@7.9.0', typeColors: org.meta.type_colors,
  toggles: [
    toggle('spread', 'spread rows', false, v => state.spread = v),
    toggle('skills', 'only skills', false, v => state.onlySkills = v),
    toggle('collapse', 'collapse projects', false, v => state.collapseProjects = v),
    toggle('fills', 'lane fills', true, v => state.fills = v),
  ],
});

render(true); fit(0);
window.__demo = {
  org, hud, state, collapsed, get nodes() { return current.nodes; }, get hoverNode() { return hovered; },
  screenPos(id) { const n = current.nodes.find(n => n.id === id); const [x, y] = d3.zoomTransform(svg.node()).apply([n.x, n.y]); return { x, y }; },
  isCollapsed: id => collapsed.has(id), visibleCount: () => current.nodes.length, reset, fit,
};
