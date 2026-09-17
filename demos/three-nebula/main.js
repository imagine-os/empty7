// Graph Gallery · three-nebula: instanced emissive spheres + additive halos, Bezier tube edges with endpoint gradients,
// FogExp2, UnrealBloom, slow auto-orbit, staged scale-in. Layout: d3-force-3d run off-screen, then expanded on screen.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import { loadData, mountHud, linkColor, tooltipHtml, GOLD } from '../../shared/hud.js';

const BG = '#02030a', app = document.getElementById('app');
const data = await loadData('../../shared/data.json');
const { nodes, links, byId, neighbors } = data;
const N = nodes.length, L = links.length, index = new Map(nodes.map((n, i) => [n.id, i]));
const STAGE = { studio: 0, film: 1, person: 2, genre: 3, award: 4 };
const boost = n => n.type === 'film' ? 1 + (n.gross_musd || 0) / 900 : n.type === 'person' ? 1 + (n.wins || 0) * 0.12 : 1;
const radius = n => n.size * 0.62 * boost(n);
const isGold = l => linkColor(l) === GOLD;
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const back = t => { t = Math.min(1, Math.max(0, t)); const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ---- layout (off-screen) -------------------------------------------------------------------------
const DIST = { produced_by: 62, genre: 52, won: 68, nominated: 62, nominee: 62 };
const sim = forceSimulation(nodes, 3)
  .force('link', forceLink(links).id(d => d.id).distance(l => DIST[l.relation] || 34).strength(0.7))
  .force('charge', forceManyBody().strength(-70)).force('center', forceCenter()).stop();
for (let i = 0; i < 260; i++) sim.tick();
const P = nodes.map(n => new THREE.Vector3(n.x, n.y, n.z));   // final positions
const src = l => index.get(l.source.id), dst = l => index.get(l.target.id);

// ---- renderer / scene ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(BG, 0.0016);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 6000); camera.position.set(0, 80, 1500);
scene.add(new THREE.HemisphereLight(0xdde6ff, 0x1a1030, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1, 1.2, 1.5); scene.add(key);

// ---- nodes: instanced spheres with per-instance emissive tint, plus additive billboard halos ------
const uEmissive = { value: 0.3 };
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
sphereMat.onBeforeCompile = sh => {            // instance colour also drives emission (vColor exists with instanceColor)
  sh.uniforms.uEmissive = uEmissive;
  sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 emissive;', 'uniform vec3 emissive; uniform float uEmissive;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * uEmissive;\n#endif');
};
const spheres = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), sphereMat, N);
const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22, fog: false }), N);
const baseColor = nodes.map(n => new THREE.Color(n.color)), tmpColor = new THREE.Color(), M = new THREE.Matrix4(), S = new THREE.Vector3();
nodes.forEach((n, i) => { spheres.setColorAt(i, baseColor[i]); halos.setColorAt(i, baseColor[i]); });
scene.add(spheres, halos);

// ---- edges: quadratic Bezier tubes (or line segments) with endpoint-colour gradients -----------------
const curves = links.map(l => {
  const a = P[src(l)], b = P[dst(l)], mid = a.clone().lerp(b, 0.5), ab = b.clone().sub(a);
  const off = new THREE.Vector3().crossVectors(ab, new THREE.Vector3(0.3, 1, 0.2)).normalize().multiplyScalar(ab.length() * 0.22);
  return new THREE.QuadraticBezierCurve3(a, mid.add(off), b);
});
const edgeTint = (l, t) => {                   // shared semantics: gold for wins, role tints, faint structural edges
  const c = tmpColor.copy(baseColor[src(l)]).lerp(baseColor[dst(l)], t), base = linkColor(l);
  if (base.startsWith('#')) c.lerp(new THREE.Color(base), isGold(l) ? 1 : 0.55);
  return c.multiplyScalar(isGold(l) ? 1.1 : base.startsWith('#') ? 0.7 : 0.35);
};
const TUB = 10, RAD = 5, VT = (TUB + 1) * (RAD + 1), VL = TUB * 2;
const tubeGeo = mergeGeometries(links.map((l, k) => new THREE.TubeGeometry(curves[k], TUB, isGold(l) ? 0.55 : 0.32, RAD, false)));
const lineGeo = new THREE.BufferGeometry().setFromPoints(curves.flatMap(c => { const p = c.getPoints(TUB); return p.flatMap((q, i) => i ? [p[i - 1], q] : []); }));
const tubeCol = new Float32Array(L * VT * 3), lineCol = new Float32Array(L * VL * 3);
tubeGeo.setAttribute('color', new THREE.BufferAttribute(tubeCol, 3)); lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
const tubes = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
lines.visible = false;
const edges = new THREE.Group(); edges.add(tubes, lines); scene.add(edges);
function paintEdges(time) {
  const geo = tubes.visible ? tubeGeo : lineGeo, arr = tubes.visible ? tubeCol : lineCol, V = tubes.visible ? VT : VL;
  links.forEach((l, k) => {
    const on = !hover || lit(src(l)) && lit(dst(l)), pulse = isGold(l) ? 0.75 + 0.25 * Math.sin(time * 0.003 + k) : 1;
    const dim = (hover ? (on ? 1.6 : 0.06) : 1) * pulse;
    for (let v = 0; v < V; v++) {
      const t = tubes.visible ? Math.floor(v / (RAD + 1)) / TUB : (v + 1 >> 1) / TUB, c = edgeTint(l, t);
      arr.set([c.r * dim, c.g * dim, c.b * dim], (k * V + v) * 3);
    }
  });
  geo.attributes.color.needsUpdate = true;
}

// ---- labels for studios and awards --------------------------------------------------------------
const labels = nodes.map((n, i) => {
  if (n.type !== 'studio' && n.type !== 'award') return null;
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44; g.font = `${n.type === 'studio' ? 600 : 400} ${fs}px Inter, Segoe UI, Helvetica, Arial, sans-serif`;
  c.width = Math.ceil(g.measureText(n.label).width) + 24; c.height = fs + 24; g.font = `${n.type === 'studio' ? 600 : 400} ${fs}px Inter, Segoe UI, Helvetica, Arial, sans-serif`;
  g.fillStyle = n.type === 'studio' ? '#ffe3a6' : '#f3e6ff'; g.textBaseline = 'middle'; g.fillText(n.label, 12, c.height / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  const h = n.type === 'studio' ? 7 : 5.5; s.scale.set(h * c.width / c.height, h, 1); s.userData.i = i; scene.add(s); return s;
});

// ---- post-processing ----------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.45, 0.35);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---- camera, controls, camera tween, fit --------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.autoRotate = true; controls.autoRotateSpeed = 0.45;
let tween = null;
const tweenCamera = (pos, target, ms) => { tween = { p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target, start: performance.now(), ms }; };
function fitCamera(ms) {                        // tight frustum fit of all nodes along the current view direction
  const c = P.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(N);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize(); if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(dir, right), v = new THREE.Vector3();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect; let dist = 0;
  nodes.forEach((n, i) => { v.copy(P[i]).sub(c); const d = v.dot(dir), m = radius(n) * 2; dist = Math.max(dist, (Math.abs(v.dot(up)) + m) / tanV + d, (Math.abs(v.dot(right)) + m) / tanH + d); });
  tweenCamera(c.clone().addScaledVector(dir, dist * 1.05), c, ms);
}
function focusNode(i) {
  const dir = camera.position.clone().sub(P[i]).normalize();
  tweenCamera(P[i].clone().addScaledVector(dir, 60 + radius(nodes[i]) * 4), P[i].clone(), 1200);
}

// ---- interaction --------------------------------------------------------------------------------
let hover = -1, pointer = { x: 0, y: 0, downAt: null }, scaleNow = new Float32Array(N).fill(1);
const lit = i => hover < 0 || i === hover || neighbors.get(nodes[hover].id)?.has(nodes[i].id);
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const kvFor = n => ({
  film:   { year: n.year, gross: n.gross_musd != null ? `$${n.gross_musd}M` : null, budget: n.budget_musd != null ? `$${n.budget_musd}M` : null, wins: n.wins },
  person: { born: n.born, nationality: n.nationality, films: n.film_count, wins: n.wins },
  studio: { founded: n.founded, country: n.country }, genre: { films: n.degree }, award: { category: n.category, links: n.degree },
}[n.type] || {});
function pick() {
  ndc.set(pointer.x / innerWidth * 2 - 1, -(pointer.y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  spheres.computeBoundingSphere();               // instance matrices change every frame
  const hit = raycaster.intersectObject(spheres)[0], i = hit ? hit.instanceId : -1;
  if (i === hover) return;
  hover = i; app.style.cursor = i >= 0 ? 'pointer' : '';
  if (i >= 0) hud.showTooltip(tooltipHtml(nodes[i].label, { type: nodes[i].type, ...kvFor(nodes[i]) }), pointer.x, pointer.y); else hud.hideTooltip();
}
const stopSpin = () => { controls.autoRotate = false; hud.setToggle('spin', false); };
renderer.domElement.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; if (!entrance) pick(); });
renderer.domElement.addEventListener('pointerdown', e => { pointer.downAt = [e.clientX, e.clientY]; stopSpin(); });
renderer.domElement.addEventListener('pointerup', e => {
  if (pointer.downAt && Math.hypot(e.clientX - pointer.downAt[0], e.clientY - pointer.downAt[1]) < 4 && hover >= 0) focusNode(hover);
  pointer.downAt = null;
});
renderer.domElement.addEventListener('dblclick', () => { if (hover < 0) fitCamera(1000); });
addEventListener('wheel', stopSpin, { passive: true });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---- HUD ----------------------------------------------------------------------------------------
const hud = mountHud({
  title: 'Nebula', library: 'three.js', version: '0.186.0 · d3-force-3d 3.0.6', typeColors: data.meta.type_colors,
  toggles: [
    { id: 'bloom', label: 'Bloom', on: true, onChange: on => { bloom.enabled = on; } },
    { id: 'tubes', label: 'Tube edges', on: true, onChange: on => { tubes.visible = on; lines.visible = !on; } },
    { id: 'fog', label: 'Depth fog', on: true, onChange: on => { scene.fog = on ? new THREE.FogExp2(BG, 0.0016) : null; sphereMat.needsUpdate = true; } },
    { id: 'spin', label: 'Auto-orbit', on: true, onChange: on => { controls.autoRotate = on; } },
  ],
});

// ---- entrance + render loop ---------------------------------------------------------------------
let t0 = performance.now(), entrance = true;
app.classList.add('in'); fitCamera(2600);
renderer.setAnimationLoop(now => {
  const t = now - t0, E = entrance ? ease((t - 150) / 1700) : 1;       // expansion from the centre
  if (entrance && t > 3200) entrance = false;
  for (let i = 0; i < N; i++) {
    const n = nodes[i], s = (entrance ? back((t - 250 - STAGE[n.type] * 230) / 950) : 1) * (scaleNow[i] += ((hover === i ? 1.5 : 1) - scaleNow[i]) * 0.15);
    const r = radius(n) * s, p = S.copy(P[i]).multiplyScalar(E);
    M.makeScale(r, r, r).setPosition(p); spheres.setMatrixAt(i, M);
    M.compose(p, camera.quaternion, S.set(r * 3.8, r * 3.8, 1)); halos.setMatrixAt(i, M);
    tmpColor.copy(baseColor[i]).multiplyScalar(lit(i) ? (hover === i ? 1.3 : 1) : 0.1); spheres.setColorAt(i, tmpColor); halos.setColorAt(i, tmpColor);
    if (labels[i]) { labels[i].position.copy(p).add(S.set(0, r + 6, 0)); labels[i].material.opacity = (lit(i) ? 1 : 0.15) * E; }
  }
  spheres.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = spheres.instanceColor.needsUpdate = halos.instanceColor.needsUpdate = true;
  edges.scale.setScalar(E); tubes.material.opacity = 0.18 * ease((t - 700) / 1400); lines.material.opacity = 0.45 * ease((t - 700) / 1400);
  paintEdges(now);
  if (tween) { const k = ease((now - tween.start) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (k >= 1) tween = null; }
  controls.update();
  composer.render();
});

// Debug hooks for the gallery's automated smoke test.
window.__demo = {
  data, hud, bloom, get hoverNode() { return hover >= 0 ? nodes[hover] : null; },
  screenPos: id => { const v = P[index.get(id)].clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  cameraPos: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  focus: id => focusNode(index.get(id)), reset: () => fitCamera(1000), settle: () => { entrance = false; },
};
