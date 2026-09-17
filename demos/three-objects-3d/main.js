// Graph Gallery · three-objects-3d: every node is its object model (.glb via GLTFLoader, or procedural from models.js),
// textured with the node's logo / avatar / page thumbnail; depth-banded ground layout, relation-styled edges, glTF export.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildModel } from '../../shared/assets/models/models.js';
import { mountHud, tooltipHtml, buildNeighbors } from '../../shared/hud.js';

const app = document.getElementById('app');
const sys = await (await fetch('../../shared/system.json')).json();
const { type_colors: TC, type_frames: TF, type_models: TM, relation_styles: RS, teams: TEAMS } = sys.meta;
const asset = p => sys.meta.asset_root + p;
const nodes = sys.nodes, N = nodes.length, index = new Map(nodes.map((n, i) => [n.id, i])), byId = new Map(nodes.map(n => [n.id, n]));
const nb = buildNeighbors(sys.links), nameOf = id => byId.get(id)?.label;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pictureFor = n => n.thumb || n.avatar || n.logo || n.icon;
const state = { labels: true, pictures: true, files: true, procedural: false };
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// ---- layout: ground plane, depth bands by type, short 2D relaxation (links pull, bodies repel, files hug their repo) ----
const BAND = { cloud: -8, service: -4, database: 0, queue: 0, repo: 4.2, file: 4.2, document: 8.6, person: 8.6 };
const RAD = { service: 1.05, cloud: 1.0, database: 0.85, queue: 1.1, repo: 0.95, file: 0.48, document: 0.7, person: 0.9 };
const SCALE = { service: 1.0, database: 0.9, queue: 0.9, repo: 0.95, file: 0.5, document: 0.85, person: 0.85, cloud: 1.0 };
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
const L = nodes.map((n, i) => ({ x: (i % 11 - 5) * 2 + rnd() - 0.5, z: BAND[n.type] + rnd() - 0.5 }));
const links = sys.links.map(l => ({ ...l, s: index.get(l.source), t: index.get(l.target) }));
for (let it = 0; it < 320; it++) {
  for (const l of links) { const a = L[l.s], b = L[l.t], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01;
    const rest = l.relation === 'contains' ? 1.4 : 3, k = l.relation === 'contains' ? 0.08 : 0.012, f = (d - rest) * k; a.x += dx / d * f; b.x -= dx / d * f; if (l.relation === 'contains') { a.z += dz / d * f; b.z -= dz / d * f; } }
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = L[i], b = L[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01, min = RAD[nodes[i].type] + RAD[nodes[j].type] + 0.45;
    if (d < min) { const p = (min - d) / d * 0.5; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } }
  const mx = L.reduce((s, p) => s + p.x, 0) / N;
  for (let i = 0; i < N; i++) { const p = L[i], n = nodes[i]; p.z += (BAND[n.type] - p.z) * (n.type === 'file' ? 0.02 : 0.1); p.x -= mx * 0.05 + p.x * 0.002; }
}
const P = nodes.map((n, i) => new THREE.Vector3(L[i].x, SCALE[n.type] * 0.5, L[i].z));

// ---- renderer / scene / camera -------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); app.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#06070d');
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 500);
scene.add(new THREE.HemisphereLight(0xe8ecff, 0x1a1626, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(6, 12, 9); scene.add(key);
const grid = new THREE.GridHelper(60, 60, 0x1c2233, 0x141a28); grid.position.y = -0.01; scene.add(grid);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.autoRotate = false; controls.autoRotateSpeed = 0.6; controls.maxPolarAngle = Math.PI / 2.05;

// ---- pictures -> canvas textures (SVGs without width/height are given one so drawImage does not letterbox) -------------
const picCache = new Map();
const loadPic = url => picCache.get(url) || picCache.set(url, (async () => {
  let src = url;
  if (/\.svg$/i.test(url)) { let t = await (await fetch(url)).text(); if (!/<svg[^>]*\swidth=/.test(t)) t = t.replace(/<svg/, '<svg width="256" height="256"'); src = URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' })); }
  const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('picture failed: ' + url)); img.src = src; }); return img; })()).get(url);
async function picTexture(url, { w = 128, h = 128, color = '#fff', full = false, round = false } = {}) {
  const img = await loadPic(url), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = full ? '#fff' : 'rgba(22,26,38,0.96)'; g.beginPath(); round ? g.arc(w / 2, h / 2, w / 2, 0, 7) : g.roundRect(0, 0, w, h, w * 0.12); g.fill();
  if (!full) { g.strokeStyle = color; g.lineWidth = 4; g.stroke(); }
  if (round) g.clip();
  const pad = full || round ? 0 : w * 0.16; g.drawImage(img, pad, pad, w - 2 * pad, h - 2 * pad);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
const PLAQUE = {   // where the picture goes on each model (model units): position, size [w,h], rotation.x
  service: [[0.24, 0.02, 0.49], [0.5, 0.5]], database: [[0, 0.05, 0.55], [0.5, 0.5]], queue: [[0, 0.02, 0.32], [0.46, 0.46]], repo: [[0, -0.1, 0.1], [0.42, 0.42]],
  file: [[0.06, 0.06, 0.15], [0.5, 0.5]], document: [[0.08, -0.06, 0.13], [0.8, 1.03]], person: [[0, -0.118, -0.698], [0.58, 0.58], -Math.PI / 2 + 0.35], cloud: [[0, 0, 0.5], [0.5, 0.5]],
};

// ---- models: the seven .glb prototypes (cloned per node) or procedural groups from models.js -------------------------------
const loader = new GLTFLoader(), protos = new Map(), modelFiles = [...new Set(Object.values(TM))];
await Promise.all(modelFiles.map(f => new Promise((ok, no) => loader.load(asset(f), g => { protos.set(f, g.scene); ok(); }, undefined, no))));
const bodyFor = (n, procedural) => procedural ? buildModel(THREE, n.type) : protos.get(TM[n.type]).clone();
const labelSprite = (title, sub, color, h) => {
  const c = document.createElement('canvas'), g = c.getContext('2d'), f1 = '600 40px Inter, Segoe UI, Helvetica, Arial, sans-serif', f2 = '400 30px Inter, Segoe UI, Helvetica, Arial, sans-serif';
  g.font = f1; const w1 = g.measureText(title).width; g.font = f2; const w2 = sub ? g.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(w1, w2)) + 36; c.height = sub ? 96 : 60;
  g.fillStyle = 'rgba(8,10,18,0.78)'; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 14); g.fill();
  g.font = f1; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(title, 18, sub ? 28 : 30);
  if (sub) { g.font = f2; g.fillStyle = 'rgba(232,234,242,0.6)'; g.fillText(sub, 18, 70); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(h * c.width / c.height, h, 1); return s;
};
const holders = [], pickers = new THREE.Group(); pickers.visible = false; scene.add(pickers);
const labelFor = n => n.type === 'repo' && !state.files ? `${n.files} files · ★ ${n.stars}` : (n.type === 'service' || n.type === 'repo' || n.type === 'document' || n.type === 'cloud' || n.type === 'database') ? n.sublabel : null;
function setLabel(h, n) { if (h.label) { h.remove(h.label); h.label.material.map.dispose(); } const big = n.type !== 'file';
  h.label = labelSprite(n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label, labelFor(n), big ? '#f2f4fa' : '#c9cfdd', big ? 0.36 : 0.24); h.label.position.y = 0.72 + (labelFor(n) ? 0.1 : 0); h.label.center.set(0.5, 0); h.add(h.label); }
nodes.forEach((n, i) => {
  const h = new THREE.Group(); h.position.copy(P[i]); h.userData.i = i; h.base = SCALE[n.type]; h.scale.setScalar(0.001);
  h.body = bodyFor(n, false); h.add(h.body);
  const [pos, [pw, ph], rx = 0] = PLAQUE[n.type];
  h.plaque = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); h.plaque.position.set(...pos); h.plaque.rotation.x = rx; h.add(h.plaque);
  setLabel(h, n); h.label.position.y /= h.base;
  const pk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1.0), new THREE.MeshBasicMaterial()); pk.position.copy(P[i]); pk.scale.setScalar(h.base); pk.userData.i = i; pickers.add(pk); h.picker = pk;
  scene.add(h); holders.push(h);
});
async function paintPlaque(h, n, pictures) {
  const url = asset(pictures ? pictureFor(n) : n.icon);
  const tex = await picTexture(url, n.thumb && pictures ? { w: 240, h: 310, full: true } : n.avatar && pictures ? { w: 128, h: 128, round: true } : { color: TC[n.type] });
  h.plaque.material.map = tex; h.plaque.material.opacity = 1; h.plaque.material.needsUpdate = true;
}
const paintAll = pictures => Promise.all(holders.map((h, i) => paintPlaque(h, nodes[i], pictures)));
const bandLabel = (text, z) => { const s = labelSprite(text, null, 'rgba(232,234,242,0.45)', 0.5); s.position.set(Math.min(...L.map(p => p.x)) - 2.5, 0.05, z); s.center.set(1, 0); scene.add(s); return s; };
const bands = [['CLOUD', -8], ['SERVICES', -4], ['DATA STORES', 0], ['REPOS & FILES', 4.2], ['PEOPLE & DOCUMENTS', 8.6]].map(([t, z]) => bandLabel(t, z));

// ---- edges: tubes (solid) / dashed lines, arrow cones at the target, colour + width + dash from relation_styles ----------
const parseColor = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [new THREE.Color(s), 1]; const [r, g, b, a = 1] = m[1].split(',').map(Number); return [new THREE.Color(r / 255, g / 255, b / 255), a]; };
const edges = new THREE.Group(); scene.add(edges); const edgeObjs = [], Y = new THREE.Vector3(0, 1, 0);
for (const l of links) {
  const r = RS[l.relation], [col, alpha] = parseColor(r.color), a = P[l.s], b = P[l.t], d = a.distanceTo(b);
  const mid = a.clone().lerp(b, 0.5); mid.y += 0.6 + d * 0.12; const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const grp = new THREE.Group(); grp.userData = { s: l.s, t: l.t, relation: l.relation, base: alpha * 0.7 };
  const mat = r.dash ? new THREE.LineDashedMaterial({ color: col, dashSize: r.dash[0] * 0.07, gapSize: r.dash[1] * 0.07, transparent: true, opacity: alpha * 0.7, depthWrite: false })
    : new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: alpha * 0.7, depthWrite: false });
  if (r.dash) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), mat); ln.computeLineDistances(); grp.add(ln); }
  else grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, r.width * 0.016, 5, false), mat));
  if (r.arrow) { const t = Math.max(0.6, 1 - (0.75 * SCALE[nodes[l.t].type]) / d), cone = new THREE.Mesh(new THREE.ConeGeometry(0.07 + r.width * 0.01, 0.22, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: Math.min(1, alpha * 1.1), depthWrite: false }));
    cone.position.copy(curve.getPoint(t)); cone.quaternion.setFromUnitVectors(Y, curve.getTangent(t)); grp.add(cone); }
  edges.add(grp); edgeObjs.push(grp);
}
function paintEdges() {
  for (const e of edgeObjs) { const { s, t, relation, base } = e.userData, hot = hover >= 0 || focus >= 0, on = (hover >= 0 && (s === hover || t === hover)) || (focus >= 0 && (s === focus || t === focus));
    e.visible = state.files || relation !== 'contains'; for (const m of e.children) { m.material.opacity = !hot ? (m.isMesh && m.geometry.type === 'ConeGeometry' ? Math.min(1, base * 1.2) : base) : on ? 1 : base * 0.12; } }
}

// ---- interaction: raycast hover (enlarge + card), click fly-to, double-click reset, document preview --------------------
let hover = -1, focus = -1, tween = null, entrance = true; const pointer = { x: 0, y: 0, down: null }, raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const kvFor = n => ({
  service: { type: 'service', lang: n.lang, health: n.health, owner: nameOf(n.owner), repo: nameOf(n.repo), rps: n.rps, 'deploys to': links.filter(l => l.source === n.id && l.relation === 'deploys_to').map(l => nameOf(l.target)).join(', ') },
  database: { type: 'database', engine: n.engine, size: n.size_gb + ' GB' }, queue: { type: 'queue', engine: n.engine }, repo: { type: 'repo', language: n.language, stars: n.stars, files: n.files },
  file: { type: 'file', path: n.sublabel, ext: n.ext, loc: n.loc, repo: nameOf(n.repo) }, document: { type: 'document', format: n.format, pages: n.pages, kind: n.kind, updated: n.updated, author: nameOf(n.author) },
  person: { type: 'person', role: n.role, team: TEAMS[n.team]?.label }, cloud: { type: 'cloud', provider: n.provider } }[n.type]);
function doPick() {
  ndc.set(pointer.x / innerWidth * 2 - 1, -(pointer.y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pickers.children.filter(p => p.visible), false)[0], i = hit ? hit.object.userData.i : -1;
  if (i !== hover) { hover = i; app.style.cursor = i >= 0 ? 'pointer' : ''; paintEdges(); }
  if (i >= 0) { const n = nodes[i]; hud.showTooltip(`<img class="tt-pic" src="${asset(pictureFor(n))}">` + tooltipHtml(n.label, kvFor(n)), pointer.x, pointer.y); } else hud.hideTooltip();
}
const tweenCamera = (pos, target, ms) => { tween = { p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target, start: performance.now(), ms }; };
const HOME_DIR = new THREE.Vector3(0, 0.78, 1).normalize();
function home(ms) { const xs = L.map(p => p.x), zs = L.map(p => p.z), c = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0.4, (Math.min(...zs) + Math.max(...zs)) / 2 + 1.5);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), Rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 2.5, Rz = (Math.max(...zs) - Math.min(...zs)) / 2 + 2.5;
  tweenCamera(c.clone().addScaledVector(HOME_DIR, Math.max(Rx / (tanV * camera.aspect), Rz * 0.78 / tanV) * 1.06), c, ms); }
function focusNode(i) {
  if (i === focus) return reset();
  focus = i; const ids = [nodes[i].id, ...(nb.get(nodes[i].id) || [])].map(id => index.get(id)).filter(j => holders[j].visible);
  const c = ids.reduce((a, j) => a.add(P[j]), new THREE.Vector3()).divideScalar(ids.length), r = Math.max(2.5, ...ids.map(j => P[j].distanceTo(c) + 1));
  const dir = camera.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, 0.55); dir.normalize();
  tweenCamera(c.clone().addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05), c, 1100); paintEdges();
  if (nodes[i].type === 'document') showPreview(nodes[i]); else hidePreview();
}
function reset() { focus = -1; hidePreview(); paintEdges(); home(1000); }
renderer.domElement.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; if (!entrance) doPick(); });
renderer.domElement.addEventListener('pointerdown', e => { pointer.down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => { if (pointer.down && Math.hypot(e.clientX - pointer.down[0], e.clientY - pointer.down[1]) < 4 && hover >= 0) focusNode(hover); pointer.down = null; });
renderer.domElement.addEventListener('dblclick', () => { if (hover < 0) reset(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const pv = document.createElement('div'); pv.className = 'hud preview'; pv.hidden = true;
function showPreview(n) { const chips = links.filter(l => l.source === n.id || l.target === n.id).map(l => `<span class="chip">${RS[l.relation].label} · ${esc(nameOf(l.source === n.id ? l.target : l.source))}</span>`).join('');
  pv.innerHTML = `<b>${esc(n.label)}</b><span class="x">✕</span><div class="sub">${esc(n.sublabel)} · ${n.kind} · updated ${n.updated}</div><img src="${asset(n.thumb)}" alt="">${chips}`; pv.hidden = false; pv.querySelector('.x').onclick = hidePreview; }
const hidePreview = () => { pv.hidden = true; };

// ---- glTF export (binary .glb of the visible scene) --------------------------------------------------------------------------
const exportGltf = () => new Promise((ok, no) => new GLTFExporter().parse(scene, buf => {
  const blob = new Blob([buf], { type: 'model/gltf-binary' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'scene.glb'; a.click();
  ok({ bytes: buf.byteLength, magic: String.fromCharCode(...new Uint8Array(buf, 0, 4)) }); }, no, { binary: true, onlyVisible: true }));

// ---- HUD: toggles, legend of object kinds (frame + picture) and relation strokes ---------------------------------------------
const hud = mountHud({ title: 'Objects 3D', library: 'three.js', version: '0.186.0 · GLTFLoader · GLTFExporter', legend: false, toggles: [
  { id: 'labels', label: 'Labels', on: true, onChange: on => { state.labels = on; } },
  { id: 'pictures', label: 'Pictures', on: true, onChange: on => { state.pictures = on; paintAll(on); } },
  { id: 'files', label: 'Files inside repos', on: false, onChange: on => { state.files = !on; holders.forEach((h, i) => { if (nodes[i].type === 'file') h.visible = h.picker.visible = !on; if (nodes[i].type === 'repo') { setLabel(h, nodes[i]); h.label.position.y /= h.base; } }); paintEdges(); } },
  { id: 'procedural', label: 'Procedural models', on: false, onChange: on => { state.procedural = on; holders.forEach((h, i) => { h.remove(h.body); h.body = bodyFor(nodes[i], on); h.add(h.body); }); } },
  { id: 'spin', label: 'Auto-orbit', on: false, onChange: on => { controls.autoRotate = on; } },
  { id: 'export', label: 'Export glTF ↓', on: false, onChange: () => { exportGltf().catch(e => console.warn(e)).finally(() => hud.setToggle('export', false)); } },
] });
const wrap = document.createElement('div'); wrap.appendChild(pv); hud.root.appendChild(wrap);
const lg = document.createElement('div'); lg.className = 'hud hud--bl legend';
lg.innerHTML = Object.keys(TC).map(t => { const n = nodes.find(n => n.type === t); return `<div class="legend-row"><span class="sw ${TF[t]}" style="--c:${TC[t]}"><img src="${asset(n.logo || n.avatar || n.icon)}" alt=""></span>${t} <span class="sub">· ${TM[t].replace('models/', '').replace('.glb', '')}.glb</span></div>`; }).join('')
  + `<div class="col2">${Object.entries(RS).map(([k, r]) => `<div><svg class="rel" viewBox="0 0 34 8"><line x1="0" y1="4" x2="34" y2="4" stroke="${r.color}" stroke-width="${r.width * 1.3}" ${r.dash ? `stroke-dasharray="${r.dash.join(' ')}"` : ''}/></svg>${r.label}</div>`).join('')}</div>`;
hud.root.appendChild(lg);

// ---- entrance + render loop -----------------------------------------------------------------------------------------------------
const scaleNow = new Float32Array(N).fill(1); let t0 = performance.now();
home(0); camera.position.copy(tween.p1).multiplyScalar(1.25); controls.target.copy(tween.t1); tween = null; home(2200);
app.classList.add('in'); paintEdges();
renderer.setAnimationLoop(now => {
  const t = now - t0; if (entrance && t > 3200) entrance = false;
  for (let i = 0; i < N; i++) { const h = holders[i], pop = entrance ? ease((t - 200 - i * 14) / 800) : 1; scaleNow[i] += ((hover === i ? 1.3 : focus === i ? 1.15 : 1) - scaleNow[i]) * 0.15;
    h.scale.setScalar(Math.max(0.001, h.base * pop * scaleNow[i])); h.label.visible = state.labels; }
  for (const b of bands) b.material.opacity = state.labels ? 1 : 0;
  if (tween) { const k = Math.min(1, (now - tween.start) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (k >= 1) tween = null; }
  controls.update(); renderer.render(scene, camera);
});
await paintAll(true);

// Debug hooks for the gallery's automated smoke test.
window.__demo = { sys, hud, state, scene, ready: true, get hoverNode() { return hover >= 0 ? nodes[hover] : null; },
  modelsLoaded: () => ({ loaded: protos.size, files: [...protos.keys()] }),
  screenPos: id => { const v = P[index.get(id)].clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  cameraPos: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  hoverState: () => ({ hover: hover >= 0 ? nodes[hover].id : null, litEdges: edgeObjs.filter(e => e.children[0].material.opacity === 1).length, scale: hover >= 0 ? +scaleNow[hover].toFixed(2) : null }),
  clickState: () => ({ focus: focus >= 0 ? nodes[focus].id : null, preview: !pv.hidden }),
  toggleState: () => ({ ...state, spin: controls.autoRotate, visibleHolders: holders.filter(h => h.visible).length, visibleEdges: edgeObjs.filter(e => e.visible).length, plaques: holders.filter(h => h.plaque.material.map).length, bodyKind: holders[0].body.children.length }),
  focus: id => focusNode(index.get(id)), reset, exportGltf, settle: () => { entrance = false; } };
